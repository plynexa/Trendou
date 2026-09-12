(() => {
  const $=id=>document.getElementById(id);
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pathParts=location.pathname.split('/').filter(Boolean);
  const params=new URLSearchParams(location.search);
  const slug=params.get('produto') || (pathParts[0]==='checkout'&&pathParts[1]&&pathParts[1]!=='index.html'?pathParts[1]:'');
  let product=null;let identifier='';let pollTimer=null;let checkoutStarted=false;

  const validVisitId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  const clean=(v,max=160)=>String(v||'').trim().slice(0,max);
  const visitKey='trendou_visit_id';
  let visitId=params.get('visit_id')||sessionStorage.getItem(visitKey)||'';
  if(!validVisitId(visitId))visitId=crypto.randomUUID();
  sessionStorage.setItem(visitKey,visitId);
  const attribution={
    visit_id:visitId,
    source:clean(params.get('utm_source')||params.get('src')||'direto'),
    campaign:clean(params.get('utm_campaign')||'nao-informado'),
    creative:clean(params.get('utm_content')||'nao-informado'),
    medium:clean(params.get('utm_medium')||'nao-informado'),
    term:clean(params.get('utm_term')||'nao-informado'),
    fbclid:clean(params.get('fbclid'),500)
  };
  const parentOrigin=(()=>{
    const value=String(params.get('parent_origin')||'');
    if(!value)return location.origin;
    try{
      const u=new URL(value);
      if(u.protocol==='https:'&&u.hostname.endsWith('.vercel.app'))return u.origin;
    }catch{}
    return location.origin;
  })();

  function setStatus(text){$('checkout-status').textContent=text;$('checkout-status').hidden=false;}
  function onlyDigits(v){return String(v||'').replace(/\D/g,'');}
  function formatCpf(v){v=onlyDigits(v).slice(0,11);return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');}
  function formatPhone(v){v=onlyDigits(v).slice(0,11);if(v.length<=10)return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2');return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2');}
  function formatZip(v){v=onlyDigits(v).slice(0,8);return v.replace(/(\d{5})(\d)/,'$1-$2');}
  function signalCheckoutStart(){
    if(checkoutStarted)return;checkoutStarted=true;
    if(window.parent!==window)window.parent.postMessage({type:'trendou-checkout-start'},parentOrigin);
  }

  async function saveAttribution(id){
    try{
      await fetch('/api/attribution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:id,attribution}),keepalive:true});
    }catch{}
  }

  async function load(){
    if(!slug){setStatus('Produto não informado.');return;}
    try{
      const [pRes,sRes]=await Promise.all([fetch('/api/catalog?slug='+encodeURIComponent(slug),{cache:'no-store'}),fetch('/api/syncpay?action=status',{cache:'no-store'})]);
      const pData=await pRes.json();const sData=await sRes.json().catch(()=>({}));if(!pRes.ok)throw Error(pData.error||'Produto não encontrado.');product=pData.product;
      $('product-name').textContent=product.name;$('product-description').textContent=product.description||'';$('product-image').src=product.image_url||'';$('product-image').alt=product.name;$('product-price').textContent=money(product.price);
      if(product.old_price&&Number(product.old_price)>Number(product.price))$('product-old').textContent=money(product.old_price);else $('product-old').remove();
      document.title='Checkout · '+product.name+' • Trendou';
      if(product.type==='affiliate'||product.checkout_mode==='affiliate'){setStatus('Este produto é uma oferta afiliada e não usa checkout da Trendou.');return;}
      if(!sData.configured){setStatus('Checkout em configuração. As credenciais da SyncPay ainda não foram carregadas neste projeto.');return;}
      if(product.shipping_required){$('shipping').hidden=false;['zip','street','number','city','state'].forEach(n=>$('checkout-form').elements[n].required=true);}
      if(product.shipping_required&&!sData.database){setStatus('O checkout físico está pronto, mas falta conectar o banco para guardar o endereço do pedido.');return;}
      $('checkout-status').hidden=true;$('checkout-form').hidden=false;
    }catch(e){setStatus(e.message);}
  }

  $('checkout-form').elements.cpf.addEventListener('input',e=>e.target.value=formatCpf(e.target.value));
  $('checkout-form').elements.phone.addEventListener('input',e=>e.target.value=formatPhone(e.target.value));
  $('checkout-form').elements.zip.addEventListener('input',e=>e.target.value=formatZip(e.target.value));
  $('checkout-form').addEventListener('focusin',signalCheckoutStart,{once:true});

  $('checkout-form').onsubmit=async e=>{
    e.preventDefault();signalCheckoutStart();const form=e.currentTarget;const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='GERANDO PIX…';
    const fd=new FormData(form);const payload={product_slug:product.slug,customer:{name:fd.get('name'),cpf:fd.get('cpf'),email:fd.get('email'),phone:fd.get('phone')},shipping:{zip:fd.get('zip'),street:fd.get('street'),number:fd.get('number'),complement:fd.get('complement'),neighborhood:fd.get('neighborhood'),city:fd.get('city'),state:fd.get('state')}};
    try{
      const response=await fetch('/api/syncpay?action=create-pix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível gerar o Pix.');identifier=data.identifier;await saveAttribution(identifier);form.hidden=true;$('pix-area').hidden=false;$('pix-code').value=data.pix_code;
      $('qr').replaceChildren();if(window.QRCode)new QRCode($('qr'),{text:data.pix_code,width:220,height:220,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      pollTimer=setInterval(checkPayment,5000);setTimeout(checkPayment,1500);
    }catch(err){setStatus(err.message);submit.disabled=false;submit.textContent='GERAR PIX';}
  };

  $('copy-pix').onclick=async()=>{try{await navigator.clipboard.writeText($('pix-code').value);$('copy-pix').textContent='Pix copiado ✓';setTimeout(()=>$('copy-pix').textContent='Copiar código Pix',1800);}catch{$('pix-code').select();document.execCommand('copy');}};

  async function checkPayment(){
    if(!identifier)return;try{const response=await fetch('/api/syncpay?action=transaction&identifier='+encodeURIComponent(identifier),{cache:'no-store'});const data=await response.json();if(!response.ok)return;if(data.completed){clearInterval(pollTimer);$('payment-state').textContent='Pagamento confirmado ✓';$('payment-state').className='payment-state paid';setTimeout(()=>{$('pix-area').hidden=true;$('success').hidden=false;},900);}else{$('payment-state').textContent='Aguardando pagamento… ('+(data.status||'pendente')+')';}}catch{}
  }
  addEventListener('pagehide',()=>{if(pollTimer)clearInterval(pollTimer);});load();
})();
