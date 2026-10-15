const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const DEFAULT_AD_TIERS = [
  { id: '1_day', name: 'Daily Pass', target_ads: 5, reward_hours: 24, label: '24 Hours (1 Day)' },
  { id: '2_days', name: '2-Day Pass', target_ads: 10, reward_hours: 48, label: '48 Hours (2 Days)' },
  { id: '5_days', name: '5-Day Pass', target_ads: 20, reward_hours: 120, label: '120 Hours (5 Days)' }
];

async function getAdPassConfig() {
  try {
    const res = await db.query("SELECT value FROM settings WHERE key = 'ad_pass_config'");
    let cfg = { enabled: true, target_ads: 5, reward_hours: 24, tiers: DEFAULT_AD_TIERS };
    if (res.rows[0]?.value) {
      try { 
        const parsed = JSON.parse(res.rows[0].value);
        cfg = { ...cfg, ...parsed };
        if (!cfg.tiers || !cfg.tiers.length) cfg.tiers = DEFAULT_AD_TIERS;
      } catch (_) {}
    }
    return cfg;
  } catch (err) {
    return { enabled: true, target_ads: 5, reward_hours: 24, tiers: DEFAULT_AD_TIERS };
  }
}

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

// @route   GET /api/vip/ad-pass/progress
// @desc    Get current user or guest's Ad-Pass quest status
// @access  Public (supports user token and guest visitor_id)
router.get('/ad-pass/progress', optionalAuth, async (req, res) => {
  try {
    const config = await getAdPassConfig();
    const visitorId = req.headers['x-visitor-id'] || req.query.visitor_id || null;
    const cleanVid = visitorId ? String(visitorId).trim().slice(0, 100) : null;
    const userId = req.user?.id || null;
    const tiers = config.tiers || DEFAULT_AD_TIERS;

    if (!userId && !cleanVid) {
      return res.json({
        enabled: config.enabled,
        current_count: 0,
        target_count: tiers[0].target_ads,
        reward_hours: tiers[0].reward_hours,
        tiers,
        is_unlocked: false,
        unlocked_until: null,
        seconds_remaining: 0
      });
    }

    // 1. Check if authenticated user is already premium
    if (req.user?.is_premium && req.user?.premium_expires_at) {
      const exp = new Date(req.user.premium_expires_at);
      if (exp > new Date()) {
        const secLeft = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
        return res.json({
          enabled: config.enabled,
          current_count: 5,
          target_count: 5,
          reward_hours: 24,
          tiers,
          is_unlocked: true,
          unlocked_until: exp,
          seconds_remaining: secLeft
        });
      }
    }

    // 2. Query ad_pass_quests table
    let questRes;
    if (userId) {
      questRes = await db.query(
        'SELECT * FROM ad_pass_quests WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [userId]
      );
      if (questRes.rows.length === 0 && cleanVid) {
        questRes = await db.query(
          'SELECT * FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL ORDER BY updated_at DESC LIMIT 1',
          [cleanVid]
        );
        if (questRes.rows.length > 0) {
          await db.query('UPDATE ad_pass_quests SET user_id = $1 WHERE id = $2', [userId, questRes.rows[0].id]).catch(() => {});
        }
      }
    } else {
      questRes = await db.query(
        'SELECT * FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL ORDER BY updated_at DESC LIMIT 1',
        [cleanVid]
      );
    }

    const quest = questRes.rows[0];
    let isUnlocked = false;
    let unlockedUntil = null;
    let secLeft = 0;

    if (quest && quest.unlocked_until) {
      const exp = new Date(quest.unlocked_until);
      if (exp > new Date()) {
        isUnlocked = true;
        unlockedUntil = exp;
        secLeft = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
      }
    }

    const currentCount = quest?.current_count || 0;
    // Find next tier target
    const nextTier = tiers.find(t => t.target_ads > currentCount) || tiers[tiers.length - 1];

    res.json({
      enabled: config.enabled,
      current_count: currentCount,
      target_count: nextTier.target_ads,
      reward_hours: nextTier.reward_hours,
      tiers,
      is_unlocked: isUnlocked,
      unlocked_until: unlockedUntil,
      seconds_remaining: secLeft
    });
  } catch (error) {
    console.error('[Ad-Pass Progress] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve Ad-Pass progress' });
  }
});

