const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const db = require('../db');
const { resolveCountry, getClientIp, isBot } = require('../utils/geo');

// In-memory store for active sessions
// Map<sessionId, { lastSeen: number, isGuest: boolean, userId: number|null, countryCode: string, countryName: string, flag: string }>
const activeSessions = new Map();

// Ping endpoint - called by all clients every ~30s
router.post('/heartbeat', async (req, res) => {
  // Discard automated crawler/scraper bots (Meta/Facebook crawler, Googlebot, etc.)
  // to maintain pure, accurate human audience analytics matching Adsterra.
  if (isBot(req)) {
    let announcement = null;
    try {
      const result = await db.query('SELECT value FROM settings WHERE key = $1', ['announcement']);
      const row = result.rows[0];
      if (row && row.value) {
        announcement = JSON.parse(row.value);
      }
    } catch (e) {}
    return res.json({ success: true, isBot: true, announcement });
  }

  const { sessionId, isGuest, userId, visitorId, path, action, name, timezone, locale } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  // Detect Country using IP + headers + timezone + locale fallback
  const { countryCode, countryName, flag } = resolveCountry(req, timezone, locale);
  const clientIp = getClientIp(req);

  activeSessions.set(sessionId, {
    lastSeen: Date.now(),
    isGuest: !!isGuest,
    userId: userId || null,
    name: name || null,
    visitorId: visitorId || null,
    path: path || '/',
    action: action || null,
    countryCode,
    countryName,
    flag
  });

  const isWatching = (action && typeof action === 'string' && action.toLowerCase().startsWith('watching:'));

  // Log to unique_visitors table (background-ish)
  if (visitorId) {
    db.query(`
      INSERT INTO unique_visitors (
        visitor_id, last_ip, country_code, country_name, is_registered, user_id, last_seen,
        total_visits, total_active_seconds, stream_count, total_watch_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 1, 30, $7, $8)
      ON CONFLICT (visitor_id) DO UPDATE SET
        last_ip = EXCLUDED.last_ip,
        country_code = CASE WHEN EXCLUDED.country_code <> 'XX' THEN EXCLUDED.country_code ELSE unique_visitors.country_code END,
        country_name = CASE WHEN EXCLUDED.country_name <> 'Unknown' THEN EXCLUDED.country_name ELSE unique_visitors.country_name END,
        is_registered = EXCLUDED.is_registered,
        user_id = EXCLUDED.user_id,
        last_seen = CURRENT_TIMESTAMP,
        total_active_seconds = COALESCE(unique_visitors.total_active_seconds, 0) + 30,
        total_watch_seconds = COALESCE(unique_visitors.total_watch_seconds, 0) + $8
    `, [visitorId, clientIp, countryCode, countryName, !isGuest, userId || null, isWatching ? 1 : 0, isWatching ? 30 : 0])
      .catch(e => console.error('[TRACKING] Failed to upsert visitor', e));
  }

  if (userId) {
    try {
      await db.query("INSERT INTO user_activity (user_id, date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING", [userId]);
    } catch (e) {
      console.error('Failed to log user activity', e);
    }
  }

  try {
    const visitRes = await db.query(`
      INSERT INTO platform_visits (session_id, date, visitor_id, country_code, country_name, active_seconds, watched_stream) 
      VALUES ($1, CURRENT_DATE, $2, $3, $4, 30, $5) 
      ON CONFLICT (session_id, date) DO UPDATE SET 
        visitor_id = EXCLUDED.visitor_id,
        country_code = CASE WHEN EXCLUDED.country_code <> 'XX' THEN EXCLUDED.country_code ELSE platform_visits.country_code END,
        country_name = CASE WHEN EXCLUDED.country_name <> 'Unknown' THEN EXCLUDED.country_name ELSE platform_visits.country_name END,
        active_seconds = COALESCE(platform_visits.active_seconds, 0) + 30,
        watched_stream = platform_visits.watched_stream OR EXCLUDED.watched_stream
      RETURNING (xmax = 0) AS is_new_session;
    `, [sessionId, visitorId || null, countryCode, countryName, isWatching]);

    // If a brand new session was initiated today, increment total_visits on unique_visitors
    if (visitorId && visitRes.rows.length > 0 && visitRes.rows[0].is_new_session) {
      db.query(`
        UPDATE unique_visitors 
        SET total_visits = COALESCE(total_visits, 0) + 1 
        WHERE visitor_id = $1
      `, [visitorId]).catch(() => {});
    }

    // If user started watching a stream in this session, increment stream_count once per stream session
    if (visitorId && isWatching && visitRes.rows.length > 0 && visitRes.rows[0].is_new_session) {
      db.query(`
        UPDATE unique_visitors 
        SET stream_count = COALESCE(stream_count, 0) + 1 
        WHERE visitor_id = $1
      `, [visitorId]).catch(() => {});
    }
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

  res.json({ success: true, announcement, country: { countryCode, countryName, flag } });
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
  const countryCounts = {};

  for (const [sessionId, data] of activeSessions.entries()) {
    total++;
    if (data.isGuest) {
      guests++;
    } else {
      loggedIn++;
    }

    const code = data.countryCode || 'XX';
    if (!countryCounts[code]) {
      countryCounts[code] = {
        code,
        name: data.countryName || 'Unknown',
        flag: data.flag || '🌐',
        count: 0
      };
    }
    countryCounts[code].count++;
    
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
        lastSeen: data.lastSeen,
        countryCode: data.countryCode || 'XX',
        countryName: data.countryName || 'Unknown',
        flag: data.flag || '🌐'
      });
    }
  }
  
  // Sort by most recently active
  sessions.sort((a, b) => b.lastSeen - a.lastSeen);

  const liveCountries = Object.values(countryCounts).sort((a, b) => b.count - a.count);

  res.json({ total, guests, loggedIn, sessions, liveCountries });
});

module.exports = router;
