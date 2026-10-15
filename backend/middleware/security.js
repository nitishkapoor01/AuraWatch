const db = require('../db');
const { getClientIp } = require('../utils/geo');

let blockedIpCache = new Map(); // ip => reason
let lastCacheUpdate = 0;

const updateBlockedIpCache = async () => {
  try {
    const res = await db.query('SELECT ip_address, reason FROM blocked_ips');
    const newMap = new Map();
    for (const row of res.rows) {
      newMap.set(row.ip_address, row.reason);
    }
    blockedIpCache = newMap;
    lastCacheUpdate = Date.now();
  } catch (_) {}
};

const securityMiddleware = async (req, res, next) => {
  const ip = getClientIp(req);

  // Instant bypass for localhost / development loopback
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return next();
  }

  // Asynchronously refresh in-memory cache every 60 seconds without blocking requests
  const now = Date.now();
  if (now - lastCacheUpdate > 60000) {
    lastCacheUpdate = now;
    updateBlockedIpCache().catch(() => {});
  }

  // Instant 0ms memory lookup
  if (blockedIpCache.has(ip)) {
    return res.status(403).json({ 
      message: 'Your IP has been blocked by administrators.',
      reason: blockedIpCache.get(ip)
    });
  }

  next();
};

module.exports = securityMiddleware;
