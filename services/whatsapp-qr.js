'use strict';

const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');

const SESSION_DIR = path.join(__dirname, '..', 'uploads', '.whatsapp-session');

const SILENT_LOGGER = {
  level: 'silent',
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  child() { return SILENT_LOGGER; }
};

let sock = null;
let connectPromise = null;
let reconnectTimer = null;
let manualDisconnect = false;

const state = {
  status: 'disconnected', // disconnected | connecting | qr_ready | connected
  qr_text: null,
  qr_data_url: null,
  qr_updated_at: null,
  phone: null,
  name: null,
  connected_at: null,
  last_error: null
};

function hasSavedSession() {
  try {
    return fs.existsSync(path.join(SESSION_DIR, 'creds.json'));
  } catch {
    return false;
  }
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

function getStatus() {
  return {
    status: state.status,
    connected: state.status === 'connected',
    qr_data_url: state.status === 'qr_ready' ? state.qr_data_url : null,
    qr_updated_at: state.qr_updated_at,
    phone: state.phone,
    name: state.name,
    connected_at: state.connected_at,
    last_error: state.last_error,
    has_saved_session: hasSavedSession()
  };
}

function isConnected() {
  return Boolean(sock && state.status === 'connected');
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function cleanupSocket() {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      if (sock.ws && typeof sock.ws.close === 'function') {
        sock.ws.close();
      }
    } catch (_) {}
    sock = null;
  }
}

function clearSessionFiles() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  } catch (_) {}
}

async function connect(options = {}) {
  if (isConnected()) {
    return getStatus();
  }
  if (connectPromise) {
    return connectPromise;
  }

  manualDisconnect = false;
  clearReconnectTimer();

  connectPromise = (async () => {
    try {
      if (options.fresh && !hasSavedSession()) {
        clearSessionFiles();
      }
      fs.mkdirSync(SESSION_DIR, { recursive: true });

      const baileys = require('@whiskeysockets/baileys');
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const {
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion
      } = baileys;

      cleanupSocket();
      state.status = 'connecting';
      state.last_error = null;

      const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      let version;
      try {
        const latest = await fetchLatestBaileysVersion();
        version = latest && latest.version;
      } catch (_) {
        version = undefined;
      }

      sock = makeWASocket({
        ...(version ? { version } : {}),
        auth: authState,
        logger: SILENT_LOGGER,
        printQRInTerminal: false,
        browser: ['Bhutan Fast Rate Tours', 'Chrome', '124.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false
      });

      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (_) {}
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update || {};

        if (qr) {
          state.qr_text = qr;
          state.qr_updated_at = new Date().toISOString();
          state.status = 'qr_ready';
          state.last_error = null;
          try {
            state.qr_data_url = await QRCode.toDataURL(qr, {
              width: 280,
              margin: 2,
              color: { dark: '#0B2A22', light: '#FFFFFF' }
            });
          } catch (qrErr) {
            state.last_error = qrErr.message || 'QR render error';
          }
        }

        if (connection === 'open') {
          const jid = (sock && sock.user && sock.user.id) ? String(sock.user.id) : '';
          const phoneDigits = jid.split(':')[0].split('@')[0];
          state.status = 'connected';
          state.qr_text = null;
          state.qr_data_url = null;
          state.phone = phoneDigits ? `+${phoneDigits}` : null;
          state.name = (sock && sock.user && sock.user.name) || 'Linked WhatsApp';
          state.connected_at = new Date().toISOString();
          state.last_error = null;
          console.log(`[WhatsApp QR] Connected as ${state.phone || 'linked device'}`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const errMsg = lastDisconnect?.error?.message || '';

          if (manualDisconnect || loggedOut) {
            cleanupSocket();
            if (loggedOut) {
              clearSessionFiles();
            }
            state.status = 'disconnected';
            state.qr_text = null;
            state.qr_data_url = null;
            state.phone = null;
            state.name = null;
            state.connected_at = null;
            state.last_error = loggedOut ? 'Logged out from phone. Click Generate QR to relink.' : null;
          } else {
            state.status = 'connecting';
            state.last_error = errMsg ? `Reconnecting (${errMsg})` : 'Reconnecting...';
            clearReconnectTimer();
            reconnectTimer = setTimeout(() => {
              connect().catch(() => {});
            }, 3500);
          }
        }
      });

      // Wait briefly (up to 4s) for initial QR or open connection so UI gets immediate payload
      await new Promise((resolve) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (state.status === 'qr_ready' || state.status === 'connected' || state.status === 'disconnected' || Date.now() - started > 4000) {
            clearInterval(timer);
            resolve();
          }
        }, 120);
      });

      return getStatus();
    } catch (err) {
      state.status = 'disconnected';
      state.last_error = err.message || 'Unable to start WhatsApp Web session';
      return getStatus();
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function disconnect() {
  manualDisconnect = true;
  clearReconnectTimer();
  try {
    if (sock && typeof sock.logout === 'function') {
      await Promise.race([sock.logout(), new Promise((r) => setTimeout(r, 2500))]);
    }
  } catch (_) {}
  cleanupSocket();
  clearSessionFiles();
  state.status = 'disconnected';
  state.qr_text = null;
  state.qr_data_url = null;
  state.qr_updated_at = null;
  state.phone = null;
  state.name = null;
  state.connected_at = null;
  state.last_error = null;
  return getStatus();
}

async function sendTextMessage(phone, text) {
  const digits = normalizePhoneDigits(phone);
  if (!digits || digits.length < 7) {
    return { status: 'skipped', error: 'Invalid or missing recipient phone number' };
  }
  if (!isConnected()) {
    return { status: 'skipped', error: null };
  }

  const jid = `${digits}@s.whatsapp.net`;
  try {
    await Promise.race([
      sock.sendMessage(jid, { text: String(text || '') }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp send timeout')), 10000))
    ]);
    return { status: 'sent', error: null, jid };
  } catch (err) {
    return { status: 'failed', error: err.message || 'WhatsApp delivery failed' };
  }
}

async function resumeIfSessionExists() {
  if (process.env.NODE_ENV === 'test') return;
  if (hasSavedSession()) {
    console.log('[WhatsApp QR] Restoring saved WhatsApp Web session...');
    connect().catch((err) => {
      console.warn('[WhatsApp QR] Resume warning:', err.message);
    });
  }
}

module.exports = {
  getStatus,
  isConnected,
  connect,
  disconnect,
  sendTextMessage,
  resumeIfSessionExists,
  hasSavedSession
};
