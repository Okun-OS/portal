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

// ── Lead-capture + multi-step qualification modal ────────────────────────────
// {{QUAL_STEPS_JSON}}  – JSON array of qualification steps (replaced at render)
// {{FORM_FIELDS_JSON}} – JSON array of contact form fields (replaced at render)
const LEAD_CAPTURE_INJECT = `
<style id="__portal_styles">
#__pq_modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99998;align-items:center;justify-content:center;padding:16px}
#__pq_box{background:#fff;border-radius:20px;padding:36px 40px;max-width:480px;width:100%;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.28)}
#__pq_box h3{margin:0 0 6px;font-size:21px;font-weight:700;color:#111;line-height:1.3}
#__pq_box p.pq_sub{margin:0 0 22px;color:#6b7280;font-size:14px}
.pq_prog{display:flex;gap:5px;margin-bottom:28px}
.pq_prog span{flex:1;height:4px;background:#e5e7eb;border-radius:2px;transition:background .2s}
.pq_prog span.on{background:#2563eb}
.pq_opt{display:block;width:100%;text-align:left;padding:13px 16px;margin:7px 0;border:2px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;font-size:15px;font-weight:500;transition:all .15s;color:#111}
.pq_opt:hover{border-color:#93c5fd;background:#eff6ff}
.pq_inp{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;margin-bottom:10px;box-sizing:border-box;font-family:inherit;outline:none;color:#111}
.pq_inp:focus{border-color:#2563eb}
#__pq_submit{width:100%;padding:14px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-top:6px;transition:background .15s}
#__pq_submit:hover{background:#1d4ed8}
#__pq_back{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:13px;padding:0;margin-top:14px;display:block;font-family:inherit}
#__pq_back:hover{color:#374151}
#__portal_thankyou{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;align-items:center;justify-content:center;padding:16px}
#__portal_thankyou > div{background:#fff;border-radius:20px;padding:48px;text-align:center;max-width:460px;width:100%}
</style>

<div id="__pq_modal">
  <div id="__pq_box">
    <div id="__pq_content"></div>
  </div>
</div>
<div id="__portal_thankyou">
  <div>
    <div style="font-size:52px;margin-bottom:16px">&#10003;</div>
    <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111">{{danke_headline}}</h2>
    <p style="color:#6b7280;font-size:16px;margin:0">{{danke_text}}</p>
  </div>
</div>

<script id="__portal_lead_capture">
(function(){
  var funnelId   = '{{FUNNEL_ID}}';
  var customerId = '{{CUSTOMER_ID}}';
  var campaignId = '{{CAMPAIGN_ID}}';
  var qualSteps  = {{QUAL_STEPS_JSON}};
  var formFields = {{FORM_FIELDS_JSON}};
  var answers    = {};
  var step       = 0;
  var total      = qualSteps.length + 1;

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/'/g,'&#39;'); }

  function progress(){
    var h='<div class="pq_prog">';
    for(var i=0;i<total;i++) h+='<span'+(i<step?' class="on"':'')+'></span>';
    return h+'</div>';
  }

  function renderStep(){
    var box=document.getElementById('__pq_content');
    if(!box) return;
    if(step < qualSteps.length){
      var s=qualSteps[step];
      var opts=s.options.map(function(o){
        return '<button class="pq_opt" onclick="__pq(\''+esc(s.field)+'\',\''+esc(o)+'\')">'+esc(o)+'</button>';
      }).join('');
      box.innerHTML = progress()
        +'<h3>'+esc(s.question)+'</h3>'
        +(s.subtitle?'<p class="pq_sub">'+esc(s.subtitle)+'</p>':'<p class="pq_sub">&nbsp;</p>')
        +opts
        +(step>0?'<button id="__pq_back" onclick="__pqBack()">&#8592; Zurück</button>':'');
    } else {
      var inputs=formFields.map(function(f){
        var req=f.required?' required':'';
        var ph=esc(f.label)+(f.required?' *':'');
        return '<'+( f.type==='textarea'?'textarea class="pq_inp" name="'+esc(f.name)+'" placeholder="'+ph+'" rows="3"'+req+'></textarea>'
          :'input class="pq_inp" type="'+esc(f.type)+'" name="'+esc(f.name)+'" placeholder="'+ph+'"'+req+'>');
      }).join('');
      box.innerHTML = progress()
        +'<h3>Fast geschafft!</h3><p class="pq_sub">Wie sollen wir Sie kontaktieren?</p>'
        +'<form id="__pq_form">'+inputs
        +'<button id="__pq_submit" type="submit">Jetzt absenden &#8594;</button></form>'
        +(step>0?'<button id="__pq_back" onclick="__pqBack()">&#8592; Zurück</button>':'');
      var form=document.getElementById('__pq_form');
      if(form) form.addEventListener('submit',function(e){
        e.preventDefault();
        var d={};
        new FormData(this).forEach(function(v,k){d[k]=v;});
        sendLead(d);
      });
    }
  }

  window.__pq = function(field, val){
    answers[field]=val;
    step++;
    renderStep();
  };
  window.__pqBack = function(){
    if(step>0){ step--; renderStep(); }
  };

  function openModal(){
    step=0; answers={};
    var m=document.getElementById('__pq_modal');
    if(m){ m.style.display='flex'; renderStep(); }
  }

  function sendLead(contactData){
    var notes=Object.keys(answers).map(function(k){ return k+': '+answers[k]; }).join(' | ');
    fetch('/api/webhooks/funnel-lead',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:   contactData.name||contactData.full_name||contactData.vorname||'Unbekannt',
        email:  contactData.email||'',
        phone:  contactData.phone||contactData.telefon||contactData.tel||'',
        message:notes||(contactData.message||contactData.nachricht||''),
        funnel_id:funnelId, funnel_slug:'{{FUNNEL_SLUG}}',
        customer_id:customerId, campaign_id:campaignId||undefined,
      })
    }).then(function(r){return r.json();}).then(function(){
      var m=document.getElementById('__pq_modal');
      if(m) m.style.display='none';
      var ty=document.getElementById('__portal_thankyou');
      if(ty) ty.style.display='flex';
    }).catch(function(){});
  }

  // Close modal on backdrop click
  document.getElementById('__pq_modal').addEventListener('click',function(e){
    if(e.target===this) this.style.display='none';
  });

  // Intercept direct form submits on page (no qual steps or as fallback)
  document.addEventListener('submit',function(e){
    var form=e.target;
    if(!form||form.tagName!=='FORM'||form.id==='__pq_form') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(qualSteps.length>0){
      openModal();
    } else {
      var d={}; new FormData(form).forEach(function(v,k){d[k]=v;}); sendLead(d);
    }
  },true);

  // Intercept CTA button / anchor clicks to open qualification modal
  var CTA_RE=/anfra|bewert|angebot|jetzt starten|kontakt|kostenlos|termin|anfang/i;
  document.addEventListener('click',function(e){
    if(qualSteps.length===0) return;
    var el=e.target;
    for(var i=0;i<6&&el&&el!==document.body;i++){
      var tag=(el.tagName||'').toUpperCase();
      var href=el.getAttribute?el.getAttribute('href'):'';
      var txt=(el.innerText||el.textContent||'').trim();
      var isCTA=(tag==='BUTTON'&&el.type!=='submit')
             || (tag==='A'&&(!href||href==='#'||href.startsWith('#')))
             || CTA_RE.test(txt);
      if(isCTA){
        e.preventDefault(); e.stopPropagation();
        openModal(); return;
      }
      el=el.parentElement;
    }
  },true);
})();
<\/script>
`;

