const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  // Get customer_id if client and track login activity
  let customerId = null;
  if (user.role === 'client') {
    const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(user.id);
    customerId = customer ? customer.id : null;
    if (customerId) {
      db.prepare(`UPDATE customers SET last_login_at = datetime('now'), login_count = login_count + 1 WHERE id = ?`).run(customerId);
    }
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, customerId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name, customerId }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, role, name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

  let customerId = null;
  if (user.role === 'client') {
    const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(user.id);
    customerId = customer ? customer.id : null;
  }

  res.json({ ...user, customerId });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Alle Felder erforderlich' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
