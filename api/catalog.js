const {
  dbConfigured, isAdmin, getCatalog, getProduct,
  upsertCategory, upsertProduct, reorderProducts
} = require('../server/trendou.cjs');

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

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const slug = String(req.query?.slug || '');
      const admin = String(req.query?.admin || '') === '1';
      if (admin && !isAdmin(req)) return json(res, 401, { error: 'Chave de acesso incorreta.' });
      if (slug) {
        const product = await getProduct(slug, admin);
        if (!product) return json(res, 404, { error: 'Produto não encontrado.' });
        return json(res, 200, { product, persistence: dbConfigured() ? 'neon' : 'seed' });
      }
      const data = await getCatalog(admin);
      return json(res, 200, data);
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    if (!isAdmin(req)) return json(res, 401, { error: 'Chave de acesso incorreta.' });
    if (!dbConfigured()) return json(res, 503, { error: 'Banco da Trendou ainda não está conectado neste projeto da Vercel.', code: 'DATABASE_NOT_CONFIGURED' });

    const body = bodyOf(req);
    const action = String(body.action || '');
    if (action === 'upsert_product') {
      const product = await upsertProduct(body.product || {});
      return json(res, 200, { ok: true, product });
    }
    if (action === 'upsert_category') {
      const category = await upsertCategory(body.category || {});
      return json(res, 200, { ok: true, category });
    }
    if (action === 'reorder_products') {
      if (!Array.isArray(body.slugs)) return json(res, 400, { error: 'Lista inválida.' });
      await reorderProducts(body.slugs);
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'Ação desconhecida.' });
  } catch (error) {
    console.error('catalog_error', error);
    return json(res, 500, { error: 'Não foi possível processar o catálogo.' });
  }
};
