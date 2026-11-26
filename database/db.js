require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSeedData, hashPasswordScrypt } = require('./seed');

const dbDir = path.dirname(__filename);
const sqlitePath = path.join(dbDir, 'tours.db');
const schemaPath = path.join(dbDir, 'schema.sql');

let sqliteInstance = null;
let pgPool = null;
let currentEngine = 'sqlite'; // 'postgres' or 'sqlite'
let sqliteTxChain = Promise.resolve();

const rawPgUrl = process.env.DATABASE_URL || (
  process.env.PGHOST
    ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
    : null
);
const pgUrl = rawPgUrl && String(rawPgUrl).trim() ? String(rawPgUrl).trim() : null;

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

const SQLITE_COLUMN_MIGRATIONS = [
  { table: 'users', column: 'license_no', definition: 'TEXT' },
  { table: 'users', column: 'languages', definition: 'TEXT' },
  { table: 'users', column: 'specialty', definition: 'TEXT' },

  { table: 'tours', column: 'price_4star_usd', definition: 'INTEGER' },

  { table: 'bookings', column: 'discount_usd', definition: 'INTEGER DEFAULT 0' },
  { table: 'bookings', column: 'flight_assistance', definition: 'INTEGER DEFAULT 0' },
  { table: 'bookings', column: 'nationality_type', definition: "TEXT DEFAULT 'international'" },
  { table: 'bookings', column: 'exchange_rate', definition: 'REAL DEFAULT 1' },
  { table: 'bookings', column: 'payment_plan', definition: "TEXT DEFAULT 'deposit_30'" },
  { table: 'bookings', column: 'balance_due_date', definition: 'DATE' },
  { table: 'bookings', column: 'sdf_remitted_at', definition: 'DATETIME' },
  { table: 'bookings', column: 'sdf_remittance_ref', definition: 'TEXT' },
  { table: 'bookings', column: 'visa_rejection_reason', definition: 'TEXT' },
  { table: 'bookings', column: 'cancellation_reason', definition: 'TEXT' },
  { table: 'bookings', column: 'custom_itinerary_json', definition: 'TEXT' },
  { table: 'bookings', column: 'created_by_staff_id', definition: 'INTEGER' },

  { table: 'travelers', column: 'emergency_contact_name', definition: 'TEXT' },
  { table: 'travelers', column: 'emergency_contact_phone', definition: 'TEXT' },
  { table: 'travelers', column: 'document_notes', definition: 'TEXT' },

  { table: 'payments', column: 'currency', definition: "TEXT DEFAULT 'USD'" },
  { table: 'payments', column: 'amount_local', definition: 'INTEGER' },

  { table: 'notifications', column: 'whatsapp_url', definition: 'TEXT' },
  { table: 'notifications', column: 'metadata_json', definition: 'TEXT' },
  { table: 'notifications', column: 'error_message', definition: 'TEXT' }
];

