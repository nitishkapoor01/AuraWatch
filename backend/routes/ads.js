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
    res.set('Access-Control-Allow-Origin', '*');
    res.send(xml);
  } catch (err) {
    console.error('VAST proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy VAST' });
  }
});

// Proxy endpoint to stream MP4 video bytes through first-party origin (bypasses adblockers)
router.get('/video-proxy', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid Video URL' });
    }

    // Normalize silent-basis.pro to www.silent-basis.pro (bare domain lacks DNS A record)
    if (url.includes('://silent-basis.pro')) {
      url = url.replace('://silent-basis.pro', '://www.silent-basis.pro');
    }

    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://aurawatch.fun',
      'Origin': 'https://aurawatch.fun'
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(url, { headers });
    
    if (response.headers.get('content-range')) {
      res.status(206);
      res.set('Content-Range', response.headers.get('content-range'));
      res.set('Accept-Ranges', 'bytes');
    } else {
      res.status(response.status);
    }

    res.set('Content-Type', response.headers.get('content-type') || 'video/mp4');
    const cl = response.headers.get('content-length');
    if (cl) res.set('Content-Length', cl);
    res.set('Access-Control-Allow-Origin', '*');

    const { Readable } = require('stream');
    const nodeStream = Readable.fromWeb(response.body);

    nodeStream.on('error', (streamErr) => {
      // Client disconnected, closed player modal, or skipped ad — safely ignore
      if (!res.headersSent) {
        try { res.status(500).end(); } catch (_) {}
      }
    });

    req.on('close', () => {
      try { nodeStream.destroy(); } catch (_) {}
    });

    res.on('error', () => {
      try { nodeStream.destroy(); } catch (_) {}
    });

    nodeStream.pipe(res);
  } catch (err) {
    console.error('Video proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy video' });
    }
  }
});

let cachedPublicConfig = null;
let lastPublicConfigFetch = 0;

// Get current public ads configuration
router.get('/config', optionalAuth, async (req, res) => {
  try {
    // If authenticated user is verified VIP or guest has active Ad-Pass, completely turn off ads at the server level
    let isVipActive = Boolean(req.user && req.user.is_premium);

    const visitorId = req.headers['x-visitor-id'] || req.query.visitor_id;
    if (!isVipActive && visitorId) {
      const qRes = await db.query(
        'SELECT id FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL AND unlocked_until > CURRENT_TIMESTAMP LIMIT 1',
        [String(visitorId).trim().slice(0, 100)]
      ).catch(() => ({ rows: [] }));
      if (qRes.rows.length > 0) {
        isVipActive = true;
      }
    }

    if (isVipActive) {
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

    const now = Date.now();
    if (cachedPublicConfig && (now - lastPublicConfigFetch < 60000)) {
      return res.json(cachedPublicConfig);
    }

    const dbPromise = Promise.all([
      db.query("SELECT value FROM settings WHERE key = 'ads_config'"),
      db.query("SELECT value FROM settings WHERE key = 'skip_ads_timer'")
    ]);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB query timeout')), 1500)
    );

    const [adsConfigRes, skipTimerRes] = await Promise.race([dbPromise, timeoutPromise]);

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
        timer_seconds: 10,
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

    cachedPublicConfig = {
      config,
      skipAdsTimer: !!skipAdsTimer
    };
    lastPublicConfigFetch = now;

    res.json(cachedPublicConfig);
  } catch (error) {
    console.error('Failed to get public ads config, serving default fallback:', error);
    res.json({
      config: {
        enabled: true,
        download_modal: { enabled: false, timer_seconds: 5 },
        movie_detail: { enabled: false },
        search_grid: { enabled: false },
        social_bar: { enabled: false },
        direct_link: {
          enabled: true,
          url: 'https://plump-plastic.com/b.3RVK0pP/3EpIvPbnm/VIJBZWDe0K3kNkT/IVx/M/T/AF5tL/TGcy1/Mjj/EGxhMOTJMT'
        },
        pre_roll: {
          enabled: true,
          type: 'vast',
          vast_url: 'https://loyal-product.com/dXmaFuz.dKG/N/vIZdG/UJ/Zexmc9Gu/ZpUql/k/PSTRcp1/Mtj_EUwsMJjgkFtJNzzYU/y/MOTUA-ztMKwH',
          timer_seconds: 10,
          fallback_banner: false
        }
      },
      skipAdsTimer: false
    });
  }
});

module.exports = router;