// ── Helper: render template HTML ─────────────────────────────────────────────
function renderTemplate(templateId, data) {
  const tpl = getTemplate(templateId);
  if (!tpl) throw new Error('Template nicht gefunden: ' + templateId);

  let html;

  // Custom (DB-stored) templates: use html_content directly
  if (tpl.source === 'custom' && tpl.html_content) {
    html = tpl.html_content;

    // Remove ALL external <script src="..."> tags.
    // Framer's CDN bundles re-render the DOM after ~1s and overwrite our
    // placeholder substitutions.  The SSR snapshot is already fully rendered;
    // we only need our own injected script for lead capture.
    html = html.replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>\s*<\/script>/gi, '<!-- ext-script-removed -->');

    // Also remove inline Framer bootstrap / hydration scripts
    // (identified by the presence of known Framer globals in the script body)
    html = html.replace(/<script\b(?![^>]*id\s*=\s*["']__portal_)[^>]*>([\s\S]*?)<\/script>/gi, (match, body) => {
      if (/framersite|__framer|FramerBridge|bootstrap\.[a-f0-9]{10}/.test(body)) {
        return '<!-- framer-inline-removed -->';
      }
      return match;
    });

    // Inject lead capture JS before </body>
    html = html.replace(/<\/body>/i, LEAD_CAPTURE_INJECT + '</body>');
  } else {
    // Static file-based templates
    const tplPath = path.join(__dirname, '../../../public/templates', templateId + '.html');
    if (!fs.existsSync(tplPath)) throw new Error('Template HTML nicht gefunden: ' + templateId);
    html = fs.readFileSync(tplPath, 'utf8');
  }

  // Build form fields HTML (only relevant for static file-based templates)
  const formFields = ((tpl.form_definition || {}).fields || []).map(f => {
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

// ── PUT /api/admin/funnels/:id/fields ────────────────────────────────────────
// Patch/merge specific fields without touching text_slots
router.put('/:id/fields', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });
  const existing = JSON.parse(funnel.fields || '{}');
  const merged = Object.assign(existing, req.body.fields || {});
  db.prepare(`UPDATE funnels SET fields = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(merged), funnel.id);
  res.json({ success: true });
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

// ── Helper: build render data for a funnel ───────────────────────────────────
function buildRenderData(funnel, tpl, slugOverride) {
  const fields    = JSON.parse(funnel.fields    || '{}');
  const textSlots = JSON.parse(funnel.text_slots || '{}');
  const imageSlots= JSON.parse(funnel.image_slots|| '{}');

  // Qualification steps: funnel-specific override → template default → empty
  const qualSteps = fields.__qual_steps || tpl.qualification_steps || [];
  // Contact form fields from template definition
  const formFields = (tpl.form_definition && tpl.form_definition.fields) || [
    { name: 'name',  label: 'Ihr Name',      type: 'text',  required: true  },
    { name: 'phone', label: 'Telefonnummer',  type: 'tel',   required: true  },
    { name: 'email', label: 'E-Mail-Adresse', type: 'email', required: false },
  ];

  return {
    ...fields,
    ...textSlots,
    ...imageSlots,
    FUNNEL_ID:        funnel.id,
    FUNNEL_SLUG:      slugOverride || funnel.slug || '',
    CUSTOMER_ID:      funnel.customer_id,
    CAMPAIGN_ID:      funnel.campaign_id || '',
    privacy_text:     (tpl.form_definition || {}).privacy_text || '',
    danke_headline:   (tpl.thank_you_page  || {}).headline || 'Vielen Dank!',
    danke_text:       (tpl.thank_you_page  || {}).text     || 'Wir melden uns in Kürze.',
    // These get embedded as JSON literals in the injected script
    QUAL_STEPS_JSON:  JSON.stringify(qualSteps),
    FORM_FIELDS_JSON: JSON.stringify(formFields),
  };
}

// ── POST /api/admin/funnels/:id/preview ──────────────────────────────────────
router.post('/:id/preview', requireAdmin, (req, res) => {
  const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!funnel) return res.status(404).json({ error: 'Funnel nicht gefunden' });

  const tpl = getTemplate(funnel.template_id);
  const data = buildRenderData(funnel, tpl);

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
  // Generate slug if not set
  const slug = funnel.slug || uuidv4().split('-')[0] + '-' + funnel.id;
  const data = buildRenderData(funnel, tpl, slug);

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

// ── POST /api/admin/funnels/import/analyze ────────────────────────────────────
// Upload HTML, detect {{placeholders}}, return classified suggestions
const uploadTemplate = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// System placeholders that are handled automatically — don't show to user
const SYSTEM_KEYS = new Set(['FUNNEL_ID','FUNNEL_SLUG','CUSTOMER_ID','CAMPAIGN_ID',
  'FORM_FIELDS','danke_headline','danke_text','privacy_text']);

// Heuristic: guess placeholder type from key name
function guessType(key) {
  const k = key.toLowerCase();
  if (/foto|bild|image|logo|hero|banner|img/.test(k)) return 'image';
  if (/headline|titel|überschrift|header|subheadline|sub_headline/.test(k)) return 'text_ai';
  if (/text|copy|beschreibung|description|benefit|vorteil|vertrauen|cta|button|danke|form/.test(k)) return 'text_ai';
  return 'data';
}

router.post('/import/analyze', requireAdmin, uploadTemplate.single('html'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine HTML-Datei hochgeladen' });

  const html = req.file.buffer.toString('utf8');

  // Find all {{placeholders}} — single level, no #if
  const found = new Set();
  const re = /\{\{([^#/}][^}]*)\}\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const key = m[1].trim();
    if (!SYSTEM_KEYS.has(key)) found.add(key);
  }

  const placeholders = Array.from(found).map(key => ({
    key,
    suggested_type: guessType(key),
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }));

  res.json({
    placeholder_count: placeholders.length,
    has_form_fields: html.includes('{{FORM_FIELDS}}'),
    html_size: html.length,
    placeholders,
  });
});

// ── POST /api/admin/funnels/import/save ──────────────────────────────────────
// Save classified template definition + HTML to DB
router.post('/import/save', requireAdmin, uploadTemplate.single('html'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine HTML-Datei hochgeladen' });

  const { name, category, description, ai_prompt_hint, classifications } = req.body;
  if (!name) return res.status(400).json({ error: 'Template-Name erforderlich' });

  const html = req.file.buffer.toString('utf8');

  let classMap = {};
  try { classMap = JSON.parse(classifications || '{}'); } catch { /* ignore */ }

  // Build template definition from classifications
  const required_fields = [], optional_fields = [], image_slots = [], text_slots = [];

  Object.entries(classMap).forEach(([key, type]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (type === 'data_required') {
      required_fields.push({ key, label, type: 'text', placeholder: '' });
    } else if (type === 'data_optional') {
      optional_fields.push({ key, label, type: 'text', placeholder: '' });
    } else if (type === 'image') {
      image_slots.push({ key, label, description: '', required: false, aspect: 'free' });
    } else if (type === 'text_ai') {
      text_slots.push({ key, label, ai_generated: true, type: 'text', max_chars: 150 });
    } else if (type === 'text_manual') {
      text_slots.push({ key, label, ai_generated: false, type: 'text', max_chars: 150 });
    }
    // 'ignore' → skip
  });

  const template_id = 'custom_' + Date.now();

  const form_definition = {
    headline: 'Jetzt Anfrage stellen',
    fields: [
      { name: 'name',  label: 'Ihr Name',       type: 'text',  required: true,  placeholder: 'Max Mustermann' },
      { name: 'phone', label: 'Telefonnummer',   type: 'tel',   required: true,  placeholder: '+49 ...' },
      { name: 'email', label: 'E-Mail-Adresse',  type: 'email', required: false, placeholder: 'ihre@email.de' },
    ],
    submit_label: 'Anfrage senden',
    privacy_text: 'Ihre Daten werden vertraulich behandelt.',
  };

  const thank_you_page = {
    headline: 'Vielen Dank!',
    text: 'Wir melden uns in Kürze bei Ihnen.',
  };

  try {
    db.prepare(`
      INSERT INTO custom_templates
        (template_id, name, category, description, html_content,
         required_fields, optional_fields, image_slots, text_slots,
         form_definition, thank_you_page, ai_prompt_hint)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      template_id, name, category || 'Custom', description || '',
      html,
      JSON.stringify(required_fields), JSON.stringify(optional_fields),
      JSON.stringify(image_slots), JSON.stringify(text_slots),
      JSON.stringify(form_definition), JSON.stringify(thank_you_page),
      ai_prompt_hint || ''
    );

    res.json({ success: true, template_id, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/admin/funnels/templates/custom/:template_id ──────────────────
router.delete('/templates/custom/:template_id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT id FROM custom_templates WHERE template_id = ?').get(req.params.template_id);
  if (!row) return res.status(404).json({ error: 'Template nicht gefunden' });
  db.prepare('DELETE FROM custom_templates WHERE template_id = ?').run(req.params.template_id);
  res.json({ success: true });
});

// ── GET /api/admin/funnels/templates/custom ───────────────────────────────────
router.get('/templates/custom', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT template_id, name, category, description, created_at FROM custom_templates ORDER BY created_at DESC').all();
  res.json(rows);
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
