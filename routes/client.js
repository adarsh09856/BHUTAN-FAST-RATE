const express = require('express');
const router = express.Router();
const db = require('../database/db');

// POST /api/client/auth - Authenticate client via booking ref + email
router.post('/auth', (req, res) => {
  try {
    const { booking_ref, email } = req.body;
    if (!booking_ref || !email) {
      return res.status(400).json({ success: false, error: 'Booking reference and email required' });
    }

    const booking = db.get('SELECT * FROM bookings WHERE id = ? AND lower(lead_email) = ?', [booking_ref.trim(), email.trim().toLowerCase()]);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'No matching booking found for this reference and email address.' });
    }

    res.json({
      success: true,
      token: `client_auth_${booking.id}_${Date.now()}`,
      booking_id: booking.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/client/travelers/:id/documents - Record traveler passport details
router.post('/travelers/:id/documents', (req, res) => {
  try {
    const { passport_number, passport_expiry, nationality, date_of_birth, dietary_needs, medical_notes } = req.body;
    const travelerId = req.params.id;

    db.run(`
      UPDATE travelers 
      SET passport_number = ?, passport_expiry = ?, nationality = ?, date_of_birth = ?, dietary_needs = ?, medical_notes = ?
      WHERE id = ?
    `, [passport_number || null, passport_expiry || null, nationality || null, date_of_birth || null, dietary_needs || null, medical_notes || null, travelerId]);

    res.json({ success: true, message: 'Traveler details and document verification updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
