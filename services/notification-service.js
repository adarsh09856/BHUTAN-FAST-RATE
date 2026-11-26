const db = require('../database/db');
const nodemailer = require('nodemailer');

const EVENT_TITLES = {
  booking_new: 'Booking Confirmation & Wire Instructions',
  booking_confirmed: 'Booking Confirmed — Bhutan Fast Rate Tours',
  payment_received: 'Payment Receipt & Balance Update',
  visa_submitted: 'Bhutan Visa Application Submitted to DoI',
  visa_approved: 'Bhutan Visa Clearance Approved',
  clearance_issued: 'Official Bhutan Visa Clearance Letter Ready',
  visa_update: 'Bhutan Visa Status Update',
  visa_rejected: 'Action Required: Bhutan Visa Document Update',
  guide_assignment: 'Your Certified Bhutanese Guide Assigned',
  review_request: 'Share Your Bhutan Journey Feedback'
};

function formatLicense(rawLicense) {
  const clean = String(rawLicense || 'TR/2018/9882').trim();
  return clean.startsWith('#') ? clean : `#${clean}`;
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

/**
 * Generates a pre-filled WhatsApp click-to-chat deep link.
 */
function buildWhatsAppShareUrl(phone, text) {
  const digits = normalizePhoneDigits(phone);
  const encoded = encodeURIComponent(String(text || ''));
  return `https://wa.me/${digits}?text=${encoded}`;
}

function resolveCurrencyAndTotal(booking = {}, settings = {}) {
  const isIndia = String(booking.nationality_type || '').toLowerCase() === 'india'
    || String(booking.nationality_type || '').toLowerCase() === 'regional_india'
    || String(booking.currency || '').toUpperCase() === 'INR';

  const currency = isIndia ? 'INR' : 'USD';
  const exchangeRate = Number(booking.exchange_rate || settings.usd_to_inr_rate || 85) || 85;

  let totalLocal;
  if (booking.total_price_local !== undefined && booking.total_price_local !== null) {
    totalLocal = Number(booking.total_price_local) || 0;
  } else if (currency === 'INR') {
    totalLocal = Math.round(Number(booking.total_price_usd || 0) * exchangeRate);
  } else {
    totalLocal = Number(booking.total_price_usd || 0);
  }

  const symbol = currency === 'INR' ? '₹' : '$';
  const formattedTotal = `${symbol}${Math.round(totalLocal).toLocaleString('en-US')} ${currency}`;
  return { currency, totalLocal, formattedTotal };
}

/**
 * Renders an operator-ready confirmation / status message including ref, guest,
 * package/dates, multi-currency total, tracking/portal link, and license #TR/2018/9882.
 */
function renderConfirmationText(event, booking = {}, settings = {}) {
  const companyName = settings.company_name || 'Bhutan Fast Rate Tours';
  const license = formatLicense(settings.company_license);
  const rawAppUrl = process.env.APP_URL || settings.app_url || 'http://localhost:3000';
  const appUrl = String(rawAppUrl).replace(/\/+$/, '');

  const ref = booking.id || booking.booking_id || booking.ref || 'BFR-PENDING';
  const guestName = booking.lead_name || booking.guest_name || 'Valued Guest';
  const tourTitle = booking.tour_title || 'Custom Bhutan Expedition';
  const travelDates = booking.travel_date_start && booking.travel_date_end
    ? `${booking.travel_date_start} to ${booking.travel_date_end}`
    : (booking.travel_dates || 'Confirmed Dates');

  const { formattedTotal } = resolveCurrencyAndTotal(booking, settings);
  const trackingLink = `${appUrl}/track-visa.html?ref=${encodeURIComponent(ref)}`;
  const emailQuery = booking.lead_email ? `&email=${encodeURIComponent(booking.lead_email)}` : '';
  const portalLink = `${appUrl}/client/login.html?ref=${encodeURIComponent(ref)}${emailQuery}`;

  let headline = 'Booking & DoI Visa Update';
  if (event === 'booking_new' || event === 'booking_confirmed') {
    headline = 'Reservation Confirmed';
  } else if (event === 'payment_received') {
    headline = 'Payment Receipt Recorded';
  } else if (event === 'visa_approved' || event === 'clearance_issued') {
    headline = `Official Visa Clearance Ready${booking.visa_clearance_number ? ` (${booking.visa_clearance_number})` : ''}`;
  } else if (event === 'visa_rejected') {
    headline = 'Visa Document Correction Required';
  } else if (event === 'guide_assignment') {
    headline = 'Licensed Guide Assigned';
  }

  const lines = [
    `Kuzuzangpo La ${guestName}!`,
    `${headline} — Ref: ${ref}`,
    `Package: ${tourTitle}`,
    `Travel Dates: ${travelDates}`,
    `Authoritative Total: ${formattedTotal}`
  ];

  if (booking.visa_clearance_number && (event === 'visa_approved' || event === 'clearance_issued')) {
    lines.push(`DoI Clearance No: ${booking.visa_clearance_number}`);
  }
  if (event === 'visa_rejected' && booking.visa_rejection_reason) {
    lines.push(`DoI Note: ${booking.visa_rejection_reason}`);
  }

  lines.push(`DoI Visa Tracker: ${trackingLink}`);
  lines.push(`Client Portal (Documents & Invoice): ${portalLink}`);
  lines.push(`${companyName} (Licensed Tour Operator ${license})`);

  return lines.join('\n');
}

async function loadNotificationSettings(settingsOverride) {
  const rows = await db.query('SELECT key, value FROM settings');
  const map = {};
  for (const row of rows || []) {
    map[row.key] = row.value;
  }
  if (settingsOverride && typeof settingsOverride === 'object') {
    Object.assign(map, settingsOverride);
  }
  return map;
}

async function sendSmtpEmail({ settings, to, subject, text }) {
  const smtpHost = String(settings.smtp_host || '').trim();
  const recipientEmail = String(to || '').trim();
  if (!smtpHost || !recipientEmail) {
    return { status: 'skipped', error: null };
  }

  try {
    const port = Number(settings.smtp_port) || 587;
    const transportConfig = {
      host: smtpHost,
      port,
      secure: port === 465,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000
    };
    if (String(settings.smtp_user || '').trim()) {
      transportConfig.auth = {
        user: String(settings.smtp_user).trim(),
        pass: String(settings.smtp_pass || '')
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);
    await transporter.sendMail({
      from: String(settings.smtp_from || settings.company_email || 'reservations@bhutanfastratetours.bt').trim(),
      to: recipientEmail,
      subject,
      text
    });
    return { status: 'sent', error: null };
  } catch (err) {
    return { status: 'failed', error: err.message || 'SMTP send failed' };
  }
}

async function sendWhatsAppApi({ settings, phone, event, bookingId, subject, message, whatsappUrl }) {
  const provider = String(settings.whatsapp_provider || '').trim().toLowerCase();
  const apiUrl = String(settings.whatsapp_api_url || '').trim();
  const apiToken = String(settings.whatsapp_api_token || '').trim();
  const digits = normalizePhoneDigits(phone);

  if (!provider || !apiUrl || !digits) {
    return { status: 'skipped', error: null };
  }

  try {
    let headers = {};
    let body;

    if (provider === 'meta' || provider === 'meta_cloud') {
      if (!apiToken) return { status: 'skipped', error: null };
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      };
      body = JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: { body: message }
      });
    } else if (provider === 'twilio') {
      const from = String(settings.whatsapp_from || '').trim();
      if (!apiToken || !from) return { status: 'skipped', error: null };
      const encodedAuth = apiToken.includes(':')
        ? `Basic ${Buffer.from(apiToken).toString('base64')}`
        : `Bearer ${apiToken}`;
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: encodedAuth
      };
      const form = new URLSearchParams({
        To: `whatsapp:+${digits}`,
        From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        Body: message
      });
      body = form.toString();
    } else {
      headers = {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
      };
      body = JSON.stringify({
        event,
        booking_id: bookingId || null,
        recipient_phone: phone,
        subject,
        message,
        whatsapp_url: whatsappUrl
      });
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return { status: 'failed', error: `WhatsApp API returned HTTP ${res.status}` };
    }
    return { status: 'sent', error: null };
  } catch (err) {
    return { status: 'failed', error: err.message || 'WhatsApp API dispatch failed' };
  }
}

