// Proxy Resend API — évite les erreurs CORS côté navigateur
// Le HTML de l'email est construit ici côté serveur depuis le texte brut
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'RESEND_API_KEY non configurée dans les variables Netlify' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Corps JSON invalide' }),
    };
  }

  const { to, cc, subject, text, attachments } = payload;

  if (!to || !subject) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Champs manquants : to, subject' }),
    };
  }

  // Construction HTML côté serveur
  const lines = (text || '').split('\n');
  const bodyLines = lines
    .map(l => `<p style="margin:0 0 10px;font-size:14px;color:#333;">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '&nbsp;'}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
  <div style="background:#1a2e4a;padding:24px 30px;">
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:bold;">Essentia Services</h1>
  </div>
  <div style="padding:30px 30px 20px;">
    ${bodyLines}
  </div>
  <div style="background:#f5f7fa;padding:16px 30px;text-align:center;font-size:11px;color:#888;border-top:1px solid #e5e7eb;">
    Essentia Services — contact@essentia-services.fr
  </div>
</div>
</body></html>`;

  const resendBody = {
    from: 'Essentia Services <contact@essentia-services.fr>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || '',
  };

  if (cc) resendBody.reply_to = Array.isArray(cc) ? cc[0] : cc;
  if (attachments && attachments.length > 0) {
    resendBody.attachments = attachments;
    console.log('[send-email] PJ:', attachments.map(a => `${a.filename} (${Math.round((a.content||'').length/1024)}KB)`));
  }

  console.log('[send-email] Envoi → ', Array.isArray(to) ? to[0] : to, '|', subject);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendBody),
    });

    const data = await res.json();
    console.log('[send-email] Resend réponse:', res.status, data);

    return {
      statusCode: res.status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[send-email] Erreur fetch Resend:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
