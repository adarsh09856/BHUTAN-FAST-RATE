const http = require('http');
const express = require('express');
const cors = require('cors');

// Setup in-process Express app to test live REST routes
const app = express();
app.use(cors());
app.use(express.json());

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/bookings');
const guideRoutes = require('./routes/guide');
const clientRoutes = require('./routes/client');
const db = require('./database/db');

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/client', clientRoutes);

const server = app.listen(3099, async () => {
  console.log('Test Server running on port 3099');
  try {
    await runTests();
    server.close();
    console.log('\n======================================================');
    console.log('🎉 ALL END-TO-END CRUD INTEGRATION TESTS PASSED (100%)');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    server.close();
    process.exit(1);
  }
});

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3099,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n--- 1. Testing Staff Admin Authentication ---');
  const loginRes = await request('POST', '/api/admin/auth/login', {
    email: 'admin@bhutanfastratetours.bt',
    password: 'admin123'
  });
  console.log('Login Status:', loginRes.status, 'User:', loginRes.body.user.name);
  if (loginRes.status !== 200 || !loginRes.body.token) throw new Error('Admin login failed');

  console.log('\n--- 2. Testing Admin Tour Package Creation (POST /api/admin/tours) ---');
  const testTourId = 'jomolhari-basecamp-trek';
  // Cleanup test records from earlier runs
  db.run("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id LIKE '%jomolhari%' OR lead_name LIKE '%Vance%')");
  db.run("DELETE FROM travelers WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id LIKE '%jomolhari%' OR lead_name LIKE '%Vance%')");
  db.run("DELETE FROM guide_assignments WHERE booking_id IN (SELECT id FROM bookings WHERE tour_id LIKE '%jomolhari%' OR lead_name LIKE '%Vance%')");
  db.run("DELETE FROM bookings WHERE tour_id LIKE '%jomolhari%' OR lead_name LIKE '%Vance%'");
  db.run("DELETE FROM tours WHERE id LIKE '%jomolhari%' OR slug LIKE '%jomolhari%'");

  const createTourRes = await request('POST', '/api/admin/tours', {
    slug: 'tour-jomolhari-basecamp-trek.html',
    title: 'Jomolhari Mountain Sacred Base Camp Trek',
    subtitle: '9 Days High Himalayan Glacier Journey',
    category: 'Alpine Trekking',
    difficulty: 'Moderate to Strenuous',
    duration_days: 9,
    duration_nights: 8,
    price_usd: 2800,
    valleys: 'Paro, Jangothang, Soi Yaktsa',
    cover_image: 'assets/images/dochula-pass.webp',
    highlight_text: 'Spectacular views of Mount Jomolhari (7,326m) and glacial lakes.',
    inclusions: ['Licensed Trekking Guide', 'Full Cook & Pack Horse Team', 'SDF Included', 'Dome Tents'],
    is_active: 1,
    is_featured: 1,
    user_name: 'Sonam Dorji (Admin)'
  });
  console.log('Create Tour Status:', createTourRes.status, 'Message:', createTourRes.body.message, 'Created ID:', createTourRes.body.tour.id);
  if (createTourRes.status !== 201) throw new Error('Failed to create tour: ' + JSON.stringify(createTourRes.body));

  const actualTourId = createTourRes.body.tour.id;

  console.log('\n--- 3. Verifying Newly Created Tour in Public Catalog (GET /api/tours) ---');
  const publicToursRes = await request('GET', '/api/tours');
  const foundInPublic = publicToursRes.body.data.find(t => t.id === actualTourId);
  console.log('Tour Found in Public API:', foundInPublic ? `YES (${foundInPublic.title}, $${foundInPublic.price_usd})` : 'NO');
  if (!foundInPublic) throw new Error('Newly created tour is not visible on public catalog');

  console.log('\n--- 4. Testing Admin Tour Price & Content Update (PUT /api/admin/tours/:id) ---');
  const updateTourRes = await request('PUT', `/api/admin/tours/${actualTourId}`, {
    price_usd: 2650,
    title: 'Jomolhari Mountain Sacred Base Camp Trek (Special Edition)',
    user_name: 'Sonam Dorji (Admin)'
  });
  console.log('Update Tour Status:', updateTourRes.status, 'Message:', updateTourRes.body.message);
  if (updateTourRes.status !== 200) throw new Error('Failed to update tour');

  const checkUpdated = await request('GET', `/api/tours/${actualTourId}`);
  console.log('Verified Updated Public Price:', `$${checkUpdated.body.data.price_usd} (Title: ${checkUpdated.body.data.title})`);
  if (checkUpdated.body.data.price_usd !== 2650) throw new Error('Price was not updated in DB');

  console.log('\n--- 5. Testing Tour Active/Inactive Status Toggle (PATCH /api/admin/tours/:id/toggle) ---');
  const toggleInactive = await request('PATCH', `/api/admin/tours/${actualTourId}/toggle`, { user_name: 'Admin' });
  console.log('Toggle Inactive:', toggleInactive.body.message, 'Active state:', toggleInactive.body.is_active);
  if (toggleInactive.body.is_active !== 0) throw new Error('Tour failed to toggle inactive');

  // Verify hidden from public catalog
  const publicCatalogWhileInactive = await request('GET', '/api/tours');
  const hiddenMatch = publicCatalogWhileInactive.body.data.find(t => t.id === actualTourId);
  console.log('Is hidden tour in public catalog?', hiddenMatch ? 'ERROR: Found' : 'SUCCESS: Hidden from public');
  if (hiddenMatch) throw new Error('Inactive tour should not be returned in public catalog');

  // Reactivate tour
  const toggleActive = await request('PATCH', `/api/admin/tours/${actualTourId}/toggle`, { user_name: 'Admin' });
  console.log('Toggle Back Active:', toggleActive.body.message);

  console.log('\n--- 6. Testing Official Government SDF Fee Engine ---');
  const sdfRes = await request('POST', '/api/calculate-sdf', {
    nationality_type: 'international',
    nights: 8,
    adults: 2,
    children_6_12: 1,
    children_under_6: 0
  });
  console.log('SDF Total:', `$${sdfRes.body.data.total_sdf}`, 'Visa Fee:', `$${sdfRes.body.data.total_visa_fee}`);
  if (sdfRes.body.data.total_sdf !== 2000) throw new Error('SDF math error: expected 2000, got ' + sdfRes.body.data.total_sdf);

  console.log('\n--- 7. Testing Traveler Booking Submission (POST /api/bookings) ---');
  const testBookingRef = `BFR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const bookingRes = await request('POST', '/api/bookings', {
    booking_id: testBookingRef,
    tour_id: testTourId,
    tour_title: 'Jomolhari Mountain Sacred Base Camp Trek',
    lead_name: 'Lady Eleanor Vance',
    lead_email: 'eleanor.vance@oxford.ac.uk',
    lead_phone: '+44 7911 123456',
    lead_country: 'United Kingdom',
    lead_passport_no: 'UK-9948271',
    travel_date_start: '2026-10-10',
    travel_date_end: '2026-10-18',
    total_nights: 8,
    total_travelers: 2,
    hotel_tier: '3-Star Standard Heritage',
    base_price_usd: 5300,
    sdf_total_usd: 1600,
    visa_fee_usd: 80,
    total_price_usd: 6980,
    deposit_paid_usd: 6980
  });
  console.log('Booking Creation Status:', bookingRes.status, 'Ref:', bookingRes.body.booking.id);
  if (bookingRes.status !== 201) throw new Error('Failed to create booking');
  const actualBookingRef = bookingRes.body.booking.id;

  console.log('\n--- 8. Verifying Booking in Admin Pipeline & Visa Desk ---');
  const adminBookingsRes = await request('GET', `/api/admin/bookings?search=${actualBookingRef}`);
  if (!adminBookingsRes.body.data.length) throw new Error('Booking not found in admin pipeline');
  console.log('Booking Found in Admin Pipeline: YES, Status:', adminBookingsRes.body.data[0].booking_status);

  console.log('\n--- 9. Testing Admin Approving Visa & Issuing Clearance Letter ---');
  const approveVisaRes = await request('PATCH', `/api/admin/bookings/${actualBookingRef}/visa`, {
    visa_status: 'approved',
    user_name: 'Dechen Wangmo (Visa Officer)'
  });
  console.log('Approve Visa Status:', approveVisaRes.status, 'Clearance No:', approveVisaRes.body.visa_clearance_number);
  if (approveVisaRes.status !== 200 || !approveVisaRes.body.visa_clearance_number) throw new Error('Visa approval failed');

  console.log('\n--- 10. Testing Client Tracker Real-Time Synchronization ---');
  const trackRes = await request('GET', `/api/bookings/track/${actualBookingRef}`);
  console.log('Client Track Visa Status:', trackRes.body.booking.visa_status, 'Clearance:', trackRes.body.booking.visa_clearance_number);
  if (trackRes.body.booking.visa_status !== 'approved') throw new Error('Client tracker does not show approved status');
  if (trackRes.body.booking.visa_clearance_number !== approveVisaRes.body.visa_clearance_number) throw new Error('Clearance number mismatch');

  console.log('\n--- 11. Testing Guide Assignment ---');
  const assignGuideRes = await request('PATCH', `/api/admin/bookings/${actualBookingRef}/assign-guide`, {
    guide_id: 3,
    vehicle_plate: 'Toyota Land Cruiser (BP-1-A9000)',
    user_name: 'Operations Manager'
  });
  console.log('Assign Guide Status:', assignGuideRes.status, 'Message:', assignGuideRes.body.message);
  if (assignGuideRes.status !== 200) throw new Error('Guide assignment failed');

  console.log('\n--- 12. Verifying Immutable Audit Trail ---');
  const auditRes = await request('GET', '/api/admin/audit-log');
  const tourAudit = auditRes.body.data.find(a => a.entity_id === actualTourId);
  const bookingAudit = auditRes.body.data.find(a => a.entity_id === actualBookingRef);
  console.log('Tour Audit Recorded:', tourAudit ? `YES (${tourAudit.action} by ${tourAudit.user_name})` : 'NO');
  console.log('Booking Audit Recorded:', bookingAudit ? `YES (${bookingAudit.action} by ${bookingAudit.user_name})` : 'NO');
  if (!tourAudit || !bookingAudit) throw new Error('Audit trail missing critical operational events');

  console.log('\n--- 13. Cleaning up Test Artifacts from Database ---');
  db.run("DELETE FROM travelers WHERE booking_id = ?", [actualBookingRef]);
  db.run("DELETE FROM guide_assignments WHERE booking_id = ?", [actualBookingRef]);
  db.run("DELETE FROM payments WHERE booking_id = ?", [actualBookingRef]);
  db.run("DELETE FROM bookings WHERE id = ?", [actualBookingRef]);
  db.run("DELETE FROM tours WHERE id = ?", [actualTourId]);
  db.run("DELETE FROM audit_log WHERE entity_id IN (?, ?)", [actualTourId, actualBookingRef]);
  console.log('Cleanup complete. Database state is clean.');
}
