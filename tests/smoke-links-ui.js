'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function listHtmlFiles() {
  const results = [];
  const top = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  top.forEach((f) => results.push(path.join(ROOT, f)));
  for (const sub of ['admin', 'client', 'guide']) {
    const subDir = path.join(ROOT, sub);
    if (!fs.existsSync(subDir)) continue;
    fs.readdirSync(subDir)
      .filter((f) => f.endsWith('.html'))
      .forEach((f) => results.push(path.join(subDir, f)));
  }
  return results;
}

function listJsFiles() {
  const results = [];
  for (const dir of ['js', path.join('admin', 'js'), 'routes', 'services', 'middleware', 'database']) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    fs.readdirSync(full)
      .filter((f) => f.endsWith('.js'))
      .forEach((f) => results.push(path.join(full, f)));
  }
  results.push(path.join(ROOT, 'server.js'));
  return results;
}

function httpGet(baseUrl, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${reqPath}`, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('1. Checking orphan retirement & zero forbidden strings across all HTML/JS files...');
  assert(!fs.existsSync(path.join(ROOT, 'app.html')), 'app.html must be retired/removed');
  assert(!fs.existsSync(path.join(ROOT, 'js', 'main.js')), 'js/main.js must be retired/removed');

  const htmlFiles = listHtmlFiles();
  const jsFiles = listJsFiles();
  assert(htmlFiles.length >= 40, `Expected 40+ HTML files, found ${htmlFiles.length}`);

  const forbiddenFrontendPatterns = [
    { name: 'hardcoded admin123', re: /\badmin123\b/i },
    { name: 'hardcoded concierge123', re: /\bconcierge123\b/i },
    { name: 'hardcoded guide123', re: /\bguide123\b/i },
    { name: 'demo_token_admin', re: /demo_token_admin/i },
    { name: 'local preview only', re: /local preview only/i },
    { name: 'Add to trip cart stub', re: /Add to trip/i },
    { name: 'stale #BT-8842 license', re: /#BT-8842/i },
    { name: 'legacy app.html link', re: /\bapp\.html\b/i },
    { name: 'legacy js/main.js ref', re: /js\/main\.js/i },
    { name: 'static $84,600 dashboard', re: /\$84,600/ },
    { name: 'static $22,400 finance', re: /\$22,400/ },
    { name: 'static Tashi Namgyal placeholder', re: /Tashi Namgyal/ },
    { name: 'static 42 Completed placeholder', re: /42 Completed/ },
    { name: 'coming soon stub', re: /coming soon/i }
  ];

  const dynamicFallbacks = /^(?:tour|destination|festival)-[a-z0-9-]+\.html$/i;

  for (const absPath of htmlFiles) {
    const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const html = fs.readFileSync(absPath, 'utf8');

    // Script tag balance & vm.Script compile check
    const openScripts = (html.match(/<script[\s>]/gi) || []).length;
    const closeScripts = (html.match(/<\/script>/gi) || []).length;
    assert.strictEqual(openScripts, closeScripts, `${rel}: mismatched <script> (${openScripts}) vs </script> (${closeScripts})`);

    const scriptMatches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    scriptMatches.forEach((m, idx) => {
      const code = m[1].trim();
      if (code && !m[0].includes('application/json')) {
        new vm.Script(code, { filename: `${rel}#script-${idx}` });
      }
    });

    // Security & stub scan
    for (const pat of forbiddenFrontendPatterns) {
      assert(!pat.re.test(html), `${rel} matched forbidden pattern: ${pat.name}`);
    }

    // Double hash check around [data-bfr-license] & no duplicate #tourMobileBtn listeners alongside site-shell.js
    assert(!/#<span[^>]*data-bfr-license/i.test(html), `${rel} has double # before data-bfr-license`);
    if (html.includes('site-shell.js')) {
      assert(!/getElementById\('tourMobileBtn'\)[\s\S]{0,160}toggle\('hidden'\)/i.test(html), `${rel} duplicates tourMobileBtn toggle already bound by SiteShell`);
    }

    // Check relative links (href / src) ignoring JS template expressions ${...}
    const dirOfFile = path.dirname(absPath);
    const refMatches = [...html.matchAll(/\b(?:href|src)\s*=\s*"([^"]+)"/gi)];
    for (const rm of refMatches) {
      const target = rm[1].trim();
      if (!target || target.startsWith('#') || target.includes('${')) continue;
      if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(target)) continue;
      const cleanPath = target.split('#')[0].split('?')[0];
      if (!cleanPath) continue;
      const resolved = cleanPath.startsWith('/')
        ? path.join(ROOT, cleanPath.slice(1))
        : path.resolve(dirOfFile, cleanPath);

      if (!fs.existsSync(resolved)) {
        const base = path.basename(cleanPath);
        assert(
          dynamicFallbacks.test(base),
          `${rel}: broken relative reference "${target}" (missing ${path.relative(ROOT, resolved)})`
        );
      }
    }
  }

  console.log(`   ✓ Checked ${htmlFiles.length} HTML files cleanly (0 broken links, 0 script errors, 0 forbidden stubs).`);

  console.log('2. Checking syntax & cleanliness across all backend/frontend JS files...');
  for (const absPath of jsFiles) {
    const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const code = fs.readFileSync(absPath, 'utf8');
    new vm.Script(code, { filename: rel });
    if (rel.startsWith('js/') || rel.startsWith('admin/js/')) {
      assert(!/\badmin123\b|\bconcierge123\b|\bguide123\b|demo_token_admin|local preview only/i.test(code), `${rel} leaks forbidden literal`);
    }
  }
  console.log(`   ✓ Syntax verified cleanly across ${jsFiles.length} JS files.`);

  console.log('3. Checking PostgreSQL schema & setup-postgres.js parity...');
  const pgSchema = fs.readFileSync(path.join(ROOT, 'database', 'postgres-schema.sql'), 'utf8');
  const pgTables = [...pgSchema.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map((m) => m[1]);
  assert.strictEqual(pgTables.length, 14, `Expected 14 PG tables, got ${pgTables.length}`);
  assert(!/\bBOOLEAN\b/i.test(pgSchema), 'postgres-schema.sql must use SMALLINT instead of BOOLEAN');
  const pgDry = spawnSync(process.execPath, ['--check', path.join(ROOT, 'database', 'setup-postgres.js')], { encoding: 'utf8' });
  assert.strictEqual(pgDry.status, 0, `setup-postgres.js syntax failed: ${pgDry.stderr}`);

  console.log('4. Starting live server on ephemeral port 0 to verify routes & security blocklist...');
  const app = require('../server');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const okRoutes = [
      '/', '/index.html', '/tours.html', '/tour.html',
      '/tour-essential-bhutan-7d.html', '/tour-nonexistent-admin-created.html',
      '/destinations.html', '/destination-nonexistent-valley.html',
      '/festivals.html', '/festival-nonexistent-tshechu.html',
      '/book.html', '/booking-confirmed.html', '/contact.html',
      '/sdf-calculator.html', '/services.html', '/track-visa.html',
      '/reviews.html', '/faq.html', '/about.html', '/visa-guide.html',
      '/packing-guide.html', '/terms.html', '/privacy.html',
      '/client/login.html', '/client/dashboard.html', '/client/documents.html', '/client/itinerary.html',
      '/guide/login.html', '/guide/dashboard.html', '/guide/trip-detail.html',
      '/admin/login.html', '/admin/dashboard.html', '/admin/bookings.html',
      '/admin/booking-detail.html', '/admin/visa-desk.html', '/admin/tours-manager.html',
      '/admin/inquiries.html', '/admin/guides.html', '/admin/finance.html',
      '/admin/content-cms.html', '/admin/notifications.html', '/admin/settings.html', '/admin/audit-log.html'
    ];
    for (const r of okRoutes) {
      const res = await httpGet(baseUrl, r);
      assert.strictEqual(res.status, 200, `Expected HTTP 200 for ${r}, got ${res.status}`);
    }

    const blockedRoutes = [
      '/database/tours.db', '/uploads/test.txt', '/.env', '/package.json',
      '/middleware/auth.js', '/services/sdf-engine.js', '/routes/admin.js'
    ];
    for (const r of blockedRoutes) {
      const res = await httpGet(baseUrl, r);
      assert.strictEqual(res.status, 403, `Expected HTTP 403 for sensitive path ${r}, got ${res.status}`);
    }

    const apiPub = await httpGet(baseUrl, '/api/settings/public');
    assert.strictEqual(apiPub.status, 200);
    const pubJson = JSON.parse(apiPub.body);
    assert(pubJson.success && pubJson.data && !pubJson.data.smtp_pass && !pubJson.data.whatsapp_api_token, 'Public settings must remain secret-free');

    const toursApi = await httpGet(baseUrl, '/api/tours');
    assert.strictEqual(toursApi.status, 200);
    assert((JSON.parse(toursApi.body).data || []).length >= 10, 'Expected >= 10 active tours from live server');

    console.log(`   ✓ Verified ${okRoutes.length} live 200 routes, ${blockedRoutes.length} blocked 403 paths & live APIs.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const db = require('../database/db');
    await db.closeDb();
  }

  console.log('✅ ALL SMOKE, LINK, SECURITY & FULL-PLATFORM UI CHECKS PASSED');
}

run().catch((err) => {
  console.error('❌ SMOKE TEST FAILED:', err);
  process.exit(1);
});
