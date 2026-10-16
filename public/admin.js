'use strict';
const $=id=>document.getElementById(id);
function h(t,p,...f){const e=document.createElement(t);for(const [k,v] of Object.entries(p||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='style')e.style.cssText=v;else if(k in e&&k!=='list'&&k!=='for')e[k]=v;else e.setAttribute(k,v)}
  for(const c of f.flat())if(c!==null&&c!==undefined&&c!==false)e.append(c.nodeType?c:document.createTextNode(c));return e}
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
function aviso(t,erro){const m=$('msg');m.textContent=t;m.className='msg'+(erro?' erro':'');m.hidden=false;clearTimeout(aviso.t);aviso.t=setTimeout(()=>m.hidden=true,3500)}
async function enviar(corpo){const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.erro||'Erro');return d}
function lerAbertos(){try{const v=localStorage.getItem('liga_niveis_abertos');return v?JSON.parse(v):null}catch{return null}}
function salvarAbertos(ds){try{localStorage.setItem('liga_niveis_abertos',JSON.stringify(ds.filter(x=>x.open).map(x=>x.dataset.nv)))}catch{}}
const PERM_INFO={site:['Site','personalizar: cores, logo, fundos, avisos, agenda e redes'],aulas:['Aulas','mudar o nível de cada aula'],pessoas:['Pessoas','cadastrar alunos e monitores (não mexe em owners)'],tarefas:['Tarefas','ver as tarefas de casa'],presenca:['Presença','chamada, participações e histórico'],slides:['Slides','editar os slides dos níveis a que a pessoa está vinculada pela turma (/editor)']};
const PODE={site:'personalizar o site e publicar avisos, agenda e redes',aulas:'mudar o nível de cada aula',pessoas:'cadastrar alunos e monitores',tarefas:'ver as tarefas de casa',presenca:'fazer a chamada de todas as aulas e ver o histórico',slides:'editar os slides dos níveis a que está vinculada pela turma'};
const NAO={site:'personalizar o site',aulas:'mudar o nível das aulas',pessoas:'cadastrar pessoas',tarefas:'ver as tarefas de casa',presenca:'fazer chamada (fora das aulas de monitor)',slides:'editar slides'};
let D=null,ABA='',FILTRO='todos',TURMA_F='',BUSCA='';

// ---------- cálculo por pessoa ----------
function todasPessoas(){const s=new Set([...(D.owners||[]),...(D.fixos||[]),...(D.alunos||[]),...Object.keys(D.monitores||{}),...Object.keys(D.equipe||{}),...Object.keys(D.acessos||{})]);return [...s].sort()}
function info(n){
  const owner=(D.owners||[]).includes(n)||(D.fixos||[]).includes(n),fixo=(D.fixos||[]).includes(n);
  const mon=(D.monitores||{})[n],eq=(D.equipe||{})[n],aluno=(D.alunos||[]).includes(n);
  const turmas=Object.keys(D.turmas||{}).filter(t=>D.turmas[t].alunos.includes(n));const extras=((D.acessos||{})[n]||[]);
  const cargos=(eq&&eq.cargos)||[];const origem={};
  let perms=new Set();
  if(owner)Object.keys(PERM_INFO).forEach(p=>perms.add(p));
  else if(eq){(eq.permissoes||[]).forEach(p=>{perms.add(p);(origem[p]=origem[p]||[]).push('extra')});for(const c of cargos)for(const p of ((D.cargos||{})[c]||{}).permissoes||[]){perms.add(p);(origem[p]=origem[p]||[]).push(D.cargos[c].nome)}}
  return {n,owner,fixo,aluno,mon,eq,turmas,cargos,extras,perms:[...perms],origem,editor:(D.editores||{})[n]||[]}
}
function emPalavras(i,aulasMap){
  const pode=[],nao=[];
  if(i.owner)return {pode:['tudo: abrir slides e roteiros, mudar níveis, cadastrar pessoas, personalizar o site, fazer chamada e criar cargos e turmas.'],nao:[]};
  for(const p of Object.keys(PODE)){if(i.perms.includes(p))pode.push(PODE[p]);else if(!(p==='presenca'&&i.mon))nao.push(NAO[p])}
  if(i.mon){const a=i.mon.aulas.length,r=i.mon.roteiros.length;
    pode.push(a||r?`abrir slides de ${a} aula(s) e roteiro de ${r}; fazer a chamada dessas aulas${i.mon.turmas.length?' nas turmas '+i.mon.turmas.join(', '):' em todas as turmas'}`:'nada além do que um aluno vê (nenhuma aula liberada ainda)')}
  for(const v of i.editor||[])pode.push(`editar os slides de ${v.includes('/')?'a aula '+v:'todo o '+v} (editor)`);
  for(const x of (i.extras||[]).filter(x=>x.ate>=(D.hoje||'')))pode.push(`ver os slides de ${nomeNivel(x.nivel)} até ${x.ate.split('-').reverse().join('/')} (acesso extra)`);
  if(i.aluno||i.mon||i.eq)pode.push('ver as aulas de nível Membros'+(i.aluno?' e a própria presença':''));
  if(!i.perms.includes('aulas')&&!i.perms.includes('pessoas'))nao.unshift('abrir o Painel');
  return {pode,nao:[...new Set(nao)]}
}
function pillsPapel(i){const s=[];
  if(i.owner)s.push(h('span',{class:'pill o'},'Owner'));
  for(const c of i.cargos)if(D.cargos&&D.cargos[c])s.push(h('span',{class:'pill e'},D.cargos[c].nome));
  if(i.eq&&!i.cargos.length&&!i.owner)s.push(h('span',{class:'pill e'},'Equipe'));
  if(i.mon)s.push(h('span',{class:'pill m'},'Monitor'));
  if(i.aluno)s.push(h('span',{class:'pill'},'Aluno'));
  for(const t of i.turmas)s.push(h('span',{class:'pill t'},(D.turmas[t]||{}).nome||t));
  for(const x of i.extras||[])s.push(h('span',{class:'pill t',title:x.motivo||''},'Extra: '+nomeNivel(x.nivel)+(x.ate<(D.hoje||'')?' (vencido)':' até '+x.ate.split('-').reverse().join('/'))));
  return s}

// ---------- modal / gaveta ----------
function camada(corpo,classe){const veu=h('div',{class:'veu'});const box=h('div',{class:classe},corpo);const fechar=()=>{veu.remove();box.remove();document.removeEventListener('keydown',tecla)};
  const tecla=e=>{if(e.key==='Escape')fechar()};document.addEventListener('keydown',tecla);veu.addEventListener('click',fechar);document.body.append(veu,box);return {fechar,box}}

