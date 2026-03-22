const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

const uploadDir = path.join(__dirname, '../../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/admin/documents
router.get('/', requireAdmin, (req, res) => {
  const { customer_id, type } = req.query;
  let where = '1=1';
  let params = [];

  if (customer_id) { where += ' AND d.customer_id = ?'; params.push(customer_id); }
  if (type) { where += ' AND d.type = ?'; params.push(type); }

  const docs = db.prepare(`
    SELECT d.*, c.company_name
    FROM documents d
    LEFT JOIN customers c ON c.id = d.customer_id
    WHERE ${where}
    ORDER BY d.created_at DESC
  `).all(...params);

  res.json(docs);
});

// POST /api/admin/documents/upload
router.post('/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  const { customer_id, type, title, amount, status, due_date } = req.body;
  if (!customer_id || !type || !title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Kunde, Typ und Titel erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO documents (customer_id, type, title, filename, filepath, amount, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, type, title,
    req.file.originalname,
    '/uploads/' + req.file.filename,
    amount || null,
    status || 'draft',
    due_date || null
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Dokument hochgeladen' });
});

// POST /api/admin/documents/generate-invoice
router.post('/generate-invoice', requireAdmin, (req, res) => {
  const { customer_id, title, invoice_number, items, due_date, notes } = req.body;

  if (!customer_id || !title || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Kunde, Titel und Positionen erforderlich' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

  const filename = `rechnung-${invoice_number || Date.now()}.pdf`;
  const filepath = path.join(uploadDir, filename);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('RECHNUNG', { align: 'right' });
  doc.fontSize(10).font('Helvetica').text(`Rechnungsnummer: ${invoice_number || 'R-' + Date.now()}`, { align: 'right' });
  doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'right' });
  if (due_date) doc.text(`Fällig am: ${new Date(due_date).toLocaleDateString('de-DE')}`, { align: 'right' });

  doc.moveDown(2);

  // Customer address
  doc.font('Helvetica-Bold').text(customer.company_name);
  doc.font('Helvetica').text(customer.contact_name);
  if (customer.address) doc.text(customer.address);
  doc.text(customer.email);

  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  // Items table header
  doc.font('Helvetica-Bold');
  doc.text('Beschreibung', 50, doc.y, { width: 280 });
  doc.text('Menge', 330, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
  doc.text('Einzelpreis', 395, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  doc.text('Gesamt', 475, doc.y - doc.currentLineHeight(), { width: 75, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  // Items
  let subtotal = 0;
  doc.font('Helvetica');
  for (const item of items) {
    const total = (item.quantity || 1) * (item.unit_price || 0);
    subtotal += total;
    const y = doc.y;
    doc.text(item.description || '-', 50, y, { width: 280 });
    doc.text(String(item.quantity || 1), 330, y, { width: 60, align: 'right' });
    doc.text(formatCurrency(item.unit_price || 0), 395, y, { width: 80, align: 'right' });
    doc.text(formatCurrency(total), 475, y, { width: 75, align: 'right' });
    doc.moveDown();
  }

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  const vat = subtotal * 0.19;
  const total = subtotal + vat;

  doc.text(`Netto: ${formatCurrency(subtotal)}`, { align: 'right' });
  doc.text(`MwSt. 19%: ${formatCurrency(vat)}`, { align: 'right' });
  doc.font('Helvetica-Bold').text(`Gesamt: ${formatCurrency(total)}`, { align: 'right' });

  if (notes) {
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).text(notes);
  }

  doc.end();

  stream.on('finish', () => {
    const result = db.prepare(`
      INSERT INTO documents (customer_id, type, title, filename, filepath, amount, status, due_date)
      VALUES (?, 'invoice', ?, ?, ?, ?, 'sent', ?)
    `).run(customer_id, title, filename, '/uploads/' + filename, total, due_date || null);

    res.status(201).json({ id: result.lastInsertRowid, filename, amount: total });
  });
});

// PUT /api/admin/documents/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { status, title, amount, due_date } = req.body;
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });

  db.prepare('UPDATE documents SET status = COALESCE(?, status), title = COALESCE(?, title), amount = COALESCE(?, amount), due_date = COALESCE(?, due_date) WHERE id = ?')
    .run(status || null, title || null, amount || null, due_date || null, doc.id);

  res.json({ success: true });
});

// DELETE /api/admin/documents/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Dokument nicht gefunden' });

  const filePath = path.join(__dirname, '../../../public', doc.filepath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ success: true });
});

function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

module.exports = router;
