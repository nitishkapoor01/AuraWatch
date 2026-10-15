const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

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
router.get('/config', optionalAuth, async (req, res) => {
  try {
    // If authenticated user is verified VIP, completely turn off ads at the server level
    if (req.user && req.user.is_premium) {
      return res.json({
        config: {
          enabled: false,
          is_premium: true,
          download_modal: { enabled: false, timer_seconds: 0 },
          movie_detail: { enabled: false },
          search_grid: { enabled: false },
          social_bar: { enabled: false },
          direct_link: { enabled: false },
          pre_roll: { enabled: false, timer_seconds: 0 }
        },
        skipAdsTimer: true,
        is_premium: true
      });
    }

    const [adsConfigRes, skipTimerRes] = await Promise.all([
      db.query("SELECT value FROM settings WHERE key = 'ads_config'"),
      db.query("SELECT value FROM settings WHERE key = 'skip_ads_timer'")
    ]);

    let config = {
      enabled: true,
      download_modal: {
        enabled: false,
        timer_seconds: 5,
        format: 'native',
        width: 300,
        height: 250
      },
      movie_detail: {
        enabled: false,
        format: 'native',
        width: 728,
        height: 180
      },
      search_grid: {
        enabled: false,
        format: 'native',
        width: 300,
        height: 250
      },
      social_bar: {
        enabled: false,
        script_url: ''
      },
      direct_link: {
        enabled: true,
        url: 'https://plump-plastic.com/b.3RVK0pP/3EpIvPbnm/VIJBZWDe0K3kNkT/IVx/M/T/AF5tL/TGcy1/Mjj/EGxhMOTJMT'
      },
      pre_roll: {
        enabled: true,
        type: 'vast', // 'vast' | 'video' | 'banner'
        vast_url: 'https://loyal-product.com/dXmaFuz.dKG/N/vIZdG/UJ/Zexmc9Gu/ZpUql/k/PSTRcp1/Mtj_EUwsMJjgkFtJNzzYU/y/MOTUA-ztMKwH',
        timer_seconds: 5,
        fallback_banner: false
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