// ---------- aba Pessoas ----------
function desenharPessoas(){
  const p=$('p-pessoas');p.textContent='';
  const todos=todasPessoas();
  const filtros=[['todos','Todos'],['owner','Owners'],['equipe','Equipe'],['monitor','Monitores'],['aluno','Alunos']];
  const barra=h('div',{class:'filtros'},...filtros.map(([k,t])=>h('button',{type:'button',class:'chipx'+(FILTRO===k?' on':''),onclick:()=>{FILTRO=k;desenharPessoas()}},t)));
  const sel=h('select',{onchange:e=>{TURMA_F=e.target.value;desenharPessoas()}},h('option',{value:''},'Todas as turmas'),...Object.keys(D.turmas).map(t=>h('option',{value:t},D.turmas[t].nome)));sel.value=TURMA_F;
  const busca=h('input',{type:'search',placeholder:'buscar usuário',value:BUSCA,oninput:e=>{BUSCA=e.target.value.toLowerCase();clearTimeout(busca.t);busca.t=setTimeout(()=>{desenharPessoas();const n=$('p-pessoas').querySelector('input[type=search]');n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)}});
  barra.append(sel,busca,h('span',{style:'flex:1'}),h('button',{class:'btn sec',type:'button',onclick:()=>modalVarios()},'+ Adicionar várias'),h('button',{class:'btn',type:'button',onclick:()=>abrirGaveta('')},'+ Nova pessoa'));
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Uma linha por pessoa. Os selos mostram o que ela é; a frase mostra o que ela pode fazer. Clique em Editar para mudar papéis, turmas, cargos e aulas.'),barra);
  const lista=todos.map(info).filter(i=>(FILTRO==='todos'||(FILTRO==='owner'&&i.owner)||(FILTRO==='equipe'&&i.eq)||(FILTRO==='monitor'&&i.mon)||(FILTRO==='aluno'&&i.aluno))&&(!TURMA_F||i.turmas.includes(TURMA_F))&&(!BUSCA||i.n.includes(BUSCA)));
  const caixa=h('div',{class:'lista-cartao'});
  if(!lista.length)caixa.append(h('p',{},'Ninguém por aqui com esse filtro.'));
  for(const i of lista){const w=emPalavras(i);
    caixa.append(h('div',{class:'pessoa'},h('b',{},'@'+i.n),h('div',{},h('div',{},...pillsPapel(i)),h('div',{class:'pode'},i.owner?'Pode tudo.':(w.pode[0]?'Pode '+w.pode[0].replace(/;.*$/,''):''))),
      h('button',{class:'btn sec',type:'button',onclick:()=>abrirGaveta(i.n)},'Editar')))}
  p.append(caixa,h('p',{class:'sub'},`${lista.length} de ${todos.length} pessoa(s)`+((D.fixos||[]).length?` · Owners fixos (variável ADMIN_USERS): ${D.fixos.join(', ')}`:'')))
}

function abrirGaveta(nome){
  const i0=nome?info(nome):null;const dono=D.dono;
  const E={usuario:nome,owner:i0?i0.owner:false,aluno:i0?i0.aluno:true,turmas:new Set(i0?i0.turmas:[Object.keys(D.turmas).find(t=>D.turmas[t].status==='andamento')||Object.keys(D.turmas)[0]]),
    monitor:!!(i0&&i0.mon),mturmas:new Set(i0&&i0.mon?i0.mon.turmas:[]),aulas:new Set(i0&&i0.mon?i0.mon.aulas:[]),roteiros:new Set(i0&&i0.mon?i0.mon.roteiros:[]),
    acessos:(i0?i0.extras:[]).map(x=>({...x})),equipe:!!(i0&&i0.eq),cargos:new Set(i0?i0.cargos:[]),extras:new Set(i0&&i0.eq?i0.eq.permissoes:[]),editor:new Set((D.editores||{})[nome]||[])};
  if(!nome){E.aluno=true}
  const {fechar,box}=camada([],'gaveta');
  const rascunhoInfo=()=>info2(E);
  function info2(e){const eq=e.equipe?{permissoes:[...e.extras],cargos:[...e.cargos]}:null;const x={n:e.usuario,owner:e.owner,fixo:i0&&i0.fixo,aluno:e.aluno,extras:e.acessos,mon:e.monitor?{aulas:[...e.aulas],roteiros:[...e.roteiros],turmas:[...e.mturmas]}:null,eq,turmas:[...e.turmas],cargos:eq?eq.cargos:[],perms:[],origem:{},editor:[...e.editor]};
    if(e.owner)Object.keys(PERM_INFO).forEach(p=>x.perms.push(p));else if(eq){const s=new Set(eq.permissoes);eq.permissoes.forEach(p=>(x.origem[p]=x.origem[p]||[]).push('extra'));for(const c of eq.cargos)for(const p of (D.cargos[c]||{}).permissoes||[]){s.add(p);(x.origem[p]=x.origem[p]||[]).push(D.cargos[c].nome)}x.perms=[...s]}return x}
  const chip=(txt,on,fn,cls)=>h('button',{type:'button',class:'chipx '+(cls||'')+(on?' on':''),onclick:fn},txt);
  const ck=(txt,on,fn,dis,extra)=>h('label',{class:'ck',style:'display:inline-flex;margin-right:16px'},h('input',{type:'checkbox',checked:on,disabled:!!dis,onchange:e=>fn(e.target.checked)}),txt,extra||'');
  function desenhar(){
    const y=box.scrollTop;box.textContent='';
    const tot=Object.keys(D.turmas).filter(t=>D.turmas[t].status!=='arquivada'||E.turmas.has(t)||E.mturmas.has(t));
    const nomeIn=h('input',{type:'text',placeholder:'usuário do GitHub (sem @)',value:E.usuario,maxLength:39,oninput:e=>{E.usuario=e.target.value.trim().replace(/^@/,'').toLowerCase()}});
    box.append(h('div',{style:'display:flex;justify-content:space-between;gap:10px;align-items:flex-start'},nome?h('div',{},h('h2',{style:'margin:0;font-size:22px'},'@'+nome),h('div',{class:'sub'},'Ficha da pessoa')):h('div',{},h('h2',{style:'margin:0;font-size:22px'},'Nova pessoa'),nomeIn),h('button',{class:'btn sec',type:'button',onclick:fechar},'Fechar')));
    // 1 papéis
    box.append(h('div',{class:'sec'},h('h3',{},'1. Papéis'),
      ck('Owner',E.owner,v=>{E.owner=v;desenhar()},!dono||(i0&&i0.fixo)||(i0&&nome===D.usuario),dono?'':' (só owners definem)'),
      ck('Aluno',E.aluno,v=>{E.aluno=v;desenhar()}),ck('Monitor (ministra aulas)',E.monitor,v=>{E.monitor=v;desenhar()}),
      dono?ck('Equipe (cargos)',E.equipe,v=>{E.equipe=v;desenhar()}):''));
    if(E.aluno)box.append(h('div',{class:'sec'},h('h3',{},'2. Turma em que estuda'),...tot.map(t=>chip(D.turmas[t].nome+(D.turmas[t].status==='arquivada'?' (arquivada)':''),E.turmas.has(t),()=>{E.turmas.has(t)?E.turmas.delete(t):E.turmas.add(t);desenhar()})),Object.keys(D.turmas).length?'':h('p',{class:'sub'},'Crie uma turma na aba Turmas.')));
    if(E.monitor){
      const bl=h('div',{class:'sec'},h('h3',{},'3. Aulas que ministra'),h('div',{class:'sub'},'Turmas em que ensina (nenhuma marcada = todas):'),...tot.map(t=>chip(D.turmas[t].nome,E.mturmas.has(t),()=>{E.mturmas.has(t)?E.mturmas.delete(t):E.mturmas.add(t);desenhar()})));
      const grupos={};for(const a of D.aulas||[])(grupos[a.nivel]=grupos[a.nivel]||[]).push(a);
      bl.append(h('div',{class:'aulaln sub',style:'border:0'},h('span',{},'Aula'),h('span',{},'Slides'),h('span',{},'Roteiro')));
      Object.keys(grupos).sort().forEach(nv=>{const l=grupos[nv];const n=l.filter(a=>E.aulas.has(a.chave)||E.roteiros.has(a.chave)).length;
        const det=h('details',{class:'nivel pequeno'},h('summary',{},h('span',{class:'nvt'},nv),h('span',{class:'nvc'},n?`${n} marcada(s)`:'nada marcado')));det.open=n>0;
        det.append(h('div',{class:'massa'},h('button',{type:'button',class:'chipx',onclick:()=>{l.forEach(a=>{E.aulas.add(a.chave);if(a.tem_roteiro)E.roteiros.add(a.chave)});desenhar()}},'Marcar o nível todo'),h('button',{type:'button',class:'chipx',onclick:()=>{l.forEach(a=>{E.aulas.delete(a.chave);E.roteiros.delete(a.chave)});desenhar()}},'Limpar')));
        for(const a of l)det.append(h('div',{class:'aulaln'},h('span',{},a.titulo),h('input',{type:'checkbox',checked:E.aulas.has(a.chave),'aria-label':'Slides de '+a.titulo,onchange:e=>{e.target.checked?E.aulas.add(a.chave):E.aulas.delete(a.chave);det.querySelector('.nvc')}}),a.tem_roteiro?h('input',{type:'checkbox',checked:E.roteiros.has(a.chave),'aria-label':'Roteiro de '+a.titulo,onchange:e=>{e.target.checked?E.roteiros.add(a.chave):E.roteiros.delete(a.chave)}}):h('span',{class:'sub'},'–')));
        bl.append(det)});
      box.append(bl)}
    if(E.equipe&&dono){
      const cs=Object.keys(D.cargos);
      const bl=h('div',{class:'sec'},h('h3',{},'4. Cargos (pode ter vários)'),...cs.map(c=>chip(D.cargos[c].nome,E.cargos.has(c),()=>{E.cargos.has(c)?E.cargos.delete(c):E.cargos.add(c);desenhar()},'cargo')),
        cs.length?'':h('p',{class:'sub'},'Ainda não há cargos. Crie na aba Cargos.'),h('div',{class:'sub'},'Os cargos são criados uma vez na aba Cargos e valem para quem os ocupar.'));
      const x=rascunhoInfo();
      for(const p of Object.keys(PERM_INFO)){const on=x.perms.includes(p);bl.append(h('div',{class:'permlinha'},h('span',{class:on?'on':'off'},on?'✓':'–'),h('span',{class:on?'':'off'},h('b',{},PERM_INFO[p][0]),' · '+PERM_INFO[p][1]),h('span',{class:'src'},on&&x.origem[p]?'por '+x.origem[p].join(', '):'')))}
      const det=h('details',{style:'margin-top:10px'},h('summary',{style:'cursor:pointer;font-size:14px'},'Permissões extras só para esta pessoa (opcional)'));
      for(const p of Object.keys(PERM_INFO))det.append(h('label',{class:'ck'},h('input',{type:'checkbox',checked:E.extras.has(p),onchange:e=>{e.target.checked?E.extras.add(p):E.extras.delete(p);desenhar()}}),h('b',{},PERM_INFO[p][0])));
      det.open=E.extras.size>0;bl.append(det);box.append(bl)}
    if(dono){const bl=h('div',{class:'sec'},h('h3',{},'Editor de slides (escopo)'),h('div',{class:'sub'},'Libera o editor (/editor) em um nível inteiro ou numa aula, mesmo sem cargo. Quem tem a permissão "Slides" por cargo edita os níveis a que está vinculado pela turma.'));
      const rot=(v)=>{const [d,i]=v.split('/');const a=(D.aulas||[]).find(x=>x.dir===d&&(!i||x.id===i));const n=((D.aulas||[]).find(x=>x.dir===d)||{}).nivel||d;return i?`${n} · ${a?a.titulo:i}`:`${n} (todas as aulas)`};
      [...E.editor].forEach(v=>bl.append(h('div',{class:'permlinha'},h('span',{class:'on'},'✓'),h('span',{},rot(v)),h('button',{class:'chipx',type:'button',onclick:()=>{E.editor.delete(v);desenhar()}},'Remover'))));
      const ops=[];for(const [d,n] of niveisLista()){ops.push([d,n+' (todas as aulas)']);for(const a of (D.aulas||[]).filter(x=>x.dir===d))ops.push([d+'/'+a.id,n+' · '+a.titulo])}
      const sl=h('select',{},...ops.filter(o=>!E.editor.has(o[0])).map(o=>h('option',{value:o[0]},o[1])));
      bl.append(sl.options.length?h('div',{style:'display:flex;gap:6px;margin-top:8px'},sl,h('button',{class:'chipx',type:'button',onclick:()=>{E.editor.add(sl.value);desenhar()}},'+ Liberar')):h('p',{class:'sub'},'Nada mais a liberar.'));box.append(bl)}
    {const bl=h('div',{class:'sec'},h('h3',{},'Acesso extra ao material'),h('div',{class:'sub'},'Libera os slides de um nível para esta pessoa por um tempo (ex.: ex-aluno que pediu para rever). Não inclui roteiro nem chamada.'));
      E.acessos.forEach((a,k)=>{const nv=h('select',{onchange:e=>{a.nivel=e.target.value}},...niveisLista().map(([d,t])=>h('option',{value:d},t)));nv.value=a.nivel;
        bl.append(h('div',{style:'display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin:8px 0;align-items:center'},nv,h('input',{type:'date',value:a.ate,onchange:e=>{a.ate=e.target.value}}),h('button',{class:'chipx',type:'button',onclick:()=>{E.acessos.splice(k,1);desenhar()}},'Remover'),
          h('input',{type:'text',value:a.motivo||'',maxLength:80,placeholder:'motivo (ex.: pediu para rever)',style:'grid-column:1/-1',oninput:e=>{a.motivo=e.target.value}})))});
      const nvs=niveisLista();bl.append(nvs.length?h('button',{class:'chipx',type:'button',onclick:()=>{const d=new Date();d.setFullYear(d.getFullYear()+1);E.acessos.push({nivel:nvs[0][0],ate:d.toISOString().slice(0,10),motivo:''});desenhar()}},'+ Acrescentar acesso'):h('p',{class:'sub'},'Carregando níveis…'));box.append(bl)}
    const x=rascunhoInfo();const w=emPalavras(x);
    box.append(h('div',{class:'palavras',style:'margin-top:12px'},h('b',{},'Em palavras: o que '+(E.usuario?'@'+E.usuario:'a pessoa')+' poderá fazer'),h('br'),h('span',{class:'pode-s'},'Pode: '),w.pode.join('; ')+'.',h('br'),w.nao.length?[h('span',{class:'nao-s'},'Não pode: '),w.nao.join('; ')+'.']:''));
    const salvar=h('button',{class:'btn',type:'button',onclick:async()=>{
      if(!/^[a-z0-9][a-z0-9-]{0,38}$/i.test(E.usuario)){aviso('Informe um usuário do GitHub válido.',1);return}
      const c={acao:'pessoa',usuario:E.usuario,acessos:E.acessos,aluno:E.aluno,turmas:[...E.turmas],monitor:E.monitor,aulas:[...E.aulas],roteiros:[...E.roteiros],monitor_turmas:[...E.mturmas]};
      if(dono){c.owner=E.owner;c.equipe=E.equipe;c.cargos=[...E.cargos];c.extras=[...E.extras];c.editor=[...E.editor]}
      try{await enviar(c);aviso('Ficha salva');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Salvar');
    const rm=nome?h('button',{class:'btn sec',type:'button',onclick:async()=>{if(!confirm(`Remover @${nome} de alunos, monitores${dono?' e equipe':''}? (Owners saem pela ficha, desmarcando Owner.)`))return;try{await enviar({acao:'remover_pessoa',usuario:nome});aviso('Removido');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Remover pessoa'):'';
    box.append(h('div',{class:'rodape-g'},h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},h('button',{class:'btn sec',type:'button',onclick:()=>verComo(rascunhoInfo())},'Ver como '+(E.usuario?'@'+E.usuario:'esta pessoa')),rm),h('div',{style:'display:flex;gap:8px'},h('button',{class:'btn sec',type:'button',onclick:fechar},'Cancelar'),salvar)));
    box.scrollTop=y}
  desenhar()}

function verComo(i){
  const p=i.perms,botoes=[['Aulas',1,'btn']];
  if(p.includes('aulas')||p.includes('pessoas'))botoes.push(['Painel',1]);if(p.includes('site'))botoes.push(['Personalizar',1]);if(p.includes('tarefas'))botoes.push(['Tarefas de casa',1]);if(p.includes('presenca')||(i.mon&&i.mon.aulas.length))botoes.push(['Presença',1]);botoes.push(['Sair',1]);
  const sem=[];if(!(p.includes('aulas')||p.includes('pessoas')))sem.push('Painel');if(!p.includes('site'))sem.push('Personalizar');if(!p.includes('tarefas'))sem.push('Tarefas de casa');if(!(p.includes('presenca')||(i.mon&&i.mon.aulas.length)))sem.push('Presença');if(!i.owner)sem.push('roteiros que não foram liberados','aulas marcadas como Só owners');
  const {fechar}=camada([h('div',{class:'banner-ver'},h('span',{},h('b',{},'Você está vendo como '+(i.n?'@'+i.n:'esta pessoa')+'.'),' Somente leitura: nada aqui altera dados.'),h('button',{class:'btn',type:'button',style:'background:#1a1230;color:#fff',onclick:()=>fechar()},'Sair desta visualização')),
    h('div',{class:'hero'},h('p',{class:'tag'},'LIGA ACADÊMICA DE GAMES · CEUMA'),h('h2',{},'Início'),h('div',{},...pillsPapel(i)),h('p',{class:'sub',style:'margin-top:10px'},'Aqui você encontra as aulas, os avisos e a agenda da liga.')),
    h('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px'},...botoes.map(([t],k)=>h('button',{type:'button',class:'btn'+(k?' sec':'')},t))),
    h('div',{class:'dica'},h('b',{},'O que não aparece para esta pessoa'),h('br'),sem.join(' · ')||'Nada: ela vê tudo.')],'modal');
}

function modalVarios(){
  const turmasAtivas=Object.keys(D.turmas).filter(t=>D.turmas[t].status!=='arquivada');
  let papel='aluno',turma=turmasAtivas.find(t=>D.turmas[t].status==='andamento')||turmasAtivas[0];
  const ta=h('textarea',{style:'height:170px;font-family:monospace;width:100%',placeholder:'davi-novato\n@luiza-dev\nhttps://github.com/pedro-h',oninput:prev});
  const lado=h('div'),res=h('div',{style:'background:#0006;border-radius:12px;padding:12px 16px;margin-top:14px'}),btn=h('button',{class:'btn',type:'button'},'Adicionar');
  const conhecidos=new Set(todasPessoas());
  function analisa(){const out=[];const vistos=new Set();
    for(const bruto of ta.value.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean)){
      const n=bruto.replace(/^https?:\/\/github\.com\//i,'').replace(/[/?#].*$/,'').replace(/^@/,'').toLowerCase();
      let erro='';if(/\s/.test(n))erro='espaço no nome';else if(n.includes('_'))erro='o GitHub não aceita _';else if(!/^[a-z0-9][a-z0-9-]{0,38}$/.test(n))erro='caractere inválido';
      if(!erro&&vistos.has(n))continue;vistos.add(n);out.push({n,erro,ja:!erro&&conhecidos.has(n),link:/github\.com/i.test(bruto)})}
    return out}
  function prev(){const l=analisa(),ok=l.filter(x=>!x.erro),ruim=l.filter(x=>x.erro);res.textContent='';
    res.append(h('div',{style:'font-weight:700;margin-bottom:6px'},h('span',{class:'pode-s'},ok.length+' válido(s)'),' · ',h('span',{class:'nao-s'},ruim.length+' inválido(s)'),' · '+l.filter(x=>x.ja).length+' já cadastrado(s)'));
    for(const x of l)res.append(h('div',{class:'permlinha',style:'grid-template-columns:1fr auto'},h('span',{},'@'+x.n),h('span',{class:x.erro?'nao-s':'pode-s'},x.erro?'inválido: '+x.erro:(x.ja?'já existe (será atualizado)':'ok'+(x.link?' (do link)':'')))));
    btn.textContent='Adicionar '+ok.length;btn.disabled=!ok.length}
  function lados(){lado.textContent='';lado.append(h('div',{style:'font-weight:700;margin-bottom:6px'},'Entram como'),
    ...[['aluno','Aluno'],['monitor','Monitor'],...(D.dono?[['equipe','Equipe']]:[])].map(([k,t])=>h('button',{type:'button',class:'chipx'+(papel===k?' on':''),onclick:()=>{papel=k;lados()}},t)),
    h('div',{style:'font-weight:700;margin:10px 0 6px'},'Na turma'),...turmasAtivas.map(t=>h('button',{type:'button',class:'chipx'+(turma===t?' on':''),onclick:()=>{turma=t;lados()}},D.turmas[t].nome)),h('p',{class:'sub'},'Depois dá para mudar cada pessoa na ficha.'))}
  btn.onclick=async()=>{const ok=analisa().filter(x=>!x.erro).map(x=>x.n);try{await enviar({acao:'adicionar',usuarios:ok,papel,turma});aviso(`${ok.length} pessoa(s) adicionada(s)`);fechar();await carregar()}catch(e){aviso(e.message,1)}};
  const {fechar}=camada([h('div',{style:'display:flex;justify-content:space-between'},h('h2',{style:'margin:0'},'Adicionar várias pessoas'),h('button',{class:'btn sec',type:'button',onclick:()=>fechar()},'Fechar')),
    h('p',{class:'sub'},'Cole os usuários do GitHub, um por linha ou separados por vírgula. Aceita @ e links do GitHub.'),h('div',{class:'grid'},h('div',{},ta),lado),res,h('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:14px'},h('button',{class:'btn sec',type:'button',onclick:()=>fechar()},'Cancelar'),btn)],'modal');
  lados();prev()}

// ---------- aba Cargos ----------
function desenharCargos(){
  const p=$('p-cargos');p.textContent='';
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Um cargo é um modelo: você define as permissões uma vez e depois só escolhe quem ocupa (na ficha da pessoa). Uma pessoa pode ter vários cargos. Só owners criam cargos.'));
  const g=h('div',{class:'grade'});
  for(const id of Object.keys(D.cargos)){const c=D.cargos[id];const ocup=Object.keys(D.equipe||{}).filter(n=>(D.equipe[n].cargos||[]).includes(id));
    const nome=h('input',{type:'text',value:c.nome,maxLength:40,style:'width:100%;font-weight:700'}),desc=h('input',{type:'text',value:c.descricao||'',maxLength:100,placeholder:'descrição curta',style:'width:100%;margin:6px 0'});
    const cx=Object.keys(PERM_INFO).map(k=>h('label',{class:'ck'},h('input',{type:'checkbox',checked:c.permissoes.includes(k),'data-k':k}),h('b',{},PERM_INFO[k][0]),h('span',{class:'sub'},PERM_INFO[k][1])));
    g.append(h('div',{class:'cartao2'},nome,desc,...cx,h('div',{class:'sub',style:'margin-top:10px'},`Quem ocupa (${ocup.length})`),h('div',{},...ocup.map(n=>h('span',{class:'pill e'},'@'+n))),
      h('div',{style:'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap'},h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'cargo',id,nome:nome.value,descricao:desc.value,permissoes:cx.map(l=>l.querySelector('input')).filter(x=>x.checked).map(x=>x.dataset.k)});aviso('Cargo salvo');await carregar()}catch(e){aviso(e.message,1)}}},'Salvar'),
        h('button',{class:'btn sec',type:'button',onclick:async()=>{if(!confirm(`Apagar o cargo "${c.nome}"? Quem o ocupa perde as permissões dele.`))return;try{await enviar({acao:'remover_cargo',id});aviso('Cargo apagado');await carregar()}catch(e){aviso(e.message,1)}}},'Apagar'))))}
  g.append(h('div',{class:'cartao2 tracejado'},h('button',{class:'btn',type:'button',onclick:async()=>{const n=prompt('Nome do novo cargo (ex.: Secretaria, Vice-presidência):');if(!n)return;try{await enviar({acao:'cargo',nome:n,permissoes:[]});aviso('Cargo criado: marque as permissões e salve');await carregar()}catch(e){aviso(e.message,1)}}},'+ Novo cargo'),h('div',{class:'sub'},'Ex.: Vice-presidência, Eventos, Monitoria geral')));
  p.append(g);
  const det=h('div',{class:'cartao2'},h('h3',{},'O que cada permissão libera'),...Object.keys(PERM_INFO).map(k=>h('div',{style:'margin:6px 0;font-size:14px'},h('b',{},PERM_INFO[k][0]+': '),PERM_INFO[k][1]+'.')),h('div',{class:'sub'},'Owners sempre têm tudo.'));
  p.append(det)}

