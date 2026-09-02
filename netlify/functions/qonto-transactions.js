// Proxy Qonto API — liste les transactions sans pièce jointe
// Protégé par X-App-Secret vérifié contre process.env.APP_SECRET
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = (event.headers['x-app-secret'] || '').trim();
  if (!secret || secret !== process.env.PIN_GERANT_QONTO) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Non autorisé' }),
    };
  }

  const ORG_SLUG  = process.env.QONTO_ORG_SLUG;
  const SECRET_KEY = process.env.QONTO_SECRET_KEY;
  if (!ORG_SLUG || !SECRET_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Variables QONTO_ORG_SLUG / QONTO_SECRET_KEY manquantes' }),
    };
  }

  try {
    const resp = await fetch(
      'https://thirdparty.qonto.com/v2/transactions?filters[status]=completed&per_page=100',
      {
        headers: {
          Authorization: `${ORG_SLUG}:${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.message || 'Erreur API Qonto' }),
      };
    }

    // Ne conserver que les transactions sans pièce jointe existante
    const transactions = (data.transactions || []).filter(
      tx => !tx.attachment_ids || tx.attachment_ids.length === 0
    );

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
