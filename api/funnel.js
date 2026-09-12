const { neon } = require('@neondatabase/serverless');
const { dbConfigured, isAdmin } = require('../server/trendou.cjs');

const PAID = ['completed','paid','approved','succeeded'];
const json = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
};
const num = value => Number(value || 0);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  if (!isAdmin(req)) return json(res, 401, { error: 'Chave de acesso incorreta.' });
  if (!dbConfigured()) return json(res, 503, { error: 'Banco da Trendou ainda não está conectado.' });

  const days = [1,7,30,90].includes(Number(req.query?.days)) ? Number(req.query.days) : 7;
  const sql = neon(process.env.DATABASE_URL);

  try {
    const [visitTotals, orderTotals, grouped] = await sql.transaction([
      sql`SELECT
        count(*)::int AS visits,
        count(*) FILTER (WHERE checkout)::int AS checkout_clicks
      FROM trendou_visits
      WHERE created_at >= now() - make_interval(days => ${days})`,
      sql`SELECT
        count(*)::int AS pix_generated,
        count(*) FILTER (WHERE lower(coalesce(payment_status,'')) = ANY(${PAID}))::int AS paid_orders,
        coalesce(sum(amount) FILTER (WHERE lower(coalesce(payment_status,'')) = ANY(${PAID})),0)::numeric AS revenue
      FROM trendou_orders
      WHERE created_at >= now() - make_interval(days => ${days})`,
      sql`WITH visits AS (
        SELECT source,campaign,creative,
          count(*)::int AS visits,
          count(*) FILTER (WHERE checkout)::int AS checkout_clicks
        FROM trendou_visits
        WHERE created_at >= now() - make_interval(days => ${days})
        GROUP BY source,campaign,creative
      ), orders AS (
        SELECT a.source,a.campaign,a.creative,
          count(*)::int AS pix_generated,
          count(*) FILTER (WHERE lower(coalesce(o.payment_status,'')) = ANY(${PAID}))::int AS paid_orders,
          coalesce(sum(o.amount) FILTER (WHERE lower(coalesce(o.payment_status,'')) = ANY(${PAID})),0)::numeric AS revenue
        FROM trendou_order_attribution a
        JOIN trendou_orders o ON o.identifier=a.identifier
        WHERE o.created_at >= now() - make_interval(days => ${days})
        GROUP BY a.source,a.campaign,a.creative
      )
      SELECT
        coalesce(v.source,o.source,'nao-informado') AS source,
        coalesce(v.campaign,o.campaign,'nao-informado') AS campaign,
        coalesce(v.creative,o.creative,'nao-informado') AS creative,
        coalesce(v.visits,0)::int AS visits,
        coalesce(v.checkout_clicks,0)::int AS checkout_clicks,
        coalesce(o.pix_generated,0)::int AS pix_generated,
        coalesce(o.paid_orders,0)::int AS paid_orders,
        coalesce(o.revenue,0)::numeric AS revenue
      FROM visits v
      FULL OUTER JOIN orders o USING (source,campaign,creative)
      ORDER BY coalesce(o.paid_orders,0) DESC, coalesce(o.pix_generated,0) DESC, coalesce(v.visits,0) DESC
      LIMIT 200`
    ]);

    const totals = {
      visits: num(visitTotals[0]?.visits),
      checkout_clicks: num(visitTotals[0]?.checkout_clicks),
      pix_generated: num(orderTotals[0]?.pix_generated),
      paid_orders: num(orderTotals[0]?.paid_orders),
      revenue: num(orderTotals[0]?.revenue)
    };
    totals.checkout_rate = totals.visits ? totals.checkout_clicks / totals.visits : 0;
    totals.pix_rate = totals.visits ? totals.pix_generated / totals.visits : 0;
    totals.purchase_rate = totals.visits ? totals.paid_orders / totals.visits : 0;

    return json(res, 200, {
      days,
      totals,
      creatives: grouped.map(row => ({
        source: row.source,
        campaign: row.campaign,
        creative: row.creative,
        visits: num(row.visits),
        checkout_clicks: num(row.checkout_clicks),
        pix_generated: num(row.pix_generated),
        paid_orders: num(row.paid_orders),
        revenue: num(row.revenue)
      }))
    });
  } catch (error) {
    console.error('funnel_error', error);
    return json(res, 503, { error: 'Não foi possível consultar o funil de conversão.' });
  }
};