// ---------- aba Turmas ----------
function niveisLista(){const m={};for(const a of D.aulas||[])m[a.dir]=a.nivel;return Object.entries(m).sort((x,y)=>x[0].localeCompare(y[0]))}
const nomeNivel=d=>d?((niveisLista().find(x=>x[0]===d)||[])[1]||d):'Todos os níveis';
function desenharTurmas(){
  const p=$('p-turmas');p.textContent='';
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Uma turma é um grupo de alunos que percorre os níveis junto. A chamada, a presença e os certificados sempre pertencem a uma turma. O conteúdo das aulas é o mesmo para todas.'));
  const g=h('div',{class:'grade'});const ROT={andamento:'Em andamento',planejada:'Planejada',arquivada:'Arquivada'};
  for(const id of Object.keys(D.turmas)){const t=D.turmas[id];const mons=Object.keys(D.monitores).filter(n=>D.monitores[n].turmas.includes(id)).length;
    const trocar=async(status)=>{try{await enviar({acao:'turma',id,nome:t.nome,status});aviso('Turma atualizada');await carregar()}catch(e){aviso(e.message,1)}};
    g.append(h('div',{class:'cartao2'},h('div',{style:'display:flex;justify-content:space-between;align-items:center'},h('h3',{},t.nome),h('span',{class:'st '+t.status},ROT[t.status])),
      h('div',{class:'sub'},id!==t.nome?`código ${id} · `:'',t.inicio?'início em '+t.inicio.split('-').reverse().join('/'):'sem data de início',t.fim?' · fim previsto '+t.fim.split('-').reverse().join('/'):''),
      h('div',{style:'margin:4px 0 8px'},h('span',{class:'pill m'},nomeNivel(t.nivel)),t.status==='arquivada'?h('span',{class:'pill t'},t.acessoApos?'material até '+(t.acessoAte||'').split('-').reverse().join('/'):'sem acesso após arquivar'):''),
      h('div',{class:'kv'},h('div',{},h('div',{class:'num'},String(t.alunos.length)),h('div',{class:'sub'},'alunos')),h('div',{},h('div',{class:'num'},String(mons)),h('div',{class:'sub'},'monitores'))),
      h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},h('button',{class:'btn sec',type:'button',onclick:()=>{TURMA_F=id;FILTRO='todos';BUSCA='';mostrar('pessoas')}},'Ver alunos'),
        t.status==='planejada'?h('button',{class:'btn',type:'button',onclick:()=>trocar('andamento')},'Abrir a turma'):'',
        t.status==='andamento'?h('button',{class:'btn sec',type:'button',onclick:()=>trocar('arquivada')},'Arquivar'):'',
        t.status==='arquivada'?h('button',{class:'btn sec',type:'button',onclick:()=>trocar('andamento')},'Reabrir'):'',
        t.alunos.length?h('button',{class:'btn',type:'button',onclick:()=>modalPromover(id)},'Promover alunos…'):'',t.alunos.length?h('button',{class:'btn sec',type:'button',onclick:()=>modalMover(id)},'Mover…'):'',
        h('button',{class:'btn sec',type:'button',onclick:()=>modalTurma(id)},'Editar'))))}
  g.append(h('div',{class:'cartao2 tracejado'},h('button',{class:'btn',type:'button',onclick:()=>modalTurma('')},'+ Nova turma'),h('div',{class:'sub'},'Dê um código curto (ex.: 2027.2). Alunos novos entram na turma em andamento ou na que você escolher.')));
  p.append(g,h('div',{class:'dica'},h('b',{},'Turma encerrada? '),'Use Arquivar: ela some das listas do dia a dia, mas a presença e os certificados continuam guardados.'))}