// @route   POST /api/vip/ad-pass/complete-ad
// @desc    Increment ad watch count; unlock or extend VIP pass when milestones reached
// @access  Public (supports user token and guest visitor_id)
router.post('/ad-pass/complete-ad', optionalAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const config = await getAdPassConfig();
    if (!config.enabled) {
      return res.status(400).json({ message: 'Ad-Pass quest is currently disabled.' });
    }

    const visitorId = req.headers['x-visitor-id'] || req.body.visitor_id || req.query.visitor_id || null;
    const cleanVid = visitorId ? String(visitorId).trim().slice(0, 100) : null;
    const userId = req.user?.id || null;
    const tiers = config.tiers || DEFAULT_AD_TIERS;

    if (!userId && !cleanVid) {
      return res.status(400).json({ message: 'Missing visitor or user identification.' });
    }

    await client.query('BEGIN');

    // Fetch existing quest row with lock
    let questRes;
    if (userId) {
      questRes = await client.query(
        'SELECT * FROM ad_pass_quests WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (questRes.rows.length === 0 && cleanVid) {
        questRes = await client.query(
          'SELECT * FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL FOR UPDATE',
          [cleanVid]
        );
        if (questRes.rows.length > 0) {
          await client.query('UPDATE ad_pass_quests SET user_id = $1 WHERE id = $2', [userId, questRes.rows[0].id]);
        }
      }
    } else {
      questRes = await client.query(
        'SELECT * FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL FOR UPDATE',
        [cleanVid]
      );
    }

    let quest = questRes.rows[0];
    const now = new Date();

    if (quest) {
      // Abuse prevention: cooldown between ad completions (min 6 seconds)
      if (quest.last_ad_completed_at) {
        const timeSince = (now.getTime() - new Date(quest.last_ad_completed_at).getTime()) / 1000;
        if (timeSince < 6) {
          await client.query('ROLLBACK');
          const waitSec = Math.ceil(6 - timeSince);
          return res.status(429).json({ message: `Please wait ${waitSec}s before claiming the next ad.` });
        }
      }
    } else {
      // Create initial quest row
      const insertRes = await client.query(
        `INSERT INTO ad_pass_quests (user_id, visitor_id, current_count, target_count, reward_hours)
         VALUES ($1, $2, 0, $3, $4)
         RETURNING *`,
        [userId, userId ? null : cleanVid, tiers[0].target_ads, tiers[0].reward_hours]
      );
      quest = insertRes.rows[0];
    }

    const currentCount = quest.current_count || 0;
    const nextCount = currentCount + 1;

    // Check if nextCount unlocks or upgrades any tier milestone
    const matchedTier = tiers.find(t => t.target_ads === nextCount);
    const highestEarnedTier = tiers.filter(t => nextCount >= t.target_ads).pop();

    if (matchedTier) {
      // Milestone reached! Calculate extension or new unlock
      let baseDate = now;
      if (quest.unlocked_until && new Date(quest.unlocked_until) > now) {
        baseDate = new Date(quest.unlocked_until);
      }
      const newUnlockedUntil = new Date(baseDate.getTime() + matchedTier.reward_hours * 60 * 60 * 1000);

      await client.query(
        `UPDATE ad_pass_quests
         SET current_count = $1,
             target_count = $2,
             reward_hours = $3,
             unlocked_until = $4,
             last_ad_completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [nextCount, matchedTier.target_ads, matchedTier.reward_hours, newUnlockedUntil, quest.id]
      );

      if (userId) {
        let userBaseDate = now;
        if (req.user?.is_premium && req.user?.premium_expires_at && new Date(req.user.premium_expires_at) > now) {
          userBaseDate = new Date(req.user.premium_expires_at);
        }
        const userExpiry = new Date(userBaseDate.getTime() + matchedTier.reward_hours * 60 * 60 * 1000);

        await client.query(
          `UPDATE users
           SET is_premium = TRUE,
               premium_expires_at = $1,
               premium_plan = $2,
               premium_activated_by = 'ad_quest'
           WHERE id = $3`,
          [userExpiry, `VIP Ad-Pass (${matchedTier.name})`, userId]
        );
      }

      await client.query('COMMIT');

      const nextTargetTier = tiers.find(t => t.target_ads > nextCount);

      return res.json({
        success: true,
        is_unlocked: true,
        current_count: nextCount,
        target_count: nextTargetTier ? nextTargetTier.target_ads : nextCount,
        reward_hours: matchedTier.reward_hours,
        unlocked_until: newUnlockedUntil,
        tier: matchedTier,
        message: `${matchedTier.name} unlocked. ${matchedTier.label} active.`
      });
    } else {
      // Step increment
      const nextTargetTier = tiers.find(t => t.target_ads > nextCount) || tiers[tiers.length - 1];
      const isCurrentlyUnlocked = Boolean(quest.unlocked_until && new Date(quest.unlocked_until) > now);

      await client.query(
        `UPDATE ad_pass_quests
         SET current_count = $1,
             last_ad_completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [nextCount, quest.id]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        is_unlocked: isCurrentlyUnlocked,
        current_count: nextCount,
        target_count: nextTargetTier.target_ads,
        remaining: Math.max(0, nextTargetTier.target_ads - nextCount),
        unlocked_until: quest.unlocked_until,
        message: `Progress saved (${nextCount}/${nextTargetTier.target_ads} ads).`
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Complete Ad] Error:', error);
    res.status(500).json({ message: 'Failed to record ad progress.' });
  } finally {
    client.release();
  }
});

