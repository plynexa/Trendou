const { createHash, timingSafeEqual, randomUUID } = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

const seedCategories = [
  { slug: 'receitas', name: 'Receitas', sort_order: 10, active: true },
  { slug: 'casa-cozinha', name: 'Casa & Cozinha', sort_order: 20, active: true },
  { slug: 'ofertas', name: 'Ofertas', sort_order: 30, active: true }
];

const seedProducts = [
  {
    slug: 'air-fryer',
    name: 'Air Fryer Todo Dia',
    description: '150 receitas práticas para Air Fryer + 3 bônus em PDF.',
    type: 'digital',
    category_slug: 'receitas',
    price: 29.90,
    old_price: 49.90,
    image_url: '/air-fryer/assets/capa-air-fryer.jpg',
    public_url: 'https://trendou-airfryer.vercel.app',
    checkout_mode: 'external',
    checkout_url: 'https://syncpaycheckout.com/checkout/a2af02d3-cefc-4eca-9de3-74ecdf742cb5+a2af0bd1-ff00-456a-8ba7-90187614c134',
    supplier_url: '',
    featured: true,
    active: true,
    sort_order: 10,
    shipping_required: false,
    benefits: ['150 receitas organizadas', 'Tabela de tempo e temperatura', 'Cardápio de 30 dias', 'Lista de compras base']
  }
];

