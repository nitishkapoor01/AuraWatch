const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const express = require('express');
const adsRoutes = require('./routes/ads');
const adminRoutes = require('./routes/admin');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';

const app = express();
app.use(express.json());
app.use('/api/ads', adsRoutes);
app.use('/api/admin', adminRoutes);

let server;

async function runTests() {
  console.log('=== RUNNING ADS & PRE-ROLL GATEWAY TESTS ===');

  await new Promise((resolve) => {
    server = app.listen(0, () => resolve());
  });

  // Ensure DB has initialized
  await db.query('SELECT 1');
  await new Promise(r => setTimeout(r, 1500));

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  const adminToken = jwt.sign(
    { id: 1, email: 'nitishkapoor152005@gmail.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check GET /api/ads/config
    const configRes = await fetch(`${baseUrl}/ads/config`);
    assert(configRes.status === 200, 'GET /api/ads/config returns 200 OK');
    const configData = await configRes.json();
    assert(configData.config && typeof configData.config === 'object', 'Config object is present');
    assert(configData.config.pre_roll !== undefined, 'pre_roll configuration is present in /api/ads/config');
    assert(typeof configData.config.pre_roll.timer_seconds === 'number', 'pre_roll.timer_seconds is a number');

    // 2. Test logging an impression for pre_roll slot
    const testVisitorId = 'test_preroll_visitor_' + Date.now();
    const impRes = await fetch(`${baseUrl}/ads/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: 'pre_roll',
        visitorId: testVisitorId,
        sessionId: 'test_session_123',
        deviceType: 'desktop'
      })
    });
    assert(impRes.status === 200, 'POST /api/ads/impression for slot pre_roll returns 200 OK');
    const impData = await impRes.json();
    assert(impData.success === true, 'Impression for pre_roll slot logged successfully');

    // 3. Test debounce for pre_roll slot within 8s
    const impResDebounced = await fetch(`${baseUrl}/ads/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: 'pre_roll',
        visitorId: testVisitorId,
        sessionId: 'test_session_123',
        deviceType: 'desktop'
      })
    });
    const impDebouncedData = await impResDebounced.json();
    assert(impDebouncedData.debounced === true, 'Duplicate impression within 8 seconds is debounced');

    // 4. Test rejecting invalid slot
    const badSlotRes = await fetch(`${baseUrl}/ads/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: 'hacker_exploit_slot',
        visitorId: testVisitorId
      })
    });
    assert(badSlotRes.status === 400, 'Invalid ad slot is rejected with 400 Bad Request');

    // 5. Test updating ads configuration via Admin endpoint
    const updatedConfig = {
      ...configData.config,
      pre_roll: {
        ...configData.config.pre_roll,
        timer_seconds: 7
      }
    };

    const updateRes = await fetch(`${baseUrl}/admin/ads/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ config: updatedConfig })
    });
    assert(updateRes.status === 200, 'POST /api/admin/ads/config returns 200 OK with admin token');

    // 6. Verify updated config in public endpoint
    const verifyRes = await fetch(`${baseUrl}/ads/config`);
    const verifyData = await verifyRes.json();
    assert(verifyData.config.pre_roll.timer_seconds === 7, 'Public config reflects updated timer_seconds (7)');

    // 7. Verify ad statistics endpoint in admin includes slot data
    const statsRes = await fetch(`${baseUrl}/admin/ads/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(statsRes.status === 200, 'GET /api/admin/ads/stats returns 200 OK');
    const statsData = await statsRes.json();
    assert(Array.isArray(statsData.slotBreakdown), 'slotBreakdown is an array');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
    console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
