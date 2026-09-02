const QONTO_BASE = 'https://thirdparty.qonto.com/v2';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://essentia-services.fr',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const appSecret = process.env.PIN_GERANT_QONTO;
  const provided = event.headers['x-app-secret'] || event.headers['X-App-Secret'];
  if (!appSecret || !provided || provided !== appSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const slug = process.env.QONTO_ORG_SLUG;
  const secret = process.env.QONTO_SECRET_KEY;
  if (!slug || !secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Config Qonto manquante (QONTO_ORG_SLUG / QONTO_SECRET_KEY)' }) };
  }
  const authHeader = `${slug}:${secret}`;

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const { fileBase64, fileName, mimeType, transactionId } = payload;
  if (!fileBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fileBase64 manquant' }) };
  }

  const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length > MAX_FILE_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Fichier trop volumineux (max 8 Mo)' }) };
  }

  const type = mimeType || 'image/jpeg';
  const name = fileName || `justificatif_${Date.now()}.jpg`;

  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), name);

  const idempotencyKey =
    (globalThis.crypto && globalThis.crypto.randomUUID && globalThis.crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const url = transactionId
    ? `${QONTO_BASE}/transactions/${encodeURIComponent(transactionId)}/attachments`
    : `${QONTO_BASE}/attachments`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'X-Qonto-Idempotency-Key': idempotencyKey,
      },
      body: form,
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Erreur Qonto', detail: data }) };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': 'https://essentia-services.fr', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, attachedToTransaction: !!transactionId, data }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
