const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const router = express.Router();
const db = require('../database/db');
const { hashPassword, verifyPassword, signToken, requireStaff } = require('../middleware/auth');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { calculatePricingQuote } = require('../services/sdf-engine');
const { parseUTCDate, checkVisaTransition } = require('../services/visa-workflow');
const { dispatchNotification } = require('../services/notification-service');
const whatsappQr = require('../services/whatsapp-qr');

const staffAll = requireStaff('super_admin', 'admin', 'concierge', 'finance');
const staffOps = requireStaff('super_admin', 'admin', 'concierge');
const staffFinance = requireStaff('super_admin', 'admin', 'finance');
const staffAdmin = requireStaff('super_admin', 'admin');
const staffSuper = requireStaff('super_admin');
const staffDocQuery = requireStaff('super_admin', 'admin', 'concierge', 'finance', { allowQueryToken: true });

const STAFF_ROLE_SET = new Set(['super_admin', 'admin', 'concierge', 'finance']);
const ALL_USER_ROLES = new Set(['super_admin', 'admin', 'concierge', 'finance', 'guide']);
const ALLOWED_DOC_FIELDS = new Set(['passport_scan', 'photo_url', 'insurance_doc']);
const VALID_BOOKING_STATUSES = new Set([
  'inquiry',
  'deposit_paid',
  'fully_paid',
  'documents_complete',
  'visa_approved',
  'confirmed',
  'active_trip',
  'completed',
  'cancelled'
]);
const VALID_NATIONALITIES = new Set(['international', 'india', 'regional_india', 'regional']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECRET_SETTING_KEYS = new Set(['smtp_pass', 'whatsapp_api_token']);

// ==========================================
// SHARED HELPERS
// ==========================================

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    uuid: user.uuid,
    name: user.full_name,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
    avatar_url: user.avatar_url || null,
    license_no: user.license_no || null,
    languages: user.languages || null,
    specialty: user.specialty || null,
    is_active: Number(user.is_active) === 1 ? 1 : 0,
    last_login: user.last_login || null,
    created_at: user.created_at || null
  };
}

function parsePositiveId(rawId) {
  const str = String(rawId || '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

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

function normalizeOptionalText(value, maxLen = 1000) {
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

function addDaysUTCString(dateObj, days) {
  const dt = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate() + days));
  return dt.toISOString().split('T')[0];
}

function extractIsoDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts.toISOString().slice(0, 10);
  const m = String(ts).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseJsonSafe(raw, fallback = []) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function serializeJsonField(raw, defaultValue = '[]', { splitLines = false } = {}) {
  if (raw === undefined || raw === null) return defaultValue;
  if (Array.isArray(raw) || typeof raw === 'object') {
    return JSON.stringify(raw);
  }
  const str = String(raw).trim();
  if (!str) return defaultValue;
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed);
  } catch {
    if (splitLines) {
      return JSON.stringify(str.split('\n').map((s) => s.trim()).filter(Boolean));
    }
    return defaultValue;
  }
}

