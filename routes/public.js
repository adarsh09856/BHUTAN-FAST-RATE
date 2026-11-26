const express = require('express');
const crypto = require('node:crypto');
const router = express.Router();
const db = require('../database/db');
const { calculatePricingQuote } = require('../services/sdf-engine');
const { dispatchNotification, buildWhatsAppShareUrl } = require('../services/notification-service');

const PUBLIC_SETTINGS_KEYS = [
  'company_name',
  'company_license',
  'company_tagline',
  'company_phone',
  'company_whatsapp',
  'company_email',
  'company_address',
  'hero_title',
  'hero_subtitle',
  'sdf_rate_international',
  'sdf_rate_india',
  'sdf_child_6_12_discount',
  'sdf_child_under_6_exempt',
  'sdf_waiver_active',
  'sdf_waiver_percent',
  'usd_to_inr_rate',
  'visa_fee_usd',
  'child_package_discount',
  'child_6_12_package_discount_pct',
  'child_under_6_package_discount_pct',
  'booking_deposit_percent',
  'deposit_percent',
  'hotel_4star_surcharge_usd',
  'hotel_5star_surcharge_usd',
  'custom_daily_rate_3star',
  'custom_daily_rate_4star',
  'custom_daily_rate_5star',
  'custom_daily_rate_3star_usd',
  'custom_daily_rate_4star_usd',
  'custom_daily_rate_5star_usd',
  'min_advance_booking_days',
  'cancellation_free_days',
  'cancellation_partial_days',
  'cancellation_partial_refund_percent',
  'final_payment_due_days',
  'app_url'
];

const PUBLIC_SETTINGS_ALLOWLIST = new Set(PUBLIC_SETTINGS_KEYS);
const VALID_NATIONALITIES = new Set(['international', 'india', 'regional_india', 'regional']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeParseJson(value, fallback = []) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function summarizeTour(tour) {
  if (!tour) return null;
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    subtitle: tour.subtitle || null,
    duration_days: tour.duration_days,
    duration_nights: tour.duration_nights,
    category: tour.category,
    difficulty: tour.difficulty,
    price_usd: tour.price_usd,
    price_3star_usd: tour.price_3star_usd,
    price_4star_usd: tour.price_4star_usd,
    price_5star_usd: tour.price_5star_usd,
    valleys: tour.valleys,
    cover_image: tour.cover_image
  };
}

function mapTourRow(tour) {
  return {
    ...tour,
    itinerary: safeParseJson(tour.itinerary_json, []),
    inclusions: safeParseJson(tour.inclusions_json, []),
    exclusions: safeParseJson(tour.exclusions_json, [])
  };
}

