const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const mailer = require('../../services/mailer');

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../public/img');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, 'brand-logo.png'),
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp|svg\+xml)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Nur JPG, PNG, WebP, SVG erlaubt'));
  },
});

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// GET /api/admin/settings
router.get('/', requireAdmin, (req, res) => {
  const s = getSettings();
  // Mask password
  if (s.smtp_pass) s.smtp_pass = '••••••••';
  res.json(s);
});

// PUT /api/admin/settings
router.put('/', requireAdmin, (req, res) => {
  const allowed = ['company_name','company_phone','company_website','portal_url',
    'smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from',
    'sig_logo_position','sig_logo_align','sig_custom_line',
    'google_oauth_client_id','google_oauth_client_secret'];
  const upsert = db.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
  for (const key of allowed) {
    if (key in req.body) {
      // Don't overwrite password if placeholder sent
      if (key === 'smtp_pass' && req.body[key].startsWith('•')) continue;
      upsert.run(key, req.body[key]);
    }
  }
  res.json({ success: true });
});

// POST /api/admin/settings/logo  – upload brand logo
router.post('/logo', requireAdmin, uploadLogo.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Bild' });
  // Update logo_url setting
  db.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES ('logo_url',?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run('/img/brand-logo.png');
  res.json({ url: '/img/brand-logo.png?v=' + Date.now() });
});

// POST /api/admin/settings/test-email
router.post('/test-email', requireAdmin, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Empfänger fehlt' });
  try {
    await mailer.sendTestEmail(to);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.getSettings = getSettings;
