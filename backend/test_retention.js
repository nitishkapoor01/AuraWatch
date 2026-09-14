require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express');
const adminRoutes = require('./routes/admin');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';

// Spin up a dedicated test express app on an ephemeral port
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

let server;

async function runTests() {
  console.log('=== RUNNING RETENTION & INSIGHTS ANALYTICS TESTS ===');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      resolve();
    });
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/admin`;

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
    // Generate JWT tokens for test cases
    const adminToken = jwt.sign({ id: 1, email: 'nitishkapoor152005@gmail.com' }, JWT_SECRET, { expiresIn: '1h' });
    const normalUserToken = jwt.sign({ id: 3, email: 'sme22921@gmail.com' }, JWT_SECRET, { expiresIn: '1h' });

    // TEST 1: Unauthenticated request must return 401
    const unauthRes = await fetch(`${baseUrl}/analytics/retention`);
    assert(unauthRes.status === 401, 'Unauthenticated request returns 401 Unauthorized');

    // TEST 2: Normal user token must return 403
    const forbiddenRes = await fetch(`${baseUrl}/analytics/retention`, {
      headers: { Authorization: `Bearer ${normalUserToken}` }
    });
    assert(forbiddenRes.status === 403, 'Normal non-admin user returns 403 Forbidden');

    // TEST 3: Admin token returns 200 with complete all_time retention schema
    const adminRes = await fetch(`${baseUrl}/analytics/retention?period=all_time`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminRes.status === 200, 'Admin request returns 200 OK');
    const data = await adminRes.json();

    assert(typeof data.totalVisitors === 'number' && data.totalVisitors > 0, 'Retention data contains valid totalVisitors');
    assert(typeof data.returningVisitors === 'number' && data.returningVisitors > 0, 'Retention data contains valid returningVisitors');
    assert(typeof data.retentionRate === 'number' && data.retentionRate >= 0 && data.retentionRate <= 100, 'Retention rate is between 0% and 100%');
    assert(data.cohorts && typeof data.cohorts.cohort_10_plus === 'number', 'Cohorts breakdown exists');
    assert(data.longevity && typeof data.longevity.sameDay === 'number', 'Longevity breakdown exists');
    assert(Array.isArray(data.hourlyActivity) && data.hourlyActivity.length === 24, '24-hour activity distribution exists');
    assert(Array.isArray(data.returningUsers) && data.returningUsers.length > 0, 'Returning users list is populated');
    
    // Check first returning user structure
    const topUser = data.returningUsers[0];
    assert(topUser.visitorId && topUser.totalSessions > 1, 'Top returning user has visitorId and multiple sessions');
    assert(['VIP', 'Frequent', 'Returning'].includes(topUser.loyaltyTier), 'Top user has valid loyalty tier');
    assert(topUser.countryCode && topUser.flag, 'Top user has country code and flag');

    // TEST 4: Timeframe filters work without error
    for (const p of ['today', 'weekly', 'monthly']) {
      const pRes = await fetch(`${baseUrl}/analytics/retention?period=${p}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(pRes.status === 200, `Timeframe period '${p}' returns 200 OK`);
      const pData = await pRes.json();
      assert(pData.period === p, `Returned data has correct period='${p}'`);
    }

    // TEST 5: Search & filter parameter validation
    const searchRes = await fetch(`${baseUrl}/analytics/retention?filter=registered&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchRes.status === 200, 'Filter registered users returns 200 OK');
    const searchData = await searchRes.json();
    assert(searchData.returningUsers.every(u => u.isRegistered === true), 'All returned users in registered filter are registered');

    // TEST 6: Platform insights endpoint
    const insightsRes = await fetch(`${baseUrl}/analytics/platform-insights`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(insightsRes.status === 200, 'Platform insights endpoint returns 200 OK');
    const insightsData = await insightsRes.json();
    assert(Array.isArray(insightsData.deviceBreakdown), 'Device breakdown is an array');
    assert(insightsData.streamingFunnel && typeof insightsData.streamingFunnel.totalVisits === 'number', 'Streaming funnel metrics exist');
    assert(Array.isArray(insightsData.topReWatched), 'Top re-watched titles is an array');
    assert(Array.isArray(insightsData.contentGaps), 'Content gaps search failures is an array');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();
