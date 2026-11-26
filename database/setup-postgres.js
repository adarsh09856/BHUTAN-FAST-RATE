/**
 * Bhutan Fast Rate Tours — PostgreSQL & SQLite Setup & Migration Utility
 * Usage:
 *   node database/setup-postgres.js
 * Or with custom URL:
 *   DATABASE_URL=postgresql://postgres:password@localhost:5432/bhutan_tours node database/setup-postgres.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSeedData } = require('./seed');

const rawPgUrl = process.env.DATABASE_URL ||
  (process.env.PGHOST ? `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'bhutan_tours'}` : null);
const pgUrl = rawPgUrl && String(rawPgUrl).trim() ? String(rawPgUrl).trim() : null;

const PG_MIGRATION_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS license_no VARCHAR(100)',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT',
  'ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_4star_usd INTEGER',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_usd INTEGER DEFAULT 0',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_assistance SMALLINT DEFAULT 0',
  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nationality_type VARCHAR(30) DEFAULT 'international'",
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS exchange_rate DOUBLE PRECISION DEFAULT 1',
  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(30) DEFAULT 'deposit_30'",
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_due_date DATE',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sdf_remitted_at TIMESTAMPTZ',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sdf_remittance_ref VARCHAR(100)',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visa_rejection_reason TEXT',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_itinerary_json TEXT',
  'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL',
  'ALTER TABLE travelers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)',
  'ALTER TABLE travelers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50)',
  'ALTER TABLE travelers ADD COLUMN IF NOT EXISTS document_notes TEXT',
  "ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD'",
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_local INTEGER',
  'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS whatsapp_url TEXT',
  'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata_json TEXT',
  'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_message TEXT'
];

async function verifySqliteHealth() {
  console.log('\n[NOTICE] No PostgreSQL DATABASE_URL found in environment.');
  console.log('Current Active Engine: Native SQLite (database/tours.db)');
  console.log('\nTo connect to PostgreSQL in production:');
  console.log('1. Create a database in PostgreSQL: CREATE DATABASE bhutan_tours;');
  console.log('2. Add to your .env file:');
  console.log('   DATABASE_URL=postgresql://username:password@localhost:5432/bhutan_tours');
  console.log('3. Re-run: node database/setup-postgres.js');
  console.log('\nVerifying current SQLite database health...');

  const db = require('./db');
  try {
    const toursCount = (await db.get('SELECT COUNT(*) as count FROM tours')).count;
    const destsCount = (await db.get('SELECT COUNT(*) as count FROM destinations')).count;
    const festivalsCount = (await db.get('SELECT COUNT(*) as count FROM festivals')).count;
    const usersCount = (await db.get('SELECT COUNT(*) as count FROM users')).count;
    const bookingsCount = (await db.get('SELECT COUNT(*) as count FROM bookings')).count;
    const gaCount = (await db.get('SELECT COUNT(*) as count FROM guide_assignments')).count;

    console.log(`✓ SQLite Engine Active: ${toursCount} Tours, ${destsCount} Destinations, ${festivalsCount} Festivals, ${usersCount} Staff Users, ${bookingsCount} Bookings, ${gaCount} Guide Assignments.`);
    console.log('All tables, schemas, and canonical settings are operational.\n');
  } finally {
    await db.closeDb();
  }
}

async function setupPostgres() {
  console.log(`Connecting to PostgreSQL at: ${pgUrl.replace(/:[^:]*@/, ':****@')}...`);
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });

  let client;
  try {
    client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL server.');

    const schemaFile = path.join(__dirname, 'postgres-schema.sql');
    const schemaSql = fs.readFileSync(schemaFile, 'utf8');
    console.log('Executing postgres-schema.sql (14 Relational Tables)...');
    await client.query(schemaSql);

    for (const stmt of PG_MIGRATION_STATEMENTS) {
      await client.query(stmt);
    }
    console.log('✓ Tables, foreign keys, column migrations, and indexes created successfully.');

    const checkTours = await client.query('SELECT COUNT(*) FROM tours');
    const existingCount = parseInt(checkTours.rows[0].count, 10);
    const seed = getSeedData();

    await client.query('BEGIN');

    // Always upsert/backfill users, settings, destinations, tours, festivals safely
    for (const u of seed.users) {
      await client.query(`
        INSERT INTO users (uuid, full_name, email, phone, password_hash, role, license_no, languages, specialty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = CASE WHEN users.password_hash NOT LIKE 'scrypt$%' THEN EXCLUDED.password_hash ELSE users.password_hash END,
          license_no = COALESCE(users.license_no, EXCLUDED.license_no),
          languages = COALESCE(users.languages, EXCLUDED.languages),
          specialty = COALESCE(users.specialty, EXCLUDED.specialty)
      `, [u.uuid, u.full_name, u.email, u.phone, u.password_hash, u.role, u.license_no || null, u.languages || null, u.specialty || null]);
    }

    const userRes = await client.query('SELECT id, email FROM users');
    const userIdByEmail = Object.fromEntries(userRes.rows.map(r => [r.email, r.id]));
    const kinleyId = userIdByEmail['kinley@bhutanfastratetours.bt'] || 3;
    const dorjiId = userIdByEmail['dorji@bhutanfastratetours.bt'] || kinleyId;
    const financeId = userIdByEmail['finance@bhutanfastratetours.bt'] || 1;
    const guideIdMap = { 3: kinleyId, 4: dorjiId };

    for (const s of seed.settings) {
      await client.query(`
        INSERT INTO settings (key, value, category, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO NOTHING
      `, [s.key, s.value, s.category, s.description]);
    }

    for (const d of seed.destinations) {
      await client.query(`
        INSERT INTO destinations (id, name, slug, tagline, altitude_meters, region, description, highlights_json, best_months, cover_image, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [d.id, d.name, d.slug, d.tagline, d.altitude_meters, d.region, d.description, d.highlights_json, d.best_months, d.cover_image, d.sort_order]);
    }

    for (const t of seed.tours) {
      await client.query(`
        INSERT INTO tours (id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_4star_usd, price_5star_usd, valleys, highlight_text, cover_image, itinerary_json, inclusions_json, is_featured, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          price_4star_usd = COALESCE(tours.price_4star_usd, EXCLUDED.price_4star_usd)
      `, [
        t.id, t.title, t.slug, t.subtitle, t.duration_days, t.duration_nights,
        t.category, t.difficulty, t.price_usd, t.price_3star_usd, t.price_4star_usd, t.price_5star_usd,
        t.valleys, t.highlight_text, t.cover_image, t.itinerary_json, t.inclusions_json,
        t.is_featured ? 1 : 0, t.sort_order
      ]);
    }

    for (const f of seed.festivals) {
      await client.query(`
        INSERT INTO festivals (id, name, slug, season, dates_label, venue, valley, duration_days, price_usd, summary, etiquette, highlights_json, related_tour_id, cover_image, is_featured, is_active, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO NOTHING
      `, [
        f.id, f.name, f.slug, f.season, f.dates_label, f.venue, f.valley,
        f.duration_days, f.price_usd, f.summary, f.etiquette, f.highlights_json,
        f.related_tour_id, f.cover_image, f.is_featured ? 1 : 0, f.is_active ? 1 : 0, f.sort_order
      ]);
    }

    const bookingsCount = parseInt((await client.query('SELECT COUNT(*) FROM bookings')).rows[0].count, 10);
    if (existingCount === 0 || bookingsCount === 0) {
      console.log('Seeding bookings, travelers, payments, guide assignments, inquiries, reviews, and notifications...');
      for (const b of seed.sampleBookings) {
        const mappedGuideId = b.assigned_guide_id ? (guideIdMap[b.assigned_guide_id] || kinleyId) : null;
        await client.query(`
          INSERT INTO bookings (
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
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24,
            $25, $26, $27, $28, $29,
            $30, $31, $32,
            $33, $34, $35, $36, $37,
            $38, $39, $40, $41,
            $42, $43, $44
          ) ON CONFLICT (id) DO NOTHING
        `, [
          b.id, b.tour_id, b.tour_title, b.is_custom_trip ? 1 : 0,
          b.lead_name, b.lead_email, b.lead_phone, b.lead_country, b.lead_passport_no, b.lead_passport_expiry || null,
          b.travel_date_start, b.travel_date_end, b.total_nights, b.total_travelers,
          b.adults_count, b.children_6_12, b.children_under_6, b.hotel_tier,
          b.base_price_usd, b.sdf_total_usd, b.visa_fee_usd, b.extras_usd, b.discount_usd || 0, b.total_price_usd,
          b.currency || 'USD', b.nationality_type || 'international', b.exchange_rate || 1,
          b.payment_plan || 'deposit_30', b.balance_due_date || null,
          b.deposit_paid_usd, b.full_paid ? 1 : 0, b.flight_assistance ? 1 : 0,
          b.booking_status, b.visa_status, b.visa_clearance_number || null,
          b.visa_submitted_date || null, b.visa_approved_date || null,
          b.sdf_remitted_at || null, b.sdf_remittance_ref || null,
          mappedGuideId, b.assigned_vehicle || null,
          b.special_requests || null, b.internal_notes || null, b.source
        ]);
      }
    }

    const travelersCount = parseInt((await client.query('SELECT COUNT(*) FROM travelers')).rows[0].count, 10);
    if (travelersCount === 0) {
      const existingBookings = new Set((await client.query('SELECT id FROM bookings')).rows.map(r => r.id));
      for (const tr of seed.sampleTravelers) {
        if (existingBookings.has(tr.booking_id)) {
          await client.query(`
            INSERT INTO travelers (
              booking_id, full_name, passport_number, passport_expiry, nationality, date_of_birth,
              age_category, gender, dietary_needs, medical_notes,
              emergency_contact_name, emergency_contact_phone, document_notes, sdf_rate_usd, visa_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            tr.booking_id, tr.full_name, tr.passport_number, tr.passport_expiry, tr.nationality, tr.date_of_birth,
            tr.age_category, tr.gender, tr.dietary_needs, tr.medical_notes,
            tr.emergency_contact_name, tr.emergency_contact_phone, tr.document_notes, tr.sdf_rate_usd, tr.visa_status
          ]);
        }
      }
    }

    const paymentsCount = parseInt((await client.query('SELECT COUNT(*) FROM payments')).rows[0].count, 10);
    if (paymentsCount === 0) {
      const existingBookings = new Set((await client.query('SELECT id FROM bookings')).rows.map(r => r.id));
      for (const p of seed.samplePayments) {
        if (existingBookings.has(p.booking_id)) {
          await client.query(`
            INSERT INTO payments (
              booking_id, amount_usd, currency, amount_local, payment_type, payment_method,
              transaction_ref, status, verified_by, verified_at, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            p.booking_id, p.amount_usd, p.currency || 'USD', p.amount_local ?? p.amount_usd,
            p.payment_type, p.payment_method, p.transaction_ref, p.status,
            p.verified_by ? financeId : null, p.verified_at || null, p.notes || null
          ]);
        }
      }
    }

    const gaCount = parseInt((await client.query('SELECT COUNT(*) FROM guide_assignments')).rows[0].count, 10);
    if (gaCount === 0) {
      const existingBookings = new Set((await client.query('SELECT id FROM bookings')).rows.map(r => r.id));
      for (const ga of seed.sampleGuideAssignments) {
        if (existingBookings.has(ga.booking_id)) {
          await client.query(`
            INSERT INTO guide_assignments (
              guide_id, booking_id, start_date, end_date, vehicle_plate, driver_name, daily_rate_usd, status, guide_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            guideIdMap[ga.guide_id] || kinleyId, ga.booking_id, ga.start_date, ga.end_date,
            ga.vehicle_plate, ga.driver_name, ga.daily_rate_usd, ga.status, ga.guide_notes
          ]);
        }
      }
    }

    const inqCount = parseInt((await client.query('SELECT COUNT(*) FROM inquiries')).rows[0].count, 10);
    if (inqCount === 0) {
      for (const i of seed.sampleInquiries) {
        await client.query(`
          INSERT INTO inquiries (ref_code, name, email, phone, country, preferred_dates, duration_days, travelers_count, budget_range, interests, message, source, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (ref_code) DO NOTHING
        `, [
          i.ref_code, i.name, i.email, i.phone, i.country, i.preferred_dates,
          i.duration_days, i.travelers_count, i.budget_range, i.interests,
          i.message, i.source || 'website', i.status || 'new'
        ]);
      }
    }

    const revCount = parseInt((await client.query('SELECT COUNT(*) FROM reviews')).rows[0].count, 10);
    if (revCount === 0) {
      for (const r of seed.sampleReviews) {
        await client.query(`
          INSERT INTO reviews (author_name, author_country, tour_taken, travel_date, rating, title, comment, is_verified, is_featured)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [r.author_name, r.author_country, r.tour_taken, r.travel_date, r.rating, r.title, r.comment, r.is_verified ? 1 : 0, r.is_featured ? 1 : 0]);
      }
    }

    const notifCount = parseInt((await client.query('SELECT COUNT(*) FROM notifications')).rows[0].count, 10);
    if (notifCount === 0) {
      for (const n of seed.sampleNotifications) {
        await client.query(`
          INSERT INTO notifications (recipient_type, recipient_id, channel, category, title, message, action_url, whatsapp_url, metadata_json, is_read, is_sent, sent_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        `, [
          n.recipient_type, n.recipient_id, n.channel, n.category,
          n.title, n.message, n.action_url, n.whatsapp_url || null,
          n.metadata_json || null, n.is_read ? 1 : 0, n.is_sent ? 1 : 0
        ]);
      }
    }

    const auditCount = parseInt((await client.query('SELECT COUNT(*) FROM audit_log')).rows[0].count, 10);
    if (auditCount === 0) {
      for (const a of seed.sampleAuditLogs) {
        await client.query(`
          INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, old_value, new_value)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [a.user_id, a.user_name, a.user_role, a.action, a.entity_type, a.entity_id, a.old_value || null, a.new_value || null]);
      }
    }

    await client.query('COMMIT');
    console.log('✓ PostgreSQL schema & parity seed verified successfully.');
    console.log('\n[SUCCESS] PostgreSQL is fully provisioned and ready for production traffic!');
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[ERROR] PostgreSQL connection/provisioning error:', err.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

async function main() {
  console.log('====================================================');
  console.log('🇧🇹 BHUTAN FAST RATE TOURS — DATABASE SETUP');
  console.log('====================================================');
  if (!pgUrl) {
    await verifySqliteHealth();
  } else {
    await setupPostgres();
  }
}

main().catch((err) => {
  console.error('[FATAL] Setup failed:', err);
  process.exit(1);
});
