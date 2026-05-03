const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const db = require('../db');

// In-memory store for active sessions
// Map<sessionId, { lastSeen: number, isGuest: boolean, userId: number|null }>
const activeSessions = new Map();

// Ping endpoint - called by all clients every ~30s
router.post('/heartbeat', async (req, res) => {
  const { sessionId, isGuest, userId, visitorId, path, action, name } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  activeSessions.set(sessionId, {
    lastSeen: Date.now(),
    isGuest: !!isGuest,
    userId: userId || null,
    name: name || null,
    visitorId: visitorId || null,
    path: path || '/',
    action: action || null
  });

  // Log to unique_visitors table (background-ish)
  if (visitorId) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';
    db.query(`
      INSERT INTO unique_visitors (visitor_id, last_ip, is_registered, user_id, last_seen)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (visitor_id) DO UPDATE SET
        last_ip = EXCLUDED.last_ip,
        is_registered = EXCLUDED.is_registered,
        user_id = EXCLUDED.user_id,
        last_seen = CURRENT_TIMESTAMP
    `, [visitorId, ip, !isGuest, userId || null]).catch(e => console.error('[TRACKING] Failed to upsert visitor', e));
  }

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
  const sessions = [];

  for (const [sessionId, data] of activeSessions.entries()) {
    total++;
    if (data.isGuest) {
      guests++;
    } else {
      loggedIn++;
    }
    
    // Only return data from the last 5 minutes to keep it clean
    if (Date.now() - data.lastSeen < 300000) {
      sessions.push({
        id: sessionId,
        isGuest: data.isGuest,
        userId: data.userId,
        name: data.name,
        visitorId: data.visitorId,
        path: data.path,
        action: data.action,
        lastSeen: data.lastSeen
      });
    }
  }
  
  // Sort by most recently active
  sessions.sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({ total, guests, loggedIn, sessions });
});

module.exports = router;