function matchDestinationTours(destination, activeTours) {
  const stopWords = new Set(['valley', 'capital', 'region', 'bhutan', 'the', 'and']);
  const tokens = new Set();
  if (destination.id) tokens.add(String(destination.id).trim().toLowerCase());
  for (const part of String(destination.name || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (part.length >= 3 && !stopWords.has(part)) {
      tokens.add(part);
    }
  }

  return activeTours
    .filter((tour) => {
      const valleysLower = String(tour.valleys || '').toLowerCase();
      for (const token of tokens) {
        if (valleysLower.includes(token)) return true;
      }
      return false;
    })
    .map(summarizeTour);
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

// GET /api/tours - List all active tours with search, category & duration filters
router.get('/tours', async (req, res, next) => {
  try {
    const { category, difficulty, search, sort, featured, valley } = req.query;
    let sql = 'SELECT * FROM tours WHERE is_active = 1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND LOWER(category) LIKE ?';
      params.push(`%${String(category).trim().toLowerCase()}%`);
    }

    if (difficulty && difficulty !== 'All') {
      sql += ' AND LOWER(difficulty) = ?';
      params.push(String(difficulty).trim().toLowerCase());
    }

    if (featured === '1' || featured === 'true') {
      sql += ' AND is_featured = 1';
    }

    if (valley && valley !== 'All') {
      sql += ' AND LOWER(valleys) LIKE ?';
      params.push(`%${String(valley).trim().toLowerCase()}%`);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      sql += " AND (LOWER(title) LIKE ? OR LOWER(COALESCE(subtitle, '')) LIKE ? OR LOWER(valleys) LIKE ? OR LOWER(category) LIKE ?)";
      params.push(term, term, term, term);
    }

    if (sort === 'price_asc' || sort === 'price-low') {
      sql += ' ORDER BY price_usd ASC, sort_order ASC';
    } else if (sort === 'price_desc' || sort === 'price-high') {
      sql += ' ORDER BY price_usd DESC, sort_order ASC';
    } else if (sort === 'duration') {
      sql += ' ORDER BY duration_days ASC, sort_order ASC';
    } else if (sort === 'duration_desc' || sort === 'days') {
      sql += ' ORDER BY duration_days DESC, sort_order ASC';
    } else {
      sql += ' ORDER BY sort_order ASC, id ASC';
    }

    const rows = await db.query(sql, params);
    const tours = rows.map(mapTourRow);

    res.json({ success: true, count: tours.length, data: tours });
  } catch (err) {
    next(err);
  }
});

// GET /api/tours/:slug - Single active tour detail
router.get('/tours/:slug', async (req, res, next) => {
  try {
    const raw = String(req.params.slug || '').trim();
    const clean = raw.replace(/^tour-/i, '').replace(/\.html$/i, '');
    const slugCandidate = raw.endsWith('.html') ? raw : `tour-${clean}.html`;

    const tour = await db.get(
      'SELECT * FROM tours WHERE is_active = 1 AND (slug = ? OR id = ? OR slug = ? OR id = ?)',
      [raw, raw, slugCandidate, clean]
    );

    if (!tour) {
      return res.status(404).json({ success: false, error: 'Tour package not found' });
    }

    return res.json({
      success: true,
      data: mapTourRow(tour)
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/destinations - All active valley destination guides with related tour summaries
router.get('/destinations', async (req, res, next) => {
  try {
    const [destRows, activeTours] = await Promise.all([
      db.query('SELECT * FROM destinations WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'),
      db.query('SELECT id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, cover_image FROM tours WHERE is_active = 1 ORDER BY sort_order ASC')
    ]);

    const dests = destRows.map((d) => {
      const relatedTours = matchDestinationTours(d, activeTours);
      return {
        ...d,
        highlights: safeParseJson(d.highlights_json, []),
        related_tours: relatedTours,
        related_tour: relatedTours[0] || null
      };
    });

    res.json({ success: true, count: dests.length, data: dests });
  } catch (err) {
    next(err);
  }
});

// GET /api/destinations/:id - Single active destination guide
router.get('/destinations/:id', async (req, res, next) => {
  try {
    const raw = String(req.params.id || '').trim();
    const clean = raw.replace(/^destination-/i, '').replace(/\.html$/i, '');
    const slugCandidate = raw.endsWith('.html') ? raw : `destination-${clean}.html`;

    const d = await db.get(
      'SELECT * FROM destinations WHERE is_active = 1 AND (id = ? OR slug = ? OR slug = ? OR id = ?)',
      [raw, raw, slugCandidate, clean]
    );

    if (!d) {
      return res.status(404).json({ success: false, error: 'Destination not found' });
    }

    const activeTours = await db.query(
      'SELECT id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, cover_image FROM tours WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    const relatedTours = matchDestinationTours(d, activeTours);

    return res.json({
      success: true,
      data: {
        ...d,
        highlights: safeParseJson(d.highlights_json, []),
        related_tours: relatedTours,
        related_tour: relatedTours[0] || null
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/festivals - Active sacred festivals calendar with highlights and related tour summary
router.get('/festivals', async (req, res, next) => {
  try {
    const { season, valley, featured } = req.query;
    let sql = 'SELECT * FROM festivals WHERE is_active = 1';
    const params = [];

    if (season && season !== 'All') {
      sql += ' AND LOWER(COALESCE(season, \'\')) LIKE ?';
      params.push(`%${String(season).trim().toLowerCase()}%`);
    }
    if (valley && valley !== 'All') {
      sql += ' AND LOWER(COALESCE(valley, \'\')) LIKE ?';
      params.push(`%${String(valley).trim().toLowerCase()}%`);
    }
    if (featured === '1' || featured === 'true') {
      sql += ' AND is_featured = 1';
    }
    sql += ' ORDER BY sort_order ASC, name ASC';

    const [festivalRows, activeTours] = await Promise.all([
      db.query(sql, params),
      db.query('SELECT id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, cover_image FROM tours WHERE is_active = 1')
    ]);

    const tourMap = new Map(activeTours.map(t => [t.id, t]));
    const festivals = festivalRows.map((f) => ({
      ...f,
      highlights: safeParseJson(f.highlights_json, []),
      related_tour: f.related_tour_id ? summarizeTour(tourMap.get(f.related_tour_id) || null) : null
    }));

    res.json({ success: true, count: festivals.length, data: festivals });
  } catch (err) {
    next(err);
  }
});

// GET /api/festivals/:id - Single active festival detail
router.get('/festivals/:id', async (req, res, next) => {
  try {
    const raw = String(req.params.id || '').trim();
    const clean = raw.replace(/^festival-/i, '').replace(/\.html$/i, '');
    const slugCandidate = raw.endsWith('.html') ? raw : `festival-${clean}.html`;

    const festival = await db.get(
      'SELECT * FROM festivals WHERE is_active = 1 AND (id = ? OR slug = ? OR slug = ? OR id = ?)',
      [raw, raw, slugCandidate, clean]
    );

    if (!festival) {
      return res.status(404).json({ success: false, error: 'Festival not found' });
    }

    let relatedTour = null;
    if (festival.related_tour_id) {
      const tour = await db.get(
        'SELECT id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, cover_image FROM tours WHERE id = ? AND is_active = 1',
        [festival.related_tour_id]
      );
      relatedTour = summarizeTour(tour);
    }

    return res.json({
      success: true,
      data: {
        ...festival,
        highlights: safeParseJson(festival.highlights_json, []),
        related_tour: relatedTour
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/reviews - Published client reviews ordered featured/recent first
router.get('/reviews', async (req, res, next) => {
  try {
    const reviews = await db.query(
      'SELECT * FROM reviews WHERE is_published = 1 ORDER BY is_featured DESC, id DESC'
    );
    const total = reviews.length;
    const avg = total > 0
      ? Number((reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / total).toFixed(1))
      : 0;
    const verifiedCount = reviews.filter(r => Number(r.is_verified) === 1).length;

    res.json({
      success: true,
      count: total,
      average_rating: avg,
      stats: { total, average_rating: avg, verified_count: verifiedCount },
      data: reviews
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/public - Strictly whitelisted public display & calculator settings
router.get('/settings/public', async (req, res, next) => {
  try {
    const placeholders = PUBLIC_SETTINGS_KEYS.map(() => '?').join(', ');
    const rows = await db.query(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
      PUBLIC_SETTINGS_KEYS
    );

    const publicSettings = {};
    for (const row of rows || []) {
      if (PUBLIC_SETTINGS_ALLOWLIST.has(row.key)) {
        publicSettings[row.key] = row.value;
      }
    }

    if (!publicSettings.custom_daily_rate_3star && publicSettings.custom_daily_rate_3star_usd) {
      publicSettings.custom_daily_rate_3star = publicSettings.custom_daily_rate_3star_usd;
    }
    if (!publicSettings.custom_daily_rate_4star && publicSettings.custom_daily_rate_4star_usd) {
      publicSettings.custom_daily_rate_4star = publicSettings.custom_daily_rate_4star_usd;
    }
    if (!publicSettings.custom_daily_rate_5star && publicSettings.custom_daily_rate_5star_usd) {
      publicSettings.custom_daily_rate_5star = publicSettings.custom_daily_rate_5star_usd;
    }
    if (!publicSettings.booking_deposit_percent && publicSettings.deposit_percent) {
      publicSettings.booking_deposit_percent = publicSettings.deposit_percent;
    }
    if (!publicSettings.child_package_discount && publicSettings.child_6_12_package_discount_pct) {
      publicSettings.child_package_discount = publicSettings.child_6_12_package_discount_pct;
    }
    if (!publicSettings.app_url && process.env.APP_URL) {
      publicSettings.app_url = process.env.APP_URL;
    }

    res.json({ success: true, data: publicSettings });
  } catch (err) {
    next(err);
  }
});

// POST /api/calculate-sdf - Authoritative multi-currency SDF & package quote
router.post('/calculate-sdf', async (req, res, next) => {
  try {
    const body = req.body || {};

    let tour = null;
    const tourRef = body.tour_id || body.tour_slug;
    if (tourRef && String(tourRef).trim() !== '' && !['custom', 'custom_trip'].includes(String(tourRef).trim().toLowerCase())) {
      const raw = String(tourRef).trim();
      const clean = raw.replace(/^tour-/i, '').replace(/\.html$/i, '');
      const slugCandidate = raw.endsWith('.html') ? raw : `tour-${clean}.html`;
      tour = await db.get(
        'SELECT * FROM tours WHERE is_active = 1 AND (id = ? OR slug = ? OR slug = ? OR id = ?)',
        [raw, raw, slugCandidate, clean]
      );
      if (!tour) {
        return res.status(404).json({ success: false, error: 'Tour package not found' });
      }
    }

    const rawAdults = body.adults !== undefined ? body.adults : body.adults_count;
    const adults = rawAdults === undefined ? 1 : parseStrictNonNegativeInt(rawAdults);
    if (adults === null) {
      return res.status(400).json({ success: false, error: 'Invalid adults count' });
    }

    const children_6_12 = body.children_6_12 === undefined ? 0 : parseStrictNonNegativeInt(body.children_6_12);
    if (children_6_12 === null) {
      return res.status(400).json({ success: false, error: 'Invalid children_6_12 count' });
    }

    const children_under_6 = body.children_under_6 === undefined ? 0 : parseStrictNonNegativeInt(body.children_under_6);
    if (children_under_6 === null) {
      return res.status(400).json({ success: false, error: 'Invalid children_under_6 count' });
    }

    if (adults + children_6_12 + children_under_6 < 1) {
      return res.status(400).json({ success: false, error: 'At least 1 traveler is required' });
    }

    let nights;
    if (body.nights !== undefined && body.nights !== null && body.nights !== '') {
      nights = parseStrictPositiveInt(body.nights);
      if (nights === null || nights > 365) {
        return res.status(400).json({ success: false, error: 'Nights must be between 1 and 365' });
      }
    } else {
      nights = tour ? Number(tour.duration_nights) || 1 : 1;
    }

    const rawNat = body.nationality_type !== undefined && body.nationality_type !== null && String(body.nationality_type).trim() !== ''
      ? String(body.nationality_type).trim().toLowerCase()
      : 'international';
    if (!VALID_NATIONALITIES.has(rawNat)) {
      return res.status(400).json({ success: false, error: 'Invalid nationality_type. Must be international or india.' });
    }

    const isIndia = rawNat === 'india' || rawNat === 'regional_india' || rawNat === 'regional';
    if (body.currency !== undefined && body.currency !== null && String(body.currency).trim() !== '') {
      const reqCurr = String(body.currency).trim().toUpperCase();
      if (!['USD', 'INR'].includes(reqCurr)) {
        return res.status(400).json({ success: false, error: 'Unsupported currency. Only USD and INR are supported.' });
      }
      if ((isIndia && reqCurr !== 'INR') || (!isIndia && reqCurr !== 'USD')) {
        return res.status(400).json({ success: false, error: 'Currency mismatch for selected nationality_type.' });
      }
    }

    const quote = await calculatePricingQuote({
      tour,
      nights,
      adults,
      children_6_12,
      children_under_6,
      nationality_type: rawNat,
      hotel_tier: body.hotel_tier,
      custom_daily_rate: tour ? undefined : body.custom_daily_rate,
      extras_usd: body.extras_usd,
      discount_usd: body.discount_usd,
      is_sdf_waived: body.is_sdf_waived
    });

    return res.json({
      success: true,
      data: {
        ...quote,
        total_sdf: quote.total_sdf_local,
        total_visa_fee: quote.visa_fee_local,
        grand_government_dues: quote.total_sdf_local + quote.visa_fee_local,
        compliance_note: '100% of the SDF is remitted to the Royal Government of Bhutan for healthcare, free education, carbon neutrality, and tourism sustainability infrastructure.'
      }
    });
  } catch (err) {
    return next(err);
  }
});

async function generateUniqueInquiryRef() {
  const year = new Date().getFullYear();
  for (let i = 0; i < 6; i++) {
    const candidate = `INQ-${year}-${crypto.randomInt(1000, 10000)}`;
    const existing = await db.get('SELECT id FROM inquiries WHERE ref_code = ?', [candidate]);
    if (!existing) return candidate;
  }
  return `INQ-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// POST /api/inquiries - Submit contact lead or custom itinerary request
router.post('/inquiries', async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phoneRaw = body.phone !== undefined && body.phone !== null
      ? String(body.phone).trim()
      : (body.whatsapp !== undefined && body.whatsapp !== null ? String(body.whatsapp).trim() : '');

    if (!name || (!email && !phoneRaw)) {
      return res.status(400).json({
        success: false,
        error: 'Name and at least an email address or phone/WhatsApp number are required.'
      });
    }

    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    const interests = Array.isArray(body.interests)
      ? body.interests.map(i => String(i).trim()).filter(Boolean).join(', ')
      : (body.interests ? String(body.interests).trim() : null);

    const messageText = (typeof body.message === 'string' && body.message.trim())
      ? body.message.trim()
      : (interests ? `Interested in: ${interests}` : 'Custom Bhutan itinerary inquiry');

    const durationDays = body.duration_days !== undefined && body.duration_days !== null && body.duration_days !== ''
      ? parseStrictPositiveInt(body.duration_days)
      : null;
    const travelersCount = body.travelers_count !== undefined && body.travelers_count !== null && body.travelers_count !== ''
      ? parseStrictPositiveInt(body.travelers_count)
      : null;

    const refCode = await generateUniqueInquiryRef();

    const insertRes = await db.run(
      `INSERT INTO inquiries (
        ref_code, name, email, phone, country, preferred_dates,
        duration_days, travelers_count, budget_range, interests, message, source, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [
        refCode,
        name,
        email,
        phoneRaw || null,
        body.country ? String(body.country).trim() : null,
        body.preferred_dates ? String(body.preferred_dates).trim() : null,
        durationDays,
        travelersCount,
        body.budget_range ? String(body.budget_range).trim() : null,
        interests || null,
        messageText,
        body.source ? String(body.source).trim() : 'website'
      ]
    );

    const waSetting = await db.get("SELECT value FROM settings WHERE key = 'company_whatsapp'");
    const agencyWhatsapp = (waSetting && waSetting.value) || '+97517654321';

    await dispatchNotification('inquiry_received', {
      recipient_type: 'admin',
      recipient: 'admin',
      channel: 'in_app',
      subject: `New Traveler Inquiry (${refCode})`,
      message: `${name} (${body.country || 'International'}) submitted inquiry ${refCode}: ${messageText}`,
      action_url: 'admin/inquiries.html',
      recipient_phone: phoneRaw || undefined,
      recipient_email: email || undefined,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    const whatsappUrl = buildWhatsAppShareUrl(
      agencyWhatsapp,
      `Kuzuzangpo La! I submitted inquiry ${refCode} (${name}). Details: ${messageText}`
    );

    return res.status(201).json({
      success: true,
      inquiry_id: insertRes.lastInsertRowid,
      reference: refCode,
      ref_code: refCode,
      whatsapp_url: whatsappUrl,
      message: 'Inquiry received. A certified Bhutan specialist will contact you within 12 hours.'
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