function migrateSqliteSchema(db) {
  const tableColumnsCache = new Map();

  for (const mig of SQLITE_COLUMN_MIGRATIONS) {
    if (!tableColumnsCache.has(mig.table)) {
      const infoRows = db.prepare(`PRAGMA table_info(${mig.table})`).all();
      tableColumnsCache.set(mig.table, new Set(infoRows.map(r => r.name)));
    }
    const cols = tableColumnsCache.get(mig.table);
    if (!cols.has(mig.column)) {
      db.exec(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.column} ${mig.definition};`);
      cols.add(mig.column);
    }
  }
}

function getSqliteDb() {
  if (sqliteInstance) return sqliteInstance;

  const { DatabaseSync } = require('node:sqlite');
  const isNew = !fs.existsSync(sqlitePath);
  sqliteInstance = new DatabaseSync(sqlitePath);
  sqliteInstance.exec('PRAGMA foreign_keys = ON;');
  sqliteInstance.exec('PRAGMA busy_timeout = 5000;');

  const hasToursTable = !isNew && Boolean(
    sqliteInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tours'").get()
  );

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  sqliteInstance.exec(schemaSql);
  migrateSqliteSchema(sqliteInstance);

  const toursCountRow = sqliteInstance.prepare('SELECT COUNT(*) as count FROM tours').get();
  const festivalsCountRow = sqliteInstance.prepare('SELECT COUNT(*) as count FROM festivals').get();
  const needsFullSeed = isNew || !hasToursTable || Number(toursCountRow.count) === 0;
  const needsUpgradeSeed = !needsFullSeed && Number(festivalsCountRow.count) === 0;

  if (needsFullSeed || needsUpgradeSeed) {
    console.log(`[DB-SQLite] ${needsFullSeed ? 'Initializing schema and seed data...' : 'Upgrading schema and backfilling parity seed data...'}`);
    seedDatabase(sqliteInstance, { fullSeed: needsFullSeed });
  }

  return sqliteInstance;
}

function seedDatabase(db, { fullSeed = true } = {}) {
  const seed = getSeedData();

  db.exec('BEGIN;');
  try {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (uuid, full_name, email, phone, password_hash, role, license_no, languages, specialty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateUserMeta = db.prepare(`
      UPDATE users
      SET license_no = COALESCE(license_no, ?),
          languages = COALESCE(languages, ?),
          specialty = COALESCE(specialty, ?)
      WHERE email = ?
    `);
    const updateUserHash = db.prepare(`
      UPDATE users SET password_hash = ? WHERE email = ? AND password_hash NOT LIKE 'scrypt$%'
    `);

    for (const u of seed.users) {
      insertUser.run(
        u.uuid, u.full_name, u.email, u.phone, u.password_hash, u.role,
        u.license_no || null, u.languages || null, u.specialty || null
      );
      updateUserMeta.run(u.license_no || null, u.languages || null, u.specialty || null, u.email);
      updateUserHash.run(u.password_hash, u.email);
    }

    const userRows = db.prepare('SELECT id, email FROM users').all();
    const userIdByEmail = Object.fromEntries(userRows.map(r => [r.email, r.id]));
    const kinleyId = userIdByEmail['kinley@bhutanfastratetours.bt'] || 3;
    const dorjiId = userIdByEmail['dorji@bhutanfastratetours.bt'] || kinleyId;
    const financeId = userIdByEmail['finance@bhutanfastratetours.bt'] || 1;
    const guideIdMap = { 3: kinleyId, 4: dorjiId };

    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, category, description)
      VALUES (?, ?, ?, ?)
    `);
    for (const s of seed.settings) {
      insertSetting.run(s.key, s.value, s.category, s.description);
    }

    const insertDest = db.prepare(`
      INSERT OR IGNORE INTO destinations (id, name, slug, tagline, altitude_meters, region, description, highlights_json, best_months, cover_image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of seed.destinations) {
      insertDest.run(
        d.id, d.name, d.slug, d.tagline, d.altitude_meters, d.region,
        d.description, d.highlights_json, d.best_months, d.cover_image, d.sort_order
      );
    }

    const insertTour = db.prepare(`
      INSERT OR IGNORE INTO tours (id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, highlight_text, cover_image, itinerary_json, inclusions_json, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fillTour4Star = db.prepare(`
      UPDATE tours SET price_4star_usd = ? WHERE id = ? AND price_4star_usd IS NULL
    `);
    for (const t of seed.tours) {
      insertTour.run(
        t.id, t.title, t.slug, t.subtitle, t.duration_days, t.duration_nights,
        t.category, t.difficulty, t.price_usd, t.price_3star_usd, t.price_4star_usd, t.price_5star_usd,
        t.valleys, t.highlight_text, t.cover_image, t.itinerary_json, t.inclusions_json,
        t.is_featured, t.sort_order
      );
      fillTour4Star.run(t.price_4star_usd, t.id);
    }

    const insertFestival = db.prepare(`
      INSERT OR IGNORE INTO festivals (id, name, slug, season, dates_label, venue, valley, duration_days, price_usd, summary, etiquette, highlights_json, related_tour_id, cover_image, is_featured, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of seed.festivals) {
      insertFestival.run(
        f.id, f.name, f.slug, f.season, f.dates_label, f.venue, f.valley,
        f.duration_days, f.price_usd, f.summary, f.etiquette, f.highlights_json,
        f.related_tour_id, f.cover_image, f.is_featured, f.is_active, f.sort_order
      );
    }

    const bookingsCount = Number(db.prepare('SELECT COUNT(*) as count FROM bookings').get().count);
    if (fullSeed || bookingsCount === 0) {
      const insertBooking = db.prepare(`
        INSERT OR IGNORE INTO bookings (
          id, tour_id, tour_title, is_custom_trip,
          lead_name, lead_email, lead_phone, lead_country, lead_passport_no, lead_passport_expiry,
          travel_date_start, travel_date_end, total_nights, total_travelers,
          adults_count, children_6_12, children_under_6, hotel_tier,
          base_price_usd, sdf_total_usd, visa_fee_usd, extras_usd, discount_usd, total_price_usd,
          currency, nationality_type, exchange_rate, payment_plan, balance_due_date,
          deposit_paid_usd, full_paid, flight_assistance,
          booking_status, visa_status, visa_clearance_number, visa_submitted_date, visa_approved_date,
          sdf_remitted_at, sdf_remittance_ref, assigned_guide_id, assigned_vehicle,
          special_requests, internal_notes, source
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `);
      for (const b of seed.sampleBookings) {
        const mappedGuideId = b.assigned_guide_id ? (guideIdMap[b.assigned_guide_id] || kinleyId) : null;
        insertBooking.run(
          b.id, b.tour_id, b.tour_title, b.is_custom_trip,
          b.lead_name, b.lead_email, b.lead_phone, b.lead_country, b.lead_passport_no, b.lead_passport_expiry || null,
          b.travel_date_start, b.travel_date_end, b.total_nights, b.total_travelers,
          b.adults_count, b.children_6_12, b.children_under_6, b.hotel_tier,
          b.base_price_usd, b.sdf_total_usd, b.visa_fee_usd, b.extras_usd, b.discount_usd || 0, b.total_price_usd,
          b.currency || 'USD', b.nationality_type || 'international', b.exchange_rate || 1,
          b.payment_plan || 'deposit_30', b.balance_due_date || null,
          b.deposit_paid_usd, b.full_paid, b.flight_assistance || 0,
          b.booking_status, b.visa_status, b.visa_clearance_number || null,
          b.visa_submitted_date || null, b.visa_approved_date || null,
          b.sdf_remitted_at || null, b.sdf_remittance_ref || null,
          mappedGuideId, b.assigned_vehicle || null,
          b.special_requests || null, b.internal_notes || null, b.source
        );
      }
    }

    const existingBookings = new Set(db.prepare('SELECT id FROM bookings').all().map(r => r.id));

    const travelersCount = Number(db.prepare('SELECT COUNT(*) as count FROM travelers').get().count);
    if (travelersCount === 0) {
      const insertTraveler = db.prepare(`
        INSERT INTO travelers (
          booking_id, full_name, passport_number, passport_expiry, nationality, date_of_birth,
          age_category, gender, dietary_needs, medical_notes,
          emergency_contact_name, emergency_contact_phone, document_notes, sdf_rate_usd, visa_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tr of seed.sampleTravelers) {
        if (existingBookings.has(tr.booking_id)) {
          insertTraveler.run(
            tr.booking_id, tr.full_name, tr.passport_number, tr.passport_expiry, tr.nationality, tr.date_of_birth,
            tr.age_category, tr.gender, tr.dietary_needs, tr.medical_notes,
            tr.emergency_contact_name, tr.emergency_contact_phone, tr.document_notes, tr.sdf_rate_usd, tr.visa_status
          );
        }
      }
    }

    const paymentsCount = Number(db.prepare('SELECT COUNT(*) as count FROM payments').get().count);
    if (paymentsCount === 0) {
      const insertPayment = db.prepare(`
        INSERT INTO payments (
          booking_id, amount_usd, currency, amount_local, payment_type, payment_method,
          transaction_ref, status, verified_by, verified_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of seed.samplePayments) {
        if (existingBookings.has(p.booking_id)) {
          insertPayment.run(
            p.booking_id, p.amount_usd, p.currency || 'USD', p.amount_local ?? p.amount_usd,
            p.payment_type, p.payment_method, p.transaction_ref, p.status,
            p.verified_by ? financeId : null, p.verified_at || null, p.notes || null
          );
        }
      }
    }

    const gaCount = Number(db.prepare('SELECT COUNT(*) as count FROM guide_assignments').get().count);
    if (gaCount === 0) {
      const insertGa = db.prepare(`
        INSERT INTO guide_assignments (
          guide_id, booking_id, start_date, end_date, vehicle_plate, driver_name, daily_rate_usd, status, guide_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ga of seed.sampleGuideAssignments) {
        if (existingBookings.has(ga.booking_id)) {
          insertGa.run(
            guideIdMap[ga.guide_id] || kinleyId, ga.booking_id, ga.start_date, ga.end_date,
            ga.vehicle_plate, ga.driver_name, ga.daily_rate_usd, ga.status, ga.guide_notes
          );
        }
      }
    }

    const inqCount = Number(db.prepare('SELECT COUNT(*) as count FROM inquiries').get().count);
    if (fullSeed || inqCount === 0) {
      const insertInq = db.prepare(`
        INSERT OR IGNORE INTO inquiries (ref_code, name, email, phone, country, preferred_dates, duration_days, travelers_count, budget_range, interests, message, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const i of seed.sampleInquiries) {
        insertInq.run(
          i.ref_code, i.name, i.email, i.phone, i.country, i.preferred_dates,
          i.duration_days, i.travelers_count, i.budget_range, i.interests,
          i.message, i.source || 'website', i.status || 'new'
        );
      }
    }

    const revCount = Number(db.prepare('SELECT COUNT(*) as count FROM reviews').get().count);
    if (fullSeed || revCount === 0) {
      const insertRev = db.prepare(`
        INSERT INTO reviews (author_name, author_country, tour_taken, travel_date, rating, title, comment, is_verified, is_featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of seed.sampleReviews) {
        insertRev.run(r.author_name, r.author_country, r.tour_taken, r.travel_date, r.rating, r.title, r.comment, r.is_verified, r.is_featured);
      }
    }

    const notifCount = Number(db.prepare('SELECT COUNT(*) as count FROM notifications').get().count);
    if (notifCount === 0) {
      const insertNotif = db.prepare(`
        INSERT INTO notifications (recipient_type, recipient_id, channel, category, title, message, action_url, whatsapp_url, metadata_json, is_read, is_sent, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      for (const n of seed.sampleNotifications) {
        insertNotif.run(
          n.recipient_type, n.recipient_id, n.channel, n.category,
          n.title, n.message, n.action_url, n.whatsapp_url || null,
          n.metadata_json || null, n.is_read ? 1 : 0, n.is_sent ? 1 : 0
        );
      }
    }

    const auditCount = Number(db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count);
    if (fullSeed && auditCount === 0) {
      const insertAudit = db.prepare(`
        INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, old_value, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of seed.sampleAuditLogs) {
        insertAudit.run(a.user_id, a.user_name, a.user_role, a.action, a.entity_type, a.entity_id, a.old_value || null, a.new_value || null);
      }
    }

    db.exec('COMMIT;');
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (_) {}
    throw err;
  }
}

/**
 * Single lexer/scanner for SQL statements: handles comments (-- and /* *\/),
 * single-quoted strings (including '' and E'\' escapes), double-quoted
 * identifiers, and dollar-quoted blocks ($tag$...$tag$).
 */
function transformSql(sql, { replacePlaceholders = false, stripLiterals = false } = {}) {
  let out = '';
  let paramIndex = 1;
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    if (ch === '-' && next === '-') {
      const nl = sql.indexOf('\n', i + 2);
      const end = nl === -1 ? len : nl + 1;
      out += stripLiterals ? (nl === -1 ? '' : '\n') : sql.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? len : close + 2;
      out += stripLiterals ? ' ' : sql.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '\'') {
      const prev = i > 0 ? sql[i - 1] : '';
      const prevPrev = i > 1 ? sql[i - 2] : '';
      const isEscape = (prev === 'E' || prev === 'e') && !/[a-zA-Z0-9_$]/.test(prevPrev);
      let j = i + 1;
      while (j < len) {
        if (isEscape && sql[j] === '\\') {
          j += 2;
          continue;
        }
        if (sql[j] === '\'') {
          if (j + 1 < len && sql[j + 1] === '\'') {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      out += stripLiterals ? ' ' : sql.slice(i, j);
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '"') {
          if (j + 1 < len && sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      out += sql.slice(i, j);
      i = j;
      continue;
    }

    if (ch === '$') {
      const tagMatch = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        const close = sql.indexOf(tag, i + tag.length);
        const end = close === -1 ? len : close + tag.length;
        out += stripLiterals ? ' ' : sql.slice(i, end);
        i = end;
        continue;
      }
    }

    if (ch === '?' && replacePlaceholders) {
      out += `$${paramIndex++}`;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function toPostgresSql(sql) {
  return transformSql(sql, { replacePlaceholders: true });
}

/**
 * Append `RETURNING id` on PostgreSQL INSERT statements (except tables without `id`
 * like `settings`, or statements that already include `RETURNING`).
 */
function preparePostgresRunSql(pgSql) {
  const bare = transformSql(pgSql, { stripLiterals: true });
  const insertMatch = bare.match(/^\s*INSERT\s+INTO\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z_][a-zA-Z0-9_.]*))/i);
  if (!insertMatch) return pgSql;

  const rawTable = insertMatch[1] || insertMatch[2] || insertMatch[3];
  const tableName = rawTable.split('.').pop().toLowerCase();
  if (tableName === 'settings') return pgSql;
  if (/\bRETURNING\b/i.test(bare)) return pgSql;

  return `${pgSql.replace(/;\s*$/, '')} RETURNING id`;
}

function normalizeSqliteRunResult(res) {
  const rawId = res && res.lastInsertRowid;
  const lastInsertRowid = rawId !== undefined && rawId !== null
    ? (typeof rawId === 'bigint' ? Number(rawId) : rawId)
    : null;
  return {
    changes: Number((res && res.changes) ?? 0),
    lastInsertRowid
  };
}

function createPgRunner(executor) {
  return {
    async query(sql, params = []) {
      const res = await executor.query(toPostgresSql(sql), params);
      return res.rows;
    },
    async get(sql, params = []) {
      const res = await executor.query(toPostgresSql(sql), params);
      return res.rows[0];
    },
    async run(sql, params = []) {
      const pgSql = preparePostgresRunSql(toPostgresSql(sql));
      const res = await executor.query(pgSql, params);
      return {
        changes: res.rowCount ?? 0,
        lastInsertRowid: res.rows && res.rows[0] && res.rows[0].id !== undefined ? res.rows[0].id : null
      };
    }
  };
}

function createSqliteRunner(db) {
  return {
    async query(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      return normalizeSqliteRunResult(db.prepare(sql).run(...params));
    }
  };
}

function getRunner() {
  if (currentEngine === 'postgres' && pgPool) {
    return createPgRunner(pgPool);
  }
  return createSqliteRunner(getSqliteDb());
}

async function query(sql, params = []) {
  return getRunner().query(sql, params);
}

async function get(sql, params = []) {
  return getRunner().get(sql, params);
}

async function run(sql, params = []) {
  return getRunner().run(sql, params);
}

function withSqliteTxLock(work) {
  const next = sqliteTxChain.then(work, work);
  sqliteTxChain = next.catch(() => {});
  return next;
}

async function transaction(fn) {
  if (currentEngine === 'postgres' && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(createPgRunner(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  const db = getSqliteDb();
  return withSqliteTxLock(async () => {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const result = await fn(createSqliteRunner(db));
      db.exec('COMMIT;');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }
  });
}

async function closeDb() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
  }
}

module.exports = {
  getDb: () => (currentEngine === 'postgres' ? pgPool : getSqliteDb()),
  getEngine: () => currentEngine,
  query,
  get,
  run,
  transaction,
  closeDb,
  hashPasswordScrypt,
  toPostgresSql,
  preparePostgresRunSql
};
