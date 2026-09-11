(() => {
  const $=id=>document.getElementById(id);
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pathParts=location.pathname.split('/').filter(Boolean);
  const slug=new URLSearchParams(location.search).get('produto') || (pathParts[0]==='checkout'&&pathParts[1]&&pathParts[1]!=='index.html'?pathParts[1]:'');
  let product=null;let identifier='';let pollTimer=null;

  function setStatus(text){$('checkout-status').textContent=text;$('checkout-status').hidden=false;}
  function onlyDigits(v){return String(v||'').replace(/\D/g,'');}
  function formatCpf(v){v=onlyDigits(v).slice(0,11);return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');}
  function formatPhone(v){v=onlyDigits(v).slice(0,11);if(v.length<=10)return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2');return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2');}
  function formatZip(v){v=onlyDigits(v).slice(0,8);return v.replace(/(\d{5})(\d)/,'$1-$2');}

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

  $('checkout-form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='GERANDO PIX…';
    const fd=new FormData(form);const payload={product_slug:product.slug,customer:{name:fd.get('name'),cpf:fd.get('cpf'),email:fd.get('email'),phone:fd.get('phone')},shipping:{zip:fd.get('zip'),street:fd.get('street'),number:fd.get('number'),complement:fd.get('complement'),neighborhood:fd.get('neighborhood'),city:fd.get('city'),state:fd.get('state')}};
    try{
      const response=await fetch('/api/syncpay?action=create-pix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível gerar o Pix.');identifier=data.identifier;form.hidden=true;$('pix-area').hidden=false;$('pix-code').value=data.pix_code;
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
