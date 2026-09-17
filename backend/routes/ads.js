const express = require('express');
const router = express.Router();
const db = require('../db');

// In-memory rate limiting map for impressions: key => lastLoggedTimestamp
// key format: `${visitorId || sessionId}_${slot}`
const impressionDebounce = new Map();

// Periodic cleanup of debounce cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of impressionDebounce.entries()) {
    if (now - timestamp > 60000) {
      impressionDebounce.delete(key);
    }
  }
}, 300000);

// Log an ad impression
router.post('/impression', async (req, res) => {
  try {
    const { slot, visitorId, sessionId, deviceType } = req.body;

    const allowedSlots = ['download_modal', 'movie_detail', 'social_bar', 'search_grid', 'direct_link', 'pre_roll'];
    if (!slot || !allowedSlots.includes(slot)) {
      return res.status(400).json({ error: 'Invalid ad slot' });
    }

    const clientIdentifier = visitorId || sessionId || req.ip || 'anonymous';
    const debounceKey = `${clientIdentifier}_${slot}`;
    const now = Date.now();
    const lastTime = impressionDebounce.get(debounceKey);

    // Debounce: prevent same client from logging same slot within 8 seconds
    if (lastTime && now - lastTime < 8000) {
      return res.json({ success: true, debounced: true });
    }

    impressionDebounce.set(debounceKey, now);

    const safeDevice = deviceType === 'mobile' || deviceType === 'tablet' ? deviceType : 'desktop';

    await db.query(
      `INSERT INTO ad_impressions (slot, visitor_id, session_id, device_type)
       VALUES ($1, $2, $3, $4)`,
      [slot, visitorId || null, sessionId || null, safeDevice]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to log ad impression:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy endpoint to bypass CORS and headers for VAST requests
router.get('/vast-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid VAST URL' });
    }
    const response = await fetch(url, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': req.headers['referer'] || 'https://aurawatch.fun',
        'Origin': 'https://aurawatch.fun'
      }
    });
    const xml = await response.text();
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('VAST proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy VAST' });
  }
});

// Get current public ads configuration
router.get('/config', async (req, res) => {
  try {
    const [adsConfigRes, skipTimerRes] = await Promise.all([
      db.query("SELECT value FROM settings WHERE key = 'ads_config'"),
      db.query("SELECT value FROM settings WHERE key = 'skip_ads_timer'")
    ]);

    let config = {
      enabled: true,
      download_modal: {
        enabled: true,
        timer_seconds: 30,
        format: 'native',
        container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
        key: 'ccd684eb4f620dcc7303d2fce2577bae',
        script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
        width: 300,
        height: 250
      },
      movie_detail: {
        enabled: true,
        format: 'native',
        container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
        key: 'ccd684eb4f620dcc7303d2fce2577bae',
        script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
        width: 728,
        height: 180
      },
      search_grid: {
        enabled: true,
        format: 'native',
        container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
        key: 'ccd684eb4f620dcc7303d2fce2577bae',
        script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
        width: 300,
        height: 250
      },
      social_bar: {
        enabled: false,
        script_url: ''
      },
      direct_link: {
        enabled: true,
        url: 'https://www.profitableratecpmnetwork.com/vjbf0irysc?key=e9c2d7dcafa36589f0542411f295ee11'
      },
      pre_roll: {
        enabled: true,
        type: 'vast', // 'vast' | 'video' | 'banner'
        vast_url: 'https://s.magsrv.com/v1/vast.php?idz=6033014',
        video_url: '',
        timer_seconds: 5,
        format: 'native',
        container_id: 'container-ccd684eb4f620dcc7303d2fce2577bae',
        key: 'ccd684eb4f620dcc7303d2fce2577bae',
        script_url: 'https://pl31278426.profitableratecpmnetwork.com/ccd684eb4f620dcc7303d2fce2577bae/invoke.js',
        direct_url: 'https://www.profitableratecpmnetwork.com/vjbf0irysc?key=e9c2d7dcafa36589f0542411f295ee11',
        fallback_banner: true,
        width: 300,
        height: 250
      }
    };

    if (adsConfigRes.rows[0]?.value) {
      try {
        config = { ...config, ...JSON.parse(adsConfigRes.rows[0].value) };
      } catch (_) {}
    }

    let skipAdsTimer = false;
    if (skipTimerRes.rows[0]?.value) {
      try {
        skipAdsTimer = JSON.parse(skipTimerRes.rows[0].value);
      } catch (_) {
        skipAdsTimer = skipTimerRes.rows[0].value === 'true';
      }
    }

    res.json({
      config,
      skipAdsTimer: !!skipAdsTimer
    });
  } catch (error) {
    console.error('Failed to get public ads config:', error);
    res.status(500).json({ error: 'Failed to retrieve ads config' });
  }
});

module.exports = router;
