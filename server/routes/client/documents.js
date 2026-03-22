const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');

// GET /api/client/documents
router.get('/', requireClient, (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const { type } = req.query;
  let where = 'customer_id = ?';
  let params = [customerId];

  if (type) { where += ' AND type = ?'; params.push(type); }

  const docs = db.prepare(`
    SELECT id, type, title, filename, filepath, amount, status, due_date, created_at
    FROM documents WHERE ${where} ORDER BY created_at DESC
  `).all(...params);

  res.json(docs);
});

module.exports = router;
