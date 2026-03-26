const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');
const ai = require('../../services/ai');

// POST /api/client/explain – generate friendly explanation of own stats
router.post('/', requireClient, async (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const newLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE customer_id = ? AND date(created_at) >= ?").get(customerId, weekAgo).c;
    const prevWeekLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE customer_id = ? AND date(created_at) >= ? AND date(created_at) < ?").get(customerId, twoWeeksAgo, weekAgo).c;
    const totalLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE customer_id = ?").get(customerId).c;
    const contacted = db.prepare("SELECT COUNT(*) as c FROM leads WHERE customer_id = ? AND status = 'contacted'").get(customerId).c;
    const closed = db.prepare("SELECT COUNT(*) as c FROM leads WHERE customer_id = ? AND status = 'closed'").get(customerId).c;
    const campaign = db.prepare("SELECT status FROM campaigns WHERE customer_id = ? AND status = 'active' LIMIT 1").get(customerId);

    let weeklyChange = 'genauso viele wie letzte Woche';
    if (newLeads > prevWeekLeads) weeklyChange = `${newLeads - prevWeekLeads} mehr als letzte Woche`;
    if (newLeads < prevWeekLeads) weeklyChange = `${prevWeekLeads - newLeads} weniger als letzte Woche`;

    const explanation = await ai.explainForClient({
      company: customer.company_name,
      newLeads,
      totalLeads,
      contacted,
      closed,
      campaignStatus: campaign ? 'aktiv' : 'keine aktive Kampagne',
      weeklyChange
    });

    // Save to analyses with type 'explain' (no internal data exposed)
    db.prepare(`
      INSERT INTO ai_analyses (customer_id, type, result, created_by)
      VALUES (?, 'explain', ?, 'system')
    `).run(customerId, explanation);

    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
