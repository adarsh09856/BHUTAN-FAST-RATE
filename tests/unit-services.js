const assert = require('assert');
const db = require('../database/db');

async function runTests() {
  const insertedNotificationIds = [];

  try {
    console.log('1. Testing services/sdf-engine.js (multi-currency, tiers, child discounts, waivers)...');
    const sdfEngine = require('../services/sdf-engine');
    assert.strictEqual(typeof sdfEngine.calculatePricingQuote, 'function', 'calculatePricingQuote must be exported');
    assert.strictEqual(typeof sdfEngine.calculateSDF, 'function', 'calculateSDF must remain exported');

    const sampleTour = {
      id: 'test-heritage-7d',
      duration_days: 7,
      duration_nights: 6,
      price_usd: 1950,
      price_3star_usd: 1950,
      price_4star_usd: 2550,
      price_5star_usd: 3850
    };

    const baseSettings = {
      sdf_rate_international: 100,
      sdf_rate_india: 1200,
      sdf_child_6_12_discount: 0.50,
      usd_to_inr_rate: 85,
      visa_fee_usd: 40,
      child_package_discount: 0.40,
      booking_deposit_percent: 0.30,
      hotel_4star_surcharge_usd: 400,
      hotel_5star_surcharge_usd: 1200
    };

    // 1a. 3-star, 4-star, 5-star international tiers
    const q3 = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 6,
      adults: 2,
      children_6_12: 0,
      children_under_6: 0,
      nationality_type: 'international',
      hotel_tier: '3-star',
      settingsOverride: baseSettings
    });
    assert.strictEqual(q3.currency, 'USD');
    assert.strictEqual(q3.exchange_rate, 1);
    assert.strictEqual(q3.package_total_usd, 3900);
    assert.strictEqual(q3.total_sdf_usd, 1200);
    assert.strictEqual(q3.total_sdf_local, q3.total_sdf_usd);
    assert.strictEqual(q3.visa_fee_usd, 80);
    assert.strictEqual(q3.visa_fee_local, q3.visa_fee_usd);
    assert.strictEqual(q3.total_price_usd, 5180);
    assert.strictEqual(q3.total_price_local, q3.total_price_usd);

    const q4 = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 6,
      adults: 2,
      children_6_12: 0,
      children_under_6: 0,
      nationality_type: 'international',
      hotel_tier: '4-Star Premium',
      settingsOverride: baseSettings
    });
    assert.strictEqual(q4.package_total_usd, 5100);
    assert.strictEqual(q4.total_price_usd, 6380);

    const q5 = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 6,
      adults: 2,
      children_6_12: 0,
      children_under_6: 0,
      nationality_type: 'international',
      hotel_tier: '5-star',
      settingsOverride: baseSettings
    });
    assert.strictEqual(q5.package_total_usd, 7700);
    assert.strictEqual(q5.total_price_usd, 8980);

    // 1b. Surcharge fallback when 4-star/5-star fields missing on tour
    const fallbackTour = { duration_nights: 5, price_3star_usd: 1500 };
    const q4Fallback = await sdfEngine.calculatePricingQuote({
      tour: fallbackTour,
      nights: 5,
      adults: 1,
      nationality_type: 'international',
      hotel_tier: '4-star',
      settingsOverride: baseSettings
    });
    assert.strictEqual(q4Fallback.package_total_usd, 1900, '4-star fallback must add hotel_4star_surcharge_usd');

    const q5Fallback = await sdfEngine.calculatePricingQuote({
      tour: fallbackTour,
      nights: 5,
      adults: 1,
      nationality_type: 'international',
      hotel_tier: '5-star',
      settingsOverride: baseSettings
    });
    assert.strictEqual(q5Fallback.package_total_usd, 2700, '5-star fallback must add hotel_5star_surcharge_usd');

    // 1c. Custom daily rate > 0 overrides tour tier pricing
    const qCustom = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 4,
      adults: 2,
      nationality_type: 'international',
      custom_daily_rate: 300,
      settingsOverride: baseSettings
    });
    assert.strictEqual(qCustom.package_total_usd, 2400);
    assert.strictEqual(qCustom.total_sdf_usd, 800);
    assert.strictEqual(qCustom.visa_fee_usd, 80);
    assert.strictEqual(qCustom.total_price_usd, 3280);

    // 1d. Child 6-12 discounts (40% package, 50% SDF) + under-6 exempt + extras & discount
    const qFamily = await sdfEngine.calculatePricingQuote({
      tour: { duration_nights: 5, price_3star_usd: 2000 },
      nights: 5,
      adults: 1,
      children_6_12: 1,
      children_under_6: 1,
      nationality_type: 'international',
      hotel_tier: '3-star',
      extras_usd: 150,
      discount_usd: 100,
      settingsOverride: baseSettings
    });
    // Package: 2000 + (2000 * 0.60) + 0 = 3200
    assert.strictEqual(qFamily.package_total_usd, 3200);
    // SDF: (5 * 1 * 100) + (5 * 1 * 50) + 0 = 750
    assert.strictEqual(qFamily.total_sdf_usd, 750);
    // Visa: (1 adult + 1 child 6-12) * 40 = 80 (under 6 exempt matching existing sdf-engine.js)
    assert.strictEqual(qFamily.visa_fee_usd, 80);
    // Total: 3200 + 750 + 80 + 150 - 100 = 4080
    assert.strictEqual(qFamily.total_price_usd, 4080);

    // 1e. Government SDF waiver (is_sdf_waived)
    const qWaived = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 6,
      adults: 2,
      nationality_type: 'international',
      hotel_tier: '3-star',
      is_sdf_waived: true,
      settingsOverride: baseSettings
    });
    assert.strictEqual(qWaived.total_sdf_usd, 0);
    assert.strictEqual(qWaived.total_sdf_local, 0);
    assert.strictEqual(qWaived.total_price_usd, 3980);

    // 1f. India / Regional Multi-Currency (Review Focus #1: INR invoice vs normalized USD, NEVER USD+INR)
    const qIndia = await sdfEngine.calculatePricingQuote({
      tour: { duration_nights: 5, price_3star_usd: 1000 },
      nights: 5,
      adults: 2,
      children_6_12: 1,
      children_under_6: 1,
      nationality_type: 'india',
      hotel_tier: '3-star',
      extras_usd: 100,
      discount_usd: 50,
      settingsOverride: baseSettings
    });
    assert.strictEqual(qIndia.currency, 'INR');
    assert.strictEqual(qIndia.exchange_rate, 85);
    assert.strictEqual(qIndia.total_sdf_local, 5 * 2 * 1200 + 5 * 1 * 600); // 15000 INR
    assert.strictEqual(qIndia.visa_fee_local, 0);
    assert.strictEqual(qIndia.visa_fee_usd, 0);
    assert.strictEqual(qIndia.package_total_usd, 2600);
    assert.strictEqual(qIndia.package_total_local, Math.round(2600 * 85)); // 221000 INR
    assert.strictEqual(qIndia.extras_local, 8500);
    assert.strictEqual(qIndia.discount_local, 4250);
    assert.strictEqual(qIndia.total_price_local, 221000 + 15000 + 8500 - 4250); // 240250 INR
    assert.strictEqual(qIndia.total_sdf_usd, Number((15000 / 85).toFixed(2)));
    assert.strictEqual(qIndia.total_price_usd, Number((240250 / 85).toFixed(2)));
    assert.notStrictEqual(qIndia.total_price_usd, 2600 + 15000, 'Must never add raw USD + INR');

    // 1g. Async DB-backed calculatePricingQuote & calculateSDF (using SQLite settings)
    const dbQuote = await sdfEngine.calculatePricingQuote({
      tour: sampleTour,
      nights: 6,
      adults: 2,
      nationality_type: 'international',
      hotel_tier: '3-star'
    });
    assert.strictEqual(dbQuote.total_sdf_usd, 1200);
    assert.strictEqual(dbQuote.total_price_usd, 5180);

    const legacySdf = await sdfEngine.calculateSDF({
      nationality_type: 'international',
      nights: 8,
      adults: 2,
      children_6_12: 1,
      children_under_6: 0
    });
    assert.strictEqual(legacySdf.total_sdf, 2000);
    assert.strictEqual(legacySdf.total_visa_fee, 120);

    // 1h. Configurable child_package_discount & booking_deposit_percent overrides
    const qCustomPolicies = await sdfEngine.calculatePricingQuote({
      tour: { duration_nights: 4, price_3star_usd: 1000 },
      nights: 4,
      adults: 1,
      children_6_12: 1,
      nationality_type: 'international',
      hotel_tier: '3-star',
      settingsOverride: {
        ...baseSettings,
        child_package_discount: 0.50,
        booking_deposit_percent: 0.25
      }
    });
    assert.strictEqual(qCustomPolicies.package_total_usd, 1500);
    assert.strictEqual(qCustomPolicies.deposit_percent, 0.25);
    assert.strictEqual(qCustomPolicies.deposit_amount_usd, Math.round(qCustomPolicies.total_price_usd * 0.25));

    console.log('2. Testing services/visa-workflow.js (6-month UTC passport boundary & DoI state gates)...');
    const visaWorkflow = require('../services/visa-workflow');
    assert.strictEqual(typeof visaWorkflow.checkDocumentReadiness, 'function');
    assert.strictEqual(typeof visaWorkflow.checkVisaTransition, 'function');

    // 2a. Review Focus #2: 5 months 29 days after travelEndDate FAILS for international
    const travelEnd = '2026-10-15';
    const validTravelerBase = {
      full_name: 'Elena Rostova',
      passport_number: 'P9876543',
      passport_scan: 'passports/elena.pdf',
      photo_url: 'photos/elena.jpg'
    };

    const fail5m29d = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2027-04-13' }, // 2026-10-15 + 5m = 2027-03-15, +29d = 2027-04-13 (< 2027-04-15)
      travelEnd,
      'international',
      false
    );
    assert.strictEqual(fail5m29d.ready, false, '5 months 29 days validity must fail');
    assert.ok(
      fail5m29d.errors.some(e => /6[- ]?month/i.test(e)),
      `Error must explicitly mention 6-month requirement; got: ${JSON.stringify(fail5m29d.errors)}`
    );

    // 1 day before 6 calendar months also fails
    const failOneDayShort = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2027-04-14' },
      travelEnd,
      'international',
      false
    );
    assert.strictEqual(failOneDayShort.ready, false, '1 day short of 6 calendar months must fail');

    // Exact 6 calendar months passes
    const passExact6m = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2027-04-15' },
      travelEnd,
      'international',
      false
    );
    assert.strictEqual(passExact6m.ready, true, `Exact 6 months must pass; got errors: ${JSON.stringify(passExact6m)}`);

    // Month-end rollover test (Aug 31 + 6 months -> Feb 28 non-leap year)
    const passMonthEnd = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2027-02-28' },
      '2026-08-31',
      'international',
      false
    );
    assert.strictEqual(passMonthEnd.ready, true, 'Aug 31 + 6 months should clamp to Feb 28, not Mar 3');

    const failMonthEnd = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2027-02-27' },
      '2026-08-31',
      'international',
      false
    );
    assert.strictEqual(failMonthEnd.ready, false, 'Feb 27 is < Feb 28 6-month boundary');

    // Insurance requirement toggle
    const failInsurance = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2028-01-01' },
      travelEnd,
      'international',
      true
    );
    assert.strictEqual(failInsurance.ready, false);
    assert.ok(failInsurance.missing.includes('insurance_doc'), 'Missing insurance_doc must be reported when requireInsurance=true');

    const passInsurance = visaWorkflow.checkDocumentReadiness(
      { ...validTravelerBase, passport_expiry: '2028-01-01', insurance_doc: 'insurance/elena.pdf' },
      travelEnd,
      'international',
      true
    );
    assert.strictEqual(passInsurance.ready, true);

    // 2b. Regional India Entry Permit bypasses 6-month passport rule & accepts national_id
    const passIndiaNationalId = visaWorkflow.checkDocumentReadiness(
      {
        full_name: 'Aarav Patel',
        national_id: 'IND-VOTER-123456',
        passport_scan: 'passports/aarav_id.jpg',
        photo_url: 'photos/aarav.jpg'
      },
      travelEnd,
      'india',
      false
    );
    assert.strictEqual(passIndiaNationalId.ready, true, `India guest with national_id must pass; got: ${JSON.stringify(passIndiaNationalId)}`);

    const passRegionalIndiaShortPassport = visaWorkflow.checkDocumentReadiness(
      {
        full_name: 'Meera Iyer',
        passport_number: 'Z998877',
        passport_expiry: '2026-11-01', // < 6 months after travelEnd
        passport_scan: 'passports/meera.pdf',
        photo_url: 'photos/meera.jpg'
      },
      travelEnd,
      'regional_india',
      false
    );
    assert.strictEqual(passRegionalIndiaShortPassport.ready, true, 'regional_india must not enforce international 6-month passport expiry check');

    // 2c. checkVisaTransition gates
    const readyTravelers = [{ ...validTravelerBase, passport_expiry: '2028-01-01', insurance_doc: 'insurance/e.pdf' }];
    const unreadyTravelers = [{ ...validTravelerBase, passport_expiry: '2027-01-01' }];

    for (const gatedStage of ['submitted_to_doi', 'under_review', 'approved']) {
      const unpaidBlock = visaWorkflow.checkVisaTransition(
        'docs_received',
        gatedStage,
        { full_paid: 0, travel_date_end: travelEnd, nationality_type: 'international' },
        readyTravelers
      );
      assert.strictEqual(unpaidBlock.allowed, false, `${gatedStage} must block when full_paid !== 1`);

      const noTravelerBlock = visaWorkflow.checkVisaTransition(
        'payment_verified',
        gatedStage,
        { full_paid: 1, travel_date_end: travelEnd, nationality_type: 'international' },
        []
      );
      assert.strictEqual(noTravelerBlock.allowed, false, `${gatedStage} must block when travelers is empty`);

      const badDocBlock = visaWorkflow.checkVisaTransition(
        'payment_verified',
        gatedStage,
        { full_paid: 1, travel_date_end: travelEnd, nationality_type: 'international' },
        unreadyTravelers
      );
      assert.strictEqual(badDocBlock.allowed, false, `${gatedStage} must block when traveler docs fail readiness`);

      const validPass = visaWorkflow.checkVisaTransition(
        'payment_verified',
        gatedStage,
        { full_paid: 1, travel_date_end: travelEnd, nationality_type: 'international' },
        readyTravelers
      );
      assert.strictEqual(validPass.allowed, true, `${gatedStage} must pass when paid and all docs valid: ${validPass.reason}`);
    }

    const rejectMissingReason = visaWorkflow.checkVisaTransition(
      'submitted_to_doi',
      'rejected',
      { full_paid: 1, travel_date_end: travelEnd },
      readyTravelers,
      {}
    );
    assert.strictEqual(rejectMissingReason.allowed, false, 'rejected transition must require rejection_reason');

    const rejectWithReason = visaWorkflow.checkVisaTransition(
      'submitted_to_doi',
      'rejected',
      { full_paid: 1, travel_date_end: travelEnd },
      readyTravelers,
      { rejection_reason: 'Passport bio-page scan is blurry' }
    );
    assert.strictEqual(rejectWithReason.allowed, true, 'rejected transition with rejection_reason must succeed');

    console.log('3. Testing services/notification-service.js (WhatsApp URL, confirmation text, DB insert, blank SMTP skip)...');
    const notifService = require('../services/notification-service');
    assert.strictEqual(typeof notifService.buildWhatsAppShareUrl, 'function');
    assert.strictEqual(typeof notifService.renderConfirmationText, 'function');
    assert.strictEqual(typeof notifService.dispatchNotification, 'function');

    assert.strictEqual(
      notifService.buildWhatsAppShareUrl('+975 17-654-321', 'Hello Bhutan!'),
      'https://wa.me/97517654321?text=Hello%20Bhutan!'
    );
    assert.strictEqual(
      notifService.buildWhatsAppShareUrl('', 'Kuzuzangpo'),
      'https://wa.me/?text=Kuzuzangpo'
    );

    const sampleBookingInr = {
      id: 'BFR-2026-9901',
      lead_name: 'Ananya Sharma',
      lead_email: 'ananya@example.in',
      lead_phone: '+91 98100 12345',
      tour_title: 'Punakha Valley Subtropical Luxury Escape',
      travel_date_start: '2026-11-10',
      travel_date_end: '2026-11-14',
      currency: 'INR',
      nationality_type: 'india',
      exchange_rate: 85,
      total_price_usd: 2826.47,
      total_price_local: 240250
    };
    const renderedInr = notifService.renderConfirmationText('booking_new', sampleBookingInr, {
      company_license: 'TR/2018/9882',
      app_url: 'https://bhutanfastratetours.bt'
    });
    assert.ok(renderedInr.includes('BFR-2026-9901'), 'Must include booking ref');
    assert.ok(renderedInr.includes('Ananya Sharma'), 'Must include guest name');
    assert.ok(renderedInr.includes('INR'), 'Must include INR currency');
    assert.ok(renderedInr.includes('240,250') || renderedInr.includes('240250'), 'Must include INR total');
    assert.ok(renderedInr.includes('#TR/2018/9882'), 'Must include license #TR/2018/9882');
    assert.ok(renderedInr.includes('https://bhutanfastratetours.bt'), 'Must include tracking/portal URL');

    // Dispatch with default DB settings (blank smtp_host) -> skips SMTP cleanly, inserts DB row with wa.me URL
    const dispatchRes = await notifService.dispatchNotification('booking_new', {
      booking: sampleBookingInr,
      recipient_type: 'client',
      recipient_phone: '+91 98100 12345',
      recipient_email: 'ananya@example.in'
    });
    assert.strictEqual(dispatchRes.success, true);
    assert.ok(dispatchRes.id, 'dispatchNotification must return inserted notification id');
    insertedNotificationIds.push(dispatchRes.id);
    assert.ok(dispatchRes.whatsapp_url.startsWith('https://wa.me/919810012345?text='), 'Must return prefilled wa.me link');
    assert.strictEqual(dispatchRes.smtp_status, 'skipped', 'Blank smtp_host must skip SMTP cleanly without throwing');

    const dbNotifRow = await db.get('SELECT * FROM notifications WHERE id = ?', [dispatchRes.id]);
    assert.ok(dbNotifRow, 'Notification row must exist in DB');
    assert.strictEqual(dbNotifRow.whatsapp_url, dispatchRes.whatsapp_url);
    assert.ok(dbNotifRow.message.includes('BFR-2026-9901'));

    // Failed external webhook must not break caller
    const failedWebhookRes = await notifService.dispatchNotification('booking_confirmed', {
      booking: sampleBookingInr,
      recipient_type: 'client',
      recipient_phone: '+91 98100 12345',
      settingsOverride: {
        smtp_host: '',
        whatsapp_provider: 'webhook',
        whatsapp_api_url: 'http://127.0.0.1:1/nonexistent-webhook'
      }
    });
    assert.strictEqual(failedWebhookRes.success, true);
    insertedNotificationIds.push(failedWebhookRes.id);
    assert.strictEqual(failedWebhookRes.whatsapp_api_status, 'failed');
    assert.ok(failedWebhookRes.error_message, 'Failed webhook should record error_message safely');

    console.log('4. Testing services/document-templates.js (Invoice, Clearance Letter, Print CSS, XSS escaping)...');
    const docTemplates = require('../services/document-templates');
    assert.strictEqual(typeof docTemplates.renderInvoiceHtml, 'function');
    assert.strictEqual(typeof docTemplates.renderClearanceLetterHtml, 'function');

    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const xssBooking = {
      id: 'BFR-2026-XSS1',
      tour_title: `Heritage Tour ${xssPayload}`,
      lead_name: `Guest ${xssPayload}`,
      lead_email: 'guest@example.com',
      lead_phone: '+1 555 0100',
      lead_country: 'United States',
      travel_date_start: '2026-10-15',
      travel_date_end: '2026-10-21',
      total_nights: 6,
      total_travelers: 1,
      hotel_tier: '4-Star Premium',
      currency: 'USD',
      nationality_type: 'international',
      exchange_rate: 1,
      base_price_usd: 2550,
      sdf_total_usd: 600,
      visa_fee_usd: 40,
      extras_usd: 0,
      discount_usd: 0,
      total_price_usd: 3190,
      deposit_paid_usd: 3190,
      full_paid: 1,
      visa_clearance_number: `VCL-2026-9999-${xssPayload}`,
      visa_approved_date: '2026-09-01',
      special_requests: xssPayload
    };
    const xssTravelers = [
      {
        full_name: `Traveler ${xssPayload}`,
        nationality: 'United States',
        date_of_birth: '1988-05-01',
        passport_number: 'P123456',
        passport_expiry: '2029-12-01',
        age_category: 'adult',
        visa_status: 'approved'
      }
    ];
    const xssPayments = [
      {
        payment_type: 'full_payment',
        payment_method: 'bank_transfer',
        transaction_ref: `REF-${xssPayload}`,
        amount_usd: 3190,
        currency: 'USD',
        amount_local: 3190,
        status: 'verified',
        notes: xssPayload
      }
    ];

    const invoiceHtml = docTemplates.renderInvoiceHtml(xssBooking, xssTravelers, xssPayments, {
      company_name: 'Bhutan Fast Rate Tours',
      company_license: 'TR/2018/9882',
      bank_name: 'Bank of Bhutan Ltd.',
      bank_account: '200884910023'
    });
    assert.ok(invoiceHtml.includes('#TR/2018/9882'), 'Invoice must display license #TR/2018/9882');
    assert.ok(invoiceHtml.includes('@media print'), 'Invoice must include @media print CSS');
    assert.ok(invoiceHtml.includes('window.print()'), 'Invoice must include print button');
    assert.ok(!invoiceHtml.includes('<script>alert("xss")</script>'), 'Invoice must escape raw <script> tags');
    assert.ok(!invoiceHtml.includes('<img src=x onerror=alert(1)>'), 'Invoice must escape raw <img> tags');
    assert.ok(invoiceHtml.includes('&lt;script&gt;'), 'Invoice must HTML-escape XSS strings');
    assert.ok(invoiceHtml.includes('3,190') || invoiceHtml.includes('3190'), 'Invoice must show itemized USD total');

    const clearanceHtml = docTemplates.renderClearanceLetterHtml(xssBooking, xssTravelers, {
      company_name: 'Bhutan Fast Rate Tours',
      company_license: 'TR/2018/9882'
    });
    assert.ok(clearanceHtml.includes('#TR/2018/9882'), 'Clearance letter must display license #TR/2018/9882');
    assert.ok(clearanceHtml.includes('@media print'), 'Clearance letter must include @media print CSS');
    assert.ok(clearanceHtml.includes('window.print()'), 'Clearance letter must include print button');
    assert.ok(!clearanceHtml.includes('<script>alert("xss")</script>'), 'Clearance letter must escape raw <script> tags');
    assert.ok(!clearanceHtml.includes('<img src=x onerror=alert(1)>'), 'Clearance letter must escape raw <img> tags');
    assert.ok(clearanceHtml.includes('&lt;script&gt;'), 'Clearance letter must HTML-escape XSS strings');

    // INR invoice rendering
    const inrInvoiceHtml = docTemplates.renderInvoiceHtml(
      {
        ...sampleBookingInr,
        total_nights: 4,
        total_travelers: 2,
        hotel_tier: '4-Star Premium',
        base_price_usd: 2600,
        sdf_total_usd: 176.47,
        total_sdf_local: 15000,
        visa_fee_usd: 0,
        deposit_paid_usd: 0
      },
      [{ full_name: 'Ananya Sharma', age_category: 'adult', nationality: 'India', passport_number: 'IND-123' }],
      [],
      { company_license: 'TR/2018/9882' }
    );
    assert.ok(inrInvoiceHtml.includes('INR'), 'INR invoice must display INR currency');
    assert.ok(inrInvoiceHtml.includes('240,250'), 'INR invoice must display INR total');

    console.log('✅ ALL UNIT SERVICE TESTS PASSED');
  } finally {
    for (const id of insertedNotificationIds) {
      try {
        await db.run('DELETE FROM notifications WHERE id = ?', [id]);
      } catch (_) {}
    }
    await db.closeDb();
  }
}

runTests().catch((err) => {
  console.error('❌ UNIT SERVICES TEST FAILED:', err);
  process.exit(1);
});
