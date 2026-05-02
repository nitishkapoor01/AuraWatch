const express = require('express');
const router = express.Router();
const db = require('../db');

// Get a public setting by key
router.get('/:key', async (req, res) => {
  const { key } = req.params;
  
  // Only allow certain keys to be read publicly
  const publicKeys = ['skip_ads_timer', 'announcement'];
  if (!publicKeys.includes(key)) {
    return res.status(403).json({ message: 'This setting is not public.' });
  }

  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
    const row = result.rows[0];
    if (!row) return res.json({ value: null });
    
    try {
      res.json({ value: JSON.parse(row.value) });
    } catch {
      res.json({ value: row.value });
    }
  } catch (error) {
    console.error('Public setting fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch setting.' });
  }
});

module.exports = router;
