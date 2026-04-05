const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const { getAllTemplates, getTemplate } = require('../../funnelTemplates');
const Anthropic = require('@anthropic-ai/sdk');

// ── Multer: image uploads ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../public/uploads/funnels', String(req.params.id || 'tmp'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '_' + Date.now() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// ── Helper: render template HTML ─────────────────────────────────────────────
function renderTemplate(templateId, data) {
  const tplPath = path.join(__dirname, '../../../public/templates', templateId + '.html');
  if (!fs.existsSync(tplPath)) throw new Error('Template HTML nicht gefunden: ' + templateId);
  let html = fs.readFileSync(tplPath, 'utf8');

  const tpl = getTemplate(templateId);

  // Build form fields HTML
  const formFields = (tpl.form_definition.fields || []).map(f => {
    if (f.type === 'textarea') {
      return `<div class="form-group"><label>${f.label}${f.required ? '' : ' <span style="font-size:11px;color:#9ca3af">(optional)</span>'}</label><textarea name="${f.name}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}></textarea></div>`;
    }
    return `<div class="form-group"><label>${f.label}${f.required ? '' : ' <span style="font-size:11px;color:#9ca3af">(optional)</span>'}</label><input type="${f.type}" name="${f.name}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}></div>`;
  }).join('\n');

  html = html.replace('{{FORM_FIELDS}}', formFields);

  // Replace all {{placeholders}} with data values
  html = html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    key = key.trim();
    if (key in data) return data[key] !== null && data[key] !== undefined ? data[key] : '';
    return '';
  });

  // Process {{#if key}}...{{/if}} blocks
  html = html.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    key = key.trim();
    return data[key] ? content : '';
  });

  return html;
}

// ── GET /api/admin/funnels/templates ─────────────────────────────────────────
router.get('/templates', requireAdmin, (req, res) => {
  res.json(getAllTemplates());
});

// ── GET /api/admin/funnels/templates/:id ─────────────────────────────────────
router.get('/templates/:id', requireAdmin, (req, res) => {
  const tpl = getTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template nicht gefunden' });
  res.json(tpl);
});

// ── GET /api/admin/funnels ────────────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const { customer_id } = req.query;
  let where = '1=1'; const params = [];
  if (customer_id) { where = 'f.customer_id = ?'; params.push(customer_id); }

  const funnels = db.prepare(`
    SELECT f.*, c.company_name
    FROM funnels f
    LEFT JOIN customers c ON c.id = f.customer_id
    WHERE ${where}
    ORDER BY f.created_at DESC
  `).all(...params);

  res.json(funnels.map(f => ({
    ...f,
    fields: JSON.parse(f.fields || '{}'),
    text_slots: JSON.parse(f.text_slots || '{}'),
    image_slots: JSON.parse(f.image_slots || '{}'),
  })));
});

