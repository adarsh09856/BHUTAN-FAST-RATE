const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { calculateSDF } = require('../services/sdf-engine');

// GET /api/tours - List all active tours with search, category & duration filters
router.get('/tours', (req, res) => {
  try {
    const { category, difficulty, search, sort } = req.query;
    let sql = 'SELECT * FROM tours WHERE is_active = 1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND category LIKE ?';
      params.push(`%${category}%`);
    }

    if (difficulty && difficulty !== 'All') {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }

    if (search) {
      sql += ' AND (title LIKE ? OR subtitle LIKE ? OR valleys LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY price_usd ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY price_usd DESC';
    } else if (sort === 'duration') {
      sql += ' ORDER BY duration_days ASC';
    } else {
      sql += ' ORDER BY sort_order ASC';
    }

    const tours = db.query(sql, params).map(t => ({
      ...t,
      itinerary: JSON.parse(t.itinerary_json || '[]'),
      inclusions: JSON.parse(t.inclusions_json || '[]')
    }));

    res.json({ success: true, count: tours.length, data: tours });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tours/:slug - Single tour detail
router.get('/tours/:slug', (req, res) => {
  try {
    let slug = req.params.slug;
    if (!slug.endsWith('.html') && !slug.includes('.')) {
      slug = `tour-${slug}.html`;
    }
    const tour = db.get('SELECT * FROM tours WHERE slug = ? OR id = ?', [slug, req.params.slug]);
    if (!tour) {
      return res.status(404).json({ success: false, error: 'Tour package not found' });
    }

    res.json({
      success: true,
      data: {
        ...tour,
        itinerary: JSON.parse(tour.itinerary_json || '[]'),
        inclusions: JSON.parse(tour.inclusions_json || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/destinations - All valley destination guides
router.get('/destinations', (req, res) => {
  try {
    const dests = db.query('SELECT * FROM destinations WHERE is_active = 1 ORDER BY sort_order ASC').map(d => ({
      ...d,
      highlights: JSON.parse(d.highlights_json || '[]')
    }));
    res.json({ success: true, count: dests.length, data: dests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/destinations/:id
router.get('/destinations/:id', (req, res) => {
  try {
    const d = db.get('SELECT * FROM destinations WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!d) return res.status(404).json({ success: false, error: 'Destination not found' });
    res.json({
      success: true,
      data: {
        ...d,
        highlights: JSON.parse(d.highlights_json || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calculate-sdf - Compute Royal Government SDF dues
router.post('/calculate-sdf', (req, res) => {
  try {
    const result = calculateSDF(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/inquiries - Submit contact lead or custom itinerary request
router.post('/inquiries', (req, res) => {
  try {
    const { name, email, phone, country, preferred_dates, duration_days, travelers_count, budget_range, interests, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required' });
    }

    const ref_code = `INQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    db.run(`
      INSERT INTO inquiries (ref_code, name, email, phone, country, preferred_dates, duration_days, travelers_count, budget_range, interests, message, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'new')
    `, [ref_code, name, email, phone || null, country || null, preferred_dates || null, duration_days || null, travelers_count || null, budget_range || null, interests || null, message]);

    // Add notification for staff
    db.run(`
      INSERT INTO notifications (recipient_type, channel, category, title, message, action_url)
      VALUES ('admin', 'in_app', 'booking_new', 'New Traveler Inquiry', ?, 'admin/inquiries.html')
    `, [`${name} (${country || 'International'}) submitted inquiry ${ref_code}`]);

    res.json({
      success: true,
      message: 'Inquiry received. A certified Bhutan specialist will contact you within 12 hours.',
      ref_code
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reviews - Verified client reviews
router.get('/reviews', (req, res) => {
  try {
    const reviews = db.query('SELECT * FROM reviews WHERE is_published = 1 ORDER BY is_featured DESC, id DESC');
    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings/public
router.get('/settings/public', (req, res) => {
  try {
    const rows = db.query("SELECT key, value FROM settings WHERE category = 'general' OR key LIKE 'sdf_%' OR key = 'visa_fee_usd'");
    const publicSettings = {};
    rows.forEach(r => publicSettings[r.key] = r.value);
    res.json({ success: true, data: publicSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
