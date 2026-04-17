const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

function issueToken(user, customerId) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, customerId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

  let customerId = null;
  if (user.role === 'client') {
    const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(user.id);
    customerId = customer ? customer.id : null;
    if (customerId) {
      db.prepare(`UPDATE customers SET last_login_at = datetime('now'), login_count = login_count + 1 WHERE id = ?`).run(customerId);
    }
  }

  const token = issueToken(user, customerId);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, customerId } });
});

// ── Google OAuth ─────────────────────────────────────────────────────────────

function getOAuthConfig() {
  try {
    const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key IN ('google_oauth_client_id','google_oauth_client_secret','portal_url')`).all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch { return {}; }
}

// GET /api/auth/google  – redirect to Google consent screen
router.get('/google', (req, res) => {
  const cfg = getOAuthConfig();
  const clientId = cfg.google_oauth_client_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return res.status(503).send('Google-Login nicht konfiguriert.');

  const portalUrl = cfg.portal_url || process.env.PORTAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri = portalUrl.replace(/\/$/, '') + '/api/auth/google/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=google_auth_failed');

  const cfg = getOAuthConfig();
  const clientId = cfg.google_oauth_client_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = cfg.google_oauth_client_secret || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const portalUrl = cfg.portal_url || process.env.PORTAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri = portalUrl.replace(/\/$/, '') + '/api/auth/google/callback';

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get Google user info
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
    });
    const gUser = await infoRes.json();
    const email = gUser.email?.toLowerCase();
    if (!email) throw new Error('E-Mail von Google nicht empfangen');

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Check if a customer exists with this email and link them
      const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
      if (!customer) {
        return res.redirect('/?error=no_account&email=' + encodeURIComponent(email));
      }
      const result = db.prepare(`INSERT INTO users (email, password, role, name, google_id, avatar_url) VALUES (?,'',${'client'},?,?,?)`)
        .run(email, gUser.name || email, gUser.id, gUser.picture || null);
      db.prepare('UPDATE customers SET user_id = ? WHERE id = ?').run(result.lastInsertRowid, customer.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      db.prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url,?) WHERE id = ?')
        .run(gUser.id, gUser.picture || null, user.id);
    }

    let customerId = null;
    if (user.role === 'client') {
      const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(user.id);
      customerId = customer?.id || null;
      if (customerId) {
        db.prepare(`UPDATE customers SET last_login_at=datetime('now'), login_count=login_count+1 WHERE id=?`).run(customerId);
      }
    }

    const token = issueToken(user, customerId);
    const dest = user.role === 'admin' ? '/admin/' : '/client/';
    // Redirect to an auth-callback page that stores the token
    res.redirect(`/auth-callback.html?token=${token}&dest=${encodeURIComponent(dest)}`);
  } catch (e) {
    console.error('[google-oauth]', e.message);
    res.redirect('/?error=' + encodeURIComponent(e.message));
  }
});

// GET /api/auth/google-status  – public, tells frontend if Google login is available
router.get('/google-status', (req, res) => {
  const cfg = getOAuthConfig();
  const enabled = !!(cfg.google_oauth_client_id || process.env.GOOGLE_OAUTH_CLIENT_ID);
  res.json({ enabled });
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

