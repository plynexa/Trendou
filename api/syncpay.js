const {
  dbConfigured, getProduct, createOrder, updateOrderPayment
} = require('../server/trendou.cjs');

const API_BASE = 'https://api.syncpayments.com.br/api/partner/v1';
let cachedToken = '';
let cachedUntil = 0;

const json = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
};
const bodyOf = req => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
};
const digits = (value, max = 20) => String(value || '').replace(/\D/g, '').slice(0, max);
const text = (value, max = 200) => String(value || '').trim().slice(0, max);
const emailOk = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const configured = () => Boolean(process.env.SYNCPAY_CLIENT_ID && process.env.SYNCPAY_CLIENT_SECRET);

async function getToken(force = false) {
  if (!configured()) throw new Error('syncpay_not_configured');
  if (!force && cachedToken && Date.now() < cachedUntil - 60000) return cachedToken;
  const response = await fetch(`${API_BASE}/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SYNCPAY_CLIENT_ID,
      client_secret: process.env.SYNCPAY_CLIENT_SECRET
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error(data.error_description || data.message || 'Falha na autenticação SyncPay.');
    error.status = response.status;
    throw error;
  }
  cachedToken = data.access_token;
  cachedUntil = Date.now() + Math.max(300, Number(data.expires_in || 3600)) * 1000;
  return cachedToken;
}

async function syncFetch(path, options = {}, retry = true) {
  const token = await getToken(false);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 401 && retry) {
    cachedToken = '';
    cachedUntil = 0;
    await getToken(true);
    return syncFetch(path, options, false);
  }
  return response;
}

async function transaction(identifier) {
  const response = await syncFetch(`/transaction/${encodeURIComponent(identifier)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Não foi possível consultar a transação.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  const tx = data.data || data;
  if (tx?.status) await updateOrderPayment(identifier, tx.status);
  return tx;
}

function requestBaseUrl(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwarded || 'https';
  return `${proto}://${req.headers.host}`;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

module.exports = async function handler(req, res) {
  try {
    const action = String(req.query?.action || '');

    if (req.method === 'GET' && action === 'status') {
      return json(res, 200, {
        configured: configured(),
        database: dbConfigured(),
        mode: 'pix',
        provider: 'SyncPay'
      });
    }

    if (req.method === 'GET' && action === 'transaction') {
      if (!configured()) return json(res, 503, { error: 'SyncPay ainda não está configurada.' });
      const identifier = text(req.query?.identifier, 100);
      if (!/^[a-zA-Z0-9-]{8,100}$/.test(identifier)) return json(res, 400, { error: 'Identificador inválido.' });
      try {
        const tx = await transaction(identifier);
        return json(res, 200, {
          identifier,
          status: tx.status || 'unknown',
          completed: String(tx.status || '').toLowerCase() === 'completed',
          amount: tx.amount == null ? null : Number(tx.amount)
        });
      } catch (error) {
        return json(res, error.status || 502, { error: error.message });
      }
    }

    if (req.method === 'POST' && action === 'webhook') {
      // Nunca confia no status enviado pelo webhook: consulta a SyncPay novamente pelo identifier.
      const body = bodyOf(req);
      const identifier = text(
        body.identifier || body.reference_id || body?.data?.identifier || body?.data?.reference_id || body?.transaction?.reference_id,
        100
      );
      if (identifier && configured()) {
        try { await transaction(identifier); } catch (error) { console.warn('syncpay_webhook_verify_failed', identifier, error.message); }
      }
      return res.status(204).end();
    }

    if (req.method !== 'POST' || action !== 'create-pix') return json(res, 405, { error: 'Método não permitido.' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'Origem não permitida.' });
    if (!configured()) return json(res, 503, { error: 'Credenciais da SyncPay não configuradas na Vercel.' });

    const body = bodyOf(req);
    const product = await getProduct(text(body.product_slug, 80), true);
    if (!product || product.active === false) return json(res, 404, { error: 'Produto não encontrado.' });
    if (product.type === 'affiliate' || product.checkout_mode === 'affiliate') return json(res, 400, { error: 'Produtos afiliados não usam o checkout da Trendou.' });
    if (!(Number(product.price) >= 1)) return json(res, 400, { error: 'Preço inválido para cobrança.' });

    const customer = {
      name: text(body.customer?.name, 120),
      cpf: digits(body.customer?.cpf, 11),
      email: text(body.customer?.email, 160).toLowerCase(),
      phone: digits(body.customer?.phone, 13)
    };
    if (customer.name.length < 3 || customer.cpf.length !== 11 || !emailOk(customer.email) || customer.phone.length < 10) {
      return json(res, 422, { error: 'Confira nome, CPF, e-mail e telefone.' });
    }

    const shipping = product.shipping_required ? {
      zip: digits(body.shipping?.zip, 8),
      street: text(body.shipping?.street, 160),
      number: text(body.shipping?.number, 30),
      complement: text(body.shipping?.complement, 100),
      neighborhood: text(body.shipping?.neighborhood, 100),
      city: text(body.shipping?.city, 100),
      state: text(body.shipping?.state, 2).toUpperCase()
    } : {};
    if (product.shipping_required && (!shipping.zip || !shipping.street || !shipping.number || !shipping.city || shipping.state.length !== 2)) {
      return json(res, 422, { error: 'Preencha o endereço de entrega completo.' });
    }
    if (product.shipping_required && !dbConfigured()) {
      return json(res, 503, { error: 'O banco precisa estar conectado antes de aceitar pedidos físicos.', code: 'DATABASE_REQUIRED_FOR_SHIPPING' });
    }

    const payload = {
      amount: Number(Number(product.price).toFixed(2)),
      description: `${product.name} - Trendou`,
      webhook_url: `${requestBaseUrl(req)}/api/syncpay?action=webhook`,
      client: customer
    };
    const response = await syncFetch('/cash-in', { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.pix_code || !data.identifier) {
      console.error('syncpay_cashin_error', response.status, data);
      return json(res, response.status || 502, { error: data.message || 'Não foi possível gerar o Pix.', details: data.errors || undefined });
    }

    const orderId = await createOrder({ identifier: data.identifier, product, customer, shipping });
    return json(res, 200, {
      ok: true,
      identifier: data.identifier,
      pix_code: data.pix_code,
      order_id: orderId,
      amount: Number(product.price),
      product: { slug: product.slug, name: product.name },
      database: dbConfigured()
    });
  } catch (error) {
    console.error('syncpay_error', error);
    if (error.message === 'syncpay_not_configured') return json(res, 503, { error: 'Credenciais da SyncPay não configuradas.' });
    return json(res, error.status || 500, { error: error.message || 'Falha inesperada no checkout.' });
  }
};
