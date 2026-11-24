require('dotenv').config();
const fs = require('fs');
const path = require('path');

const dbDir = path.dirname(__filename);
const sqlitePath = path.join(dbDir, 'tours.db');
const schemaPath = path.join(dbDir, 'schema.sql');
const { getSeedData } = require('./seed');

let sqliteInstance = null;
let pgPool = null;
let currentEngine = 'sqlite'; // 'postgres' or 'sqlite'

// Check if PostgreSQL is configured via environment variable
const pgUrl = process.env.DATABASE_URL || (process.env.PGHOST ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}` : null);

if (pgUrl) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: pgUrl, connectionTimeoutMillis: 3000 });
    currentEngine = 'postgres';
    console.log('[DB] PostgreSQL driver initialized with DATABASE_URL.');
  } catch (err) {
    console.warn('[DB] PostgreSQL pool creation failed, falling back to SQLite:', err.message);
    currentEngine = 'sqlite';
  }
}

// Initialize SQLite engine
function getSqliteDb() {
  if (sqliteInstance) return sqliteInstance;

  const { DatabaseSync } = require('node:sqlite');
  const isNew = !fs.existsSync(sqlitePath);
  sqliteInstance = new DatabaseSync(sqlitePath);
  sqliteInstance.exec('PRAGMA foreign_keys = ON;');

  if (isNew) {
    console.log('[DB-SQLite] Initializing schema and seed data...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    sqliteInstance.exec(schemaSql);
    seedDatabase(sqliteInstance);
  } else {
    const test = sqliteInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tours'").get();
    if (!test) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      sqliteInstance.exec(schemaSql);
      seedDatabase(sqliteInstance);
    }
  }

  return sqliteInstance;
}

function seedDatabase(db) {
  const seed = getSeedData();

  const insertUser = db.prepare(`
    INSERT INTO users (uuid, full_name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const u of seed.users) {
    insertUser.run(u.uuid, u.full_name, u.email, u.phone, u.password_hash, u.role);
  }

  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value, category, description)
    VALUES (?, ?, ?, ?)
  `);
  for (const s of seed.settings) {
    insertSetting.run(s.key, s.value, s.category, s.description);
  }

  const insertDest = db.prepare(`
    INSERT INTO destinations (id, name, slug, tagline, altitude_meters, region, description, highlights_json, best_months, cover_image, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of seed.destinations) {
    insertDest.run(d.id, d.name, d.slug, d.tagline, d.altitude_meters, d.region, d.description, d.highlights_json, d.best_months, d.cover_image, d.sort_order);
  }

  const insertTour = db.prepare(`
    INSERT INTO tours (id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_5star_usd, valleys, highlight_text, cover_image, itinerary_json, inclusions_json, is_featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of seed.tours) {
    insertTour.run(t.id, t.title, t.slug, t.subtitle, t.duration_days, t.duration_nights, t.category, t.difficulty, t.price_usd, t.price_3star_usd, t.price_5star_usd, t.valleys, t.highlight_text, t.cover_image, t.itinerary_json, t.inclusions_json, t.is_featured, t.sort_order);
  }

  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, tour_id, tour_title, is_custom_trip, lead_name, lead_email, lead_phone, lead_country, lead_passport_no, travel_date_start, travel_date_end, total_nights, total_travelers, adults_count, children_6_12, children_under_6, hotel_tier, base_price_usd, sdf_total_usd, visa_fee_usd, extras_usd, total_price_usd, deposit_paid_usd, full_paid, booking_status, visa_status, visa_clearance_number, visa_submitted_date, visa_approved_date, assigned_guide_id, assigned_vehicle, special_requests, internal_notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of seed.sampleBookings) {
    insertBooking.run(b.id, b.tour_id, b.tour_title, b.is_custom_trip, b.lead_name, b.lead_email, b.lead_phone, b.lead_country, b.lead_passport_no, b.travel_date_start, b.travel_date_end, b.total_nights, b.total_travelers, b.adults_count, b.children_6_12, b.children_under_6, b.hotel_tier, b.base_price_usd, b.sdf_total_usd, b.visa_fee_usd, b.extras_usd, b.total_price_usd, b.deposit_paid_usd, b.full_paid, b.booking_status, b.visa_status, b.visa_clearance_number || null, b.visa_submitted_date || null, b.visa_approved_date || null, b.assigned_guide_id || null, b.assigned_vehicle || null, b.special_requests || null, b.internal_notes || null, b.source);
  }

  const insertInq = db.prepare(`
    INSERT INTO inquiries (ref_code, name, email, phone, country, preferred_dates, duration_days, travelers_count, budget_range, interests, message, source, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'new')
  `);
  for (const i of seed.sampleInquiries) {
    insertInq.run(i.ref_code, i.name, i.email, i.phone, i.country, i.preferred_dates, i.duration_days, i.travelers_count, i.budget_range, i.interests, i.message, i.status);
  }

  const insertRev = db.prepare(`
    INSERT INTO reviews (author_name, author_country, tour_taken, travel_date, rating, title, comment, is_verified, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of seed.sampleReviews) {
    insertRev.run(r.author_name, r.author_country, r.tour_taken, r.travel_date, r.rating, r.title, r.comment, r.is_verified, r.is_featured);
  }
}

// Convert ? placeholders to $1, $2, etc. for PostgreSQL
function toPostgresSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Unified Query API (Works synchronously for SQLite, and returns Promise for async/PG)
function query(sql, params = []) {
  if (currentEngine === 'postgres' && pgPool) {
    const pgSql = toPostgresSql(sql);
    return pgPool.query(pgSql, params).then(res => res.rows);
  }
  const db = getSqliteDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function get(sql, params = []) {
  if (currentEngine === 'postgres' && pgPool) {
    const pgSql = toPostgresSql(sql);
    return pgPool.query(pgSql, params).then(res => res.rows[0]);
  }
  const db = getSqliteDb();
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function run(sql, params = []) {
  if (currentEngine === 'postgres' && pgPool) {
    const pgSql = toPostgresSql(sql);
    return pgPool.query(pgSql, params).then(res => ({
      changes: res.rowCount,
      lastInsertRowid: res.rows[0] ? res.rows[0].id : null
    }));
  }
  const db = getSqliteDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

module.exports = {
  getDb: () => (currentEngine === 'postgres' ? pgPool : getSqliteDb()),
  getEngine: () => currentEngine,
  query,
  get,
  run
};
