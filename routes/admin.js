const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { canAdvanceTo } = require('../services/visa-workflow');

// POST /api/admin/auth/login - Staff authentication
router.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const user = db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.trim().toLowerCase()]);
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ success: false, error: 'Invalid staff email or password' });
    }

    // Update last login
    db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

    res.json({
      success: true,
      token: `bfr_token_${user.uuid}_${Date.now()}`,
      user: {
        id: user.id,
        uuid: user.uuid,
        name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/stats - KPI Dashboard analytics
router.get('/stats', (req, res) => {
  try {
    const totalBookings = db.get('SELECT COUNT(*) as count FROM bookings').count;
    const activeTrips = db.get("SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'active_trip'").count;
    const pendingVisas = db.get("SELECT COUNT(*) as count FROM bookings WHERE visa_status IN ('under_review', 'submitted_to_doi', 'documents_complete')").count;
    const newInquiries = db.get("SELECT COUNT(*) as count FROM inquiries WHERE status = 'new'").count;

    const revenueResult = db.get('SELECT SUM(total_price_usd) as total_rev, SUM(deposit_paid_usd) as collected FROM bookings');
    const totalRevenue = revenueResult.total_rev || 0;
    const totalCollected = revenueResult.collected || 0;

    const pipelineCounts = db.query(`
      SELECT booking_status, COUNT(*) as count 
      FROM bookings 
      GROUP BY booking_status
    `);

    const recentActivity = db.query(`
      SELECT * FROM audit_log ORDER BY id DESC LIMIT 8
    `);

    res.json({
      success: true,
      stats: {
        total_bookings: totalBookings,
        active_trips: activeTrips,
        pending_visas: pendingVisas,
        new_inquiries: newInquiries,
        total_revenue_usd: totalRevenue,
        collected_revenue_usd: totalCollected,
        outstanding_balance_usd: Math.max(0, totalRevenue - totalCollected),
        pipeline: pipelineCounts,
        recent_activity: recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/bookings - List bookings with filter & search
router.get('/bookings', (req, res) => {
  try {
    const { status, visa_status, search } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      sql += ' AND booking_status = ?';
      params.push(status);
    }
    if (visa_status && visa_status !== 'All') {
      sql += ' AND visa_status = ?';
      params.push(visa_status);
    }
    if (search) {
      sql += ' AND (id LIKE ? OR lead_name LIKE ? OR lead_email LIKE ? OR tour_title LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const bookings = db.query(sql, params);
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/bookings/:id - Deep booking inspection
router.get('/bookings/:id', (req, res) => {
  try {
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const travelers = db.query('SELECT * FROM travelers WHERE booking_id = ?', [booking.id]);
    const payments = db.query('SELECT * FROM payments WHERE booking_id = ?', [booking.id]);
    const audit = db.query("SELECT * FROM audit_log WHERE entity_id = ? ORDER BY id DESC", [booking.id]);

    let guide = null;
    if (booking.assigned_guide_id) {
      guide = db.get('SELECT id, full_name, email, phone, role FROM users WHERE id = ?', [booking.assigned_guide_id]);
    }

    res.json({
      success: true,
      booking: {
        ...booking,
        travelers,
        payments,
        audit,
        guide
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/bookings/:id/status - Update booking lifecycle status
router.patch('/bookings/:id/status', (req, res) => {
  try {
    const { status, user_name } = req.body;
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    db.run('UPDATE bookings SET booking_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, booking.id]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, 'staff', 'booking.status_change', 'booking', ?, ?, ?)
    `, [user_name || 'Staff Concierge', booking.id, booking.booking_status, status]);

    res.json({ success: true, message: `Booking status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/bookings/:id/visa - Department of Tourism Visa State Machine
router.patch('/bookings/:id/visa', (req, res) => {
  try {
    const { visa_status, visa_clearance_number, user_name } = req.body;
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const check = canAdvanceTo(booking.visa_status, visa_status, booking);
    if (!check.allowed) {
      return res.status(400).json({ success: false, error: check.reason });
    }

    let clearanceNumber = visa_clearance_number || booking.visa_clearance_number;
    if ((visa_status === 'approved' || visa_status === 'clearance_letter_issued') && !clearanceNumber) {
      clearanceNumber = `VCL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-BFR`;
    }

    let visaApprovedDate = booking.visa_approved_date;
    if (visa_status === 'approved' || visa_status === 'clearance_letter_issued') {
      visaApprovedDate = new Date().toISOString().split('T')[0];
    }

    db.run(`
      UPDATE bookings 
      SET visa_status = ?, visa_clearance_number = ?, visa_approved_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [visa_status, clearanceNumber, visaApprovedDate, booking.id]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, 'concierge', 'visa.status_change', 'booking', ?, ?, ?)
    `, [user_name || 'Visa Desk Officer', booking.id, booking.visa_status, `${visa_status} (${clearanceNumber || 'Pending'})`]);

    // Send in-app notification to client
    db.run(`
      INSERT INTO notifications (recipient_type, recipient_id, channel, category, title, message, action_url)
      VALUES ('client', ?, 'in_app', 'visa_update', 'Bhutan Visa Status Updated', ?, ?)
    `, [booking.lead_email, `Your Bhutan visa is now: ${visa_status.toUpperCase()}`, `track-visa.html?ref=${booking.id}`]);

    res.json({ 
      success: true, 
      message: `Visa status updated to ${visa_status}`,
      visa_clearance_number: clearanceNumber 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/bookings/:id/assign-guide - Assign guide and transport
router.patch('/bookings/:id/assign-guide', (req, res) => {
  try {
    const { guide_id, vehicle_plate, user_name } = req.body;
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const guide = db.get("SELECT * FROM users WHERE id = ? AND role = 'guide'", [guide_id]);
    if (!guide) return res.status(404).json({ success: false, error: 'Licensed guide not found' });

    db.run(`
      UPDATE bookings 
      SET assigned_guide_id = ?, assigned_vehicle = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [guide.id, vehicle_plate || 'Toyota Coaster / Prado SUV', booking.id]);

    // Create guide assignment record
    db.run(`
      INSERT INTO guide_assignments (guide_id, booking_id, start_date, end_date, vehicle_plate, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `, [guide.id, booking.id, booking.travel_date_start, booking.travel_date_end, vehicle_plate || 'Toyota Coaster / Prado SUV']);

    // Notify Guide
    db.run(`
      INSERT INTO notifications (recipient_type, recipient_id, channel, category, title, message, action_url)
      VALUES ('guide', ?, 'in_app', 'guide_assignment', 'New Trip Assignment', ?, ?)
    `, [guide.email, `You have been assigned to lead "${booking.tour_title}" for ${booking.lead_name}`, `guide/trip-detail.html?id=${booking.id}`]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
      VALUES (?, 'admin', 'guide.assigned', 'booking', ?, ?)
    `, [user_name || 'Operations Manager', booking.id, `Assigned ${guide.full_name} (${vehicle_plate})`]);

    res.json({ success: true, message: `Assigned guide ${guide.full_name} to booking ${booking.id}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/bookings/:id/payments - Record payment
router.post('/bookings/:id/payments', (req, res) => {
  try {
    const { amount_usd, payment_type, payment_method, transaction_ref, notes, user_name } = req.body;
    const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const amount = parseInt(amount_usd, 10);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Valid payment amount required' });

    db.run(`
      INSERT INTO payments (booking_id, amount_usd, payment_type, payment_method, transaction_ref, status, notes)
      VALUES (?, ?, ?, ?, ?, 'verified', ?)
    `, [booking.id, amount, payment_type || 'full_payment', payment_method || 'bank_transfer', transaction_ref || `TX-${Date.now()}`, notes || null]);

    const newDeposit = booking.deposit_paid_usd + amount;
    const isFullyPaid = newDeposit >= booking.total_price_usd ? 1 : 0;
    const newBookingStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';

    db.run(`
      UPDATE bookings 
      SET deposit_paid_usd = ?, full_paid = ?, booking_status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [newDeposit, isFullyPaid, newBookingStatus, booking.id]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
      VALUES (?, 'finance', 'payment.recorded', 'booking', ?, ?)
    `, [user_name || 'Finance Officer', booking.id, `Recorded $${amount.toLocaleString()} via ${payment_method || 'transfer'}`]);

    res.json({ 
      success: true, 
      message: `Payment of $${amount.toLocaleString()} recorded. Total received: $${newDeposit.toLocaleString()}`,
      full_paid: isFullyPaid
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/inquiries - CRM Leads
router.get('/inquiries', (req, res) => {
  try {
    const inquiries = db.query('SELECT * FROM inquiries ORDER BY id DESC');
    res.json({ success: true, count: inquiries.length, data: inquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/inquiries/:id - Update CRM Lead Status
router.patch('/inquiries/:id', (req, res) => {
  try {
    const { status, internal_notes } = req.body;
    db.run('UPDATE inquiries SET status = ?, internal_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, internal_notes || null, req.params.id]);
    res.json({ success: true, message: 'Inquiry updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// TOUR PACKAGES CATALOG CRUD
// ==========================================

// GET /api/admin/tours - List all tours for catalog manager
router.get('/tours', (req, res) => {
  try {
    const { search, category, status } = req.query;
    let sql = 'SELECT * FROM tours WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND category LIKE ?';
      params.push(`%${category}%`);
    }

    if (status === 'active') {
      sql += ' AND is_active = 1';
    } else if (status === 'inactive') {
      sql += ' AND is_active = 0';
    }

    if (search) {
      sql += ' AND (title LIKE ? OR valleys LIKE ? OR category LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY sort_order ASC, id ASC';
    const tours = db.query(sql, params).map(t => ({
      ...t,
      itinerary: JSON.parse(t.itinerary_json || '[]'),
      inclusions: JSON.parse(t.inclusions_json || '[]')
    }));

    const totalCount = db.get('SELECT COUNT(*) as count FROM tours').count;
    const activeCount = db.get('SELECT COUNT(*) as count FROM tours WHERE is_active = 1').count;

    res.json({
      success: true,
      count: tours.length,
      total_count: totalCount,
      active_count: activeCount,
      inactive_count: totalCount - activeCount,
      data: tours
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/tours/:id - Single tour detail for editing
router.get('/tours/:id', (req, res) => {
  try {
    const tour = db.get('SELECT * FROM tours WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

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

// POST /api/admin/tours - Create a new tour package
router.post('/tours', (req, res) => {
  try {
    const {
      title,
      subtitle,
      slug,
      category,
      difficulty,
      duration_days,
      duration_nights,
      price_usd,
      price_3star_usd,
      price_5star_usd,
      valleys,
      cover_image,
      highlight_text,
      inclusions,
      itinerary,
      is_featured,
      is_active,
      user_name
    } = req.body;

    if (!title || !price_usd) {
      return res.status(400).json({ success: false, error: 'Tour title and base price USD are required' });
    }

    // Auto-generate clean slug and id
    let rawSlug = (slug || title).toLowerCase().replace(/\.html$/, '');
    const cleanSlug = rawSlug
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .replace(/^tour-/, '');
    const tourId = cleanSlug;
    const tourSlug = `tour-${cleanSlug}.html`;

    // Check if duplicate slug or id exists
    const existing = db.get('SELECT id FROM tours WHERE id = ? OR slug = ?', [tourId, tourSlug]);
    if (existing) {
      return res.status(409).json({ success: false, error: `A tour with ID "${tourId}" or slug "${tourSlug}" already exists.` });
    }

    const days = parseInt(duration_days, 10) || 7;
    const nights = duration_nights !== undefined ? parseInt(duration_nights, 10) : Math.max(1, days - 1);
    const price = parseInt(price_usd, 10);
    const p3 = price_3star_usd ? parseInt(price_3star_usd, 10) : price;
    const p5 = price_5star_usd ? parseInt(price_5star_usd, 10) : Math.round(price * 1.6);
    const incJson = Array.isArray(inclusions) ? JSON.stringify(inclusions) : (inclusions ? JSON.stringify(String(inclusions).split('\n').filter(Boolean)) : '["Licensed English Guide", "SDF Included", "All Transfers", "Meals & 3-Star Hotels"]');
    const itinJson = Array.isArray(itinerary) ? JSON.stringify(itinerary) : (itinerary ? JSON.stringify(itinerary) : '[]');

    db.run(`
      INSERT INTO tours (
        id, slug, title, subtitle, category, difficulty, duration_days, duration_nights,
        price_usd, price_3star_usd, price_5star_usd, valleys, cover_image, highlight_text,
        inclusions_json, itinerary_json, is_featured, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 99)
    `, [
      tourId,
      tourSlug,
      title,
      subtitle || `${days} Days / ${nights} Nights Bhutan Journey`,
      category || 'Cultural Heritage',
      difficulty || 'Easy to Moderate',
      days,
      nights,
      price,
      p3,
      p5,
      valleys || 'Paro, Thimphu, Punakha',
      cover_image || 'assets/images/tigers-nest.webp',
      highlight_text || title,
      incJson,
      itinJson,
      is_featured ? 1 : 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    ]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
      VALUES (?, 'admin', 'tour.created', 'tour', ?, ?)
    `, [user_name || 'Admin', tourId, `Created tour: ${title} ($${price})`]);

    res.status(201).json({
      success: true,
      message: `Tour "${title}" created successfully`,
      tour: {
        id: tourId,
        slug: tourSlug,
        title,
        price_usd: price
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/tours/:id - Update an existing tour package
router.put('/tours/:id', (req, res) => {
  try {
    const tour = db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const {
      title,
      subtitle,
      category,
      difficulty,
      duration_days,
      duration_nights,
      price_usd,
      price_3star_usd,
      price_5star_usd,
      valleys,
      cover_image,
      highlight_text,
      inclusions,
      itinerary,
      is_featured,
      is_active,
      user_name
    } = req.body;

    const days = duration_days !== undefined ? parseInt(duration_days, 10) : tour.duration_days;
    const nights = duration_nights !== undefined ? parseInt(duration_nights, 10) : tour.duration_nights;
    const price = price_usd !== undefined ? parseInt(price_usd, 10) : tour.price_usd;
    const p3 = price_3star_usd !== undefined ? parseInt(price_3star_usd, 10) : tour.price_3star_usd;
    const p5 = price_5star_usd !== undefined ? parseInt(price_5star_usd, 10) : tour.price_5star_usd;
    
    let incJson = tour.inclusions_json;
    if (inclusions !== undefined) {
      incJson = Array.isArray(inclusions) ? JSON.stringify(inclusions) : JSON.stringify(String(inclusions).split('\n').filter(Boolean));
    }

    let itinJson = tour.itinerary_json;
    if (itinerary !== undefined) {
      itinJson = Array.isArray(itinerary) ? JSON.stringify(itinerary) : JSON.stringify(itinerary);
    }

    db.run(`
      UPDATE tours SET
        title = ?,
        subtitle = ?,
        category = ?,
        difficulty = ?,
        duration_days = ?,
        duration_nights = ?,
        price_usd = ?,
        price_3star_usd = ?,
        price_5star_usd = ?,
        valleys = ?,
        cover_image = ?,
        highlight_text = ?,
        inclusions_json = ?,
        itinerary_json = ?,
        is_featured = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title !== undefined ? title : tour.title,
      subtitle !== undefined ? subtitle : tour.subtitle,
      category !== undefined ? category : tour.category,
      difficulty !== undefined ? difficulty : tour.difficulty,
      days,
      nights,
      price,
      p3,
      p5,
      valleys !== undefined ? valleys : tour.valleys,
      cover_image !== undefined ? cover_image : tour.cover_image,
      highlight_text !== undefined ? highlight_text : tour.highlight_text,
      incJson,
      itinJson,
      is_featured !== undefined ? (is_featured ? 1 : 0) : tour.is_featured,
      is_active !== undefined ? (is_active ? 1 : 0) : tour.is_active,
      tour.id
    ]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, 'admin', 'tour.updated', 'tour', ?, ?, ?)
    `, [
      user_name || 'Admin',
      tour.id,
      `Price: $${tour.price_usd}, Active: ${tour.is_active}`,
      `Price: $${price}, Active: ${is_active !== undefined ? (is_active ? 1 : 0) : tour.is_active}`
    ]);

    res.json({
      success: true,
      message: `Tour "${title || tour.title}" updated successfully`,
      tour_id: tour.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/tours/:id/toggle - Toggle active/inactive status
router.patch('/tours/:id/toggle', (req, res) => {
  try {
    const tour = db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    const newStatus = tour.is_active === 1 ? 0 : 1;
    db.run('UPDATE tours SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, tour.id]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, 'admin', 'tour.status_toggle', 'tour', ?, ?, ?)
    `, [req.body.user_name || 'Admin', tour.id, `Active: ${tour.is_active}`, `Active: ${newStatus}`]);

    res.json({
      success: true,
      message: `Tour "${tour.title}" is now ${newStatus === 1 ? 'Active (Visible on Website)' : 'Inactive (Hidden)'}`,
      is_active: newStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/tours/:id - Delete a tour package
router.delete('/tours/:id', (req, res) => {
  try {
    const tour = db.get('SELECT * FROM tours WHERE id = ?', [req.params.id]);
    if (!tour) return res.status(404).json({ success: false, error: 'Tour not found' });

    db.run('DELETE FROM tours WHERE id = ?', [tour.id]);

    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, old_value)
      VALUES (?, 'admin', 'tour.deleted', 'tour', ?, ?)
    `, [req.body?.user_name || 'Admin', tour.id, `Deleted tour: ${tour.title} ($${tour.price_usd})`]);

    res.json({ success: true, message: `Tour "${tour.title}" deleted from catalog` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/guides - Roster of guides
router.get('/guides', (req, res) => {
  try {
    const guides = db.query("SELECT id, uuid, full_name, email, phone, role FROM users WHERE role = 'guide' AND is_active = 1");
    res.json({ success: true, data: guides });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/audit-log - Immutable audit trail
router.get('/audit-log', (req, res) => {
  try {
    const logs = db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100');
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/notifications
router.get('/notifications', (req, res) => {
  try {
    const notifs = db.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 50');
    res.json({ success: true, data: notifs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/settings & PUT /api/admin/settings
router.get('/settings', (req, res) => {
  try {
    const rows = db.query('SELECT * FROM settings');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const settingsObj = req.body;
    for (const [key, value] of Object.entries(settingsObj)) {
      db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [String(value), key]);
    }
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