// ── GET /api/admin/funnels/:id ────────────────────────────────────────────────
router.get('/:id', requireAdmin, (req, res) => {
  const f = db.prepare(`
    SELECT f.*, c.company_name
    FROM funnels f LEFT JOIN customers c ON c.id = f.customer_id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Funnel nicht gefunden' });
  res.json({
    ...f,
    fields: JSON.parse(f.fields || '{}'),
    text_slots: JSON.parse(f.text_slots || '{}'),
    image_slots: JSON.parse(f.image_slots || '{}'),
  });
});

// ── POST /api/admin/funnels ───────────────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => {
  const { customer_id, campaign_id, template_id, name } = req.body;
  if (!customer_id || !template_id || !name) {
    return res.status(400).json({ error: 'customer_id, template_id und name erforderlich' });
  }
  if (!getTemplate(template_id)) {
    return res.status(400).json({ error: 'Ungültige template_id' });
  }
  const result = db.prepare(`
    INSERT INTO funnels (customer_id, campaign_id, template_id, name)
    VALUES (?, ?, ?, ?)
  `).run(customer_id, campaign_id || null, template_id, name);
  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PUT /api/admin/funnels/:id/data ──────────────────────────────────────────
router.put('/:id/data', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });

  const { fields, text_slots } = req.body;
  db.prepare(`
    UPDATE funnels SET fields = ?, text_slots = ?, updated_at = datetime('now') WHERE id = ?
  `).run(
    JSON.stringify(fields || JSON.parse(funnel.fields)),
    JSON.stringify(text_slots || JSON.parse(funnel.text_slots)),
    funnel.id
  );
  res.json({ success: true });
});

// ── POST /api/admin/funnels/:id/upload-image ─────────────────────────────────
router.post('/:id/upload-image', requireAdmin, upload.single('image'), (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });

  const slot = req.body.slot;
  const imageSlots = JSON.parse(funnel.image_slots || '{}');
  imageSlots[slot] = '/uploads/funnels/' + req.params.id + '/' + req.file.filename;

  db.prepare('UPDATE funnels SET image_slots = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(JSON.stringify(imageSlots), funnel.id);

  res.json({ url: imageSlots[slot] });
});

// ── POST /api/admin/funnels/:id/generate-texts ───────────────────────────────
router.post('/:id/generate-texts', requireAdmin, async (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });

  const tpl = getTemplate(funnel.template_id);
  if (!tpl) return res.status(400).json({ error: 'Template nicht gefunden' });

  const fields = JSON.parse(funnel.fields || '{}');
  const aiSlots = tpl.text_slots.filter(s => s.ai_generated);

  // Build prompt from template hint + field data
  let hint = tpl.ai_prompt_hint || '';
  Object.entries(fields).forEach(([k, v]) => { hint = hint.replace('{{' + k + '}}', v); });

  const slotDescriptions = aiSlots.map(s =>
    `- "${s.key}" (${s.label}, max ${s.max_chars || 100} Zeichen)`
  ).join('\n');

  const prompt = `Du bist ein Conversion-Texter für Landingpages.

Kundenkontext: ${hint}
Felder: ${JSON.stringify(fields, null, 2)}

Erstelle ALLE folgenden Text-Slots für diese Landingpage.
Antworte NUR mit gültigem JSON – kein Text außerhalb des JSONs.

Slots:
${slotDescriptions}

Format:
{
${aiSlots.map(s => `  "${s.key}": "text hier"`).join(',\n')}
}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    const generated = JSON.parse(match ? match[0] : raw);

    // Merge with existing text_slots
    const existing = JSON.parse(funnel.text_slots || '{}');
    const merged = { ...existing, ...generated };
    db.prepare('UPDATE funnels SET text_slots = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(merged), funnel.id);

    res.json({ text_slots: merged });
  } catch (e) {
    res.status(500).json({ error: 'KI-Generierung fehlgeschlagen: ' + e.message });
  }
});

// ── POST /api/admin/funnels/:id/preview ──────────────────────────────────────
router.post('/:id/preview', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });

  const tpl = getTemplate(funnel.template_id);
  const fields = JSON.parse(funnel.fields || '{}');
  const textSlots = JSON.parse(funnel.text_slots || '{}');
  const imageSlots = JSON.parse(funnel.image_slots || '{}');

  const data = {
    ...fields,
    ...textSlots,
    ...imageSlots,
    FUNNEL_ID: funnel.id,
    FUNNEL_SLUG: funnel.slug || '',
    CUSTOMER_ID: funnel.customer_id,
    CAMPAIGN_ID: funnel.campaign_id || '',
    privacy_text: tpl.form_definition.privacy_text || '',
    danke_headline: tpl.thank_you_page.headline,
    danke_text: tpl.thank_you_page.text,
  };

  try {
    const html = renderTemplate(funnel.template_id, data);
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/admin/funnels/:id/publish ──────────────────────────────────────
router.post('/:id/publish', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });

  const tpl = getTemplate(funnel.template_id);
  const fields = JSON.parse(funnel.fields || '{}');
  const textSlots = JSON.parse(funnel.text_slots || '{}');
  const imageSlots = JSON.parse(funnel.image_slots || '{}');

  // Generate slug if not set
  const slug = funnel.slug || uuidv4().split('-')[0] + '-' + funnel.id;

  const data = {
    ...fields,
    ...textSlots,
    ...imageSlots,
    FUNNEL_ID: funnel.id,
    FUNNEL_SLUG: slug,
    CUSTOMER_ID: funnel.customer_id,
    CAMPAIGN_ID: funnel.campaign_id || '',
    privacy_text: tpl.form_definition.privacy_text || '',
    danke_headline: tpl.thank_you_page.headline,
    danke_text: tpl.thank_you_page.text,
  };

  try {
    const html = renderTemplate(funnel.template_id, data);
    const outDir = path.join(__dirname, '../../../public/f', slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    db.prepare(`
      UPDATE funnels SET slug = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
    `).run(slug, funnel.id);

    res.json({ success: true, slug, url: '/f/' + slug + '/' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/admin/funnels/:id ─────────────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });
  if (funnel.slug) {
    const dir = path.join(__dirname, '../../../public/f', funnel.slug);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  }
  db.prepare('DELETE FROM funnels WHERE id = ?').run(funnel.id);
  res.json({ success: true });
});

module.exports = router;