/**
 * Persists a notification record with a pre-filled WhatsApp share link,
 * optionally dispatches SMTP email and WhatsApp webhook/API calls when configured,
 * and never throws on external transport failures.
 */
async function dispatchNotification(event, payload = {}) {
  const settings = await loadNotificationSettings(payload.settingsOverride);

  let booking = payload.booking || null;
  const bookingId = booking?.id || payload.booking_id || null;
  if (!booking && bookingId) {
    booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  }

  const recipientType = payload.recipient_type || 'client';
  const isClientRecipient = recipientType === 'client';
  const recipientPhone = payload.recipient_phone || payload.phone || (isClientRecipient ? booking?.lead_phone : '') || '';
  const recipientEmail = payload.recipient_email || payload.email || (isClientRecipient ? booking?.lead_email : '') || '';
  const recipient = payload.recipient || payload.recipient_id || recipientEmail || recipientPhone || recipientType;

  const subject = payload.subject || payload.title || EVENT_TITLES[event] || 'Bhutan Fast Rate Tours Update';
  const message = payload.message || (
    booking
      ? renderConfirmationText(event, booking, settings)
      : `${subject}${bookingId ? ` (Ref: ${bookingId})` : ''}`
  );

  const whatsappUrl = buildWhatsAppShareUrl(recipientPhone, message);
  const channel = payload.channel || (recipientPhone ? 'whatsapp' : (recipientEmail ? 'email' : 'in_app'));

  const smtpResult = payload.skipSmtp
    ? { status: 'skipped', error: null }
    : await sendSmtpEmail({ settings, to: recipientEmail, subject, text: message });

  const whatsappApiResult = payload.skipWhatsAppApi
    ? { status: 'skipped', error: null }
    : await sendWhatsAppApi({
      settings,
      phone: recipientPhone,
      event,
      bookingId,
      subject,
      message,
      whatsappUrl
    });

  const errorMessages = [smtpResult.error, whatsappApiResult.error].filter(Boolean);
  const errorMessage = errorMessages.length > 0 ? errorMessages.join(' | ') : null;

  const isSent = (
    channel === 'in_app' ||
    smtpResult.status === 'sent' ||
    whatsappApiResult.status === 'sent'
  ) ? 1 : 0;

  const sentAt = isSent ? new Date().toISOString() : null;
  const actionUrl = payload.action_url || (
    bookingId
      ? (recipientType === 'admin'
        ? `admin/booking-detail.html?id=${encodeURIComponent(bookingId)}`
        : `track-visa.html?ref=${encodeURIComponent(bookingId)}`)
      : null
  );

  const metadataJson = JSON.stringify({
    type: event,
    booking_id: bookingId,
    recipient,
    recipient_phone: recipientPhone || null,
    recipient_email: recipientEmail || null,
    subject,
    smtp_status: smtpResult.status,
    whatsapp_api_status: whatsappApiResult.status
  });

  const insertResult = await db.run(
    `INSERT INTO notifications (
      recipient_type, recipient_id, channel, category, title, message,
      action_url, whatsapp_url, metadata_json, error_message, is_read, is_sent, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      recipientType,
      recipient,
      channel,
      event,
      subject,
      message,
      actionUrl,
      whatsappUrl,
      metadataJson,
      errorMessage,
      isSent,
      sentAt
    ]
  );

  return {
    success: true,
    id: insertResult.lastInsertRowid,
    notification_id: insertResult.lastInsertRowid,
    type: event,
    channel,
    recipient,
    recipient_phone: recipientPhone || null,
    recipient_email: recipientEmail || null,
    subject,
    message,
    whatsapp_url: whatsappUrl,
    whatsapp_share_url: whatsappUrl,
    booking_id: bookingId,
    is_sent: isSent,
    smtp_status: smtpResult.status,
    whatsapp_api_status: whatsappApiResult.status,
    error_message: errorMessage
  };
}

module.exports = {
  buildWhatsAppShareUrl,
  renderConfirmationText,
  dispatchNotification
};
