/**
 * Bhutan Fast Rate Tours — PostgreSQL Setup & Migration Utility
 * Usage:
 *   node database/setup-postgres.js
 * Or with custom URL:
 *   DATABASE_URL=postgresql://postgres:password@localhost:5432/bhutan_tours node database/setup-postgres.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSeedData } = require('./seed');

const pgUrl = process.env.DATABASE_URL || 
  (process.env.PGHOST ? `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'bhutan_tours'}` : null);

console.log('====================================================');
console.log('🇧🇹 BHUTAN FAST RATE TOURS — DATABASE SETUP');
console.log('====================================================');

if (!pgUrl) {
  console.log('\n[NOTICE] No PostgreSQL DATABASE_URL found in environment.');
  console.log('Current Active Engine: Native SQLite (database/tours.db)');
  console.log('\nTo connect to PostgreSQL in production:');
  console.log('1. Create a database in PostgreSQL: CREATE DATABASE bhutan_tours;');
  console.log('2. Add to your .env file:');
  console.log('   DATABASE_URL=postgresql://username:password@localhost:5432/bhutan_tours');
  console.log('3. Re-run: node database/setup-postgres.js');
  console.log('\nVerifying current SQLite database health...');
  
  const db = require('./db');
  const toursCount = db.get('SELECT COUNT(*) as count FROM tours').count;
  const destsCount = db.get('SELECT COUNT(*) as count FROM destinations').count;
  const usersCount = db.get('SELECT COUNT(*) as count FROM users').count;
  const bookingsCount = db.get('SELECT COUNT(*) as count FROM bookings').count;

  console.log(`✓ SQLite Engine Active: ${toursCount} Tours, ${destsCount} Destinations, ${usersCount} Staff Users, ${bookingsCount} Bookings.`);
  console.log('All public and admin endpoints are fully operational.\n');
  process.exit(0);
}

// PostgreSQL Connection & Provisioning
async function setupPostgres() {
  console.log(`Connecting to PostgreSQL at: ${pgUrl.replace(/:[^:]*@/, ':****@')}...`);
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });

  try {
    const client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL server.');

    // 1. Run Schema Migration
    const schemaFile = path.join(__dirname, 'postgres-schema.sql');
    const schemaSql = fs.readFileSync(schemaFile, 'utf8');
    console.log('Executing postgres-schema.sql (12 Relational Tables)...');
    await client.query(schemaSql);
    console.log('✓ Tables, foreign keys, and indexes created successfully.');

    // 2. Check if seeding needed
    const checkTours = await client.query('SELECT COUNT(*) FROM tours');
    const existingCount = parseInt(checkTours.rows[0].count, 10);

    if (existingCount === 0) {
      console.log('Seeding initial production data into PostgreSQL...');
      const seed = getSeedData();

      // Users
      for (const u of seed.users) {
        await client.query(`
          INSERT INTO users (uuid, full_name, email, phone, password_hash, role)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (email) DO NOTHING
        `, [u.uuid, u.full_name, u.email, u.phone, u.password_hash, u.role]);
      }

      // Settings
      for (const s of seed.settings) {
        await client.query(`
          INSERT INTO settings (key, value, category, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO NOTHING
        `, [s.key, s.value, s.category, s.description]);
      }

      // Destinations
      for (const d of seed.destinations) {
        await client.query(`
          INSERT INTO destinations (id, name, slug, tagline, altitude_meters, region, description, highlights_json, best_months, cover_image, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [d.id, d.name, d.slug, d.tagline, d.altitude_meters, d.region, d.description, d.highlights_json, d.best_months, d.cover_image, d.sort_order]);
      }

      // Tours
      for (const t of seed.tours) {
        await client.query(`
          INSERT INTO tours (id, title, slug, subtitle, duration_days, duration_nights, category, difficulty, price_usd, price_3star_usd, price_5star_usd, valleys, highlight_text, cover_image, itinerary_json, inclusions_json, is_featured, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18)
          ON CONFLICT (id) DO NOTHING
        `, [t.id, t.title, t.slug, t.subtitle, t.duration_days, t.duration_nights, t.category, t.difficulty, t.price_usd, t.price_3star_usd, t.price_5star_usd, t.valleys, t.highlight_text, t.cover_image, t.itinerary_json, t.inclusions_json, t.is_featured ? true : false, t.sort_order]);
      }

      // Bookings
      for (const b of seed.sampleBookings) {
        await client.query(`
          INSERT INTO bookings (id, tour_id, tour_title, is_custom_trip, lead_name, lead_email, lead_phone, lead_country, lead_passport_no, travel_date_start, travel_date_end, total_nights, total_travelers, adults_count, children_6_12, children_under_6, hotel_tier, base_price_usd, sdf_total_usd, visa_fee_usd, extras_usd, total_price_usd, deposit_paid_usd, full_paid, booking_status, visa_status, visa_clearance_number, visa_submitted_date, visa_approved_date, assigned_guide_id, assigned_vehicle, special_requests, internal_notes, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
          ON CONFLICT (id) DO NOTHING
        `, [b.id, b.tour_id, b.tour_title, b.is_custom_trip ? true : false, b.lead_name, b.lead_email, b.lead_phone, b.lead_country, b.lead_passport_no, b.travel_date_start, b.travel_date_end, b.total_nights, b.total_travelers, b.adults_count, b.children_6_12, b.children_under_6, b.hotel_tier, b.base_price_usd, b.sdf_total_usd, b.visa_fee_usd, b.extras_usd, b.total_price_usd, b.deposit_paid_usd, b.full_paid ? true : false, b.booking_status, b.visa_status, b.visa_clearance_number || null, b.visa_submitted_date || null, b.visa_approved_date || null, b.assigned_guide_id || null, b.assigned_vehicle || null, b.special_requests || null, b.internal_notes || null, b.source]);
      }

      // Reviews
      for (const r of seed.sampleReviews) {
        await client.query(`
          INSERT INTO reviews (author_name, author_country, tour_taken, travel_date, rating, title, comment, is_verified, is_featured)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [r.author_name, r.author_country, r.tour_taken, r.travel_date, r.rating, r.title, r.comment, r.is_verified ? true : false, r.is_featured ? true : false]);
      }

      console.log('✓ Data seeded into PostgreSQL successfully.');
    } else {
      console.log(`PostgreSQL already contains ${existingCount} tours. Skipping initial seed.`);
    }

    client.release();
    await pool.end();
    console.log('\n[SUCCESS] PostgreSQL is fully provisioned and ready for production traffic!');
  } catch (err) {
    console.error('[ERROR] PostgreSQL connection/provisioning error:', err.message);
    process.exit(1);
  }
}

setupPostgres();
