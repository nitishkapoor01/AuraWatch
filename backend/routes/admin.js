const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// Apply auth and admin check to all routes in this file
router.use(authMiddleware);
router.use(isAdmin);

// Fetch Platform Stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = (await db.query('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalFavorites = (await db.query('SELECT COUNT(*) as count FROM favorites')).rows[0].count;
    const totalWatches = (await db.query('SELECT COUNT(*) as count FROM watch_history')).rows[0].count;
    
    // Get actual watch time from progress (stored in minutes)
    const totalProgressResult = await db.query('SELECT SUM(progress) as "totalProgress" FROM watch_history');
    const totalProgressMinutes = totalProgressResult.rows[0].totalProgress || 0;
    const totalWatchTimeHours = totalProgressMinutes / 60;

    // Analytics
    const dailyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date = CURRENT_DATE")).rows[0].count;
    const weeklyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const monthlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const yearlyActive = (await db.query("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= CURRENT_DATE - INTERVAL '365 days'")).rows[0].count;
    
    // Total Unique Visits (Guests + Logged In)
    const totalVisitsToday = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date = CURRENT_DATE")).rows[0].count;
    const totalVisitsWeekly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'")).rows[0].count;
    const totalVisitsMonthly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days'")).rows[0].count;
    const totalVisitsYearly = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= CURRENT_DATE - INTERVAL '365 days'")).rows[0].count;
    const totalVisitsAllTime = (await db.query("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits")).rows[0].count;

    // Unique Visitors (by localStorage tracking)
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
      totalVisitsYearly: parseInt(totalVisitsYearly),
      totalVisitsAllTime: parseInt(totalVisitsAllTime),
      uniqueVisitorsToday: parseInt(uniqueVisitorsToday),
      uniqueVisitorsWeekly: parseInt(uniqueVisitorsWeekly),
      uniqueVisitorsMonthly: parseInt(uniqueVisitorsMonthly)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch platform statistics.' });
  }
});

// Fetch all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, role, avatar, created_at, failed_login_attempts
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own admin account.' });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Clean up related data (handled by ON DELETE CASCADE if setup, but good to be explicit or let DB handle it. We already set it up in schema)

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('User delete error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// Get Current Announcement
router.get('/announcement', async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['announcement']);
    const row = result.rows[0];
    if (row && row.value) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ message: 'Failed to get announcement.' });
  }
});

// Update Announcement
router.post('/announcement', async (req, res) => {
  try {
    const announcement = req.body; // { active: boolean, message: string, type: string }
    const valueStr = JSON.stringify(announcement);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', ['announcement', valueStr]);
    res.json({ message: 'Announcement updated successfully.', announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
});

// Fetch All Settings
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings');
    const settingsMap = {};
    result.rows.forEach(s => {
      try {
        settingsMap[s.key] = JSON.parse(s.value);
      } catch {
        settingsMap[s.key] = s.value;
      }
    });
    console.log('[ADMIN] Fetched all settings');
    res.json(settingsMap);
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});

// Update Setting
router.post('/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ message: 'Key is required.' });

  try {
    console.log(`[ADMIN] Updating setting: ${key} = ${value}`);
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', [key, valueStr]);
    res.json({ message: `Setting ${key} updated successfully.`, key, value });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Failed to update setting.' });
  }
});

// --- NEW ADMIN ENDPOINTS ---

// Fetch Search Logs
router.get('/search-logs', async (req, res) => {
  try {
    const recentSearches = await db.query('SELECT * FROM search_logs ORDER BY created_at DESC LIMIT 50');
    
    // Most frequent search terms today
    const topKeywords = await db.query(`
      SELECT query, COUNT(*) as count 
      FROM search_logs 
      WHERE created_at >= CURRENT_DATE 
      GROUP BY query 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Top searches that resulted in NO results
    const noResults = await db.query(`
      SELECT query, COUNT(*) as count 
      FROM search_logs 
      WHERE has_results = false 
      GROUP BY query 
      ORDER BY count DESC 
      LIMIT 10
    `);

    res.json({
      recent: recentSearches.rows,
      topKeywords: topKeywords.rows,
      noResults: noResults.rows
    });
  } catch (error) {
    console.error('Fetch search logs error:', error);
    res.status(500).json({ message: 'Failed to fetch search logs.' });
  }
});

// Update User Role
router.put('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') return res.status(400).json({ message: 'Invalid role' });
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own role.' });
  }

  try {
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ message: `User role updated to ${role}` });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Ban/Unban User
router.put('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  const { is_banned } = req.body;
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot ban yourself.' });
  }

  try {
    await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned, id]);
    res.json({ message: `User ${is_banned ? 'banned' : 'unbanned'} successfully` });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update user ban status' });
  }
});

// Analytics: Most Watched Movies (Heatmap data)
router.get('/analytics/most-watched', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT title, movie_type, COUNT(*) as watches 
      FROM watch_history 
      GROUP BY title, movie_type 
      ORDER BY watches DESC 
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch most watched' });
  }
});

// Security: Block IP
router.post('/security/block-ip', async (req, res) => {
  const { ip_address, reason } = req.body;
  if (!ip_address) return res.status(400).json({ message: 'IP address is required' });

  try {
    await db.query('INSERT INTO blocked_ips (ip_address, reason) VALUES ($1, $2) ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason', [ip_address, reason || 'Banned by admin']);
    res.json({ message: `IP ${ip_address} blocked successfully` });
  } catch (e) {
    res.status(500).json({ message: 'Failed to block IP' });
  }
});

// Security: Unblock IP
router.delete('/security/block-ip/:ip', async (req, res) => {
  const { ip } = req.params;
  try {
    await db.query('DELETE FROM blocked_ips WHERE ip_address = $1', [ip]);
    res.json({ message: `IP ${ip} unblocked successfully` });
  } catch (e) {
    res.status(500).json({ message: 'Failed to unblock IP' });
  }
});

// Security: Get Blocked IPs
router.get('/security/blocked-ips', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM blocked_ips ORDER BY blocked_at DESC');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch blocked IPs' });
  }
});

// Security: Get Login Logs
router.get('/security/login-logs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, u.name, u.email 
      FROM login_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC 
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch login logs' });
  }
});

module.exports = router;
