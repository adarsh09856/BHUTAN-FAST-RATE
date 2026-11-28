require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const db = require('./database/db');
const { ensureUploadDirs, MAX_UPLOAD_MB } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

const BLOCKED_DIR_RE = /^\/(?:(database|uploads|middleware|routes|tests|docs|\.git|\.superpowers)(\/|$)|services\/)/i;
const BLOCKED_FILE_RE = /^\/(\.env(\..*)?|\.gitignore|package\.json|package-lock\.json|test-crud\.js|server\.js)$/i;
const BLOCKED_SEGMENT_RE = /(^|\/)(\.env(\..*)?|\.git)(\/|$)/i;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bootstrap private upload directories & database
ensureUploadDirs();
db.getDb();

// Mount API Routes
app.use('/api', require('./routes/public'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/guide', require('./routes/guide'));
app.use('/api/client', require('./routes/client'));

const notificationsRoutePath = path.join(__dirname, 'routes', 'notifications.js');
if (fs.existsSync(notificationsRoutePath)) {
  app.use('/api/notifications', require('./routes/notifications'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Bhutan Fast Rate Tours API',
    license: 'TR/2018/9882',
    timestamp: new Date().toISOString()
  });
});

// Unknown API routes return clean JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

function decodeAndNormalizePath(rawPath) {
  let decoded = String(rawPath || '/');
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  if (decoded.includes('\0')) return null;

  const slashed = decoded.replace(/\\/g, '/').replace(/\/+/g, '/');
  const normalized = path.posix.normalize(slashed);
  return { raw: slashed, normalized };
}

function isBlockedStaticPath(rawPath) {
  const parsed = decodeAndNormalizePath(rawPath);
  if (!parsed) return true;

  for (const candidate of [parsed.raw, parsed.normalized]) {
    if (
      BLOCKED_DIR_RE.test(candidate) ||
      BLOCKED_FILE_RE.test(candidate) ||
      BLOCKED_SEGMENT_RE.test(candidate)
    ) {
      return true;
    }
  }
  return false;
}

// Security blocklist BEFORE express.static
app.use((req, res, next) => {
  if (isBlockedStaticPath(req.path)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  return next();
});

// Convenience portal directory redirects & clean /services page route (before express.static directory redirect)
app.get('/services', (req, res) => res.sendFile(path.join(__dirname, 'services.html')));
app.get(['/admin', '/admin/'], (req, res) => res.redirect(302, '/admin/login.html'));
app.get(['/client', '/client/'], (req, res) => res.redirect(302, '/client/login.html'));
app.get(['/guide', '/guide/'], (req, res) => res.redirect(302, '/guide/login.html'));

// Serve static frontend files
app.use(express.static(__dirname));

// Dynamic HTML fallbacks for admin-created tours, destinations, festivals & extensionless pages
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const parsed = decodeAndNormalizePath(req.path);
  if (!parsed) return next();

  const reqPath = parsed.normalized;
  if (/^\/tour-[^/]+\.html$/i.test(reqPath)) {
    const tourHtmlPath = path.join(__dirname, 'tour.html');
    const target = fs.existsSync(tourHtmlPath) ? tourHtmlPath : path.join(__dirname, 'tours.html');
    return res.sendFile(target);
  }
  if (/^\/destination-[^/]+\.html$/i.test(reqPath)) {
    return res.sendFile(path.join(__dirname, 'destinations.html'));
  }
  if (/^\/festival-[^/]+\.html$/i.test(reqPath)) {
    return res.sendFile(path.join(__dirname, 'festivals.html'));
  }

  const extMatch = reqPath.match(/^\/([a-z0-9-]+)\/?$/i);
  if (extMatch) {
    const candidate = path.join(__dirname, `${extMatch[1]}.html`);
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }

  return next();
});

// Fallback to index.html for root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized JSON error handler (Multer limits, validation errors, unexpected failures)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File too large. Maximum allowed size is ${MAX_UPLOAD_MB}MB.`
      : err.message || 'File upload error';
    return res.status(400).json({
      success: false,
      error: message,
      code: err.code
    });
  }

  if (
    err &&
    (err.code === 'INVALID_FILE_TYPE' ||
      err.code === 'INVALID_UPLOAD_FIELD' ||
      err.status === 400 ||
      err.statusCode === 400)
  ) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Bad request',
      ...(err.code ? { code: err.code } : {})
    });
  }

  const status = err && (err.status || err.statusCode) ? Number(err.status || err.statusCode) : 500;
  if (status >= 500) {
    console.error('[Server Error]', err);
  }

  return res.status(status).json({
    success: false,
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err && err.message) || 'Internal server error'
  });
});

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log('=======================================================');
    console.log('⚡ BHUTAN FAST RATE TOURS - PRODUCTION SERVER ONLINE');
    console.log(`📍 Web & API URL: http://localhost:${port}`);
    console.log(`🛡️  Admin Panel:  http://localhost:${port}/admin/login.html`);
    console.log(`🧳 Client Portal: http://localhost:${port}/client/login.html`);
    console.log(`🏔️  Guide Portal:  http://localhost:${port}/guide/login.html`);
    console.log('=======================================================');
  });
}

if (require.main === module) {
  startServer(PORT);
}

app.app = app;
app.startServer = startServer;

module.exports = app;
