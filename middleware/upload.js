const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const UPLOAD_SUBDIRS = ['passports', 'insurance', 'photos', 'receipts'];

const FIELD_SUBDIRS = {
  passport_scan: 'passports',
  photo_url: 'photos',
  insurance_doc: 'insurance',
  receipt_file: 'receipts'
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const PDF_MIME_TYPES = new Set(['application/pdf']);

function getUploadMaxMb() {
  const parsed = Number(process.env.UPLOAD_MAX_MB);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

const MAX_UPLOAD_MB = getUploadMaxMb();
const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024);

/**
 * Create the private `uploads/` root and all expected subdirectories if missing.
 */
function ensureUploadDirs() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  for (const sub of UPLOAD_SUBDIRS) {
    fs.mkdirSync(path.join(UPLOAD_ROOT, sub), { recursive: true });
  }
}

ensureUploadDirs();

function isAllowedFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (ext === '.pdf') return PDF_MIME_TYPES.has(mime);
  return IMAGE_MIME_TYPES.has(mime);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const subdir = FIELD_SUBDIRS[file.fieldname];
    if (!subdir) {
      const err = new Error(`Unsupported upload field: ${file.fieldname}`);
      err.status = 400;
      err.code = 'INVALID_UPLOAD_FIELD';
      return cb(err);
    }
    ensureUploadDirs();
    return cb(null, path.join(UPLOAD_ROOT, subdir));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
    const randomName = `${crypto.randomBytes(12).toString('hex')}${safeExt}`;
    return cb(null, randomName);
  }
});

function fileFilter(req, file, cb) {
  if (!FIELD_SUBDIRS[file.fieldname]) {
    const err = new Error(`Unsupported upload field: ${file.fieldname}`);
    err.status = 400;
    err.code = 'INVALID_UPLOAD_FIELD';
    return cb(err);
  }
  if (!isAllowedFile(file)) {
    const err = new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.');
    err.status = 400;
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  }
  return cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

const uploadTravelerDocs = uploader.fields([
  { name: 'passport_scan', maxCount: 1 },
  { name: 'photo_url', maxCount: 1 },
  { name: 'insurance_doc', maxCount: 1 }
]);

const uploadPaymentReceipt = uploader.single('receipt_file');

/**
 * Convert a Multer file object to a POSIX-normalized path relative to `UPLOAD_ROOT`
 * (e.g. `passports/<random>.pdf`).
 */
function toRelativeUploadPath(file) {
  if (!file || !file.path) return null;
  return path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
}

module.exports = {
  UPLOAD_ROOT,
  UPLOAD_SUBDIRS,
  FIELD_SUBDIRS,
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  ensureUploadDirs,
  uploadTravelerDocs,
  uploadPaymentReceipt,
  toRelativeUploadPath
};
