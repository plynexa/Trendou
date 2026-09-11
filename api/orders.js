const { dbConfigured, isAdmin, listOrders, updateOrder } = require('../server/trendou.cjs');

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
    if (!isAdmin(req)) return json(res, 401, { error: 'Chave de acesso incorreta.' });
    if (!dbConfigured()) return json(res, 503, { error: 'Banco da Trendou ainda não está conectado neste projeto.', code: 'DATABASE_NOT_CONFIGURED' });

    if (req.method === 'GET') {
      const orders = await listOrders(Number(req.query?.limit || 100));
      return json(res, 200, { orders });
    }
    if (req.method === 'POST') {
      const body = bodyOf(req);
      await updateOrder(body);
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    console.error('orders_error', error);
    return json(res, 500, { error: 'Não foi possível processar os pedidos.' });
  }
};
