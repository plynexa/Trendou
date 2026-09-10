const { createHash, timingSafeEqual } = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const hash = s => createHash('sha256').update(String(s)).digest();
const allowedSections = ['inicio','rotina','material','receitas','exemplos','bonus','como-usar','oferta','duvidas','final'];
function normalize(b) {
 if (!b || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id)) throw Error('invalid');
 const label = v => typeof v === 'string' && /^[a-zA-Z0-9_. -]{1,80}$/.test(v) ? v : 'nao-informado';
 const integer = (n,max) => { if (!Number.isInteger(n)||n<0||n>max) throw Error('invalid'); return n; };
 if (!Array.isArray(b.sections)||!Array.isArray(b.clicks)||b.sections.length>10||b.clicks.length>30) throw Error('invalid');
 return {id:b.id,source:label(b.source),campaign:label(b.campaign),creative:label(b.creative),
 device:['celular','tablet','computador'].includes(b.device)?b.device:'computador',
 active:integer(b.active,7200),scroll:integer(b.scroll,100),
 sections:[...new Set(b.sections.filter(x=>allowedSections.includes(x)))],
 clicks:[...new Set(b.clicks.filter(x=>typeof x==='string' && /^(checkout-(inicio|exemplos|oferta|final|fixo)|ancora-(inicio|receitas|oferta|duvidas|conteudo)|faq-[1-8])$/.test(x)))]};
}
async function handler(req,res) {
 res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
 const action = String(req.query?.action || '');
 const configured = process.env.ANALYTICS_ENABLED === 'true' && !!process.env.DATABASE_URL && (process.env.ANALYTICS_ADMIN_KEY||'').length >=32;
 if (req.method==='GET' && action==='status') return res.status(200).json({enabled:configured});
 if (!configured) return res.status(503).json({error:'Métricas ainda não ativadas. Conecte o banco e configure o acesso na Vercel.'});
 const sql = neon(process.env.DATABASE_URL);
 try {
  if (req.method==='POST' && action==='collect') {
   if (req.headers.origin !== (process.env.ANALYTICS_ORIGIN || 'https://trendou-airfryer.vercel.app')) return res.status(403).json({error:'Origem não permitida.'});
   if (Number(req.headers['content-length']||0)>4096) return res.status(413).end();
   let b; try { const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body); if(!raw||Buffer.byteLength(raw)>4096) return res.status(413).end(); b=normalize(JSON.parse(raw)); } catch { return res.status(400).json({error:'Dados inválidos.'}); }
   const checkout=b.clicks.some(x=>x.startsWith('checkout-'));
   await sql`INSERT INTO trendou_visits (id,source,campaign,creative,device,active_seconds,scroll,sections,clicks,checkout)
    VALUES (${b.id},${b.source},${b.campaign},${b.creative},${b.device},${b.active},${b.scroll},${JSON.stringify(b.sections)}::jsonb,${JSON.stringify(b.clicks)}::jsonb,${checkout})
    ON CONFLICT(id) DO UPDATE SET updated_at=now(), active_seconds=GREATEST(trendou_visits.active_seconds,EXCLUDED.active_seconds),
    scroll=GREATEST(trendou_visits.scroll,EXCLUDED.scroll),
    sections=(SELECT coalesce(jsonb_agg(DISTINCT x),'[]') FROM jsonb_array_elements(trendou_visits.sections || EXCLUDED.sections) x),
    clicks=(SELECT coalesce(jsonb_agg(DISTINCT x),'[]') FROM jsonb_array_elements(trendou_visits.clicks || EXCLUDED.clicks) x),
    checkout=trendou_visits.checkout OR EXCLUDED.checkout, updates=trendou_visits.updates+1
    WHERE trendou_visits.updates<300 AND trendou_visits.created_at>now()-interval '3 hours'`;
   return res.status(204).end();
  }
  if (req.method!=='GET'||action!=='report') return res.status(405).json({error:'Método não permitido.'});
  if (!timingSafeEqual(hash(req.headers.authorization||''),hash('Bearer '+process.env.ANALYTICS_ADMIN_KEY))) return res.status(401).json({error:'Chave de acesso incorreta.'});
  const days = [1,7,30,90].includes(Number(req.query.days))?Number(req.query.days):7;
  // Retention is applied on each authenticated report; schedule the same DELETE daily for unattended retention.
  await sql`DELETE FROM trendou_visits WHERE created_at<now()-interval '90 days'`;
  const [totals, sources, sections, clicks, recent] = await sql.transaction([
   sql`SELECT count(*)::int visits,coalesce(round(avg(active_seconds)),0)::int active_seconds,
    coalesce(round(avg(scroll)),0)::int scroll,count(*) FILTER(WHERE checkout)::int checkout
    FROM trendou_visits WHERE created_at>=now()-make_interval(days=>${days})`,
   sql`SELECT source,campaign,creative,count(*)::int visits,count(*) FILTER(WHERE checkout)::int checkout
    FROM trendou_visits WHERE created_at>=now()-make_interval(days=>${days}) GROUP BY source,campaign,creative ORDER BY visits DESC LIMIT 100`,
   sql`SELECT section,count(*)::int visits FROM trendou_visits,jsonb_array_elements_text(sections) section
    WHERE created_at>=now()-make_interval(days=>${days}) GROUP BY section ORDER BY visits DESC`,
   sql`SELECT click,count(*)::int visits FROM trendou_visits,jsonb_array_elements_text(clicks) click
    WHERE created_at>=now()-make_interval(days=>${days}) GROUP BY click ORDER BY visits DESC`,
   sql`SELECT id,created_at,source,creative,device,active_seconds,scroll,sections,clicks,checkout
    FROM trendou_visits WHERE created_at>=now()-make_interval(days=>${days}) ORDER BY created_at DESC LIMIT 100`
  ]);
  return res.status(200).json({totals:totals[0],sources,sections,clicks,recent,days});
 } catch { return res.status(503).json({error:'Não foi possível acessar as métricas. Confira a conexão e a tabela do banco.'}); }
}
module.exports={handler,normalize};