const dbConfigured = () => Boolean(process.env.DATABASE_URL);
const adminSecret = () => process.env.TRENDOU_ADMIN_KEY || process.env.ANALYTICS_ADMIN_KEY || '';
const hash = value => createHash('sha256').update(String(value)).digest();
function isAdmin(req) {
  const secret = adminSecret();
  if (secret.length < 32) return false;
  return timingSafeEqual(hash(req.headers.authorization || ''), hash(`Bearer ${secret}`));
}
function sqlClient() {
  if (!dbConfigured()) return null;
  return neon(process.env.DATABASE_URL);
}
let schemaReady = false;
async function ensureSchema() {
  if (!dbConfigured() || schemaReady) return;
  const sql = sqlClient();
  await sql`CREATE TABLE IF NOT EXISTS trendou_categories (
    slug text PRIMARY KEY,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS trendou_products (
    slug text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'digital',
    category_slug text NOT NULL DEFAULT 'ofertas',
    price numeric(12,2) NOT NULL DEFAULT 0,
    old_price numeric(12,2),
    image_url text NOT NULL DEFAULT '',
    public_url text NOT NULL DEFAULT '',
    checkout_mode text NOT NULL DEFAULT 'native',
    checkout_url text NOT NULL DEFAULT '',
    supplier_url text NOT NULL DEFAULT '',
    featured boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    shipping_required boolean NOT NULL DEFAULT false,
    benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS trendou_orders (
    id text PRIMARY KEY,
    identifier text UNIQUE,
    product_slug text NOT NULL,
    product_name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    customer jsonb NOT NULL DEFAULT '{}'::jsonb,
    shipping jsonb NOT NULL DEFAULT '{}'::jsonb,
    payment_method text NOT NULL DEFAULT 'pix',
    payment_status text NOT NULL DEFAULT 'pending',
    fulfillment_status text NOT NULL DEFAULT 'pending',
    tracking_code text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  for (const category of seedCategories) {
    await sql`INSERT INTO trendou_categories (slug,name,sort_order,active)
      VALUES (${category.slug},${category.name},${category.sort_order},${category.active})
      ON CONFLICT (slug) DO NOTHING`;
  }
  for (const product of seedProducts) {
    await sql`INSERT INTO trendou_products
      (slug,name,description,type,category_slug,price,old_price,image_url,public_url,checkout_mode,checkout_url,supplier_url,featured,active,sort_order,shipping_required,benefits)
      VALUES (${product.slug},${product.name},${product.description},${product.type},${product.category_slug},${product.price},${product.old_price},${product.image_url},${product.public_url},${product.checkout_mode},${product.checkout_url},${product.supplier_url},${product.featured},${product.active},${product.sort_order},${product.shipping_required},${JSON.stringify(product.benefits)}::jsonb)
      ON CONFLICT (slug) DO NOTHING`;
  }
  schemaReady = true;
}
function normalizeProduct(row, includePrivate = false) {
  const product = {
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    type: row.type || 'digital',
    category_slug: row.category_slug || 'ofertas',
    price: Number(row.price || 0),
    old_price: row.old_price == null ? null : Number(row.old_price),
    image_url: row.image_url || '',
    public_url: row.public_url || '',
    checkout_mode: row.checkout_mode || 'native',
    checkout_url: row.checkout_url || '',
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sort_order: Number(row.sort_order || 0),
    shipping_required: Boolean(row.shipping_required),
    benefits: Array.isArray(row.benefits) ? row.benefits : []
  };
  if (includePrivate) product.supplier_url = row.supplier_url || '';
  return product;
}
async function getCatalog(includePrivate = false) {
  if (!dbConfigured()) {
    return {
      persistence: 'seed',
      categories: seedCategories,
      products: seedProducts.map(p => includePrivate ? { ...p } : normalizeProduct(p, false))
    };
  }
  await ensureSchema();
  const sql = sqlClient();
  const [categories, products] = await Promise.all([
    sql`SELECT slug,name,sort_order,active FROM trendou_categories ORDER BY sort_order,name`,
    includePrivate
      ? sql`SELECT * FROM trendou_products ORDER BY sort_order,name`
      : sql`SELECT slug,name,description,type,category_slug,price,old_price,image_url,public_url,checkout_mode,checkout_url,featured,active,sort_order,shipping_required,benefits FROM trendou_products WHERE active=true ORDER BY sort_order,name`
  ]);
  return { persistence: 'neon', categories, products: products.map(p => normalizeProduct(p, includePrivate)) };
}
async function getProduct(slug, includePrivate = false) {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(slug || ''))) return null;
  if (!dbConfigured()) {
    const p = seedProducts.find(x => x.slug === slug);
    return p ? (includePrivate ? { ...p } : normalizeProduct(p, false)) : null;
  }
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`SELECT * FROM trendou_products WHERE slug=${slug} LIMIT 1`;
  if (!rows[0] || (!includePrivate && !rows[0].active)) return null;
  return normalizeProduct(rows[0], includePrivate);
}
function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function normalizeSlug(value) {
  return cleanText(value, 80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
async function upsertCategory(input) {
  if (!dbConfigured()) throw new Error('database_not_configured');
  await ensureSchema();
  const sql = sqlClient();
  const slug = normalizeSlug(input.slug || input.name);
  if (!slug) throw new Error('invalid_category');
  const name = cleanText(input.name, 80);
  if (!name) throw new Error('invalid_category');
  const sort = Number.isFinite(Number(input.sort_order)) ? Math.trunc(Number(input.sort_order)) : 0;
  const active = input.active !== false;
  await sql`INSERT INTO trendou_categories (slug,name,sort_order,active)
    VALUES (${slug},${name},${sort},${active})
    ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order,active=EXCLUDED.active,updated_at=now()`;
  return { slug, name, sort_order: sort, active };
}
async function upsertProduct(input) {
  if (!dbConfigured()) throw new Error('database_not_configured');
  await ensureSchema();
  const sql = sqlClient();
  const slug = normalizeSlug(input.slug || input.name);
  if (!slug) throw new Error('invalid_product');
  const name = cleanText(input.name, 120);
  if (!name) throw new Error('invalid_product');
  const allowedTypes = ['digital','dropshipping','affiliate','proprio'];
  const type = allowedTypes.includes(input.type) ? input.type : 'digital';
  const category = normalizeSlug(input.category_slug || 'ofertas') || 'ofertas';
  const price = Math.max(0, Number(input.price || 0));
  const oldPriceRaw = input.old_price === '' || input.old_price == null ? null : Number(input.old_price);
  const oldPrice = Number.isFinite(oldPriceRaw) ? Math.max(0, oldPriceRaw) : null;
  const allowedCheckout = ['native','external','affiliate'];
  const checkoutMode = allowedCheckout.includes(input.checkout_mode) ? input.checkout_mode : (type === 'affiliate' ? 'affiliate' : 'native');
  const benefits = Array.isArray(input.benefits) ? input.benefits.map(v => cleanText(v,120)).filter(Boolean).slice(0,12) : [];
  const values = {
    slug, name,
    description: cleanText(input.description, 1200),
    type, category_slug: category, price, old_price: oldPrice,
    image_url: cleanText(input.image_url, 500),
    public_url: cleanText(input.public_url, 500),
    checkout_mode: checkoutMode,
    checkout_url: cleanText(input.checkout_url, 500),
    supplier_url: cleanText(input.supplier_url, 1000),
    featured: Boolean(input.featured), active: input.active !== false,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Math.trunc(Number(input.sort_order)) : 0,
    shipping_required: Boolean(input.shipping_required || type === 'dropshipping'), benefits
  };
  await sql`INSERT INTO trendou_products
    (slug,name,description,type,category_slug,price,old_price,image_url,public_url,checkout_mode,checkout_url,supplier_url,featured,active,sort_order,shipping_required,benefits)
    VALUES (${values.slug},${values.name},${values.description},${values.type},${values.category_slug},${values.price},${values.old_price},${values.image_url},${values.public_url},${values.checkout_mode},${values.checkout_url},${values.supplier_url},${values.featured},${values.active},${values.sort_order},${values.shipping_required},${JSON.stringify(values.benefits)}::jsonb)
    ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,type=EXCLUDED.type,category_slug=EXCLUDED.category_slug,price=EXCLUDED.price,old_price=EXCLUDED.old_price,image_url=EXCLUDED.image_url,public_url=EXCLUDED.public_url,checkout_mode=EXCLUDED.checkout_mode,checkout_url=EXCLUDED.checkout_url,supplier_url=EXCLUDED.supplier_url,featured=EXCLUDED.featured,active=EXCLUDED.active,sort_order=EXCLUDED.sort_order,shipping_required=EXCLUDED.shipping_required,benefits=EXCLUDED.benefits,updated_at=now()`;
  return values;
}
async function reorderProducts(slugs) {
  if (!dbConfigured()) throw new Error('database_not_configured');
  await ensureSchema();
  const sql = sqlClient();
  let order = 10;
  for (const slug of slugs.map(normalizeSlug).filter(Boolean).slice(0,200)) {
    await sql`UPDATE trendou_products SET sort_order=${order},updated_at=now() WHERE slug=${slug}`;
    order += 10;
  }
}
async function createOrder({ identifier, product, customer, shipping }) {
  if (!dbConfigured()) return null;
  await ensureSchema();
  const sql = sqlClient();
  const id = randomUUID();
  await sql`INSERT INTO trendou_orders (id,identifier,product_slug,product_name,amount,customer,shipping,payment_method,payment_status)
    VALUES (${id},${identifier},${product.slug},${product.name},${product.price},${JSON.stringify(customer)}::jsonb,${JSON.stringify(shipping || {})}::jsonb,'pix','pending')
    ON CONFLICT (identifier) DO NOTHING`;
  return id;
}
async function updateOrderPayment(identifier, status) {
  if (!dbConfigured() || !identifier) return;
  await ensureSchema();
  const sql = sqlClient();
  await sql`UPDATE trendou_orders SET payment_status=${cleanText(status,40)},updated_at=now() WHERE identifier=${identifier}`;
}
async function listOrders(limit = 100) {
  if (!dbConfigured()) return [];
  await ensureSchema();
  const sql = sqlClient();
  const n = Math.max(1, Math.min(200, Number(limit) || 100));
  return sql`SELECT id,identifier,product_slug,product_name,amount,customer,shipping,payment_method,payment_status,fulfillment_status,tracking_code,notes,created_at,updated_at FROM trendou_orders ORDER BY created_at DESC LIMIT ${n}`;
}
async function updateOrder(input) {
  if (!dbConfigured()) throw new Error('database_not_configured');
  await ensureSchema();
  const sql = sqlClient();
  const id = cleanText(input.id,80);
  if (!id) throw new Error('invalid_order');
  const fulfillment = cleanText(input.fulfillment_status || 'pending',40);
  const tracking = cleanText(input.tracking_code,160);
  const notes = cleanText(input.notes,1000);
  await sql`UPDATE trendou_orders SET fulfillment_status=${fulfillment},tracking_code=${tracking},notes=${notes},updated_at=now() WHERE id=${id}`;
}

module.exports = {
  seedCategories, seedProducts, dbConfigured, adminSecret, isAdmin, ensureSchema,
  getCatalog, getProduct, upsertCategory, upsertProduct, reorderProducts,
  createOrder, updateOrderPayment, listOrders, updateOrder, normalizeSlug
};
