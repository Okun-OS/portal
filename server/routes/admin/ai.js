const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const ai = require('../../services/ai');
const { getAllTemplates } = require('../../funnelTemplates');

// POST /api/admin/ai/strategy
router.post('/strategy', requireAdmin, async (req, res) => {
  const { customer_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const { result, campaignContext } = await ai.analyzeStrategy(context);

    if (customer_id) {
      db.prepare(`
        INSERT INTO ai_analyses (customer_id, type, prompt_data, result, created_by)
        VALUES (?, 'strategy', ?, ?, ?)
      `).run(customer_id, JSON.stringify(context), result, req.user.name);
    }

    res.json({ result, campaignContext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/ad-copy
router.post('/ad-copy', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const result = await ai.generateAdCopy(context);

    db.prepare(`
      INSERT INTO ai_analyses (customer_id, campaign_id, type, prompt_data, result, created_by)
      VALUES (?, ?, 'ad_copy', ?, ?, ?)
    `).run(customer_id || null, campaign_id || null, JSON.stringify(context), result, req.user.name);

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/funnel
router.post('/funnel', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const result = await ai.generateFunnelConcept(context);

    db.prepare(`
      INSERT INTO ai_analyses (customer_id, campaign_id, type, prompt_data, result, created_by)
      VALUES (?, ?, 'funnel', ?, ?, ?)
    `).run(customer_id || null, campaign_id || null, JSON.stringify(context), result, req.user.name);

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/optimize
router.post('/optimize', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const result = await ai.generateOptimizationTasks(context);

    db.prepare(`
      INSERT INTO ai_analyses (customer_id, campaign_id, type, prompt_data, result, created_by)
      VALUES (?, ?, 'optimization', ?, ?, ?)
    `).run(customer_id || null, campaign_id || null, JSON.stringify(context), JSON.stringify(result), req.user.name);

    if (result.tasks && Array.isArray(result.tasks) && customer_id) {
      const insert = db.prepare(`
        INSERT INTO optimization_tasks (customer_id, campaign_id, title, description, priority, source)
        VALUES (?, ?, ?, ?, ?, 'ai')
      `);
      for (const t of result.tasks) {
        insert.run(customer_id, campaign_id || null, t.title, t.description, t.priority || 'medium');
      }
    }

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/complete-campaign
router.post('/complete-campaign', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const result = await ai.createCompleteCampaign(context);

    if (customer_id) {
      const saveAnalysis = db.prepare(`
        INSERT INTO ai_analyses (customer_id, campaign_id, type, prompt_data, result, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      saveAnalysis.run(customer_id, campaign_id || null, 'strategy', JSON.stringify(context), result.strategy, req.user.name);
      saveAnalysis.run(customer_id, campaign_id || null, 'ad_copy', JSON.stringify(result.campaignContext), result.adCopy, req.user.name);
      saveAnalysis.run(customer_id, campaign_id || null, 'funnel', JSON.stringify(result.campaignContext), result.funnel, req.user.name);
      if (result.structure) saveAnalysis.run(customer_id, campaign_id || null, 'strategy', JSON.stringify(result.campaignContext), result.structure, req.user.name);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/campaign-planner
router.post('/campaign-planner', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, stadt, budget } = req.body;
  if (!stadt || !budget) return res.status(400).json({ error: 'stadt und budget erforderlich' });

  // Build template descriptions dynamically from DB + static registry
  const templates = getAllTemplates();
  const templateDescriptions = templates.map(t =>
    `- template_id: "${t.template_id}" | Name: "${t.name}" | Kategorie: ${t.category} | ${t.description || ''}`
  ).join('\n');

  try {
    const plan = await ai.generateCampaignPlan({ stadt, budget: Number(budget), templateDescriptions });

    // Auto-save ad creatives to DB
    if (customer_id && plan.ad_creatives && Array.isArray(plan.ad_creatives)) {
      const insert = db.prepare(`
        INSERT INTO ad_creatives (customer_id, campaign_id, type, title, content, status, source)
        VALUES (?, ?, ?, ?, ?, 'draft', 'ai')
      `);
      for (const creative of plan.ad_creatives) {
        const content = `Primary Text:\n${creative.primary_text}\n\nCTA: ${creative.cta}`;
        insert.run(customer_id, campaign_id || null, 'headline', creative.headline, content);
      }
    }

    // Save full plan as ai_analysis
    if (customer_id) {
      db.prepare(`
        INSERT INTO ai_analyses (customer_id, campaign_id, type, prompt_data, result, created_by)
        VALUES (?, ?, 'strategy', ?, ?, ?)
      `).run(customer_id, campaign_id || null,
        JSON.stringify({ stadt, budget }),
        JSON.stringify(plan),
        req.user.name
      );
    }

    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/ai/history
router.get('/history', requireAdmin, (req, res) => {
  const { customer_id, type } = req.query;
  let where = '1=1';
  const params = [];
  if (customer_id) { where += ' AND a.customer_id = ?'; params.push(customer_id); }
  if (type) { where += ' AND a.type = ?'; params.push(type); }

  const rows = db.prepare(`
    SELECT a.id, a.type, a.created_at, a.created_by,
      c.company_name, camp.name as campaign_name,
      substr(a.result, 1, 200) as result_preview
    FROM ai_analyses a
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN campaigns camp ON camp.id = a.campaign_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(...params);

  res.json(rows);
});

router.get('/history/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM ai_analyses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Analyse nicht gefunden' });
  res.json(row);
});

// Ad Creatives CRUD
router.get('/creatives', requireAdmin, (req, res) => {
  const { customer_id, campaign_id } = req.query;
  let where = '1=1';
  const params = [];
  if (customer_id) { where += ' AND ac.customer_id = ?'; params.push(customer_id); }
  if (campaign_id) { where += ' AND ac.campaign_id = ?'; params.push(campaign_id); }

  const rows = db.prepare(`
    SELECT ac.*, c.company_name, camp.name as campaign_name
    FROM ad_creatives ac
    LEFT JOIN customers c ON c.id = ac.customer_id
    LEFT JOIN campaigns camp ON camp.id = ac.campaign_id
    WHERE ${where}
    ORDER BY ac.created_at DESC
  `).all(...params);

  res.json(rows);
});

router.post('/creatives', requireAdmin, (req, res) => {
  const { customer_id, campaign_id, type, title, content, status, source } = req.body;
  if (!customer_id || !type || !title || !content) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  }
  const result = db.prepare(`
    INSERT INTO ad_creatives (customer_id, campaign_id, type, title, content, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, campaign_id || null, type, title, content, status || 'draft', source || 'manual');
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/creatives/:id', requireAdmin, (req, res) => {
  const { title, content, status } = req.body;
  db.prepare('UPDATE ad_creatives SET title = COALESCE(?, title), content = COALESCE(?, content), status = COALESCE(?, status) WHERE id = ?')
    .run(title || null, content || null, status || null, req.params.id);
  res.json({ success: true });
});

router.delete('/creatives/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM ad_creatives WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── POST /api/admin/ai/auto-campaign ─────────────────────────────────────────
// One-click: create campaign + funnel + creatives + strategy + qual questions
router.post('/auto-campaign', requireAdmin, async (req, res) => {
  const { customer_id, campaign_id, name, platform, budget, city, description, target_audience } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id erforderlich' });

  const { getTemplate } = require('../../funnelTemplates');

  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

    // 1. Create or update campaign
    let campId = campaign_id ? parseInt(campaign_id) : null;
    const campName = name || customer.company_name + ' – Kampagne';
    if (!campId) {
      const r = db.prepare(`
        INSERT INTO campaigns (customer_id, name, platform, budget_monthly, description, target_audience, status, wizard_step)
        VALUES (?, ?, ?, ?, ?, ?, 'active', 6)
      `).run(customer_id, campName, platform || null, parseFloat(budget) || 0, description || null, target_audience || null);
      campId = r.lastInsertRowid;
    } else {
      db.prepare(`UPDATE campaigns SET name=?, platform=?, budget_monthly=?, description=?, target_audience=?, wizard_step=6, updated_at=datetime('now') WHERE id=?`)
        .run(campName, platform || null, parseFloat(budget) || 0, description || null, target_audience || null, campId);
    }

    // 2. Pick best template
    const industry = (customer.industry || '').toLowerCase();
    let templateId = 'makler_v1';
    if (/solar|photovoltaik|pv|energie/.test(industry)) templateId = 'solar_v1';
    const customTpl = db.prepare("SELECT template_id FROM custom_templates ORDER BY created_at DESC LIMIT 1").get();
    if (customTpl) templateId = customTpl.template_id;
    const tpl = getTemplate(templateId) || getTemplate('makler_v1');
    if (tpl) templateId = tpl.id || templateId;

    // 3. Create funnel
    const funnelName = campName + ' – Landing Page';
    const fr = db.prepare(`
      INSERT INTO funnels (customer_id, campaign_id, template_id, name, status, fields, text_slots, image_slots)
      VALUES (?, ?, ?, ?, 'draft', '{}', '{}', '{}')
    `).run(customer_id, campId, templateId, funnelName);
    const funnelId = fr.lastInsertRowid;

    // 4. AI: generate everything in one call
    const tplDef = getTemplate(templateId);
    const textSlots = tplDef ? tplDef.text_slots.filter(s => s.ai_generated) : [];
    const aiResult = await ai.generateAutoSetup({
      company: customer.company_name,
      industry: customer.industry || '',
      city: city || customer.address || '',
      budget: parseFloat(budget) || 0,
      platform: platform || 'Meta Ads',
      description: description || '',
      targetAudience: target_audience || '',
      templateTextSlots: textSlots,
    });

    // 5. Fill funnel fields + qual questions + text_slots
    const fields = {
      firmen_name: customer.company_name,
      makler_name: customer.contact_name || customer.company_name,
      stadt: city || customer.address || '',
      region: city || customer.address || '',
      telefon: customer.phone || '',
      email: customer.email || '',
      zielgruppe: aiResult.target_audience || target_audience || '',
      usp: aiResult.usp || '',
      __qual_steps: aiResult.qualification_questions || [],
    };
    db.prepare(`UPDATE funnels SET fields=?, text_slots=?, updated_at=datetime('now') WHERE id=?`)
      .run(JSON.stringify(fields), JSON.stringify(aiResult.text_slots || {}), funnelId);

    // 6. Save ad creatives
    for (const cr of (aiResult.ad_creatives || [])) {
      db.prepare(`INSERT INTO ad_creatives (customer_id, campaign_id, type, title, content, status, source) VALUES (?,?,?,?,?,'draft','ai')`)
        .run(customer_id, campId, cr.type, cr.title, cr.content);
    }

    // 7. Save strategy
    db.prepare(`INSERT INTO ai_analyses (customer_id, campaign_id, type, result, created_by) VALUES (?,?,'strategy',?,'auto-setup')`)
      .run(customer_id, campId, aiResult.strategy);

    res.json({
      campaign_id: campId,
      campaign_name: campName,
      funnel_id: funnelId,
      template_id: templateId,
      strategy: aiResult.strategy,
      ad_creatives: aiResult.ad_creatives || [],
      qualification_questions: aiResult.qualification_questions || [],
    });

  } catch (err) {
    console.error('[auto-campaign]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