function modalTurma(id){
  const t=id?D.turmas[id]:{nome:'',status:'planejada',inicio:'',fim:'',nivel:'',acessoApos:true,acessoAte:''};
  const cod=h('input',{type:'text',value:id,maxLength:20,placeholder:'ex.: 2026.2-N0',style:'text-transform:uppercase',oninput:e=>{e.target.value=e.target.value.toUpperCase().replace(/\s+/g,'-')}}),nome=h('input',{type:'text',value:t.nome,maxLength:40,placeholder:'ex.: Nível 0 · 2026.2'}),ini=h('input',{type:'date',value:t.inicio}),fim=h('input',{type:'date',value:t.fim||''}),
    st=h('select',{},...[['planejada','Planejada'],['andamento','Em andamento'],['arquivada','Arquivada']].map(([k,x])=>h('option',{value:k},x))),
    nv=h('select',{},h('option',{value:''},'Todos os níveis (sem restrição)'),...niveisLista().map(([k,x])=>h('option',{value:k},x))),
    ap=h('input',{type:'checkbox',checked:t.acessoApos!==false}),ate=h('input',{type:'date',value:t.acessoAte||''});
  st.value=t.status;nv.value=t.nivel||'';
  const mostraAte=()=>{ateL.hidden=st.value!=='arquivada'};st.addEventListener('change',mostraAte);
  const ateL=h('label',{},'Acesso ao material vai até ',ate);
  const excluir=id?h('button',{class:'btn sec',type:'button',onclick:async()=>{if(!confirm(`Excluir a turma "${t.nome}"? Só é possível se ela estiver vazia e sem chamadas.`))return;try{await enviar({acao:'excluir_turma',id});aviso('Turma excluída');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Excluir turma'):'';
  const {fechar}=camada([h('h2',{style:'margin:0 0 12px'},id?'Editar turma':'Nova turma'),h('div',{class:'form'},h('label',{},'Código (sempre em maiúsculas)',cod),h('label',{},'Nome',nome),h('label',{},'Nível da turma',nv),h('label',{},'Situação',st),h('label',{},'Início',ini),h('label',{},'Fim previsto',fim)),
    id?h('p',{class:'sub'},'Código, nome, nível e datas podem ser corrigidos depois. O código só muda enquanto a turma não tem chamadas salvas.'):'',
    h('label',{class:'ck'},ap,'Mantém acesso ao material (slides) por 1 ano depois de arquivada'),ateL,
    h('p',{class:'sub'},'Os alunos da turma só veem as aulas do nível dela (e que estejam como Membros ou Público). Roteiros nunca aparecem para alunos. Passado o prazo, o acesso ao material dessa turma se encerra; para estender, edite a data acima.'),
    h('div',{style:'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap'},excluir||h('span'),h('div',{style:'display:flex;gap:8px'},h('button',{class:'btn sec',type:'button',onclick:()=>fechar()},'Cancelar'),h('button',{class:'btn',type:'button',onclick:async()=>{try{
      let alvo=cod.value.trim().toUpperCase();if(id&&alvo&&alvo!==id){await enviar({acao:'renomear_turma',de:id,para:alvo})}if(!id||!alvo)alvo=alvo||id;
      await enviar({acao:'turma',id:alvo,nome:nome.value,inicio:ini.value,fim:fim.value,nivel:nv.value,status:st.value,acessoApos:ap.checked,acessoAte:st.value==='arquivada'?ate.value:''});aviso('Turma salva');fechar();await carregar()}catch(e){aviso(e.message,1);if(id)await carregar()}}},'Salvar')))],'modal');mostraAte();}
function modalPromover(de){
  const outras=Object.keys(D.turmas).filter(t=>t!==de&&D.turmas[t].status!=='arquivada');
  if(!outras.length){aviso('Crie a turma de destino primeiro (+ Nova turma).',1);return}
  const para=h('select',{},...outras.map(t=>h('option',{value:t},D.turmas[t].nome+' · '+nomeNivel(D.turmas[t].nivel))));
  const marcados=new Set(D.turmas[de].alunos);const lista=h('div',{style:'max-height:42vh;overflow:auto;border:1px solid #fff2;border-radius:10px;padding:6px 12px'});
  const cont=h('b',{});const conta=()=>{cont.textContent=`${marcados.size} de ${D.turmas[de].alunos.length} marcados`};
  for(const a of D.turmas[de].alunos)lista.append(h('label',{class:'ck'},h('input',{type:'checkbox',checked:true,onchange:e=>{e.target.checked?marcados.add(a):marcados.delete(a);conta()}}),'@'+a));
  const todos=(v)=>{lista.querySelectorAll('input').forEach((x,i)=>{x.checked=v;const a=D.turmas[de].alunos[i];v?marcados.add(a):marcados.delete(a)});conta()};
  conta();
  const {fechar}=camada([h('h2',{style:'margin:0 0 6px'},'Promover alunos de '+D.turmas[de].nome),
    h('p',{class:'sub'},'Os alunos marcados entram na turma de destino. Quem você desmarcar (não passou, desistiu) fica só na turma atual. Os promovidos continuam também na turma de origem, que guarda o histórico de presença e, se arquivada com acesso, o material do nível concluído. Depois você pode editar a lista da turma nova.'),
    h('label',{},'Para a turma ',para),h('div',{style:'display:flex;gap:8px;align-items:center;margin:10px 0'},h('button',{class:'chipx',type:'button',onclick:()=>todos(true)},'Marcar todos'),h('button',{class:'chipx',type:'button',onclick:()=>todos(false)},'Desmarcar todos'),cont),lista,
    h('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:14px'},h('button',{class:'btn sec',type:'button',onclick:()=>fechar()},'Cancelar'),h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'promover',de,para:para.value,usuarios:[...marcados]});aviso(`${marcados.size} aluno(s) promovido(s)`);fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Promover'))],'modal');}
function modalMover(de){
  const outras=Object.keys(D.turmas).filter(t=>t!==de);if(!outras.length){aviso('Crie outra turma primeiro.',1);return}
  const para=h('select',{},...outras.map(t=>h('option',{value:t},D.turmas[t].nome)));
  const {fechar}=camada([h('h2',{style:'margin:0 0 8px'},'Mover alunos da turma '+D.turmas[de].nome),h('p',{class:'sub'},`Move todos os ${D.turmas[de].alunos.length} aluno(s) (saem desta turma). Use para corrigir cadastro; para avançar de nível use Promover.`),h('label',{},'Para a turma ',para),
    h('div',{style:'display:flex;justify-content:flex-end;gap:8px;margin-top:14px'},h('button',{class:'btn sec',type:'button',onclick:()=>fechar()},'Cancelar'),h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'mover_turma',de,para:para.value});aviso('Alunos movidos');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Mover'))],'modal');}

// ---------- aba Pontuação (owners) ----------
async function desenharPontos(){
  const p=$('p-pontos');p.textContent='';const c=D.pontuacao;if(!c){p.append(h('p',{},'Só owners configuram a pontuação.'));return}
  const inp=(v,max=100,step=1)=>h('input',{type:'number',min:0,max,step,value:v,style:'width:90px'});
  const pr=inp(c.pesos.presenca),pa=inp(c.pesos.participacao),ex=inp(c.pesos.exercicios),meta=inp(c.meta,500),top=h('input',{type:'checkbox',checked:c.top5Visivel});
  const tipos={};const linhasTipos=Object.entries(D.tiposParticipacao).map(([k,t])=>{const i=inp(c.tipos[k],5,0.5);tipos[k]=i;return h('label',{class:'ck'},i,t)});
  const soma=h('b',{});const calc=()=>{soma.textContent=String((+pr.value||0)+(+pa.value||0)+(+ex.value||0))};[pr,pa,ex].forEach(x=>x.addEventListener('input',calc));calc();
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Nota final do aluno = presença + participação + exercícios − penalidades. Os pesos abaixo valem para todas as turmas; você pode mudar só uma turma mais abaixo.'),
    h('div',{class:'grade'},
      h('div',{class:'cartao2'},h('h3',{},'Pesos padrão'),h('label',{class:'ck'},pr,'Presença'),h('label',{class:'ck'},pa,'Participação'),h('label',{class:'ck'},ex,'Exercícios'),h('div',{class:'sub'},'Soma dos pesos (nota máxima): ',soma),
        h('label',{class:'ck',style:'margin-top:10px'},meta,'Meta de participação (pontos para ganhar o peso inteiro)'),h('label',{class:'ck'},top,'Alunos veem o Top 5 da turma')),
      h('div',{class:'cartao2'},h('h3',{},'Valor de cada tipo de participação'),h('div',{class:'sub'},'Multiplicador dos pontos que o professor dá (1 = normal, 2 = vale o dobro, 0 = não conta).'),...linhasTipos)),
    h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'pontuacao',pesos:{presenca:pr.value,participacao:pa.value,exercicios:ex.value},meta:meta.value,top5Visivel:top.checked,tipos:Object.fromEntries(Object.entries(tipos).map(([k,i])=>[k,i.value]))});aviso('Pontuação padrão salva');await carregar()}catch(e){aviso(e.message,1)}}},'Salvar pontuação padrão'));
  const ids=Object.keys(D.turmas);const sel=h('select',{},...ids.map(t=>h('option',{value:t},D.turmas[t].nome)));
  const box=h('div',{class:'cartao2',style:'margin-top:16px'});
  const ver=async()=>{box.textContent='';const t=D.turmas[sel.value];const o=t.pesos||{};const a=inp(o.presenca===undefined?c.pesos.presenca:o.presenca),b=inp(o.participacao===undefined?c.pesos.participacao:o.participacao),d=inp(o.exercicios===undefined?c.pesos.exercicios:o.exercicios);
    box.append(h('h3',{},'Turma '+t.nome),h('div',{class:'sub'},t.pesos?'Esta turma tem pesos próprios.':'Esta turma usa os pesos padrão.'),h('div',{style:'display:flex;gap:14px;flex-wrap:wrap'},h('label',{class:'ck'},a,'Presença'),h('label',{class:'ck'},b,'Participação'),h('label',{class:'ck'},d,'Exercícios')),
      h('div',{style:'display:flex;gap:8px;margin:8px 0'},h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'pontuacao',turma:sel.value,pesos:{presenca:a.value,participacao:b.value,exercicios:d.value}});aviso('Pesos da turma salvos');await carregar()}catch(e){aviso(e.message,1)}}},'Salvar para esta turma'),t.pesos?h('button',{class:'btn sec',type:'button',onclick:async()=>{try{await enviar({acao:'pontuacao',turma:sel.value,padrao:true});aviso('Voltou ao padrão');await carregar()}catch(e){aviso(e.message,1)}}},'Voltar ao padrão'):''));
    const r=await fetch('/api/presenca?acao=ranking&turma='+encodeURIComponent(sel.value));
    if(r.ok){const R=await r.json();box.append(h('div',{style:'font-weight:700;margin:8px 0 4px'},t.status==='arquivada'&&t.rankingFinal?'Top 5 final (congelado)':'Top 5 agora'),...(t.status==='arquivada'&&t.rankingFinal?t.rankingFinal.map((x,i)=>({posicao:i+1,usuario:x.usuario,total:x.total})):R.ranking.slice(0,5)).map(x=>h('div',{class:'permlinha',style:'grid-template-columns:40px 1fr auto'},h('span',{},x.posicao+'º'),h('span',{},'@'+x.usuario),h('b',{},String(x.total)))),R.ranking.length?'':h('div',{class:'sub'},'Ainda sem alunos nesta turma.'))}};
  sel.addEventListener('change',ver);p.append(h('h3',{style:'margin:22px 0 8px'},'Pesos por turma e Top 5'),sel,box);ver()}

