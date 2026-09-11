(() => {
  const params=new URLSearchParams(location.search);const slug=params.get('slug')||'';
  const $=id=>document.getElementById(id);const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  fetch('/api/catalog?slug='+encodeURIComponent(slug),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Produto não encontrado');return d.product;}).then(p=>{
    document.title=p.name+' • Trendou';$('loading').remove();$('content').hidden=false;$('name').textContent=p.name;$('description').textContent=p.description||'';$('image').src=p.image_url||'';$('image').alt=p.name;$('category').textContent=p.category_slug||'Produto';$('price').textContent=money(p.price);
    if(p.old_price&&Number(p.old_price)>Number(p.price))$('old-price').textContent=money(p.old_price);else $('old-price').remove();
    const benefits=$('benefits');(p.benefits||[]).forEach(v=>{const li=document.createElement('li');li.textContent='✓ '+v;benefits.append(li);});if(!(p.benefits||[]).length)benefits.remove();
    const buy=$('buy');let href='/checkout/'+encodeURIComponent(p.slug);if((p.checkout_mode==='external'||p.checkout_mode==='affiliate')&&p.checkout_url)href=p.checkout_url;buy.href=href;
    if(/^https?:\/\//.test(href)){buy.target='_blank';buy.rel=p.checkout_mode==='affiliate'?'sponsored nofollow noopener':'noopener';}
    if(p.checkout_mode==='affiliate'){$('affiliate-note').style.display='block';buy.textContent='Ver oferta';}
  }).catch(e=>{$('loading').textContent=e.message;});
})();
