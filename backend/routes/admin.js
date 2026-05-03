const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin, isModerator } = require('../middleware/auth');

// Apply auth check to all routes
router.use(authMiddleware);

// --- GET ROUTES (Moderator & Admin Access) ---

// Fetch Platform Stats
router.get('/stats', isModerator, async (req, res) => {
  try {
    const totalUsers = (await db.query('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalFavorites = (await db.query('SELECT COUNT(*) as count FROM favorites')).rows[0].count;
    const totalWatches = (await db.query('SELECT COUNT(*) as count FROM watch_history')).rows[0].count;
    const totalProgressResult = await db.query('SELECT SUM(progress) as "totalProgress" FROM watch_history');
    const totalProgressMinutes = totalProgressResult.rows[0].totalProgress || 0;
    const totalWatchTimeHours = totalProgressMinutes / 60;

    const dailyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date = CURRENT_DATE")).rows[0].count;
    const weeklyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const monthlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const yearlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '365 days'")).rows[0].count;
    
    const totalVisitsToday = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date = CURRENT_DATE")).rows[0].count;
    const totalVisitsWeekly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const totalVisitsMonthly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const totalVisitsAllTime = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits")).rows[0].count;

    const uniqueVisitorsToday = (await db.query("SELECT COUNT(DISTINCT visitor_id) as count FROM platform_visits WHERE date = CURRENT_DATE AND visitor_id IS NOT NULL")).rows[0].count;
    const uniqueVisitorsWeekly = (await db.query("SELECT COUNT(DISTINCT visitor_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND visitor_id IS NOT NULL")).rows[0].count;
    const uniqueVisitorsMonthly = (await db.query("SELECT COUNT(DISTINCT visitor_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days' AND visitor_id IS NOT NULL")).rows[0].count;

    res.json({
      totalUsers: parseInt(totalUsers),
      totalFavorites: parseInt(totalFavorites),
      totalWatches: parseInt(totalWatches),
      totalWatchTimeHours: parseFloat(totalWatchTimeHours.toFixed(1)),
      dailyActive: parseInt(dailyActive),
      weeklyActive: parseInt(weeklyActive),
      monthlyActive: parseInt(monthlyActive),
      yearlyActive: parseInt(yearlyActive),
      totalVisitsToday: parseInt(totalVisitsToday),
      totalVisitsWeekly: parseInt(totalVisitsWeekly),
      totalVisitsMonthly: parseInt(totalVisitsMonthly),
      totalVisitsAllTime: parseInt(totalVisitsAllTime),
      uniqueVisitorsToday: parseInt(uniqueVisitorsToday),
      uniqueVisitorsWeekly: parseInt(uniqueVisitorsWeekly),
      uniqueVisitorsMonthly: parseInt(uniqueVisitorsMonthly)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch platform statistics.' });
  }
});

// Fetch all users
router.get('/users', isModerator, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.is_super_admin, u.admin_permissions, u.avatar, u.created_at,
             (SELECT last_seen FROM unique_visitors v WHERE v.user_id = u.id ORDER BY last_seen DESC LIMIT 1) as last_seen
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// Fetch Search Logs
router.get('/search-logs', isModerator, async (req, res) => {
  try {
    const recentSearches = await db.query('SELECT * FROM search_logs ORDER BY created_at DESC LIMIT 50');
    const topKeywords = await db.query('SELECT query, COUNT(*) as count FROM search_logs GROUP BY query ORDER BY count DESC LIMIT 10');
    res.json({ recent: recentSearches.rows, topKeywords: topKeywords.rows, noResults: [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch search logs.' });
  }
});

// Fetch All Settings
router.get('/settings', isModerator, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings');
    const settingsMap = {};
    result.rows.forEach(s => {
      try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
    });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});

// GET Announcement
router.get('/announcement', isModerator, async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['announcement']);
    if (result.rows[0]) res.json(JSON.parse(result.rows[0].value));
    else res.json(null);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get announcement.' });
  }
});

// GET Visitors, Most Watched, Login Logs
router.get('/visitors', isModerator, async (req, res) => {
  const result = await db.query('SELECT * FROM unique_visitors ORDER BY last_seen DESC LIMIT 50');
  res.json(result.rows);
});
router.get('/analytics/most-watched', isModerator, async (req, res) => {
  const result = await db.query('SELECT title, movie_type, COUNT(*) as watches FROM watch_history GROUP BY title, movie_type ORDER BY watches DESC LIMIT 10');
  res.json(result.rows);
});
router.get('/security/login-logs', isModerator, async (req, res) => {
  const result = await db.query('SELECT l.*, u.name, u.email FROM login_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 50');
  res.json(result.rows);
});
router.get('/security/blocked-ips', isModerator, async (req, res) => {
  const result = await db.query('SELECT * FROM blocked_ips ORDER BY blocked_at DESC');
  res.json(result.rows);
});


// --- WRITE ROUTES (Admin Only) ---

// Update Announcement
router.post('/announcement', isAdmin, async (req, res) => {
  try {
    const valueStr = JSON.stringify(req.body);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', ['announcement', valueStr]);
    res.json({ message: 'Announcement updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
});

// Update Setting
router.post('/settings', isAdmin, async (req, res) => {
  const { key, value } = req.body;
  try {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', [key, valueStr]);
    res.json({ message: `Setting ${key} updated successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update setting.' });
  }
});

// Update User Role
router.put('/users/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'moderator', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot change your own role.' });

  const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
  if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be modified.' });

  await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
  res.json({ message: `User role updated to ${role}` });
});

// Delete User Permanently
router.delete('/users/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot delete yourself.' });
  
  try {
    const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
    if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be deleted.' });

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted permanently.' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// Update Admin Permissions
router.put('/users/:id/permissions', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  const currentUser = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [req.user.id]);
  if (!currentUser.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Only Super Admin can manage permissions.' });
  await db.query('UPDATE users SET admin_permissions = $1 WHERE id = $2', [JSON.stringify(permissions), id]);
  res.json({ message: 'Permissions updated.' });
});

// Ban/Unban User
router.put('/users/:id/ban', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_banned } = req.body;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'You cannot ban yourself.' });
  const target = await db.query('SELECT is_super_admin FROM users WHERE id = $1', [id]);
  if (target.rows[0]?.is_super_admin) return res.status(403).json({ message: 'Super Admins cannot be banned.' });
  await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned, id]);
  res.json({ message: `User ${is_banned ? 'banned' : 'unbanned'}` });
});

// Block/Unblock IP
router.post('/security/block-ip', isAdmin, async (req, res) => {
  const { ip_address, reason } = req.body;
  await db.query('INSERT INTO blocked_ips (ip_address, reason) VALUES ($1, $2) ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason', [ip_address, reason || 'Banned by admin']);
  res.json({ message: `IP ${ip_address} blocked` });
});
router.delete('/security/block-ip/:ip', isAdmin, async (req, res) => {
  await db.query('DELETE FROM blocked_ips WHERE ip_address = $1', [req.params.ip]);
  res.json({ message: 'IP unblocked' });
});

module.exports = router;
