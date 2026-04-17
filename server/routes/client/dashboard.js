const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');

// GET /api/client/dashboard
router.get('/', requireClient, (req, res) => {
  let customerId = req.user.customerId;
  if (!customerId && req.user.id) {
    const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    customerId = customer ? customer.id : null;
  }
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE customer_id = ?').get(customerId).count;
  const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE customer_id = ? AND status = 'new'").get(customerId).count;
  const leadsThisMonth = db.prepare('SELECT COUNT(*) as count FROM leads WHERE customer_id = ? AND date(created_at) >= ?').get(customerId, monthStart).count;
  const openLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE customer_id = ? AND status IN ('new','contacted','appointment')").get(customerId).count;

  const activeCampaign = db.prepare("SELECT * FROM campaigns WHERE customer_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(customerId);

  const recentLeads = db.prepare(`
    SELECT id, name, phone, email, region, status, created_at
    FROM leads WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(customerId);

  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads WHERE customer_id = ? GROUP BY status
  `).all(customerId);

  res.json({
    stats: { totalLeads, newLeads, leadsThisMonth, openLeads },
    activeCampaign,
    recentLeads,
    statusBreakdown
  });
});

module.exports = router;
