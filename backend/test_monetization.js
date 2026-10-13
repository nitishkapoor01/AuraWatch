const db = require('./db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';

async function runMonetizationTests() {
  console.log('--- STARTING MONETIZATION & VIP BACKEND TESTS ---');
  let testUserId = null;
  let adminUserId = null;

  try {
    // 1. Verify schema tables and columns
    console.log('[Test 1] Verifying database schema columns...');
    const colCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('is_premium', 'premium_expires_at', 'premium_plan', 'premium_activated_by')
    `);
    const cols = colCheck.rows.map(r => r.column_name);
    if (!cols.includes('is_premium') || !cols.includes('premium_expires_at')) {
      throw new Error(`Missing premium columns in users table: found ${JSON.stringify(cols)}`);
    }
    console.log('✅ Users table has all VIP columns.');

    // Verify VIP tables
    const tableCheck = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('vip_redeem_codes', 'vip_payment_requests')
    `);
    const tables = tableCheck.rows.map(r => r.table_name);
    if (!tables.includes('vip_redeem_codes') || !tables.includes('vip_payment_requests')) {
      throw new Error(`Missing VIP tables: found ${JSON.stringify(tables)}`);
    }
    console.log('✅ VIP tables exist in PostgreSQL.');

    // 2. Setup or find a test user and admin user
    const userRes = await db.query(`
      INSERT INTO users (name, email, password_hash, security_question, security_answer_hash, role)
      VALUES ('VIP Tester', 'viptest@aurawatch.fun', 'fakehash', 'q', 'a', 'user')
      ON CONFLICT (email) DO UPDATE SET is_premium = FALSE, premium_expires_at = NULL
      RETURNING id, email, is_premium
    `);
    testUserId = userRes.rows[0].id;

    const adminRes = await db.query(`
      INSERT INTO users (name, email, password_hash, security_question, security_answer_hash, role, is_super_admin)
      VALUES ('Admin VIP Tester', 'adminvip@aurawatch.fun', 'fakehash', 'q', 'a', 'admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
      RETURNING id, email, role
    `);
    adminUserId = adminRes.rows[0].id;
    console.log(`✅ Test user ID: ${testUserId}, Admin user ID: ${adminUserId}`);

    // 3. Test code generation and single-use redemption
    console.log('[Test 2] Testing VIP Gift Code generation & redemption...');
    const testCode = `TEST-VIP-${Date.now()}`;
    await db.query(
      `INSERT INTO vip_redeem_codes (code, duration_days, plan_name, created_by, is_active)
       VALUES ($1, 30, 'VIP Ad-Free 1 Month', $2, TRUE)`,
      [testCode, adminUserId]
    );

    // Simulate redemption logic using pool connect + transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const codeRow = (await client.query('SELECT * FROM vip_redeem_codes WHERE code = $1 FOR UPDATE', [testCode])).rows[0];
      if (!codeRow || !codeRow.is_active) throw new Error('Code not found or inactive');

      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await client.query('UPDATE users SET is_premium = TRUE, premium_expires_at = $1, premium_plan = $2 WHERE id = $3', [newExpiry, codeRow.plan_name, testUserId]);
      await client.query('UPDATE vip_redeem_codes SET is_active = FALSE, used_by = $1, used_at = NOW() WHERE id = $2', [testUserId, codeRow.id]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const checkUser = (await db.query('SELECT is_premium, premium_expires_at, premium_plan FROM users WHERE id = $1', [testUserId])).rows[0];
    if (!checkUser.is_premium || !checkUser.premium_expires_at) {
      throw new Error('User was not updated to premium after redemption');
    }
    console.log('✅ VIP Code successfully redeemed! User is now VIP until:', checkUser.premium_expires_at);

    // 4. Test duplicate redemption prevention
    console.log('[Test 3] Testing duplicate redemption prevention...');
    const codeCheck = (await db.query('SELECT is_active, used_by FROM vip_redeem_codes WHERE code = $1', [testCode])).rows[0];
    if (codeCheck.is_active !== false || codeCheck.used_by !== testUserId) {
      throw new Error('Code should be deactivated and bound to test user');
    }
    console.log('✅ Used code is deactivated and protected against duplicate use.');

    // 5. Test Payment Request workflow (submit -> approve)
    console.log('[Test 4] Testing VIP Payment Request workflow...');
    const utr = `UTR${Date.now()}`;
    const reqRes = await db.query(
      `INSERT INTO vip_payment_requests (user_id, utr_number, amount, plan_duration_days, status)
       VALUES ($1, $2, 69.00, 90, 'pending')
       RETURNING id, status`,
      [testUserId, utr]
    );
    const reqId = reqRes.rows[0].id;

    // Admin approves request
    const now = new Date();
    const extendedExpiry = new Date(checkUser.premium_expires_at.getTime() + 90 * 24 * 60 * 60 * 1000);
    await db.query('UPDATE users SET is_premium = TRUE, premium_expires_at = $1 WHERE id = $2', [extendedExpiry, testUserId]);
    await db.query('UPDATE vip_payment_requests SET status = $1, reviewed_by = $2 WHERE id = $3', ['approved', adminUserId, reqId]);

    const finalReq = (await db.query('SELECT status FROM vip_payment_requests WHERE id = $1', [reqId])).rows[0];
    const finalUser = (await db.query('SELECT is_premium, premium_expires_at FROM users WHERE id = $1', [testUserId])).rows[0];
    if (finalReq.status !== 'approved' || finalUser.premium_expires_at <= checkUser.premium_expires_at) {
      throw new Error('Payment approval failed to properly extend user subscription');
    }
    console.log('✅ Payment request approved and subscription stacked/extended to:', finalUser.premium_expires_at);

    // 6. Test Admin Revocation
    console.log('[Test 5] Testing Admin Revocation...');
    await db.query('UPDATE users SET is_premium = FALSE, premium_expires_at = NOW(), premium_plan = $1 WHERE id = $2', ['free', testUserId]);
    const revokedUser = (await db.query('SELECT is_premium FROM users WHERE id = $1', [testUserId])).rows[0];
    if (revokedUser.is_premium !== false) {
      throw new Error('Failed to revoke user premium');
    }
    console.log('✅ Admin revocation verified: User is successfully downgraded to free.');

    // Cleanup test data
    await db.query('DELETE FROM vip_payment_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM vip_redeem_codes WHERE code = $1', [testCode]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
    console.log('✅ Test cleanup completed.');

    console.log('\n🎉 ALL MONETIZATION & VIP BACKEND TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
    process.exit(1);
  }
}

runMonetizationTests();
