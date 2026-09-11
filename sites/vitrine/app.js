(() => {
  const money = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const productsEl = document.getElementById('products');
  const featuredEl = document.getElementById('featured');
  const filtersEl = document.getElementById('filters');
  const statusEl = document.getElementById('catalog-status');
  const template = document.getElementById('product-template');
  let catalog = {products:[],categories:[]};
  let activeCategory = 'todos';

  function actionUrls(product){
    const detail = product.public_url || `/produto/${encodeURIComponent(product.slug)}`;
    let buy = `/checkout/${encodeURIComponent(product.slug)}`;
    if(product.checkout_mode === 'external' && product.checkout_url) buy = product.checkout_url;
    if(product.checkout_mode === 'affiliate' && product.checkout_url) buy = product.checkout_url;
    return {detail,buy};
  }

  function card(product){
    const node = template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector('img');
    img.src = product.image_url || 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#151515"/><text x="50%" y="50%" fill="#d7a632" font-size="48" font-family="Arial" text-anchor="middle">TRENDOU</text></svg>');
    img.alt = product.name;
    node.querySelector('.badge').textContent = product.type === 'affiliate' ? 'Afiliado' : product.type === 'dropshipping' ? 'Produto físico' : 'Trendou';
    const cat = catalog.categories.find(c=>c.slug===product.category_slug)?.name || product.category_slug;
    node.querySelector('.category').textContent = cat || 'Produto';
    node.querySelector('h3').textContent = product.name;
    node.querySelector('.description').textContent = product.description || '';
    const del = node.querySelector('del');
    if(product.old_price && Number(product.old_price) > Number(product.price)) del.textContent = money(product.old_price); else del.remove();
    node.querySelector('.price strong').textContent = money(product.price);
    const actions = node.querySelector('.card-actions');
    const {detail,buy} = actionUrls(product);
    const view = document.createElement('a');
    view.href = detail; view.textContent = 'Ver produto';
    if(/^https?:\/\//.test(detail)) view.target = '_blank';
    const buyLink = document.createElement('a');
    buyLink.href = buy; buyLink.textContent = product.checkout_mode === 'affiliate' ? 'Ver oferta' : 'Comprar'; buyLink.className='primary';
    if(product.checkout_mode === 'affiliate' || /^https?:\/\//.test(buy)) { buyLink.target='_blank'; if(product.checkout_mode === 'affiliate') buyLink.rel='sponsored nofollow noopener'; }
    actions.append(view,buyLink);
    return node;
  }

  function render(){
    productsEl.replaceChildren();
    featuredEl.replaceChildren();
    const visible = catalog.products.filter(p=>p.active!==false && (activeCategory==='todos' || p.category_slug===activeCategory));
    if(!visible.length) productsEl.innerHTML='<div class="empty">Nenhum produto nesta categoria ainda.</div>';
    visible.forEach(p=>productsEl.append(card(p)));
    const featured = catalog.products.filter(p=>p.active!==false && p.featured).slice(0,8);
    if(!featured.length) featuredEl.innerHTML='<div class="empty">As ofertas em destaque aparecerão aqui.</div>';
    featured.forEach(p=>featuredEl.append(card(p)));
  }

  function renderFilters(){
    filtersEl.replaceChildren();
    const all=[{slug:'todos',name:'Todos'},...catalog.categories.filter(c=>c.active!==false)];
    all.forEach(c=>{
      const b=document.createElement('button'); b.type='button'; b.className='filter'+(activeCategory===c.slug?' active':''); b.textContent=c.name;
      b.onclick=()=>{activeCategory=c.slug;renderFilters();render();};
      filtersEl.append(b);
    });
  }

  fetch('/api/catalog',{cache:'no-store'})
    .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar catálogo');return d;})
    .then(data=>{catalog=data;statusEl.remove();renderFilters();render();})
    .catch(err=>{statusEl.textContent='Não foi possível carregar o catálogo agora. '+err.message;});
  document.getElementById('year').textContent=new Date().getFullYear();
})();
