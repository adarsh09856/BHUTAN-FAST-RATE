const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { verifyPassword, signToken, requireGuide } = require('../middleware/auth');
const { dispatchNotification } = require('../services/notification-service');

function parsePositiveId(rawId) {
  const str = String(rawId || '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
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

function maskPassportNumber(rawPassport) {
  const str = String(rawPassport || '').trim();
  if (!str) return null;
  if (str.length <= 4) return '****';
  return `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
}

async function resolveGuideAssignment(identifier, guideId) {
  const raw = String(identifier || '').trim();
  if (!raw) {
    return { status: 400, error: 'Assignment or booking identifier is required.' };
  }

  const isNumeric = /^\d+$/.test(raw);
  const ownedSql = isNumeric
    ? 'SELECT * FROM guide_assignments WHERE id = ? AND guide_id = ? LIMIT 1'
    : 'SELECT * FROM guide_assignments WHERE LOWER(booking_id) = LOWER(?) AND guide_id = ? LIMIT 1';
  const ownedParam = isNumeric ? Number(raw) : raw;

  const owned = await db.get(ownedSql, [ownedParam, guideId]);
  if (owned) {
    return { status: 200, assignment: owned };
  }

  const anySql = isNumeric
    ? 'SELECT id, guide_id FROM guide_assignments WHERE id = ? LIMIT 1'
    : 'SELECT id, guide_id FROM guide_assignments WHERE LOWER(booking_id) = LOWER(?) LIMIT 1';
  const existingOther = await db.get(anySql, [ownedParam]);
  if (existingOther) {
    return { status: 403, error: 'Forbidden: assignment belongs to another guide' };
  }

  return { status: 404, error: 'Trip assignment not found' };
}

function classifyAssignmentPhase(assignment, todayStr) {
  const bStatus = String(assignment.booking_status || '').toLowerCase();
  const aStatus = String(assignment.status || '').toLowerCase();
  if (bStatus === 'completed' || aStatus === 'completed' || (assignment.end_date && assignment.end_date < todayStr)) {
    return 'past';
  }
  if (
    bStatus === 'active_trip' ||
    aStatus === 'active' ||
    (assignment.start_date && assignment.end_date && assignment.start_date <= todayStr && assignment.end_date >= todayStr)
  ) {
    return 'active';
  }
  return 'upcoming';
}

// POST /api/guide/auth/login - Authenticate certified guide
router.post('/auth/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const guide = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND role = 'guide' AND is_active = 1",
      [email]
    );
    if (!guide || !verifyPassword(password, guide.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid guide credentials' });
    }

    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [guide.id]);

    const token = signToken({
      role: 'guide',
      id: guide.id,
      userId: guide.id,
      email: guide.email,
      name: guide.full_name
    });

    return res.json({
      success: true,
      token,
      guide: {
        id: guide.id,
        uuid: guide.uuid,
        name: guide.full_name,
        full_name: guide.full_name,
        email: guide.email,
        phone: guide.phone,
        license_no: guide.license_no || null,
        languages: guide.languages || null,
        specialty: guide.specialty || null
      }
    });
  } catch (err) {
    return next(err);
  }
});

// All subsequent /api/guide/* endpoints require strict Bearer guide JWT
router.use(requireGuide());

// GET /api/guide/assignments - List active, upcoming, and past trips assigned to logged-in guide
router.get('/assignments', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT
        ga.id,
        ga.guide_id,
        ga.booking_id,
        ga.start_date,
        ga.end_date,
        ga.vehicle_plate,
        ga.driver_name,
        ga.daily_rate_usd,
        ga.status,
        ga.guide_notes,
        ga.created_at,
        b.tour_title,
        b.lead_name,
        b.lead_country,
        b.lead_phone,
        b.total_travelers,
        b.adults_count,
        b.children_6_12,
        b.children_under_6,
        b.hotel_tier,
        b.booking_status,
        b.visa_status,
        b.special_requests,
        b.travel_date_start,
        b.travel_date_end,
        b.total_nights,
        (
          SELECT COUNT(*)
          FROM guide_checkins gc
          WHERE gc.booking_id = ga.booking_id AND gc.guide_id = ga.guide_id
        ) AS checkins_count
       FROM guide_assignments ga
       JOIN bookings b ON ga.booking_id = b.id
       WHERE ga.guide_id = ?
       ORDER BY ga.start_date ASC, ga.id ASC`,
      [req.user.id]
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const grouped = { active: [], upcoming: [], past: [] };

    const assignments = rows.map((row) => {
      const phase = classifyAssignmentPhase(row, todayStr);
      const item = {
        ...row,
        checkins_count: Number(row.checkins_count || 0),
        phase
      };
      grouped[phase].push(item);
      return item;
    });

    return res.json({
      success: true,
      count: assignments.length,
      data: assignments,
      grouped
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/guide/assignments/:booking_id - Full non-financial trip roster, itinerary & checkins
router.get('/assignments/:booking_id', async (req, res, next) => {
  try {
    const lookup = await resolveGuideAssignment(req.params.booking_id, req.user.id);
    if (lookup.status !== 200) {
      return res.status(lookup.status).json({ success: false, error: lookup.error });
    }
    const assignment = lookup.assignment;

    const booking = await db.get(
      `SELECT
        id, tour_id, tour_title, is_custom_trip,
        lead_name, lead_country, lead_phone,
        travel_date_start, travel_date_end, total_nights, total_travelers,
        adults_count, children_6_12, children_under_6,
        hotel_tier, booking_status, visa_status,
        assigned_vehicle, custom_itinerary_json, special_requests
       FROM bookings
       WHERE id = ?`,
      [assignment.booking_id]
    );
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [travelersRaw, tour, checkins] = await Promise.all([
      db.query(
        `SELECT
          id, full_name, nationality, age_category, gender,
          passport_number, dietary_needs, medical_notes,
          emergency_contact_name, emergency_contact_phone,
          document_notes, visa_status
         FROM travelers
         WHERE booking_id = ?
         ORDER BY id ASC`,
        [booking.id]
      ),
      booking.tour_id ? db.get('SELECT itinerary_json, valleys FROM tours WHERE id = ?', [booking.tour_id]) : null,
      db.query(
        'SELECT * FROM guide_checkins WHERE booking_id = ? AND guide_id = ? ORDER BY created_at DESC, id DESC',
        [booking.id, req.user.id]
      )
    ]);

    const travelers = travelersRaw.map((tr) => ({
      id: tr.id,
      full_name: tr.full_name,
      nationality: tr.nationality,
      age_category: tr.age_category,
      gender: tr.gender,
      passport_masked: maskPassportNumber(tr.passport_number),
      has_passport_on_file: Boolean(tr.passport_number),
      dietary_needs: tr.dietary_needs,
      medical_notes: tr.medical_notes,
      emergency_contact_name: tr.emergency_contact_name,
      emergency_contact_phone: tr.emergency_contact_phone,
      document_notes: tr.document_notes,
      visa_status: tr.visa_status
    }));

    const customItinerary = parseJsonArraySafe(booking.custom_itinerary_json);
    const itinerary = customItinerary.length > 0
      ? customItinerary
      : (tour ? parseJsonArraySafe(tour.itinerary_json) : []);

    const { custom_itinerary_json: _omit, ...safeBooking } = booking;

    return res.json({
      success: true,
      assignment,
      trip: {
        ...safeBooking,
        assignment,
        valleys: tour ? tour.valleys : null,
        travelers,
        itinerary,
        checkins
      }
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/guide/assignments/:id/checkin - Record daily field check-in, audit trail & admin alert
router.patch('/assignments/:id/checkin', async (req, res, next) => {
  try {
    const lookup = await resolveGuideAssignment(req.params.id, req.user.id);
    if (lookup.status !== 200) {
      return res.status(lookup.status).json({ success: false, error: lookup.error });
    }
    const assignment = lookup.assignment;

    const body = req.body || {};
    const location = typeof body.location === 'string' ? body.location.trim().slice(0, 255) : '';
    if (!location) {
      return res.status(400).json({ success: false, error: 'Check-in location is required.' });
    }

    const weather = typeof body.weather === 'string' && body.weather.trim()
      ? body.weather.trim().slice(0, 100)
      : null;
    const guestStatus = typeof body.guest_status === 'string' && body.guest_status.trim()
      ? body.guest_status.trim().slice(0, 100)
      : 'All Well';
    const notes = typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim().slice(0, 1000)
      : null;

    const insertRes = await db.run(
      `INSERT INTO guide_checkins (assignment_id, booking_id, guide_id, location, weather, guest_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [assignment.id, assignment.booking_id, req.user.id, location, weather, guestStatus, notes]
    );

    const checkin = await db.get('SELECT * FROM guide_checkins WHERE id = ?', [insertRes.lastInsertRowid]);
    const guideName = req.user.name || req.user.email || 'Guide';

    await db.run(
      `INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, new_value)
       VALUES (?, ?, 'guide', 'guide.checkin', 'booking', ?, ?)`,
      [
        req.user.id,
        guideName,
        assignment.booking_id,
        JSON.stringify({
          assignment_id: assignment.id,
          checkin_id: checkin.id,
          location,
          weather,
          guest_status: guestStatus,
          notes
        })
      ]
    );

    await dispatchNotification('guide_checkin', {
      booking_id: assignment.booking_id,
      recipient_type: 'admin',
      recipient: 'admin',
      channel: 'in_app',
      subject: `Guide Field Check-In — ${assignment.booking_id}`,
      message: `${guideName} checked in at ${location} for ${assignment.booking_id} (Status: ${guestStatus}${weather ? `, Weather: ${weather}` : ''}${notes ? ` — ${notes}` : ''}).`,
      action_url: `admin/booking-detail.html?id=${encodeURIComponent(assignment.booking_id)}`,
      skipSmtp: true,
      skipWhatsAppApi: true
    });

    return res.json({
      success: true,
      message: 'Field check-in recorded successfully',
      checkin
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/guide/notifications - Notifications addressed to logged-in guide
router.get('/notifications', async (req, res, next) => {
  try {
    const guideIdStr = String(req.user.id);
    const guideEmail = String(req.user.email || '').trim().toLowerCase();
    const metaPattern = `%"guide_id":${Number(req.user.id)}%`;

    const rows = await db.query(
      `SELECT * FROM notifications
       WHERE recipient_type = 'guide'
         AND (
           LOWER(COALESCE(recipient_id, '')) = ?
           OR recipient_id = ?
           OR COALESCE(metadata_json, '') LIKE ?
         )
       ORDER BY id DESC LIMIT 100`,
      [guideEmail, guideIdStr, metaPattern]
    );

    const unreadCount = rows.filter((r) => Number(r.is_read) === 0).length;

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

// PATCH /api/guide/notifications/:id/read - Mark guide notification as read
router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const notifId = parsePositiveId(req.params.id);
    if (!notifId) {
      return res.status(400).json({ success: false, error: 'Invalid notification ID' });
    }

    const notif = await db.get('SELECT * FROM notifications WHERE id = ?', [notifId]);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const guideEmail = String(req.user.email || '').trim().toLowerCase();
    const guideIdStr = String(req.user.id);
    const isOwner = notif.recipient_type === 'guide' && (
      String(notif.recipient_id || '').trim().toLowerCase() === guideEmail ||
      String(notif.recipient_id || '').trim() === guideIdStr ||
      String(notif.metadata_json || '').includes(`"guide_id":${Number(req.user.id)}`)
    );

    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden: notification does not belong to you' });
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

module.exports = router;
