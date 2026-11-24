const db = require('../database/db');

/**
 * Bhutan Fast Rate Tours - Notification Dispatcher Service
 */

const EVENT_CHANNELS = {
  booking_new: ['in_app', 'email'],
  visa_approved: ['in_app', 'email', 'whatsapp'],
  visa_update: ['in_app', 'email'],
  payment_received: ['in_app', 'email'],
  guide_assignment: ['in_app', 'email']
};

function dispatchNotification(event, payload) {
  try {
    const channels = EVENT_CHANNELS[event] || ['in_app'];

    for (const channel of channels) {
      db.run(`
        INSERT INTO notifications (recipient_type, recipient_id, channel, category, title, message, action_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.recipient_type || 'admin',
        payload.recipient_id || 'admin',
        channel,
        event,
        payload.title || 'System Alert',
        payload.message || '',
        payload.action_url || null
      ]);
    }

    console.log(`[NOTIFY] Dispatched ${event} notification to ${payload.recipient_type} via [${channels.join(', ')}]`);
    return { success: true, channels };
  } catch (err) {
    console.error('[NOTIFY] Error dispatching notification:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { dispatchNotification };
