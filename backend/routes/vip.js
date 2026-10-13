const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/vip/status
// @desc    Get current user's VIP subscription status and latest payment request
// @access  Authenticated
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userRes = await db.query(
      'SELECT is_premium, premium_expires_at, premium_plan FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userRes.rows[0];

    let isPremium = user?.is_premium || false;
    const expiresAt = user?.premium_expires_at;
    if (isPremium && expiresAt && new Date(expiresAt) < new Date()) {
      isPremium = false;
      await db.query('UPDATE users SET is_premium = FALSE WHERE id = $1', [req.user.id]).catch(() => {});
    }

    let daysRemaining = 0;
    if (isPremium && expiresAt) {
      daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
    }

    // Get latest payment request
    const reqRes = await db.query(
      `SELECT id, utr_number, amount, plan_duration_days, status, admin_notes, created_at, reviewed_at
       FROM vip_payment_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    res.json({
      is_premium: isPremium,
      premium_expires_at: expiresAt,
      premium_plan: user?.premium_plan || 'free',
      days_remaining: daysRemaining,
      latest_request: reqRes.rows[0] || null
    });
  } catch (error) {
    console.error('[VIP Status] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve VIP status.' });
  }
});

// @route   POST /api/vip/redeem
// @desc    Redeem a VIP gift code atomically
// @access  Authenticated
router.post('/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Redeem code is required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 4 || cleanCode.length > 50) {
    return res.status(400).json({ message: 'Invalid redeem code format.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic row lock on redeem code
    const codeRes = await client.query(
      'SELECT * FROM vip_redeem_codes WHERE UPPER(code) = $1 FOR UPDATE',
      [cleanCode]
    );

    if (codeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invalid VIP redeem code. Please check and try again.' });
    }

    const codeRow = codeRes.rows[0];
    if (!codeRow.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This VIP code has already been redeemed or deactivated.' });
    }

    // Fetch user current expiry
    const userRes = await client.query(
      'SELECT is_premium, premium_expires_at FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    const user = userRes.rows[0];

    const now = new Date();
    let baseDate = now;
    if (user.is_premium && user.premium_expires_at && new Date(user.premium_expires_at) > now) {
      // Extend existing subscription
      baseDate = new Date(user.premium_expires_at);
    }

    const durationDays = parseInt(codeRow.duration_days, 10) || 30;
    const newExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update user
    await client.query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_expires_at = $1,
           premium_plan = $2,
           premium_activated_by = 'code'
       WHERE id = $3`,
      [newExpiresAt, codeRow.plan_name || 'VIP Ad-Free', req.user.id]
    );

    // Mark code as used
    await client.query(
      `UPDATE vip_redeem_codes
       SET is_active = FALSE,
           used_by = $1,
           used_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user.id, codeRow.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `🎉 VIP Membership activated for ${durationDays} days! Enjoy 100% ad-free streaming.`,
      is_premium: true,
      premium_expires_at: newExpiresAt,
      premium_plan: codeRow.plan_name || 'VIP Ad-Free',
      duration_days: durationDays
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VIP Redeem] Error:', error);
    res.status(500).json({ message: 'Failed to redeem code. Please try again.' });
  } finally {
    client.release();
  }
});

// @route   POST /api/vip/request
// @desc    Submit a UPI UTR payment verification request
// @access  Authenticated
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { utr_number, amount, screenshot_url, plan_duration_days } = req.body;

    if (!utr_number || typeof utr_number !== 'string' || utr_number.trim().length < 6) {
      return res.status(400).json({ message: 'Valid UPI Reference / UTR number (at least 6 characters) is required.' });
    }

    const cleanUTR = utr_number.trim().toUpperCase().slice(0, 60);
    const parsedAmount = parseFloat(amount) || 0;
    const durationDays = parseInt(plan_duration_days, 10) || 30;

    // Check if user already has an active pending request
    const pendingCheck = await db.query(
      `SELECT id FROM vip_payment_requests WHERE user_id = $1 AND status = 'pending'`,
      [req.user.id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'You already have a pending verification request. Admin will review and approve it shortly.'
      });
    }

    // Insert payment request
    const result = await db.query(
      `INSERT INTO vip_payment_requests (
        user_id, utr_number, amount, screenshot_url, plan_duration_days, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [req.user.id, cleanUTR, parsedAmount, screenshot_url || null, durationDays]
    );

    res.status(201).json({
      success: true,
      message: 'Payment request submitted! Admin will verify your transaction and grant VIP access shortly.',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('[VIP Request] Error:', error);
    res.status(500).json({ message: 'Failed to submit payment request.' });
  }
});

// @route   GET /api/vip/my-requests
// @desc    Get user's previous payment requests
// @access  Authenticated
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, utr_number, amount, plan_duration_days, status, admin_notes, created_at, reviewed_at
       FROM vip_payment_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[VIP My Requests] Error:', error);
    res.status(500).json({ message: 'Failed to fetch payment history.' });
  }
});

module.exports = router;
