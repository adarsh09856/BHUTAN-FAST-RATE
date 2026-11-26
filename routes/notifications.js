const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireStaff } = require('../middleware/auth');
const { dispatchNotification } = require('../services/notification-service');

const staffGuard = requireStaff('super_admin', 'admin', 'concierge', 'finance');
router.use(staffGuard);

function parsePositiveId(rawId) {
  const str = String(rawId || '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

// GET /api/notifications - List notifications with optional ?unread=1, ?channel=, ?limit=
router.get('/', async (req, res, next) => {
  try {
    const { unread, channel, category, recipient_type, is_sent, limit } = req.query;
    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];

    if (unread === '1' || unread === 'true') {
      sql += ' AND is_read = 0';
    } else if (unread === '0' || unread === 'false') {
      sql += ' AND is_read = 1';
    }

    if (channel && channel !== 'All') {
      sql += ' AND LOWER(COALESCE(channel, \'\')) = ?';
      params.push(String(channel).trim().toLowerCase());
    }

    if (category && category !== 'All') {
      sql += ' AND LOWER(COALESCE(category, \'\')) = ?';
      params.push(String(category).trim().toLowerCase());
    }

    if (recipient_type && recipient_type !== 'All') {
      sql += ' AND LOWER(COALESCE(recipient_type, \'\')) = ?';
      params.push(String(recipient_type).trim().toLowerCase());
    }

    if (is_sent === '1' || is_sent === '0') {
      sql += ' AND is_sent = ?';
      params.push(Number(is_sent));
    }

    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(parsedLimit);

    const [rows, unreadRow] = await Promise.all([
      db.query(sql, params),
      db.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0')
    ]);

    return res.json({
      success: true,
      count: rows.length,
      unread_count: Number(unreadRow?.count || 0),
      data: rows
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/notifications/read-all - Mark all unread notifications as read
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await db.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    return res.json({
      success: true,
      updated: result.changes,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid notification ID' });
    }

    const existing = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    const updated = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/notifications/:id/sent - Mark single notification as dispatched/sent
router.patch('/:id/sent', async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid notification ID' });
    }

    const existing = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await db.run(
      'UPDATE notifications SET is_sent = 1, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), error_message = NULL WHERE id = ?',
      [id]
    );
    const updated = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Notification marked as sent',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/notifications/send - Dispatch notification via WhatsApp / SMTP / In-App
router.post('/send', async (req, res, next) => {
  try {
    const body = req.body || {};
    const event = String(body.event || body.type || body.category || 'manual_dispatch').trim();
    const bookingId = body.booking_id ? String(body.booking_id).trim() : null;

    let booking = null;
    if (bookingId) {
      booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
    }

    const hasTarget = Boolean(
      booking ||
      body.message ||
      body.subject ||
      body.title ||
      body.recipient_phone ||
      body.phone ||
      body.recipient_email ||
      body.email
    );
    if (!hasTarget) {
      return res.status(400).json({
        success: false,
        error: 'Provide booking_id, message, or recipient contact details to send a notification.'
      });
    }

    const result = await dispatchNotification(event, {
      booking,
      booking_id: bookingId,
      recipient_type: body.recipient_type || 'client',
      recipient: body.recipient || body.recipient_id,
      recipient_phone: body.recipient_phone || body.phone,
      recipient_email: body.recipient_email || body.email,
      channel: body.channel,
      subject: body.subject || body.title,
      message: body.message,
      action_url: body.action_url,
      skipSmtp: Boolean(body.skipSmtp),
      skipWhatsAppApi: Boolean(body.skipWhatsAppApi)
    });

    return res.status(201).json({
      ...result,
      data: result
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