// ---------- aba Níveis das aulas ----------
function desenharAulas(d){
  const box=$('aulas');box.textContent='';
  const INFO={owners:'Quem vê: só owners.',membros:'Quem vê: owners, monitores e alunos da lista (precisa entrar com o GitHub).',publico:'Quem vê: qualquer pessoa com o link, sem login.'};
  const NOMES={owners:'Só owners',membros:'Membros',publico:'Público'};
  const grupos={};for(const a of d.aulas)(grupos[a.nivel]=grupos[a.nivel]||[]).push(a);
  const aberto=lerAbertos();const nomesNiveis=Object.keys(grupos).sort();
  const barra=el('div','linha');barra.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px';
  const bx=el('button','btn sec','Expandir tudo'),br=el('button','btn sec','Recolher tudo');
  barra.append(bx,br,el('small','',`${d.aulas.length} aulas em ${nomesNiveis.length} nível(is)`));box.append(barra);
  const todos=[];
  nomesNiveis.forEach((nv,i)=>{const lista=grupos[nv];
    const det=el('details','nivel');det.dataset.nv=nv;det.open=aberto===null?i===0:aberto.includes(nv);todos.push(det);
    det.addEventListener('toggle',()=>salvarAbertos(todos));
    const sm=el('summary');const tt=el('span','nvt',nv);const cont=el('span','nvc');sm.append(tt,cont);
    const atualizaCont=()=>{const c={owners:0,membros:0,publico:0};lista.forEach(a=>c[a.acesso]++);cont.textContent=`${lista.length} aula(s) · ${c.publico} público · ${c.membros} membros · ${c.owners} só owners`};atualizaCont();
    const massa=el('div','massa');massa.append(el('small','','Todas deste nível:'));
    const corpo=el('div','nvcorpo');
    const pintar=(l)=>{l.seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.v===l.a.acesso));l.info.textContent=INFO[l.a.acesso]};
    const linhas=[];
    for(const [v,n] of [['owners','Só owners'],['membros','Membros'],['publico','Público']]){const m=el('button','btn sec',n);m.type='button';
      m.onclick=async()=>{if(!confirm(`Definir as ${lista.length} aulas de "${nv}" como "${n}"?`))return;try{await enviar({acao:'acesso',chaves:lista.map(a=>a.chave),nivel:v,nivel_nome:nv});lista.forEach(a=>a.acesso=v);linhas.forEach(pintar);atualizaCont();aviso(`${nv}: todas em "${n}"`)}catch(e){aviso(e.message,1);carregar()}};massa.append(m)}
    corpo.append(massa);
    for(const a of lista){const l=el('div','linha');const t=el('div','t');t.append(el('b','',a.titulo),el('br'),el('small','',a.chave));
      const info=el('div','nivelinfo',INFO[a.acesso]);const seg=el('div','seg');const reg={a,seg,info};linhas.push(reg);
      for(const [v,n] of [['owners','Só owners'],['membros','Membros'],['publico','Público']]){const bt=el('button',(v===a.acesso?'on ':'')+v,n);bt.type='button';bt.dataset.v=v;
        bt.onclick=async()=>{if(a.acesso===v)return;try{await enviar({acao:'acesso',chave:a.chave,nivel:v});a.acesso=v;pintar(reg);atualizaCont();aviso(`${a.titulo}: ${n}`)}catch(e){aviso(e.message,1);carregar()}};seg.append(bt)}
      const vv=el('a','btn sec','Slides');vv.href=a.url;vv.target='_blank';l.append(t,seg,vv);
      if(a.roteiro){const r=el('a','btn sec','Roteiro');r.href=a.roteiro;r.target='_blank';l.append(r)}l.append(info);corpo.append(l)}
    det.append(sm,corpo);box.append(det)});
  bx.onclick=()=>{todos.forEach(x=>x.open=true)};br.onclick=()=>{todos.forEach(x=>x.open=false)};
}

