(() => {
 'use strict';
 const endpoint='/api/analytics', preference='trendou-metricas-v1';
 let choice; try {choice=localStorage.getItem(preference);} catch {return;}
 let enabled=false, started=false, state, timer, observer, last=performance.now(), activity=last, lastSent=0;
 const sec=['inicio','rotina','material','receitas','exemplos','bonus','como-usar','oferta','duvidas','final'];
 const sections=[...document.querySelectorAll('main section')];
 sections.forEach((el,i)=>el.dataset.metricSection=sec[i]||'');
 const query=new URLSearchParams(location.search);
 const clean=v=>v && /^[a-zA-Z0-9_. -]{1,80}$/.test(v)?v:'nao-informado';
 let pendingSections=new Map();
 function tick(){
  const now=performance.now();
  if(state && document.visibilityState==='visible' && now-activity<30000){
   state.active=Math.min(7200,state.active+Math.min((now-last)/1000,2));
   pendingSections.forEach((since,key)=>{if(now-since>=1000) state.sections.add(key);});
   const max=document.documentElement.scrollHeight-innerHeight;
   state.scroll=Math.max(state.scroll,Math.min(100,Math.round(max>0?scrollY/max*100:100)));
  }
  last=now;
 }
 function send(){
  if(!enabled||!state)return;
  tick();
  const body=JSON.stringify({...state,active:Math.floor(state.active),sections:[...state.sections],clicks:[...state.clicks]});
  lastSent=performance.now();
  fetch(endpoint+'?action=collect',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
 }
 function start(){
  if(started||!enabled)return; started=true;
  state={id:crypto.randomUUID(),source:clean(query.get('utm_source')||'direto'),campaign:clean(query.get('utm_campaign')),
   creative:clean(query.get('utm_content')),device:innerWidth<768?'celular':innerWidth<1024?'tablet':'computador',active:0,scroll:0,sections:new Set(),clicks:new Set()};
  last=activity=performance.now();
  observer=new IntersectionObserver(entries=>entries.forEach(e=>{
   const key=e.target.dataset.metricSection;
   if(e.isIntersecting && e.intersectionRect.height>=Math.min(100,e.boundingClientRect.height))pendingSections.set(key,performance.now());
   else pendingSections.delete(key);
  }),{threshold:[0,0.1,0.25,0.5,1]});
  sections.forEach(el=>observer.observe(el));
  timer=setInterval(()=>{tick();if(performance.now()-lastSent>15000)send();},1000);send();
 }
 function save(value){choice=value;try{localStorage.setItem(preference,value);}catch{}
  box.hidden=true;enabled=value==='aceitar';
  if(enabled)start();else{clearInterval(timer);observer?.disconnect();state=null;started=false;pendingSections.clear();}
 }
 const box=document.createElement('aside');box.className='metrics-consent';box.hidden=true;box.setAttribute('aria-label','Preferências de métricas');
 box.innerHTML='<strong>Podemos medir sua visita?</strong><p>Com sua autorização, registramos seções exibidas, cliques e tempo ativo para melhorar esta página. Não coletamos nome, e-mail nem o que você digita. <a href="/air-fryer/privacidade.html">Saiba mais</a>.</p><div><button type="button" data-choice="recusar">Recusar</button><button type="button" data-choice="aceitar">Permitir métricas</button></div>';
 box.querySelectorAll('button').forEach(b=>b.onclick=()=>save(b.dataset.choice));document.body.append(box);
 const settings=document.createElement('button');settings.type='button';settings.className='metrics-settings';settings.textContent='Preferências de métricas';settings.onclick=()=>box.hidden=false;document.querySelector('footer')?.append(settings);
 ['pointerdown','keydown','scroll','touchstart'].forEach(e=>addEventListener(e,()=>{activity=performance.now();},{passive:true}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){send();pendingSections.clear();}else{last=activity=performance.now();if(observer){sections.forEach(el=>{observer.unobserve(el);observer.observe(el);});}}});
 addEventListener('pagehide',send);
 document.addEventListener('click',e=>{
  if(!enabled||!state)return;const a=e.target.closest('a');if(!a)return;
  let key;
  if(a.classList.contains('checkout'))key='checkout-'+(a.closest('section')?.dataset.metricSection||'fixo');
  else if(a.getAttribute('href')?.startsWith('#'))key='ancora-'+a.getAttribute('href').slice(1);
  if(key){state.clicks.add(key);send();}
 });
 document.querySelectorAll('details').forEach((el,i)=>el.addEventListener('toggle',()=>{if(enabled&&state&&el.open){state.clicks.add('faq-'+(i+1));send();}}));
 fetch(endpoint+'?action=status').then(r=>r.ok?r.json():null).then(data=>{if(!data?.enabled){settings.hidden=true;return;}if(choice==='aceitar'){enabled=true;start();}else if(choice!=='recusar')box.hidden=false;}).catch(()=>settings.hidden=true);
})();
