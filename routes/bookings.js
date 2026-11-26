const express = require('express');
const crypto = require('node:crypto');
const router = express.Router();
const db = require('../database/db');
const { STAFF_ROLES, signToken, verifyToken, extractToken } = require('../middleware/auth');
const { calculatePricingQuote, calculateSDF } = require('../services/sdf-engine');
const { parseUTCDate, checkDocumentReadiness, generateClearanceNotice } = require('../services/visa-workflow');
const { dispatchNotification, buildWhatsAppShareUrl } = require('../services/notification-service');
const { renderInvoiceHtml, renderClearanceLetterHtml } = require('../services/document-templates');

const VALID_NATIONALITIES = new Set(['international', 'india', 'regional_india', 'regional']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inFlightIdempotency = new Map();

function parseStrictNonNegativeInt(rawValue) {
  const str = String(rawValue).trim();
  if (!/^-?\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num >= 0 ? num : null;
}

function parseStrictPositiveInt(rawValue) {
  const num = parseStrictNonNegativeInt(rawValue);
  return num !== null && num >= 1 ? num : null;
}

function addDaysUTCString(dateObj, days) {
  const dt = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate() + days));
  return dt.toISOString().split('T')[0];
}

function normalizeAgeCategory(rawCategory, fallback = 'adult') {
  const norm = String(rawCategory || '').trim().toLowerCase();
  if (norm === 'adult') return 'adult';
  if (norm === 'child_6_12' || norm === 'child' || norm === 'child_6-12') return 'child_6_12';
  if (norm === 'child_under_6' || norm === 'under_6' || norm === 'infant') return 'child_under_6';
  return fallback;
}

function isValidAgeCategoryInput(rawCategory) {
  const norm = String(rawCategory || '').trim().toLowerCase();
  return ['adult', 'child_6_12', 'child', 'child_6-12', 'child_under_6', 'under_6', 'infant'].includes(norm);
}

async function loadSettingsMap(executor = db) {
  const rows = await executor.query('SELECT key, value FROM settings');
  const map = {};
  for (const row of rows || []) {
    map[row.key] = row.value;
  }
  return map;
}