function slugifyClean(rawValue, stripPrefix = '') {
  let clean = String(rawValue || '').trim().toLowerCase().replace(/\.html$/, '');
  clean = clean.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (stripPrefix && clean.startsWith(stripPrefix)) {
    clean = clean.slice(stripPrefix.length);
  }
  return clean;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvContent(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

function resolveSafeUploadPath(relPath) {
  if (!relPath || typeof relPath !== 'string') return null;
  const resolved = path.resolve(UPLOAD_ROOT, relPath);
  const rel = path.relative(UPLOAD_ROOT, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  const rootPrefix = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : `${UPLOAD_ROOT}${path.sep}`;
  const isUnderRoot = process.platform === 'win32'
    ? resolved.toLowerCase().startsWith(rootPrefix.toLowerCase())
    : resolved.startsWith(rootPrefix);
  return isUnderRoot ? resolved : null;
}

async function loadSettingsMap(executor = db) {
  const rows = await executor.query('SELECT key, value FROM settings');
  const map = {};
  for (const row of rows || []) {
    map[row.key] = row.value;
  }
  return map;
}

async function insertAuditLog(executor, { user, action, entityType, entityId, oldValue = null, newValue = null, ipAddress = null }) {
  await executor.run(
    `INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user?.id || null,
      user?.name || user?.full_name || 'System Staff',
      user?.role || 'staff',
      action,
      entityType,
      entityId !== undefined && entityId !== null ? String(entityId) : null,
      oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
      newValue !== undefined && newValue !== null ? String(newValue) : null,
      ipAddress || null
    ]
  );
}

async function generateUniqueBookingId(executor) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 6; i++) {
    const code = crypto.randomInt(1000, 10000);
    const candidate = `BFR-${year}-${code}`;
    const existing = await executor.get('SELECT id FROM bookings WHERE id = ?', [candidate]);
    if (!existing) return candidate;
  }
  return `BFR-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function resolveTourRef(rawRef, executor = db) {
  if (!rawRef) return null;
  const raw = String(rawRef).trim();
  if (!raw || ['custom', 'custom_trip'].includes(raw.toLowerCase())) return null;
  const clean = raw.replace(/^tour-/i, '').replace(/\.html$/i, '');
  const slugCandidate = raw.endsWith('.html') ? raw : `tour-${clean}.html`;
  return executor.get(
    'SELECT * FROM tours WHERE id = ? OR slug = ? OR slug = ? OR id = ?',
    [raw, raw, slugCandidate, clean]
  );
}

async function checkGuideOverlap(executor, { guideId, excludeBookingId = null, startDate, endDate }) {
  const gaSql = `
    SELECT ga.booking_id, ga.start_date, ga.end_date
    FROM guide_assignments ga
    JOIN bookings b ON ga.booking_id = b.id
    WHERE ga.guide_id = ?
      ${excludeBookingId ? 'AND ga.booking_id <> ?' : ''}
      AND LOWER(COALESCE(ga.status, '')) <> 'cancelled'
      AND LOWER(COALESCE(b.booking_status, '')) <> 'cancelled'
      AND ga.start_date <= ?
      AND ga.end_date >= ?
    LIMIT 1
  `;
  const gaParams = excludeBookingId
    ? [guideId, excludeBookingId, endDate, startDate]
    : [guideId, endDate, startDate];
  const gaConflict = await executor.get(gaSql, gaParams);
  if (gaConflict) return gaConflict;

  const bookingSql = `
    SELECT id AS booking_id, travel_date_start AS start_date, travel_date_end AS end_date
    FROM bookings
    WHERE assigned_guide_id = ?
      ${excludeBookingId ? 'AND id <> ?' : ''}
      AND LOWER(COALESCE(booking_status, '')) <> 'cancelled'
      AND travel_date_start <= ?
      AND travel_date_end >= ?
    LIMIT 1
  `;
  const bookingParams = excludeBookingId
    ? [guideId, excludeBookingId, endDate, startDate]
    : [guideId, endDate, startDate];
  const bookingConflict = await executor.get(bookingSql, bookingParams);
  return bookingConflict || null;
}

async function recomputeBookingBalance(executor, booking, { statusHint = null } = {}) {
  const sums = await executor.get(
    `SELECT
       COALESCE(SUM(amount_usd), 0) AS total_usd,
       COALESCE(SUM(amount_local), 0) AS total_local
     FROM payments
     WHERE booking_id = ? AND status = 'verified'`,
    [booking.id]
  );

  const netPaidUsd = Math.max(0, Math.round(Number(sums?.total_usd || 0)));
  const netPaidLocal = Math.max(0, Math.round(Number(sums?.total_local || 0)));
  const totalUsd = Math.round(Number(booking.total_price_usd || 0));

  const isIndia = String(booking.nationality_type || '').toLowerCase() === 'india'
    || String(booking.nationality_type || '').toLowerCase() === 'regional_india'
    || String(booking.currency || '').toUpperCase() === 'INR';
  const rate = Number(booking.exchange_rate || 85) || 85;
  const expectedLocalTotal = isIndia ? Math.round(totalUsd * rate) : totalUsd;

  const isFullPaid = (netPaidUsd >= totalUsd) || (isIndia && netPaidLocal >= expectedLocalTotal) ? 1 : 0;

  let nextBookingStatus = booking.booking_status;
  if (statusHint) {
    nextBookingStatus = statusHint;
  } else if (['inquiry', 'deposit_paid', 'fully_paid', 'documents_complete'].includes(booking.booking_status)) {
    if (isFullPaid === 1) {
      nextBookingStatus = 'fully_paid';
    } else if (netPaidUsd > 0) {
      nextBookingStatus = 'deposit_paid';
    } else {
      nextBookingStatus = 'inquiry';
    }
  }

  await executor.run(
    `UPDATE bookings
     SET deposit_paid_usd = ?, full_paid = ?, booking_status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [netPaidUsd, isFullPaid, nextBookingStatus, booking.id]
  );

  return { netPaidUsd, netPaidLocal, isFullPaid, nextBookingStatus };
}

function normalizeAgeCategory(rawCategory, fallback = 'adult') {
  const norm = String(rawCategory || '').trim().toLowerCase();
  if (norm === 'adult') return 'adult';
  if (norm === 'child_6_12' || norm === 'child' || norm === 'child_6-12') return 'child_6_12';
  if (norm === 'child_under_6' || norm === 'under_6' || norm === 'infant') return 'child_under_6';
  return fallback;
}

function allocateSlot(remaining) {
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

function buildClientPortalUrl(settings, bookingId, email) {
  const rawAppUrl = process.env.APP_URL || settings.app_url || 'http://localhost:3000';
  const appUrl = String(rawAppUrl).replace(/\/+$/, '');
  return `${appUrl}/client/login.html?ref=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(email)}`;
}

async function createStaffAssistedBooking({ body = {}, staffUser, reqIp = null, inquiry = null }) {
  const lead_name = normalizeOptionalText(body.lead_name ?? inquiry?.name, 255);
  const lead_email = normalizeOptionalText(body.lead_email ?? inquiry?.email, 255)?.toLowerCase() || '';
  const lead_phone = normalizeOptionalText(body.lead_phone ?? inquiry?.phone, 50) || '';
  const lead_country = normalizeOptionalText(body.lead_country ?? inquiry?.country, 100);

  if (!lead_name || !lead_email || !lead_phone) {
    return { status: 400, payload: { success: false, error: 'lead_name, lead_email, and lead_phone are required.' } };
  }
  if (!EMAIL_RE.test(lead_email)) {
    return { status: 400, payload: { success: false, error: 'Invalid lead_email address.' } };
  }

  let rawStart = body.travel_date_start;
  if (!rawStart && inquiry) {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 30);
    rawStart = future.toISOString().split('T')[0];
  }
  const startCheck = normalizeOptionalDate(rawStart, 'travel_date_start');
  if (!startCheck.ok || !startCheck.value) {
    return {
      status: 400,
      payload: { success: false, error: startCheck.error || 'Valid travel_date_start (YYYY-MM-DD) is required.' }
    };
  }
  const travelDateStart = startCheck.value;
  const startDateObj = parseUTCDate(travelDateStart);

  const leadPassportExpiryCheck = normalizeOptionalDate(body.lead_passport_expiry, 'lead_passport_expiry');
  if (!leadPassportExpiryCheck.ok) {
    return { status: 400, payload: { success: false, error: leadPassportExpiryCheck.error } };
  }

  const c1 = (body.children_6_12 === undefined || body.children_6_12 === null || body.children_6_12 === '')
    ? 0
    : parseStrictNonNegativeInt(body.children_6_12);
  const c2 = (body.children_under_6 === undefined || body.children_under_6 === null || body.children_under_6 === '')
    ? 0
    : parseStrictNonNegativeInt(body.children_under_6);
  if (c1 === null || c2 === null) {
    return { status: 400, payload: { success: false, error: 'Invalid child traveler counts.' } };
  }

  const rawAdults = body.adults_count !== undefined ? body.adults_count : body.adults;
  let adults;
  if (rawAdults === undefined || rawAdults === null || rawAdults === '') {
    const fallbackTotal = body.total_travelers ?? inquiry?.travelers_count;
    if (fallbackTotal !== undefined && fallbackTotal !== null && fallbackTotal !== '') {
      const totalReq = parseStrictPositiveInt(fallbackTotal);
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

  let rawNat = body.nationality_type !== undefined && body.nationality_type !== null && String(body.nationality_type).trim() !== ''
    ? String(body.nationality_type).trim().toLowerCase()
    : ((lead_country && lead_country.toLowerCase() === 'india') ? 'india' : 'international');
  if (!VALID_NATIONALITIES.has(rawNat)) {
    return { status: 400, payload: { success: false, error: 'Invalid nationality_type. Must be international or india.' } };
  }
  const isIndia = rawNat === 'india' || rawNat === 'regional_india' || rawNat === 'regional';
  const canonicalNationality = isIndia ? 'india' : 'international';

  const tourRef = body.tour_id || body.tour_slug;
  const hasExplicitTour = Boolean(
    tourRef &&
    String(tourRef).trim() !== '' &&
    !['custom', 'custom_trip'].includes(String(tourRef).trim().toLowerCase()) &&
    !body.is_custom_trip
  );
  let tour = null;
  if (hasExplicitTour) {
    tour = await resolveTourRef(tourRef);
    if (!tour) {
      return { status: 404, payload: { success: false, error: 'Selected tour package not found.' } };
    }
  }

  let customDailyRate;
  if (body.custom_daily_rate !== undefined && body.custom_daily_rate !== null && body.custom_daily_rate !== '') {
    customDailyRate = Number(body.custom_daily_rate);
    if (!Number.isFinite(customDailyRate) || customDailyRate <= 0) {
      return { status: 400, payload: { success: false, error: 'custom_daily_rate must be a positive number.' } };
    }
  }

  let tripNights;
  const rawNights = body.nights !== undefined ? body.nights : body.total_nights;
  if (rawNights !== undefined && rawNights !== null && rawNights !== '') {
    tripNights = parseStrictPositiveInt(rawNights);
    if (tripNights === null || tripNights > 365) {
      return { status: 400, payload: { success: false, error: 'Trip nights must be between 1 and 365.' } };
    }
  } else if (tour) {
    tripNights = Number(tour.duration_nights) || 1;
  } else if (inquiry && Number(inquiry.duration_days) > 1) {
    tripNights = Math.max(1, Number(inquiry.duration_days) - 1);
  } else {
    tripNights = 6;
  }

  const travelDateEnd = addDaysUTCString(startDateObj, tripNights);

  let extrasUsd = 0;
  if (body.extras_usd !== undefined && body.extras_usd !== null && body.extras_usd !== '') {
    extrasUsd = Number(body.extras_usd);
    if (!Number.isFinite(extrasUsd) || extrasUsd < 0) {
      return { status: 400, payload: { success: false, error: 'extras_usd must be non-negative.' } };
    }
  }
  let discountUsd = 0;
  if (body.discount_usd !== undefined && body.discount_usd !== null && body.discount_usd !== '') {
    discountUsd = Number(body.discount_usd);
    if (!Number.isFinite(discountUsd) || discountUsd < 0) {
      return { status: 400, payload: { success: false, error: 'discount_usd must be non-negative.' } };
    }
  }

  let initialDepositUsd = 0;
  const rawInitDeposit = body.initial_deposit_usd !== undefined ? body.initial_deposit_usd : body.deposit_paid_usd;
  if (rawInitDeposit !== undefined && rawInitDeposit !== null && rawInitDeposit !== '') {
    initialDepositUsd = Number(rawInitDeposit);
    if (!Number.isFinite(initialDepositUsd) || initialDepositUsd < 0) {
      return { status: 400, payload: { success: false, error: 'initial_deposit_usd must be non-negative.' } };
    }
  }

  let suppliedTravelers = null;
  if (body.travelers !== undefined && body.travelers !== null) {
    if (!Array.isArray(body.travelers)) {
      return { status: 400, payload: { success: false, error: 'travelers must be an array.' } };
    }
    if (body.travelers.length > totalTravelers) {
      return { status: 400, payload: { success: false, error: 'travelers length exceeds party size.' } };
    }
    suppliedTravelers = [];
    for (let i = 0; i < body.travelers.length; i++) {
      const tr = body.travelers[i];
      if (!tr || typeof tr !== 'object') {
        return { status: 400, payload: { success: false, error: `Invalid traveler at index ${i}.` } };
      }
      const expCheck = normalizeOptionalDate(tr.passport_expiry, `travelers[${i}].passport_expiry`);
      if (!expCheck.ok) return { status: 400, payload: { success: false, error: expCheck.error } };
      const dobCheck = normalizeOptionalDate(tr.date_of_birth, `travelers[${i}].date_of_birth`);
      if (!dobCheck.ok) return { status: 400, payload: { success: false, error: dobCheck.error } };
      suppliedTravelers.push({
        ...tr,
        passport_expiry: expCheck.value,
        date_of_birth: dobCheck.value
      });
    }
  }

  const instantConfirm = body.instant_confirm === true || body.instant_confirm === 1 || body.instant_confirm === '1';
  let assignedGuide = null;
  if (body.assigned_guide_id !== undefined && body.assigned_guide_id !== null && body.assigned_guide_id !== '') {
    const guideId = parsePositiveId(body.assigned_guide_id);
    if (!guideId) {
      return { status: 400, payload: { success: false, error: 'Invalid assigned_guide_id.' } };
    }
    assignedGuide = await db.get(
      "SELECT id, full_name, email, phone FROM users WHERE id = ? AND role = 'guide' AND is_active = 1",
      [guideId]
    );
    if (!assignedGuide) {
      return { status: 404, payload: { success: false, error: 'Active licensed guide not found.' } };
    }
    const overlap = await checkGuideOverlap(db, {
      guideId: assignedGuide.id,
      startDate: travelDateStart,
      endDate: travelDateEnd
    });
    if (overlap) {
      return {
        status: 409,
        payload: {
          success: false,
          error: `Guide ${assignedGuide.full_name} has an overlapping assignment (${overlap.booking_id}: ${overlap.start_date} to ${overlap.end_date}).`,
          conflicting_booking_id: overlap.booking_id
        }
      };
    }
  } else if (instantConfirm) {
    return {
      status: 400,
      payload: { success: false, error: 'Cannot instant-confirm booking without assigning a licensed guide.' }
    };
  }

  const hotelTier = normalizeOptionalText(body.hotel_tier, 50) || '4-Star Premium';
  const tourTitle = normalizeOptionalText(body.tour_title, 255)
    || (tour ? tour.title : 'Custom Bespoke Bhutan Expedition');
  const resolvedCountry = lead_country || (isIndia ? 'India' : 'International');
  const isCustomTrip = (tour && !customDailyRate) ? 0 : 1;
  const source = normalizeOptionalText(body.source ?? inquiry?.source, 50) || 'admin_concierge';
  const paymentPlan = String(body.payment_plan || '').trim().toLowerCase() === 'full_100' ? 'full_100' : 'deposit_30';
  const flightAssistance = (body.flight_assistance === true || body.flight_assistance === 1 || body.flight_assistance === '1') ? 1 : 0;
  const assignedVehicle = normalizeOptionalText(body.assigned_vehicle ?? body.vehicle_plate, 100);

  const settings = await loadSettingsMap();
  const finalDueDays = parseStrictNonNegativeInt(settings.final_payment_due_days) ?? 30;
  const dueObj = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate() - finalDueDays));
  const todayUtc = parseUTCDate(new Date());
  const balanceDueDate = (dueObj < todayUtc ? todayUtc : dueObj).toISOString().split('T')[0];

  const quote = await calculatePricingQuote({
    tour,
    nights: tripNights,
    adults,
    children_6_12: c1,
    children_under_6: c2,
    nationality_type: canonicalNationality,
    hotel_tier: hotelTier,
    custom_daily_rate: customDailyRate,
    extras_usd: extrasUsd,
    discount_usd: discountUsd,
    is_sdf_waived: body.is_sdf_waived
  });

  const basePriceUsdInt = Math.round(quote.package_total_usd);
  const sdfTotalUsdInt = Math.round(quote.total_sdf_usd);
  const visaFeeUsdInt = Math.round(quote.visa_fee_usd);
  const extrasUsdInt = Math.round(quote.extras_usd);
  const discountUsdInt = Math.round(quote.discount_usd);
  const totalPriceUsdInt = Math.round(quote.total_price_usd);
  const depositPaidUsdInt = Math.round(initialDepositUsd);
  const fullPaidFlag = depositPaidUsdInt >= totalPriceUsdInt ? 1 : 0;

  let initialStatus = 'inquiry';
  if (instantConfirm && assignedGuide) {
    initialStatus = 'confirmed';
  } else if (fullPaidFlag === 1) {
    initialStatus = 'fully_paid';
  } else if (depositPaidUsdInt > 0) {
    initialStatus = 'deposit_paid';
  }

  const adultSdfUsdInt = Math.round(quote.breakdown.adults.sdf_rate_per_night / quote.exchange_rate);
  const childSdfUsdInt = Math.round(quote.breakdown.children_6_12.sdf_rate_per_night / quote.exchange_rate);
  const sdfForCat = (cat) => (cat === 'adult' ? adultSdfUsdInt : (cat === 'child_6_12' ? childSdfUsdInt : 0));

  const txData = await db.transaction(async (tx) => {
    if (assignedGuide) {
      const txOverlap = await checkGuideOverlap(tx, {
        guideId: assignedGuide.id,
        startDate: travelDateStart,
        endDate: travelDateEnd
      });
      if (txOverlap) {
        const err = new Error(`Guide ${assignedGuide.full_name} has an overlapping assignment (${txOverlap.booking_id}).`);
        err.status = 409;
        err.conflicting_booking_id = txOverlap.booking_id;
        throw err;
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
        booking_status, visa_status, assigned_guide_id, assigned_vehicle,
        custom_itinerary_json, created_by_staff_id, special_requests, internal_notes, source
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, 'not_started', ?, ?,
        ?, ?, ?, ?, ?
      )`,
      [
        bookingId,
        tour ? tour.id : null,
        tourTitle,
        isCustomTrip,
        lead_name,
        lead_email,
        lead_phone,
        resolvedCountry,
        normalizeOptionalText(body.lead_passport_no, 50),
        leadPassportExpiryCheck.value,
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
        extrasUsdInt,
        discountUsdInt,
        totalPriceUsdInt,
        quote.currency,
        quote.nationality_type,
        quote.exchange_rate,
        paymentPlan,
        balanceDueDate,
        depositPaidUsdInt,
        fullPaidFlag,
        flightAssistance,
        initialStatus,
        assignedGuide ? assignedGuide.id : null,
        assignedGuide ? (assignedVehicle || 'Assigned Vehicle TBD') : assignedVehicle,
        body.custom_itinerary_json
          ? (typeof body.custom_itinerary_json === 'string' ? body.custom_itinerary_json : JSON.stringify(body.custom_itinerary_json))
          : null,
        staffUser.id,
        normalizeOptionalText(body.special_requests ?? inquiry?.message, 2000),
        normalizeOptionalText(body.internal_notes ?? inquiry?.internal_notes, 2000),
        source
      ]
    );

    const remaining = { adult: adults, child_6_12: c1, child_under_6: c2 };
    let insertedTravelers = 0;
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
        const reqCat = normalizeAgeCategory(tr.age_category, 'adult');
        const cat = remaining[reqCat] > 0 ? (remaining[reqCat]--, reqCat) : allocateSlot(remaining);
        await tx.run(insertTravelerSql, [
          bookingId,
          normalizeOptionalText(tr.full_name, 255) || lead_name,
          normalizeOptionalText(tr.passport_number, 50) || (idx === 0 ? normalizeOptionalText(body.lead_passport_no, 50) : null),
          tr.passport_expiry || (idx === 0 ? leadPassportExpiryCheck.value : null),
          normalizeOptionalText(tr.nationality, 100) || resolvedCountry,
          tr.date_of_birth || null,
          cat,
          normalizeOptionalText(tr.gender, 20),
          normalizeOptionalText(tr.dietary_needs, 500),
          normalizeOptionalText(tr.medical_notes, 500),
          normalizeOptionalText(tr.emergency_contact_name, 255),
          normalizeOptionalText(tr.emergency_contact_phone, 50),
          sdfForCat(cat)
        ]);
        insertedTravelers += 1;
      }
    } else {
      const leadCat = allocateSlot(remaining);
      await tx.run(insertTravelerSql, [
        bookingId,
        lead_name,
        normalizeOptionalText(body.lead_passport_no, 50),
        leadPassportExpiryCheck.value,
        resolvedCountry,
        null,
        leadCat,
        null,
        null,
        null,
        null,
        null,
        sdfForCat(leadCat)
      ]);
      insertedTravelers += 1;
    }

    while (insertedTravelers < totalTravelers) {
      const nextCat = allocateSlot(remaining);
      await tx.run(insertTravelerSql, [
        bookingId,
        `Guest ${insertedTravelers + 1} (${nextCat})`,
        null,
        null,
        resolvedCountry,
        null,
        nextCat,
        null,
        null,
        null,
        null,
        null,
        sdfForCat(nextCat)
      ]);
      insertedTravelers += 1;
    }

    if (depositPaidUsdInt > 0) {
      const localAmount = quote.currency === 'INR'
        ? Math.round(depositPaidUsdInt * quote.exchange_rate)
        : depositPaidUsdInt;
      await tx.run(
        `INSERT INTO payments (
          booking_id, amount_usd, currency, amount_local, payment_type, payment_method,
          transaction_ref, status, verified_by, verified_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, CURRENT_TIMESTAMP, ?)`,
        [
          bookingId,
          depositPaidUsdInt,
          quote.currency,
          localAmount,
          fullPaidFlag === 1 ? 'full_payment' : 'deposit',
          normalizeOptionalText(body.payment_method, 50) || 'bank_transfer',
          normalizeOptionalText(body.transaction_ref, 100) || `STAFF-${bookingId}`,
          staffUser.id,
          'Initial deposit recorded during concierge booking creation'
        ]
      );
    }

    if (assignedGuide) {
      await tx.run(
        `INSERT INTO guide_assignments (guide_id, booking_id, start_date, end_date, vehicle_plate, status)
         VALUES (?, ?, ?, ?, ?, 'scheduled')`,
        [assignedGuide.id, bookingId, travelDateStart, travelDateEnd, assignedVehicle || 'Assigned Vehicle TBD']
      );
    }

    if (inquiry) {
      await tx.run(
        `UPDATE inquiries
         SET status = 'converted', converted_booking_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [bookingId, inquiry.id]
      );
      await insertAuditLog(tx, {
        user: staffUser,
        action: 'inquiry.converted',
        entityType: 'inquiry',
        entityId: inquiry.id,
        oldValue: inquiry.status,
        newValue: `Converted to ${bookingId}`,
        ipAddress: reqIp
      });
    }

    await insertAuditLog(tx, {
      user: staffUser,
      action: 'booking.created_by_staff',
      entityType: 'booking',
      entityId: bookingId,
      newValue: JSON.stringify({
        tour: tourTitle,
        total_usd: totalPriceUsdInt,
        deposit_paid_usd: depositPaidUsdInt,
        status: initialStatus
      }),
      ipAddress: reqIp
    });

    const bookingRow = await tx.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    const travelersRows = await tx.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [bookingId]);
    const updatedInquiry = inquiry ? await tx.get('SELECT * FROM inquiries WHERE id = ?', [inquiry.id]) : null;
    return { bookingRow, travelersRows, updatedInquiry };
  });

  const bookingForNotif = {
    ...txData.bookingRow,
    package_total_local: quote.package_total_local,
    total_sdf_local: quote.total_sdf_local,
    visa_fee_local: quote.visa_fee_local,
    total_price_local: quote.total_price_local
  };

  const notifEvent = initialStatus === 'confirmed' ? 'booking_confirmed' : 'booking_new';
  const clientNotif = await dispatchNotification(notifEvent, {
    booking: bookingForNotif,
    booking_id: txData.bookingRow.id,
    recipient_type: 'client',
    recipient_phone: lead_phone,
    recipient_email: lead_email
  });

  if (assignedGuide) {
    await dispatchNotification('guide_assignment', {
      booking: bookingForNotif,
      booking_id: txData.bookingRow.id,
      recipient_type: 'guide',
      recipient_id: assignedGuide.email,
      recipient_email: assignedGuide.email,
      recipient_phone: assignedGuide.phone,
      subject: `New Trip Assignment — ${txData.bookingRow.id}`,
      message: `Assigned to lead "${tourTitle}" (${travelDateStart} to ${travelDateEnd}) for ${lead_name}.`,
      action_url: `guide/trip-detail.html?id=${encodeURIComponent(txData.bookingRow.id)}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });
  }

  return {
    status: 201,
    payload: {
      success: true,
      message: `Booking ${txData.bookingRow.id} created on behalf of ${lead_name}.`,
      booking: {
        ...txData.bookingRow,
        travelers: txData.travelersRows
      },
      quote,
      ...(txData.updatedInquiry ? { inquiry: txData.updatedInquiry } : {}),
      whatsapp_share_url: clientNotif.whatsapp_share_url,
      client_portal_url: buildClientPortalUrl(settings, txData.bookingRow.id, lead_email),
      notification_id: clientNotif.id
    }
  };
}

// ==========================================
// 1. AUTHENTICATION & DASHBOARD STATS
// ==========================================

// POST /api/admin/auth/login - Staff authentication via email or username
router.post('/auth/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const identifier = String(body.email || body.username || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required.' });
    }

    let user = await db.get(
      'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(uuid) = ? LIMIT 1',
      [identifier, identifier]
    );
    if (!user && !identifier.includes('@')) {
      const prefixMatches = await db.query(
        'SELECT * FROM users WHERE LOWER(email) LIKE ? LIMIT 2',
        [`${identifier}@%`]
      );
      if (prefixMatches.length === 1) {
        user = prefixMatches[0];
      }
    }

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid staff credentials' });
    }

    if (!STAFF_ROLE_SET.has(user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: staff role required for Admin Portal.' });
    }

    if (Number(user.is_active) !== 1) {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Contact a super_admin.' });
    }

    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    const refreshed = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);

    const token = signToken({
      id: user.id,
      userId: user.id,
      uuid: user.uuid,
      email: user.email,
      name: user.full_name,
      role: user.role
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(refreshed || user)
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/auth/me - Current authenticated staff profile
router.get('/auth/me', staffAll, async (req, res, next) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || !STAFF_ROLE_SET.has(user.role) || Number(user.is_active) !== 1) {
      return res.status(401).json({ success: false, error: 'Staff session no longer valid.' });
    }
    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/stats - Live KPI dashboard & JS-computed monthly trends
router.get('/stats', staffAll, async (req, res, next) => {
  try {
    const [bookings, payments, newInqRow, pendingPayRow, unreadNotifRow, checkins, recentActivity] = await Promise.all([
      db.query(
        `SELECT id, total_price_usd, deposit_paid_usd, sdf_total_usd, full_paid,
                sdf_remitted_at, booking_status, visa_status, created_at
         FROM bookings`
      ),
      db.query('SELECT id, amount_usd, payment_type, status, verified_at, created_at FROM payments'),
      db.get("SELECT COUNT(*) AS count FROM inquiries WHERE status = 'new'"),
      db.get("SELECT COUNT(*) AS count FROM payments WHERE status = 'pending'"),
      db.get('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0'),
      db.query(
        `SELECT gc.id, gc.booking_id, gc.guide_id, gc.location, gc.weather, gc.guest_status, gc.created_at,
                u.full_name AS guide_name
         FROM guide_checkins gc
         LEFT JOIN users u ON gc.guide_id = u.id
         ORDER BY gc.id DESC
         LIMIT 50`
      ),
      db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 10')
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentMonth = todayStr.slice(0, 7);
    const currentYear = todayStr.slice(0, 4);

    let totalRevenueUsd = 0;
    let collectedRevenueUsd = 0;
    let sdfCollectedUsd = 0;
    let sdfRemittedUsd = 0;
    let activeTrips = 0;
    let pendingVisas = 0;
    let mtdRevenueUsd = 0;
    let ytdRevenueUsd = 0;

    const bookingPipelineMap = new Map();
    const visaPipelineMap = new Map();
    const monthlyMap = new Map();

    for (const b of bookings) {
      const bStatus = b.booking_status || 'inquiry';
      const vStatus = b.visa_status || 'not_started';
      bookingPipelineMap.set(bStatus, (bookingPipelineMap.get(bStatus) || 0) + 1);
      visaPipelineMap.set(vStatus, (visaPipelineMap.get(vStatus) || 0) + 1);

      if (bStatus === 'active_trip') activeTrips += 1;
      if (['under_review', 'submitted_to_doi', 'documents_complete'].includes(vStatus)) pendingVisas += 1;

      if (bStatus === 'cancelled') continue;

      const totalUsd = Math.round(Number(b.total_price_usd || 0));
      const paidUsd = Math.round(Number(b.deposit_paid_usd || 0));
      const sdfUsd = Math.round(Number(b.sdf_total_usd || 0));

      totalRevenueUsd += totalUsd;
      collectedRevenueUsd += paidUsd;

      if (Number(b.full_paid) === 1 || paidUsd >= totalUsd) {
        sdfCollectedUsd += sdfUsd;
      }
      if (b.sdf_remitted_at) {
        sdfRemittedUsd += sdfUsd;
      }

      const dStr = extractIsoDate(b.created_at) || todayStr;
      const ym = dStr.slice(0, 7);
      const yr = dStr.slice(0, 4);
      if (ym === currentMonth) mtdRevenueUsd += totalUsd;
      if (yr === currentYear) ytdRevenueUsd += totalUsd;

      const bucket = monthlyMap.get(ym) || { month: ym, revenue_usd: 0, collected_usd: 0, bookings_count: 0 };
      bucket.revenue_usd += totalUsd;
      bucket.collected_usd += paidUsd;
      bucket.bookings_count += 1;
      monthlyMap.set(ym, bucket);
    }

    let mtdCollectedUsd = 0;
    let ytdCollectedUsd = 0;
    for (const p of payments) {
      if (p.status !== 'verified') continue;
      const amt = Math.round(Number(p.amount_usd || 0));
      const pDate = extractIsoDate(p.verified_at || p.created_at) || todayStr;
      if (pDate.slice(0, 7) === currentMonth) mtdCollectedUsd += amt;
      if (pDate.slice(0, 4) === currentYear) ytdCollectedUsd += amt;
    }

    const monthlyRevenue = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    const pipeline = Array.from(bookingPipelineMap.entries()).map(([booking_status, count]) => ({ booking_status, count }));
    const visaPipeline = Array.from(visaPipelineMap.entries()).map(([visa_status, count]) => ({ visa_status, count }));
    const todayCheckins = checkins.filter((c) => extractIsoDate(c.created_at) === todayStr);

    return res.json({
      success: true,
      stats: {
        total_bookings: bookings.length,
        active_trips: activeTrips,
        pending_visas: pendingVisas,
        new_inquiries: Number(newInqRow?.count || 0),
        total_revenue_usd: totalRevenueUsd,
        collected_revenue_usd: collectedRevenueUsd,
        outstanding_balance_usd: Math.max(0, totalRevenueUsd - collectedRevenueUsd),
        mtd_revenue_usd: mtdRevenueUsd,
        ytd_revenue_usd: ytdRevenueUsd,
        mtd_collected_usd: mtdCollectedUsd,
        ytd_collected_usd: ytdCollectedUsd,
        sdf_collected_usd: sdfCollectedUsd,
        sdf_remitted_usd: sdfRemittedUsd,
        sdf_pending_remittance_usd: Math.max(0, sdfCollectedUsd - sdfRemittedUsd),
        pending_verifications: Number(pendingPayRow?.count || 0),
        today_checkins_count: todayCheckins.length,
        today_checkins: todayCheckins,
        unread_notifications: Number(unreadNotifRow?.count || 0),
        monthly_revenue: monthlyRevenue,
        pipeline,
        visa_pipeline: visaPipeline,
        recent_activity: recentActivity
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 2. BOOKINGS PIPELINE, ON-BEHALF BOOKING & OPERATIONS
// ==========================================

// POST /api/admin/bookings - Concierge "Book on Behalf of Client"
router.post('/bookings', staffOps, async (req, res, next) => {
  try {
    const result = await createStaffAssistedBooking({
      body: req.body || {},
      staffUser: req.user,
      reqIp: req.ip
    });
    return res.status(result.status).json(result.payload);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        success: false,
        error: err.message,
        conflicting_booking_id: err.conflicting_booking_id
      });
    }
    return next(err);
  }
});

// GET /api/admin/bookings - Filterable bookings pipeline
router.get('/bookings', staffAll, async (req, res, next) => {
  try {
    const { status, visa_status, search, source } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      sql += ' AND booking_status = ?';
      params.push(String(status).trim());
    }
    if (visa_status && visa_status !== 'All') {
      sql += ' AND visa_status = ?';
      params.push(String(visa_status).trim());
    }
    if (source && source !== 'All') {
      sql += ' AND source = ?';
      params.push(String(source).trim());
    }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      sql += ' AND (LOWER(id) LIKE ? OR LOWER(lead_name) LIKE ? OR LOWER(lead_email) LIKE ? OR LOWER(tour_title) LIKE ?)';
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC, id DESC';
    const bookings = await db.query(sql, params);
    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/bookings/:id - Deep booking inspection
router.get('/bookings/:id', staffAll, async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [travelers, payments, audit, assignments, checkins, guide] = await Promise.all([
      db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC, id DESC', [booking.id]),
      db.query('SELECT * FROM audit_log WHERE entity_id = ? ORDER BY id DESC', [booking.id]),
      db.query('SELECT * FROM guide_assignments WHERE booking_id = ? ORDER BY id DESC', [booking.id]),
      db.query('SELECT * FROM guide_checkins WHERE booking_id = ? ORDER BY id DESC', [booking.id]),
      booking.assigned_guide_id
        ? db.get('SELECT id, uuid, full_name, email, phone, role, license_no, languages, specialty FROM users WHERE id = ?', [booking.assigned_guide_id])
        : null
    ]);

    return res.json({
      success: true,
      booking: {
        ...booking,
        travelers,
        payments,
        audit,
        assignments,
        checkins,
        guide: guide || null
      }
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/bookings/:id/status - Update lifecycle status (guide required before confirmed)
router.patch('/bookings/:id/status', staffOps, async (req, res, next) => {
  try {
    const { status, cancellation_reason } = req.body || {};
    const targetStatus = String(status || '').trim();
    if (!VALID_BOOKING_STATUSES.has(targetStatus)) {
      return res.status(400).json({ success: false, error: `Invalid booking status: ${targetStatus}` });
    }

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (targetStatus === 'confirmed' && !booking.assigned_guide_id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot confirm booking without an assigned licensed guide. Please assign a guide first.'
      });
    }

    const cancelReason = targetStatus === 'cancelled'
      ? (normalizeOptionalText(cancellation_reason, 1000) || booking.cancellation_reason)
      : booking.cancellation_reason;

    await db.run(
      'UPDATE bookings SET booking_status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [targetStatus, cancelReason, booking.id]
    );

    if (targetStatus === 'cancelled') {
      await db.run(
        "UPDATE guide_assignments SET status = 'cancelled' WHERE booking_id = ? AND status <> 'cancelled'",
        [booking.id]
      );
    }

    await insertAuditLog(db, {
      user: req.user,
      action: 'booking.status_change',
      entityType: 'booking',
      entityId: booking.id,
      oldValue: booking.booking_status,
      newValue: targetStatus,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    let whatsappShareUrl = null;
    if (targetStatus !== booking.booking_status) {
      const notifEvent = targetStatus === 'confirmed'
        ? 'booking_confirmed'
        : (targetStatus === 'cancelled' ? 'booking_cancelled' : 'booking_update');
      const notif = await dispatchNotification(notifEvent, {
        booking: updated,
        booking_id: updated.id,
        recipient_type: 'client',
        recipient_phone: updated.lead_phone,
        recipient_email: updated.lead_email
      });
      whatsappShareUrl = notif.whatsapp_share_url;
    }

    return res.json({
      success: true,
      message: `Booking status updated to ${targetStatus}`,
      booking: updated,
      ...(whatsappShareUrl ? { whatsapp_share_url: whatsappShareUrl } : {})
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/bookings/:id/notes - Update internal operational notes
router.patch('/bookings/:id/notes', staffOps, async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const { internal_notes, special_requests } = req.body || {};
    const nextNotes = internal_notes !== undefined ? normalizeOptionalText(internal_notes, 4000) : booking.internal_notes;
    const nextRequests = special_requests !== undefined ? normalizeOptionalText(special_requests, 2000) : booking.special_requests;

    await db.run(
      'UPDATE bookings SET internal_notes = ?, special_requests = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextNotes, nextRequests, booking.id]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'booking.notes_updated',
      entityType: 'booking',
      entityId: booking.id,
      oldValue: booking.internal_notes,
      newValue: nextNotes,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    return res.json({ success: true, message: 'Booking notes updated', booking: updated });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/bookings/:id/visa - Department of Immigration Visa State Machine
router.patch('/bookings/:id/visa', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const targetStage = String(body.visa_status || '').trim();
    if (!targetStage) {
      return res.status(400).json({ success: false, error: 'visa_status is required.' });
    }

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [travelers, insSetting] = await Promise.all([
      db.query('SELECT * FROM travelers WHERE booking_id = ? ORDER BY id ASC', [booking.id]),
      db.get("SELECT value FROM settings WHERE key = 'require_insurance_for_visa'")
    ]);

    const requireInsurance = insSetting ? (insSetting.value === '1' || insSetting.value === 'true') : false;
    const rejectionReason = normalizeOptionalText(body.rejection_reason ?? body.visa_rejection_reason, 1000);

    const check = checkVisaTransition(booking.visa_status, targetStage, booking, travelers, {
      rejection_reason: rejectionReason || '',
      requireInsurance
    });
    if (!check.allowed) {
      return res.status(400).json({ success: false, error: check.reason, errors: check.errors });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let clearanceNumber = normalizeOptionalText(body.visa_clearance_number, 100) || booking.visa_clearance_number;
    if ((targetStage === 'approved' || targetStage === 'clearance_letter_issued') && !clearanceNumber) {
      clearanceNumber = `VCL-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}-BFR`;
    }

    let visaSubmittedDate = booking.visa_submitted_date;
    if (targetStage === 'submitted_to_doi' && !visaSubmittedDate) {
      visaSubmittedDate = todayStr;
    }

    let visaApprovedDate = booking.visa_approved_date;
    if (targetStage === 'approved' || targetStage === 'clearance_letter_issued') {
      visaApprovedDate = todayStr;
    }

    const nextRejectionReason = targetStage === 'rejected'
      ? rejectionReason
      : (targetStage === 'approved' || targetStage === 'clearance_letter_issued' ? null : booking.visa_rejection_reason);

    await db.run(
      `UPDATE bookings
       SET visa_status = ?,
           visa_clearance_number = ?,
           visa_submitted_date = ?,
           visa_approved_date = ?,
           visa_rejection_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [targetStage, clearanceNumber, visaSubmittedDate, visaApprovedDate, nextRejectionReason, booking.id]
    );

    if (['submitted_to_doi', 'under_review', 'approved', 'clearance_letter_issued', 'rejected'].includes(targetStage)) {
      await db.run('UPDATE travelers SET visa_status = ? WHERE booking_id = ?', [targetStage, booking.id]);
    }

    await insertAuditLog(db, {
      user: req.user,
      action: 'visa.status_change',
      entityType: 'booking',
      entityId: booking.id,
      oldValue: booking.visa_status,
      newValue: `${targetStage}${clearanceNumber ? ` (${clearanceNumber})` : ''}`,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    const eventMap = {
      submitted_to_doi: 'visa_submitted',
      approved: 'visa_approved',
      clearance_letter_issued: 'clearance_issued',
      rejected: 'visa_rejected'
    };
    const notif = await dispatchNotification(eventMap[targetStage] || 'visa_update', {
      booking: updated,
      booking_id: updated.id,
      recipient_type: 'client',
      recipient_phone: updated.lead_phone,
      recipient_email: updated.lead_email
    });

    return res.json({
      success: true,
      message: `Visa status updated to ${targetStage}`,
      visa_status: targetStage,
      visa_clearance_number: clearanceNumber,
      booking: updated,
      whatsapp_share_url: notif.whatsapp_share_url
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/bookings/:id/assign-guide - Assign licensed guide with date overlap guard
router.patch('/bookings/:id/assign-guide', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const guideId = parsePositiveId(body.guide_id);
    if (!guideId) {
      return res.status(400).json({ success: false, error: 'Valid guide_id is required.' });
    }

    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const guide = await db.get(
      "SELECT id, full_name, email, phone, license_no FROM users WHERE id = ? AND role = 'guide' AND is_active = 1",
      [guideId]
    );
    if (!guide) {
      return res.status(404).json({ success: false, error: 'Active licensed guide not found' });
    }

    const vehiclePlate = normalizeOptionalText(body.vehicle_plate ?? body.assigned_vehicle, 100) || 'Toyota Coaster / Prado SUV';
    const driverName = normalizeOptionalText(body.driver_name, 255);
    const dailyRate = body.daily_rate_usd !== undefined && body.daily_rate_usd !== null && body.daily_rate_usd !== ''
      ? Math.round(Number(body.daily_rate_usd))
      : null;
    const guideNotes = normalizeOptionalText(body.guide_notes, 1000);

    const assignment = await db.transaction(async (tx) => {
      const conflict = await checkGuideOverlap(tx, {
        guideId: guide.id,
        excludeBookingId: booking.id,
        startDate: booking.travel_date_start,
        endDate: booking.travel_date_end
      });
      if (conflict) {
        const err = new Error(
          `Guide ${guide.full_name} is already assigned to overlapping booking ${conflict.booking_id} (${conflict.start_date} to ${conflict.end_date}).`
        );
        err.status = 409;
        err.conflicting_booking_id = conflict.booking_id;
        throw err;
      }

      await tx.run(
        "UPDATE guide_assignments SET status = 'cancelled' WHERE booking_id = ? AND status <> 'cancelled'",
        [booking.id]
      );

      await tx.run(
        'UPDATE bookings SET assigned_guide_id = ?, assigned_vehicle = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [guide.id, vehiclePlate, booking.id]
      );

      const ins = await tx.run(
        `INSERT INTO guide_assignments (
          guide_id, booking_id, start_date, end_date, vehicle_plate, driver_name, daily_rate_usd, status, guide_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
        [guide.id, booking.id, booking.travel_date_start, booking.travel_date_end, vehiclePlate, driverName, dailyRate, guideNotes]
      );

      await insertAuditLog(tx, {
        user: req.user,
        action: 'guide.assigned',
        entityType: 'booking',
        entityId: booking.id,
        oldValue: booking.assigned_guide_id ? String(booking.assigned_guide_id) : null,
        newValue: `Assigned ${guide.full_name} (${vehiclePlate})`,
        ipAddress: req.ip
      });

      return tx.get('SELECT * FROM guide_assignments WHERE id = ?', [ins.lastInsertRowid]);
    });

    await dispatchNotification('guide_assignment', {
      booking,
      booking_id: booking.id,
      recipient_type: 'guide',
      recipient_id: guide.email,
      recipient_email: guide.email,
      recipient_phone: guide.phone,
      subject: `New Trip Assignment — ${booking.id}`,
      message: `You have been assigned to lead "${booking.tour_title}" (${booking.travel_date_start} to ${booking.travel_date_end}) for ${booking.lead_name}.`,
      action_url: `guide/trip-detail.html?id=${encodeURIComponent(booking.id)}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    const clientNotif = await dispatchNotification('guide_assignment', {
      booking: { ...booking, assigned_guide_id: guide.id, assigned_vehicle: vehiclePlate },
      booking_id: booking.id,
      recipient_type: 'client',
      recipient_phone: booking.lead_phone,
      recipient_email: booking.lead_email
    });

    return res.json({
      success: true,
      message: `Assigned guide ${guide.full_name} to booking ${booking.id}`,
      assignment,
      whatsapp_share_url: clientNotif.whatsapp_share_url
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        success: false,
        error: err.message,
        conflicting_booking_id: err.conflicting_booking_id
      });
    }
    return next(err);
  }
});

// DELETE /api/admin/bookings/:id - Super Admin cancel with unrefunded verified-payment guard
router.delete('/bookings/:id', staffSuper, async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const paidRow = await db.get(
      "SELECT COALESCE(SUM(amount_usd), 0) AS net_paid_usd FROM payments WHERE booking_id = ? AND status = 'verified'",
      [booking.id]
    );
    const netPaidUsd = Math.round(Number(paidRow?.net_paid_usd || 0));
    if (netPaidUsd > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot cancel/delete booking ${booking.id} while $${netPaidUsd} in verified payments remains unrefunded. Record a refund first.`
      });
    }

    const reason = normalizeOptionalText(req.body?.cancellation_reason, 1000) || 'Cancelled by super_admin';

    await db.transaction(async (tx) => {
      await tx.run(
        "UPDATE bookings SET booking_status = 'cancelled', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reason, booking.id]
      );
      await tx.run(
        "UPDATE guide_assignments SET status = 'cancelled' WHERE booking_id = ? AND status <> 'cancelled'",
        [booking.id]
      );
      await insertAuditLog(tx, {
        user: req.user,
        action: 'booking.cancelled',
        entityType: 'booking',
        entityId: booking.id,
        oldValue: booking.booking_status,
        newValue: `cancelled (${reason})`,
        ipAddress: req.ip
      });
    });

    return res.json({
      success: true,
      message: `Booking ${booking.id} cancelled`,
      booking_status: 'cancelled'
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/documents/:travelerId/:field - Private traveler document stream for staff
router.get('/documents/:travelerId/:field', staffDocQuery, async (req, res, next) => {
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
    if (!traveler) return res.status(404).json({ success: false, error: 'Traveler not found' });

    const relPath = traveler[field];
    if (!relPath) return res.status(404).json({ success: false, error: 'Document not uploaded yet' });

    const resolvedPath = resolveSafeUploadPath(relPath);
    if (!resolvedPath) {
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

// ==========================================
// 3. FINANCE, PAYMENT VERIFICATION, SDF REMITTANCE & CSV EXPORTS
// ==========================================

// GET /api/admin/payments/:id/receipt - Private payment receipt stream (must come before /payments if needed, distinct path)
router.get('/payments/:id/receipt', staffDocQuery, async (req, res, next) => {
  try {
    const paymentId = parsePositiveId(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Invalid payment ID' });
    }

    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (!payment.receipt_file) {
      return res.status(404).json({ success: false, error: 'No receipt file uploaded for this payment' });
    }

    const resolvedPath = resolveSafeUploadPath(payment.receipt_file);
    if (!resolvedPath) {
      return res.status(403).json({ success: false, error: 'Forbidden: invalid receipt path' });
    }
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: 'Receipt file missing on disk' });
    }

    return res.sendFile(resolvedPath);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/payments - List all payments with booking metadata
router.get('/payments', staffFinance, async (req, res, next) => {
  try {
    const { status, booking_id } = req.query;
    let sql = `
      SELECT p.*, b.lead_name, b.tour_title, b.total_price_usd, b.deposit_paid_usd, b.full_paid,
             b.currency AS booking_currency, b.nationality_type
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      sql += ' AND p.status = ?';
      params.push(String(status).trim());
    }
    if (booking_id && String(booking_id).trim()) {
      sql += ' AND LOWER(p.booking_id) = LOWER(?)';
      params.push(String(booking_id).trim());
    }

    sql += ' ORDER BY p.id DESC';
    const rows = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/bookings/:id/payments - Record wire/cash payment or refund
router.post('/bookings/:id/payments', staffFinance, async (req, res, next) => {
  try {
    const body = req.body || {};
    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const paymentType = normalizeOptionalText(body.payment_type, 50) || 'full_payment';
    const paymentMethod = normalizeOptionalText(body.payment_method, 50) || 'bank_transfer';
    const isRefund = paymentType.toLowerCase() === 'refund' || Number(body.amount_usd) < 0;

    const rawAmt = body.amount_usd ?? body.amount ?? body.amount_local;
    const absAmt = Math.abs(Math.round(Number(rawAmt)));
    if (!Number.isFinite(absAmt) || absAmt <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive payment amount_usd is required.' });
    }

    const currency = String(body.currency || booking.currency || 'USD').trim().toUpperCase();
    const rate = Number(booking.exchange_rate || 85) || 85;
    let amountUsd = currency === 'INR' ? Math.max(1, Math.round(absAmt / rate)) : absAmt;
    let amountLocal = currency === 'INR' ? absAmt : Math.round(amountUsd);

    if (body.amount_usd !== undefined && currency === 'INR') {
      amountUsd = absAmt;
      amountLocal = Math.round(absAmt * rate);
    }

    if (isRefund) {
      const currentPaid = Math.round(Number(booking.deposit_paid_usd || 0));
      if (amountUsd > currentPaid) {
        return res.status(400).json({
          success: false,
          error: `Refund ($${amountUsd}) exceeds current paid balance ($${currentPaid}).`
        });
      }
      amountUsd = -amountUsd;
      amountLocal = -amountLocal;
    }

    const txRef = normalizeOptionalText(body.transaction_ref, 100) || `TX-${Date.now()}`;
    const notes = normalizeOptionalText(body.notes, 500);

    const txRes = await db.transaction(async (tx) => {
      const ins = await tx.run(
        `INSERT INTO payments (
          booking_id, amount_usd, currency, amount_local, payment_type, payment_method,
          transaction_ref, status, verified_by, verified_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, CURRENT_TIMESTAMP, ?)`,
        [booking.id, amountUsd, currency, amountLocal, isRefund ? 'refund' : paymentType, paymentMethod, txRef, req.user.id, notes]
      );

      const balance = await recomputeBookingBalance(tx, booking);
      await insertAuditLog(tx, {
        user: req.user,
        action: isRefund ? 'payment.refunded' : 'payment.recorded',
        entityType: 'booking',
        entityId: booking.id,
        newValue: `${isRefund ? 'Refunded' : 'Recorded'} $${Math.abs(amountUsd)} USD (${txRef})`,
        ipAddress: req.ip
      });

      const paymentRow = await tx.get('SELECT * FROM payments WHERE id = ?', [ins.lastInsertRowid]);
      const updatedBooking = await tx.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
      return { paymentRow, updatedBooking, balance };
    });

    const notif = await dispatchNotification('payment_received', {
      booking: txRes.updatedBooking,
      booking_id: booking.id,
      recipient_type: 'client',
      recipient_phone: booking.lead_phone,
      recipient_email: booking.lead_email
    });

    return res.json({
      success: true,
      message: `${isRefund ? 'Refund' : 'Payment'} of $${Math.abs(amountUsd).toLocaleString()} recorded. Total received: $${txRes.balance.netPaidUsd.toLocaleString()}`,
      deposit_paid_usd: txRes.balance.netPaidUsd,
      full_paid: txRes.balance.isFullPaid,
      payment: txRes.paymentRow,
      booking: txRes.updatedBooking,
      whatsapp_share_url: notif.whatsapp_share_url
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/payments/:id/verify - Verify or reject pending client uploaded receipt
router.patch('/payments/:id/verify', staffFinance, async (req, res, next) => {
  try {
    const paymentId = parsePositiveId(req.params.id);
    if (!paymentId) return res.status(400).json({ success: false, error: 'Invalid payment ID' });

    const body = req.body || {};
    let nextStatus = String(body.status || '').trim().toLowerCase();
    if (!nextStatus && body.action) {
      nextStatus = body.action === 'verify' ? 'verified' : (body.action === 'reject' ? 'rejected' : '');
    }
    if (!['verified', 'rejected'].includes(nextStatus)) {
      return res.status(400).json({ success: false, error: "status must be 'verified' or 'rejected'." });
    }

    const notes = normalizeOptionalText(body.notes, 500);

    const txRes = await db.transaction(async (tx) => {
      const payment = await tx.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
      if (!payment) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }
      if (payment.status !== 'pending') {
        const err = new Error(`Payment #${paymentId} is already ${payment.status}.`);
        err.status = 400;
        throw err;
      }

      const booking = await tx.get('SELECT * FROM bookings WHERE id = ?', [payment.booking_id]);
      if (!booking) {
        const err = new Error('Associated booking not found');
        err.status = 404;
        throw err;
      }

      await tx.run(
        `UPDATE payments
         SET status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
         WHERE id = ?`,
        [nextStatus, req.user.id, notes, paymentId]
      );

      const balance = await recomputeBookingBalance(tx, booking);

      await insertAuditLog(tx, {
        user: req.user,
        action: nextStatus === 'verified' ? 'payment.verified' : 'payment.rejected',
        entityType: 'booking',
        entityId: booking.id,
        oldValue: 'pending',
        newValue: `${nextStatus} $${payment.amount_usd} USD (${payment.transaction_ref || payment.id})`,
        ipAddress: req.ip
      });

      const updatedPayment = await tx.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
      const updatedBooking = await tx.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
      return { updatedPayment, updatedBooking, balance };
    });

    const notif = await dispatchNotification('payment_received', {
      booking: txRes.updatedBooking,
      booking_id: txRes.updatedBooking.id,
      recipient_type: 'client',
      recipient_phone: txRes.updatedBooking.lead_phone,
      recipient_email: txRes.updatedBooking.lead_email,
      ...(nextStatus === 'rejected'
        ? {
          subject: `Payment Receipt Rejected — ${txRes.updatedBooking.id}`,
          message: `Your uploaded payment receipt for ${txRes.updatedBooking.id} could not be verified${notes ? `: ${notes}` : '. Please re-upload a clear wire slip.'}`
        }
        : {})
    });

    return res.json({
      success: true,
      message: `Payment #${paymentId} marked as ${nextStatus}.`,
      payment: txRes.updatedPayment,
      booking: txRes.updatedBooking,
      whatsapp_share_url: notif.whatsapp_share_url
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    return next(err);
  }
});

// PATCH /api/admin/bookings/:id/sdf-remit - Record RMA SDF government remittance
router.patch('/bookings/:id/sdf-remit', staffFinance, async (req, res, next) => {
  try {
    const booking = await db.get('SELECT * FROM bookings WHERE LOWER(id) = LOWER(?)', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const body = req.body || {};
    const ref = normalizeOptionalText(body.sdf_remittance_ref, 100) || `RMA-SDF-${new Date().getFullYear()}-${booking.id}`;
    const remittedAt = normalizeOptionalText(body.sdf_remitted_at, 64) || new Date().toISOString();

    await db.run(
      'UPDATE bookings SET sdf_remitted_at = ?, sdf_remittance_ref = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [remittedAt, ref, booking.id]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'sdf.remitted',
      entityType: 'booking',
      entityId: booking.id,
      oldValue: booking.sdf_remittance_ref || null,
      newValue: `${ref} ($${booking.sdf_total_usd} USD)`,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    return res.json({
      success: true,
      message: `SDF remittance recorded (${ref})`,
      booking: updated
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/reports/finance-csv - Formula-safe CSV ledger export
router.get('/reports/finance-csv', staffFinance, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT p.id, p.booking_id, b.lead_name, b.tour_title, p.amount_usd, p.currency, p.amount_local,
              p.payment_type, p.payment_method, p.transaction_ref, p.status, p.verified_at, p.created_at,
              b.sdf_total_usd, b.sdf_remittance_ref
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       ORDER BY p.id DESC`
    );

    const headers = [
      'Payment ID', 'Booking Ref', 'Lead Guest', 'Tour Package', 'Amount USD', 'Currency',
      'Amount Local', 'Type', 'Method', 'Transaction Ref', 'Status', 'Verified At',
      'Booking SDF USD', 'SDF Remittance Ref', 'Created At'
    ];
    const dataRows = rows.map((r) => [
      r.id, r.booking_id, r.lead_name, r.tour_title, r.amount_usd, r.currency,
      r.amount_local, r.payment_type, r.payment_method, r.transaction_ref, r.status,
      r.verified_at || '', r.sdf_total_usd, r.sdf_remittance_ref || '', r.created_at || ''
    ]);

    const csv = buildCsvContent(headers, dataRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bfr-finance-report.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/reports/bookings-csv - Formula-safe CSV bookings pipeline export
router.get('/reports/bookings-csv', staffAll, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM bookings ORDER BY created_at DESC, id DESC');
    const headers = [
      'Booking Ref', 'Lead Guest', 'Email', 'Phone', 'Country', 'Tour Title',
      'Start Date', 'End Date', 'Nights', 'Travelers', 'Hotel Tier',
      'Total USD', 'Paid USD', 'Full Paid', 'Booking Status', 'Visa Status',
      'Clearance No', 'Source'
    ];
    const dataRows = rows.map((b) => [
      b.id, b.lead_name, b.lead_email, b.lead_phone, b.lead_country, b.tour_title,
      b.travel_date_start, b.travel_date_end, b.total_nights, b.total_travelers, b.hotel_tier,
      b.total_price_usd, b.deposit_paid_usd, b.full_paid, b.booking_status, b.visa_status,
      b.visa_clearance_number || '', b.source || ''
    ]);

    const csv = buildCsvContent(headers, dataRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bfr-bookings-report.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 4. INQUIRIES CRM & CONVERSION
// ==========================================

router.get('/inquiries', staffAll, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM inquiries WHERE 1=1';
    const params = [];
    if (status && status !== 'All') {
      sql += ' AND status = ?';
      params.push(String(status).trim());
    }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(COALESCE(ref_code, \'\')) LIKE ?)';
      params.push(term, term, term);
    }
    sql += ' ORDER BY id DESC';
    const inquiries = await db.query(sql, params);
    return res.json({ success: true, count: inquiries.length, data: inquiries });
  } catch (err) {
    return next(err);
  }
});

router.patch('/inquiries/:id', staffOps, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid inquiry ID' });

    const existing = await db.get('SELECT * FROM inquiries WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Inquiry not found' });

    const body = req.body || {};
    const status = body.status !== undefined ? normalizeOptionalText(body.status, 50) : existing.status;
    const notes = body.internal_notes !== undefined ? normalizeOptionalText(body.internal_notes, 2000) : existing.internal_notes;
    const assignedTo = body.assigned_to !== undefined
      ? (body.assigned_to === null || body.assigned_to === '' ? null : parsePositiveId(body.assigned_to))
      : existing.assigned_to;

    await db.run(
      'UPDATE inquiries SET status = ?, internal_notes = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, assignedTo, id]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'inquiry.updated',
      entityType: 'inquiry',
      entityId: id,
      oldValue: existing.status,
      newValue: status,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM inquiries WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Inquiry updated', inquiry: updated });
  } catch (err) {
    return next(err);
  }
});

router.post('/inquiries/:id/convert', staffOps, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid inquiry ID' });

    const inquiry = await db.get('SELECT * FROM inquiries WHERE id = ?', [id]);
    if (!inquiry) return res.status(404).json({ success: false, error: 'Inquiry not found' });

    if (inquiry.status === 'converted' && inquiry.converted_booking_id) {
      return res.status(409).json({
        success: false,
        error: `Inquiry already converted to booking ${inquiry.converted_booking_id}.`
      });
    }

    const result = await createStaffAssistedBooking({
      body: req.body || {},
      staffUser: req.user,
      reqIp: req.ip,
      inquiry
    });
    return res.status(result.status).json(result.payload);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        success: false,
        error: err.message,
        conflicting_booking_id: err.conflicting_booking_id
      });
    }
    return next(err);
  }
});

// ==========================================
// 5. GUIDES ROSTER CRUD
// ==========================================

router.get('/guides', staffAll, async (req, res, next) => {
  try {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const [guides, assignments] = await Promise.all([
      db.query(
        `SELECT id, uuid, full_name, email, phone, role, avatar_url, license_no, languages, specialty, is_active, last_login, created_at
         FROM users
         WHERE role = 'guide' ${activeOnly ? 'AND is_active = 1' : ''}
         ORDER BY id ASC`
      ),
      db.query("SELECT guide_id, status FROM guide_assignments WHERE LOWER(COALESCE(status, '')) <> 'cancelled'")
    ]);

    const tripCounts = new Map();
    for (const a of assignments) {
      tripCounts.set(a.guide_id, (tripCounts.get(a.guide_id) || 0) + 1);
    }

    const data = guides.map((g) => ({
      ...g,
      active_trips_count: tripCounts.get(g.id) || 0
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/guides', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const fullName = normalizeOptionalText(body.full_name, 255);
    const email = normalizeOptionalText(body.email, 255)?.toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, error: 'full_name, email, and password are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    const uuid = `usr-guide-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = hashPassword(password);

    const ins = await db.run(
      `INSERT INTO users (uuid, full_name, email, phone, password_hash, role, license_no, languages, specialty, is_active)
       VALUES (?, ?, ?, ?, ?, 'guide', ?, ?, ?, ?)`,
      [
        uuid,
        fullName,
        email,
        normalizeOptionalText(body.phone, 50),
        passwordHash,
        normalizeOptionalText(body.license_no, 100),
        normalizeOptionalText(body.languages, 255),
        normalizeOptionalText(body.specialty, 255),
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
      ]
    );

    const created = await db.get('SELECT * FROM users WHERE id = ?', [ins.lastInsertRowid]);
    await insertAuditLog(db, {
      user: req.user,
      action: 'guide.created',
      entityType: 'user',
      entityId: created.id,
      newValue: `${created.full_name} (${created.email})`,
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, guide: sanitizeUser(created) });
  } catch (err) {
    return next(err);
  }
});

router.put('/guides/:id', staffOps, async (req, res, next) => {
  try {
    const guideId = parsePositiveId(req.params.id);
    if (!guideId) return res.status(400).json({ success: false, error: 'Invalid guide ID' });

    const guide = await db.get("SELECT * FROM users WHERE id = ? AND role = 'guide'", [guideId]);
    if (!guide) return res.status(404).json({ success: false, error: 'Guide not found' });

    const body = req.body || {};
    const nextEmail = body.email !== undefined ? normalizeOptionalText(body.email, 255)?.toLowerCase() : guide.email;
    if (!nextEmail || !EMAIL_RE.test(nextEmail)) {
      return res.status(400).json({ success: false, error: 'Valid email is required.' });
    }
    if (nextEmail !== guide.email.toLowerCase()) {
      const dup = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?', [nextEmail, guideId]);
      if (dup) return res.status(409).json({ success: false, error: 'Email already used by another account.' });
    }

    const nextHash = (typeof body.password === 'string' && body.password.trim())
      ? hashPassword(body.password)
      : guide.password_hash;

    await db.run(
      `UPDATE users
       SET full_name = ?, email = ?, phone = ?, license_no = ?, languages = ?, specialty = ?,
           is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.full_name !== undefined ? (normalizeOptionalText(body.full_name, 255) || guide.full_name) : guide.full_name,
        nextEmail,
        body.phone !== undefined ? normalizeOptionalText(body.phone, 50) : guide.phone,
        body.license_no !== undefined ? normalizeOptionalText(body.license_no, 100) : guide.license_no,
        body.languages !== undefined ? normalizeOptionalText(body.languages, 255) : guide.languages,
        body.specialty !== undefined ? normalizeOptionalText(body.specialty, 255) : guide.specialty,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : guide.is_active,
        nextHash,
        guideId
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'guide.updated',
      entityType: 'user',
      entityId: guideId,
      newValue: body.full_name || guide.full_name,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [guideId]);
    return res.json({ success: true, guide: sanitizeUser(updated) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/guides/:id/toggle', staffOps, async (req, res, next) => {
  try {
    const guideId = parsePositiveId(req.params.id);
    if (!guideId) return res.status(400).json({ success: false, error: 'Invalid guide ID' });

    const guide = await db.get("SELECT * FROM users WHERE id = ? AND role = 'guide'", [guideId]);
    if (!guide) return res.status(404).json({ success: false, error: 'Guide not found' });

    const nextActive = Number(guide.is_active) === 1 ? 0 : 1;
    await db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextActive, guideId]);

    await insertAuditLog(db, {
      user: req.user,
      action: 'guide.status_toggle',
      entityType: 'user',
      entityId: guideId,
      oldValue: String(guide.is_active),
      newValue: String(nextActive),
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Guide "${guide.full_name}" is now ${nextActive === 1 ? 'Active' : 'Inactive'}`,
      is_active: nextActive
    });
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 6. CATALOG & CONTENT CMS (TOURS, DESTINATIONS, FESTIVALS, REVIEWS)
// ==========================================

function formatTourRow(t) {
  return {
    ...t,
    itinerary: parseJsonSafe(t.itinerary_json, []),
    inclusions: parseJsonSafe(t.inclusions_json, []),
    exclusions: parseJsonSafe(t.exclusions_json, [])
  };
}

router.get('/tours', staffAll, async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    let sql = 'SELECT * FROM tours WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND LOWER(category) LIKE ?';
      params.push(`%${String(category).trim().toLowerCase()}%`);
    }
    if (status === 'active') sql += ' AND is_active = 1';
    else if (status === 'inactive') sql += ' AND is_active = 0';

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(valleys) LIKE ? OR LOWER(category) LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY sort_order ASC, id ASC';
    const [rows, totalRow, activeRow] = await Promise.all([
      db.query(sql, params),
      db.get('SELECT COUNT(*) AS count FROM tours'),
      db.get('SELECT COUNT(*) AS count FROM tours WHERE is_active = 1')
    ]);

    const tours = rows.map(formatTourRow);
    const totalCount = Number(totalRow?.count || 0);
    const activeCount = Number(activeRow?.count || 0);

    return res.json({
      success: true,
      count: tours.length,
      total_count: totalCount,
      active_count: activeCount,
      inactive_count: totalCount - activeCount,
      data: tours
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/tours/:id', staffAll, async (req, res, next) => {
  try {
    const tour = await db.get('SELECT * FROM tours WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });
    return res.json({ success: true, data: formatTourRow(tour) });
  } catch (err) {
    return next(err);
  }
});

router.post('/tours', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = normalizeOptionalText(body.title, 255);
    const price = parseStrictPositiveInt(body.price_usd);
    if (!title || price === null) {
      return res.status(400).json({ success: false, error: 'Tour title and positive price_usd are required.' });
    }

    const cleanId = slugifyClean(body.slug || body.id || title, 'tour-');
    if (!cleanId) return res.status(400).json({ success: false, error: 'Valid slug or title is required.' });
    const tourSlug = `tour-${cleanId}.html`;

    const existing = await db.get('SELECT id FROM tours WHERE id = ? OR slug = ?', [cleanId, tourSlug]);
    if (existing) {
      return res.status(409).json({ success: false, error: `Tour "${cleanId}" or slug "${tourSlug}" already exists.` });
    }

    const days = parseStrictPositiveInt(body.duration_days) || 7;
    const nights = body.duration_nights !== undefined
      ? (parseStrictPositiveInt(body.duration_nights) || Math.max(1, days - 1))
      : Math.max(1, days - 1);
    const p3 = body.price_3star_usd ? (parseStrictPositiveInt(body.price_3star_usd) || price) : price;
    const p4 = body.price_4star_usd ? (parseStrictPositiveInt(body.price_4star_usd) || Math.round(price * 1.25)) : Math.round(price * 1.25);
    const p5 = body.price_5star_usd ? (parseStrictPositiveInt(body.price_5star_usd) || Math.round(price * 1.6)) : Math.round(price * 1.6);

    const incJson = serializeJsonField(
      body.inclusions,
      '["Licensed English Guide","SDF Included","All Transfers","Meals & 3-Star Hotels"]',
      { splitLines: true }
    );
    const excJson = serializeJsonField(body.exclusions, '[]', { splitLines: true });
    const itinJson = serializeJsonField(body.itinerary, '[]');

    await db.run(
      `INSERT INTO tours (
        id, slug, title, subtitle, category, difficulty, duration_days, duration_nights,
        group_size_min, group_size_max,
        price_usd, price_3star_usd, price_4star_usd, price_5star_usd,
        valleys, cover_image, highlight_text,
        inclusions_json, exclusions_json, itinerary_json,
        is_featured, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanId,
        tourSlug,
        title,
        normalizeOptionalText(body.subtitle, 500) || `${days} Days / ${nights} Nights Bhutan Journey`,
        normalizeOptionalText(body.category, 100) || 'Cultural Heritage',
        normalizeOptionalText(body.difficulty, 50) || 'Easy to Moderate',
        days,
        nights,
        parseStrictPositiveInt(body.group_size_min) || 1,
        parseStrictPositiveInt(body.group_size_max) || 20,
        price,
        p3,
        p4,
        p5,
        normalizeOptionalText(body.valleys, 500) || 'Paro, Thimphu, Punakha',
        normalizeOptionalText(body.cover_image, 500) || 'assets/images/tigers-nest.webp',
        normalizeOptionalText(body.highlight_text, 1000) || title,
        incJson,
        excJson,
        itinJson,
        body.is_featured ? 1 : 0,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
        parseStrictNonNegativeInt(body.sort_order) ?? 99
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'tour.created',
      entityType: 'tour',
      entityId: cleanId,
      newValue: `Created tour: ${title} ($${price})`,
      ipAddress: req.ip
    });

    const created = await db.get('SELECT * FROM tours WHERE id = ?', [cleanId]);
    return res.status(201).json({
      success: true,
      message: `Tour "${title}" created successfully`,
      tour: formatTourRow(created)
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/tours/:id', staffOps, async (req, res, next) => {
  try {
    const tour = await db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const body = req.body || {};
    const days = body.duration_days !== undefined ? (parseStrictPositiveInt(body.duration_days) || tour.duration_days) : tour.duration_days;
    const nights = body.duration_nights !== undefined ? (parseStrictPositiveInt(body.duration_nights) || tour.duration_nights) : tour.duration_nights;
    const price = body.price_usd !== undefined ? (parseStrictPositiveInt(body.price_usd) || tour.price_usd) : tour.price_usd;
    const p3 = body.price_3star_usd !== undefined ? (parseStrictPositiveInt(body.price_3star_usd) || tour.price_3star_usd) : tour.price_3star_usd;
    const p4 = body.price_4star_usd !== undefined ? (parseStrictPositiveInt(body.price_4star_usd) || tour.price_4star_usd) : tour.price_4star_usd;
    const p5 = body.price_5star_usd !== undefined ? (parseStrictPositiveInt(body.price_5star_usd) || tour.price_5star_usd) : tour.price_5star_usd;

    const incJson = body.inclusions !== undefined
      ? serializeJsonField(body.inclusions, '[]', { splitLines: true })
      : (typeof tour.inclusions_json === 'string' ? tour.inclusions_json : JSON.stringify(tour.inclusions_json || []));
    const excJson = body.exclusions !== undefined
      ? serializeJsonField(body.exclusions, '[]', { splitLines: true })
      : (typeof tour.exclusions_json === 'string' ? tour.exclusions_json : JSON.stringify(tour.exclusions_json || []));
    const itinJson = body.itinerary !== undefined
      ? serializeJsonField(body.itinerary, '[]')
      : (typeof tour.itinerary_json === 'string' ? tour.itinerary_json : JSON.stringify(tour.itinerary_json || []));

    const nextActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : tour.is_active;

    await db.run(
      `UPDATE tours SET
        title = ?, subtitle = ?, category = ?, difficulty = ?,
        duration_days = ?, duration_nights = ?,
        group_size_min = ?, group_size_max = ?,
        price_usd = ?, price_3star_usd = ?, price_4star_usd = ?, price_5star_usd = ?,
        valleys = ?, cover_image = ?, highlight_text = ?,
        inclusions_json = ?, exclusions_json = ?, itinerary_json = ?,
        is_featured = ?, is_active = ?, sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.title !== undefined ? normalizeOptionalText(body.title, 255) || tour.title : tour.title,
        body.subtitle !== undefined ? normalizeOptionalText(body.subtitle, 500) : tour.subtitle,
        body.category !== undefined ? normalizeOptionalText(body.category, 100) || tour.category : tour.category,
        body.difficulty !== undefined ? normalizeOptionalText(body.difficulty, 50) || tour.difficulty : tour.difficulty,
        days,
        nights,
        body.group_size_min !== undefined ? (parseStrictPositiveInt(body.group_size_min) || tour.group_size_min) : tour.group_size_min,
        body.group_size_max !== undefined ? (parseStrictPositiveInt(body.group_size_max) || tour.group_size_max) : tour.group_size_max,
        price,
        p3,
        p4,
        p5,
        body.valleys !== undefined ? normalizeOptionalText(body.valleys, 500) || tour.valleys : tour.valleys,
        body.cover_image !== undefined ? normalizeOptionalText(body.cover_image, 500) : tour.cover_image,
        body.highlight_text !== undefined ? normalizeOptionalText(body.highlight_text, 1000) : tour.highlight_text,
        incJson,
        excJson,
        itinJson,
        body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : tour.is_featured,
        nextActive,
        body.sort_order !== undefined ? (parseStrictNonNegativeInt(body.sort_order) ?? tour.sort_order) : tour.sort_order,
        tour.id
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'tour.updated',
      entityType: 'tour',
      entityId: tour.id,
      oldValue: `Price: $${tour.price_usd}, Active: ${tour.is_active}`,
      newValue: `Price: $${price}, Active: ${nextActive}`,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM tours WHERE id = ?', [tour.id]);
    return res.json({
      success: true,
      message: `Tour "${updated.title}" updated successfully`,
      tour_id: tour.id,
      tour: formatTourRow(updated)
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/tours/:id/toggle', staffOps, async (req, res, next) => {
  try {
    const tour = await db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const newStatus = Number(tour.is_active) === 1 ? 0 : 1;
    await db.run('UPDATE tours SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, tour.id]);

    await insertAuditLog(db, {
      user: req.user,
      action: 'tour.status_toggle',
      entityType: 'tour',
      entityId: tour.id,
      oldValue: `Active: ${tour.is_active}`,
      newValue: `Active: ${newStatus}`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Tour "${tour.title}" is now ${newStatus === 1 ? 'Active' : 'Inactive'}`,
      is_active: newStatus
    });
  } catch (err) {
    return next(err);
  }
});

router.delete('/tours/:id', staffOps, async (req, res, next) => {
  try {
    const tour = await db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    await db.run('UPDATE bookings SET tour_id = NULL WHERE tour_id = ?', [tour.id]);
    await db.run('UPDATE festivals SET related_tour_id = NULL WHERE related_tour_id = ?', [tour.id]);
    await db.run('DELETE FROM tours WHERE id = ?', [tour.id]);

    await insertAuditLog(db, {
      user: req.user,
      action: 'tour.deleted',
      entityType: 'tour',
      entityId: tour.id,
      oldValue: `Deleted tour: ${tour.title} ($${tour.price_usd})`,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Tour "${tour.title}" deleted from catalog` });
  } catch (err) {
    return next(err);
  }
});

// --- Destinations CMS ---
function formatDestinationRow(d) {
  return { ...d, highlights: parseJsonSafe(d.highlights_json, []) };
}

router.get('/destinations', staffAll, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM destinations ORDER BY sort_order ASC, name ASC');
    return res.json({ success: true, count: rows.length, data: rows.map(formatDestinationRow) });
  } catch (err) {
    return next(err);
  }
});

router.get('/destinations/:id', staffAll, async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM destinations WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Destination not found' });
    return res.json({ success: true, data: formatDestinationRow(row) });
  } catch (err) {
    return next(err);
  }
});

router.post('/destinations', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = normalizeOptionalText(body.name, 255);
    const description = normalizeOptionalText(body.description, 4000);
    if (!name || !description) {
      return res.status(400).json({ success: false, error: 'Destination name and description are required.' });
    }

    const cleanId = slugifyClean(body.id || body.slug || name, 'destination-');
    if (!cleanId) return res.status(400).json({ success: false, error: 'Valid destination id/name is required.' });
    const slug = `destination-${cleanId}.html`;

    const existing = await db.get('SELECT id FROM destinations WHERE id = ? OR slug = ?', [cleanId, slug]);
    if (existing) {
      return res.status(409).json({ success: false, error: `Destination "${cleanId}" already exists.` });
    }

    const highlightsJson = serializeJsonField(body.highlights ?? body.highlights_json, '[]', { splitLines: true });
    await db.run(
      `INSERT INTO destinations (
        id, name, slug, tagline, altitude_meters, region, description, highlights_json,
        best_months, cover_image, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanId,
        name,
        slug,
        normalizeOptionalText(body.tagline, 500),
        body.altitude_meters !== undefined && body.altitude_meters !== '' ? Math.round(Number(body.altitude_meters)) : null,
        normalizeOptionalText(body.region, 50) || 'Western',
        description,
        highlightsJson,
        normalizeOptionalText(body.best_months, 100) || 'Mar - May, Sep - Nov',
        normalizeOptionalText(body.cover_image, 500) || 'assets/images/dochula-pass.webp',
        parseStrictNonNegativeInt(body.sort_order) ?? 99,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'destination.created',
      entityType: 'destination',
      entityId: cleanId,
      newValue: name,
      ipAddress: req.ip
    });

    const created = await db.get('SELECT * FROM destinations WHERE id = ?', [cleanId]);
    return res.status(201).json({ success: true, destination: formatDestinationRow(created) });
  } catch (err) {
    return next(err);
  }
});

router.put('/destinations/:id', staffOps, async (req, res, next) => {
  try {
    const dest = await db.get('SELECT * FROM destinations WHERE id = ?', [req.params.id]);
    if (!dest) return res.status(404).json({ success: false, error: 'Destination not found' });

    const body = req.body || {};
    const highlightsJson = (body.highlights !== undefined || body.highlights_json !== undefined)
      ? serializeJsonField(body.highlights ?? body.highlights_json, '[]', { splitLines: true })
      : (typeof dest.highlights_json === 'string' ? dest.highlights_json : JSON.stringify(dest.highlights_json || []));

    await db.run(
      `UPDATE destinations
       SET name = ?, tagline = ?, altitude_meters = ?, region = ?, description = ?,
           highlights_json = ?, best_months = ?, cover_image = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        body.name !== undefined ? normalizeOptionalText(body.name, 255) || dest.name : dest.name,
        body.tagline !== undefined ? normalizeOptionalText(body.tagline, 500) : dest.tagline,
        body.altitude_meters !== undefined ? (body.altitude_meters === '' || body.altitude_meters === null ? null : Math.round(Number(body.altitude_meters))) : dest.altitude_meters,
        body.region !== undefined ? normalizeOptionalText(body.region, 50) : dest.region,
        body.description !== undefined ? normalizeOptionalText(body.description, 4000) || dest.description : dest.description,
        highlightsJson,
        body.best_months !== undefined ? normalizeOptionalText(body.best_months, 100) : dest.best_months,
        body.cover_image !== undefined ? normalizeOptionalText(body.cover_image, 500) : dest.cover_image,
        body.sort_order !== undefined ? (parseStrictNonNegativeInt(body.sort_order) ?? dest.sort_order) : dest.sort_order,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : dest.is_active,
        dest.id
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'destination.updated',
      entityType: 'destination',
      entityId: dest.id,
      newValue: body.name || dest.name,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM destinations WHERE id = ?', [dest.id]);
    return res.json({ success: true, destination: formatDestinationRow(updated) });
  } catch (err) {
    return next(err);
  }
});

// --- Festivals CMS ---
function formatFestivalRow(f) {
  return { ...f, highlights: parseJsonSafe(f.highlights_json, []) };
}

router.get('/festivals', staffAll, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM festivals ORDER BY sort_order ASC, name ASC');
    return res.json({ success: true, count: rows.length, data: rows.map(formatFestivalRow) });
  } catch (err) {
    return next(err);
  }
});

router.get('/festivals/:id', staffAll, async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM festivals WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Festival not found' });
    return res.json({ success: true, data: formatFestivalRow(row) });
  } catch (err) {
    return next(err);
  }
});

router.post('/festivals', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = normalizeOptionalText(body.name, 255);
    const summary = normalizeOptionalText(body.summary, 4000);
    if (!name || !summary) {
      return res.status(400).json({ success: false, error: 'Festival name and summary are required.' });
    }

    const cleanId = slugifyClean(body.id || body.slug || name, 'festival-');
    if (!cleanId) return res.status(400).json({ success: false, error: 'Valid festival id/name is required.' });
    const slug = `festival-${cleanId}.html`;

    const existing = await db.get('SELECT id FROM festivals WHERE id = ? OR slug = ?', [cleanId, slug]);
    if (existing) {
      return res.status(409).json({ success: false, error: `Festival "${cleanId}" already exists.` });
    }

    const relatedTourId = normalizeOptionalText(body.related_tour_id, 100);
    if (relatedTourId) {
      const tour = await db.get('SELECT id FROM tours WHERE id = ?', [relatedTourId]);
      if (!tour) return res.status(400).json({ success: false, error: 'Invalid related_tour_id.' });
    }

    const highlightsJson = serializeJsonField(body.highlights ?? body.highlights_json, '[]', { splitLines: true });
    await db.run(
      `INSERT INTO festivals (
        id, name, slug, season, dates_label, venue, valley, duration_days, price_usd,
        summary, etiquette, highlights_json, related_tour_id, cover_image,
        is_featured, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanId,
        name,
        slug,
        normalizeOptionalText(body.season, 100),
        normalizeOptionalText(body.dates_label, 150),
        normalizeOptionalText(body.venue, 255),
        normalizeOptionalText(body.valley, 100),
        parseStrictPositiveInt(body.duration_days) || 3,
        body.price_usd !== undefined && body.price_usd !== '' ? Math.round(Number(body.price_usd)) : null,
        summary,
        normalizeOptionalText(body.etiquette, 2000),
        highlightsJson,
        relatedTourId,
        normalizeOptionalText(body.cover_image, 500) || 'assets/images/thimphu-festival.webp',
        body.is_featured ? 1 : 0,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
        parseStrictNonNegativeInt(body.sort_order) ?? 99
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'festival.created',
      entityType: 'festival',
      entityId: cleanId,
      newValue: name,
      ipAddress: req.ip
    });

    const created = await db.get('SELECT * FROM festivals WHERE id = ?', [cleanId]);
    return res.status(201).json({ success: true, festival: formatFestivalRow(created) });
  } catch (err) {
    return next(err);
  }
});

router.put('/festivals/:id', staffOps, async (req, res, next) => {
  try {
    const fest = await db.get('SELECT * FROM festivals WHERE id = ?', [req.params.id]);
    if (!fest) return res.status(404).json({ success: false, error: 'Festival not found' });

    const body = req.body || {};
    let relatedTourId = fest.related_tour_id;
    if (body.related_tour_id !== undefined) {
      relatedTourId = normalizeOptionalText(body.related_tour_id, 100);
      if (relatedTourId) {
        const tour = await db.get('SELECT id FROM tours WHERE id = ?', [relatedTourId]);
        if (!tour) return res.status(400).json({ success: false, error: 'Invalid related_tour_id.' });
      }
    }

    const highlightsJson = (body.highlights !== undefined || body.highlights_json !== undefined)
      ? serializeJsonField(body.highlights ?? body.highlights_json, '[]', { splitLines: true })
      : (typeof fest.highlights_json === 'string' ? fest.highlights_json : JSON.stringify(fest.highlights_json || []));

    await db.run(
      `UPDATE festivals
       SET name = ?, season = ?, dates_label = ?, venue = ?, valley = ?, duration_days = ?,
           price_usd = ?, summary = ?, etiquette = ?, highlights_json = ?, related_tour_id = ?,
           cover_image = ?, is_featured = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.name !== undefined ? normalizeOptionalText(body.name, 255) || fest.name : fest.name,
        body.season !== undefined ? normalizeOptionalText(body.season, 100) : fest.season,
        body.dates_label !== undefined ? normalizeOptionalText(body.dates_label, 150) : fest.dates_label,
        body.venue !== undefined ? normalizeOptionalText(body.venue, 255) : fest.venue,
        body.valley !== undefined ? normalizeOptionalText(body.valley, 100) : fest.valley,
        body.duration_days !== undefined ? (parseStrictPositiveInt(body.duration_days) || fest.duration_days) : fest.duration_days,
        body.price_usd !== undefined ? (body.price_usd === '' || body.price_usd === null ? null : Math.round(Number(body.price_usd))) : fest.price_usd,
        body.summary !== undefined ? normalizeOptionalText(body.summary, 4000) || fest.summary : fest.summary,
        body.etiquette !== undefined ? normalizeOptionalText(body.etiquette, 2000) : fest.etiquette,
        highlightsJson,
        relatedTourId,
        body.cover_image !== undefined ? normalizeOptionalText(body.cover_image, 500) : fest.cover_image,
        body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : fest.is_featured,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : fest.is_active,
        body.sort_order !== undefined ? (parseStrictNonNegativeInt(body.sort_order) ?? fest.sort_order) : fest.sort_order,
        fest.id
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'festival.updated',
      entityType: 'festival',
      entityId: fest.id,
      newValue: body.name || fest.name,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM festivals WHERE id = ?', [fest.id]);
    return res.json({ success: true, festival: formatFestivalRow(updated) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/festivals/:id/toggle', staffOps, async (req, res, next) => {
  try {
    const fest = await db.get('SELECT * FROM festivals WHERE id = ?', [req.params.id]);
    if (!fest) return res.status(404).json({ success: false, error: 'Festival not found' });

    const nextActive = Number(fest.is_active) === 1 ? 0 : 1;
    await db.run('UPDATE festivals SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextActive, fest.id]);

    await insertAuditLog(db, {
      user: req.user,
      action: 'festival.status_toggle',
      entityType: 'festival',
      entityId: fest.id,
      oldValue: String(fest.is_active),
      newValue: String(nextActive),
      ipAddress: req.ip
    });

    return res.json({ success: true, is_active: nextActive });
  } catch (err) {
    return next(err);
  }
});

router.delete('/festivals/:id', staffOps, async (req, res, next) => {
  try {
    const fest = await db.get('SELECT * FROM festivals WHERE id = ?', [req.params.id]);
    if (!fest) return res.status(404).json({ success: false, error: 'Festival not found' });

    await db.run('DELETE FROM festivals WHERE id = ?', [fest.id]);
    await insertAuditLog(db, {
      user: req.user,
      action: 'festival.deleted',
      entityType: 'festival',
      entityId: fest.id,
      oldValue: fest.name,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Festival "${fest.name}" deleted` });
  } catch (err) {
    return next(err);
  }
});

// --- Reviews Moderation ---
router.get('/reviews', staffAll, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM reviews ORDER BY id DESC');
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return next(err);
  }
});

router.patch('/reviews/:id', staffOps, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid review ID' });

    const rev = await db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!rev) return res.status(404).json({ success: false, error: 'Review not found' });

    const body = req.body || {};
    const isPublished = body.is_published !== undefined ? (body.is_published ? 1 : 0) : rev.is_published;
    const isFeatured = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : rev.is_featured;
    const isVerified = body.is_verified !== undefined ? (body.is_verified ? 1 : 0) : rev.is_verified;
    const adminResponse = body.admin_response !== undefined
      ? normalizeOptionalText(body.admin_response, 2000)
      : rev.admin_response;

    await db.run(
      'UPDATE reviews SET is_published = ?, is_featured = ?, is_verified = ?, admin_response = ? WHERE id = ?',
      [isPublished, isFeatured, isVerified, adminResponse, id]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'review.moderated',
      entityType: 'review',
      entityId: id,
      oldValue: `published=${rev.is_published}, featured=${rev.is_featured}`,
      newValue: `published=${isPublished}, featured=${isFeatured}`,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    return res.json({ success: true, review: updated });
  } catch (err) {
    return next(err);
  }
});

router.delete('/reviews/:id', staffOps, async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid review ID' });

    const rev = await db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!rev) return res.status(404).json({ success: false, error: 'Review not found' });

    await db.run('DELETE FROM reviews WHERE id = ?', [id]);
    await insertAuditLog(db, {
      user: req.user,
      action: 'review.deleted',
      entityType: 'review',
      entityId: id,
      oldValue: rev.author_name,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 7. SETTINGS, TEST NOTIFICATION, STAFF USERS, AUDIT & NOTIFICATIONS
// ==========================================

router.get('/settings', staffAll, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM settings ORDER BY category ASC, key ASC');
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const safeRows = rows.map((r) => {
      if (!isAdmin && SECRET_SETTING_KEYS.has(r.key) && r.value) {
        return { ...r, value: '********' };
      }
      return r;
    });
    const map = {};
    for (const r of safeRows) map[r.key] = r.value;
    return res.json({ success: true, data: safeRows, settings: map });
  } catch (err) {
    return next(err);
  }
});

router.put('/settings', staffAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const entries = [];

    if (Array.isArray(body)) {
      for (const item of body) {
        if (item && item.key) entries.push([String(item.key).trim(), String(item.value ?? '')]);
      }
    } else if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
      for (const [k, v] of Object.entries(body.settings)) {
        entries.push([String(k).trim(), String(v ?? '')]);
      }
    } else {
      for (const [k, v] of Object.entries(body)) {
        if (k !== 'user_name') entries.push([String(k).trim(), String(v ?? '')]);
      }
    }

    const filtered = entries.filter(([k, v]) => k && !(SECRET_SETTING_KEYS.has(k) && v === '********'));
    if (filtered.length === 0) {
      return res.status(400).json({ success: false, error: 'No settings provided to save.' });
    }

    await db.transaction(async (tx) => {
      for (const [key, value] of filtered) {
        await tx.run(
          `INSERT INTO settings (key, value, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [key, value]
        );
      }

      const safeKeys = filtered.map(([k]) => k).join(', ');
      await insertAuditLog(tx, {
        user: req.user,
        action: 'settings.updated',
        entityType: 'settings',
        entityId: 'system',
        newValue: `Updated keys: ${safeKeys}`,
        ipAddress: req.ip
      });
    });

    return res.json({ success: true, message: 'Settings saved', updated_count: filtered.length });
  } catch (err) {
    return next(err);
  }
});

router.post('/settings/test-notification', staffAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await dispatchNotification('test_notification', {
      recipient_type: 'admin',
      recipient: req.user.email,
      recipient_email: normalizeOptionalText(body.email, 255) || req.user.email,
      recipient_phone: normalizeOptionalText(body.phone, 50) || undefined,
      channel: normalizeOptionalText(body.channel, 50) || 'in_app',
      subject: normalizeOptionalText(body.subject, 255) || 'System Integration Test — Bhutan Fast Rate Tours',
      message: normalizeOptionalText(body.message, 1000) || 'Test notification dispatched from Admin Platform Settings.'
    });

    return res.json({ success: true, message: 'Test notification dispatched', result });
  } catch (err) {
    return next(err);
  }
});

// --- Built-In WhatsApp Web QR Integration ---
router.get('/whatsapp/status', staffOps, (req, res) => {
  return res.json({ success: true, data: whatsappQr.getStatus() });
});

router.post('/whatsapp/connect', staffOps, async (req, res, next) => {
  try {
    const status = await whatsappQr.connect({ fresh: Boolean(req.body && req.body.fresh) });
    return res.json({ success: true, data: status });
  } catch (err) {
    return next(err);
  }
});

router.post('/whatsapp/disconnect', staffOps, async (req, res, next) => {
  try {
    const status = await whatsappQr.disconnect();
    await insertAuditLog(db, {
      user: req.user,
      action: 'whatsapp.disconnect',
      entityType: 'system',
      entityId: 'whatsapp_qr',
      newValue: 'Disconnected linked WhatsApp Web session',
      ipAddress: req.ip
    });
    return res.json({ success: true, data: status });
  } catch (err) {
    return next(err);
  }
});

router.post('/whatsapp/test', staffOps, async (req, res, next) => {
  try {
    const body = req.body || {};
    const phone = normalizeOptionalText(body.phone, 50);
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Recipient phone number with country code is required.' });
    }
    const message = normalizeOptionalText(body.message, 1500) ||
      'Kuzuzangpo La! Test alert from Bhutan Fast Rate Tours Operations Center (#TR/2018/9882).';
    if (!whatsappQr.isConnected()) {
      return res.status(400).json({ success: false, error: 'WhatsApp Web QR session is not connected yet. Scan the QR code first.' });
    }
    const delivery = await whatsappQr.sendTextMessage(phone, message);
    if (delivery.status !== 'sent') {
      return res.status(502).json({ success: false, error: delivery.error || 'WhatsApp send failed' });
    }
    return res.json({ success: true, message: `Test WhatsApp sent to ${phone}`, delivery });
  } catch (err) {
    return next(err);
  }
});

// --- Staff Users Management (super_admin ONLY) ---
router.get('/users', staffSuper, async (req, res, next) => {
  try {
    const users = await db.query(
      `SELECT id, uuid, full_name, email, phone, role, avatar_url, license_no, languages, specialty, is_active, last_login, created_at
       FROM users
       ORDER BY id ASC`
    );
    return res.json({ success: true, count: users.length, data: users.map(sanitizeUser) });
  } catch (err) {
    return next(err);
  }
});

router.post('/users', staffSuper, async (req, res, next) => {
  try {
    const body = req.body || {};
    const fullName = normalizeOptionalText(body.full_name, 255);
    const email = normalizeOptionalText(body.email, 255)?.toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const role = String(body.role || '').trim();

    if (!fullName || !email || !password || !ALL_USER_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        error: 'full_name, email, password, and valid role (super_admin, admin, concierge, finance, guide) are required.'
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    const uuid = `usr-${role}-${crypto.randomBytes(4).toString('hex')}`;
    const ins = await db.run(
      `INSERT INTO users (uuid, full_name, email, phone, password_hash, role, license_no, languages, specialty, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        fullName,
        email,
        normalizeOptionalText(body.phone, 50),
        hashPassword(password),
        role,
        normalizeOptionalText(body.license_no, 100),
        normalizeOptionalText(body.languages, 255),
        normalizeOptionalText(body.specialty, 255),
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
      ]
    );

    const created = await db.get('SELECT * FROM users WHERE id = ?', [ins.lastInsertRowid]);
    await insertAuditLog(db, {
      user: req.user,
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      newValue: `${created.email} (${created.role})`,
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, user: sanitizeUser(created) });
  } catch (err) {
    return next(err);
  }
});

router.put('/users/:id', staffSuper, async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    const target = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    const body = req.body || {};
    const nextRole = body.role !== undefined ? String(body.role).trim() : target.role;
    if (!ALL_USER_ROLES.has(nextRole)) {
      return res.status(400).json({ success: false, error: `Invalid role: ${nextRole}` });
    }

    const nextActive = body.is_active !== undefined
      ? (body.is_active === true || body.is_active === 1 || body.is_active === '1' ? 1 : 0)
      : Number(target.is_active);

    if (Number(target.id) === Number(req.user.id) && nextActive === 0) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own super_admin account.' });
    }

    if (target.role === 'super_admin' && (nextRole !== 'super_admin' || nextActive === 0)) {
      const otherActiveSuper = await db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin' AND is_active = 1 AND id <> ?",
        [target.id]
      );
      if (Number(otherActiveSuper?.count || 0) === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot demote or deactivate the last active super_admin.'
        });
      }
    }

    const nextEmail = body.email !== undefined ? normalizeOptionalText(body.email, 255)?.toLowerCase() : target.email;
    if (!nextEmail || !EMAIL_RE.test(nextEmail)) {
      return res.status(400).json({ success: false, error: 'Valid email is required.' });
    }
    if (nextEmail !== target.email.toLowerCase()) {
      const dup = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?', [nextEmail, userId]);
      if (dup) return res.status(409).json({ success: false, error: 'Email already used by another account.' });
    }

    const nextHash = (typeof body.password === 'string' && body.password.trim())
      ? hashPassword(body.password)
      : target.password_hash;

    await db.run(
      `UPDATE users
       SET full_name = ?, email = ?, phone = ?, role = ?, license_no = ?, languages = ?, specialty = ?,
           is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.full_name !== undefined ? normalizeOptionalText(body.full_name, 255) || target.full_name : target.full_name,
        nextEmail,
        body.phone !== undefined ? normalizeOptionalText(body.phone, 50) : target.phone,
        nextRole,
        body.license_no !== undefined ? normalizeOptionalText(body.license_no, 100) : target.license_no,
        body.languages !== undefined ? normalizeOptionalText(body.languages, 255) : target.languages,
        body.specialty !== undefined ? normalizeOptionalText(body.specialty, 255) : target.specialty,
        nextActive,
        nextHash,
        userId
      ]
    );

    await insertAuditLog(db, {
      user: req.user,
      action: 'user.updated',
      entityType: 'user',
      entityId: userId,
      oldValue: `${target.role} (active=${target.is_active})`,
      newValue: `${nextRole} (active=${nextActive})`,
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    return res.json({ success: true, user: sanitizeUser(updated) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/users/:id/toggle', staffSuper, async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    const target = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    const nextActive = Number(target.is_active) === 1 ? 0 : 1;

    if (Number(target.id) === Number(req.user.id) && nextActive === 0) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own super_admin account.' });
    }

    if (target.role === 'super_admin' && nextActive === 0) {
      const otherActiveSuper = await db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin' AND is_active = 1 AND id <> ?",
        [target.id]
      );
      if (Number(otherActiveSuper?.count || 0) === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot deactivate the last active super_admin.'
        });
      }
    }

    await db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextActive, userId]);
    await insertAuditLog(db, {
      user: req.user,
      action: 'user.status_toggle',
      entityType: 'user',
      entityId: userId,
      oldValue: String(target.is_active),
      newValue: String(nextActive),
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `User "${target.full_name}" is now ${nextActive === 1 ? 'Active' : 'Inactive'}`,
      is_active: nextActive
    });
  } catch (err) {
    return next(err);
  }
});

// --- Audit Log & Notifications ---
router.get('/audit-log', staffAll, async (req, res, next) => {
  try {
    const { entity_type, entity_id, action, limit } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (entity_type) {
      sql += ' AND entity_type = ?';
      params.push(String(entity_type).trim());
    }
    if (entity_id) {
      sql += ' AND entity_id = ?';
      params.push(String(entity_id).trim());
    }
    if (action) {
      sql += ' AND action = ?';
      params.push(String(action).trim());
    }

    const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 100));
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(parsedLimit);

    const logs = await db.query(sql, params);
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    return next(err);
  }
});

router.get('/notifications', staffAll, async (req, res, next) => {
  try {
    const { unread, recipient_type, limit } = req.query;
    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];

    if (unread === '1' || unread === 'true') sql += ' AND is_read = 0';
    if (recipient_type && recipient_type !== 'All') {
      sql += ' AND recipient_type = ?';
      params.push(String(recipient_type).trim());
    }

    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(parsedLimit);

    const notifs = await db.query(sql, params);
    return res.json({ success: true, count: notifs.length, data: notifs });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
