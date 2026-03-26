const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

// GET /api/admin/tasks
router.get('/', requireAdmin, (req, res) => {
  const { customer_id, status } = req.query;
  let where = '1=1';
  const params = [];
  if (customer_id) { where += ' AND t.customer_id = ?'; params.push(customer_id); }
  if (status) { where += ' AND t.status = ?'; params.push(status); }

  const tasks = db.prepare(`
    SELECT t.*, c.company_name, camp.name as campaign_name
    FROM optimization_tasks t
    LEFT JOIN customers c ON c.id = t.customer_id
    LEFT JOIN campaigns camp ON camp.id = t.campaign_id
    WHERE ${where}
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.created_at DESC
  `).all(...params);

  res.json(tasks);
});

// POST /api/admin/tasks
router.post('/', requireAdmin, (req, res) => {
  const { customer_id, campaign_id, title, description, priority, source } = req.body;
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' });

  const result = db.prepare(`
    INSERT INTO optimization_tasks (customer_id, campaign_id, title, description, priority, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    customer_id || null,
    campaign_id || null,
    title,
    description || null,
    priority || 'medium',
    source || 'manual'
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/admin/tasks/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { title, description, priority, status } = req.body;
  const task = db.prepare('SELECT * FROM optimization_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task nicht gefunden' });

  db.prepare(`
    UPDATE optimization_tasks SET
      title = ?, description = ?, priority = ?, status = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? task.title,
    description ?? task.description,
    priority ?? task.priority,
    status ?? task.status,
    task.id
  );

  res.json({ success: true });
});

// DELETE /api/admin/tasks/:id
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM optimization_tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
