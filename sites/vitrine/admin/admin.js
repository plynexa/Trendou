(() => {
  const $=id=>document.getElementById(id);
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  let token=''; let localMode=false; let catalog={products:[],categories:[],persistence:'seed'}; let orders=[]; let currentSlug='';

  const localKey='trendou_builder_catalog_v1';
  const authHeaders=()=> token ? {Authorization:'Bearer '+token,'Content-Type':'application/json'} : {'Content-Type':'application/json'};
  const slugify=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);

  async function api(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options,headers:{...(options.headers||{}),...(token?{Authorization:'Bearer '+token}:{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw Object.assign(Error(data.error||'Falha na operação'),{status:response.status,code:data.code});
    return data;
  }
  function localCatalog(){try{return JSON.parse(localStorage.getItem(localKey)||'null');}catch{return null;}}
  function saveLocal(){localStorage.setItem(localKey,JSON.stringify({products:catalog.products,categories:catalog.categories,persistence:'local'}));catalog.persistence='local';updateMetrics();}

  async function loadCatalog(){
    if(localMode){const saved=localCatalog();if(saved){catalog=saved;}else{catalog=await api('/api/catalog');catalog.persistence='local';saveLocal();}renderAll();return;}
    catalog=await api('/api/catalog?admin=1');renderAll();
  }
  async function loadOrders(){
    if(localMode){orders=[];renderOrders();return;}
    try{const data=await api('/api/orders');orders=data.orders||[];}catch(e){orders=[];$('orders-list').innerHTML='<p class="muted">'+e.message+'</p>';}renderOrders();updateMetrics();
  }

  function renderAll(){renderProducts();renderCategories();renderSites();fillCategorySelect();updateMetrics();}
  function updateMetrics(){
    $('metric-products').textContent=catalog.products.filter(p=>p.active!==false).length;
    $('metric-categories').textContent=catalog.categories.filter(c=>c.active!==false).length;
    $('metric-orders').textContent=localMode?'—':String(orders.length||0);
    $('mode-badge').textContent=localMode?'Modo local':'Nuvem · '+(catalog.persistence||'');
  }

  function renderProducts(){
    const root=$('product-list');root.replaceChildren();
    const sorted=[...catalog.products].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name));
    if(!sorted.length){root.innerHTML='<div class="panel muted">Nenhum produto cadastrado.</div>';return;}
    sorted.forEach(p=>{
      const row=document.createElement('article');row.className='product-row';row.draggable=true;row.dataset.slug=p.slug;
      row.innerHTML='<div class="drag" title="Arrastar">⋮⋮</div><img class="product-thumb" alt=""><div class="product-meta"><strong></strong><span></span></div><div class="row-actions"><button type="button" class="edit">Editar</button><a class="view" target="_blank">Abrir ↗</a></div>';
      row.querySelector('img').src=p.image_url||'';row.querySelector('img').alt=p.name;row.querySelector('.product-meta strong').textContent=p.name+(p.active===false?' · oculto':'');
      row.querySelector('.product-meta span').textContent=[p.type,p.category_slug,money(p.price)].join(' • ');
      row.querySelector('.edit').onclick=()=>openEditor(p);
      row.querySelector('.view').href=p.public_url||('/produto/'+encodeURIComponent(p.slug));
      row.addEventListener('dragstart',()=>row.classList.add('dragging'));row.addEventListener('dragend',()=>{row.classList.remove('dragging');saveOrder();});
      root.append(row);
    });
    root.ondragover=e=>{e.preventDefault();const dragging=q('.dragging',root);if(!dragging)return;const siblings=qa('.product-row:not(.dragging)',root);const after=siblings.find(el=>e.clientY<=el.getBoundingClientRect().top+el.offsetHeight/2);if(after)root.insertBefore(dragging,after);else root.append(dragging);};
  }
  async function saveOrder(){
    const slugs=qa('.product-row',$('product-list')).map(x=>x.dataset.slug);slugs.forEach((slug,i)=>{const p=catalog.products.find(x=>x.slug===slug);if(p)p.sort_order=(i+1)*10;});
    if(localMode){saveLocal();return;}
    try{await api('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reorder_products',slugs})});}catch(e){alert(e.message);}renderProducts();
  }

  function fillCategorySelect(){const sel=$('category-select');const value=sel.value;sel.replaceChildren();catalog.categories.filter(c=>c.active!==false).forEach(c=>{const o=document.createElement('option');o.value=c.slug;o.textContent=c.name;sel.append(o);});if(value)sel.value=value;}
  function renderCategories(){const root=$('category-list');root.replaceChildren();catalog.categories.forEach(c=>{const d=document.createElement('div');d.className='category-item';d.innerHTML='<span></span><small></small>';d.querySelector('span').textContent=c.name;d.querySelector('small').textContent=c.slug+(c.active===false?' · oculta':'');root.append(d);});}
  function renderSites(){const root=$('site-list');root.replaceChildren();catalog.products.filter(p=>p.active!==false).forEach(p=>{const d=document.createElement('div');d.className='site-card';const url=p.public_url||('/produto/'+p.slug);d.innerHTML='<div><b></b><span></span></div><a class="small-btn" target="_blank">Abrir ↗</a>';d.querySelector('b').textContent=p.name;d.querySelector('span').textContent=p.public_url?'Site externo mantido':'Página automática: /produto/'+p.slug;d.querySelector('a').href=url;root.append(d);});}

  function blankProduct(){return {name:'',slug:'',type:'digital',category_slug:catalog.categories[0]?.slug||'ofertas',price:'',old_price:'',description:'',image_url:'',public_url:'',checkout_mode:'native',checkout_url:'',supplier_url:'',benefits:[],featured:false,shipping_required:false,active:true,sort_order:(catalog.products.length+1)*10};}
  function openEditor(product=blankProduct()){
    currentSlug=product.slug||'';$('product-form').hidden=false;$('editor-title').textContent=currentSlug?'Editar produto':'Novo produto';
    const f=$('product-form');['name','slug','type','category_slug','price','old_price','description','image_url','public_url','checkout_mode','checkout_url','supplier_url'].forEach(k=>{if(f.elements[k])f.elements[k].value=product[k]??'';});
    f.elements.benefits.value=(product.benefits||[]).join('\n');f.elements.featured.checked=!!product.featured;f.elements.shipping_required.checked=!!product.shipping_required;f.elements.active.checked=product.active!==false;
    $('preview-product').href=product.public_url||('/produto/'+(product.slug||''));$('duplicate-product').disabled=!currentSlug;$('product-status').textContent='';
    f.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function formProduct(){const f=$('product-form');const fd=new FormData(f);return {name:String(fd.get('name')||'').trim(),slug:slugify(fd.get('slug')||fd.get('name')),type:fd.get('type'),category_slug:fd.get('category_slug'),price:Number(fd.get('price')||0),old_price:fd.get('old_price')===''?null:Number(fd.get('old_price')),description:String(fd.get('description')||'').trim(),image_url:String(fd.get('image_url')||'').trim(),public_url:String(fd.get('public_url')||'').trim(),checkout_mode:fd.get('checkout_mode'),checkout_url:String(fd.get('checkout_url')||'').trim(),supplier_url:String(fd.get('supplier_url')||'').trim(),benefits:String(fd.get('benefits')||'').split('\n').map(x=>x.trim()).filter(Boolean),featured:f.elements.featured.checked,shipping_required:f.elements.shipping_required.checked,active:f.elements.active.checked,sort_order:catalog.products.find(p=>p.slug===currentSlug)?.sort_order||((catalog.products.length+1)*10)};}
  async function saveProduct(product){
    if(!product.name||!product.slug)throw Error('Preencha nome e slug.');
    if(localMode){const i=catalog.products.findIndex(p=>p.slug===currentSlug||p.slug===product.slug);if(i>=0)catalog.products[i]=product;else catalog.products.push(product);saveLocal();currentSlug=product.slug;renderAll();return;}
    const data=await api('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_product',product})});currentSlug=data.product.slug;await loadCatalog();
  }

  function renderOrders(){
    const root=$('orders-list');if(!root)return;root.replaceChildren();if(localMode){root.innerHTML='<div class="panel muted">Pedidos só aparecem no modo nuvem, quando o banco estiver conectado.</div>';return;}if(!orders.length){root.innerHTML='<div class="panel muted">Nenhum pedido registrado ainda.</div>';return;}
    orders.forEach(o=>{const card=document.createElement('article');card.className='order-card';const c=o.customer||{},s=o.shipping||{};card.innerHTML='<div class="order-head"><div><strong></strong><small></small></div><b></b></div><div class="order-grid"><div><span>Cliente</span><b class="customer"></b></div><div><span>Pagamento</span><b class="payment"></b></div><div><span>Entrega</span><b class="fulfillment"></b></div><div><span>Destino</span><b class="shipping"></b></div></div><div class="row-actions" style="margin-top:12px"><button class="mark-bought">Marcar comprado</button><button class="mark-sent">Marcar enviado</button></div>';
      card.querySelector('strong').textContent=o.product_name+' · '+money(o.amount);card.querySelector('small').textContent=new Date(o.created_at).toLocaleString('pt-BR')+' · '+(o.identifier||'sem identificador');card.querySelector('.order-head>b').textContent=o.payment_status;card.querySelector('.customer').textContent=[c.name,c.phone].filter(Boolean).join(' · ');card.querySelector('.payment').textContent=o.payment_status;card.querySelector('.fulfillment').textContent=o.fulfillment_status;card.querySelector('.shipping').textContent=s.city?[s.city,s.state].filter(Boolean).join('/'):'Digital';
      const update=async status=>{try{await api('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,fulfillment_status:status,tracking_code:o.tracking_code||'',notes:o.notes||''})});await loadOrders();}catch(e){alert(e.message);}};card.querySelector('.mark-bought').onclick=()=>update('purchased');card.querySelector('.mark-sent').onclick=()=>update('shipped');root.append(card);});
  }

  function setTab(name){qa('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));qa('.tab').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));$('page-title').textContent=({dashboard:'Dashboard',products:'Produtos',categories:'Categorias',orders:'Pedidos',sites:'Sites'}[name]||'Trendou');if(name==='orders')loadOrders();}
  qa('.nav-btn').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));qa('.goto').forEach(b=>b.onclick=()=>setTab(b.dataset.go));

  async function bootstrap(){
    $('login-card').hidden=true;$('app').hidden=false;$('nav').hidden=false;
    try{await loadCatalog();}catch(e){$('login-card').hidden=false;$('app').hidden=true;$('nav').hidden=true;$('login-status').textContent=e.message;return;}
    const sync=await fetch('/api/syncpay?action=status',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));$('metric-syncpay').textContent=sync.configured?'OK':'OFF';
    const box=$('system-status');box.replaceChildren();[[sync.configured,'SyncPay','Credenciais'],[sync.database,'Banco','Persistência'],[catalog.persistence==='neon','Catálogo','Nuvem']].forEach(([ok,label,desc])=>{const d=document.createElement('div');d.className='status-line';d.innerHTML='<span>'+label+' · '+desc+'</span><b class="'+(ok?'ok':'warn')+'">'+(ok?'Ativo':'Pendente')+'</b>';box.append(d);});
    loadOrders();
  }

  $('login-form').onsubmit=async e=>{e.preventDefault();token=$('admin-key').value.trim();localMode=false;sessionStorage.setItem('trendou_admin_key',token);$('login-status').textContent='Conectando…';await bootstrap();};
  $('local-mode').onclick=async()=>{token='';localMode=true;$('login-status').textContent='';await bootstrap();};
  $('logout').onclick=()=>{token='';localMode=false;sessionStorage.removeItem('trendou_admin_key');location.reload();};
  $('new-product').onclick=()=>openEditor();$('close-editor').onclick=()=>{$('product-form').hidden=true;};
  $('product-form').onsubmit=async e=>{e.preventDefault();const p=formProduct();$('product-status').textContent='Salvando…';try{await saveProduct(p);$('product-status').textContent='Produto salvo.';$('preview-product').href=p.public_url||('/produto/'+p.slug);}catch(err){$('product-status').textContent=err.message;}};
  $('duplicate-product').onclick=()=>{const p=formProduct();p.slug=slugify(p.slug+'-copia');p.name=p.name+' — cópia';currentSlug='';openEditor(p);};
  $('product-form').elements.name.addEventListener('input',()=>{if(!currentSlug)$('product-form').elements.slug.value=slugify($('product-form').elements.name.value);});
  $('category-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const category={name:String(fd.get('name')||'').trim(),slug:slugify(fd.get('slug')||fd.get('name')),active:true,sort_order:(catalog.categories.length+1)*10};$('category-status').textContent='Salvando…';try{if(localMode){catalog.categories.push(category);saveLocal();renderAll();}else{await api('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_category',category})});await loadCatalog();}e.currentTarget.reset();$('category-status').textContent='Categoria salva.';}catch(err){$('category-status').textContent=err.message;}};
  $('refresh-orders').onclick=loadOrders;

  const saved=sessionStorage.getItem('trendou_admin_key');if(saved){token=saved;bootstrap();}
})();
