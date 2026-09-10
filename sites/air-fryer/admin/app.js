(() => {
 let token='',loading=false;const $=id=>document.getElementById(id);
 const labels={inicio:'Apresentação',rotina:'Dificuldades da rotina',material:'Sobre o PDF',receitas:'Categorias',exemplos:'Exemplos de receitas',bonus:'Bônus','como-usar':'Como usar',oferta:'Oferta',duvidas:'Dúvidas',final:'Chamada final',fixo:'Botão fixo no celular'};
 const label=v=>v.startsWith('checkout-')?'Checkout · '+(labels[v.slice(9)]||v):v.startsWith('ancora-')?'Ir para '+(labels[v.slice(7)]||v.slice(7)):v.startsWith('faq-')?'Dúvida '+v.slice(4):labels[v]||v;
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 function table(target,heads,rows){const t=node('table',''),tr=node('tr','');heads.forEach(x=>tr.append(node('th',x)));const h=node('thead','');h.append(tr);t.append(h);const body=node('tbody','');rows.forEach(row=>{const r=node('tr','');row.forEach(x=>r.append(node('td',String(x))));body.append(r);});t.append(body);$(target).replaceChildren(rows.length?t:node('p','Sem registros neste período.'));}
 function list(target,rows,key){$(target).replaceChildren();if(!rows.length)$(target).append(node('p','Sem registros neste período.'));rows.forEach(r=>{const div=node('div','');div.className='row';div.append(node('span',label(r[key])),node('strong',r.visits));$(target).append(div);});}
 async function load(){if(loading)return;loading=true;$('status').textContent='Consultando métricas…';try{
  const response=await fetch('/api/analytics?action=report&days='+$('days').value,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const d=await response.json();if(!response.ok)throw Error(d.error||'Não foi possível carregar.');
  $('login').hidden=true;$('report').hidden=false;$('key').value='';$('cards').replaceChildren();
  const t=d.totals;[[t.visits,'Visitas registradas'],[t.active_seconds+' s','Tempo ativo médio'],[t.scroll+'%','Rolagem máxima média'],[t.checkout,'Visitas que clicaram no checkout']].forEach(([v,l])=>{const div=node('div','');div.className='card';div.append(node('strong',v),node('span',l));$('cards').append(div);});
  table('sources',['Origem','Campanha','Criativo','Visitas','Checkout'],d.sources.map(r=>[r.source,r.campaign,r.creative,r.visits,r.checkout]));list('sections',d.sections,'section');list('clicks',d.clicks,'click');
  $('recent').replaceChildren();if(!d.recent.length)$('recent').append(node('p','Nenhuma visita registrada no período.'));
  d.recent.forEach(r=>{const el=node('details','');el.append(node('summary',new Date(r.created_at).toLocaleString('pt-BR')+' · '+r.device+' · '+r.active_seconds+' s · rolagem '+r.scroll+'%'));el.append(node('p','Visita: '+r.id),node('p','Origem: '+r.source+' · Criativo: '+r.creative),node('p','Seções: '+(r.sections.map(label).join(' • ')||'Nenhuma registrada')),node('p','Cliques: '+(r.clicks.map(label).join(' • ')||'Nenhum registrado')));$('recent').append(el);});
  $('status').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR')+'. Horários no fuso do seu dispositivo.';
 }catch(e){$('report').hidden=true;$('login').hidden=false;$('status').textContent=e.message;}finally{loading=false;}}
 $('login').onsubmit=e=>{e.preventDefault();token=$('key').value;load();};$('refresh').onclick=load;$('days').onchange=load;$('logout').onclick=()=>{token='';$('report').hidden=true;$('login').hidden=false;$('key').value='';$('recent').replaceChildren();$('status').textContent='Você saiu do painel.';};
})();
