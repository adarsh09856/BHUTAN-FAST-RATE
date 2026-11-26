const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const { UPLOAD_ROOT } = require('../middleware/upload');

async function startTestServer() {
  const serverExport = require('../server');
  const app = serverExport.app || serverExport;
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
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

function listUploadFiles(rootDir = UPLOAD_ROOT) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(rootDir);
  return files.sort();
}

function createFormWithFiles(fields = {}, files = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  for (const [field, spec] of Object.entries(files)) {
    if (!spec) continue;
    const blob = new Blob([spec.content], { type: spec.mime || 'application/octet-stream' });
    form.append(field, blob, spec.filename);
  }
  return form;
}

async function runTests() {
  let server = null;
  const createdBookingIds = [];
  const createdNotificationIds = [];
  const createdCheckinIds = [];
  const createdAuditIds = [];
  const createdReviewIds = [];
  const uploadedFilesToClean = [];
  let initialUploadFiles = [];
  let savedNotificationReadStates = [];

  try {
    initialUploadFiles = listUploadFiles();
    savedNotificationReadStates = await db.query('SELECT id, is_read FROM notifications');

    const started = await startTestServer();
    server = started.server;
    const baseUrl = started.baseUrl;

    // ------------------------------------------------------------------
    // 1. Client Portal Authentication & Strict Bearer RBAC
    // ------------------------------------------------------------------
    console.log('1. Testing POST /api/client/auth & RBAC...');
    const missingAuthRes = await fetch(`${baseUrl}/api/client/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_ref: 'BFR-2026-8841' })
    });
    assert.strictEqual(missingAuthRes.status, 400);

    const wrongEmailRes = await fetch(`${baseUrl}/api/client/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_ref: 'BFR-2026-8841', email: 'intruder@evil.com' })
    });
    assert.strictEqual(wrongEmailRes.status, 401);

    const auth8841Res = await fetch(`${baseUrl}/api/client/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_ref: 'bfr-2026-8841', email: 'EVELYN.M@example.com' })
    });
    assert.strictEqual(auth8841Res.status, 200, `Expected 200 for client auth, got ${auth8841Res.status}`);
    const auth8841Json = await auth8841Res.json();
    assert.strictEqual(auth8841Json.success, true);
    assert.ok(auth8841Json.token);
    const decoded8841 = verifyToken(auth8841Json.token);
    assert.ok(decoded8841 && decoded8841.role === 'client' && decoded8841.bookingId === 'BFR-2026-8841');
    const token8841 = auth8841Json.token;

    const auth8850Res = await fetch(`${baseUrl}/api/client/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_ref: 'BFR-2026-8850', email: 'marcus.l@example.com' })
    });
    assert.strictEqual(auth8850Res.status, 200);
    const token8850 = (await auth8850Res.json()).token;
    assert.ok(token8850);

    // Query token MUST be rejected on strict Bearer-only client routes
    assert.strictEqual((await fetch(`${baseUrl}/api/client/booking`)).status, 401);
    assert.strictEqual((await fetch(`${baseUrl}/api/client/booking?token=${encodeURIComponent(token8841)}`)).status, 401);

    // ------------------------------------------------------------------
    // 2. Client Booking, Itinerary, Payments & Notifications
    // ------------------------------------------------------------------
    console.log('2. Testing GET /api/client/booking, itinerary, payments & notifications...');
    const bookingRes = await fetch(`${baseUrl}/api/client/booking`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(bookingRes.status, 200);
    const bookingJson = await bookingRes.json();
    assert.strictEqual(bookingJson.success, true);
    assert.strictEqual(bookingJson.booking.id, 'BFR-2026-8841');
    assert.strictEqual('internal_notes' in bookingJson.booking, false, 'Client must never receive internal_notes');
    assert.ok(Array.isArray(bookingJson.travelers) && bookingJson.travelers.length === 2);
    assert.ok(bookingJson.travelers[0].doc_readiness, 'Each traveler must include checkDocumentReadiness result');
    assert.ok(bookingJson.bank_wire && bookingJson.bank_wire.bank_account === '200884910023', 'Authenticated client booking should include bank_wire instructions');
    assert.ok(bookingJson.guide && bookingJson.guide.name === 'Kinley Tshering');
    assert.strictEqual('password_hash' in bookingJson.guide, false);

    const itinRes = await fetch(`${baseUrl}/api/client/itinerary`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(itinRes.status, 200);
    const itinJson = await itinRes.json();
    assert.strictEqual(itinJson.success, true);
    assert.ok(Array.isArray(itinJson.itinerary) && itinJson.itinerary.length >= 7);
    assert.ok(itinJson.guide && itinJson.emergency_contacts);

    const payListRes = await fetch(`${baseUrl}/api/client/payments`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(payListRes.status, 200);
    const payListJson = await payListRes.json();
    assert.strictEqual(payListJson.success, true);
    assert.ok(Array.isArray(payListJson.data) && payListJson.data.length >= 1);

    const clientNotifRes = await fetch(`${baseUrl}/api/client/notifications`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(clientNotifRes.status, 200);
    const clientNotifJson = await clientNotifRes.json();
    assert.strictEqual(clientNotifJson.success, true);
    const ownedNotif = clientNotifJson.data.find((n) => String(n.metadata_json || '').includes('BFR-2026-8841'));
    assert.ok(ownedNotif, 'Expected seeded client notification for BFR-2026-8841');
    assert.ok(!clientNotifJson.data.some((n) => n.recipient_type === 'admin' || n.recipient_type === 'guide'));

    const markOwnedNotifRes = await fetch(`${baseUrl}/api/client/notifications/${ownedNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(markOwnedNotifRes.status, 200);
    assert.strictEqual((await markOwnedNotifRes.json()).data.is_read, 1);

    const adminNotif = await db.get("SELECT id FROM notifications WHERE recipient_type = 'admin' LIMIT 1");
    if (adminNotif) {
      const idorNotifRes = await fetch(`${baseUrl}/api/client/notifications/${adminNotif.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token8841}` }
      });
      assert.strictEqual(idorNotifRes.status, 403, 'Client must get 403 when marking non-owned notification read');
    }

    // ------------------------------------------------------------------
    // 3. Cross-booking IDOR Protection & Orphan File Cleanup
    // ------------------------------------------------------------------
    console.log('3. Testing cross-booking IDOR protection (BFR-2026-8841 vs BFR-2026-8850)...');
    const traveler8850 = await db.get('SELECT id FROM travelers WHERE booking_id = ? LIMIT 1', ['BFR-2026-8850']);
    assert.ok(traveler8850 && traveler8850.id);

    const idorUploadForm = createFormWithFiles(
      { passport_number: 'EVIL999', passport_expiry: '2030-01-01' },
      {
        passport_scan: {
          filename: 'idor-passport.pdf',
          mime: 'application/pdf',
          content: Buffer.from('%PDF-1.4 fake idor pdf')
        }
      }
    );
    const idorUploadRes = await fetch(`${baseUrl}/api/client/travelers/${traveler8850.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token8841}` },
      body: idorUploadForm
    });
    assert.strictEqual(idorUploadRes.status, 403, 'Client 8841 MUST get 403 when uploading docs to BFR-2026-8850 traveler');
    assert.deepStrictEqual(listUploadFiles(), initialUploadFiles, 'IDOR 403 upload MUST NOT leave orphan files in uploads/');

    const idorDownloadRes = await fetch(`${baseUrl}/api/client/documents/${traveler8850.id}/passport_scan`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(idorDownloadRes.status, 403, 'Client 8841 MUST get 403 when downloading BFR-2026-8850 traveler doc');

    // ------------------------------------------------------------------
    // 4. Temp Booking: Companions, Multipart Docs, Validation, Readiness & Stream
    // ------------------------------------------------------------------
    console.log('4. Testing multipart traveler uploads, validation, readiness auto-advance & streaming...');
    const createTempRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tour_id: 'essential-bhutan-7d',
        hotel_tier: '4-Star Premium',
        nationality_type: 'international',
        travel_date_start: '2027-08-01',
        adults_count: 2,
        children_6_12: 0,
        children_under_6: 0,
        lead_name: 'Elena Rostova Test',
        lead_email: 'elena.portal.test@example.com',
        lead_phone: '+41 44 555 0102',
        lead_country: 'Switzerland'
      })
    });
    assert.strictEqual(createTempRes.status, 201);
    const tempBookingJson = await createTempRes.json();
    const tempBookingId = tempBookingJson.booking.id;
    createdBookingIds.push(tempBookingId);
    const tempToken = tempBookingJson.client_token;
    const tempTravelers = tempBookingJson.booking.travelers;
    assert.strictEqual(tempTravelers.length, 2);

    // Fill unfilled Guest 2 placeholder slot via POST /api/client/travelers
    const fillSlotRes = await fetch(`${baseUrl}/api/client/travelers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`
      },
      body: JSON.stringify({
        full_name: 'Viktor Rostov Test',
        nationality: 'Switzerland',
        date_of_birth: '1989-04-20',
        dietary_notes: 'No dairy'
      })
    });
    assert.strictEqual(fillSlotRes.status, 200);
    const fillSlotJson = await fillSlotRes.json();
    assert.strictEqual(fillSlotJson.success, true);
    assert.strictEqual(fillSlotJson.mode, 'slot_filled');
    assert.strictEqual(fillSlotJson.traveler.full_name, 'Viktor Rostov Test');

    // Now all 2 slots are filled; another POST /api/client/travelers triggers add-on notification
    const addonRes = await fetch(`${baseUrl}/api/client/travelers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`
      },
      body: JSON.stringify({
        full_name: 'Sofia Rostova Addon',
        nationality: 'Switzerland'
      })
    });
    assert.ok(addonRes.status === 200 || addonRes.status === 202);
    const addonJson = await addonRes.json();
    assert.strictEqual(addonJson.success, true);
    assert.strictEqual(addonJson.mode, 'addon_requested');

    const leadTravelerId = tempTravelers[0].id;
    const guest2TravelerId = tempTravelers[1].id;

    // Reject .exe upload cleanly & leave zero orphan files
    const exeForm = createFormWithFiles(
      { passport_number: 'CH112233', passport_expiry: '2030-01-01' },
      {
        passport_scan: {
          filename: 'malware.exe',
          mime: 'application/x-msdownload',
          content: Buffer.from('MZ-fake-exe')
        }
      }
    );
    const exeRes = await fetch(`${baseUrl}/api/client/travelers/${leadTravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: exeForm
    });
    assert.strictEqual(exeRes.status, 400, '.exe upload must return 400');
    const exeJson = await exeRes.json();
    assert.strictEqual(exeJson.code, 'INVALID_FILE_TYPE');
    assert.deepStrictEqual(listUploadFiles(), initialUploadFiles);

    // Reject oversized (>5MB) upload cleanly
    const bigBuf = Buffer.alloc(6 * 1024 * 1024, 0x41);
    const bigForm = createFormWithFiles(
      { passport_number: 'CH112233', passport_expiry: '2030-01-01' },
      {
        passport_scan: {
          filename: 'huge.pdf',
          mime: 'application/pdf',
          content: bigBuf
        }
      }
    );
    const bigRes = await fetch(`${baseUrl}/api/client/travelers/${leadTravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: bigForm
    });
    assert.strictEqual(bigRes.status, 400, 'Oversized (>5MB) upload must return 400');
    const bigJson = await bigRes.json();
    assert.strictEqual(bigJson.code, 'LIMIT_FILE_SIZE');
    assert.deepStrictEqual(listUploadFiles(), initialUploadFiles);

    // Reject invalid PG DATE string and clean up uploaded files in same request
    const badDateForm = createFormWithFiles(
      { passport_number: 'CH112233', passport_expiry: '2029-02-30' },
      {
        passport_scan: {
          filename: 'valid.pdf',
          mime: 'application/pdf',
          content: Buffer.from('%PDF-1.4 valid')
        }
      }
    );
    const badDateRes = await fetch(`${baseUrl}/api/client/travelers/${leadTravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: badDateForm
    });
    assert.strictEqual(badDateRes.status, 400, 'Invalid calendar date must return 400');
    assert.deepStrictEqual(listUploadFiles(), initialUploadFiles, 'Invalid date rejection must unlink uploaded files');

    // Valid upload for traveler 1 -> partial readiness (traveler 2 still incomplete -> visa_status remains not_started)
    const pdfPayload1 = Buffer.from('%PDF-1.4 lead passport bytes');
    const pngPayload1 = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const jpgPayload1 = Buffer.from('ffd8ffe000104a4649460001', 'hex');

    const upload1Form = createFormWithFiles(
      {
        full_name: 'Elena Rostova Test',
        nationality: 'Switzerland',
        passport_number: 'CH11223344',
        passport_expiry: '2029-12-15',
        date_of_birth: '1988-05-12',
        dietary_notes: 'Vegan',
        emergency_contact: 'Hans Rostov +41445559999'
      },
      {
        passport_scan: { filename: 'elena-passport.pdf', mime: 'application/pdf', content: pdfPayload1 },
        photo_url: { filename: 'elena-photo.png', mime: 'image/png', content: pngPayload1 },
        insurance_doc: { filename: 'elena-ins.jpg', mime: 'image/jpeg', content: jpgPayload1 }
      }
    );
    const upload1Res = await fetch(`${baseUrl}/api/client/travelers/${leadTravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: upload1Form
    });
    assert.strictEqual(upload1Res.status, 200, `Expected 200 for valid doc upload, got ${upload1Res.status}`);
    const upload1Json = await upload1Res.json();
    assert.strictEqual(upload1Json.success, true);
    assert.strictEqual(upload1Json.doc_readiness.ready, true);
    assert.strictEqual(upload1Json.all_travelers_ready, false);
    assert.strictEqual(upload1Json.booking_visa_status, 'not_started');

    for (const field of ['passport_scan', 'photo_url', 'insurance_doc']) {
      const rel = upload1Json.traveler[field];
      assert.ok(rel && !path.isAbsolute(rel), `${field} must be stored as relative path`);
      const abs = path.resolve(UPLOAD_ROOT, rel);
      assert.ok(fs.existsSync(abs), `${abs} must exist on disk`);
      uploadedFilesToClean.push(abs);
    }

    // Stream uploaded passport_scan using ?token= query param
    const streamRes = await fetch(`${baseUrl}/api/client/documents/${leadTravelerId}/passport_scan?token=${encodeURIComponent(tempToken)}`);
    assert.strictEqual(streamRes.status, 200);
    const streamedBuf = Buffer.from(await streamRes.arrayBuffer());
    assert.deepStrictEqual(streamedBuf, pdfPayload1);

    // Invalid field name -> 400
    assert.strictEqual(
      (await fetch(`${baseUrl}/api/client/documents/${leadTravelerId}/secret_field?token=${encodeURIComponent(tempToken)}`)).status,
      400
    );

    // Valid upload for traveler 2 -> ALL travelers ready -> booking visa_status auto-advances to documents_complete!
    const upload2Form = createFormWithFiles(
      {
        passport_number: 'CH55667788',
        passport_expiry: '2030-03-10',
        date_of_birth: '1989-04-20'
      },
      {
        passport_scan: { filename: 'viktor-passport.pdf', mime: 'application/pdf', content: Buffer.from('%PDF-1.4 viktor') },
        photo_url: { filename: 'viktor-photo.png', mime: 'image/png', content: pngPayload1 },
        insurance_doc: { filename: 'viktor-ins.jpg', mime: 'image/jpeg', content: jpgPayload1 }
      }
    );
    const upload2Res = await fetch(`${baseUrl}/api/client/travelers/${guest2TravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: upload2Form
    });
    assert.strictEqual(upload2Res.status, 200);
    const upload2Json = await upload2Res.json();
    assert.strictEqual(upload2Json.doc_readiness.ready, true);
    assert.strictEqual(upload2Json.all_travelers_ready, true);
    assert.strictEqual(upload2Json.booking_visa_status, 'documents_complete');

    for (const field of ['passport_scan', 'photo_url', 'insurance_doc']) {
      uploadedFilesToClean.push(path.resolve(UPLOAD_ROOT, upload2Json.traveler[field]));
    }

    // ------------------------------------------------------------------
    // 5. Payment Receipt Upload, Reviews Gating & Invoice/Clearance Views
    // ------------------------------------------------------------------
    console.log('5. Testing payment receipt upload, reviews gating & printable views...');
    // Reject invalid receipt amount and clean up uploaded file
    const badReceiptAmtForm = createFormWithFiles(
      { amount: '-50', currency: 'USD' },
      { receipt_file: { filename: 'bad-amt.jpg', mime: 'image/jpeg', content: jpgPayload1 } }
    );
    const badReceiptAmtRes = await fetch(`${baseUrl}/api/client/payments/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: badReceiptAmtForm
    });
    assert.strictEqual(badReceiptAmtRes.status, 400);

    // Blank optional date strings normalize cleanly to null without 400/PG error
    const blankDateRes = await fetch(`${baseUrl}/api/client/travelers/${guest2TravelerId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: createFormWithFiles({ date_of_birth: '' })
    });
    assert.strictEqual(blankDateRes.status, 200);
    assert.strictEqual((await blankDateRes.json()).traveler.date_of_birth, null);

    const receiptForm = createFormWithFiles(
      {
        amount: '2475',
        currency: 'USD',
        payment_type: 'deposit',
        payment_method: 'bank_transfer',
        transaction_ref: 'SWIFT-TEST-9001',
        notes: '30% deposit wire slip'
      },
      {
        receipt_file: {
          filename: 'wire-receipt.jpg',
          mime: 'image/jpeg',
          content: jpgPayload1
        }
      }
    );
    const receiptRes = await fetch(`${baseUrl}/api/client/payments/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
      body: receiptForm
    });
    assert.strictEqual(receiptRes.status, 201, `Expected 201 for receipt upload, got ${receiptRes.status}`);
    const receiptJson = await receiptRes.json();
    assert.strictEqual(receiptJson.success, true);
    assert.strictEqual(receiptJson.payment.status, 'pending');
    assert.strictEqual(receiptJson.payment.verified_by, null);
    assert.strictEqual(receiptJson.payment.amount_usd, 2475);
    assert.ok(receiptJson.payment.receipt_file && receiptJson.payment.receipt_file.startsWith('receipts/'));
    uploadedFilesToClean.push(path.resolve(UPLOAD_ROOT, receiptJson.payment.receipt_file));

    // Review MUST be blocked (400) before booking_status === 'completed'
    const prematureReviewRes = await fetch(`${baseUrl}/api/client/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`
      },
      body: JSON.stringify({ rating: 5, title: 'Too early', comment: 'Great trip!' })
    });
    assert.strictEqual(prematureReviewRes.status, 400);

    // Mark booking completed -> review succeeds with is_published = 0
    await db.run("UPDATE bookings SET booking_status = 'completed' WHERE id = ?", [tempBookingId]);
    const validReviewRes = await fetch(`${baseUrl}/api/client/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`
      },
      body: JSON.stringify({
        rating: 5,
        title: 'Unforgettable Himalayan Journey',
        comment: 'Everything from visa clearance to our guide was extraordinary.'
      })
    });
    assert.strictEqual(validReviewRes.status, 201);
    const validReviewJson = await validReviewRes.json();
    assert.strictEqual(validReviewJson.success, true);
    assert.strictEqual(validReviewJson.review.is_published, 0);
    assert.strictEqual(validReviewJson.review.is_verified, 1);
    createdReviewIds.push(validReviewJson.review.id);

    // Client invoice-view & clearance-view
    const clientInvRes = await fetch(`${baseUrl}/api/client/invoice-view?token=${encodeURIComponent(tempToken)}`);
    assert.strictEqual(clientInvRes.status, 200);
    const clientInvHtml = await clientInvRes.text();
    assert.ok(clientInvHtml.includes(tempBookingId) && clientInvHtml.includes('#TR/2018/9882'));

    const unapprovedClrRes = await fetch(`${baseUrl}/api/client/clearance-view?token=${encodeURIComponent(tempToken)}`);
    assert.strictEqual(unapprovedClrRes.status, 403);

    const approvedClrRes = await fetch(`${baseUrl}/api/client/clearance-view?token=${encodeURIComponent(token8841)}`);
    assert.strictEqual(approvedClrRes.status, 200);
    const approvedClrHtml = await approvedClrRes.text();
    assert.ok(approvedClrHtml.includes('VCL-2026-8841-BFR') && approvedClrHtml.includes('#TR/2018/9882'));

    // ------------------------------------------------------------------
    // 6. Guide Field Portal API
    // ------------------------------------------------------------------
    console.log('6. Testing Guide Field Portal login, RBAC, assignments & checkins...');
    const badGuideRes = await fetch(`${baseUrl}/api/guide/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kinley@bhutanfastratetours.bt', password: 'wrongpassword' })
    });
    assert.strictEqual(badGuideRes.status, 401);

    const guideLoginRes = await fetch(`${baseUrl}/api/guide/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kinley@bhutanfastratetours.bt', password: 'guide123' })
    });
    assert.strictEqual(guideLoginRes.status, 200, `Expected 200 for seeded guide login, got ${guideLoginRes.status}`);
    const guideLoginJson = await guideLoginRes.json();
    assert.strictEqual(guideLoginJson.success, true);
    assert.ok(guideLoginJson.token);
    assert.strictEqual(guideLoginJson.guide.email, 'kinley@bhutanfastratetours.bt');
    assert.strictEqual('password_hash' in guideLoginJson.guide, false);
    const guideToken = guideLoginJson.token;
    const decodedGuide = verifyToken(guideToken);
    assert.ok(decodedGuide && decodedGuide.role === 'guide');

    // Guide token MUST receive 403 on staff-only endpoints (/api/notifications)
    const guideForbiddenRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(guideForbiddenRes.status, 403);

    // Also client token cannot access guide portal
    const clientToGuideRes = await fetch(`${baseUrl}/api/guide/assignments`, {
      headers: { Authorization: `Bearer ${token8841}` }
    });
    assert.strictEqual(clientToGuideRes.status, 403);

    // List assignments for Kinley
    const gaListRes = await fetch(`${baseUrl}/api/guide/assignments`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(gaListRes.status, 200);
    const gaListJson = await gaListRes.json();
    assert.strictEqual(gaListJson.success, true);
    assert.ok(gaListJson.data.some((a) => a.booking_id === 'BFR-2026-8841'));
    assert.ok(gaListJson.data.some((a) => a.booking_id === 'BFR-2026-8850'));
    assert.ok(!gaListJson.data.some((a) => a.booking_id === 'BFR-2026-8862'), 'Must not include Dorji assignment');
    const ga8841 = gaListJson.data.find((a) => a.booking_id === 'BFR-2026-8841');
    assert.strictEqual('total_price_usd' in ga8841, false, 'Guide assignments must not expose booking financial totals');

    // Detail by booking_id AND by numeric ga.id
    const gaDetailByBookingRes = await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8841`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(gaDetailByBookingRes.status, 200);
    const gaDetailJson = await gaDetailByBookingRes.json();
    assert.strictEqual(gaDetailJson.success, true);
    assert.strictEqual(gaDetailJson.trip.id, 'BFR-2026-8841');
    assert.ok(Array.isArray(gaDetailJson.trip.travelers) && gaDetailJson.trip.travelers.length === 2);
    assert.ok(Array.isArray(gaDetailJson.trip.itinerary) && gaDetailJson.trip.itinerary.length >= 7);
    assert.strictEqual('total_price_usd' in gaDetailJson.trip, false);
    assert.strictEqual('internal_notes' in gaDetailJson.trip, false);

    const gaDetailByIdRes = await fetch(`${baseUrl}/api/guide/assignments/${ga8841.id}`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(gaDetailByIdRes.status, 200);
    const gaDetailByIdJson = await gaDetailByIdRes.json();
    assert.strictEqual(gaDetailByIdJson.trip.id, 'BFR-2026-8841');

    // Accessing another guide's booking -> 403; non-existent -> 404
    assert.strictEqual(
      (await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8862`, {
        headers: { Authorization: `Bearer ${guideToken}` }
      })).status,
      403
    );
    assert.strictEqual(
      (await fetch(`${baseUrl}/api/guide/assignments/BFR-9999-MISSING`, {
        headers: { Authorization: `Bearer ${guideToken}` }
      })).status,
      404
    );

    // Field check-in by booking_id and numeric ga.id -> inserts guide_checkins + audit_log + admin notification
    const checkinRes1 = await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8841/checkin`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guideToken}`
      },
      body: JSON.stringify({
        location: 'Dochula Pass (3,100m)',
        weather: 'Clear Mountain Views',
        guest_status: 'All Well',
        notes: 'Tea break at Druk Wangyal Cafe'
      })
    });
    assert.strictEqual(checkinRes1.status, 200);
    const checkinJson1 = await checkinRes1.json();
    assert.strictEqual(checkinJson1.success, true);
    assert.ok(checkinJson1.checkin && checkinJson1.checkin.id);
    assert.strictEqual(checkinJson1.checkin.booking_id, 'BFR-2026-8841');
    createdCheckinIds.push(checkinJson1.checkin.id);

    const checkinRes2 = await fetch(`${baseUrl}/api/guide/assignments/${ga8841.id}/checkin`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guideToken}`
      },
      body: JSON.stringify({
        location: 'Punakha Dzong Courtyard',
        weather: 'Sunny 22C',
        guest_status: 'All Well',
        notes: 'Afternoon tour completed'
      })
    });
    assert.strictEqual(checkinRes2.status, 200);
    const checkinJson2 = await checkinRes2.json();
    createdCheckinIds.push(checkinJson2.checkin.id);

    const auditRows = await db.query(
      "SELECT id FROM audit_log WHERE action = 'guide.checkin' AND entity_id = 'BFR-2026-8841' ORDER BY id DESC LIMIT 2"
    );
    assert.strictEqual(auditRows.length, 2, 'guide.checkin must record audit_log rows');
    for (const a of auditRows) createdAuditIds.push(a.id);

    const adminCheckinNotifs = await db.query(
      "SELECT id FROM notifications WHERE recipient_type = 'admin' AND category = 'guide_checkin' ORDER BY id DESC LIMIT 2"
    );
    assert.strictEqual(adminCheckinNotifs.length, 2, 'guide.checkin must notify admin');
    for (const n of adminCheckinNotifs) createdNotificationIds.push(n.id);

    // Missing check-in location -> 400
    assert.strictEqual(
      (await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8841/checkin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guideToken}`
        },
        body: JSON.stringify({ location: '   ' })
      })).status,
      400
    );

    // Verify check-ins appear on trip detail
    const gaAfterCheckinRes = await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8841`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(gaAfterCheckinRes.status, 200);
    const gaAfterCheckinJson = await gaAfterCheckinRes.json();
    assert.ok(gaAfterCheckinJson.trip.checkins.length >= 2);

    // Other guide's assignment checkin -> 403
    assert.strictEqual(
      (await fetch(`${baseUrl}/api/guide/assignments/BFR-2026-8862/checkin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guideToken}`
        },
        body: JSON.stringify({ location: 'Unauthorized' })
      })).status,
      403
    );

    // Guide notifications
    const guideNotifRes = await fetch(`${baseUrl}/api/guide/notifications`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    });
    assert.strictEqual(guideNotifRes.status, 200);
    const guideNotifJson = await guideNotifRes.json();
    assert.strictEqual(guideNotifJson.success, true);
    assert.ok(guideNotifJson.data.some((n) => n.recipient_type === 'guide'));

    console.log('✅ ALL CLIENT & GUIDE PORTAL API TESTS PASSED');
  } finally {
    await closeServer(server);

    for (const filePath of uploadedFilesToClean) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }

    for (const cId of createdCheckinIds) {
      try { await db.run('DELETE FROM guide_checkins WHERE id = ?', [cId]); } catch (_) {}
    }
    for (const aId of createdAuditIds) {
      try { await db.run('DELETE FROM audit_log WHERE id = ?', [aId]); } catch (_) {}
    }
    for (const rId of createdReviewIds) {
      try { await db.run('DELETE FROM reviews WHERE id = ?', [rId]); } catch (_) {}
    }
    for (const nId of createdNotificationIds) {
      try { await db.run('DELETE FROM notifications WHERE id = ?', [nId]); } catch (_) {}
    }

    for (const bookingId of createdBookingIds) {
      try {
        await db.run('DELETE FROM guide_checkins WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM reviews WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM travelers WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM payments WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM guide_assignments WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM notifications WHERE action_url LIKE ? OR metadata_json LIKE ?', [`%${bookingId}%`, `%${bookingId}%`]);
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [bookingId]);
        await db.run('DELETE FROM bookings WHERE id = ?', [bookingId]);
      } catch (_) {}
    }

    for (const row of savedNotificationReadStates) {
      try {
        await db.run('UPDATE notifications SET is_read = ? WHERE id = ?', [row.is_read, row.id]);
      } catch (_) {}
    }

    // Verify uploads directory has no leftover files
    const remainingFiles = listUploadFiles();
    assert.deepStrictEqual(remainingFiles, initialUploadFiles, 'uploads/ must be clean after test cleanup');

    await db.closeDb();
  }
}

runTests().catch((err) => {
  console.error('❌ PORTALS API TEST FAILED:', err);
  process.exit(1);
});
