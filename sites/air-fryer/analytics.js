(() => {
 'use strict';
 const endpoint='/api/analytics';
 if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
 let enabled=false, state, timer, observer, last=performance.now(), activity=last, lastSent=0;
 const sec=['inicio','rotina','material','receitas','exemplos','bonus','como-usar','oferta','duvidas','final'];
 const sections=[...document.querySelectorAll('main section')];
 sections.forEach((el,i)=>el.dataset.metricSection=el.id||sec[i]||'');
 const query=new URLSearchParams(location.search);
 const clean=v=>v && /^[a-zA-Z0-9_. -]{1,80}$/.test(v)?v:'nao-informado';
 const validVisitId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
 const visitKey='trendou_visit_id';
 let visitId=query.get('visit_id')||sessionStorage.getItem(visitKey)||'';
 if(!validVisitId(visitId))visitId=crypto.randomUUID();
 sessionStorage.setItem(visitKey,visitId);
 const pendingSections=new Map();
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
  if(enabled)return; enabled=true;
  state={id:visitId,source:clean(query.get('utm_source')||query.get('src')||'direto'),campaign:clean(query.get('utm_campaign')),
   creative:clean(query.get('utm_content')),device:innerWidth<768?'celular':innerWidth<1024?'tablet':'computador',active:0,scroll:0,sections:new Set(),clicks:new Set()};
  last=activity=performance.now();
  observer=new IntersectionObserver(entries=>entries.forEach(e=>{
   const key=e.target.dataset.metricSection;
   if(e.isIntersecting && e.intersectionRect.height>=Math.min(100,e.boundingClientRect.height))pendingSections.set(key,performance.now());
   else pendingSections.delete(key);
  }),{threshold:[0,0.1,0.25,0.5,1]});
  sections.forEach(el=>observer.observe(el));
  timer=setInterval(()=>{tick();if(performance.now()-lastSent>15000)send();},1000);
  send();
 }
 ['pointerdown','keydown','scroll','touchstart'].forEach(e=>addEventListener(e,()=>{activity=performance.now();},{passive:true}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){send();pendingSections.clear();}else{last=activity=performance.now();if(observer){sections.forEach(el=>{observer.unobserve(el);observer.observe(el);});}}});
 addEventListener('pagehide',send);
 addEventListener('message',e=>{
  if(e.origin!==location.origin||!enabled||!state)return;
  if(e.data?.type==='trendou-checkout-start'){
   state.clicks.add('checkout-oferta');
   send();
  }
 });
 document.addEventListener('click',e=>{
  if(!enabled||!state)return;const link=e.target.closest('a');if(!link)return;
  let key;
  if(link.classList.contains('checkout'))key='checkout-'+(link.closest('section')?.dataset.metricSection||'fixo');
  else if(link.getAttribute('href')?.startsWith('#'))key='ancora-'+link.getAttribute('href').slice(1);
  if(key){state.clicks.add(key);send();}
 });
 document.querySelectorAll('details').forEach((el,i)=>el.addEventListener('toggle',()=>{if(enabled&&state&&el.open){state.clicks.add('faq-'+(i+1));send();}}));
 fetch(endpoint+'?action=status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data?.enabled)start();}).catch(()=>{});
})();
