require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express');
const adminRoutes = require('./routes/admin');
const trackingRoutes = require('./routes/tracking');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/api/tracking', trackingRoutes);

let server;

async function runTests() {
  console.log('=== RUNNING VISITOR OBSERVABILITY & PAGINATION TESTS ===');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      resolve();
    });
  });

  // Ensure DB migration has initialized before firing requests
  await db.query('SELECT 1');
  await new Promise(r => setTimeout(r, 1500));

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/admin`;
  const trackingUrl = `http://localhost:${port}/api/tracking`;

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    const adminToken = jwt.sign({ id: 1, email: 'nitishkapoor152005@gmail.com' }, JWT_SECRET, { expiresIn: '1h' });
    const normalUserToken = jwt.sign({ id: 3, email: 'sme22921@gmail.com' }, JWT_SECRET, { expiresIn: '1h' });

    // 1. Heartbeat test: simulate a visit and stream watch
    const testSession = 'test_session_' + Date.now();
    const testVisitor = 'test_visitor_' + Date.now();
    const hbRes = await fetch(`${trackingUrl}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSession,
        visitorId: testVisitor,
        isGuest: true,
        action: 'Watching: Test Movie (Movie)',
        path: '/movie/999'
      })
    });
    assert(hbRes.status === 200, 'Tracking heartbeat responds with 200 OK');

    // 2. Auth security tests
    const unauthRes = await fetch(`${baseUrl}/visitors`);
    assert(unauthRes.status === 401, 'Unauthenticated request to /visitors returns 401');

    const forbiddenRes = await fetch(`${baseUrl}/visitors`, {
      headers: { Authorization: `Bearer ${normalUserToken}` }
    });
    assert(forbiddenRes.status === 403, 'Normal user request to /visitors returns 403');

    // 3. Stats verification
    const statsRes = await fetch(`${baseUrl}/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(statsRes.status === 200, '/stats returns 200 OK');
    const statsData = await statsRes.json();
    assert(typeof statsData.uniqueVisitorsToday === 'number', '/stats contains numeric uniqueVisitorsToday');
    assert(typeof statsData.totalVisitsToday === 'number', '/stats contains numeric totalVisitsToday');
    assert(typeof statsData.streamViewersToday === 'number', '/stats contains numeric streamViewersToday');
    assert(typeof statsData.totalActiveHoursToday === 'number', '/stats contains numeric totalActiveHoursToday');

    // 4. Visitors endpoint with server-side pagination (no 5,000 limit)
    const visitorsRes = await fetch(`${baseUrl}/visitors?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(visitorsRes.status === 200, '/visitors returns 200 OK');
    const visitorsData = await visitorsRes.json();
    assert(Array.isArray(visitorsData.visitors), 'visitorsData.visitors is an array');
    assert(typeof visitorsData.totalCount === 'number', 'visitorsData.totalCount is a number');
    assert(visitorsData.limit === 10, 'visitorsData.limit reflects requested limit');
    assert(visitorsData.visitors.length <= 10, 'visitors array length is capped at requested limit');
    assert(visitorsData.counts && typeof visitorsData.counts.all === 'number', 'visitorsData has counts breakdown');

    if (visitorsData.visitors.length > 0) {
      const sample = visitorsData.visitors[0];
      assert('total_visits' in sample, 'Visitor row includes total_visits');
      assert('total_active_seconds' in sample, 'Visitor row includes total_active_seconds');
      assert('stream_count' in sample, 'Visitor row includes stream_count');
      assert('today_visits' in sample, 'Visitor row includes today_visits');
      assert('today_active_seconds' in sample, 'Visitor row includes today_active_seconds');
    }

    // 5. Visitors search
    const searchRes = await fetch(`${baseUrl}/visitors?search=${testVisitor}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchRes.status === 200, '/visitors search returns 200 OK');
    const searchData = await searchRes.json();
    assert(searchData.visitors.some(v => v.visitor_id === testVisitor), 'Search finds newly tracked test visitor');

    // 6. Registered users search & engagement metrics
    const usersRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(usersRes.status === 200, '/users returns 200 OK');
    const usersData = await usersRes.json();
    assert(Array.isArray(usersData), '/users returns an array');
    if (usersData.length > 0) {
      assert('total_visits' in usersData[0], 'User row includes total_visits');
      assert('total_active_seconds' in usersData[0], 'User row includes total_active_seconds');
      assert('stream_count' in usersData[0], 'User row includes stream_count');
    }

    // 7. Filter test
    const filterRes = await fetch(`${baseUrl}/visitors?filter=today`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(filterRes.status === 200, '/visitors filter=today returns 200 OK');

    console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTests();
