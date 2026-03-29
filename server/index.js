require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', require('./routes/auth'));

// Admin routes
app.use('/api/admin/customers', require('./routes/admin/customers'));
app.use('/api/admin/leads', require('./routes/admin/leads'));
app.use('/api/admin/campaigns', require('./routes/admin/campaigns'));
app.use('/api/admin/documents', require('./routes/admin/documents'));
app.use('/api/admin/metrics', require('./routes/admin/metrics'));
app.use('/api/admin/tasks', require('./routes/admin/tasks'));
app.use('/api/admin/ai', require('./routes/admin/ai'));
app.use('/api/admin/integrations', require('./routes/admin/integrations'));

// Webhooks (public – no auth, optional secret)
app.use('/api/webhooks', require('./routes/webhooks'));

// Admin stats
const { requireAdmin } = require('./middleware/auth');
const db = require('./db');

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get().count;
  const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'").get().count;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const leadsThisMonth = db.prepare('SELECT COUNT(*) as count FROM leads WHERE date(created_at) >= ?').get(monthStart).count;

  const leadsByStatus = db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all();
  const recentLeads = db.prepare(`
    SELECT l.id, l.name, l.status, l.created_at, c.company_name
    FROM leads l LEFT JOIN customers c ON c.id = l.customer_id
    ORDER BY l.created_at DESC LIMIT 10
  `).all();

  res.json({ totalCustomers, totalLeads, newLeads, activeCampaigns, leadsThisMonth, leadsByStatus, recentLeads });
});

// Client routes
app.use('/api/client/dashboard', require('./routes/client/dashboard'));
app.use('/api/client/leads', require('./routes/client/leads'));
app.use('/api/client/campaigns', require('./routes/client/campaigns'));
app.use('/api/client/documents', require('./routes/client/documents'));
app.use('/api/client/settings', require('./routes/client/settings'));
app.use('/api/client/explain', require('./routes/client/explain'));

// SPA fallback – serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Lead Management Portal läuft auf http://localhost:${PORT}`);
  console.log(`   Admin:  ${process.env.ADMIN_EMAIL || 'admin@leadportal.com'}`);
  console.log(`   Pass:   ${process.env.ADMIN_PASSWORD || 'Admin123!'}\n`);

  // Auto-sync Google & Meta every 3 hours
  const googleAds = require('./services/googleAds');
  const metaAds = require('./services/metaAds');

  async function autoSync() {
    const now = new Date().toLocaleTimeString('de-DE');
    try {
      await googleAds.syncAllCampaigns();
      console.log(`[${now}] Auto-Sync Google Ads: OK`);
    } catch (e) {
      console.log(`[${now}] Auto-Sync Google Ads: ${e.message}`);
    }
    try {
      await metaAds.syncAllCampaigns();
      console.log(`[${now}] Auto-Sync Meta Ads: OK`);
    } catch (e) {
      console.log(`[${now}] Auto-Sync Meta Ads: ${e.message}`);
    }
  }

  // Run once after 30s on startup, then every 3 hours
  setTimeout(autoSync, 30 * 1000);
  setInterval(autoSync, 3 * 60 * 60 * 1000);
});
