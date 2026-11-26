const crypto = require('node:crypto');

const STAFF_ROLES = new Set(['super_admin', 'admin', 'concierge', 'finance']);
const WEAK_SECRETS = new Set([
  'bhutan_fast_rate_super_secret_jwt_key_2026',
  'secret',
  'changeme',
  'jwt_secret',
  'default',
  'dev-secret'
]);
const DEV_FALLBACK_SECRET = 'bfr-dev-local-jwt-secret-not-for-production';
const EPHEMERAL_PROD_SECRET = crypto.randomBytes(32).toString('hex');

let warnedDevFallback = false;
let warnedProdEphemeral = false;

/**
 * Resolve the HMAC-SHA256 JWT signing secret cleanly for dev and production.
 * In production, unset or known weak default secrets are never used; an
 * ephemeral random per-process secret is used instead with a loud warning.
 */
function getJwtSecret() {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';

  if (isProd) {
    if (!raw || WEAK_SECRETS.has(raw)) {
      if (!warnedProdEphemeral) {
        warnedProdEphemeral = true;
        console.warn(
          '[Auth] WARNING: JWT_SECRET is unset or uses an insecure default in production. ' +
          'Using an ephemeral random runtime secret; tokens will invalidate across restarts.'
        );
      }
      return EPHEMERAL_PROD_SECRET;
    }
    return raw;
  }

  if (!raw) {
    if (!warnedDevFallback) {
      warnedDevFallback = true;
      console.warn('[Auth] JWT_SECRET not set; using deterministic development fallback secret.');
    }
    return DEV_FALLBACK_SECRET;
  }

  return raw;
}

/**
 * Hash a plaintext password using scrypt with a 16-byte random hex salt.
 * Output format matches database/seed.js: `scrypt$<32-hex-salt>$<128-hex-hash>`.
 */
function hashPassword(plain) {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const derivedHex = crypto.scryptSync(String(plain), saltHex, 64).toString('hex');
  return `scrypt$${saltHex}$${derivedHex}`;
}

/**
 * Constant-time verification for `scrypt$<saltHex>$<hashHex>` password hashes.
 * Returns false on mismatch or any malformed input without throwing.
 */
function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, saltHex, hashHex] = parts;
  if (
    !saltHex ||
    !hashHex ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    !/^[0-9a-f]+$/i.test(hashHex) ||
    hashHex.length % 2 !== 0
  ) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(hashHex, 'hex');
    if (expectedBuf.length === 0) return false;
    const derivedBuf = crypto.scryptSync(plain, saltHex, expectedBuf.length);
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Sign a compact HMAC-SHA256 JWT (`base64url.base64url.sig`).
 */
function signToken(payload, expiresInSec = 86400 * 7) {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims = {
    ...(payload && typeof payload === 'object' ? payload : {}),
    iat: nowSec,
    exp: payload && typeof payload.exp === 'number' ? payload.exp : nowSec + Number(expiresInSec)
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = crypto
    .createHmac('sha256', getJwtSecret())
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${sigB64}`;
}

/**
 * Verify a compact HMAC-SHA256 JWT signature and `exp` timestamp.
 * Returns the decoded claims object or null if invalid/expired.
 */
function verifyToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (!header || header.alg !== 'HS256') return null;

    const expectedBuf = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const actualBuf = Buffer.from(sigB64, 'base64url');

    if (actualBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;

    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || nowSec >= claims.exp) return null;

    return claims;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header, or `?token=` query param
 * strictly on GET requests when explicitly enabled by route options.
 */
function extractToken(req, options = {}) {
  const authHeader = req.headers && req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  if (
    options &&
    options.allowQueryToken === true &&
    req.method === 'GET' &&
    req.query &&
    typeof req.query.token === 'string' &&
    req.query.token.trim()
  ) {
    return req.query.token.trim();
  }

  return null;
}

function authenticate(req, res, options) {
  const token = extractToken(req, options);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return null;
  }

  const claims = verifyToken(token);
  if (!claims) {
    res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
    return null;
  }

  return claims;
}

/**
 * Staff RBAC middleware. Supports optional role strings and an optional trailing
 * options object `{ allowQueryToken: true }`.
 */
function requireStaff(...args) {
  let options = {};
  const last = args[args.length - 1];
  if (last && typeof last === 'object' && !Array.isArray(last)) {
    options = args.pop();
  }

  const allowedRoles = args
    .flat()
    .filter((r) => typeof r === 'string' && r.trim().length > 0);

  return (req, res, next) => {
    const user = authenticate(req, res, options);
    if (!user) return;

    if (!user.role || user.role === 'guide' || user.role === 'client' || !STAFF_ROLES.has(user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: staff access required' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: insufficient role permissions' });
    }

    req.user = user;
    return next();
  };
}

/**
 * Guide-only RBAC middleware.
 */
function requireGuide(options = {}) {
  return (req, res, next) => {
    const user = authenticate(req, res, options);
    if (!user) return;

    if (user.role !== 'guide') {
      return res.status(403).json({ success: false, error: 'Forbidden: guide access required' });
    }

    req.user = user;
    return next();
  };
}

function isValidBookingId(bookingId) {
  if (typeof bookingId === 'number') {
    return Number.isFinite(bookingId) && bookingId > 0;
  }
  if (typeof bookingId === 'string') {
    return bookingId.trim().length > 0;
  }
  return false;
}

/**
 * Client-only RBAC middleware. Validates `role === 'client'` and `bookingId`,
 * populates `req.clientBookingId`, and rejects mismatched `:bookingId` params.
 */
function requireClient(options = {}) {
  return (req, res, next) => {
    const user = authenticate(req, res, options);
    if (!user) return;

    if (user.role !== 'client' || !isValidBookingId(user.bookingId)) {
      return res.status(403).json({ success: false, error: 'Forbidden: valid client booking session required' });
    }

    req.user = user;
    req.clientBookingId = user.bookingId;

    const paramBookingId = req.params && (req.params.bookingId ?? req.params.booking_id);
    if (paramBookingId !== undefined && String(paramBookingId) !== String(user.bookingId)) {
      return res.status(403).json({ success: false, error: 'Forbidden: booking access mismatch' });
    }

    return next();
  };
}

/**
 * Route-level guard verifying a named route param matches `req.clientBookingId`.
 */
function verifyClientBookingParam(paramName = 'bookingId') {
  return (req, res, next) => {
    const targetId = req.params && req.params[paramName];
    if (!req.clientBookingId || (targetId !== undefined && String(targetId) !== String(req.clientBookingId))) {
      return res.status(403).json({ success: false, error: 'Forbidden: booking access mismatch' });
    }
    return next();
  };
}

module.exports = {
  STAFF_ROLES,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  extractToken,
  requireStaff,
  requireGuide,
  requireClient,
  verifyClientBookingParam
};
