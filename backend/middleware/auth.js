const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Please login.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = require('../db');
    const uRes = await db.query('SELECT role, is_super_admin FROM users WHERE id = $1', [decoded.id]);
    req.user = {
      ...decoded,
      role: uRes.rows[0]?.role || 'user',
      is_super_admin: uRes.rows[0]?.is_super_admin || false
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please login again.' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = require('../db');
    const uRes = await db.query('SELECT role, is_super_admin FROM users WHERE id = $1', [decoded.id]);
    req.user = {
      ...decoded,
      role: uRes.rows[0]?.role || 'user',
      is_super_admin: uRes.rows[0]?.is_super_admin || false
    };
  } catch (error) {
    // Ignore invalid/expired tokens for optional endpoints
  }
  next();
};

const isAdmin = async (req, res, next) => {
  const db = require('../db');
  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
  } catch (error) {
    console.error('[Auth Middleware] Admin verify error:', error);
    return res.status(500).json({ message: 'Error verifying administrator status.' });
  }
};

const isModerator = async (req, res, next) => {
  const db = require('../db');
  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return res.status(403).json({ message: 'Access denied. Moderator privileges required.' });
    }
    next();
  } catch (error) {
    console.error('[Auth Middleware] Moderator verify error:', error);
    return res.status(500).json({ message: 'Error verifying moderator status.' });
  }
};

module.exports = { authMiddleware, isAdmin, isModerator, optionalAuth };
