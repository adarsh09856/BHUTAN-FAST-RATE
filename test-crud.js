const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database/db');
const { signToken } = require('./middleware/auth');
const { UPLOAD_ROOT } = require('./middleware/upload');

async function startTestServer() {
  const serverExport = require('./server');
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

async function apiReq(baseUrl, method, reqPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${reqPath}`, { method, headers, body: payload });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let json = null;
  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  } else {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, headers: res.headers, body: json, text };
}

async function runTests() {
  let server = null;
  const createdBookingIds = [];
  const createdTourIds = [];
  const createdDestIds = [];
  const createdFestivalIds = [];
  const createdReviewIds = [];
  const createdInquiryIds = [];
  const createdUserIds = [];
  const createdNotificationIds = [];
  const createdAuditIds = [];
  const uploadedFilesToClean = [];
  const addedSettingKeys = [];
  let savedCompanyTagline = null;
  let initialUploadFiles = [];

  try {
    initialUploadFiles = listUploadFiles();
    const existingTagline = await db.get("SELECT key, value, category, description FROM settings WHERE key = 'company_tagline'");
    savedCompanyTagline = existingTagline || null;

    const started = await startTestServer();
    server = started.server;
    const baseUrl = started.baseUrl;

    // ------------------------------------------------------------------
    // 1. Staff Authentication & Strict RBAC Matrix
    // ------------------------------------------------------------------
    console.log('1. Testing Staff Auth & Strict RBAC Matrix...');
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/stats')).status, 401);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/bookings')).status, 401);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/users')).status, 401);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/payments')).status, 401);

    // Guide & invalid credentials rejected at /auth/login
    const badPassRes = await apiReq(baseUrl, 'POST', '/api/admin/auth/login', {
      body: { email: 'admin@bhutanfastratetours.bt', password: 'wrongpassword' }
    });
    assert.strictEqual(badPassRes.status, 401);

    const guideAdminLoginRes = await apiReq(baseUrl, 'POST', '/api/admin/auth/login', {
      body: { email: 'kinley@bhutanfastratetours.bt', password: 'guide123' }
    });
    assert.ok(guideAdminLoginRes.status === 401 || guideAdminLoginRes.status === 403, 'Guide must be rejected from admin login');

    // Valid staff logins
    const superLogin = await apiReq(baseUrl, 'POST', '/api/admin/auth/login', {
      body: { email: 'admin@bhutanfastratetours.bt', password: 'admin123' }
    });
    assert.strictEqual(superLogin.status, 200, `Super admin login failed: ${superLogin.text}`);
    assert.ok(superLogin.body.token && superLogin.body.user);
    assert.strictEqual('password_hash' in superLogin.body.user, false, 'Login must NEVER expose password_hash');
    const superToken = superLogin.body.token;
    const superUserId = superLogin.body.user.id;

    const conciergeLogin = await apiReq(baseUrl, 'POST', '/api/admin/auth/login', {
      body: { username: 'dechen@bhutanfastratetours.bt', password: 'concierge123' }
    });
    assert.strictEqual(conciergeLogin.status, 200, `Concierge login failed: ${conciergeLogin.text}`);
    const conciergeToken = conciergeLogin.body.token;

    const financeLogin = await apiReq(baseUrl, 'POST', '/api/admin/auth/login', {
      body: { email: 'finance@bhutanfastratetours.bt', password: 'finance123' }
    });
    assert.strictEqual(financeLogin.status, 200, `Finance login failed: ${financeLogin.text}`);
    const financeToken = financeLogin.body.token;

    // GET /auth/me
    const meRes = await apiReq(baseUrl, 'GET', '/api/admin/auth/me', { token: conciergeToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.role, 'concierge');
    assert.strictEqual('password_hash' in meRes.body.user, false);

    // Guide & Client tokens rejected 403 on admin endpoints
    const guideToken = signToken({ id: 3, role: 'guide', email: 'kinley@bhutanfastratetours.bt' });
    const clientToken = signToken({ role: 'client', bookingId: 'BFR-2026-8841' });
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/stats', { token: guideToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/bookings', { token: clientToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/auth/me', { token: guideToken })).status, 403);

    // Concierge RBAC restrictions (403 on /users, /payments, finance CSV, sdf-remit, PUT /settings, DELETE /bookings)
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/users', { token: conciergeToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/payments', { token: conciergeToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'POST', '/api/admin/bookings/BFR-2026-8841/payments', { token: conciergeToken, body: { amount_usd: 10 } })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'PATCH', '/api/admin/bookings/BFR-2026-8841/sdf-remit', { token: conciergeToken, body: {} })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/reports/finance-csv', { token: conciergeToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'PUT', '/api/admin/settings', { token: conciergeToken, body: { company_name: 'Hack' } })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'DELETE', '/api/admin/bookings/BFR-2026-8841', { token: conciergeToken })).status, 403);

    // Finance RBAC restrictions (403 on PUT /settings, test-notification, DELETE /bookings, /users, POST /tours)
    assert.strictEqual((await apiReq(baseUrl, 'PUT', '/api/admin/settings', { token: financeToken, body: { company_name: 'Hack' } })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'POST', '/api/admin/settings/test-notification', { token: financeToken, body: {} })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'DELETE', '/api/admin/bookings/BFR-2026-8841', { token: financeToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/users', { token: financeToken })).status, 403);
    assert.strictEqual((await apiReq(baseUrl, 'POST', '/api/admin/tours', { token: financeToken, body: { title: 'Test', price_usd: 100 } })).status, 403);
    // Finance ALLOWED on finance read endpoints
    assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/admin/payments', { token: financeToken })).status, 200);

    // ------------------------------------------------------------------
    // 2. Dashboard KPIs & Monthly Trends (GET /api/admin/stats)
    // ------------------------------------------------------------------
    console.log('2. Testing Live Dashboard Stats (GET /api/admin/stats)...');
    const statsRes = await apiReq(baseUrl, 'GET', '/api/admin/stats', { token: superToken });
    assert.strictEqual(statsRes.status, 200);
    const stats = statsRes.body.stats;
    assert.ok(typeof stats.total_revenue_usd === 'number' && stats.total_revenue_usd > 0);
    assert.ok(typeof stats.sdf_collected_usd === 'number');
    assert.ok(typeof stats.sdf_remitted_usd === 'number');
    assert.ok(typeof stats.mtd_revenue_usd === 'number');
    assert.ok(typeof stats.ytd_revenue_usd === 'number');
    assert.ok(Array.isArray(stats.monthly_revenue));
    assert.ok(Array.isArray(stats.pipeline) && stats.pipeline.length > 0);
    assert.ok(Array.isArray(stats.visa_pipeline));
    assert.ok(typeof stats.pending_verifications === 'number');
    assert.ok(typeof stats.today_checkins_count === 'number');
    assert.ok(typeof stats.unread_notifications === 'number');

    // ------------------------------------------------------------------
    // 3. Admin-on-Behalf Booking (Catalog + Custom + Deposit + Guide + Overlap)
    // ------------------------------------------------------------------
    console.log('3. Testing Admin-on-Behalf Booking, Guide Overlap & Status Gates...');
    // Invalid date -> 400
    const badBookingDate = await apiReq(baseUrl, 'POST', '/api/admin/bookings', {
      token: conciergeToken,
      body: {
        tour_id: 'essential-bhutan-7d',
        lead_name: 'Bad Date Guest',
        lead_email: 'baddate@example.com',
        lead_phone: '+1 555 0100',
        travel_date_start: '2027-02-30'
      }
    });
    assert.strictEqual(badBookingDate.status, 400);

    // instant_confirm without assigned_guide_id -> 400
    const noGuideConfirm = await apiReq(baseUrl, 'POST', '/api/admin/bookings', {
      token: conciergeToken,
      body: {
        tour_id: 'essential-bhutan-7d',
        lead_name: 'No Guide Guest',
        lead_email: 'noguide@example.com',
        lead_phone: '+1 555 0101',
        travel_date_start: '2027-05-10',
        instant_confirm: true
      }
    });
    assert.strictEqual(noGuideConfirm.status, 400);

    // Valid catalog on-behalf booking with discount, extras, initial deposit & blank passport expiry
    const onBehalfRes = await apiReq(baseUrl, 'POST', '/api/admin/bookings', {
      token: conciergeToken,
      body: {
        tour_id: 'essential-bhutan-7d',
        hotel_tier: '4-Star Premium',
        nationality_type: 'international',
        travel_date_start: '2027-06-10',
        adults_count: 2,
        children_6_12: 0,
        children_under_6: 0,
        extras_usd: 200,
        discount_usd: 150,
        initial_deposit_usd: 2000,
        payment_method: 'bank_transfer',
        lead_name: 'Lady Eleanor Vance',
        lead_email: 'eleanor.vance.crud@example.com',
        lead_phone: '+44 7911 123456',
        lead_country: 'United Kingdom',
        lead_passport_no: 'UK9948271',
        lead_passport_expiry: '',
        source: 'whatsapp'
      }
    });
    assert.strictEqual(onBehalfRes.status, 201, `On-behalf booking failed: ${onBehalfRes.text}`);
    assert.ok(onBehalfRes.body.whatsapp_share_url && onBehalfRes.body.whatsapp_share_url.startsWith('https://wa.me/'));
    assert.ok(onBehalfRes.body.client_portal_url && onBehalfRes.body.client_portal_url.includes(onBehalfRes.body.booking.id));
    assert.ok(onBehalfRes.body.notification_id, 'On-behalf booking must log a notification');
    createdNotificationIds.push(onBehalfRes.body.notification_id);

    const booking1 = onBehalfRes.body.booking;
    createdBookingIds.push(booking1.id);
    assert.strictEqual(booking1.deposit_paid_usd, 2000);
    assert.strictEqual(booking1.booking_status, 'deposit_paid');
    assert.strictEqual(booking1.lead_passport_expiry, null);
    assert.strictEqual(booking1.travelers.length, 2);

    // Custom rate booking with SDF waiver
    const customBookingRes = await apiReq(baseUrl, 'POST', '/api/admin/bookings', {
      token: superToken,
      body: {
        tour_title: 'Bespoke Eastern Heritage =TEST',
        custom_daily_rate: 300,
        nights: 5,
        adults_count: 1,
        hotel_tier: '4-Star Premium',
        nationality_type: 'international',
        is_sdf_waived: true,
        travel_date_start: '2027-06-12',
        lead_name: '=Eleanor Custom',
        lead_email: 'custom.crud@example.com',
        lead_phone: '+1 415 555 9876',
        lead_country: 'United States'
      }
    });
    assert.strictEqual(customBookingRes.status, 201, `Custom booking failed: ${customBookingRes.text}`);
    const booking2 = customBookingRes.body.booking;
    createdBookingIds.push(booking2.id);
    assert.strictEqual(booking2.is_custom_trip, 1);
    assert.strictEqual(booking2.sdf_total_usd, 0);
    assert.strictEqual(booking2.base_price_usd, 1500);

    // Status -> 'confirmed' MUST fail before guide assigned
    const confirmNoGuideRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/status`, {
      token: conciergeToken,
      body: { status: 'confirmed' }
    });
    assert.strictEqual(confirmNoGuideRes.status, 400);

    // Assign guide Kinley to booking1 (2027-06-10 to 2027-06-16)
    const guidesListRes = await apiReq(baseUrl, 'GET', '/api/admin/guides', { token: conciergeToken });
    assert.strictEqual(guidesListRes.status, 200);
    const kinley = guidesListRes.body.data.find((g) => g.email === 'kinley@bhutanfastratetours.bt');
    assert.ok(kinley, 'Seeded guide Kinley must exist');

    const assign1Res = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/assign-guide`, {
      token: conciergeToken,
      body: { guide_id: kinley.id, vehicle_plate: 'BP-1-A9000' }
    });
    assert.strictEqual(assign1Res.status, 200, `Guide assignment failed: ${assign1Res.text}`);

    // Now status -> 'confirmed' succeeds!
    const confirmWithGuideRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/status`, {
      token: conciergeToken,
      body: { status: 'confirmed' }
    });
    assert.strictEqual(confirmWithGuideRes.status, 200);

    // Overlapping guide assignment on booking2 (2027-06-12 to 2027-06-17) MUST return 409 citing booking1.id!
    const overlapRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking2.id}/assign-guide`, {
      token: conciergeToken,
      body: { guide_id: kinley.id, vehicle_plate: 'BP-1-B2000' }
    });
    assert.strictEqual(overlapRes.status, 409, `Expected 409 overlap conflict, got ${overlapRes.status}`);
    assert.ok(
      overlapRes.body.error.includes(booking1.id) || overlapRes.body.conflicting_booking_id === booking1.id,
      '409 response must cite conflicting booking ref'
    );

    // PATCH notes
    const notesRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/notes`, {
      token: conciergeToken,
      body: { internal_notes: 'VIP dietary requirement noted.' }
    });
    assert.strictEqual(notesRes.status, 200);
    assert.strictEqual(notesRes.body.booking.internal_notes, 'VIP dietary requirement noted.');

    // ------------------------------------------------------------------
    // 4. Visa State Machine & Private Document Streaming
    // ------------------------------------------------------------------
    console.log('4. Testing Visa Compliance Gates & Admin Document Preview...');
    // Blocked when unpaid/docs missing
    const blockedVisaRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/visa`, {
      token: conciergeToken,
      body: { visa_status: 'submitted_to_doi' }
    });
    assert.strictEqual(blockedVisaRes.status, 400);

    // Rejected without reason -> 400; with reason -> 200
    const rejectNoReason = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/visa`, {
      token: conciergeToken,
      body: { visa_status: 'rejected' }
    });
    assert.strictEqual(rejectNoReason.status, 400);

    const rejectWithReason = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/visa`, {
      token: conciergeToken,
      body: { visa_status: 'rejected', rejection_reason: 'Passport photo glare detected' }
    });
    assert.strictEqual(rejectWithReason.status, 200);

    // Client logs in, uploads valid docs for both travelers & uploads balance receipt
    const clientAuth = await apiReq(baseUrl, 'POST', '/api/client/auth', {
      body: { booking_ref: booking1.id, email: 'eleanor.vance.crud@example.com' }
    });
    assert.strictEqual(clientAuth.status, 200);
    const b1ClientToken = clientAuth.body.token;

    const pdfBuf = Buffer.from('%PDF-1.4 test passport');
    const pngBuf = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const jpgBuf = Buffer.from('ffd8ffe000104a4649460001', 'hex');

    for (let i = 0; i < booking1.travelers.length; i++) {
      const tr = booking1.travelers[i];
      const docForm = new FormData();
      docForm.append('passport_number', `UK994827${i + 1}`);
      docForm.append('passport_expiry', '2030-05-01');
      docForm.append('passport_scan', new Blob([pdfBuf], { type: 'application/pdf' }), `p${i}.pdf`);
      docForm.append('photo_url', new Blob([pngBuf], { type: 'image/png' }), `ph${i}.png`);
      docForm.append('insurance_doc', new Blob([jpgBuf], { type: 'image/jpeg' }), `ins${i}.jpg`);
      const upDoc = await apiReq(baseUrl, 'POST', `/api/client/travelers/${tr.id}/documents`, {
        token: b1ClientToken,
        formData: docForm
      });
      assert.strictEqual(upDoc.status, 200, `Traveler doc upload failed: ${upDoc.text}`);
      for (const f of ['passport_scan', 'photo_url', 'insurance_doc']) {
        if (upDoc.body.traveler[f]) uploadedFilesToClean.push(path.resolve(UPLOAD_ROOT, upDoc.body.traveler[f]));
      }
    }

    // Admin private document preview via ?token= query param
    const docPreviewRes = await fetch(`${baseUrl}/api/admin/documents/${booking1.travelers[0].id}/passport_scan?token=${encodeURIComponent(conciergeToken)}`);
    assert.strictEqual(docPreviewRes.status, 200);
    const previewBytes = Buffer.from(await docPreviewRes.arrayBuffer());
    assert.deepStrictEqual(previewBytes, pdfBuf);

    // Invalid doc field -> 400
    assert.strictEqual(
      (await apiReq(baseUrl, 'GET', `/api/admin/documents/${booking1.travelers[0].id}/bad_field?token=${encodeURIComponent(conciergeToken)}`)).status,
      400
    );

    // Client uploads remaining balance receipt -> Finance verifies it
    const remainingDue = booking1.total_price_usd - 2000;
    const recForm = new FormData();
    recForm.append('amount', String(remainingDue));
    recForm.append('currency', 'USD');
    recForm.append('payment_type', 'balance');
    recForm.append('transaction_ref', 'SWIFT-CRUD-BALANCE');
    recForm.append('receipt_file', new Blob([jpgBuf], { type: 'image/jpeg' }), 'balance.jpg');
    const recUploadRes = await apiReq(baseUrl, 'POST', '/api/client/payments/receipt', {
      token: b1ClientToken,
      formData: recForm
    });
    assert.strictEqual(recUploadRes.status, 201);
    const pendingPayment = recUploadRes.body.payment;
    uploadedFilesToClean.push(path.resolve(UPLOAD_ROOT, pendingPayment.receipt_file));

    // Stream payment receipt as finance staff via ?token=
    const recStreamRes = await fetch(`${baseUrl}/api/admin/payments/${pendingPayment.id}/receipt?token=${encodeURIComponent(financeToken)}`);
    assert.strictEqual(recStreamRes.status, 200);
    assert.deepStrictEqual(Buffer.from(await recStreamRes.arrayBuffer()), jpgBuf);

    // Verify payment receipt
    const verifyPayRes = await apiReq(baseUrl, 'PATCH', `/api/admin/payments/${pendingPayment.id}/verify`, {
      token: financeToken,
      body: { status: 'verified', notes: 'Cleared in Bank of Bhutan' }
    });
    assert.strictEqual(verifyPayRes.status, 200, `Payment verify failed: ${verifyPayRes.text}`);
    assert.strictEqual(verifyPayRes.body.booking.full_paid, 1);
    assert.strictEqual(verifyPayRes.body.booking.deposit_paid_usd, booking1.total_price_usd);
    assert.ok(verifyPayRes.body.whatsapp_share_url);

    // Now DoI submission & approval succeed!
    const submitDoiRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/visa`, {
      token: conciergeToken,
      body: { visa_status: 'submitted_to_doi' }
    });
    assert.strictEqual(submitDoiRes.status, 200, `DoI submission failed: ${submitDoiRes.text}`);

    const approveVisaRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/visa`, {
      token: conciergeToken,
      body: { visa_status: 'approved' }
    });
    assert.strictEqual(approveVisaRes.status, 200);
    assert.ok(approveVisaRes.body.visa_clearance_number && approveVisaRes.body.visa_clearance_number.startsWith('VCL-'));
    assert.ok(approveVisaRes.body.whatsapp_share_url);

    // Public tracker reflects approved status
    const trackRes = await apiReq(baseUrl, 'GET', `/api/bookings/track/${booking1.id}?email=eleanor.vance.crud@example.com`);
    assert.strictEqual(trackRes.status, 200);
    assert.strictEqual(trackRes.body.booking.visa_status, 'approved');

    // ------------------------------------------------------------------
    // 5. Finance: SDF Remit, Refund Balance Adjustment, Delete Guard & CSVs
    // ------------------------------------------------------------------
    console.log('5. Testing SDF Remittance, Refund Guard, Delete Guard & Formula-Safe CSV...');
    const sdfRemitRes = await apiReq(baseUrl, 'PATCH', `/api/admin/bookings/${booking1.id}/sdf-remit`, {
      token: financeToken,
      body: { sdf_remittance_ref: 'RMA-TEST-2027-01' }
    });
    assert.strictEqual(sdfRemitRes.status, 200);
    assert.strictEqual(sdfRemitRes.body.booking.sdf_remittance_ref, 'RMA-TEST-2027-01');
    assert.ok(sdfRemitRes.body.booking.sdf_remitted_at);

    // Super admin delete while paid -> 409
    const delBlockedRes = await apiReq(baseUrl, 'DELETE', `/api/admin/bookings/${booking1.id}`, {
      token: superToken
    });
    assert.strictEqual(delBlockedRes.status, 409);

    // Partial refund on booking1 updates balance & full_paid = 0
    const refundRes = await apiReq(baseUrl, 'POST', `/api/admin/bookings/${booking1.id}/payments`, {
      token: financeToken,
      body: { amount_usd: 500, payment_type: 'refund', payment_method: 'bank_transfer', notes: 'Partial adjustment' }
    });
    assert.strictEqual(refundRes.status, 200);
    assert.strictEqual(refundRes.body.full_paid, 0);
    assert.strictEqual(refundRes.body.deposit_paid_usd, booking1.total_price_usd - 500);

    // Super admin delete on unpaid booking2 -> 200 (soft-cancels)
    const delUnpaidRes = await apiReq(baseUrl, 'DELETE', `/api/admin/bookings/${booking2.id}`, {
      token: superToken,
      body: { cancellation_reason: 'Client rescheduled' }
    });
    assert.strictEqual(delUnpaidRes.status, 200);

    // CSV exports & formula-injection check (booking2 had lead_name '=Eleanor Custom')
    const finCsvRes = await apiReq(baseUrl, 'GET', '/api/admin/reports/finance-csv', { token: financeToken });
    assert.strictEqual(finCsvRes.status, 200);
    assert.ok((finCsvRes.headers.get('content-type') || '').includes('text/csv'));
    assert.ok(finCsvRes.text.includes(booking1.id));

    const bookCsvRes = await apiReq(baseUrl, 'GET', '/api/admin/reports/bookings-csv', { token: conciergeToken });
    assert.strictEqual(bookCsvRes.status, 200);
    assert.ok((bookCsvRes.headers.get('content-type') || '').includes('text/csv'));
    assert.ok(bookCsvRes.text.includes("'=Eleanor Custom"), 'Formula injection payload must be escaped with leading apostrophe');

    // ------------------------------------------------------------------
    // 6. CRM Inquiries & Convert to Booking
    // ------------------------------------------------------------------
    console.log('6. Testing Inquiries CRM & Conversion to Booking...');
    const createInqRes = await apiReq(baseUrl, 'POST', '/api/inquiries', {
      body: {
        name: 'Arthur Pendelton',
        email: 'arthur.p@example.com',
        phone: '+1 212 555 0199',
        country: 'United States',
        duration_days: 7,
        travelers_count: 2,
        message: 'Interested in autumn cultural journey.'
      }
    });
    assert.strictEqual(createInqRes.status, 201);
    const inqId = createInqRes.body.inquiry_id;
    createdInquiryIds.push(inqId);

    const listInqRes = await apiReq(baseUrl, 'GET', '/api/admin/inquiries', { token: conciergeToken });
    assert.strictEqual(listInqRes.status, 200);
    assert.ok(listInqRes.body.data.some((i) => i.id === inqId));

    const patchInqRes = await apiReq(baseUrl, 'PATCH', `/api/admin/inquiries/${inqId}`, {
      token: conciergeToken,
      body: { status: 'proposal_sent', internal_notes: 'Sent 4-star proposal' }
    });
    assert.strictEqual(patchInqRes.status, 200);

    const convertRes = await apiReq(baseUrl, 'POST', `/api/admin/inquiries/${inqId}/convert`, {
      token: conciergeToken,
      body: {
        tour_id: 'essential-bhutan-7d',
        travel_date_start: '2027-09-10',
        hotel_tier: '4-Star Premium'
      }
    });
    assert.strictEqual(convertRes.status, 201, `Inquiry convert failed: ${convertRes.text}`);
    assert.ok(convertRes.body.booking && convertRes.body.booking.id);
    assert.ok(convertRes.body.whatsapp_share_url);
    assert.strictEqual(convertRes.body.inquiry.status, 'converted');
    assert.strictEqual(convertRes.body.inquiry.converted_booking_id, convertRes.body.booking.id);
    createdBookingIds.push(convertRes.body.booking.id);

    // Re-converting converted inquiry -> 409
    const reconvertRes = await apiReq(baseUrl, 'POST', `/api/admin/inquiries/${inqId}/convert`, {
      token: conciergeToken,
      body: { tour_id: 'essential-bhutan-7d', travel_date_start: '2027-09-10' }
    });
    assert.strictEqual(reconvertRes.status, 409);

    // ------------------------------------------------------------------
    // 7. Guides CRUD (scrypt login verification)
    // ------------------------------------------------------------------
    console.log('7. Testing Guides CRUD...');
    const createGuideRes = await apiReq(baseUrl, 'POST', '/api/admin/guides', {
      token: conciergeToken,
      body: {
        full_name: 'Tenzin Wangchuk Test',
        email: 'tenzin.guide.test@bhutanfastratetours.bt',
        phone: '+975 17 111 222',
        password: 'GuidePass!2026',
        license_no: 'GD/2026/999',
        languages: 'English, Dzongkha',
        specialty: 'Birdwatching & Photography'
      }
    });
    assert.strictEqual(createGuideRes.status, 201, `Guide create failed: ${createGuideRes.text}`);
    const newGuide = createGuideRes.body.guide;
    createdUserIds.push(newGuide.id);
    assert.strictEqual('password_hash' in newGuide, false);

    // Verify new guide can log into Guide Portal with scrypt password
    const newGuideLogin = await apiReq(baseUrl, 'POST', '/api/guide/auth/login', {
      body: { email: 'tenzin.guide.test@bhutanfastratetours.bt', password: 'GuidePass!2026' }
    });
    assert.strictEqual(newGuideLogin.status, 200);

    const updateGuideRes = await apiReq(baseUrl, 'PUT', `/api/admin/guides/${newGuide.id}`, {
      token: conciergeToken,
      body: { specialty: 'Wildlife & Cultural Expeditions' }
    });
    assert.strictEqual(updateGuideRes.status, 200);
    assert.strictEqual(updateGuideRes.body.guide.specialty, 'Wildlife & Cultural Expeditions');

    const toggleGuideRes = await apiReq(baseUrl, 'PATCH', `/api/admin/guides/${newGuide.id}/toggle`, {
      token: conciergeToken
    });
    assert.strictEqual(toggleGuideRes.status, 200);
    assert.strictEqual(toggleGuideRes.body.is_active, 0);

    // ------------------------------------------------------------------
    // 8. Catalog & Content CMS (Tours, Destinations, Festivals, Reviews)
    // ------------------------------------------------------------------
    console.log('8. Testing Tours, Destinations, Festivals & Reviews CMS CRUD...');
    // Tours
    const createTourRes = await apiReq(baseUrl, 'POST', '/api/admin/tours', {
      token: conciergeToken,
      body: {
        slug: 'tour-jomolhari-crud-test.html',
        title: 'Jomolhari CRUD Test Trek',
        category: 'Alpine Trekking',
        duration_days: 9,
        duration_nights: 8,
        price_usd: 2800,
        price_4star_usd: 3350,
        valleys: 'Paro, Jangothang',
        itinerary: [{ day: 1, title: 'Arrival', description: 'Paro arrival' }],
        inclusions: ['Guide', 'SDF']
      }
    });
    assert.strictEqual(createTourRes.status, 201, `Tour create failed: ${createTourRes.text}`);
    const tourId = createTourRes.body.tour.id;
    createdTourIds.push(tourId);

    const pubTours = await apiReq(baseUrl, 'GET', '/api/tours');
    const foundTour = pubTours.body.data.find((t) => t.id === tourId);
    assert.ok(foundTour && foundTour.price_4star_usd === 3350);

    const updTour = await apiReq(baseUrl, 'PUT', `/api/admin/tours/${tourId}`, {
      token: conciergeToken,
      body: { price_usd: 2650, price_4star_usd: 3200 }
    });
    assert.strictEqual(updTour.status, 200);

    const togOff = await apiReq(baseUrl, 'PATCH', `/api/admin/tours/${tourId}/toggle`, { token: conciergeToken });
    assert.strictEqual(togOff.body.is_active, 0);
    const pubWhileOff = await apiReq(baseUrl, 'GET', '/api/tours');
    assert.ok(!pubWhileOff.body.data.some((t) => t.id === tourId), 'Inactive tour must be hidden from public');

    const delTour = await apiReq(baseUrl, 'DELETE', `/api/admin/tours/${tourId}`, { token: conciergeToken });
    assert.strictEqual(delTour.status, 200);

    // Destinations
    const createDest = await apiReq(baseUrl, 'POST', '/api/admin/destinations', {
      token: conciergeToken,
      body: {
        name: 'Trongsa Heritage Valley Test',
        tagline: 'Ancestral Royal Fortress',
        altitude_meters: 2200,
        region: 'Central',
        description: 'Historic seat of the Wangchuck dynasty.',
        highlights: ['Trongsa Dzong', 'Ta Dzong Museum']
      }
    });
    assert.strictEqual(createDest.status, 201, `Destination create failed: ${createDest.text}`);
    const destId = createDest.body.destination.id;
    createdDestIds.push(destId);

    const updDest = await apiReq(baseUrl, 'PUT', `/api/admin/destinations/${destId}`, {
      token: conciergeToken,
      body: { tagline: 'Updated Ancestral Fortress' }
    });
    assert.strictEqual(updDest.status, 200);
    const pubDest = await apiReq(baseUrl, 'GET', `/api/destinations/${destId}`);
    assert.strictEqual(pubDest.status, 200);
    assert.strictEqual(pubDest.body.data.tagline, 'Updated Ancestral Fortress');

    // Festivals
    const createFest = await apiReq(baseUrl, 'POST', '/api/admin/festivals', {
      token: conciergeToken,
      body: {
        name: 'Haa Summer Festival Test',
        season: 'Summer (July)',
        dates_label: 'Jul 14 - 16, 2027',
        venue: 'Haa Valley Grounds',
        valley: 'Haa',
        duration_days: 3,
        price_usd: 1650,
        summary: 'Celebration of nomadic yak herder culture.',
        highlights: ['Yak riding', 'Traditional archery']
      }
    });
    assert.strictEqual(createFest.status, 201, `Festival create failed: ${createFest.text}`);
    const festId = createFest.body.festival.id;
    createdFestivalIds.push(festId);

    const updFest = await apiReq(baseUrl, 'PUT', `/api/admin/festivals/${festId}`, {
      token: conciergeToken,
      body: { price_usd: 1750 }
    });
    assert.strictEqual(updFest.status, 200);

    const togFest = await apiReq(baseUrl, 'PATCH', `/api/admin/festivals/${festId}/toggle`, { token: conciergeToken });
    assert.strictEqual(togFest.status, 200);
    assert.strictEqual(togFest.body.is_active, 0);

    const delFest = await apiReq(baseUrl, 'DELETE', `/api/admin/festivals/${festId}`, { token: conciergeToken });
    assert.strictEqual(delFest.status, 200);

    // Reviews Moderation
    const insertRev = await db.run(
      `INSERT INTO reviews (booking_id, author_name, author_country, tour_taken, rating, title, comment, is_verified, is_featured, is_published)
       VALUES (?, 'Moderation Guest', 'Australia', 'Essential Bhutan', 5, 'Pending Review', 'Amazing trip!', 1, 0, 0)`,
      [booking1.id]
    );
    const revId = insertRev.lastInsertRowid;
    createdReviewIds.push(revId);

    const listRevs = await apiReq(baseUrl, 'GET', '/api/admin/reviews', { token: conciergeToken });
    assert.strictEqual(listRevs.status, 200);
    assert.ok(listRevs.body.data.some((r) => r.id === revId));

    const modRev = await apiReq(baseUrl, 'PATCH', `/api/admin/reviews/${revId}`, {
      token: conciergeToken,
      body: { is_published: 1, is_featured: 1, admin_response: 'Kadrinchey La!' }
    });
    assert.strictEqual(modRev.status, 200);
    assert.strictEqual(modRev.body.review.is_published, 1);

    const pubRevs = await apiReq(baseUrl, 'GET', '/api/reviews');
    assert.ok(pubRevs.body.data.some((r) => r.id === revId));

    const delRev = await apiReq(baseUrl, 'DELETE', `/api/admin/reviews/${revId}`, { token: conciergeToken });
    assert.strictEqual(delRev.status, 200);

    // ------------------------------------------------------------------
    // 9. Settings Upsert, Test Notification, Staff Users & Audit Log
    // ------------------------------------------------------------------
    console.log('9. Testing Settings Upsert, Test Notification, Staff Users & Audit Log...');
    addedSettingKeys.push('crud_test_setting');
    const putSettings = await apiReq(baseUrl, 'PUT', '/api/admin/settings', {
      token: superToken,
      body: {
        company_tagline: 'Kingdom of Happiness Concierge',
        crud_test_setting: 'enabled_v1'
      }
    });
    assert.strictEqual(putSettings.status, 200, `Settings PUT failed: ${putSettings.text}`);

    const getSettings = await apiReq(baseUrl, 'GET', '/api/admin/settings', { token: superToken });
    assert.strictEqual(getSettings.status, 200);
    const upsertedRow = getSettings.body.data.find((s) => s.key === 'crud_test_setting');
    assert.ok(upsertedRow && upsertedRow.value === 'enabled_v1');

    const testNotifRes = await apiReq(baseUrl, 'POST', '/api/admin/settings/test-notification', {
      token: superToken,
      body: { channel: 'in_app', message: 'CRUD Settings Test Ping' }
    });
    assert.strictEqual(testNotifRes.status, 200);
    assert.ok(testNotifRes.body.result && testNotifRes.body.result.notification_id);
    createdNotificationIds.push(testNotifRes.body.result.notification_id);

    // Staff Users CRUD (super_admin only)
    const createStaffRes = await apiReq(baseUrl, 'POST', '/api/admin/users', {
      token: superToken,
      body: {
        full_name: 'Karma Concierge Test',
        email: 'karma.staff.test@bhutanfastratetours.bt',
        password: 'StaffPass!2026',
        role: 'concierge',
        phone: '+975 17 444 555'
      }
    });
    assert.strictEqual(createStaffRes.status, 201, `User create failed: ${createStaffRes.text}`);
    const newStaff = createStaffRes.body.user;
    createdUserIds.push(newStaff.id);
    assert.strictEqual('password_hash' in newStaff, false);

    const updStaffRes = await apiReq(baseUrl, 'PUT', `/api/admin/users/${newStaff.id}`, {
      token: superToken,
      body: { role: 'admin', full_name: 'Karma Admin Test' }
    });
    assert.strictEqual(updStaffRes.status, 200);
    assert.strictEqual(updStaffRes.body.user.role, 'admin');

    const togStaffRes = await apiReq(baseUrl, 'PATCH', `/api/admin/users/${newStaff.id}/toggle`, {
      token: superToken
    });
    assert.strictEqual(togStaffRes.status, 200);
    assert.strictEqual(togStaffRes.body.is_active, 0);

    // Self-deactivation & last super_admin guard
    const selfToggleRes = await apiReq(baseUrl, 'PATCH', `/api/admin/users/${superUserId}/toggle`, {
      token: superToken
    });
    assert.strictEqual(selfToggleRes.status, 400, 'Must prevent self-deactivation / last super_admin deactivation');

    const demoteLastSuper = await apiReq(baseUrl, 'PUT', `/api/admin/users/${superUserId}`, {
      token: superToken,
      body: { role: 'admin' }
    });
    assert.strictEqual(demoteLastSuper.status, 400, 'Must prevent demoting last active super_admin');

    // Audit Log & Notifications
    const auditRes = await apiReq(baseUrl, 'GET', `/api/admin/audit-log?entity_id=${booking1.id}`, { token: superToken });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.data.length >= 3);

    const notifsRes = await apiReq(baseUrl, 'GET', '/api/admin/notifications', { token: superToken });
    assert.strictEqual(notifsRes.status, 200);
    assert.ok(Array.isArray(notifsRes.body.data));

    console.log('\n======================================================');
    console.log('🎉 ALL ADMIN CRUD, RBAC & E2E TESTS PASSED (100%)');
    console.log('======================================================');
  } finally {
    await closeServer(server);

    for (const filePath of uploadedFilesToClean) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    }

    for (const rId of createdReviewIds) {
      try { await db.run('DELETE FROM reviews WHERE id = ?', [rId]); } catch (_) {}
    }
    for (const iId of createdInquiryIds) {
      try {
        const inq = await db.get('SELECT ref_code FROM inquiries WHERE id = ?', [iId]);
        if (inq && inq.ref_code) {
          await db.run('DELETE FROM notifications WHERE message LIKE ?', [`%${inq.ref_code}%`]);
        }
        await db.run('DELETE FROM audit_log WHERE entity_type = ? AND entity_id = ?', ['inquiry', String(iId)]);
        await db.run('DELETE FROM inquiries WHERE id = ?', [iId]);
      } catch (_) {}
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
    for (const tId of createdTourIds) {
      try {
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [tId]);
        await db.run('DELETE FROM tours WHERE id = ?', [tId]);
      } catch (_) {}
    }
    for (const dId of createdDestIds) {
      try {
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [dId]);
        await db.run('DELETE FROM destinations WHERE id = ?', [dId]);
      } catch (_) {}
    }
    for (const fId of createdFestivalIds) {
      try {
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [fId]);
        await db.run('DELETE FROM festivals WHERE id = ?', [fId]);
      } catch (_) {}
    }
    for (const uId of createdUserIds) {
      try {
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [String(uId)]);
        await db.run('DELETE FROM users WHERE id = ?', [uId]);
      } catch (_) {}
    }
    for (const nId of createdNotificationIds) {
      try { await db.run('DELETE FROM notifications WHERE id = ?', [nId]); } catch (_) {}
    }
    for (const aId of createdAuditIds) {
      try { await db.run('DELETE FROM audit_log WHERE id = ?', [aId]); } catch (_) {}
    }
    for (const sKey of addedSettingKeys) {
      try { await db.run('DELETE FROM settings WHERE key = ?', [sKey]); } catch (_) {}
    }
    if (savedCompanyTagline) {
      try {
        await db.run('UPDATE settings SET value = ? WHERE key = ?', [savedCompanyTagline.value, 'company_tagline']);
      } catch (_) {}
    } else {
      try {
        await db.run("DELETE FROM settings WHERE key = 'company_tagline'");
      } catch (_) {}
    }
    try {
      await db.run("DELETE FROM audit_log WHERE entity_type = 'settings'");
    } catch (_) {}

    assert.deepStrictEqual(listUploadFiles(), initialUploadFiles, 'uploads/ must be clean after test-crud cleanup');
    await db.closeDb();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
