const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// Apply auth and admin check to all routes in this file
router.use(authMiddleware);
router.use(isAdmin);

// Fetch Platform Stats
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalFavorites = db.prepare('SELECT COUNT(*) as count FROM favorites').get().count;
    const totalWatches = db.prepare('SELECT COUNT(*) as count FROM watch_history').get().count;
    
    // Get actual watch time from progress (stored in minutes)
    const totalProgressResult = db.prepare('SELECT SUM(progress) as totalProgress FROM watch_history').get();
    const totalProgressMinutes = totalProgressResult.totalProgress || 0;
    const totalWatchTimeHours = totalProgressMinutes / 60;

    // Analytics
    const dailyActive = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date = date('now')").get().count;
    const weeklyActive = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= date('now', '-7 days')").get().count;
    const monthlyActive = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= date('now', '-30 days')").get().count;
    const yearlyActive = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE date >= date('now', '-365 days')").get().count;
    
    // Total Unique Visits (Guests + Logged In)
    const totalVisitsToday = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date = date('now')").get().count;
    const totalVisitsWeekly = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= date('now', '-7 days')").get().count;
    const totalVisitsMonthly = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= date('now', '-30 days')").get().count;
    const totalVisitsYearly = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits WHERE date >= date('now', '-365 days')").get().count;
    const totalVisitsAllTime = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM platform_visits").get().count;

    res.json({
      totalUsers,
      totalFavorites,
      totalWatches,
      totalWatchTimeHours: parseFloat(totalWatchTimeHours.toFixed(1)),
      dailyActive,
      weeklyActive,
      monthlyActive,
      yearlyActive,
      totalVisitsToday,
      totalVisitsWeekly,
      totalVisitsMonthly,
      totalVisitsYearly,
      totalVisitsAllTime
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch platform statistics.' });
  }
});

// Fetch all users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, name, email, role, avatar, created_at, failed_login_attempts
      FROM users
      ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// Delete a user
router.delete('/users/:id', (req, res) => {
  const userId = req.params.id;
  
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own admin account.' });
  }

  try {
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (info.changes === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Clean up related data
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM watch_history WHERE user_id = ?').run(userId);

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('User delete error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// Get Current Announcement
router.get('/announcement', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('announcement');
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
router.post('/announcement', (req, res) => {
  try {
    const announcement = req.body; // { active: boolean, message: string, type: string }
    const valueStr = JSON.stringify(announcement);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('announcement', valueStr);
    res.json({ message: 'Announcement updated successfully.', announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Failed to update announcement.' });
  }
});

// Fetch All Settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsMap = {};
    settings.forEach(s => {
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
router.post('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ message: 'Key is required.' });

  try {
    console.log(`[ADMIN] Updating setting: ${key} = ${value}`);
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, valueStr);
    res.json({ message: `Setting ${key} updated successfully.`, key, value });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: 'Failed to update setting.' });
  }
});

module.exports = router;
