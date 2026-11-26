const assert = require('assert');
const crypto = require('crypto');
const db = require('../database/db');
const { signToken, verifyToken } = require('../middleware/auth');

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

async function runTests() {
  let server = null;
  const createdBookingIds = [];
  const createdInquiryRefs = [];
  const createdNotificationIds = [];
  const createdIdempotencyKeys = [];
  let savedNotificationReadStates = [];

  try {
    // Snapshot initial notification read states so seed DB remains pristine after /read-all test
    savedNotificationReadStates = await db.query('SELECT id, is_read FROM notifications');

    const started = await startTestServer();
    server = started.server;
    const baseUrl = started.baseUrl;

    // ------------------------------------------------------------------
    // 1. /api/settings/public must NEVER leak private/secret settings
    // ------------------------------------------------------------------
    console.log('1. Testing GET /api/settings/public whitelist & secret exclusion...');
    const pubSettingsRes = await fetch(`${baseUrl}/api/settings/public`);
    assert.strictEqual(pubSettingsRes.status, 200);
    const pubSettingsJson = await pubSettingsRes.json();
    assert.strictEqual(pubSettingsJson.success, true);
    assert.ok(pubSettingsJson.data && typeof pubSettingsJson.data === 'object');

    const pubData = pubSettingsJson.data;
    assert.strictEqual(pubData.company_license, 'TR/2018/9882');
    assert.strictEqual(pubData.sdf_rate_international, '100');
    assert.strictEqual(pubData.sdf_rate_india, '1200');
    assert.strictEqual(pubData.usd_to_inr_rate, '85');
    assert.strictEqual(pubData.visa_fee_usd, '40');

    const forbiddenKeys = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
      'whatsapp_provider', 'whatsapp_api_url', 'whatsapp_api_token', 'whatsapp_webhook_url',
      'whatsapp_from', 'whatsapp_template_name',
      'bank_beneficiary', 'bank_name', 'bank_swift', 'bank_account', 'bank_instructions'
    ];
    for (const key of forbiddenKeys) {
      assert.strictEqual(key in pubData, false, `/api/settings/public must NEVER expose ${key}`);
    }
    const serializedPubSettings = JSON.stringify(pubSettingsJson);
    assert.ok(!serializedPubSettings.includes('200884910023'), 'Must never leak bank account number');
    assert.ok(!serializedPubSettings.includes('BOBTBT22XXX'), 'Must never leak bank SWIFT code');

    // ------------------------------------------------------------------
    // 2. Public catalog: /tours, /tours/:slug, /destinations, /festivals, /reviews
    // ------------------------------------------------------------------
    console.log('2. Testing public catalog endpoints (/tours, /destinations, /festivals, /reviews)...');
    const toursRes = await fetch(`${baseUrl}/api/tours`);
    assert.strictEqual(toursRes.status, 200);
    const toursJson = await toursRes.json();
    assert.strictEqual(toursJson.success, true);
    assert.ok(Array.isArray(toursJson.data) && toursJson.data.length >= 10, 'Expected >= 10 seeded tours');
    assert.ok(Array.isArray(toursJson.data[0].itinerary), 'Tour itinerary must be parsed array');
    assert.ok(Array.isArray(toursJson.data[0].inclusions), 'Tour inclusions must be parsed array');

    const tourDetailRes = await fetch(`${baseUrl}/api/tours/essential-bhutan-7d`);
    assert.strictEqual(tourDetailRes.status, 200);
    const tourDetailJson = await tourDetailRes.json();
    assert.strictEqual(tourDetailJson.data.id, 'essential-bhutan-7d');
    assert.ok(Array.isArray(tourDetailJson.data.itinerary) && tourDetailJson.data.itinerary.length > 0);

    const missingTourRes = await fetch(`${baseUrl}/api/tours/nonexistent-tour-xyz`);
    assert.strictEqual(missingTourRes.status, 404);
    const missingTourJson = await missingTourRes.json();
    assert.strictEqual(missingTourJson.success, false);

    const destRes = await fetch(`${baseUrl}/api/destinations`);
    assert.strictEqual(destRes.status, 200);
    const destJson = await destRes.json();
    assert.strictEqual(destJson.success, true);
    assert.ok(Array.isArray(destJson.data) && destJson.data.length >= 6, 'Expected >= 6 seeded destinations');
    assert.ok(Array.isArray(destJson.data[0].highlights), 'Destination highlights must be parsed array');
    assert.ok(Array.isArray(destJson.data[0].related_tours), 'Destination must include related_tours summary');

    const destSingleRes = await fetch(`${baseUrl}/api/destinations/paro`);
    assert.strictEqual(destSingleRes.status, 200);
    const destSingleJson = await destSingleRes.json();
    assert.strictEqual(destSingleJson.data.id, 'paro');
    assert.ok(destSingleJson.data.related_tours.length > 0, 'Paro must link related tours');

    const festRes = await fetch(`${baseUrl}/api/festivals`);
    assert.strictEqual(festRes.status, 200);
    const festJson = await festRes.json();
    assert.strictEqual(festJson.success, true);
    assert.ok(Array.isArray(festJson.data) && festJson.data.length >= 4, 'Expected >= 4 seeded festivals');
    const thimphuFest = festJson.data.find(f => f.id === 'thimphu-tshechu');
    assert.ok(thimphuFest, 'Thimphu Tshechu must be returned by GET /api/festivals');
    assert.ok(Array.isArray(thimphuFest.highlights), 'Festival highlights must be parsed array');
    assert.ok(thimphuFest.related_tour && thimphuFest.related_tour.id === 'thimphu-tshechu-8d', 'Festival must include related_tour summary');

    const festSingleRes = await fetch(`${baseUrl}/api/festivals/thimphu-tshechu`);
    assert.strictEqual(festSingleRes.status, 200);
    const festSingleJson = await festSingleRes.json();
    assert.strictEqual(festSingleJson.data.id, 'thimphu-tshechu');
    assert.ok(festSingleJson.data.related_tour, 'Single festival must include related_tour summary');

    const missingFestRes = await fetch(`${baseUrl}/api/festivals/does-not-exist`);
    assert.strictEqual(missingFestRes.status, 404);

    const revRes = await fetch(`${baseUrl}/api/reviews`);
    assert.strictEqual(revRes.status, 200);
    const revJson = await revRes.json();
    assert.strictEqual(revJson.success, true);
    assert.ok(Array.isArray(revJson.data) && revJson.data.length >= 3, 'Expected >= 3 published reviews');

    // ------------------------------------------------------------------
    // 3. POST /api/calculate-sdf & POST /api/inquiries
    // ------------------------------------------------------------------
    console.log('3. Testing POST /api/calculate-sdf & POST /api/inquiries...');
    const badCalcRes = await fetch(`${baseUrl}/api/calculate-sdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nights: 0, adults: 2 })
    });
    assert.strictEqual(badCalcRes.status, 400, 'nights=0 must return 400');

    const tourCalcRes = await fetch(`${baseUrl}/api/calculate-sdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tour_id: 'essential-bhutan-7d',
        hotel_tier: '4-Star Premium',
        adults: 2,
        children_6_12: 1,
        children_under_6: 0,
        nationality_type: 'international'
      })
    });
    assert.strictEqual(tourCalcRes.status, 200);
    const tourCalcJson = await tourCalcRes.json();
    assert.strictEqual(tourCalcJson.success, true);
    // 4-star essential-bhutan-7d: $2550/adult, 6 nights
    // Package: 2 * 2550 + 1 * 2550 * 0.6 = 5100 + 1530 = 6630
    // SDF: 2 * 6 * 100 + 1 * 6 * 50 = 1500
    // Visa: 3 * 40 = 120; Total = 8250
    assert.strictEqual(tourCalcJson.data.currency, 'USD');
    assert.strictEqual(tourCalcJson.data.package_total_usd, 6630);
    assert.strictEqual(tourCalcJson.data.total_sdf_usd, 1500);
    assert.strictEqual(tourCalcJson.data.visa_fee_usd, 120);
    assert.strictEqual(tourCalcJson.data.total_price_usd, 8250);

    const badInqRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete Guest' })
    });
    assert.strictEqual(badInqRes.status, 400, 'Inquiry without email or phone/whatsapp must return 400');

    const inqRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clara Jensen',
        email: 'clara.jensen@example.org',
        phone: '+45 20 12 34 56',
        country: 'Denmark',
        preferred_dates: '2027-04-10',
        duration_days: 7,
        travelers_count: 2,
        interests: 'Festivals, Paro Taktsang',
        message: 'Looking for spring festival availability.'
      })
    });
    assert.ok(inqRes.status === 200 || inqRes.status === 201, `Expected 200/201 for inquiry, got ${inqRes.status}`);
    const inqJson = await inqRes.json();
    assert.strictEqual(inqJson.success, true);
    assert.ok(inqJson.inquiry_id, 'Inquiry response must include inquiry_id');
    assert.ok(inqJson.reference && inqJson.reference.startsWith('INQ-'), `Expected INQ-* reference, got ${inqJson.reference}`);
    assert.ok(inqJson.whatsapp_url && inqJson.whatsapp_url.startsWith('https://wa.me/'), 'Expected whatsapp_url on inquiry response');
    createdInquiryRefs.push(inqJson.reference);

    const inqRow = await db.get('SELECT * FROM inquiries WHERE ref_code = ?', [inqJson.reference]);
    assert.ok(inqRow && inqRow.name === 'Clara Jensen');
    const inqNotif = await db.get("SELECT id FROM notifications WHERE category = 'inquiry_received' AND message LIKE ? ORDER BY id DESC LIMIT 1", [`%${inqJson.reference}%`]);
    assert.ok(inqNotif, 'inquiry_received notification must be logged');
    createdNotificationIds.push(inqNotif.id);

    // Inquiry with WhatsApp only (no email) should also succeed cleanly
    const waOnlyInqRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Karma Wangchuk',
        whatsapp: '+97517112233',
        interests: 'Druk Path Trek'
      })
    });
    assert.ok(waOnlyInqRes.status === 200 || waOnlyInqRes.status === 201, `Expected 200/201 for whatsapp-only inquiry, got ${waOnlyInqRes.status}`);
    const waOnlyInqJson = await waOnlyInqRes.json();
    assert.strictEqual(waOnlyInqJson.success, true);
    assert.ok(waOnlyInqJson.reference && waOnlyInqJson.reference.startsWith('INQ-'));
    createdInquiryRefs.push(waOnlyInqJson.reference);

    // ------------------------------------------------------------------
    // 4. POST /api/bookings: tamper rejection, 3 travelers, mixed currency, India INR, idempotency
    // ------------------------------------------------------------------
    console.log('4. Testing POST /api/bookings (price tamper, 3 travelers, India INR, idempotency)...');
    const idempotencyKey = `test-idem-${crypto.randomUUID()}`;
    createdIdempotencyKeys.push(idempotencyKey);

    const tamperedPayload = {
      tour_id: 'essential-bhutan-7d',
      hotel_tier: '4-Star Premium',
      nationality_type: 'international',
      currency: 'USD',
      travel_date_start: '2027-05-10',
      adults_count: 2,
      children_6_12: 1,
      children_under_6: 0,
      lead_name: 'Tenzin Dorji Test',
      lead_email: 'tenzin.test@example.com',
      lead_phone: '+1 415 555 0199',
      lead_country: 'United States',
      lead_passport_no: 'US99887766',
      // Tampered client totals that MUST be ignored
      total_price_usd: 1,
      base_price_usd: 1,
      sdf_total_usd: 1,
      visa_fee_usd: 0,
      discount_usd: 5000
    };

    const bookRes1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(tamperedPayload)
    });
    assert.strictEqual(bookRes1.status, 201, `Expected 201 for new booking, got ${bookRes1.status}`);
    const bookJson1 = await bookRes1.json();
    assert.strictEqual(bookJson1.success, true);
    assert.ok(bookJson1.booking && bookJson1.booking.id);
    const intlBookingId = bookJson1.booking.id;
    createdBookingIds.push(intlBookingId);

    // Server authoritative totals must overwrite tampered values
    assert.strictEqual(bookJson1.booking.base_price_usd, 6630);
    assert.strictEqual(bookJson1.booking.sdf_total_usd, 1500);
    assert.strictEqual(bookJson1.booking.visa_fee_usd, 120);
    assert.strictEqual(bookJson1.booking.total_price_usd, 8250);
    assert.strictEqual(bookJson1.quote.total_price_usd, 8250);
    assert.ok(bookJson1.whatsapp_concierge_url && bookJson1.whatsapp_concierge_url.startsWith('https://wa.me/'));

    // Verify client_token claims
    assert.ok(bookJson1.client_token, 'Must return client_token');
    const decodedClient = verifyToken(bookJson1.client_token);
    assert.ok(decodedClient && decodedClient.role === 'client' && decodedClient.bookingId === intlBookingId);

    // Verify EXACT 3 travelers rows inserted in DB for 2 adults + 1 child (6-12)
    const intlTravelers = await db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [intlBookingId]);
    assert.strictEqual(intlTravelers.length, 3, `Expected 3 traveler rows for 2 adults + 1 child_6_12, got ${intlTravelers.length}`);
    assert.strictEqual(intlTravelers.filter(t => t.age_category === 'adult').length, 2);
    assert.strictEqual(intlTravelers.filter(t => t.age_category === 'child_6_12').length, 1);

    // Repeat identical request with same Idempotency-Key -> MUST return 200 & original booking without duplicates
    const bookResDup = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(tamperedPayload)
    });
    assert.strictEqual(bookResDup.status, 200, `Duplicate Idempotency-Key must return 200, got ${bookResDup.status}`);
    const bookJsonDup = await bookResDup.json();
    assert.strictEqual(bookJsonDup.booking.id, intlBookingId, 'Idempotent retry must return original booking ID');
    assert.ok(bookJsonDup.client_token, 'Idempotent retry must return valid client_token');
    const travelersAfterDup = await db.query('SELECT * FROM travelers WHERE booking_id = ?', [intlBookingId]);
    assert.strictEqual(travelersAfterDup.length, 3, 'Idempotent retry must NOT create extra traveler rows');
    const dupCountRows = await db.query('SELECT id FROM bookings WHERE lead_email = ?', ['tenzin.test@example.com']);
    assert.strictEqual(dupCountRows.length, 1, 'Idempotent retry must NOT create second booking row');

    // Mixed-currency tamper checks -> 400
    const indiaUsdTamperRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tamperedPayload,
        nationality_type: 'india',
        currency: 'USD'
      })
    });
    assert.strictEqual(indiaUsdTamperRes.status, 400, 'India nationality paired with currency=USD must return 400');

    const intlInrTamperRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tamperedPayload,
        nationality_type: 'international',
        currency: 'INR'
      })
    });
    assert.strictEqual(intlInrTamperRes.status, 400, 'International nationality paired with currency=INR must return 400');

    // Valid India INR custom booking (2 adults, 5 nights, 3-star custom daily rate 220/night -> 2200 USD * 85 = 187000 INR + 12000 INR SDF = 199000 INR)
    const indiaRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotel_tier: '3-Star Heritage',
        nationality_type: 'india',
        currency: 'INR',
        travel_date_start: '2027-06-01',
        nights: 5,
        adults_count: 2,
        children_6_12: 0,
        children_under_6: 0,
        lead_name: 'Aarav Sharma Test',
        lead_email: 'aarav.in.test@example.in',
        lead_phone: '+91 98111 22334',
        lead_country: 'India',
        travelers: [{ full_name: 'Aarav Sharma Test', age_category: 'adult', nationality: 'India' }]
      })
    });
    assert.strictEqual(indiaRes.status, 201, `Expected 201 for India INR booking, got ${indiaRes.status}`);
    const indiaJson = await indiaRes.json();
    const indiaBookingId = indiaJson.booking.id;
    createdBookingIds.push(indiaBookingId);

    assert.strictEqual(indiaJson.booking.currency, 'INR');
    assert.strictEqual(indiaJson.quote.total_sdf_local, 12000);
    assert.strictEqual(indiaJson.quote.visa_fee_local, 0);
    assert.strictEqual(indiaJson.quote.package_total_local, 187000);
    assert.strictEqual(indiaJson.quote.total_price_local, 199000);
    assert.strictEqual(indiaJson.booking.total_price_usd, Math.round(199000 / 85));

    const indiaTravelers = await db.query('SELECT * FROM travelers WHERE booking_id = ?', [indiaBookingId]);
    assert.strictEqual(indiaTravelers.length, 2, 'Partial travelers[] must auto-fill companion up to party size (2)');

    // ------------------------------------------------------------------
    // 5. GET /api/bookings/track/:ref (masked vs email-verified)
    // ------------------------------------------------------------------
    console.log('5. Testing GET /api/bookings/track/:ref masking & email verification...');
    const track404 = await fetch(`${baseUrl}/api/bookings/track/BFR-9999-NOPE`);
    assert.strictEqual(track404.status, 404);

    const trackMaskedRes = await fetch(`${baseUrl}/api/bookings/track/${intlBookingId}`);
    assert.strictEqual(trackMaskedRes.status, 200);
    const trackMaskedJson = await trackMaskedRes.json();
    assert.strictEqual(trackMaskedJson.masked, true);
    assert.strictEqual(trackMaskedJson.booking.id, intlBookingId);
    assert.strictEqual(trackMaskedJson.booking.total_travelers, 3);
    assert.strictEqual('lead_email' in trackMaskedJson.booking, false, 'Masked track must not expose lead_email');
    assert.strictEqual('lead_phone' in trackMaskedJson.booking, false, 'Masked track must not expose lead_phone');
    assert.strictEqual('lead_passport_no' in trackMaskedJson.booking, false, 'Masked track must not expose lead_passport_no');
    assert.strictEqual('lead_name' in trackMaskedJson.booking, false, 'Masked track must not expose lead_name');
    assert.ok(!JSON.stringify(trackMaskedJson).includes('tenzin.test@example.com'), 'Masked track must contain zero email PII');
    assert.ok(!JSON.stringify(trackMaskedJson).includes('US99887766'), 'Masked track must contain zero passport PII');

    const trackWrongEmailRes = await fetch(`${baseUrl}/api/bookings/track/${intlBookingId}?email=attacker@evil.com`);
    assert.strictEqual(trackWrongEmailRes.status, 200);
    const trackWrongEmailJson = await trackWrongEmailRes.json();
    assert.strictEqual(trackWrongEmailJson.masked, true, 'Mismatched email must remain masked');
    assert.ok(!JSON.stringify(trackWrongEmailJson).includes('tenzin.test@example.com'));

    const trackVerifiedRes = await fetch(`${baseUrl}/api/bookings/track/${intlBookingId}?email=${encodeURIComponent('TENZIN.TEST@example.com')}`);
    assert.strictEqual(trackVerifiedRes.status, 200);
    const trackVerifiedJson = await trackVerifiedRes.json();
    assert.strictEqual(trackVerifiedJson.masked, false);
    assert.strictEqual(trackVerifiedJson.email_verified, true);
    assert.strictEqual(trackVerifiedJson.booking.lead_name, 'Tenzin Dorji Test');
    assert.ok(trackVerifiedJson.booking.doc_readiness && trackVerifiedJson.booking.doc_readiness.total === 3, 'Verified track must include doc_readiness counts');
    assert.strictEqual(trackVerifiedJson.booking.doc_readiness.ready_count, 0);
    assert.strictEqual(trackVerifiedJson.booking.doc_readiness.incomplete_count, 3);
    for (const tr of trackVerifiedJson.booking.travelers) {
      assert.strictEqual('passport_scan' in tr, false, 'Verified track must not expose passport_scan path');
      assert.strictEqual('insurance_doc' in tr, false, 'Verified track must not expose insurance_doc path');
      assert.strictEqual('photo_url' in tr, false, 'Verified track must not expose photo_url path');
      assert.strictEqual('passport_number' in tr, false, 'Verified track must not expose raw passport_number');
    }

    // Verified track on seeded BFR-2026-8841 must not leak raw passport numbers or sensitive scans
    const trackSeededRes = await fetch(`${baseUrl}/api/bookings/track/BFR-2026-8841?email=${encodeURIComponent('evelyn.m@example.com')}`);
    assert.strictEqual(trackSeededRes.status, 200);
    const trackSeededText = await trackSeededRes.text();
    assert.ok(!trackSeededText.includes('A92817462'), 'Verified track must not leak raw passport number A92817462');

    // Full explicit travelers[] roster (2 adults + 1 child_6_12)
    const explicitTravelersRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tour_id: 'essential-bhutan-7d',
        hotel_tier: '3-Star Heritage',
        nationality_type: 'international',
        travel_date_start: '2027-07-15',
        adults_count: 2,
        children_6_12: 1,
        children_under_6: 0,
        lead_name: 'Maya Lin Test',
        lead_email: 'maya.lin.test@example.com',
        lead_phone: '+65 9123 4567',
        lead_country: 'Singapore',
        travelers: [
          { full_name: 'Maya Lin Test', age_category: 'adult', nationality: 'Singapore' },
          { full_name: 'Liam Tan Test', age_category: 'adult', nationality: 'Singapore' },
          { full_name: 'Chloe Tan Test', age_category: 'child_6_12', nationality: 'Singapore' }
        ]
      })
    });
    assert.strictEqual(explicitTravelersRes.status, 201);
    const explicitJson = await explicitTravelersRes.json();
    createdBookingIds.push(explicitJson.booking.id);
    const explicitDbTravelers = await db.query('SELECT full_name, age_category FROM travelers WHERE booking_id = ? ORDER BY id ASC', [explicitJson.booking.id]);
    assert.strictEqual(explicitDbTravelers.length, 3);
    assert.deepStrictEqual(
      explicitDbTravelers.map(t => t.full_name),
      ['Maya Lin Test', 'Liam Tan Test', 'Chloe Tan Test']
    );

    // ------------------------------------------------------------------
    // 6. Printable invoice-view & clearance-view RBAC & ?token= checks
    // ------------------------------------------------------------------
    console.log('6. Testing printable invoice-view & clearance-view access control...');
    const guideToken = signToken({ id: 3, role: 'guide', email: 'kinley@bhutanfastratetours.bt' });
    const adminToken = signToken({ id: 1, role: 'admin', email: 'admin@bhutanfastratetours.bt' });
    const seededApprovedClientToken = signToken({ role: 'client', bookingId: 'BFR-2026-8841', bookingDbId: 'BFR-2026-8841', email: 'evelyn.m@example.com' });

    // Anonymous -> 401
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/${intlBookingId}/invoice-view`)).status, 401);
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/${intlBookingId}/clearance-view`)).status, 401);

    // Guide -> 403
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/${intlBookingId}/invoice-view`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    })).status, 403);

    // Client token for booking A cannot view booking B -> 403
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/BFR-2026-8841/invoice-view?token=${encodeURIComponent(bookJson1.client_token)}`)).status, 403);

    // Client token for own booking -> 200 printable HTML with #TR/2018/9882
    const invRes = await fetch(`${baseUrl}/api/bookings/${intlBookingId}/invoice-view?token=${encodeURIComponent(bookJson1.client_token)}`);
    assert.strictEqual(invRes.status, 200);
    const invHtml = await invRes.text();
    assert.ok(invHtml.includes('#TR/2018/9882'), 'Invoice HTML must include #TR/2018/9882');
    assert.ok(invHtml.includes(intlBookingId), 'Invoice HTML must include booking ref');
    assert.ok(invHtml.includes('8,250') || invHtml.includes('8250'), 'Invoice HTML must include authoritative total');

    // Unapproved booking -> client blocked 403 on clearance-view, staff allowed 200
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/${intlBookingId}/clearance-view?token=${encodeURIComponent(bookJson1.client_token)}`)).status, 403);
    assert.strictEqual((await fetch(`${baseUrl}/api/bookings/${intlBookingId}/clearance-view`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })).status, 200);

    // Approved booking (seeded BFR-2026-8841) -> client allowed 200
    const clrRes = await fetch(`${baseUrl}/api/bookings/BFR-2026-8841/clearance-view?token=${encodeURIComponent(seededApprovedClientToken)}`);
    assert.strictEqual(clrRes.status, 200);
    const clrHtml = await clrRes.text();
    assert.ok(clrHtml.includes('VCL-2026-8841-BFR') && clrHtml.includes('#TR/2018/9882'));

    // ------------------------------------------------------------------
    // 7. /api/notifications hub RBAC & CRUD
    // ------------------------------------------------------------------
    console.log('7. Testing /api/notifications RBAC & endpoints...');
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications`)).status, 401);
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${guideToken}` }
    })).status, 403);
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${bookJson1.client_token}` }
    })).status, 403);

    // Query token must NEVER work on /api/notifications (neither GET nor POST)
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications?token=${encodeURIComponent(adminToken)}`)).status, 401);
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications/send?token=${encodeURIComponent(adminToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'booking_new', booking_id: intlBookingId })
    })).status, 401);

    const conciergeToken = signToken({ id: 2, role: 'concierge', email: 'dechen@bhutanfastratetours.bt' });
    const sendNotifRes = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conciergeToken}`
      },
      body: JSON.stringify({
        event: 'booking_confirmed',
        booking_id: intlBookingId,
        recipient_type: 'client',
        skipSmtp: true,
        skipWhatsAppApi: true
      })
    });
    assert.ok(sendNotifRes.status === 200 || sendNotifRes.status === 201, `Expected 200/201 for POST /api/notifications/send, got ${sendNotifRes.status}`);
    const sendNotifJson = await sendNotifRes.json();
    assert.strictEqual(sendNotifJson.success, true);
    const sentNotifId = sendNotifJson.id || sendNotifJson.notification_id;
    assert.ok(sentNotifId, 'Sent notification must return id');
    createdNotificationIds.push(sentNotifId);
    assert.ok(sendNotifJson.whatsapp_url && sendNotifJson.whatsapp_url.startsWith('https://wa.me/'));

    const listNotifRes = await fetch(`${baseUrl}/api/notifications?unread=1&channel=whatsapp&limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(listNotifRes.status, 200);
    const listNotifJson = await listNotifRes.json();
    assert.strictEqual(listNotifJson.success, true);
    assert.ok(listNotifJson.data.some(n => n.id === sentNotifId), 'Newly dispatched unread whatsapp notification must appear in filtered GET /api/notifications');

    const markReadRes = await fetch(`${baseUrl}/api/notifications/${sentNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${conciergeToken}` }
    });
    assert.strictEqual(markReadRes.status, 200);
    const markReadJson = await markReadRes.json();
    assert.strictEqual(markReadJson.data.is_read, 1);

    const markSentRes = await fetch(`${baseUrl}/api/notifications/${sentNotifId}/sent`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(markSentRes.status, 200);
    const markSentJson = await markSentRes.json();
    assert.strictEqual(markSentJson.data.is_sent, 1);
    assert.ok(markSentJson.data.sent_at);

    const markAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(markAllRes.status, 200);

    console.log('✅ ALL PUBLIC CATALOG, MULTI-GUEST BOOKINGS & NOTIFICATIONS TESTS PASSED');
  } finally {
    await closeServer(server);

    // Clean up all test rows created during execution so seed DB remains pristine
    for (const bookingId of createdBookingIds) {
      try {
        await db.run('DELETE FROM travelers WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM payments WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM guide_assignments WHERE booking_id = ?', [bookingId]);
        await db.run('DELETE FROM notifications WHERE action_url LIKE ? OR metadata_json LIKE ?', [`%${bookingId}%`, `%${bookingId}%`]);
        await db.run('DELETE FROM audit_log WHERE entity_id = ?', [bookingId]);
        await db.run('DELETE FROM bookings WHERE id = ?', [bookingId]);
      } catch (_) {}
    }

    for (const key of createdIdempotencyKeys) {
      try {
        await db.run("DELETE FROM audit_log WHERE entity_type = 'idempotency' AND old_value = ?", [key]);
      } catch (_) {}
    }

    for (const ref of createdInquiryRefs) {
      try {
        await db.run('DELETE FROM notifications WHERE message LIKE ?', [`%${ref}%`]);
        await db.run('DELETE FROM inquiries WHERE ref_code = ?', [ref]);
      } catch (_) {}
    }

    for (const nId of createdNotificationIds) {
      try {
        await db.run('DELETE FROM notifications WHERE id = ?', [nId]);
      } catch (_) {}
    }

    for (const row of savedNotificationReadStates) {
      try {
        await db.run('UPDATE notifications SET is_read = ? WHERE id = ?', [row.is_read, row.id]);
      } catch (_) {}
    }

    await db.closeDb();
  }
}

runTests().catch((err) => {
  console.error('❌ PUBLIC & BOOKINGS TEST FAILED:', err);
  process.exit(1);
});
