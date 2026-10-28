(function(){
// Pista de corrida da Liga (SVG animado), usada pelo professor (Ranking) e pelo aluno (Copa).
// Corrida.pista({linhas:[{usuario,pontos,posicao,icones:[{ic,tx}]}], max, inicio, fim, nome(u), eu, titulo}) devolve o elemento da pista.
const h=(t,a,...f)=>{const e=document.createElement(t);for(const[k,v]of Object.entries(a||{}))k.startsWith('on')?e.addEventListener(k.slice(2),v):e.setAttribute(k,v);e.append(...f);return e};
function pista(o){
  const max=o.max||100,lista=o.linhas||[],eu=o.eu||null,porU=Object.fromEntries(lista.map(x=>[x.usuario,x]));
  const DS=864e5*7;let N=20,dec=null;
  if(o.inicio&&o.fim){const a=new Date(o.inicio+'T00:00:00').getTime(),b=new Date(o.fim+'T23:59:59').getTime();N=Math.max(1,Math.round((b-a)/DS));dec=Math.max(0,Math.min(N,(Date.now()-a)/DS))}
  const semAtual=dec===null?null:Math.min(N,Math.floor(dec)+1);
  const NS='http://www.w3.org/2000/svg';const E=(t,at,...f)=>{const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(at||{}))e.setAttribute(k,v);e.append(...f);return e};
  const svg=E('svg',{viewBox:'0 0 800 470',class:'circ',role:'img','aria-label':'Pista de corrida da turma'});
  const D='M160,340 C60,340 40,205 140,165 C230,128 300,195 400,152 C500,108 560,66 665,108 C775,154 775,335 650,368 C560,392 480,325 400,356 C320,388 250,368 160,340 Z';
  const defs=E('defs',{});defs.append(E('radialGradient',{id:'gr',cx:'50%',cy:'50%',r:'70%'},E('stop',{offset:'0','stop-color':'#1f5a35'}),E('stop',{offset:'1','stop-color':'#123a24'})));
  svg.append(defs,E('rect',{x:0,y:0,width:800,height:470,rx:18,fill:'url(#gr)'}));
  for(const[x,y,r]of[[90,60,16],[130,90,11],[720,60,14],[60,420,13],[740,420,15],[690,430,10],[300,60,12]])svg.append(E('circle',{cx:x,cy:y,r,fill:'#1d6b3c',opacity:'.6'}));
  svg.append(E('path',{d:D,fill:'none',stroke:'#fff','stroke-width':'58','stroke-linejoin':'round',opacity:'.9'}));
  svg.append(E('path',{d:D,fill:'none',stroke:'#e63946','stroke-width':'58','stroke-dasharray':'14 14','stroke-linejoin':'round'}));
  svg.append(E('path',{d:D,fill:'none',stroke:'#2b2f3d','stroke-width':'48','stroke-linejoin':'round'}));
  const centro=E('path',{d:D,id:'tr',fill:'none',stroke:'#ffffff55','stroke-width':'2','stroke-dasharray':'10 12'});svg.append(centro);
  const L=centro.getTotalLength();const pt=f=>{f=((f%1)+1)%1;const a=centro.getPointAtLength(f*L),b=centro.getPointAtLength(((f+.004)%1)*L);const an=Math.atan2(b.y-a.y,b.x-a.x);return{x:a.x,y:a.y,nx:-Math.sin(an),ny:Math.cos(an),an}};
  const s0=pt(0);svg.append(E('rect',{x:s0.x-4,y:s0.y-26,width:8,height:52,fill:'url(#chk)',stroke:'#fff','stroke-width':'1',transform:'rotate('+(s0.an*180/Math.PI)+' '+s0.x+' '+s0.y+')'}));
  defs.append(E('pattern',{id:'chk',width:8,height:8,patternUnits:'userSpaceOnUse'},E('rect',{width:8,height:8,fill:'#fff'}),E('rect',{width:4,height:4,fill:'#111'}),E('rect',{x:4,y:4,width:4,height:4,fill:'#111'})));
  svg.append(E('text',{x:s0.x,y:s0.y+46,'text-anchor':'middle',fill:'#fff','font-size':'12','font-weight':'700'},'LARGADA / CHEGADA'));
  const hud=E('g',{'text-anchor':'middle',fill:'#fff'});
  hud.append(E('text',{x:400,y:228,'font-size':'15',fill:'#f5b83d','font-weight':'700','letter-spacing':'2'},(o.titulo||'CORRIDA DA LIGA')),
    E('text',{x:400,y:268,'font-size':'38','font-weight':'800'},semAtual===null?'Volta ? / '+N:'Volta '+semAtual+' / '+N),
    E('text',{x:400,y:292,'font-size':'15',fill:'#cfd3e6'},dec===null?'Defina início e fim da turma para contar as semanas':(N-semAtual)+' volta'+(N-semAtual===1?'':'s')+' (semanas) restante'+(N-semAtual===1?'':'s')));
  svg.append(hud);
  // pace car e karts
  const karts=[];
  const mkKart=(u,voltas,eh,pos)=>{const g=E('g',{class:'kart'},E('title',{},eh?'Ritmo ideal da turma (semana '+semAtual+')':(o.nome?o.nome(u):u)+' · '+pos+'º · '+Math.round(voltas*10)/10+' de '+N+' voltas'));
    if(eh){g.append(E('circle',{r:15,fill:'#f5b83d',stroke:'#fff','stroke-width':2}),E('text',{y:5,'text-anchor':'middle','font-size':'16'},'🚓'));return{g,voltas,eh,off:0,u:null}}
    const cid='cp'+u.replace(/\W/g,'');defs.append(E('clipPath',{id:cid},E('circle',{r:15})));
    g.append(E('circle',{r:eu===u?20:17,fill:'#2a2e42',stroke:eu===u?'#4aa3ff':(pos===1?'#ffd54a':'#f5b83d'),'stroke-width':eu===u||pos===1?4:2.5}),E('text',{y:5,'text-anchor':'middle','font-size':'15',fill:'#fff','font-weight':'800'},u[0].toUpperCase()));
    const im=E('image',{href:'https://github.com/'+encodeURIComponent(u)+'.png?size=64',x:-15,y:-15,width:30,height:30,'clip-path':'url(#'+cid+')',referrerpolicy:'no-referrer'});im.addEventListener('error',()=>im.remove());g.append(im);
    if(eu===u)g.append(E('text',{y:-24,'text-anchor':'middle','font-size':'11',fill:'#4aa3ff','font-weight':'800',style:'paint-order:stroke;stroke:#000;stroke-width:3px'},'VOCÊ'));else if(pos===1)g.append(E('text',{y:-22,'text-anchor':'middle','font-size':'15'},'👑'));
    g.append(E('text',{y:32,'text-anchor':'middle','font-size':'10',fill:'#fff','font-weight':'700',style:'paint-order:stroke;stroke:#000;stroke-width:3px'},'V'+Math.floor(voltas+1)));
    const its=(porU[u]&&porU[u].icones)||[];its.forEach((it,i)=>{g.append(E('text',{x:22+i*15,y:-8,'font-size':'14'},it.ic))});
    if(its.length)g.querySelector('title').append(' · '+its.map(it=>it.ic+' '+it.tx).join(' · '));
    return{g,voltas,eh,off:((pos%3)-1)*12,u,turbo:its.some(it=>it.ic==='🍄')}};
  const mov=!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(dec!==null)karts.push(mkKart(null,dec,true,0));
  lista.forEach(x=>karts.push(mkKart(x.usuario,Math.max(0,Math.min(1,x.pontos/max))*N,false,x.posicao)));
  const trail=E('g',{});svg.append(trail);for(const k of karts)svg.append(k.g);
  const gaps=karts.filter(k=>!k.eh).map(k=>k.voltas-(dec===null?0:dec));const M=Math.max(1,...gaps.map(Math.abs));
  for(const k of karts)k.f=k.eh?0:(dec===null?Math.max(0,Math.min(1,k.voltas/N))*.9:((k.voltas-dec)/(2*M))*.9);
  const pose=(t,ph=0)=>{trail.textContent='';for(const k of karts){const v=k.f*t+ph;const p=pt(v);const x=p.x+p.nx*k.off,y=p.y+p.ny*k.off;k.g.setAttribute('transform','translate('+x+','+y+')');
      if(mov&&(t<1||ph>0)&&!k.eh)for(let i=1;i<=(k.turbo?6:3);i++){const q=pt(v-i*.012*Math.sign(k.f||1));trail.append(E('circle',{cx:q.x+q.nx*k.off,cy:q.y+q.ny*k.off,r:(k.turbo?9:6)-i,fill:k.turbo?(i%2?'#ff7a45':'#ffd54a'):'#fff',opacity:(k.turbo?.6:.28)-i*.05}))}}};
  pose(mov?0:1);
  if(mov){const t0=performance.now(),dur=9500;const VOLTA=30000;const passo=n=>{if(!document.body.contains(svg))return;const t=Math.min(1,(n-t0)/dur);if(t<1)pose(1-Math.pow(1-t,3));else pose(1,(((n-t0-dur)/VOLTA)%1));requestAnimationFrame(passo)};requestAnimationFrame(passo)}
  const wrap=h('div',{class:'corr-wrap'},svg);wrap.dataset.voltas=N;wrap.dataset.dec=dec===null?'':dec;return wrap}
function avatar(u){const ini=h('span',{class:'ini'},(u||'?')[0].toUpperCase());const im=h('img',{src:'https://github.com/'+encodeURIComponent(u)+'.png?size=96',alt:u,loading:'lazy',referrerpolicy:'no-referrer'});im.addEventListener('error',()=>im.replaceWith(ini));return im}
function podio(top,nome){if(!top.length)return null;const ordem=[top[1],top[0],top[2]].filter(Boolean);const alt={1:70,2:48,3:34};
  return h('div',{class:'corr-pod'},...ordem.map(x=>{const pos=top.indexOf(x)+1;return h('div',{},avatar(x.usuario),h('span',{style:'margin-top:4px'},nome(x.usuario)),h('span',{class:'sub'},x.pontos+' pts'),h('div',{class:'bloco',style:'height:'+alt[pos]+'px'},['🥇','🥈','🥉'][pos-1]))}))}
const css=document.createElement('style');css.textContent=`.corr-wrap{border-radius:18px;overflow:hidden;border:1px solid #fff2}.corr-wrap svg{display:block;width:100%;height:auto}.corr-pod{display:flex;justify-content:center;align-items:flex-end;gap:10px;margin:8px 0 14px}.corr-pod>div{display:flex;flex-direction:column;align-items:center;text-align:center;font-size:13px;font-weight:700;max-width:150px}.corr-pod img,.corr-pod .ini{width:56px;height:56px;border-radius:50%;border:3px solid var(--ouro,#f5b83d);object-fit:cover;background:#2a2e42;display:flex;align-items:center;justify-content:center;font-weight:800}.corr-pod .bloco{width:100px;border-radius:8px 8px 0 0;background:linear-gradient(#f5b83d,#c9871a);color:#10121a;display:flex;align-items:center;justify-content:center;font-size:22px;margin-top:6px}`;document.head.append(css);
window.Corrida={pista,avatar,podio};
})();
