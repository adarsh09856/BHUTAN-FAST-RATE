const express = require('express');
const router = express.Router();
const db = require('../database/db');

// POST /api/guide/auth/login - Guide login
router.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const guide = db.get('SELECT * FROM users WHERE email = ? AND role = "guide" AND is_active = 1', [email ? email.trim().toLowerCase() : '']);
    if (!guide || guide.password_hash !== password) {
      return res.status(401).json({ success: false, error: 'Invalid guide credentials' });
    }
    res.json({
      success: true,
      token: `bfr_guide_${guide.uuid}_${Date.now()}`,
      guide: {
        id: guide.id,
        name: guide.full_name,
        email: guide.email,
        phone: guide.phone
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guide/assignments - Get trips assigned to this guide
router.get('/assignments', (req, res) => {
  try {
    const guideId = req.query.guide_id || 3;
    const assignments = db.query(`
      SELECT ga.*, b.tour_title, b.lead_name, b.lead_country, b.lead_phone, b.total_travelers, b.hotel_tier, b.booking_status, b.visa_status, b.special_requests
      FROM guide_assignments ga
      JOIN bookings b ON ga.booking_id = b.id
      WHERE ga.guide_id = ?
      ORDER BY ga.start_date ASC
    `, [guideId]);
    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guide/assignments/:booking_id - Full trip details for guide
router.get('/assignments/:booking_id', (req, res) => {
  try {
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.booking_id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Trip not found' });

    const travelers = db.query('SELECT full_name, nationality, dietary_needs, medical_notes FROM travelers WHERE booking_id = ?', [booking.id]);
    const tour = booking.tour_id ? db.get('SELECT itinerary_json FROM tours WHERE id = ?', [booking.tour_id]) : null;

    res.json({
      success: true,
      trip: {
        ...booking,
        travelers,
        itinerary: tour ? JSON.parse(tour.itinerary_json || '[]') : []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/guide/assignments/:id/checkin - Daily field check-in
router.patch('/assignments/:id/checkin', (req, res) => {
  try {
    const { location, notes } = req.body;
    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
      VALUES ('Guide Field Check-In', 'guide', 'guide.checkin', 'booking', ?, ?)
    `, [req.params.id, `Location: ${location || 'En-route'}. Notes: ${notes || 'All travelers well'}`]);

    res.json({ success: true, message: 'Field check-in recorded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
