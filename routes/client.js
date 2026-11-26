const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const router = express.Router();
const db = require('../database/db');
const { signToken, requireClient } = require('../middleware/auth');
const {
  UPLOAD_ROOT,
  uploadTravelerDocs,
  uploadPaymentReceipt,
  toRelativeUploadPath
} = require('../middleware/upload');
const { parseUTCDate, checkDocumentReadiness } = require('../services/visa-workflow');
const { calculateSDF } = require('../services/sdf-engine');
const { dispatchNotification } = require('../services/notification-service');
const { renderInvoiceHtml, renderClearanceLetterHtml } = require('../services/document-templates');

const ALLOWED_DOC_FIELDS = new Set(['passport_scan', 'photo_url', 'insurance_doc']);
const ADVANCED_VISA_STAGES = new Set([
  'documents_complete',
  'payment_verified',
  'submitted_to_doi',
  'under_review',
  'approved',
  'clearance_letter_issued'
]);

function parsePositiveId(rawId) {
  const str = String(rawId || '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function normalizeOptionalText(value, maxLen = 500) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

function normalizeOptionalDate(rawValue, fieldName) {
  if (rawValue === undefined || rawValue === null) {
    return { ok: true, provided: false, value: null };
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === '') {
    return { ok: true, provided: true, value: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: `Invalid ${fieldName} date format. Expected YYYY-MM-DD.` };
  }
  const parsed = parseUTCDate(trimmed);
  if (!parsed || parsed.toISOString().split('T')[0] !== trimmed) {
    return { ok: false, error: `Invalid ${fieldName} calendar date.` };
  }
  return { ok: true, provided: true, value: trimmed };
}

function parseJsonArraySafe(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function collectUploadedFiles(req) {
  const collected = [];
  if (req.file && req.file.path) {
    collected.push(req.file);
  }
  if (req.files && typeof req.files === 'object') {
    for (const value of Object.values(req.files)) {
      if (Array.isArray(value)) {
        for (const f of value) {
          if (f && f.path) collected.push(f);
        }
      }
    }
  }
  return collected;
}

function cleanupUploadedFiles(req) {
  for (const file of collectUploadedFiles(req)) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // Best-effort orphan cleanup
    }
  }
}

function failWithCleanup(req, res, status, payload) {
  cleanupUploadedFiles(req);
  return res.status(status).json(payload);
}

function runMultipartUpload(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        cleanupUploadedFiles(req);
        return next(err);
      }
      return next();
    });
  };
}

function extractEmergencyContactFields(body, existing = {}) {
  let name = body.emergency_contact_name !== undefined
    ? normalizeOptionalText(body.emergency_contact_name, 255)
    : (existing.emergency_contact_name || null);
  let phone = body.emergency_contact_phone !== undefined
    ? normalizeOptionalText(body.emergency_contact_phone, 50)
    : (existing.emergency_contact_phone || null);

  if (body.emergency_contact !== undefined && body.emergency_contact !== null) {
    if (typeof body.emergency_contact === 'object') {
      if (body.emergency_contact.name !== undefined) {
        name = normalizeOptionalText(body.emergency_contact.name, 255);
      }
      if (body.emergency_contact.phone !== undefined) {
        phone = normalizeOptionalText(body.emergency_contact.phone, 50);
      }
    } else {
      const text = normalizeOptionalText(body.emergency_contact, 255);
      if (text) {
        if (body.emergency_contact_name === undefined) name = text;
        if (body.emergency_contact_phone === undefined && /\d{5,}/.test(text)) {
          phone = text.slice(0, 50);
        }
      } else {
        if (body.emergency_contact_name === undefined) name = null;
        if (body.emergency_contact_phone === undefined) phone = null;
      }
    }
  }

  return { name, phone };
}

async function loadSettingsMap() {
  const rows = await db.query('SELECT key, value FROM settings');
  const map = {};
  for (const row of rows || []) {
    map[row.key] = row.value;
  }
  return map;
}

