const db = require('../db');
const { getClientIp } = require('../utils/geo');

const securityMiddleware = async (req, res, next) => {
  // Get IP address safely via getClientIp
  const ip = getClientIp(req);
  
  try {
    const result = await db.query('SELECT * FROM blocked_ips WHERE ip_address = $1', [ip]);
    
    if (result.rows.length > 0) {
      return res.status(403).json({ 
        message: 'Your IP has been blocked by administrators.',
        reason: result.rows[0].reason 
      });
    }
    
    next();
  } catch (error) {
    console.error('Security middleware error:', error);
    next(); // Don't block if DB fails, but log it
  }
};

module.exports = securityMiddleware;
