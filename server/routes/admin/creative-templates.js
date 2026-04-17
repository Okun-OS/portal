const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../public/uploads/creative-templates');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'tpl_' + Date.now() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Nur Bilder erlaubt (JPG, PNG, WebP)'));
}});

// GET /api/admin/creative-templates
router.get('/', requireAdmin, (req, res) => {
  const templates = db.prepare('SELECT * FROM creative_template_assets ORDER BY created_at DESC').all();
  res.json(templates.map(t => ({ ...t, placeholders: JSON.parse(t.placeholders || '[]') })));
});

// POST /api/admin/creative-templates (upload)
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  const { name, format, placeholders, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  const filePath = '/uploads/creative-templates/' + req.file.filename;
  const result = db.prepare(`
    INSERT INTO creative_template_assets (name, format, file_path, placeholders, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, format || 'post', filePath, placeholders || '[]', notes || null);

  res.status(201).json({ id: result.lastInsertRowid, file_path: filePath });
});

// PUT /api/admin/creative-templates/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { name, format, placeholders, notes } = req.body;
  db.prepare(`UPDATE creative_template_assets SET name=COALESCE(?,name), format=COALESCE(?,format), placeholders=COALESCE(?,placeholders), notes=COALESCE(?,notes) WHERE id=?`)
    .run(name || null, format || null, placeholders || null, notes || null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/creative-templates/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const tpl = db.prepare('SELECT file_path FROM creative_template_assets WHERE id = ?').get(req.params.id);
  if (tpl) {
    const full = path.join(__dirname, '../../../public', tpl.file_path);
    try { fs.unlinkSync(full); } catch {}
  }
  db.prepare('DELETE FROM creative_template_assets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/creative-templates/brief  – fill placeholders for a customer/campaign
router.post('/brief', requireAdmin, (req, res) => {
  const { template_id, customer_id, campaign_id, creatives } = req.body;
  const tpl = db.prepare('SELECT * FROM creative_template_assets WHERE id = ?').get(template_id);
  if (!tpl) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

  const customer = customer_id ? db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) : null;
  const campaign = campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaign_id) : null;

  // Auto-map known placeholder sources
  const sourceMap = {
    firmen_name: customer?.company_name,
    kontakt_name: customer?.contact_name,
    telefon: customer?.phone,
    email: customer?.email,
    stadt: campaign?.geo_location_name || customer?.address,
    zielgruppe: campaign?.target_audience,
    plattform: campaign?.platform,
  };
  // Merge with provided creatives (AI-generated texts)
  const aiMap = {};
  (creatives || []).forEach(c => { aiMap[c.type] = c.content; });
  sourceMap.headline = aiMap.headline;
  sourceMap.hook = aiMap.hook;
  sourceMap.cta = aiMap.cta;
  sourceMap.anzeigentext = aiMap.body;

  const placeholders = JSON.parse(tpl.placeholders || '[]');
  const filled = placeholders.map(p => ({
    ...p,
    value: sourceMap[p.source || p.key] || '',
  }));

  res.json({ template: { ...tpl, placeholders: filled } });
});

module.exports = router;
