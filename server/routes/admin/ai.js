const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const ai = require('../../services/ai');

// POST /api/admin/ai/strategy
router.post('/strategy', requireAdmin, async (req, res) => {
  const { customer_id, context } = req.body;
  if (!context) return res.status(400).json({ error: 'Kontext erforderlich' });

  try {
    const result = await ai.analyzeStrategy(context);

    if (customer_id) {
      db.prepare(`
        INSERT INTO ai_analyses (customer_id, type, prompt_data, result, created_by)
        VALUES (?, 'strategy', ?, ?, ?)
      `).run(customer_id, JSON.stringify(context), result, req.user.name);
    }

    res.json({ result });
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

    // Auto-create tasks if tasks array exists
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

// GET /api/admin/ai/history?customer_id=&type=
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

// GET /api/admin/ai/history/:id  – full result
router.get('/history/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM ai_analyses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Analyse nicht gefunden' });
  res.json(row);
});

// Ad Creatives CRUD
// GET /api/admin/ai/creatives?customer_id=
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

// POST /api/admin/ai/creatives
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

// PUT /api/admin/ai/creatives/:id
router.put('/creatives/:id', requireAdmin, (req, res) => {
  const { title, content, status } = req.body;
  db.prepare('UPDATE ad_creatives SET title = COALESCE(?, title), content = COALESCE(?, content), status = COALESCE(?, status) WHERE id = ?')
    .run(title || null, content || null, status || null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/ai/creatives/:id
router.delete('/creatives/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM ad_creatives WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
