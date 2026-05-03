const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const db = require('../db');

// In-memory store for active sessions
// Map<sessionId, { lastSeen: number, isGuest: boolean, userId: number|null }>
const activeSessions = new Map();

// Ping endpoint - called by all clients every ~30s
router.post('/heartbeat', async (req, res) => {
  const { sessionId, isGuest, userId, visitorId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  activeSessions.set(sessionId, {
    lastSeen: Date.now(),
    isGuest: !!isGuest,
    userId: userId || null
  });

  if (userId) {
    try {
      await db.query("INSERT INTO user_activity (user_id, date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING", [userId]);
    } catch (e) {
      console.error('Failed to log user activity', e);
    }
  }

  try {
    await db.query("INSERT INTO platform_visits (session_id, date, visitor_id) VALUES ($1, CURRENT_DATE, $2) ON CONFLICT (session_id, date) DO UPDATE SET visitor_id = EXCLUDED.visitor_id", [sessionId, visitorId || null]);
  } catch (e) {
    console.error('Failed to log platform visit', e);
  }

  let announcement = null;
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['announcement']);
    const row = result.rows[0];
    if (row && row.value) {
      announcement = JSON.parse(row.value);
    }
  } catch (e) {
    console.error('Failed to get announcement for heartbeat', e);
  }

  res.json({ success: true, announcement });
});

// Cleanup stale sessions (older than 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of activeSessions.entries()) {
    if (now - data.lastSeen > 60000) {
      activeSessions.delete(sessionId);
    }
  }
}, 30000); // Check every 30s

// Admin endpoint to get live stats
// Protected route
router.get('/live-stats', authMiddleware, isAdmin, (req, res) => {
  let total = 0;
  let guests = 0;
  let loggedIn = 0;

  for (const data of activeSessions.values()) {
    total++;
    if (data.isGuest) {
      guests++;
    } else {
      loggedIn++;
    }
  }

  res.json({ total, guests, loggedIn });
});

module.exports = router;
