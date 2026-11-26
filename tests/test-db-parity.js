const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function runTests() {
  const db = require('../database/db');

  try {
    console.log('1. Checking async DB interface & engine...');
    assert.strictEqual(typeof db.query, 'function', 'db.query must be a function');
    assert.strictEqual(typeof db.get, 'function', 'db.get must be a function');
    assert.strictEqual(typeof db.run, 'function', 'db.run must be a function');
    assert.strictEqual(typeof db.transaction, 'function', 'db.transaction must be a function');
    assert.strictEqual(typeof db.getEngine, 'function', 'db.getEngine must be a function');
    assert.strictEqual(typeof db.closeDb, 'function', 'db.closeDb must be a function');
    assert.strictEqual(db.getEngine(), 'sqlite', 'Default engine without DATABASE_URL must be sqlite');

    const pFestivals = db.query('SELECT id, name, slug, related_tour_id FROM festivals WHERE is_active = ?', [1]);
    assert.ok(pFestivals && typeof pFestivals.then === 'function', 'db.query() must return a Promise');
    const festivals = await pFestivals;
    assert.ok(Array.isArray(festivals) && festivals.length >= 4, `Expected >= 4 active festivals, got ${festivals && festivals.length}`);
    const festivalNames = festivals.map(f => f.name);
    for (const expected of ['Thimphu Tshechu', 'Paro Tshechu', 'Punakha Drubchen', 'Jambay Lhakhang Drup']) {
      assert.ok(festivalNames.includes(expected), `Missing seeded festival: ${expected}`);
    }
    for (const f of festivals) {
      assert.ok(f.slug && f.slug.startsWith('festival-') && f.slug.endsWith('.html'), `Invalid festival slug: ${f.slug}`);
      assert.ok(f.related_tour_id, `Festival ${f.name} must link related_tour_id`);
    }

    const pGaCount = db.get('SELECT COUNT(*) as count FROM guide_assignments');
    assert.ok(pGaCount && typeof pGaCount.then === 'function', 'db.get() must return a Promise');
    const gaCount = await pGaCount;
    assert.ok(gaCount && Number(gaCount.count) >= 3, `Expected >= 3 guide_assignments, got ${gaCount && gaCount.count}`);

    const guides = await db.query('SELECT id, email, license_no, languages, specialty FROM users WHERE role = ?', ['guide']);
    assert.ok(guides.length >= 2, `Expected >= 2 seeded guides, got ${guides.length}`);
    const guideEmails = guides.map(g => g.email);
    assert.ok(guideEmails.includes('kinley@bhutanfastratetours.bt'), 'Missing guide kinley@bhutanfastratetours.bt');
    assert.ok(guideEmails.includes('dorji@bhutanfastratetours.bt'), 'Missing guide dorji@bhutanfastratetours.bt');
    for (const g of guides) {
      assert.ok(g.license_no && g.languages && g.specialty, `Guide ${g.email} missing license_no/languages/specialty`);
    }

    console.log('2. Checking canonical settings & table counts...');
    const fxSetting = await db.get("SELECT value FROM settings WHERE key = 'usd_to_inr_rate'");
    assert.strictEqual(fxSetting && fxSetting.value, '85', 'usd_to_inr_rate must be seeded as 85');

    const expectedSettings = [
      'company_name', 'company_license', 'company_email', 'company_phone', 'company_whatsapp', 'company_address',
      'sdf_rate_international', 'sdf_rate_india', 'sdf_child_6_12_discount', 'sdf_child_under_6_exempt',
      'sdf_waiver_active', 'sdf_waiver_percent', 'visa_fee_usd', 'deposit_percent', 'min_advance_booking_days',
      'cancellation_free_days', 'cancellation_partial_days', 'cancellation_partial_refund_percent',
      'usd_to_inr_rate', 'child_6_12_package_discount_pct', 'child_under_6_package_discount_pct',
      'custom_daily_rate_3star_usd', 'custom_daily_rate_4star_usd', 'custom_daily_rate_5star_usd',
      'final_payment_due_days', 'require_insurance_for_visa',
      'bank_beneficiary', 'bank_name', 'bank_swift', 'bank_account', 'bank_instructions',
      'whatsapp_provider', 'whatsapp_api_url', 'whatsapp_api_token', 'whatsapp_from', 'whatsapp_template_name',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'
    ];
    const allSettingsRows = await db.query('SELECT key FROM settings');
    const settingsKeys = new Set(allSettingsRows.map(r => r.key));
    for (const k of expectedSettings) {
      assert.ok(settingsKeys.has(k), `Missing canonical setting key: ${k}`);
    }

    const counts = {
      tours: Number((await db.get('SELECT COUNT(*) as count FROM tours')).count),
      destinations: Number((await db.get('SELECT COUNT(*) as count FROM destinations')).count),
      festivals: Number((await db.get('SELECT COUNT(*) as count FROM festivals')).count),
      bookings: Number((await db.get('SELECT COUNT(*) as count FROM bookings')).count),
      guide_assignments: Number((await db.get('SELECT COUNT(*) as count FROM guide_assignments')).count),
      users: Number((await db.get('SELECT COUNT(*) as count FROM users')).count),
      travelers: Number((await db.get('SELECT COUNT(*) as count FROM travelers')).count),
      payments: Number((await db.get('SELECT COUNT(*) as count FROM payments')).count),
      inquiries: Number((await db.get('SELECT COUNT(*) as count FROM inquiries')).count),
      reviews: Number((await db.get('SELECT COUNT(*) as count FROM reviews')).count),
      notifications: Number((await db.get('SELECT COUNT(*) as count FROM notifications')).count)
    };
    assert.ok(counts.tours >= 10, `Expected >= 10 tours, got ${counts.tours}`);
    assert.ok(counts.destinations >= 6, `Expected >= 6 destinations, got ${counts.destinations}`);
    assert.ok(counts.festivals >= 4, `Expected >= 4 festivals, got ${counts.festivals}`);
    assert.ok(counts.bookings >= 3, `Expected >= 3 bookings, got ${counts.bookings}`);
    assert.ok(counts.guide_assignments >= 3, `Expected >= 3 guide_assignments, got ${counts.guide_assignments}`);
    assert.ok(counts.users >= 5, `Expected >= 5 users, got ${counts.users}`);
    assert.ok(counts.travelers >= 3, `Expected >= 3 travelers, got ${counts.travelers}`);
    assert.ok(counts.payments >= 3, `Expected >= 3 payments, got ${counts.payments}`);
    assert.ok(counts.inquiries >= 2, `Expected >= 2 inquiries, got ${counts.inquiries}`);
    assert.ok(counts.reviews >= 3, `Expected >= 3 reviews, got ${counts.reviews}`);
    assert.ok(counts.notifications >= 3, `Expected >= 3 notifications, got ${counts.notifications}`);

    console.log('3. Checking expanded columns & scrypt password hashes...');
    const bookingRow = await db.get(
      'SELECT payment_plan, nationality_type, sdf_remitted_at, discount_usd, flight_assistance, exchange_rate, balance_due_date, sdf_remittance_ref, visa_rejection_reason, cancellation_reason, custom_itinerary_json, created_by_staff_id FROM bookings LIMIT 1'
    );
    assert.ok(bookingRow && 'payment_plan' in bookingRow && 'nationality_type' in bookingRow && 'sdf_remitted_at' in bookingRow);

    const paymentRow = await db.get('SELECT currency, amount_local FROM payments LIMIT 1');
    assert.ok(paymentRow && paymentRow.currency && paymentRow.amount_local > 0);

    const tourRow = await db.get('SELECT price_3star_usd, price_4star_usd, price_5star_usd FROM tours LIMIT 1');
    assert.ok(tourRow && tourRow.price_4star_usd > 0, 'tours must include populated price_4star_usd');
    const null4Star = await db.get('SELECT COUNT(*) as count FROM tours WHERE price_4star_usd IS NULL');
    assert.strictEqual(Number(null4Star.count), 0, 'All 10 tours must have price_4star_usd populated');

    const travelerCols = await db.get('SELECT emergency_contact_name, emergency_contact_phone, document_notes FROM travelers LIMIT 1');
    assert.ok(travelerCols && 'emergency_contact_name' in travelerCols);

    const notifCols = await db.get('SELECT whatsapp_url, metadata_json, error_message FROM notifications LIMIT 1');
    assert.ok(notifCols && 'whatsapp_url' in notifCols);

    const checkins = await db.query('SELECT id, assignment_id, booking_id, guide_id, location, weather, guest_status, notes FROM guide_checkins');
    assert.ok(Array.isArray(checkins), 'guide_checkins table must exist and be queryable');

    const allUsers = await db.query('SELECT email, role, password_hash FROM users');
    const expectedPasswords = {
      'admin@bhutanfastratetours.bt': 'admin123',
      'dechen@bhutanfastratetours.bt': 'concierge123',
      'finance@bhutanfastratetours.bt': 'finance123',
      'kinley@bhutanfastratetours.bt': 'guide123',
      'dorji@bhutanfastratetours.bt': 'guide123'
    };
    for (const u of allUsers) {
      assert.ok(u.password_hash.startsWith('scrypt$'), `User ${u.email} password must use scrypt$ format`);
      const parts = u.password_hash.split('$');
      assert.strictEqual(parts.length, 3, `Invalid scrypt hash format for ${u.email}`);
      assert.strictEqual(parts[1].length, 32, 'Salt must be 16 bytes hex (32 chars)');
      assert.strictEqual(parts[2].length, 128, 'Hash must be 64 bytes hex (128 chars)');
      if (expectedPasswords[u.email]) {
        const derived = crypto.scryptSync(expectedPasswords[u.email], parts[1], 64).toString('hex');
        assert.ok(crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(parts[2], 'hex')), `Password verify failed for ${u.email}`);
      }
    }

    console.log('4. Checking transaction commit & rollback...');
    const markerRollback = `TEST_TX_ROLLBACK_${Date.now()}`;
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await tx.run(
          'INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
          ['Test', 'admin', markerRollback, 'test', '1']
        );
        throw new Error('Intentional rollback');
      });
    } catch (e) {
      threw = true;
    }
    assert.ok(threw, 'Transaction should propagate error on failure');
    const rolledBackRow = await db.get('SELECT id FROM audit_log WHERE action = ?', [markerRollback]);
    assert.strictEqual(rolledBackRow, undefined, 'Rolled-back row must not exist');

    const markerCommit = `TEST_TX_COMMIT_${Date.now()}`;
    const insertRes = await db.transaction(async (tx) => {
      return await tx.run(
        'INSERT INTO audit_log (user_name, user_role, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
        ['Test', 'admin', markerCommit, 'test', '2']
      );
    });
    assert.strictEqual(insertRes.changes, 1);
    assert.ok(insertRes.lastInsertRowid !== null && insertRes.lastInsertRowid !== undefined, 'lastInsertRowid must be returned');
    const committedRow = await db.get('SELECT id FROM audit_log WHERE action = ?', [markerCommit]);
    assert.ok(committedRow, 'Committed row must exist');
    await db.run('DELETE FROM audit_log WHERE id = ?', [committedRow.id]);

    console.log('5. Checking quote-safe PG SQL translator & RETURNING id...');
    assert.strictEqual(typeof db.toPostgresSql, 'function', 'db.toPostgresSql must be exported');
    assert.strictEqual(typeof db.preparePostgresRunSql, 'function', 'db.preparePostgresRunSql must be exported');

    const rawSql = "SELECT * FROM tours WHERE title LIKE ? AND note = 'What? Is it ''ok?'' yes' -- comment ?\nAND /* block ? */ body = E'It\\'s ?' AND tag = $$dollar ?$$ AND is_active = ?";
    const translated = db.toPostgresSql(rawSql);
    assert.strictEqual(
      translated,
      "SELECT * FROM tours WHERE title LIKE $1 AND note = 'What? Is it ''ok?'' yes' -- comment ?\nAND /* block ? */ body = E'It\\'s ?' AND tag = $$dollar ?$$ AND is_active = $2",
      'toPostgresSql must ignore ? inside string literals, E-strings, dollar-quotes, and comments'
    );

    const insBooking = db.preparePostgresRunSql('INSERT INTO bookings (id, tour_title) VALUES ($1, $2);');
    assert.ok(/RETURNING\s+id\s*$/i.test(insBooking), `Expected RETURNING id on bookings insert, got: ${insBooking}`);

    const insConflict = db.preparePostgresRunSql('INSERT INTO bookings (id, tour_title) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING;');
    assert.ok(/ON CONFLICT \(id\) DO NOTHING RETURNING id$/i.test(insConflict), `Expected RETURNING id after ON CONFLICT, got: ${insConflict}`);

    const insSettings = db.preparePostgresRunSql('INSERT INTO settings (key, value) VALUES ($1, $2)');
    assert.ok(!/RETURNING\s+id/i.test(insSettings), `Must NOT append RETURNING id on settings insert, got: ${insSettings}`);

    const updBooking = db.preparePostgresRunSql('UPDATE bookings SET booking_status = $1 WHERE id = $2');
    assert.ok(!/RETURNING/i.test(updBooking), `Must NOT append RETURNING on UPDATE, got: ${updBooking}`);

    const insExistingRet = db.preparePostgresRunSql('INSERT INTO users (email) VALUES ($1) RETURNING id');
    assert.strictEqual((insExistingRet.match(/RETURNING/gi) || []).length, 1, 'Must not double-append RETURNING');

    console.log('6. Checking PostgreSQL schema parity...');
    const pgSchema = fs.readFileSync(path.join(__dirname, '../database/postgres-schema.sql'), 'utf8');
    assert.ok(!/\bBOOLEAN\b/i.test(pgSchema), 'postgres-schema.sql must use SMALLINT instead of BOOLEAN for 0/1 parity');
    for (const token of ['festivals', 'guide_checkins', 'price_4star_usd', 'license_no', 'payment_plan', 'nationality_type', 'sdf_remitted_at', 'amount_local', 'emergency_contact_name', 'whatsapp_url']) {
      assert.ok(pgSchema.includes(token), `postgres-schema.sql missing ${token}`);
    }

    console.log('✅ ALL DB PARITY TESTS PASSED:', counts);
  } finally {
    if (typeof db.closeDb === 'function') {
      await db.closeDb();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ DB PARITY TEST FAILED:', err);
  process.exit(1);
});
