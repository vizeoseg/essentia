// netlify/functions/qonto-invoice.js
//
// Reçoit les données d'une facture Essentia et la pousse vers Qonto
// (Plateforme Agréée) :
//   1. Cherche si le client existe déjà côté Qonto (par email)
//   2. Le crée sinon (POST /v2/clients)
//   3. Crée la facture (POST /v2/client_invoices), en statut "draft" par défaut
//
// Variables d'environnement Netlify requises :
//   APP_SECRET, QONTO_ORG_SLUG, QONTO_SECRET_KEY (déjà configurées)
//   QONTO_IBAN — IBAN du compte Qonto à afficher comme moyen de paiement

const QONTO_BASE = 'https://thirdparty.qonto.com/v2';

async function qontoFetch(path, authHeader, options = {}) {
  const res = await fetch(`${QONTO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function findOrCreateClient(authHeader, clientInfo) {
  // 1) Recherche parmi les clients existants (pagination simple, jusqu'à 5 pages)
  if (clientInfo.email) {
    let page = 1;
    while (page <= 5) {
      const { ok, data } = await qontoFetch(`/clients?per_page=100&current_page=${page}`, authHeader);
      if (!ok) break;
      const list = data.clients || [];
      const match = list.find((c) => (c.email || '').toLowerCase() === clientInfo.email.toLowerCase());
      if (match) {
        // Client déjà connu de Qonto : on rafraîchit ses infos (adresse, SIREN...)
        // à chaque appel, sinon une facture peut échouer si ces infos manquaient
        // lors de sa toute première création.
        const updatePayload = {
          billing_address: {
            street_address: clientInfo.address || undefined,
            city: clientInfo.city || undefined,
            zip_code: clientInfo.zipCode || undefined,
            country_code: clientInfo.countryCode || 'FR',
          },
          tax_identification_number: clientInfo.siren || undefined,
          vat_number: clientInfo.vatNumber || undefined,
        };
        Object.keys(updatePayload.billing_address).forEach(
          (k) => updatePayload.billing_address[k] === undefined && delete updatePayload.billing_address[k]
        );
        Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k]);
        await qontoFetch(`/clients/${match.id}`, authHeader, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        });
        return { id: match.id, created: false };
      }
      const meta = data.meta || {};
      if (!meta.next_page) break;
      page++;
    }
  }

  // 2) Création si non trouvé
  const payload = {
    kind: 'company',
    name: clientInfo.name || 'Client',
    email: clientInfo.email || undefined,
    address: clientInfo.address || undefined,
    city: clientInfo.city || undefined,
    zip_code: clientInfo.zipCode || undefined,
    country_code: clientInfo.countryCode || 'FR',
    currency: 'EUR',
    locale: 'fr',
    vat_number: clientInfo.vatNumber || undefined,
    tax_identification_number: clientInfo.siren || undefined,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const created = await qontoFetch('/clients', authHeader, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!created.ok) {
    throw new Error(`Création client Qonto échouée: ${JSON.stringify(created.data)}`);
  }
  return { id: created.data.client.id, created: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const appSecret = process.env.APP_SECRET;
  const provided = event.headers['x-app-secret'] || event.headers['X-App-Secret'];
  if (!appSecret || !provided || provided !== appSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const slug = process.env.QONTO_ORG_SLUG;
  const secret = process.env.QONTO_SECRET_KEY;
  const iban = process.env.QONTO_IBAN;
  if (!slug || !secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Config Qonto manquante (QONTO_ORG_SLUG / QONTO_SECRET_KEY)' }) };
  }
  if (!iban) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Config Qonto manquante (QONTO_IBAN)' }) };
  }
  const authHeader = `${slug}:${secret}`;

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const { client, items, issueDate, dueDate, number, status } = payload;
  if (!client || !client.name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'client.name manquant' }) };
  }
  if (!Array.isArray(items) || !items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'items manquant ou vide' }) };
  }
  if (!issueDate || !dueDate) {
    return { statusCode: 400, body: JSON.stringify({ error: 'issueDate / dueDate manquants' }) };
  }

  const allowedStatus = ['draft', 'unpaid'];
  const finalStatus = allowedStatus.includes(status) ? status : 'draft';

  try {
    const { id: clientId } = await findOrCreateClient(authHeader, client);

    const invoicePayload = {
      client_id: clientId,
      issue_date: issueDate,
      due_date: dueDate,
      currency: 'EUR',
      status: finalStatus,
      payment_methods: { iban },
      items: items.map((it) => ({
        title: (it.title || it.desc || 'Prestation').slice(0, 40),
        quantity: String(it.quantity ?? it.qte ?? 1),
        unit_price: { value: String(it.unitPrice ?? it.prixUnit ?? 0), currency: 'EUR' },
        vat_rate: String(it.vatRate ?? 0),
      })),
    };
    if (number) invoicePayload.number = number;

    const invoiceRes = await qontoFetch('/client_invoices', authHeader, {
      method: 'POST',
      body: JSON.stringify(invoicePayload),
    });

    if (!invoiceRes.ok) {
      return { statusCode: invoiceRes.status, body: JSON.stringify({ error: 'Erreur création facture Qonto', detail: invoiceRes.data }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoice: invoiceRes.data.client_invoice }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
