(() => {
  const params=new URLSearchParams(location.search);
  const parts=location.pathname.split('/').filter(Boolean);
  const slug=params.get('slug') || (parts[0]==='produto' && parts[1] && parts[1]!=='produto.html' ? parts[1] : '');
  const $=id=>document.getElementById(id);const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const attributionKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','fbclid'];
  const visitKey='trendou_visit_id';
  const validVisitId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  let visitId=params.get('visit_id')||sessionStorage.getItem(visitKey)||'';
  if(!validVisitId(visitId))visitId=crypto.randomUUID();
  sessionStorage.setItem(visitKey,visitId);
  function withAttribution(url){const destination=new URL(url,location.origin);attributionKeys.forEach(key=>{const value=params.get(key);if(value&&value.length<=500)destination.searchParams.set(key,value);});destination.searchParams.set('visit_id',visitId);return destination.toString();}
  fetch('/api/catalog?slug='+encodeURIComponent(slug),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Produto não encontrado');return d.product;}).then(p=>{
    document.title=p.name+' • Trendou';$('loading').remove();$('content').hidden=false;$('name').textContent=p.name;$('description').textContent=p.description||'';$('image').src=p.image_url||'';$('image').alt=p.name;$('category').textContent=p.category_slug||'Produto';$('price').textContent=money(p.price);
    if(p.old_price&&Number(p.old_price)>Number(p.price))$('old-price').textContent=money(p.old_price);else $('old-price').remove();
    const benefits=$('benefits');(p.benefits||[]).forEach(v=>{const li=document.createElement('li');li.textContent='✓ '+v;benefits.append(li);});if(!(p.benefits||[]).length)benefits.remove();
    const buy=$('buy');let href='/checkout/'+encodeURIComponent(p.slug);if((p.checkout_mode==='external'||p.checkout_mode==='affiliate')&&p.checkout_url)href=p.checkout_url;href=withAttribution(href);buy.href=href;
    if(new URL(href).origin!==location.origin){buy.target='_blank';buy.rel=p.checkout_mode==='affiliate'?'sponsored nofollow noopener':'noopener';}
    if(p.checkout_mode==='affiliate'){$('affiliate-note').style.display='block';buy.textContent='Ver oferta';}
  }).catch(e=>{$('loading').textContent=e.message;});
})();