// @route   POST /api/vip/redeem
// @desc    Redeem a VIP gift code atomically (for registered users or guests)
// @access  Public (optionalAuth)
router.post('/redeem', optionalAuth, async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Redeem code is required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 4 || cleanCode.length > 50) {
    return res.status(400).json({ message: 'Invalid redeem code format.' });
  }

  const visitorId = req.headers['x-visitor-id'] || req.body.visitor_id || req.query.visitor_id || null;
  const cleanVid = visitorId ? String(visitorId).trim().slice(0, 100) : null;
  const userId = req.user?.id || null;

  if (!userId && !cleanVid) {
    return res.status(400).json({ message: 'Identification required to redeem code.' });
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

    const durationDays = parseInt(codeRow.duration_days, 10) || 30;
    const now = new Date();
    let baseDate = now;
    let newExpiresAt;

    if (userId) {
      // Fetch user current expiry
      const userRes = await client.query(
        'SELECT is_premium, premium_expires_at FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const user = userRes.rows[0];

      if (user.is_premium && user.premium_expires_at && new Date(user.premium_expires_at) > now) {
        baseDate = new Date(user.premium_expires_at);
      }
      newExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update user
      await client.query(
        `UPDATE users
         SET is_premium = TRUE,
             premium_expires_at = $1,
             premium_plan = $2,
             premium_activated_by = 'code'
         WHERE id = $3`,
        [newExpiresAt, codeRow.plan_name || 'VIP Ad-Free', userId]
      );

      // Also ensure ad_pass_quests reflects this unlocked status
      await client.query(
        `INSERT INTO ad_pass_quests (user_id, unlocked_until, current_count, target_count)
         VALUES ($1, $2, 5, 5)
         ON CONFLICT (id) DO UPDATE SET unlocked_until = EXCLUDED.unlocked_until`,
        [userId, newExpiresAt]
      ).catch(() => {});
    } else {
      // Guest visitor redemption
      newExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const guestQuest = await client.query(
        'SELECT id, unlocked_until FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL FOR UPDATE',
        [cleanVid]
      );

      if (guestQuest.rows.length > 0) {
        if (guestQuest.rows[0].unlocked_until && new Date(guestQuest.rows[0].unlocked_until) > now) {
          baseDate = new Date(guestQuest.rows[0].unlocked_until);
          newExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        }
        await client.query(
          `UPDATE ad_pass_quests
           SET unlocked_until = $1, current_count = 5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newExpiresAt, guestQuest.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO ad_pass_quests (visitor_id, unlocked_until, current_count, target_count, reward_hours)
           VALUES ($1, $2, 5, 5, $3)`,
          [cleanVid, newExpiresAt, durationDays * 24]
        );
      }
    }

    // Mark code as used
    await client.query(
      `UPDATE vip_redeem_codes
       SET is_active = FALSE,
           used_by = $1,
           used_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId || null, codeRow.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `VIP Membership activated for ${durationDays} days. Enjoy 100% ad-free streaming.`,
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
