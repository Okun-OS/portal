const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');

// GET /api/client/settings
router.get('/', requireClient, (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const customer = db.prepare(`
    SELECT c.id, c.company_name, c.contact_name, c.email, c.phone, c.address, c.industry,
      u.email as login_email
    FROM customers c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(customerId);

  if (!customer) return res.status(404).json({ error: 'Kundendaten nicht gefunden' });
  res.json(customer);
});

// PUT /api/client/settings
router.put('/', requireClient, (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const { contact_name, phone, address } = req.body;

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return res.status(404).json({ error: 'Kundendaten nicht gefunden' });

  db.prepare(`
    UPDATE customers SET
      contact_name = ?, phone = ?, address = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    contact_name || customer.contact_name,
    phone ?? customer.phone,
    address ?? customer.address,
    customerId
  );

  // Also update user name
  if (contact_name && customer.user_id) {
    db.prepare('UPDATE users SET name = ?, updated_at = datetime("now") WHERE id = ?')
      .run(contact_name, customer.user_id);
  }

  res.json({ success: true });
});

module.exports = router;
