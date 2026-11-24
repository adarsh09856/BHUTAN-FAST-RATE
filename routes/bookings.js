const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { calculateSDF } = require('../services/sdf-engine');
const { generateClearanceNotice } = require('../services/visa-workflow');

// POST /api/bookings - Create new trip booking with automated SDF calculation
router.post('/', (req, res) => {
  try {
    const {
      tour_id,
      lead_name,
      lead_email,
      lead_phone,
      lead_country,
      lead_passport_no,
      travel_date_start,
      nights,
      adults_count,
      children_6_12,
      children_under_6,
      hotel_tier,
      special_requests
    } = req.body;

    if (!lead_name || !lead_email || !lead_phone || !travel_date_start) {
      return res.status(400).json({ success: false, error: 'Please provide full name, email, phone, and travel departure date.' });
    }

    // Lookup tour if provided
    let tour = null;
    let tour_title = req.body.tour_title || 'Custom Bespoke Bhutan Expedition';
    let basePricePerAdult = 1950;
    let tripNights = parseInt(nights, 10) || 6;

    if (tour_id) {
      tour = db.get('SELECT * FROM tours WHERE id = ? OR slug = ?', [tour_id, tour_id]);
      if (tour) {
        tour_title = tour.title;
        tripNights = tour.duration_nights;
        basePricePerAdult = hotel_tier === '5-Star Luxury' && tour.price_5star_usd 
          ? tour.price_5star_usd 
          : tour.price_usd;
      }
    }

    const adults = Math.max(1, parseInt(adults_count, 10) || 1);
    const c1 = Math.max(0, parseInt(children_6_12, 10) || 0);
    const c2 = Math.max(0, parseInt(children_under_6, 10) || 0);
    const totalTravelers = adults + c1 + c2;

    // Calculate dates
    const startDate = new Date(travel_date_start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + tripNights);
    const travel_date_end = endDate.toISOString().split('T')[0];

    // Compute SDF
    const sdfResult = calculateSDF({
      nights: tripNights,
      adults,
      children_6_12: c1,
      children_under_6: c2,
      nationality_type: (lead_country && lead_country.toLowerCase() === 'india') ? 'india' : 'international'
    });

    // Compute total package price
    const baseTotal = (adults * basePricePerAdult) + Math.round(c1 * basePricePerAdult * 0.6);
    const grandTotal = baseTotal + sdfResult.total_sdf + sdfResult.total_visa_fee;

    // Generate Booking Reference
    const year = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `BFR-${year}-${randomCode}`;

    db.run(`
      INSERT INTO bookings (
        id, tour_id, tour_title, is_custom_trip,
        lead_name, lead_email, lead_phone, lead_country, lead_passport_no,
        travel_date_start, travel_date_end, total_nights, total_travelers,
        adults_count, children_6_12, children_under_6, hotel_tier,
        base_price_usd, sdf_total_usd, visa_fee_usd, extras_usd, total_price_usd,
        deposit_paid_usd, full_paid, booking_status, visa_status,
        special_requests, source
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, 0, ?,
        0, 0, 'inquiry', 'not_started',
        ?, 'website'
      )
    `, [
      bookingId, tour ? tour.id : null, tour_title, tour ? 0 : 1,
      lead_name, lead_email, lead_phone, lead_country || 'International', lead_passport_no || null,
      travel_date_start, travel_date_end, tripNights, totalTravelers,
      adults, c1, c2, hotel_tier || '4-Star Premium',
      baseTotal, sdfResult.total_sdf, sdfResult.total_visa_fee, grandTotal,
      special_requests || null
    ]);

    // Insert lead traveler
    db.run(`
      INSERT INTO travelers (booking_id, full_name, passport_number, nationality, age_category, sdf_rate_usd, visa_status)
      VALUES (?, ?, ?, ?, 'adult', ?, 'pending')
    `, [bookingId, lead_name, lead_passport_no || null, lead_country || 'International', sdfResult.breakdown.adults.rate_per_night]);

    // Create Admin notification
    db.run(`
      INSERT INTO notifications (recipient_type, channel, category, title, message, action_url)
      VALUES ('admin', 'in_app', 'booking_new', 'New Tour Booking', ?, ?)
    `, [
      `${lead_name} booked "${tour_title}" (${totalTravelers} travelers, $${grandTotal.toLocaleString()})`,
      `admin/booking-detail.html?id=${bookingId}`
    ]);

    // Log in audit log
    db.run(`
      INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id, new_value)
      VALUES (?, 'client', 'booking.created', 'booking', ?, ?)
    `, [lead_name, bookingId, JSON.stringify({ tour: tour_title, total: grandTotal, travelers: totalTravelers })]);

    res.status(201).json({
      success: true,
      message: 'Booking successfully reserved! Your dedicated concierge will issue official deposit instructions and visa document forms.',
      booking: {
        id: bookingId,
        tour_title,
        travel_dates: `${travel_date_start} to ${travel_date_end} (${tripNights} Nights)`,
        travelers_count: totalTravelers,
        base_price_usd: baseTotal,
        sdf_total_usd: sdfResult.total_sdf,
        visa_fee_usd: sdfResult.total_visa_fee,
        total_price_usd: grandTotal,
        tracking_url: `track-visa.html?ref=${bookingId}&email=${encodeURIComponent(lead_email)}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/track/:ref - Real-time tracking for travelers
router.get('/track/:ref', (req, res) => {
  try {
    const ref = req.params.ref.trim();
    const email = req.query.email ? req.query.email.trim().toLowerCase() : null;

    let sql = 'SELECT * FROM bookings WHERE id = ?';
    const params = [ref];

    if (email) {
      sql += ' AND lower(lead_email) = ?';
      params.push(email);
    }

    const booking = db.get(sql, params);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking reference not found or email mismatch.' });
    }

    const travelers = db.query('SELECT id, full_name, passport_number, passport_expiry, nationality, age_category, visa_status FROM travelers WHERE booking_id = ?', [booking.id]);

    let guideInfo = null;
    if (booking.assigned_guide_id) {
      const guide = db.get('SELECT full_name, phone, avatar_url FROM users WHERE id = ?', [booking.assigned_guide_id]);
      if (guide) {
        guideInfo = {
          name: guide.full_name,
          phone: guide.phone,
          vehicle: booking.assigned_vehicle
        };
      }
    }

    let clearanceNotice = null;
    if (booking.visa_status === 'clearance_letter_issued' || booking.visa_status === 'approved') {
      clearanceNotice = generateClearanceNotice(booking, travelers);
    }

    res.json({
      success: true,
      booking: {
        id: booking.id,
        tour_title: booking.tour_title,
        lead_name: booking.lead_name,
        travel_dates: `${booking.travel_date_start} to ${booking.travel_date_end}`,
        total_nights: booking.total_nights,
        total_travelers: booking.total_travelers,
        hotel_tier: booking.hotel_tier,
        booking_status: booking.booking_status,
        visa_status: booking.visa_status,
        visa_clearance_number: booking.visa_clearance_number,
        payment_status: booking.full_paid ? 'Fully Paid' : (booking.deposit_paid_usd > 0 ? 'Deposit Paid' : 'Pending Payment'),
        total_price_usd: booking.total_price_usd,
        deposit_paid_usd: booking.deposit_paid_usd,
        balance_due_usd: Math.max(0, booking.total_price_usd - booking.deposit_paid_usd),
        guide: guideInfo,
        travelers,
        clearance_notice: clearanceNotice
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