function extractBankWire(settings = {}) {
  return {
    bank_beneficiary: settings.bank_beneficiary || 'Bhutan Fast Rate Tours Ltd.',
    bank_name: settings.bank_name || 'Bank of Bhutan Ltd.',
    bank_swift: settings.bank_swift || 'BOBTBT22XXX',
    bank_account: settings.bank_account || '200884910023',
    bank_instructions: settings.bank_instructions || 'Include Booking Reference in wire memo'
  };
}

function sanitizeBookingForClient(booking) {
  if (!booking) return null;
  const { internal_notes: _omit, ...safe } = booking;
  return {
    ...safe,
    travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end} (${booking.total_nights} Nights)`,
    balance_due_usd: Math.max(0, (Number(booking.total_price_usd) || 0) - (Number(booking.deposit_paid_usd) || 0)),
    payment_status: Number(booking.full_paid) === 1
      ? 'Paid in Full'
      : (Number(booking.deposit_paid_usd) > 0 ? 'Deposit Paid' : 'Pending Payment')
  };
}

async function loadGuideProfileForBooking(booking) {
  const assignment = await db.get(
    'SELECT guide_id, vehicle_plate, driver_name, start_date, end_date, status FROM guide_assignments WHERE booking_id = ? ORDER BY id DESC LIMIT 1',
    [booking.id]
  );
  const guideId = booking.assigned_guide_id || (assignment && assignment.guide_id);
  if (!guideId) return null;

  const guide = await db.get(
    'SELECT id, full_name, phone, license_no, languages, specialty FROM users WHERE id = ? AND role = ? AND is_active = 1',
    [guideId, 'guide']
  );
  if (!guide) return null;

  return {
    id: guide.id,
    name: guide.full_name,
    full_name: guide.full_name,
    phone: guide.phone,
    license_no: guide.license_no || null,
    languages: guide.languages || null,
    specialty: guide.specialty || null,
    vehicle: booking.assigned_vehicle || (assignment && assignment.vehicle_plate) || null,
    driver_name: (assignment && assignment.driver_name) || null
  };
}

function doesNotificationBelongToBooking(notif, booking) {
  if (!notif || notif.recipient_type !== 'client') return false;
  if (notif.metadata_json) {
    try {
      const meta = JSON.parse(notif.metadata_json);
      if (meta && meta.booking_id) {
        return String(meta.booking_id).toLowerCase() === String(booking.id).toLowerCase();
      }
    } catch {
      // Fallback to pattern checks below
    }
  }
  if (notif.action_url && String(notif.action_url).toLowerCase().includes(String(booking.id).toLowerCase())) {
    return true;
  }
  return Boolean(
    notif.recipient_id &&
    booking.lead_email &&
    String(notif.recipient_id).trim().toLowerCase() === String(booking.lead_email).trim().toLowerCase()
  );
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

// POST /api/client/auth - Authenticate client via booking_ref + email
router.post('/auth', async (req, res, next) => {
  try {
    const body = req.body || {};
    const bookingRef = String(body.booking_ref || body.ref || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!bookingRef || !email) {
      return res.status(400).json({ success: false, error: 'Booking reference and email are required.' });
    }

    const booking = await db.get(
      'SELECT * FROM bookings WHERE LOWER(id) = LOWER(?) AND LOWER(lead_email) = LOWER(?)',
      [bookingRef, email]
    );
    if (!booking) {
      return res.status(401).json({
        success: false,
        error: 'No matching booking found for this reference and email address.'
      });
    }

    const token = signToken({
      role: 'client',
      bookingId: booking.id,
      bookingDbId: booking.id,
      email: booking.lead_email
    });

    return res.json({
      success: true,
      token,
      booking_id: booking.id,
      booking: {
        id: booking.id,
        tour_title: booking.tour_title,
        lead_name: booking.lead_name,
        lead_email: booking.lead_email,
        travel_date_start: booking.travel_date_start,
        travel_date_end: booking.travel_date_end,
        total_nights: booking.total_nights,
        total_travelers: booking.total_travelers,
        booking_status: booking.booking_status,
        visa_status: booking.visa_status,
        currency: booking.currency || 'USD'
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/client/booking - Authenticated client portal dashboard summary
router.get('/booking', requireClient(), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [travelers, payments, settings, guide] = await Promise.all([
      db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC, id DESC', [booking.id]),
      loadSettingsMap(),
      loadGuideProfileForBooking(booking)
    ]);

    const requireInsurance = settings.require_insurance_for_visa === '1' || settings.require_insurance_for_visa === 'true';
    let readyCount = 0;

    const enrichedTravelers = travelers.map((tr) => {
      const readiness = checkDocumentReadiness(
        tr,
        booking.travel_date_end,
        booking.nationality_type || 'international',
        requireInsurance
      );
      if (readiness.ready) readyCount += 1;

      return {
        ...tr,
        doc_readiness: readiness,
        doc_ready: readiness.ready,
        doc_missing: readiness.missing,
        doc_errors: readiness.errors,
        passport_scan_url: tr.passport_scan ? `/api/client/documents/${tr.id}/passport_scan` : null,
        photo_url_link: tr.photo_url ? `/api/client/documents/${tr.id}/photo_url` : null,
        insurance_doc_url: tr.insurance_doc ? `/api/client/documents/${tr.id}/insurance_doc` : null
      };
    });

    const safeBooking = sanitizeBookingForClient(booking);
    const pendingPayments = payments.filter((p) => p.status === 'pending');
    const verifiedPayments = payments.filter((p) => p.status === 'verified');

    const paymentSummary = {
      currency: booking.currency || 'USD',
      exchange_rate: Number(booking.exchange_rate || settings.usd_to_inr_rate || 1),
      payment_plan: booking.payment_plan || 'deposit_30',
      balance_due_date: booking.balance_due_date || null,
      total_price_usd: Number(booking.total_price_usd || 0),
      deposit_paid_usd: Number(booking.deposit_paid_usd || 0),
      balance_due_usd: safeBooking.balance_due_usd,
      full_paid: Number(booking.full_paid) === 1 ? 1 : 0,
      payment_status: safeBooking.payment_status,
      pending_payments_count: pendingPayments.length,
      verified_payments_count: verifiedPayments.length
    };

    return res.json({
      success: true,
      booking: {
        ...safeBooking,
        guide,
        travelers: enrichedTravelers
      },
      travelers: enrichedTravelers,
      doc_readiness: {
        total: enrichedTravelers.length,
        ready_count: readyCount,
        incomplete_count: enrichedTravelers.length - readyCount,
        all_ready: enrichedTravelers.length > 0 && readyCount === enrichedTravelers.length
      },
      payment_summary: paymentSummary,
      bank_wire: extractBankWire(settings),
      guide
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/client/itinerary - Parsed tour itinerary & field contacts
router.get('/itinerary', requireClient(), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [tour, settings, guide] = await Promise.all([
      booking.tour_id ? db.get('SELECT * FROM tours WHERE id = ?', [booking.tour_id]) : null,
      loadSettingsMap(),
      loadGuideProfileForBooking(booking)
    ]);

    const customItinerary = parseJsonArraySafe(booking.custom_itinerary_json);
    const itinerary = customItinerary.length > 0
      ? customItinerary
      : (tour ? parseJsonArraySafe(tour.itinerary_json) : []);

    return res.json({
      success: true,
      booking_id: booking.id,
      tour_title: booking.tour_title,
      travel_date_start: booking.travel_date_start,
      travel_date_end: booking.travel_date_end,
      total_nights: booking.total_nights,
      hotel_tier: booking.hotel_tier,
      valleys: tour ? tour.valleys : null,
      itinerary,
      inclusions: tour ? parseJsonArraySafe(tour.inclusions_json) : [],
      exclusions: tour ? parseJsonArraySafe(tour.exclusions_json) : [],
      guide,
      emergency_contacts: {
        company_name: settings.company_name || 'Bhutan Fast Rate Tours',
        company_phone: settings.company_phone || '+975 17 654 321',
        company_whatsapp: settings.company_whatsapp || '+97517654321',
        company_email: settings.company_email || 'reservations@bhutanfastratetours.bt',
        company_license: settings.company_license || 'TR/2018/9882'
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/client/payments - Payment ledger & wire details
router.get('/payments', requireClient(), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [payments, settings] = await Promise.all([
      db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC, id DESC', [booking.id]),
      loadSettingsMap()
    ]);

    return res.json({
      success: true,
      booking_id: booking.id,
      summary: {
        currency: booking.currency || 'USD',
        total_price_usd: Number(booking.total_price_usd || 0),
        deposit_paid_usd: Number(booking.deposit_paid_usd || 0),
        balance_due_usd: Math.max(0, (Number(booking.total_price_usd) || 0) - (Number(booking.deposit_paid_usd) || 0)),
        full_paid: Number(booking.full_paid) === 1 ? 1 : 0,
        payment_plan: booking.payment_plan || 'deposit_30',
        balance_due_date: booking.balance_due_date || null
      },
      bank_wire: extractBankWire(settings),
      data: payments
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/client/notifications - Client notifications scoped to booking
router.get('/notifications', requireClient(), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT id, lead_email FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const candidates = await db.query(
      `SELECT * FROM notifications
       WHERE recipient_type = 'client'
         AND (
           LOWER(COALESCE(recipient_id, '')) = LOWER(?)
           OR COALESCE(metadata_json, '') LIKE ?
           OR COALESCE(action_url, '') LIKE ?
         )
       ORDER BY id DESC LIMIT 100`,
      [booking.lead_email || '', `%${booking.id}%`, `%${booking.id}%`]
    );

    const rows = candidates.filter((n) => doesNotificationBelongToBooking(n, booking));
    const unreadCount = rows.filter((n) => Number(n.is_read) === 0).length;

    return res.json({
      success: true,
      count: rows.length,
      unread_count: unreadCount,
      data: rows
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/client/notifications/:id/read - Mark client notification read
router.patch('/notifications/:id/read', requireClient(), async (req, res, next) => {
  try {
    const notifId = parsePositiveId(req.params.id);
    if (!notifId) {
      return res.status(400).json({ success: false, error: 'Invalid notification ID' });
    }

    const [booking, notif] = await Promise.all([
      db.get('SELECT id, lead_email FROM bookings WHERE id = ?', [req.clientBookingId]),
      db.get('SELECT * FROM notifications WHERE id = ?', [notifId])
    ]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    if (!doesNotificationBelongToBooking(notif, booking)) {
      return res.status(403).json({ success: false, error: 'Forbidden: notification does not belong to your booking' });
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
    const updated = await db.get('SELECT * FROM notifications WHERE id = ?', [notifId]);

    return res.json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/client/travelers - Fill unfilled companion slot or request add-on companion
router.post('/travelers', requireClient(), async (req, res, next) => {
  try {
    const body = req.body || {};
    const fullName = normalizeOptionalText(body.full_name, 255);
    if (!fullName) {
      return res.status(400).json({ success: false, error: 'Traveler full_name is required.' });
    }

    const expiryCheck = normalizeOptionalDate(body.passport_expiry, 'passport_expiry');
    if (!expiryCheck.ok) {
      return res.status(400).json({ success: false, error: expiryCheck.error });
    }
    const dobCheck = normalizeOptionalDate(body.date_of_birth, 'date_of_birth');
    if (!dobCheck.ok) {
      return res.status(400).json({ success: false, error: dobCheck.error });
    }

    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const existingTravelers = await db.query(
      'SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC',
      [booking.id]
    );

    const nationality = normalizeOptionalText(body.nationality, 100) || booking.lead_country || 'International';
    const passportNo = normalizeOptionalText(body.passport_number ?? body.national_id, 50);
    const dietary = normalizeOptionalText(body.dietary_needs ?? body.dietary_notes, 500);
    const medical = normalizeOptionalText(body.medical_notes, 500);
    const gender = normalizeOptionalText(body.gender, 20);
    const emergency = extractEmergencyContactFields(body);

    const placeholder = existingTravelers.find((t) => /^Guest\s+\d+/i.test(String(t.full_name || '').trim()));

    if (existingTravelers.length < Number(booking.total_travelers || 1)) {
      const ageCat = normalizeOptionalText(body.age_category, 50) || 'adult';
      const insertRes = await db.run(
        `INSERT INTO travelers (
          booking_id, full_name, passport_number, passport_expiry, nationality, date_of_birth,
          age_category, gender, dietary_needs, medical_notes,
          emergency_contact_name, emergency_contact_phone, visa_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          booking.id,
          fullName,
          passportNo,
          expiryCheck.value,
          nationality,
          dobCheck.value,
          ageCat,
          gender,
          dietary,
          medical,
          emergency.name,
          emergency.phone
        ]
      );
      const created = await db.get('SELECT * FROM travelers WHERE id = ?', [insertRes.lastInsertRowid]);
      return res.status(201).json({
        success: true,
        mode: 'slot_filled',
        message: 'Companion traveler added to your booking slot.',
        traveler: created
      });
    }

    if (placeholder) {
      await db.run(
        `UPDATE travelers
         SET full_name = ?,
             nationality = ?,
             passport_number = COALESCE(?, passport_number),
             passport_expiry = COALESCE(?, passport_expiry),
             date_of_birth = COALESCE(?, date_of_birth),
             gender = COALESCE(?, gender),
             dietary_needs = COALESCE(?, dietary_needs),
             medical_notes = COALESCE(?, medical_notes),
             emergency_contact_name = COALESCE(?, emergency_contact_name),
             emergency_contact_phone = COALESCE(?, emergency_contact_phone)
         WHERE id = ? AND booking_id = ?`,
        [
          fullName,
          nationality,
          passportNo,
          expiryCheck.value,
          dobCheck.value,
          gender,
          dietary,
          medical,
          emergency.name,
          emergency.phone,
          placeholder.id,
          booking.id
        ]
      );
      const updated = await db.get('SELECT * FROM travelers WHERE id = ?', [placeholder.id]);
      return res.json({
        success: true,
        mode: 'slot_filled',
        message: 'Companion traveler slot updated.',
        traveler: updated
      });
    }

    await dispatchNotification('companion_addon_request', {
      booking,
      booking_id: booking.id,
      recipient_type: 'admin',
      recipient: 'admin',
      channel: 'in_app',
      subject: `Add-On Traveler Request — ${booking.id}`,
      message: `${booking.lead_name} requested adding companion "${fullName}" (${nationality}) to ${booking.id} (current party size: ${booking.total_travelers}).`,
      action_url: `admin/booking-detail.html?id=${encodeURIComponent(booking.id)}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    return res.status(202).json({
      success: true,
      mode: 'addon_requested',
      message: 'All booked traveler slots are already filled. Our concierge has been notified of your add-on traveler request.'
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/client/travelers/:id/documents - Multipart doc upload + readiness check + visa auto-advance
router.post(
  '/travelers/:id/documents',
  requireClient(),
  runMultipartUpload(uploadTravelerDocs),
  async (req, res, next) => {
    try {
      const travelerId = parsePositiveId(req.params.id);
      if (!travelerId) {
        return failWithCleanup(req, res, 400, { success: false, error: 'Invalid traveler ID' });
      }

      const traveler = await db.get('SELECT * FROM travelers WHERE id = ?', [travelerId]);
      if (!traveler) {
        return failWithCleanup(req, res, 404, { success: false, error: 'Traveler not found' });
      }
      if (String(traveler.booking_id) !== String(req.clientBookingId)) {
        return failWithCleanup(req, res, 403, {
          success: false,
          error: 'Forbidden: traveler does not belong to your booking'
        });
      }

      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
      if (!booking) {
        return failWithCleanup(req, res, 404, { success: false, error: 'Booking not found' });
      }

      const body = req.body || {};
      const expiryCheck = normalizeOptionalDate(body.passport_expiry, 'passport_expiry');
      if (!expiryCheck.ok) {
        return failWithCleanup(req, res, 400, { success: false, error: expiryCheck.error });
      }
      const dobCheck = normalizeOptionalDate(body.date_of_birth, 'date_of_birth');
      if (!dobCheck.ok) {
        return failWithCleanup(req, res, 400, { success: false, error: dobCheck.error });
      }

      const files = req.files || {};
      const passportFile = Array.isArray(files.passport_scan) ? files.passport_scan[0] : null;
      const photoFile = Array.isArray(files.photo_url) ? files.photo_url[0] : null;
      const insuranceFile = Array.isArray(files.insurance_doc) ? files.insurance_doc[0] : null;

      const nextFullName = normalizeOptionalText(body.full_name, 255) || traveler.full_name;
      const nextNationality = normalizeOptionalText(body.nationality, 100) || traveler.nationality;

      let nextPassportNo = traveler.passport_number;
      if (body.passport_number !== undefined) {
        nextPassportNo = normalizeOptionalText(body.passport_number, 50);
      } else if (body.national_id !== undefined) {
        nextPassportNo = normalizeOptionalText(body.national_id, 50);
      }

      const nextPassportExpiry = expiryCheck.provided ? expiryCheck.value : traveler.passport_expiry;
      const nextDob = dobCheck.provided ? dobCheck.value : traveler.date_of_birth;
      const nextGender = body.gender !== undefined ? normalizeOptionalText(body.gender, 20) : traveler.gender;

      let nextDietary = traveler.dietary_needs;
      if (body.dietary_needs !== undefined) {
        nextDietary = normalizeOptionalText(body.dietary_needs, 500);
      } else if (body.dietary_notes !== undefined) {
        nextDietary = normalizeOptionalText(body.dietary_notes, 500);
      }

      const nextMedical = body.medical_notes !== undefined
        ? normalizeOptionalText(body.medical_notes, 500)
        : traveler.medical_notes;
      const nextDocNotes = body.document_notes !== undefined
        ? normalizeOptionalText(body.document_notes, 500)
        : traveler.document_notes;

      const emergency = extractEmergencyContactFields(body, traveler);

      const nextPassportScan = passportFile ? toRelativeUploadPath(passportFile) : traveler.passport_scan;
      const nextPhotoUrl = photoFile ? toRelativeUploadPath(photoFile) : traveler.photo_url;
      const nextInsuranceDoc = insuranceFile ? toRelativeUploadPath(insuranceFile) : traveler.insurance_doc;

      await db.run(
        `UPDATE travelers
         SET full_name = ?,
             nationality = ?,
             passport_number = ?,
             passport_expiry = ?,
             date_of_birth = ?,
             gender = ?,
             dietary_needs = ?,
             medical_notes = ?,
             emergency_contact_name = ?,
             emergency_contact_phone = ?,
             document_notes = ?,
             passport_scan = ?,
             photo_url = ?,
             insurance_doc = ?
         WHERE id = ? AND booking_id = ?`,
        [
          nextFullName,
          nextNationality,
          nextPassportNo,
          nextPassportExpiry,
          nextDob,
          nextGender,
          nextDietary,
          nextMedical,
          emergency.name,
          emergency.phone,
          nextDocNotes,
          nextPassportScan,
          nextPhotoUrl,
          nextInsuranceDoc,
          travelerId,
          booking.id
        ]
      );

      const [updatedTraveler, allTravelers, insSetting] = await Promise.all([
        db.get('SELECT * FROM travelers WHERE id = ?', [travelerId]),
        db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
        db.get("SELECT value FROM settings WHERE key = 'require_insurance_for_visa'")
      ]);

      const requireInsurance = insSetting ? (insSetting.value === '1' || insSetting.value === 'true') : false;
      const currentReadiness = checkDocumentReadiness(
        updatedTraveler,
        booking.travel_date_end,
        booking.nationality_type || 'international',
        requireInsurance
      );

      if (currentReadiness.ready && updatedTraveler.visa_status === 'pending') {
        await db.run("UPDATE travelers SET visa_status = 'documents_complete' WHERE id = ?", [travelerId]);
        updatedTraveler.visa_status = 'documents_complete';
      }

      const allReady = allTravelers.length > 0 && allTravelers.every((tr) =>
        checkDocumentReadiness(
          tr,
          booking.travel_date_end,
          booking.nationality_type || 'international',
          requireInsurance
        ).ready
      );

      let bookingVisaStatus = booking.visa_status;
      if (allReady && !ADVANCED_VISA_STAGES.has(booking.visa_status)) {
        bookingVisaStatus = 'documents_complete';
        await db.run(
          'UPDATE bookings SET visa_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [bookingVisaStatus, booking.id]
        );
        await db.run(
          `INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
           VALUES (?, 'client', 'visa.documents_complete', 'booking', ?, ?, 'documents_complete')`,
          [booking.lead_name, booking.id, booking.visa_status || 'not_started']
        );
        await dispatchNotification('visa_update', {
          booking: { ...booking, visa_status: bookingVisaStatus },
          booking_id: booking.id,
          recipient_type: 'admin',
          recipient: 'admin',
          channel: 'in_app',
          subject: `All Visa Documents Complete — ${booking.id}`,
          message: `All ${allTravelers.length} traveler(s) on ${booking.id} (${booking.lead_name}) have completed visa document uploads and passed readiness verification.`,
          action_url: `admin/booking-detail.html?id=${encodeURIComponent(booking.id)}`,
          skipSmtp: true,
          skipWhatsAppApi: true
        });
      }

      return res.json({
        success: true,
        message: 'Traveler details and documents updated.',
        traveler: {
          ...updatedTraveler,
          doc_readiness: currentReadiness,
          passport_scan_url: updatedTraveler.passport_scan ? `/api/client/documents/${updatedTraveler.id}/passport_scan` : null,
          photo_url_link: updatedTraveler.photo_url ? `/api/client/documents/${updatedTraveler.id}/photo_url` : null,
          insurance_doc_url: updatedTraveler.insurance_doc ? `/api/client/documents/${updatedTraveler.id}/insurance_doc` : null
        },
        doc_readiness: currentReadiness,
        all_travelers_ready: allReady,
        booking_visa_status: bookingVisaStatus
      });
    } catch (err) {
      cleanupUploadedFiles(req);
      return next(err);
    }
  }
);

// GET /api/client/documents/:travelerId/:field - Authenticated private document stream
router.get('/documents/:travelerId/:field', requireClient({ allowQueryToken: true }), async (req, res, next) => {
  try {
    const travelerId = parsePositiveId(req.params.travelerId);
    if (!travelerId) {
      return res.status(400).json({ success: false, error: 'Invalid traveler ID' });
    }

    const field = String(req.params.field || '').trim();
    if (!ALLOWED_DOC_FIELDS.has(field)) {
      return res.status(400).json({ success: false, error: 'Unsupported document field' });
    }

    const traveler = await db.get('SELECT * FROM travelers WHERE id = ?', [travelerId]);
    if (!traveler) {
      return res.status(404).json({ success: false, error: 'Traveler not found' });
    }
    if (String(traveler.booking_id) !== String(req.clientBookingId)) {
      return res.status(403).json({ success: false, error: 'Forbidden: traveler does not belong to your booking' });
    }

    const relPath = traveler[field];
    if (!relPath) {
      return res.status(404).json({ success: false, error: 'Document not uploaded yet' });
    }

    const resolvedPath = path.resolve(UPLOAD_ROOT, relPath);
    const rootPrefix = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : `${UPLOAD_ROOT}${path.sep}`;
    if (!resolvedPath.startsWith(rootPrefix)) {
      return res.status(403).json({ success: false, error: 'Forbidden: invalid document path' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: 'Document file missing on disk' });
    }

    return res.sendFile(resolvedPath);
  } catch (err) {
    return next(err);
  }
});

// POST /api/client/payments/receipt - Multipart payment receipt upload
router.post(
  '/payments/receipt',
  requireClient(),
  runMultipartUpload(uploadPaymentReceipt),
  async (req, res, next) => {
    try {
      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
      if (!booking) {
        return failWithCleanup(req, res, 404, { success: false, error: 'Booking not found' });
      }

      if (!req.file) {
        return failWithCleanup(req, res, 400, {
          success: false,
          error: 'Receipt file (JPG, PNG, or PDF) is required.'
        });
      }

      const body = req.body || {};
      const rawAmount = body.amount ?? body.amount_local ?? body.amount_usd;
      const numericAmount = Number(rawAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return failWithCleanup(req, res, 400, {
          success: false,
          error: 'A positive payment amount is required.'
        });
      }

      const currency = String(body.currency || booking.currency || 'USD').trim().toUpperCase();
      if (currency !== 'USD' && currency !== 'INR') {
        return failWithCleanup(req, res, 400, {
          success: false,
          error: 'Unsupported currency. Must be USD or INR.'
        });
      }

      const settings = await loadSettingsMap();
      const exchangeRate = Number(booking.exchange_rate || settings.usd_to_inr_rate || 85) || 85;
      const amountLocal = Math.round(numericAmount);
      const amountUsd = currency === 'INR'
        ? Math.max(1, Math.round(amountLocal / exchangeRate))
        : Math.max(1, Math.round(numericAmount));

      const paymentType = normalizeOptionalText(body.payment_type, 50) || 'deposit';
      const paymentMethod = normalizeOptionalText(body.payment_method, 50) || 'bank_transfer';
      const transactionRef = normalizeOptionalText(body.transaction_ref, 100);
      const notes = normalizeOptionalText(body.notes, 500);
      const receiptFile = toRelativeUploadPath(req.file);

      const insertRes = await db.run(
        `INSERT INTO payments (
          booking_id, amount_usd, currency, amount_local,
          payment_type, payment_method, transaction_ref, receipt_file,
          status, verified_by, verified_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?)`,
        [
          booking.id,
          amountUsd,
          currency,
          amountLocal,
          paymentType,
          paymentMethod,
          transactionRef,
          receiptFile,
          notes
        ]
      );

      const payment = await db.get('SELECT * FROM payments WHERE id = ?', [insertRes.lastInsertRowid]);

      await dispatchNotification('payment_received', {
        booking,
        booking_id: booking.id,
        recipient_type: 'admin',
        recipient: 'finance',
        channel: 'in_app',
        subject: `Wire Receipt Submitted — ${booking.id}`,
        message: `${booking.lead_name} uploaded a ${currency} ${amountLocal.toLocaleString('en-US')} (${paymentType}) receipt for ${booking.id}. Pending Finance verification.`,
        action_url: `admin/booking-detail.html?id=${encodeURIComponent(booking.id)}`,
        skipSmtp: true,
        skipWhatsAppApi: true
      });

      return res.status(201).json({
        success: true,
        message: 'Payment receipt submitted for Finance verification.',
        payment
      });
    } catch (err) {
      cleanupUploadedFiles(req);
      return next(err);
    }
  }
);

// POST /api/client/reviews - Submit verified post-trip review (requires completed booking)
router.post('/reviews', requireClient(), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.booking_status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Reviews can only be submitted once your trip booking is marked completed.'
      });
    }

    const body = req.body || {};
    const comment = normalizeOptionalText(body.comment, 2000);
    if (!comment) {
      return res.status(400).json({ success: false, error: 'Review comment is required.' });
    }

    const rawRating = body.rating === undefined || body.rating === null ? 5 : Number(body.rating);
    if (!Number.isInteger(rawRating) || rawRating < 1 || rawRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5.' });
    }

    const authorName = normalizeOptionalText(body.author_name, 255) || booking.lead_name;
    const authorCountry = normalizeOptionalText(body.author_country, 100) || booking.lead_country;
    const title = normalizeOptionalText(body.title, 255);

    const insertRes = await db.run(
      `INSERT INTO reviews (
        booking_id, author_name, author_country, tour_taken, travel_date,
        rating, title, comment, is_verified, is_featured, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0)`,
      [
        booking.id,
        authorName,
        authorCountry,
        booking.tour_title,
        booking.travel_date_start,
        rawRating,
        title,
        comment
      ]
    );

    const review = await db.get('SELECT * FROM reviews WHERE id = ?', [insertRes.lastInsertRowid]);

    await dispatchNotification('review_submitted', {
      booking,
      booking_id: booking.id,
      recipient_type: 'admin',
      recipient: 'admin',
      channel: 'in_app',
      subject: `New Verified Client Review — ${booking.id}`,
      message: `${authorName} submitted a ${rawRating}-star review for "${booking.tour_title}" (queued for moderation).`,
      action_url: `admin/booking-detail.html?id=${encodeURIComponent(booking.id)}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been submitted for moderation.',
      review
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/client/invoice-view - Printable official invoice HTML
router.get('/invoice-view', requireClient({ allowQueryToken: true }), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
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

// GET /api/client/clearance-view - Printable DoI clearance letter HTML (only when approved/issued)
router.get('/clearance-view', requireClient({ allowQueryToken: true }), async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.clientBookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const isApproved = booking.visa_status === 'approved' || booking.visa_status === 'clearance_letter_issued';
    if (!isApproved) {
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
