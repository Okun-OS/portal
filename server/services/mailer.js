const nodemailer = require('nodemailer');

function createTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass },
  });
}

async function sendWelcomeEmail({ customer, loginEmail, password }) {
  const transport = createTransport();
  if (!transport) return { skipped: true, reason: 'SMTP not configured' };

  const companyName = process.env.COMPANY_NAME || 'Okun Leads';
  const companyPhone = process.env.COMPANY_PHONE || '';
  const companyWebsite = process.env.COMPANY_WEBSITE || '';
  const portalUrl = process.env.PORTAL_URL || 'https://ihr-portal.de';
  const logoUrl = process.env.LOGO_URL || '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px 0}
  .wrap{max-width:560px;margin:0 auto}
  .header{background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0}
  .header img{height:44px;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto}
  .header h1{color:#fff;font-size:22px;margin:0;font-weight:700}
  .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px}
  .body{background:#fff;padding:36px 40px}
  p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 14px}
  .cred-box{background:#f8f9ff;border:2px solid #e0e7ff;border-radius:10px;padding:20px 24px;margin:24px 0}
  .cred-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-bottom:14px}
  .cred-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e0e7ff}
  .cred-row:last-child{border-bottom:none}
  .cred-label{color:#6b7280;font-size:13px}
  .cred-value{font-weight:700;color:#1f2937;font-family:monospace;font-size:14px}
  .btn{display:block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff !important;text-decoration:none;padding:15px 28px;border-radius:9px;font-weight:700;font-size:15px;text-align:center;margin:24px 0}
  .note{font-size:12px;color:#9ca3af;background:#f9fafb;border-radius:8px;padding:12px 16px;margin-top:8px}
  .footer{background:#f9fafb;padding:24px 40px;border-radius:0 0 12px 12px;border-top:1px solid #f3f4f6}
  .sig{font-size:13px;color:#6b7280;line-height:1.8}
  .sig strong{color:#1f2937;font-size:14px}
  a{color:#4f46e5}
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
    <p>wir freuen uns, Sie als Kunden begrüßen zu dürfen. Ab sofort können Sie in Ihrem persönlichen Portal jederzeit den aktuellen Stand Ihrer Kampagnen, neue Leads und alle Dokumente einsehen.</p>

    <div class="cred-box">
      <div class="cred-title">Ihre Zugangsdaten</div>
      <div class="cred-row"><span class="cred-label">Portal-Adresse</span><span class="cred-value">${portalUrl}</span></div>
      <div class="cred-row"><span class="cred-label">E-Mail</span><span class="cred-value">${loginEmail}</span></div>
      <div class="cred-row"><span class="cred-label">Passwort</span><span class="cred-value">${password}</span></div>
    </div>

    <a href="${portalUrl}/client/" class="btn">&#x2192;&nbsp; Jetzt zum Portal</a>

    <p class="note">&#x1F512; Aus Sicherheitsgründen empfehlen wir, Ihr Passwort nach der ersten Anmeldung zu ändern. Gehen Sie dafür unter Einstellungen &rarr; Passwort ändern.</p>
  </div>
  <div class="footer">
    <div class="sig">
      <strong>${companyName}</strong><br>
      ${companyPhone ? `Tel: <a href="tel:${companyPhone}">${companyPhone}</a><br>` : ''}
      ${companyWebsite ? `<a href="${companyWebsite}">${companyWebsite}</a>` : ''}
    </div>
  </div>
</div>
</body></html>`;

  await transport.sendMail({
    from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: `"${customer.contact_name}" <${customer.email}>`,
    subject: `Ihr Zugang zum Kunden-Portal – ${companyName}`,
    html,
  });

  return { sent: true };
}

module.exports = { sendWelcomeEmail, createTransport };
