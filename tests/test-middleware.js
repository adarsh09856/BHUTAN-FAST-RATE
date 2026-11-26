const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');

const WORKTREE_ROOT = path.resolve(__dirname, '..');

async function startEphemeralServer(expressApp) {
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

async function runTests() {
  const createdUploadPaths = [];
  let mainServer = null;
  let testAppServer = null;

  try {
    console.log('1. Testing password hashing & scrypt timingSafeEqual verification...');
    const {
      hashPassword,
      verifyPassword,
      signToken,
      verifyToken,
      requireStaff,
      requireGuide,
      requireClient,
      verifyClientBookingParam
    } = require('../middleware/auth');
    const db = require('../database/db');

    const hash1 = hashPassword('MySecretPass!2026');
    const hash2 = hashPassword('MySecretPass!2026');
    assert.ok(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(hash1), `Unexpected hash format: ${hash1}`);
    assert.notStrictEqual(hash1, hash2, 'Salts must be random per call');
    assert.strictEqual(verifyPassword('MySecretPass!2026', hash1), true);
    assert.strictEqual(verifyPassword('WrongPass', hash1), false);

    // Cross-compatibility with database/db.js hashPasswordScrypt
    const seededHash = db.hashPasswordScrypt('admin123');
    assert.strictEqual(verifyPassword('admin123', seededHash), true);
    assert.strictEqual(verifyPassword('admin124', seededHash), false);

    // Malformed / edge inputs must never throw
    for (const badStored of ['', null, undefined, 'admin123', 'scrypt$abc', 'scrypt$deadbeef$zzzz', 'scrypt$deadbeef$aa', 'bcrypt$2b$10$xyz']) {
      assert.strictEqual(verifyPassword('admin123', badStored), false, `Must reject malformed hash: ${String(badStored)}`);
    }
    assert.strictEqual(verifyPassword(null, hash1), false);
    assert.strictEqual(verifyPassword(undefined, hash1), false);

    console.log('2. Testing JWT signToken / verifyToken & production secret safety...');
    const token = signToken({ id: 7, role: 'admin', email: 'test@bhutanfastratetours.bt' }, 3600);
    assert.strictEqual(token.split('.').length, 3, 'JWT must have 3 compact segments');
    const decoded = verifyToken(token);
    assert.ok(decoded && decoded.id === 7 && decoded.role === 'admin', 'Decoded payload must match');
    assert.ok(typeof decoded.exp === 'number' && typeof decoded.iat === 'number');

    // Expired token rejected
    const expiredToken = signToken({ id: 7, role: 'admin' }, -10);
    assert.strictEqual(verifyToken(expiredToken), null, 'Expired token must return null');

    // Tampered payload rejected
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 7, role: 'super_admin', exp: decoded.exp })).toString('base64url');
    assert.strictEqual(verifyToken(`${parts[0]}.${tamperedPayload}.${parts[2]}`), null, 'Tampered payload must fail signature');

    // Tampered signature rejected (flip index 5 to avoid trailing 2 padding bits of 43-char base64url HMAC-SHA256)
    const flipChar = parts[2][5] === 'A' ? 'B' : 'A';
    const flippedSig = parts[2].slice(0, 5) + flipChar + parts[2].slice(6);
    assert.strictEqual(verifyToken(`${parts[0]}.${parts[1]}.${flippedSig}`), null, 'Tampered signature must fail');
    assert.strictEqual(verifyToken(''), null);
    assert.strictEqual(verifyToken(null), null);
    assert.strictEqual(verifyToken('not.a.valid.jwt.string'), null);

    // Production mode must refuse weak .env.example default secret
    const prevNodeEnv = process.env.NODE_ENV;
    const prevJwtSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'bhutan_fast_rate_super_secret_jwt_key_2026';
      delete require.cache[require.resolve('../middleware/auth')];
      const prodAuth = require('../middleware/auth');
      const prodToken = prodAuth.signToken({ id: 1, role: 'super_admin' }, 60);
      assert.ok(prodAuth.verifyToken(prodToken), 'Ephemeral production secret must verify tokens from same process');
      // Verify it did NOT sign using the weak static string
      const crypto = require('crypto');
      const [h, p, s] = prodToken.split('.');
      const weakSig = crypto.createHmac('sha256', 'bhutan_fast_rate_super_secret_jwt_key_2026').update(`${h}.${p}`).digest('base64url');
      assert.notStrictEqual(s, weakSig, 'Production mode must NOT sign with weak static default secret');
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevJwtSecret;
      delete require.cache[require.resolve('../middleware/auth')];
    }

    console.log('3. Testing RBAC middleware & query-token restrictions...');
    const {
      UPLOAD_ROOT,
      ensureUploadDirs,
      uploadTravelerDocs,
      uploadPaymentReceipt,
      toRelativeUploadPath
    } = require('../middleware/upload');

    ensureUploadDirs();
    for (const sub of ['passports', 'insurance', 'photos', 'receipts']) {
      assert.ok(fs.existsSync(path.join(UPLOAD_ROOT, sub)), `Missing upload subdir: ${sub}`);
    }

    const testApp = express();
    testApp.use(express.json());

    testApp.get('/rbac/staff-any', requireStaff(), (req, res) => res.json({ ok: true, user: req.user }));
    testApp.get('/rbac/staff-ops', requireStaff('admin', 'concierge'), (req, res) => res.json({ ok: true, role: req.user.role }));
    testApp.get('/rbac/staff-super', requireStaff('super_admin'), (req, res) => res.json({ ok: true, role: req.user.role }));
    testApp.get('/rbac/staff-query-ok', requireStaff('admin', 'super_admin', { allowQueryToken: true }), (req, res) => res.json({ ok: true }));
    testApp.post('/rbac/staff-query-post', requireStaff('admin', 'super_admin', { allowQueryToken: true }), (req, res) => res.json({ ok: true }));
    testApp.get('/rbac/guide-only', requireGuide(), (req, res) => res.json({ ok: true, role: req.user.role }));
    testApp.get('/rbac/client-only', requireClient(), (req, res) => res.json({ ok: true, bookingId: req.clientBookingId }));
    testApp.get('/rbac/client-query-ok', requireClient({ allowQueryToken: true }), (req, res) => res.json({ ok: true, bookingId: req.clientBookingId }));
    testApp.post('/rbac/client-query-post', requireClient({ allowQueryToken: true }), (req, res) => res.json({ ok: true }));
    testApp.get('/rbac/client-bookings/:bookingId', requireClient(), verifyClientBookingParam('bookingId'), (req, res) => {
      res.json({ ok: true, bookingId: req.clientBookingId });
    });

    testApp.post('/upload/traveler', uploadTravelerDocs, (req, res) => {
      const saved = {};
      for (const field of Object.keys(req.files || {})) {
        const f = req.files[field][0];
        createdUploadPaths.push(f.path);
        saved[field] = {
          filename: f.filename,
          relative: toRelativeUploadPath(f),
          size: f.size
        };
      }
      res.json({ success: true, saved });
    });

    testApp.post('/upload/receipt', uploadPaymentReceipt, (req, res) => {
      if (req.file) createdUploadPaths.push(req.file.path);
      res.json({
        success: true,
        relative: req.file ? toRelativeUploadPath(req.file) : null
      });
    });

    testApp.use((err, req, res, next) => {
      const status = err.code === 'LIMIT_FILE_SIZE' || err.code === 'INVALID_FILE_TYPE' || err.status === 400 ? 400 : 500;
      res.status(status).json({ success: false, error: err.message, code: err.code });
    });

    const startedTest = await startEphemeralServer(testApp);
    testAppServer = startedTest.server;
    const tUrl = startedTest.baseUrl;

    const superToken = signToken({ id: 1, role: 'super_admin' });
    const adminToken = signToken({ id: 2, role: 'admin' });
    const conciergeToken = signToken({ id: 3, role: 'concierge' });
    const guideToken = signToken({ id: 4, role: 'guide' });
    const clientToken = signToken({ role: 'client', bookingId: 'BFR-2026-8841' });
    const badClientToken = signToken({ role: 'client' });

    // Unauthenticated & invalid -> 401
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-ops`)).status, 401);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-ops`, { headers: { Authorization: `Bearer ${expiredToken}` } })).status, 401);
    assert.strictEqual((await fetch(`${tUrl}/rbac/guide-only`)).status, 401);
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-only`)).status, 401);

    // RBAC matrix
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-ops`, { headers: { Authorization: `Bearer ${guideToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-any`, { headers: { Authorization: `Bearer ${guideToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-any`, { headers: { Authorization: `Bearer ${clientToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-ops`, { headers: { Authorization: `Bearer ${conciergeToken}` } })).status, 200);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-super`, { headers: { Authorization: `Bearer ${conciergeToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-super`, { headers: { Authorization: `Bearer ${superToken}` } })).status, 200);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-any`, { headers: { Authorization: `Bearer ${conciergeToken}` } })).status, 200);

    // Guide RBAC
    assert.strictEqual((await fetch(`${tUrl}/rbac/guide-only`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/guide-only`, { headers: { Authorization: `Bearer ${guideToken}` } })).status, 200);

    // Client RBAC & booking mismatch
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-only`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-only`, { headers: { Authorization: `Bearer ${badClientToken}` } })).status, 403);
    const clientRes = await fetch(`${tUrl}/rbac/client-only`, { headers: { Authorization: `Bearer ${clientToken}` } });
    assert.strictEqual(clientRes.status, 200);
    assert.strictEqual((await clientRes.json()).bookingId, 'BFR-2026-8841');

    assert.strictEqual((await fetch(`${tUrl}/rbac/client-bookings/BFR-OTHER`, { headers: { Authorization: `Bearer ${clientToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-bookings/BFR-2026-8841`, { headers: { Authorization: `Bearer ${clientToken}` } })).status, 200);

    // Query token rules: rejected by default on GET, allowed on GET only when opted in, NEVER on POST
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-ops?token=${encodeURIComponent(adminToken)}`)).status, 401);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-query-ok?token=${encodeURIComponent(adminToken)}`)).status, 200);
    assert.strictEqual((await fetch(`${tUrl}/rbac/staff-query-post?token=${encodeURIComponent(adminToken)}`, { method: 'POST' })).status, 401);
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-query-ok?token=${encodeURIComponent(clientToken)}`)).status, 200);
    assert.strictEqual((await fetch(`${tUrl}/rbac/client-query-post?token=${encodeURIComponent(clientToken)}`, { method: 'POST' })).status, 401);

    console.log('4. Testing Multer private uploads (MIME, extension, filename sanitization, 5MB limit)...');
    // Valid traveler uploads (with path-traversal filename sanitized)
    const validForm = new FormData();
    validForm.append('passport_scan', new Blob([Buffer.from('%PDF-1.4\n%test\n')], { type: 'application/pdf' }), '../../evil-passport.pdf');
    validForm.append('photo_url', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), '../photo.PNG');
    validForm.append('insurance_doc', new Blob([Buffer.from('%PDF-1.4\n%ins\n')], { type: 'application/pdf' }), 'policy.pdf');

    const upRes = await fetch(`${tUrl}/upload/traveler`, { method: 'POST', body: validForm });
    assert.strictEqual(upRes.status, 200, 'Valid PDF/PNG uploads must succeed');
    const upJson = await upRes.json();
    assert.ok(upJson.saved.passport_scan.relative.startsWith('passports/') && upJson.saved.passport_scan.relative.endsWith('.pdf'));
    assert.ok(!upJson.saved.passport_scan.filename.includes('evil'), 'Filename must be randomized');
    assert.ok(upJson.saved.photo_url.relative.startsWith('photos/') && upJson.saved.photo_url.relative.endsWith('.png'));
    assert.ok(upJson.saved.insurance_doc.relative.startsWith('insurance/') && upJson.saved.insurance_doc.relative.endsWith('.pdf'));

    // Valid receipt upload
    const receiptForm = new FormData();
    receiptForm.append('receipt_file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }), 'wire-slip.jpg');
    const recRes = await fetch(`${tUrl}/upload/receipt`, { method: 'POST', body: receiptForm });
    assert.strictEqual(recRes.status, 200);
    const recJson = await recRes.json();
    assert.ok(recJson.relative.startsWith('receipts/') && recJson.relative.endsWith('.jpg'));

    // Reject .svg / .txt / .exe / mismatched extension-mime
    for (const [fname, mime, content] of [
      ['bad.svg', 'image/svg+xml', '<svg/>'],
      ['bad.txt', 'text/plain', 'hello'],
      ['bad.exe', 'application/octet-stream', 'MZ'],
      ['fake.jpg', 'application/pdf', '%PDF-1.4']
    ]) {
      const badForm = new FormData();
      badForm.append('receipt_file', new Blob([content], { type: mime }), fname);
      const badRes = await fetch(`${tUrl}/upload/receipt`, { method: 'POST', body: badForm });
      assert.strictEqual(badRes.status, 400, `Expected 400 for ${fname} (${mime}), got ${badRes.status}`);
      const badJson = await badRes.json();
      assert.ok(badJson.error, 'Error response must include error message');
    }

    // Reject > 5MB file
    const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 512, 0x41);
    const bigForm = new FormData();
    bigForm.append('receipt_file', new Blob([bigBuf], { type: 'application/pdf' }), 'huge.pdf');
    const bigRes = await fetch(`${tUrl}/upload/receipt`, { method: 'POST', body: bigForm });
    assert.strictEqual(bigRes.status, 400, `Expected 400 for >5MB upload, got ${bigRes.status}`);
    const bigJson = await bigRes.json();
    assert.ok(bigJson.error && /5MB|large/i.test(bigJson.error), `Expected size limit message, got: ${bigJson.error}`);

    console.log('5. Testing hardened server.js (blocklist, dynamic HTML fallbacks, JSON errors)...');
    const serverExport = require('../server');
    const app = serverExport.app || serverExport;
    const startedMain = await startEphemeralServer(app);
    mainServer = startedMain.server;
    const mUrl = startedMain.baseUrl;

    const healthRes = await fetch(`${mUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual((await healthRes.json()).status, 'online');

    // Sensitive paths must be blocked with 403
    for (const blockedPath of [
      '/database/tours.db',
      '/%64atabase/tours.db',
      '/DATABASE/tours.db',
      '/uploads/../database/tours.db',
      '/uploads/secret.txt',
      '/.env',
      '/.env.example',
      '/package.json',
      '/package-lock.json',
      '/middleware/auth.js',
      '/routes/admin.js',
      '/services/sdf-engine.js',
      '/tests/test-middleware.js',
      '/docs/superpowers/plans/2026-11-26-production-platform-plan.md',
      '/test-crud.js'
    ]) {
      const res = await fetch(`${mUrl}${blockedPath}`);
      assert.strictEqual(res.status, 403, `Expected 403 for ${blockedPath}, got ${res.status}`);
    }

    // Dynamic fallback routes for admin-created slugs -> 200 HTML
    const tourFallbackRes = await fetch(`${mUrl}/tour-nonexistent-custom.html`);
    assert.strictEqual(tourFallbackRes.status, 200, 'Dynamic tour fallback must return 200');
    const tourHtml = await tourFallbackRes.text();
    assert.ok(/<html/i.test(tourHtml), 'Tour fallback must return HTML');

    const destFallbackRes = await fetch(`${mUrl}/destination-nonexistent.html`);
    assert.strictEqual(destFallbackRes.status, 200, 'Dynamic destination fallback must return 200');
    const destHtml = await destFallbackRes.text();
    assert.strictEqual(destHtml, fs.readFileSync(path.join(WORKTREE_ROOT, 'destinations.html'), 'utf8'));

    const festFallbackRes = await fetch(`${mUrl}/festival-nonexistent.html`);
    assert.strictEqual(festFallbackRes.status, 200, 'Dynamic festival fallback must return 200');
    const festHtml = await festFallbackRes.text();
    assert.strictEqual(festHtml, fs.readFileSync(path.join(WORKTREE_ROOT, 'festivals.html'), 'utf8'));

    // Unknown API route returns clean JSON 404
    const api404Res = await fetch(`${mUrl}/api/does-not-exist-xyz`);
    assert.strictEqual(api404Res.status, 404);
    const api404Json = await api404Res.json();
    assert.ok(api404Json && api404Json.error, 'Unknown /api route must return JSON error');

    console.log('✅ ALL MIDDLEWARE, UPLOAD & SERVER HARDENING TESTS PASSED');
  } finally {
    await closeServer(testAppServer);
    await closeServer(mainServer);
    for (const filePath of createdUploadPaths) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }
    try {
      const db = require('../database/db');
      await db.closeDb();
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('❌ MIDDLEWARE TEST FAILED:', err);
  process.exit(1);
});