// ---------- abas ----------
function abasDisponiveis(){const a=[];if(D.permissoes.includes('pessoas'))a.push(['pessoas','Pessoas']);if(D.dono)a.push(['cargos','Cargos']);if(D.permissoes.includes('pessoas'))a.push(['turmas','Turmas']);if(D.dono)a.push(['pontos','Pontuação']);if(D.permissoes.includes('aulas'))a.push(['aulas','Níveis das aulas']);a.push(['guia','Guia']);return a}
function mostrar(k){
  const disp=abasDisponiveis();if(!disp.some(x=>x[0]===k))k=disp[0][0];ABA=k;try{history.replaceState(null,'','#'+k)}catch{}
  $('abas').textContent='';for(const [id,t] of disp)$('abas').append(h('button',{type:'button',class:id===k?'on':'',onclick:()=>mostrar(id)},t));
  for(const [id] of [['pessoas'],['cargos'],['turmas'],['pontos'],['aulas'],['guia']])$('p-'+id).hidden=id!==k;
  if(k==='pessoas')desenharPessoas();else if(k==='cargos')desenharCargos();else if(k==='turmas')desenharTurmas();else if(k==='pontos')desenharPontos();else if(k==='aulas')desenharAulas(D)}
async function carregar(){
  const r=await fetch('/api/admin');
  if(r.status===403){document.querySelector('main').innerHTML='<h1>Sem permissão</h1><p>Esta tela é para owners e para a equipe com permissão. Entre com a sua conta do GitHub ou peça acesso a um owner.</p><a class="btn" href="/api/login?next=/admin">Entrar com GitHub</a> <a class="btn sec" href="/">Início</a>';return}
  D=await r.json();D.turmas=D.turmas||{};D.cargos=D.cargos||{};D.equipe=D.equipe||(D.dono?{}:undefined);
  mostrar(ABA||location.hash.slice(1)||'pessoas')}
carregar();
