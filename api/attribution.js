const { neon } = require('@neondatabase/serverless');

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
const sameOrigin = req => {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
};
const validIdentifier = value => /^[a-zA-Z0-9-]{8,100}$/.test(String(value || ''));
const validVisitId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const clean = (value, max = 160, fallback = 'nao-informado') => {
  const text = String(value || '').trim().slice(0, max);
  return text || fallback;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Origem não permitida.' });
  if (!process.env.DATABASE_URL) return json(res, 503, { error: 'Banco não configurado.' });
  if (Number(req.headers['content-length'] || 0) > 4096) return json(res, 413, { error: 'Payload muito grande.' });

  const body = bodyOf(req);
  const identifier = String(body.identifier || '').trim();
  const input = body.attribution || {};
  if (!validIdentifier(identifier)) return json(res, 400, { error: 'Identificador inválido.' });
  if (!validVisitId(input.visit_id)) return json(res, 400, { error: 'Visita inválida.' });

  const attribution = {
    visit_id: input.visit_id,
    source: clean(input.source),
    campaign: clean(input.campaign),
    creative: clean(input.creative),
    medium: clean(input.medium),
    term: clean(input.term),
    fbclid: clean(input.fbclid, 500, '')
  };

  try {
    const sql = neon(process.env.DATABASE_URL);
    const order = await sql`SELECT identifier FROM trendou_orders
      WHERE identifier=${identifier} AND created_at > now() - interval '30 minutes'
      LIMIT 1`;
    if (!order.length) return json(res, 404, { error: 'Pedido não encontrado ou janela de atribuição expirada.' });
    await sql`INSERT INTO trendou_order_attribution
      (identifier,visit_id,source,campaign,creative,medium,term,fbclid)
      VALUES (${identifier},${attribution.visit_id},${attribution.source},${attribution.campaign},${attribution.creative},${attribution.medium},${attribution.term},${attribution.fbclid})
      ON CONFLICT (identifier) DO NOTHING`;
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('attribution_error', error);
    return json(res, 503, { error: 'Não foi possível salvar a atribuição.' });
  }
};
