const nodemailer = require('nodemailer');

// Lazy-load DB to avoid circular dependency at startup
function getSettings() {
  try {
    const db = require('../db');
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch {
    return {};
  }
}

function createTransport(s) {
  const user = s.smtp_user || process.env.SMTP_USER;
  const pass = s.smtp_pass || process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: s.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(s.smtp_port || process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass },
  });
}

function buildSignatureHtml(s) {
  const companyName = s.company_name || 'Okun Leads';
  const phone = s.company_phone || '';
  const website = s.company_website || '';
  const customLine = s.sig_custom_line || '';
  const logoPos = s.sig_logo_position || 'top';
  const logoAlign = s.sig_logo_align || 'left';
  const portalUrl = s.portal_url || '';
  const logoUrl = s.logo_url
    ? (s.portal_url ? s.portal_url.replace(/\/$/, '') + s.logo_url.split('?')[0] : '')
    : '';

  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="height:36px;width:auto;display:block">`
    : '';

  const textLines = [
    `<strong style="color:#1f2937;font-size:14px">${companyName}</strong>`,
    phone ? `Tel: <a href="tel:${phone}" style="color:#4f46e5">${phone}</a>` : '',
    website ? `<a href="${website}" style="color:#4f46e5">${website}</a>` : '',
    customLine,
  ].filter(Boolean).join('<br>');

  const textBlock = `<div style="font-size:13px;color:#6b7280;line-height:1.7">${textLines}</div>`;

  const alignStyle = `text-align:${logoAlign}`;

  if (!logoImg) return `<div style="${alignStyle}">${textBlock}</div>`;

  if (logoPos === 'top') return `<div style="${alignStyle}">${logoImg}<div style="margin-top:8px">${textBlock}</div></div>`;
  if (logoPos === 'bottom') return `<div style="${alignStyle}">${textBlock}<div style="margin-top:8px">${logoImg}</div></div>`;
  if (logoPos === 'left') return `<table style="border-collapse:collapse"><tr><td style="padding-right:14px;vertical-align:middle">${logoImg}</td><td style="vertical-align:middle">${textBlock}</td></tr></table>`;
  if (logoPos === 'right') return `<table style="border-collapse:collapse"><tr><td style="vertical-align:middle;padding-right:14px">${textBlock}</td><td style="vertical-align:middle">${logoImg}</td></tr></table>`;
  return `<div style="${alignStyle}">${logoImg}<div style="margin-top:8px">${textBlock}</div></div>`;
}

async function sendWelcomeEmail({ customer, loginEmail, password }) {
  const s = getSettings();
  const transport = createTransport(s);
  if (!transport) return { skipped: true, reason: 'SMTP not configured' };

  const companyName = s.company_name || 'Okun Leads';
  const portalUrl = s.portal_url || '';
  const logoUrl = s.logo_url
    ? (portalUrl ? portalUrl.replace(/\/$/, '') + s.logo_url.split('?')[0] : '')
    : '';
  const sig = buildSignatureHtml(s);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px 0}
  .wrap{max-width:560px;margin:0 auto}
  .header{background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0}
  .header img{height:44px;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto}
  .header h1{color:#fff;font-size:22px;margin:0;font-weight:700}
  .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
  .body{background:#fff;padding:36px 40px}
  p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 14px}
  .cred-box{background:#f8f9ff;border:2px solid #e0e7ff;border-radius:10px;padding:20px 24px;margin:24px 0}
  .cred-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-bottom:14px}
  .cred-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #e0e7ff}
  .cred-row:last-child{border-bottom:none}
  .cred-label{color:#6b7280;font-size:13px}
  .cred-value{font-weight:700;color:#1f2937;font-family:monospace;font-size:14px}
  .btn{display:block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff !important;text-decoration:none;padding:15px 28px;border-radius:9px;font-weight:700;font-size:15px;text-align:center;margin:24px 0}
  .note{font-size:12px;color:#9ca3af;background:#f9fafb;border-radius:8px;padding:12px 16px}
  .footer{background:#f9fafb;padding:24px 40px;border-radius:0 0 12px 12px;border-top:1px solid #f3f4f6}
  a{color:#2563eb}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}">` : ''}
    <h1>Willkommen bei ${companyName}!</h1>
    <p>Ihr persönliches Kunden-Portal ist jetzt bereit.</p>
  </div>
  <div class="body">
    <p>Hallo <strong>${customer.contact_name}</strong>,</p>
    <p>wir freuen uns, Sie als Kunden begrüßen zu dürfen. Über Ihr persönliches Portal können Sie jederzeit den Stand Ihrer Kampagnen, neue Leads und alle Dokumente einsehen.</p>
    <div class="cred-box">
      <div class="cred-title">Ihre Zugangsdaten</div>
      ${portalUrl ? `<div class="cred-row"><span class="cred-label">Portal</span><span class="cred-value">${portalUrl}</span></div>` : ''}
      <div class="cred-row"><span class="cred-label">E-Mail</span><span class="cred-value">${loginEmail}</span></div>
      <div class="cred-row"><span class="cred-label">Passwort</span><span class="cred-value">${password}</span></div>
    </div>
    ${portalUrl ? `<a href="${portalUrl}/client/" class="btn">&#x2192;&nbsp; Jetzt zum Portal</a>` : ''}
    <p class="note">&#x1F512; Aus Sicherheitsgründen empfehlen wir, das Passwort nach der ersten Anmeldung zu ändern.</p>
  </div>
  <div class="footer">${sig}</div>
</div>
</body></html>`;

  const fromName = companyName;
  const fromAddr = s.smtp_from || s.smtp_user || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to: `"${customer.contact_name}" <${customer.email}>`,
    subject: `Ihr Zugang zum Kunden-Portal – ${companyName}`,
    html,
  });

  return { sent: true };
}

async function sendTestEmail(to) {
  const s = getSettings();
  const transport = createTransport(s);
  if (!transport) throw new Error('SMTP nicht konfiguriert. Bitte zuerst E-Mail-Einstellungen speichern.');

  const sig = buildSignatureHtml(s);
  const companyName = s.company_name || 'Okun Leads';

  await transport.sendMail({
    from: `"${companyName}" <${s.smtp_from || s.smtp_user}>`,
    to,
    subject: `Test-E-Mail von ${companyName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:20px auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:10px">
      <h2 style="color:#1f2937;margin-top:0">✅ E-Mail-Versand funktioniert!</h2>
      <p style="color:#6b7280">Diese Test-E-Mail wurde von ${companyName} über die konfigurierten SMTP-Einstellungen versendet.</p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0">
      ${sig}
    </div>`,
  });
}

module.exports = { sendWelcomeEmail, sendTestEmail, createTransport, getSettings, buildSignatureHtml };