async function generateUniqueBookingId(tx) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 6; i++) {
    const code = crypto.randomInt(1000, 10000);
    const candidate = `BFR-${year}-${code}`;
    const existing = await tx.get('SELECT id FROM bookings WHERE id = ?', [candidate]);
    if (!existing) return candidate;
  }
  return `BFR-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function resolveTourByIdOrSlug(rawRef) {
  if (!rawRef) return null;
  const raw = String(rawRef).trim();
  if (!raw || ['custom', 'custom_trip'].includes(raw.toLowerCase())) return null;
  const clean = raw.replace(/^tour-/i, '').replace(/\.html$/i, '');
  const slugCandidate = raw.endsWith('.html') ? raw : `tour-${clean}.html`;
  return db.get(
    'SELECT * FROM tours WHERE is_active = 1 AND (id = ? OR slug = ? OR slug = ? OR id = ?)',
    [raw, raw, slugCandidate, clean]
  );
}

function buildBookingResponse({ bookingRow, travelersRows, quote, agencyWhatsapp, notificationId }) {
  const clientToken = signToken({
    role: 'client',
    bookingId: bookingRow.id,
    bookingDbId: bookingRow.id,
    email: bookingRow.lead_email
  });

  const whatsappConciergeUrl = buildWhatsAppShareUrl(
    agencyWhatsapp,
    `Kuzuzangpo La! I just reserved booking ${bookingRow.id} (${bookingRow.tour_title}) for ${bookingRow.travel_date_start} to ${bookingRow.travel_date_end}.`
  );

  return {
    success: true,
    message: 'Booking successfully reserved! Your dedicated concierge will issue official deposit instructions and visa document forms.',
    booking: {
      ...bookingRow,
      travel_dates: `${bookingRow.travel_date_start} to ${bookingRow.travel_date_end} (${bookingRow.total_nights} Nights)`,
      travelers_count: bookingRow.total_travelers,
      travelers: travelersRows,
      tracking_url: `track-visa.html?ref=${encodeURIComponent(bookingRow.id)}&email=${encodeURIComponent(bookingRow.lead_email)}`
    },
    quote,
    client_token: clientToken,
    whatsapp_concierge_url: whatsappConciergeUrl,
    ...(notificationId ? { notification_id: notificationId } : {})
  };
}

function allocateRemainingSlot(remaining) {
  if (remaining.adult > 0) {
    remaining.adult -= 1;
    return 'adult';
  }
  if (remaining.child_6_12 > 0) {
    remaining.child_6_12 -= 1;
    return 'child_6_12';
  }
  if (remaining.child_under_6 > 0) {
    remaining.child_under_6 -= 1;
    return 'child_under_6';
  }
  return 'adult';
}

function takeCategorySlot(requestedCat, remaining) {
  if (remaining[requestedCat] > 0) {
    remaining[requestedCat] -= 1;
    return requestedCat;
  }
  return allocateRemainingSlot(remaining);
}

// POST /api/bookings - Authoritative self-serve multi-guest booking checkout
router.post('/', async (req, res, next) => {
  const rawIdemKey = req.get('Idempotency-Key') || req.headers['idempotency-key'];
  const idempotencyKey = typeof rawIdemKey === 'string' && rawIdemKey.trim()
    ? rawIdemKey.trim().slice(0, 255)
    : null;

  const executeBooking = async () => {
    const body = req.body || {};
    const lead_name = typeof body.lead_name === 'string' ? body.lead_name.trim() : '';
    const lead_email = typeof body.lead_email === 'string' ? body.lead_email.trim().toLowerCase() : '';
    const lead_phone = typeof body.lead_phone === 'string' ? body.lead_phone.trim() : '';
    const lead_country = typeof body.lead_country === 'string' && body.lead_country.trim()
      ? body.lead_country.trim()
      : null;

    if (!lead_name || !lead_email || !lead_phone || !body.travel_date_start) {
      return {
        status: 400,
        payload: {
          success: false,
          error: 'Please provide full name, email, phone, and travel departure date.'
        }
      };
    }

    if (!EMAIL_RE.test(lead_email)) {
      return { status: 400, payload: { success: false, error: 'Please provide a valid email address.' } };
    }

    const startDateObj = parseUTCDate(body.travel_date_start);
    if (!startDateObj) {
      return { status: 400, payload: { success: false, error: 'Invalid travel_date_start date.' } };
    }
    const travelDateStart = startDateObj.toISOString().split('T')[0];

    // Parse guest counts strictly
    const rawC1 = body.children_6_12;
    const rawC2 = body.children_under_6;
    const c1 = rawC1 === undefined || rawC1 === null || rawC1 === '' ? 0 : parseStrictNonNegativeInt(rawC1);
    const c2 = rawC2 === undefined || rawC2 === null || rawC2 === '' ? 0 : parseStrictNonNegativeInt(rawC2);
    if (c1 === null || c2 === null) {
      return { status: 400, payload: { success: false, error: 'Invalid child traveler counts.' } };
    }

    const rawAdults = body.adults_count !== undefined ? body.adults_count : body.adults;
    let adults;
    if (rawAdults === undefined || rawAdults === null || rawAdults === '') {
      if (body.total_travelers !== undefined && body.total_travelers !== null && body.total_travelers !== '') {
        const totalReq = parseStrictPositiveInt(body.total_travelers);
        if (totalReq === null) {
          return { status: 400, payload: { success: false, error: 'Invalid total_travelers count.' } };
        }
        adults = totalReq - c1 - c2;
      } else {
        adults = 1;
      }
    } else {
      adults = parseStrictNonNegativeInt(rawAdults);
    }

    if (adults === null || adults < 1) {
      return { status: 400, payload: { success: false, error: 'At least 1 adult traveler is required.' } };
    }

    const totalTravelers = adults + c1 + c2;

    // Validate nationality_type & reject mixed-currency tampering
    let rawNationality;
    if (body.nationality_type !== undefined && body.nationality_type !== null && String(body.nationality_type).trim() !== '') {
      rawNationality = String(body.nationality_type).trim().toLowerCase();
      if (!VALID_NATIONALITIES.has(rawNationality)) {
        return {
          status: 400,
          payload: { success: false, error: 'Invalid nationality_type. Must be international or india.' }
        };
      }
    } else {
      rawNationality = (lead_country && lead_country.toLowerCase() === 'india') ? 'india' : 'international';
    }

    const isIndia = rawNationality === 'india' || rawNationality === 'regional_india' || rawNationality === 'regional';
    const canonicalNationalityType = isIndia ? 'india' : 'international';

    if (body.currency !== undefined && body.currency !== null && String(body.currency).trim() !== '') {
      const requestedCurrency = String(body.currency).trim().toUpperCase();
      if (!['USD', 'INR'].includes(requestedCurrency)) {
        return {
          status: 400,
          payload: { success: false, error: 'Unsupported currency. Only USD and INR are supported.' }
        };
      }
      if ((isIndia && requestedCurrency !== 'INR') || (!isIndia && requestedCurrency !== 'USD')) {
        return {
          status: 400,
          payload: {
            success: false,
            error: `Currency mismatch: ${canonicalNationalityType} bookings cannot use ${requestedCurrency}.`
          }
        };
      }
    }

    // Validate optional travelers[] roster before transaction
    let suppliedTravelers = null;
    if (body.travelers !== undefined && body.travelers !== null) {
      if (!Array.isArray(body.travelers)) {
        return { status: 400, payload: { success: false, error: 'travelers must be an array.' } };
      }
      if (body.travelers.length > totalTravelers) {
        return {
          status: 400,
          payload: {
            success: false,
            error: `Travelers list (${body.travelers.length}) exceeds total party size (${totalTravelers}).`
          }
        };
      }
      for (let idx = 0; idx < body.travelers.length; idx++) {
        const tr = body.travelers[idx];
        if (!tr || typeof tr !== 'object') {
          return { status: 400, payload: { success: false, error: `Invalid traveler entry at index ${idx}.` } };
        }
        const trName = typeof tr.full_name === 'string' ? tr.full_name.trim() : '';
        if (idx > 0 && !trName) {
          return { status: 400, payload: { success: false, error: `Traveler #${idx + 1} full_name is required.` } };
        }
        if (tr.age_category !== undefined && tr.age_category !== null && tr.age_category !== '' && !isValidAgeCategoryInput(tr.age_category)) {
          return { status: 400, payload: { success: false, error: `Invalid age_category for traveler #${idx + 1}.` } };
        }
      }
      suppliedTravelers = body.travelers;
    }

    // Resolve tour vs custom bespoke trip
    const tourRef = body.tour_id || body.tour_slug;
    const isExplicitTour = Boolean(
      tourRef &&
      String(tourRef).trim() !== '' &&
      !['custom', 'custom_trip'].includes(String(tourRef).trim().toLowerCase()) &&
      !body.is_custom_trip
    );

    let tour = null;
    if (isExplicitTour) {
      tour = await resolveTourByIdOrSlug(tourRef);
      if (!tour) {
        return { status: 404, payload: { success: false, error: 'Selected tour package not found.' } };
      }
    }

    let tripNights;
    if (tour) {
      tripNights = Number(tour.duration_nights) || 1;
    } else {
      const rawNights = body.nights !== undefined ? body.nights : body.total_nights;
      if (rawNights !== undefined && rawNights !== null && rawNights !== '') {
        tripNights = parseStrictPositiveInt(rawNights);
        if (tripNights === null || tripNights > 365) {
          return { status: 400, payload: { success: false, error: 'Trip nights must be between 1 and 365.' } };
        }
      } else {
        tripNights = 6;
      }
    }

    const travelDateEnd = addDaysUTCString(startDateObj, tripNights);
    const tourTitle = tour
      ? tour.title
      : (typeof body.tour_title === 'string' && body.tour_title.trim() ? body.tour_title.trim() : 'Custom Bespoke Bhutan Expedition');
    const hotelTier = typeof body.hotel_tier === 'string' && body.hotel_tier.trim()
      ? body.hotel_tier.trim()
      : '4-Star Premium';
    const resolvedLeadCountry = lead_country || (isIndia ? 'India' : 'International');
    const paymentPlan = String(body.payment_plan || '').trim().toLowerCase() === 'full_100'
      ? 'full_100'
      : 'deposit_30';
    const flightAssistance = (body.flight_assistance === true || body.flight_assistance === 1 || body.flight_assistance === '1') ? 1 : 0;

    // Load settings & compute authoritative quote (ignoring all client price/discount tampers)
    const settings = await loadSettingsMap();
    const agencyWhatsapp = settings.company_whatsapp || '+97517654321';
    const finalPaymentDueDays = parseStrictNonNegativeInt(settings.final_payment_due_days) ?? 30;
    const dueDateObj = new Date(Date.UTC(
      startDateObj.getUTCFullYear(),
      startDateObj.getUTCMonth(),
      startDateObj.getUTCDate() - finalPaymentDueDays
    ));
    const todayUtc = parseUTCDate(new Date());
    const balanceDueDate = (dueDateObj < todayUtc ? todayUtc : dueDateObj).toISOString().split('T')[0];

    const quote = await calculatePricingQuote({
      tour,
      nights: tripNights,
      adults,
      children_6_12: c1,
      children_under_6: c2,
      nationality_type: canonicalNationalityType,
      hotel_tier: hotelTier,
      extras_usd: 0,
      discount_usd: 0,
      is_sdf_waived: false
    });

    const basePriceUsdInt = Math.round(quote.package_total_usd);
    const sdfTotalUsdInt = Math.round(quote.total_sdf_usd);
    const visaFeeUsdInt = Math.round(quote.visa_fee_usd);
    const totalPriceUsdInt = Math.round(quote.total_price_usd);

    const adultSdfUsdInt = Math.round(quote.breakdown.adults.sdf_rate_per_night / quote.exchange_rate);
    const childSdfUsdInt = Math.round(quote.breakdown.children_6_12.sdf_rate_per_night / quote.exchange_rate);
    const sdfRateForCategory = (cat) => {
      if (cat === 'adult') return adultSdfUsdInt;
      if (cat === 'child_6_12') return childSdfUsdInt;
      return 0;
    };

    const txResult = await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const existingIdem = await tx.get(
          "SELECT entity_id, new_value FROM audit_log WHERE entity_type = 'idempotency' AND action = 'create_booking' AND old_value = ? ORDER BY id DESC LIMIT 1",
          [idempotencyKey]
        );
        if (existingIdem && existingIdem.entity_id) {
          const existingBooking = await tx.get('SELECT * FROM bookings WHERE id = ?', [existingIdem.entity_id]);
          if (existingBooking) {
            const existingTravelers = await tx.query(
              'SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC',
              [existingBooking.id]
            );
            return {
              isDuplicate: true,
              bookingRow: existingBooking,
              travelersRows: existingTravelers
            };
          }
        }
      }

      const bookingId = await generateUniqueBookingId(tx);

      await tx.run(
        `INSERT INTO bookings (
          id, tour_id, tour_title, is_custom_trip,
          lead_name, lead_email, lead_phone, lead_country, lead_passport_no, lead_passport_expiry,
          travel_date_start, travel_date_end, total_nights, total_travelers,
          adults_count, children_6_12, children_under_6, hotel_tier,
          base_price_usd, sdf_total_usd, visa_fee_usd, extras_usd, discount_usd, total_price_usd,
          currency, nationality_type, exchange_rate, payment_plan, balance_due_date,
          deposit_paid_usd, full_paid, flight_assistance,
          booking_status, visa_status, custom_itinerary_json, special_requests, source
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, 0, 0, ?,
          ?, ?, ?, ?, ?,
          0, 0, ?,
          'inquiry', 'not_started', ?, ?, ?
        )`,
        [
          bookingId,
          tour ? tour.id : null,
          tourTitle,
          tour ? 0 : 1,
          lead_name,
          lead_email,
          lead_phone,
          resolvedLeadCountry,
          body.lead_passport_no ? String(body.lead_passport_no).trim() : null,
          body.lead_passport_expiry ? String(body.lead_passport_expiry).trim() : null,
          travelDateStart,
          travelDateEnd,
          tripNights,
          totalTravelers,
          adults,
          c1,
          c2,
          hotelTier,
          basePriceUsdInt,
          sdfTotalUsdInt,
          visaFeeUsdInt,
          totalPriceUsdInt,
          quote.currency,
          quote.nationality_type,
          quote.exchange_rate,
          paymentPlan,
          balanceDueDate,
          flightAssistance,
          body.custom_itinerary_json ? (typeof body.custom_itinerary_json === 'string' ? body.custom_itinerary_json : JSON.stringify(body.custom_itinerary_json)) : null,
          body.special_requests ? String(body.special_requests).trim() : null,
          body.source ? String(body.source).trim() : 'website'
        ]
      );

      const remaining = { adult: adults, child_6_12: c1, child_under_6: c2 };
      let insertedCount = 0;

      const insertTravelerSql = `
        INSERT INTO travelers (
          booking_id, full_name, passport_number, passport_expiry, nationality, date_of_birth,
          age_category, gender, dietary_needs, medical_notes,
          emergency_contact_name, emergency_contact_phone, sdf_rate_usd, visa_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `;

      if (suppliedTravelers && suppliedTravelers.length > 0) {
        for (let idx = 0; idx < suppliedTravelers.length; idx++) {
          const tr = suppliedTravelers[idx];
          const requestedCat = normalizeAgeCategory(tr.age_category, idx === 0 ? 'adult' : 'adult');
          const assignedCat = takeCategorySlot(requestedCat, remaining);
          const trName = (typeof tr.full_name === 'string' && tr.full_name.trim())
            ? tr.full_name.trim()
            : lead_name;

          await tx.run(insertTravelerSql, [
            bookingId,
            trName,
            tr.passport_number ? String(tr.passport_number).trim() : (idx === 0 && body.lead_passport_no ? String(body.lead_passport_no).trim() : null),
            tr.passport_expiry ? String(tr.passport_expiry).trim() : (idx === 0 && body.lead_passport_expiry ? String(body.lead_passport_expiry).trim() : null),
            tr.nationality ? String(tr.nationality).trim() : resolvedLeadCountry,
            tr.date_of_birth ? String(tr.date_of_birth).trim() : null,
            assignedCat,
            tr.gender ? String(tr.gender).trim() : null,
            tr.dietary_needs ? String(tr.dietary_needs).trim() : null,
            tr.medical_notes ? String(tr.medical_notes).trim() : null,
            tr.emergency_contact_name ? String(tr.emergency_contact_name).trim() : null,
            tr.emergency_contact_phone ? String(tr.emergency_contact_phone).trim() : null,
            sdfRateForCategory(assignedCat)
          ]);
          insertedCount += 1;
        }
      } else {
        // Insert lead traveler first
        const leadCat = takeCategorySlot('adult', remaining);
        await tx.run(insertTravelerSql, [
          bookingId,
          lead_name,
          body.lead_passport_no ? String(body.lead_passport_no).trim() : null,
          body.lead_passport_expiry ? String(body.lead_passport_expiry).trim() : null,
          resolvedLeadCountry,
          null,
          leadCat,
          null,
          null,
          null,
          null,
          null,
          sdfRateForCategory(leadCat)
        ]);
        insertedCount += 1;
      }

      // Auto-generate placeholder companion rows until DB traveler count === totalTravelers
      while (insertedCount < totalTravelers) {
        const nextCat = allocateRemainingSlot(remaining);
        const guestNum = insertedCount + 1;
        await tx.run(insertTravelerSql, [
          bookingId,
          `Guest ${guestNum} (${nextCat})`,
          null,
          null,
          resolvedLeadCountry,
          null,
          nextCat,
          null,
          null,
          null,
          null,
          null,
          sdfRateForCategory(nextCat)
        ]);
        insertedCount += 1;
      }

      await tx.run(
        `INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
         VALUES (?, 'client', 'booking.created', 'booking', ?, ?)`,
        [
          lead_name,
          bookingId,
          JSON.stringify({
            tour: tourTitle,
            currency: quote.currency,
            total_local: quote.total_price_local,
            total_usd: totalPriceUsdInt,
            travelers: totalTravelers
          })
        ]
      );

      if (idempotencyKey) {
        await tx.run(
          `INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
           VALUES (?, 'client', 'create_booking', 'idempotency', ?, ?, ?)`,
          [
            lead_name,
            bookingId,
            idempotencyKey,
            JSON.stringify({ key: idempotencyKey, booking_id: bookingId })
          ]
        );
      }

      const bookingRow = await tx.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const travelersRows = await tx.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [bookingId]);

      return {
        isDuplicate: false,
        bookingRow,
        travelersRows
      };
    });

    if (txResult.isDuplicate) {
      const origTour = txResult.bookingRow.tour_id
        ? await db.get('SELECT * FROM tours WHERE id = ?', [txResult.bookingRow.tour_id])
        : null;
      const origQuote = await calculatePricingQuote({
        tour: origTour,
        nights: txResult.bookingRow.total_nights,
        adults: txResult.bookingRow.adults_count,
        children_6_12: txResult.bookingRow.children_6_12,
        children_under_6: txResult.bookingRow.children_under_6,
        nationality_type: txResult.bookingRow.nationality_type,
        hotel_tier: txResult.bookingRow.hotel_tier
      });

      return {
        status: 200,
        payload: buildBookingResponse({
          bookingRow: txResult.bookingRow,
          travelersRows: txResult.travelersRows,
          quote: origQuote,
          agencyWhatsapp
        })
      };
    }

    const bookingForNotif = {
      ...txResult.bookingRow,
      package_total_local: quote.package_total_local,
      total_sdf_local: quote.total_sdf_local,
      visa_fee_local: quote.visa_fee_local,
      total_price_local: quote.total_price_local
    };

    const clientNotif = await dispatchNotification('booking_new', {
      booking: bookingForNotif,
      recipient_type: 'client',
      recipient_phone: lead_phone,
      recipient_email: lead_email
    });

    await dispatchNotification('booking_new', {
      booking: bookingForNotif,
      recipient_type: 'admin',
      recipient: 'admin',
      channel: 'in_app',
      subject: 'New Tour Booking',
      message: `${lead_name} reserved "${tourTitle}" (${totalTravelers} travelers, ${quote.currency} ${quote.total_price_local.toLocaleString('en-US')})`,
      action_url: `admin/booking-detail.html?id=${txResult.bookingRow.id}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    return {
      status: 201,
      payload: buildBookingResponse({
        bookingRow: txResult.bookingRow,
        travelersRows: txResult.travelersRows,
        quote,
        agencyWhatsapp,
        notificationId: clientNotif && clientNotif.id
      })
    };
  };

  try {
    if (idempotencyKey) {
      if (inFlightIdempotency.has(idempotencyKey)) {
        const result = await inFlightIdempotency.get(idempotencyKey);
        return res.status(result.status).json(result.payload);
      }
      const pending = executeBooking();
      inFlightIdempotency.set(idempotencyKey, pending);
      try {
        const result = await pending;
        return res.status(result.status).json(result.payload);
      } finally {
        inFlightIdempotency.delete(idempotencyKey);
      }
    }

    const result = await executeBooking();
    return res.status(result.status).json(result.payload);
  } catch (err) {
    return next(err);
  }
});

// GET /api/bookings/track/:ref - Masked status preview or email-verified summary
router.get('/track/:ref', async (req, res, next) => {
  try {
    const ref = String(req.params.ref || '').trim();
    if (!ref) {
      return res.status(400).json({ success: false, error: 'Booking reference is required.' });
    }

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [ref]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking reference not found.' });
    }

    const emailQuery = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const emailVerified = Boolean(
      emailQuery && emailQuery === String(booking.lead_email || '').trim().toLowerCase()
    );

    if (!emailVerified) {
      return res.json({
        success: true,
        masked: true,
        email_verified: false,
        booking: {
          id: booking.id,
          ref: booking.id,
          tour_title: booking.tour_title,
          travel_date_start: booking.travel_date_start,
          travel_date_end: booking.travel_date_end,
          travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end}`,
          total_nights: booking.total_nights,
          total_travelers: booking.total_travelers,
          booking_status: booking.booking_status,
          visa_status: booking.visa_status
        }
      });
    }

    const [travelers, insSetting] = await Promise.all([
      db.query(
        'SELECT id, full_name, nationality, age_category, visa_status, passport_number, passport_expiry, passport_scan, photo_url, insurance_doc FROM travelers WHERE booking_id = ? ORDER BY id ASC',
        [booking.id]
      ),
      db.get("SELECT value FROM settings WHERE key = 'require_insurance_for_visa'")
    ]);

    const requireInsurance = insSetting ? (insSetting.value === '1' || insSetting.value === 'true') : false;

    let readyCount = 0;
    const safeTravelers = travelers.map((tr) => {
      const readiness = checkDocumentReadiness(
        tr,
        booking.travel_date_end,
        booking.nationality_type || 'international',
        requireInsurance
      );
      if (readiness.ready) readyCount += 1;

      return {
        id: tr.id,
        full_name: tr.full_name,
        nationality: tr.nationality,
        age_category: tr.age_category,
        visa_status: tr.visa_status,
        has_passport_number: Boolean(tr.passport_number),
        has_passport_scan: Boolean(tr.passport_scan),
        has_photo: Boolean(tr.photo_url),
        has_insurance: Boolean(tr.insurance_doc),
        doc_ready: readiness.ready,
        doc_missing: readiness.missing,
        doc_errors: readiness.errors
      };
    });

    let guideInfo = null;
    if (booking.assigned_guide_id) {
      const guide = await db.get(
        'SELECT full_name, phone, license_no FROM users WHERE id = ?',
        [booking.assigned_guide_id]
      );
      if (guide) {
        guideInfo = {
          name: guide.full_name,
          phone: guide.phone,
          license_no: guide.license_no || null,
          vehicle: booking.assigned_vehicle || null
        };
      }
    }

    let clearanceNotice = null;
    if (booking.visa_status === 'clearance_letter_issued' || booking.visa_status === 'approved') {
      clearanceNotice = generateClearanceNotice(booking, safeTravelers);
      delete clearanceNotice.passport_number;
    }

    return res.json({
      success: true,
      masked: false,
      email_verified: true,
      booking: {
        id: booking.id,
        ref: booking.id,
        tour_title: booking.tour_title,
        lead_name: booking.lead_name,
        travel_date_start: booking.travel_date_start,
        travel_date_end: booking.travel_date_end,
        travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end}`,
        total_nights: booking.total_nights,
        total_travelers: booking.total_travelers,
        hotel_tier: booking.hotel_tier,
        currency: booking.currency || 'USD',
        nationality_type: booking.nationality_type || 'international',
        exchange_rate: booking.exchange_rate || 1,
        booking_status: booking.booking_status,
        visa_status: booking.visa_status,
        visa_clearance_number: booking.visa_clearance_number,
        payment_status: booking.full_paid ? 'Fully Paid' : (booking.deposit_paid_usd > 0 ? 'Deposit Paid' : 'Pending Payment'),
        total_price_usd: booking.total_price_usd,
        deposit_paid_usd: booking.deposit_paid_usd,
        balance_due_usd: Math.max(0, (Number(booking.total_price_usd) || 0) - (Number(booking.deposit_paid_usd) || 0)),
        doc_readiness: {
          total: safeTravelers.length,
          ready_count: readyCount,
          incomplete_count: safeTravelers.length - readyCount,
          all_ready: safeTravelers.length > 0 && readyCount === safeTravelers.length
        },
        guide: guideInfo,
        travelers: safeTravelers,
        clearance_notice: clearanceNotice,
        invoice_view_url: `/api/bookings/${encodeURIComponent(booking.id)}/invoice-view`,
        clearance_view_url: `/api/bookings/${encodeURIComponent(booking.id)}/clearance-view`
      }
    });
  } catch (err) {
    return next(err);
  }
});

function authorizeDocumentView(req, res) {
  const token = extractToken(req, { allowQueryToken: true });
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return null;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
    return null;
  }

  if (user.role === 'guide') {
    res.status(403).json({ success: false, error: 'Forbidden: guide accounts cannot access booking financial or clearance views' });
    return null;
  }

  if (STAFF_ROLES.has(user.role)) {
    return user;
  }

  if (user.role === 'client') {
    const tokenBookingRef = String(user.bookingId || user.bookingDbId || '').trim();
    const targetBookingRef = String(req.params.id || '').trim();
    if (!tokenBookingRef || tokenBookingRef.toLowerCase() !== targetBookingRef.toLowerCase()) {
      res.status(403).json({ success: false, error: 'Forbidden: booking access mismatch' });
      return null;
    }
    return user;
  }

  res.status(403).json({ success: false, error: 'Forbidden: insufficient permissions' });
  return null;
}

async function enrichInrInvoiceBooking(booking, settings) {
  const isIndia = String(booking.nationality_type || '').toLowerCase() === 'india'
    || String(booking.nationality_type || '').toLowerCase() === 'regional_india'
    || String(booking.currency || '').toUpperCase() === 'INR';

  if (!isIndia) return booking;

  const rate = Number(booking.exchange_rate || settings.usd_to_inr_rate || 85) || 85;
  const packageLocal = Math.round(Number(booking.base_price_usd || 0) * rate);
  const extrasLocal = Math.round(Number(booking.extras_usd || 0) * rate);
  const discountLocal = Math.round(Number(booking.discount_usd || 0) * rate);

  let sdfLocal = Math.round(Number(booking.sdf_total_usd || 0) * rate);
  if (Number(booking.sdf_total_usd) === 0) {
    sdfLocal = 0;
  } else {
    const sdf = await calculateSDF({
      nights: booking.total_nights,
      adults: booking.adults_count,
      children_6_12: booking.children_6_12,
      children_under_6: booking.children_under_6,
      nationality_type: 'india'
    });
    if (Math.round(sdf.total_sdf_local / rate) === Number(booking.sdf_total_usd)) {
      sdfLocal = sdf.total_sdf_local;
    }
  }

  const totalLocal = Math.max(0, packageLocal + sdfLocal + extrasLocal - discountLocal);
  return {
    ...booking,
    package_total_local: packageLocal,
    total_sdf_local: sdfLocal,
    extras_local: extrasLocal,
    discount_local: discountLocal,
    total_price_local: totalLocal
  };
}

// GET /api/bookings/:id/invoice-view - Printable official tax invoice & ledger HTML
router.get('/:id/invoice-view', async (req, res, next) => {
  try {
    const user = authorizeDocumentView(req, res);
    if (!user) return;

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [travelers, payments, settings] = await Promise.all([
      db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      loadSettingsMap()
    ]);

    const displayBooking = await enrichInrInvoiceBooking(booking, settings);
    const html = renderInvoiceHtml(displayBooking, travelers, payments, settings);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
});

// GET /api/bookings/:id/clearance-view - Printable DoI Visa / Entry Permit Clearance Letter HTML
router.get('/:id/clearance-view', async (req, res, next) => {
  try {
    const user = authorizeDocumentView(req, res);
    if (!user) return;

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const isApproved = booking.visa_status === 'approved' || booking.visa_status === 'clearance_letter_issued';
    if (user.role === 'client' && !isApproved) {
      const acceptHeader = String(req.headers.accept || '');
      if (acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
        return res
          .status(403)
          .type('text/html')
          .send('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Visa Clearance Pending</h2><p>Your official Bhutan Visa Clearance Letter will become available here once approved by the Department of Immigration.</p></body></html>');
      }
      return res.status(403).json({
        success: false,
        error: 'Visa clearance letter is only available once visa_status is approved.'
      });
    }

    const [travelers, settings] = await Promise.all([
      db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      loadSettingsMap()
    ]);

    const html = renderClearanceLetterHtml(booking, travelers, settings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
