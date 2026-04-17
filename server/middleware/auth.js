const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Nur für Admins' });
    }
    next();
  });
}

function requireClient(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'client' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    // Refresh customerId from DB in case old token doesn't have it
    if (req.user.role === 'client' && !req.user.customerId) {
      const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
      req.user.customerId = customer ? customer.id : null;
    }
    next();
  });
}

module.exports = { authenticate, requireAdmin, requireClient, JWT_SECRET };
