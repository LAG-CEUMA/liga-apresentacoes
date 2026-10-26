'use strict';
const $=id=>document.getElementById(id);
function h(t,p,...f){const e=document.createElement(t);for(const [k,v] of Object.entries(p||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='style')e.style.cssText=v;else if(k in e&&k!=='list'&&k!=='for')e[k]=v;else e.setAttribute(k,v)}
  for(const c of f.flat())if(c!==null&&c!==undefined&&c!==false)e.append(c.nodeType?c:document.createTextNode(c));return e}
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
function aviso(t,erro){const m=$('msg');m.textContent=t;m.className='msg'+(erro?' erro':'');m.hidden=false;clearTimeout(aviso.t);aviso.t=setTimeout(()=>m.hidden=true,3500)}
async function enviar(corpo){const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.erro||'Erro');return d}
function lerAbertos(){try{const v=localStorage.getItem('liga_niveis_abertos');return v?JSON.parse(v):null}catch{return null}}
function salvarAbertos(ds){try{localStorage.setItem('liga_niveis_abertos',JSON.stringify(ds.filter(x=>x.open).map(x=>x.dataset.nv)))}catch{}}
const PERM_INFO={site:['Personalizar o site','cores, logo, fundos, avisos, agenda e redes'],aulas:['Mudar o nível das aulas','define quem vê cada aula (só owners ou membros da turma)'],pessoas:['Cadastrar pessoas','cadastrar alunos e monitores (não mexe em owners)'],tarefas:['Ver tarefas de casa (antigo)','sem função hoje: as atividades ficam em Presença'],presenca:['Fazer chamada e presença','chamada, participações e histórico'],slides:['Editar slides','usar o editor (/editor) nos níveis a que a pessoa está vinculada']};
const PODE={site:'personalizar o site e publicar avisos, agenda e redes',aulas:'mudar o nível de cada aula',pessoas:'cadastrar alunos e monitores',tarefas:'ver as tarefas de casa',presenca:'fazer a chamada de todas as aulas e ver o histórico',slides:'editar os slides dos níveis a que está vinculada pela turma'};
const NAO={site:'personalizar o site',aulas:'mudar o nível das aulas',pessoas:'cadastrar pessoas',tarefas:'ver as tarefas de casa',presenca:'fazer chamada (fora das aulas de monitor)',slides:'editar slides'};
let D=null,ABA='',FILTRO='todos',TURMA_F='',BUSCA='';

// ---------- cálculo por pessoa ----------
function todasPessoas(){const s=new Set([...(D.owners||[]),...(D.fixos||[]),...(D.alunos||[]),...Object.keys(D.monitores||{}),...Object.keys(D.equipe||{}),...Object.keys(D.acessos||{}),...(D.contatos||[]).map(c=>c.usuario).filter(Boolean)]);return [...s].sort()}
const contatoDe=(n)=>(D.contatos||[]).find(c=>c.usuario===n)||null;
const temPapel=(i)=>i.owner||i.aluno||i.mon||i.eq||(i.extras||[]).length||(i.editor||[]).length;
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
function confirmar({titulo,corpo,digitar,botao}){return new Promise(ok=>{let fim=false;const fin=(v)=>{if(fim)return;fim=true;fechar();ok(v)};
  const ent=digitar?h('input',{type:'text',placeholder:'Digite '+digitar+' para confirmar',style:'width:100%;margin-top:10px'}):null;
  const bt=h('button',{type:'button',class:'btn',style:'background:#e5484d;color:#fff'},botao||'Excluir');bt.disabled=!!digitar;
  if(ent)ent.oninput=()=>{bt.disabled=ent.value.trim().toLowerCase().replace(/^@/,'')!==String(digitar).toLowerCase().replace(/^@/,'')};
  bt.onclick=()=>fin(true);
  const {fechar}=camada([h('h2',{style:'margin:0 0 10px;color:#ff8a8a'},titulo),...corpo,...(ent?[ent]:[]),h('div',{style:'display:flex;gap:8px;justify-content:flex-end;margin-top:16px'},h('button',{type:'button',class:'btn sec',onclick:()=>fin(false)},'Cancelar'),bt)],'modal');})}
const gh=(t,u)=>h('a',{href:u,target:'_blank',rel:'noopener',style:'color:var(--ouro)'},t);

function confirmaRemocaoPessoa(nome){
  const k=String(nome).toLowerCase();const li=(t)=>h('li',{style:'margin:4px 0'},t);const itens=[];
  if((D.alunos||[]).includes(k)){const ts=Object.values(D.turmas||{}).filter(t=>(t.alunos||[]).includes(k)).map(t=>t.nome);itens.push(li('Aluno'+(ts.length?' (turma '+ts.join(', ')+')':'')+': perde as aulas e atividades'))}
  if((D.monitores||{})[k]||(Array.isArray(D.monitores)&&D.monitores.includes(k)))itens.push(li('Monitor: perde os slides e roteiros liberados e a chamada'));
  const eq=(D.equipe||{})[k];if(eq)itens.push(li('Equipe'+(eq.titulo?' ('+eq.titulo+')':'')+': perde cargos e permissões'));
  if((D.acessos||{})[k])itens.push(li('Acessos extras a aulas'));
  if(!itens.length)itens.push(li('Nenhum papel ativo encontrado; só limpa registros soltos'));
  const aviso2=h('div',{style:'background:#3a2a10;border:1px solid #b66d00;border-radius:10px;padding:10px 14px;margin-top:12px'},h('b',null,'No GitHub a plataforma NÃO remove nada. Faça você mesmo, se for o caso:'),
    h('ul',{style:'padding-left:20px;margin:6px 0 0'},li(['Repositório do aluno ',gh('LAG-CEUMA/aluno-'+k,'https://github.com/LAG-CEUMA/aluno-'+k+'/settings/access'),' (Settings → Collaborators → remover; ou apagar o repositório)']),li(['Se ele for membro da organização: ',gh('LAG-CEUMA → People','https://github.com/orgs/LAG-CEUMA/people')])));
  return confirmar({titulo:'Remover o acesso de @'+nome+'?',corpo:[h('p',{class:'sub'},'A plataforma vai remover:'),h('ul',{style:'padding-left:20px;margin:4px 0'},...itens),h('p',{class:'sub',style:'margin-top:10px'},'O cadastro (nome e e-mail) continua na lista de Pessoas, no filtro "Sem acesso". Para apagar o cadastro, remova o acesso antes.'),aviso2],digitar:k,botao:'Remover acesso'})}
function camada(corpo,classe){const veu=h('div',{class:'veu'});const box=h('div',{class:classe},corpo);const fechar=()=>{veu.remove();box.remove();document.removeEventListener('keydown',tecla)};
  const tecla=e=>{if(e.key==='Escape')fechar()};document.addEventListener('keydown',tecla);veu.addEventListener('click',fechar);document.body.append(veu,box);return {fechar,box}}

// ---------- aba Pessoas ----------
function desenharPessoas(){
  const p=$('p-pessoas');p.textContent='';
  const todos=todasPessoas();
  const filtros=[['todos','Todos'],['owner','Owners'],['equipe','Equipe'],['monitor','Monitores'],['aluno','Alunos'],['sem','Sem acesso']];
  const barra=h('div',{class:'filtros'},...filtros.map(([k,t])=>h('button',{type:'button',class:'chipx'+(FILTRO===k?' on':''),onclick:()=>{FILTRO=k;desenharPessoas()}},t)));
  const sel=h('select',{onchange:e=>{TURMA_F=e.target.value;desenharPessoas()}},h('option',{value:''},'Todas as turmas'),...Object.keys(D.turmas).map(t=>h('option',{value:t},D.turmas[t].nome)));sel.value=TURMA_F;
  const busca=h('input',{type:'search',placeholder:'buscar nome, curso, e-mail ou usuário',value:BUSCA,oninput:e=>{BUSCA=e.target.value.toLowerCase();clearTimeout(busca.t);busca.t=setTimeout(()=>{desenharPessoas();const n=$('p-pessoas').querySelector('input[type=search]');n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)}});
  // linhas: quem tem usuário + contatos que ainda não têm usuário do GitHub
  const linhas=todos.map(n=>({n,i:info(n),c:contatoDe(n)}));
  for(const c of (D.contatos||[]))if(!c.usuario)linhas.push({n:'',i:null,c});
  const sem=(l)=>!l.i||!temPapel(l.i);
  const lista=linhas.filter(l=>{const i=l.i;return (FILTRO==='todos'||(FILTRO==='sem'&&sem(l))||(i&&((FILTRO==='owner'&&i.owner)||(FILTRO==='equipe'&&i.eq)||(FILTRO==='monitor'&&i.mon)||(FILTRO==='aluno'&&i.aluno))))&&(!TURMA_F||(i&&i.turmas.includes(TURMA_F)))&&(!BUSCA||[l.n,l.c&&l.c.nome,l.c&&l.c.email,l.c&&l.c.curso].join(' ').toLowerCase().includes(BUSCA))});
  const emails=lista.map(l=>l.c&&l.c.email).filter(Boolean);
  const cp=h('button',{class:'btn sec',type:'button',onclick:async()=>{try{await navigator.clipboard.writeText(emails.join('; '));aviso(emails.length+' e-mail(s) copiado(s). Cole no campo Para/CCO.')}catch{aviso('Não consegui copiar.',1)}}},'Copiar e-mails ('+emails.length+')');
  barra.append(sel,busca,h('span',{style:'flex:1'}),...(D.dono?[cp]:[]),h('button',{class:'btn',type:'button',onclick:()=>abrirGaveta('')},'+ Nova pessoa'));
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Tudo sobre uma pessoa fica aqui: dados (nome, e-mail, usuário), papéis, turma, cargos e permissões. Clique em Editar. Para cadastrar alguém novo, use + Nova pessoa.'),barra);
  const caixa=h('div',{class:'lista-cartao'});
  if(!lista.length)caixa.append(h('p',{},'Ninguém por aqui com esse filtro.'));
  for(const l of lista){const i=l.i;const w=i?emPalavras(i):{pode:[]};const c=l.c;
    const titulo=(c&&c.nome)||(l.n?'@'+l.n:(c&&c.email)||'(sem nome)');
    const sub=[(c&&c.nome&&l.n)?'@'+l.n:'',c&&c.curso,c&&c.email,!l.n?'sem usuário do GitHub':''].filter(Boolean).join(' · ');
    const falta=[];if(!(c&&c.nome))falta.push('nome');if(!l.n)falta.push('usuário do GitHub');
    caixa.append(h('div',{class:'pessoa'},h('div',{},h('b',{},titulo),h('div',{class:'sub',style:'font-size:12px'},sub)),h('div',{},h('div',{},...(i&&temPapel(i)?pillsPapel(i):[h('span',{class:'pill',style:'opacity:.7'},'Sem acesso')]),...(falta.length?[h('span',{class:'pill',style:'background:#5a4416'},'Falta: '+falta.join(', '))]:[])),h('div',{class:'pode'},i&&i.owner?'Pode tudo.':(w.pode[0]?'Pode '+w.pode[0].replace(/;.*$/,''):''))),
      h('button',{class:'btn sec',type:'button',onclick:()=>abrirGaveta(l.n,c)},'Editar')))}
  p.append(caixa,h('p',{class:'sub'},`${lista.length} de ${linhas.length} pessoa(s)`+((D.fixos||[]).length?` · Owners fixos (variável ADMIN_USERS): ${D.fixos.join(', ')}`:'')))
}

function abrirGaveta(nome,contato){
  const i0=nome?info(nome):null;const dono=D.dono;contato=contato||(nome?contatoDe(nome):null);
  const DADOS={curso:(contato&&contato.curso)||'',nome:(contato&&contato.nome)||'',email:(contato&&contato.email)||'',anterior:contato?(contato.email||('@'+contato.usuario)):''};
  const E={usuario:nome,owner:i0?i0.owner:false,aluno:i0?i0.aluno:true,turmas:new Set(i0?i0.turmas:[Object.keys(D.turmas).find(t=>D.turmas[t].status==='andamento')||Object.keys(D.turmas)[0]]),
    monitor:!!(i0&&i0.mon),mturmas:new Set(i0&&i0.mon?i0.mon.turmas:[]),aulas:new Set(i0&&i0.mon?i0.mon.aulas:[]),roteiros:new Set(i0&&i0.mon?i0.mon.roteiros:[]),
    acessos:(i0?i0.extras:[]).map(x=>({...x})),equipe:!!(i0&&i0.eq),cargos:new Set(i0?i0.cargos:[]),extras:new Set(i0&&i0.eq?i0.eq.permissoes:[]),editor:new Set((D.editores||{})[nome]||[])};
  E.aluno=i0?i0.aluno:false;
  const {fechar,box}=camada([],'gaveta');
  const rascunhoInfo=()=>info2(E);
  function info2(e){const eq=e.equipe?{permissoes:[...e.extras],cargos:[...e.cargos]}:null;const x={n:e.usuario,owner:e.owner,fixo:i0&&i0.fixo,aluno:e.aluno,extras:e.acessos,mon:e.monitor?{aulas:[...e.aulas],roteiros:[...e.roteiros],turmas:[...e.mturmas]}:null,eq,turmas:[...e.turmas],cargos:eq?eq.cargos:[],perms:[],origem:{},editor:[...e.editor]};
    if(e.owner)Object.keys(PERM_INFO).forEach(p=>x.perms.push(p));else if(eq){const s=new Set(eq.permissoes);eq.permissoes.forEach(p=>(x.origem[p]=x.origem[p]||[]).push('extra'));for(const c of eq.cargos)for(const p of (D.cargos[c]||{}).permissoes||[]){s.add(p);(x.origem[p]=x.origem[p]||[]).push(D.cargos[c].nome)}x.perms=[...s]}return x}
  const chip=(txt,on,fn,cls)=>h('button',{type:'button',class:'chipx '+(cls||'')+(on?' on':''),onclick:fn},txt);
  const ck=(txt,on,fn,dis,extra)=>h('label',{class:'ck',style:'display:inline-flex;margin-right:16px'},h('input',{type:'checkbox',checked:on,disabled:!!dis,onchange:e=>fn(e.target.checked)}),txt,extra||'');
  function desenhar(){
    const y=box.scrollTop;box.textContent='';
    const tot=Object.keys(D.turmas).filter(t=>D.turmas[t].status!=='arquivada'||E.turmas.has(t)||E.mturmas.has(t));
    const tit=DADOS.nome||(nome?'@'+nome:'Nova pessoa');
    box.append(h('div',{style:'display:flex;justify-content:space-between;gap:10px;align-items:flex-start'},h('div',{},h('h2',{style:'margin:0;font-size:22px'},tit),h('div',{class:'sub'},nome||contato?'Ficha da pessoa: tudo em um lugar':'Cadastro novo: preencha os dados e escolha o papel')),h('button',{class:'btn sec',type:'button',onclick:fechar},'Fechar')));
    {const cx=(rot,el,dica)=>h('label',{style:'display:block;font-size:12px;opacity:.9;margin:8px 0 0'},rot,el,dica?h('span',{class:'sub',style:'display:block;font-size:11px;margin-top:2px'},dica):'');
      const inp=(v,ph,on,ro)=>{const e=h('input',{type:'text',placeholder:ph||'',value:v||'',style:'width:100%;margin-top:3px',oninput:e2=>on(e2.target.value)});if(ro)e.readOnly=true;return e};
      box.append(h('div',{class:'sec'},h('h3',{},'Dados da pessoa'),
        cx('Nome completo *',inp(DADOS.nome,'Ex.: Davi Novato Silva',v=>{DADOS.nome=v})),
        cx('E-mail institucional (opcional)',inp(DADOS.email,dono?'a000000@ceuma.com.br':(contato?'(já cadastrado; só owners veem)':'a000000@ceuma.com.br'),v=>{DADOS.email=v}),'Só contato (convocações). Não dá acesso. Só owners enxergam os e-mails já salvos.'),
        cx('Curso (opcional)',inp(DADOS.curso,'Ex.: Ciência da Computação',v=>{DADOS.curso=v})),
        cx('Usuário do GitHub *',inp(E.usuario,'Ex.: davi-novato (sem @)',v=>{E.usuario=v.trim().replace(/^@/,'').toLowerCase()},!!nome),nome?'Já cadastrado; não pode ser trocado.':'É por ele que a pessoa entra na plataforma (o nome que aparece no perfil do GitHub).')))}
    // papéis
    box.append(h('div',{class:'sec'},h('h3',{},'Papel na Liga'),h('div',{class:'sub'},'Marque o que a pessoa é. Aluno: assiste às aulas e faz atividades. Monitor: ministra aulas. Equipe: ajuda a gerir a Liga (pelo cargo). Owner: administra tudo. ',h('b',{},'Nenhum marcado = cadastro inativo (sem acesso à plataforma).'),),
      ck('Owner',E.owner,v=>{E.owner=v;desenhar()},!dono||(i0&&i0.fixo)||(i0&&nome===D.usuario),dono?'':' (só owners definem)'),
      ck('Aluno',E.aluno,v=>{E.aluno=v;desenhar()}),ck('Monitor (ministra aulas)',E.monitor,v=>{E.monitor=v;desenhar()}),
      dono?ck('Equipe (cargos)',E.equipe,v=>{E.equipe=v;desenhar()}):''));
    if(E.aluno)box.append(h('div',{class:'sec'},h('h3',{},'Perfil de aluno: turma'),h('div',{class:'sub'},'A turma define o nível e se a pessoa é aluno atual ou ex-aluno (turma arquivada, com prazo de acesso). Pode marcar mais de uma; vale a soma.'),...tot.map(t=>chip(D.turmas[t].nome+(D.turmas[t].status==='arquivada'?' (arquivada)':''),E.turmas.has(t),()=>{E.turmas.has(t)?E.turmas.delete(t):E.turmas.add(t);desenhar()})),Object.keys(D.turmas).length?'':h('p',{class:'sub'},'Crie uma turma na aba Turmas.')));
    if(E.monitor){
      const bl=h('div',{class:'sec'},h('h3',{},'Aulas que o monitor ministra'),h('div',{class:'sub'},'Turmas em que ensina (nenhuma marcada = todas):'),...tot.map(t=>chip(D.turmas[t].nome,E.mturmas.has(t),()=>{E.mturmas.has(t)?E.mturmas.delete(t):E.mturmas.add(t);desenhar()})));
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
      const bl=h('div',{class:'sec'},h('h3',{},'Perfis de permissão (pode ter vários; vale a soma: prevalece o que dá mais acesso)'),...cs.map(c=>chip(D.cargos[c].nome,E.cargos.has(c),()=>{E.cargos.has(c)?E.cargos.delete(c):E.cargos.add(c);desenhar()},'cargo')),
        cs.length?'':h('p',{class:'sub'},'Ainda não há perfis. Crie na aba Perfis.'),h('div',{class:'sub'},'Precisa de uma permissão a mais? Crie um perfil na aba Perfis com ela e marque aqui. Não há permissão avulsa por pessoa.'));
      const x=rascunhoInfo();
      for(const p of Object.keys(PERM_INFO)){const on=x.perms.includes(p);bl.append(h('div',{class:'permlinha'},h('span',{class:on?'on':'off'},on?'✓':'–'),h('span',{class:on?'':'off'},h('b',{},PERM_INFO[p][0]),' · '+PERM_INFO[p][1]),h('span',{class:'src'},on&&x.origem[p]?'por '+x.origem[p].join(', '):'')))}
      if(E.extras.size)bl.append(h('div',{style:'background:#3a2a10;border:1px solid #b66d00;border-radius:10px;padding:10px 14px;margin-top:10px'},h('b',{},'Permissões individuais antigas: '+[...E.extras].map(p=>PERM_INFO[p][0]).join(', ')),h('div',{class:'sub'},'Não são mais usadas. Crie um perfil na aba Perfis com essas permissões, marque-o acima e remova as individuais.'),h('button',{class:'chipx',type:'button',style:'margin-top:6px',onclick:()=>{E.extras.clear();desenhar()}},'Remover permissões individuais')));
      box.append(bl)}
    if(dono&&(E.monitor||E.equipe)&&!E.owner){const bl=h('div',{class:'sec'},h('h3',{},'Permissão para editar slides (opcional)'),h('div',{class:'sub'},'Só para monitor ou equipe que vão criar/editar aulas no editor. Escolha o nível (ou uma aula) e clique em Liberar. Aluno comum não precisa disso.'));
      const rot=(v)=>{const [d,i]=v.split('/');const a=(D.aulas||[]).find(x=>x.dir===d&&(!i||x.id===i));const n=((D.aulas||[]).find(x=>x.dir===d)||{}).nivel||d;return i?`${n} · ${a?a.titulo:i}`:`${n} (todas as aulas)`};
      [...E.editor].forEach(v=>bl.append(h('div',{class:'permlinha'},h('span',{class:'on'},'✓'),h('span',{},rot(v)),h('button',{class:'chipx',type:'button',onclick:()=>{E.editor.delete(v);desenhar()}},'Remover'))));
      const ops=[];for(const [d,n] of niveisLista()){ops.push([d,n+' (todas as aulas)']);for(const a of (D.aulas||[]).filter(x=>x.dir===d))ops.push([d+'/'+a.id,n+' · '+a.titulo])}
      const sl=h('select',{},...ops.filter(o=>!E.editor.has(o[0])).map(o=>h('option',{value:o[0]},o[1])));
      bl.append(sl.options.length?h('div',{style:'display:flex;gap:6px;margin-top:8px;align-items:center'},(sl.style.cssText='flex:1;min-width:0',sl),h('button',{class:'chipx',type:'button',style:'flex:none;white-space:nowrap',onclick:()=>{E.editor.add(sl.value);desenhar()}},'Liberar edição')):h('p',{class:'sub'},'Nada mais a liberar.'));box.append(bl)}
    if(E.acessos.length){const bl=h('details',{class:'nivel pequeno',style:'margin-top:12px'},h('summary',{},h('span',{class:'nvt'},'Acessos individuais antigos (use turma de ex-aluno no lugar)'),h('span',{class:'nvc'},E.acessos.length?E.acessos.length+' liberado(s)':'nenhum')));bl.open=E.acessos.length>0;bl.append(h('div',{class:'sub'},'Este formato antigo não é mais criado. Para ex-aluno, coloque a pessoa em uma turma arquivada do nível (aba Turmas), com prazo de acesso. Remova estes itens depois.'));
      E.acessos.forEach((a,k)=>{const nv=h('select',{onchange:e=>{a.nivel=e.target.value}},...niveisLista().map(([d,t])=>h('option',{value:d},t)));nv.value=a.nivel;
        bl.append(h('div',{style:'display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin:8px 0;align-items:center'},nv,h('input',{type:'date',value:a.ate,onchange:e=>{a.ate=e.target.value}}),h('button',{class:'chipx',type:'button',onclick:()=>{E.acessos.splice(k,1);desenhar()}},'Remover'),
          h('input',{type:'text',value:a.motivo||'',maxLength:80,placeholder:'motivo (ex.: pediu para rever)',style:'grid-column:1/-1',oninput:e=>{a.motivo=e.target.value}})))});
      box.append(bl)}
    const x=rascunhoInfo();const w=emPalavras(x);
    box.append(h('div',{class:'palavras',style:'margin-top:12px'},h('b',{},'Em palavras: o que '+(E.usuario?'@'+E.usuario:'a pessoa')+' poderá fazer'),h('br'),h('span',{class:'pode-s'},'Pode: '),w.pode.join('; ')+'.',h('br'),w.nao.length?[h('span',{class:'nao-s'},'Não pode: '),w.nao.join('; ')+'.']:''));
    const rolulo=()=>{const r=[];if(E.owner)r.push('Owner');if(E.equipe){const cs=[...E.cargos].map(c=>(D.cargos[c]||{}).nome).filter(Boolean);r.push(...(cs.length?cs:['Equipe']))}if(E.monitor)r.push('Monitor');if(E.aluno)r.push('Aluno');return r.join(', ').slice(0,60)};
    const salvar=h('button',{class:'btn',type:'button',onclick:async()=>{
      if(!DADOS.nome.trim()){aviso('Preencha o nome completo da pessoa.',1);return}
      if(!E.usuario){aviso('Preencha o usuário do GitHub: sem ele a pessoa não consegue entrar.',1);return}
      if(!/^[a-z0-9][a-z0-9-]{0,38}$/i.test(E.usuario)){aviso('Usuário do GitHub inválido (letras, números e hífen).',1);return}
      const c={acao:'pessoa',usuario:E.usuario,nome:DADOS.nome,cargo:rolulo(),anterior:DADOS.anterior,acessos:E.acessos,aluno:E.aluno,turmas:[...E.turmas],monitor:E.monitor,aulas:[...E.aulas],roteiros:[...E.roteiros],monitor_turmas:[...E.mturmas]};
      if(DADOS.email.trim())c.email=DADOS.email;c.curso=DADOS.curso;if(dono){c.owner=E.owner;c.equipe=E.equipe;c.cargos=[...E.cargos];c.extras=[...E.extras];c.editor=[...E.editor]}
      try{await enviar(c);aviso('Ficha salva');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Salvar');
    const comAcesso=i0&&temPapel(i0);
    const rm=comAcesso?h('button',{class:'btn sec',type:'button',onclick:async()=>{if(!await confirmaRemocaoPessoa(nome))return;try{await enviar({acao:'remover_pessoa',usuario:nome});aviso('Acesso removido');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Remover acesso')
      :(contato&&dono?h('button',{class:'btn sec',type:'button',onclick:async()=>{if(!await confirmar({titulo:'Excluir o cadastro de '+(DADOS.nome||DADOS.email)+'?',corpo:[h('p',{class:'sub'},'Apaga nome, e-mail e cargo desta pessoa. Ela já está sem acesso à plataforma. No GitHub nada é alterado.')],digitar:'excluir',botao:'Excluir cadastro'}))return;try{await enviar({acao:'pendente_remover',chave:DADOS.anterior});aviso('Cadastro excluído');fechar();await carregar()}catch(e){aviso(e.message,1)}}},'Excluir cadastro'):'');
    box.append(h('div',{class:'rodape-g'},h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},h('button',{class:'btn sec',type:'button',onclick:()=>verComo(rascunhoInfo())},'Ver como '+(E.usuario?'@'+E.usuario:'esta pessoa')),rm),h('div',{style:'display:flex;gap:8px'},h('button',{class:'btn sec',type:'button',onclick:fechar},'Cancelar'),salvar)));
    box.scrollTop=y}
  desenhar()}

async function verComo(i){
  if(i.owner){aviso('Owners já veem tudo; escolha outra pessoa para testar.',1);return}
  if(!i.n){aviso('Informe o usuário do GitHub para testar o acesso.',1);return}
  if(!await confirmar({titulo:'Entrar como @'+i.n+'?',corpo:[h('p',{class:'sub'},'Você navegará pela plataforma exatamente como essa pessoa (somente leitura: nenhuma ação altera dados). Vale por 1 hora; uma faixa roxa na parte de baixo permite sair a qualquer momento. Salve a ficha antes se alterou permissões.')],botao:'Entrar como esta pessoa'}))return;
  try{const r=await fetch('/api/como',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:i.n})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.erro||'Erro');location.href='/'}catch(e){aviso(e.message,1)}
}



// ---------- aba Cargos ----------
function desenharCargos(){
  const p=$('p-cargos');p.textContent='';
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Um perfil (cargo) é um conjunto de permissões: você cria uma vez e depois só marca quem o recebe, na ficha da pessoa. Não existe permissão avulsa. Uma pessoa pode ter vários perfis; vale a soma e prevalece o que dá mais acesso. Só owners criam perfis.'));
  const g=h('div',{class:'grade'});
  for(const id of Object.keys(D.cargos)){const c=D.cargos[id];const ocup=Object.keys(D.equipe||{}).filter(n=>(D.equipe[n].cargos||[]).includes(id));
    const nome=h('input',{type:'text',value:c.nome,maxLength:40,style:'width:100%;font-weight:700'}),desc=h('input',{type:'text',value:c.descricao||'',maxLength:100,placeholder:'descrição curta',style:'width:100%;margin:6px 0'});
    const cx=Object.keys(PERM_INFO).map(k=>h('label',{class:'ck'},h('input',{type:'checkbox',checked:c.permissoes.includes(k),'data-k':k}),h('b',{},PERM_INFO[k][0]),h('span',{class:'sub'},PERM_INFO[k][1])));
    g.append(h('div',{class:'cartao2'},nome,desc,...cx,h('div',{class:'sub',style:'margin-top:10px'},`Quem ocupa (${ocup.length})`),h('div',{},...ocup.map(n=>h('span',{class:'pill e'},'@'+n))),
      h('div',{style:'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap'},h('button',{class:'btn',type:'button',onclick:async()=>{try{await enviar({acao:'cargo',id,nome:nome.value,descricao:desc.value,permissoes:cx.map(l=>l.querySelector('input')).filter(x=>x.checked).map(x=>x.dataset.k)});aviso('Cargo salvo');await carregar()}catch(e){aviso(e.message,1)}}},'Salvar'),
        h('button',{class:'btn sec',type:'button',onclick:async()=>{const ocup=Object.entries(D.equipe||{}).filter(([k,v])=>(v.cargos||[]).includes(id)).map(([k])=>'@'+k);if(!await confirmar({titulo:'Apagar o cargo "'+c.nome+'"?',corpo:[h('p',{class:'sub'},ocup.length?'Estas pessoas perdem as permissões deste cargo: '+ocup.join(', ')+'.':'Ninguém ocupa este cargo agora.'),h('p',{class:'sub'},'Nada é alterado no GitHub.')],digitar:c.nome,botao:'Apagar cargo'}))return;try{await enviar({acao:'remover_cargo',id});aviso('Cargo apagado');await carregar()}catch(e){aviso(e.message,1)}}},'Apagar'))))}
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
    h('p',{class:'sub'},'Os alunos da turma só veem as aulas do nível dela (e que estejam como Membros). Roteiros nunca aparecem para alunos. Passado o prazo, o acesso ao material dessa turma se encerra; para estender, edite a data acima.'),
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
  const NOMES={owners:'Só owners',membros:'Membros'};
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
    const atualizaCont=()=>{const c={owners:0,membros:0};lista.forEach(a=>c[a.acesso]=(c[a.acesso]||0)+1);cont.textContent=`${lista.length} aula(s) · ${c.membros} membros · ${c.owners} só owners`};atualizaCont();
    const massa=el('div','massa');massa.append(el('small','','Todas deste nível:'));
    const corpo=el('div','nvcorpo');
    const pintar=(l)=>{l.seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.v===l.a.acesso));l.info.textContent=INFO[l.a.acesso]};
    const linhas=[];
    for(const [v,n] of [['owners','Só owners'],['membros','Membros']]){const m=el('button','btn sec',n);m.type='button';
      m.onclick=async()=>{if(!confirm(`Definir as ${lista.length} aulas de "${nv}" como "${n}"?`))return;try{await enviar({acao:'acesso',chaves:lista.map(a=>a.chave),nivel:v,nivel_nome:nv});lista.forEach(a=>a.acesso=v);linhas.forEach(pintar);atualizaCont();aviso(`${nv}: todas em "${n}"`)}catch(e){aviso(e.message,1);carregar()}};massa.append(m)}
    corpo.append(massa);
    for(const a of lista){const l=el('div','linha');const t=el('div','t');t.append(el('b','',a.titulo),el('br'),el('small','',a.chave));
      const info=el('div','nivelinfo',INFO[a.acesso]);const seg=el('div','seg');const reg={a,seg,info};linhas.push(reg);
      for(const [v,n] of [['owners','Só owners'],['membros','Membros']]){const bt=el('button',(v===a.acesso?'on ':'')+v,n);bt.type='button';bt.dataset.v=v;
        bt.onclick=async()=>{if(a.acesso===v)return;try{await enviar({acao:'acesso',chave:a.chave,nivel:v});a.acesso=v;pintar(reg);atualizaCont();aviso(`${a.titulo}: ${n}`)}catch(e){aviso(e.message,1);carregar()}};seg.append(bt)}
      const vv=el('a','btn sec','Slides');vv.href=a.url;vv.target='_blank';l.append(t,seg,vv);
      if(a.roteiro){const r=el('a','btn sec','Roteiro');r.href=a.roteiro;r.target='_blank';l.append(r)}l.append(info);corpo.append(l)}
    det.append(sm,corpo);box.append(det)});
  bx.onclick=()=>{todos.forEach(x=>x.open=true)};br.onclick=()=>{todos.forEach(x=>x.open=false)};
}


// ---------- páginas reservadas (só owners) ----------
function lerHtml(arq){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(new Error('Não consegui ler o arquivo.'));r.readAsText(arq)})}
async function desenharImagens(){
  const p=$('p-imagens');p.textContent='Carregando…';
  let L;try{L=(await enviar({acao:'imagens_listar'})).imagens}catch(e){p.textContent=e.message;return}
  p.textContent='';
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Todas as imagens enviadas para o site e para os slides ficam aqui. Excluir apaga o arquivo do GitHub (fica no histórico de commits). Se a imagem estiver em uso, o sistema avisa onde antes de excluir.'));
  if(!L.length){p.append(h('p',{class:'sub'},'Nenhuma imagem enviada ainda.'));return}
  const g=h('div',{style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px'});
  for(const x of L){
    const ex=h('button',{class:'btn sec',type:'button',style:'width:100%;margin-top:8px',onclick:async()=>{
      if(!await confirmar({titulo:'Excluir esta imagem?',corpo:[h('img',{src:'/api/imagem?n='+encodeURIComponent(x.nome),style:'max-width:100%;max-height:160px;border-radius:8px'}),h('p',{class:'sub'},'O arquivo será apagado do GitHub. '+(x.noSite?'Ela está em uso no site.':'O sistema ainda verifica se algum slide a usa.'))],botao:'Excluir imagem'}))return;
      try{await enviar({acao:'imagem_excluir',nome:x.nome});aviso('Imagem excluída');desenharImagens()}
      catch(e){if(/em uso/.test(e.message)){if(await confirmar({titulo:'Imagem em uso',corpo:[h('p',{class:'sub'},e.message)],digitar:'excluir',botao:'Excluir mesmo assim'})){try{await enviar({acao:'imagem_excluir',nome:x.nome,forcar:true});aviso('Imagem excluída');desenharImagens()}catch(e2){aviso(e2.message,1)}}}else aviso(e.message,1)}}},'Excluir');
    g.append(h('div',{class:'cartao2'},h('img',{src:'/api/imagem?n='+encodeURIComponent(x.nome),loading:'lazy',style:'width:100%;height:110px;object-fit:cover;border-radius:8px;background:#0003'}),
      h('div',{class:'sub',style:'word-break:break-all;margin-top:6px'},x.nome),h('div',{},...x.modulos.map(m=>h('span',{class:'pill e'},m==='slides'?'Slides':'Site')),x.noSite?h('span',{class:'pill'},'em uso'):''),ex))}
  p.append(g)}

function desenharReservadas(){
  const raiz=$('p-reservadas');raiz.textContent='';
  raiz.append(h('p',{class:'sub',style:'max-width:760px'},'Páginas com link secreto: ',h('b',null,'não aparecem em nenhuma lista do site'),', não são indexadas e abrem sem login para quem receber o link. Só owners veem esta lista e podem trocar o conteúdo. O endereço não muda quando você substitui o arquivo.'));
  const lista=D.reservadas||[];const base=location.origin;
  const caixa=h('div',{class:'card',style:'margin:12px 0;max-width:760px'});
  const nome=h('input',{type:'text',id:'res-nome',placeholder:'Nome (ex.: Plano 2026.2/2027.1)',maxlength:'80',style:'width:100%;margin:6px 0'});
  const arq=h('input',{type:'file',id:'res-arq',accept:'.html,.htm,text/html'});
  const bt=h('button',{type:'button',class:'btn'},'Criar página');
  bt.onclick=async()=>{try{
    if(!nome.value.trim())throw new Error('Dê um nome para a página.');if(!arq.files[0])throw new Error('Escolha o arquivo .html.');
    bt.disabled=true;await enviar({acao:'reservado_salvar',titulo:nome.value,html:await lerHtml(arq.files[0])});aviso('Página criada.');await carregar()}catch(e){aviso(e.message,true)}finally{bt.disabled=false}};
  caixa.append(h('h3',null,'Nova página'),nome,arq,h('div',{style:'margin-top:8px'},bt));raiz.append(caixa);
  if(!lista.length){raiz.append(h('p',{class:'sub'},'Nenhuma página reservada ainda.'));return}
  for(const p of lista){
    const url=base+'/r/'+p.token;
    const troca=h('input',{type:'file',accept:'.html,.htm,text/html',style:'display:none'});
    troca.onchange=async()=>{try{if(!troca.files[0])return;await enviar({acao:'reservado_salvar',token:p.token,titulo:p.titulo,html:await lerHtml(troca.files[0])});aviso('Conteúdo substituído. O link continua o mesmo.');await carregar()}catch(e){aviso(e.message,true)}};
    const copiar=h('button',{type:'button',class:'btn sec'},'Copiar link');
    copiar.onclick=async()=>{try{await navigator.clipboard.writeText(url);aviso('Link copiado.')}catch{aviso('Copie manualmente: '+url,true)}};
    const rem=h('button',{type:'button',class:'btn sec'},'Remover');
    rem.onclick=async()=>{if(rem.dataset.ok!=='1'){rem.dataset.ok='1';rem.textContent='Clique de novo para confirmar';setTimeout(()=>{rem.dataset.ok='';rem.textContent='Remover'},4000);return}
      try{await enviar({acao:'reservado_remover',token:p.token});aviso('Página removida.');await carregar()}catch(e){aviso(e.message,true)}};
    raiz.append(h('div',{class:'card',style:'margin:10px 0;max-width:760px'},h('b',null,p.titulo),h('div',{class:'sub',style:'word-break:break-all'},url),
      h('div',{class:'sub'},'Atualizada em '+(p.atualizado||p.criado||'')+(p.por?' por '+p.por:'')),
      h('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'},h('a',{class:'btn',href:'/r/'+p.token,target:'_blank',rel:'noopener'},'Abrir'),copiar,h('button',{type:'button',class:'btn sec',onclick:()=>troca.click()},'Substituir HTML'),troca,rem)))}
}


// ---------- Guias e dúvidas (wiki interna) ----------
function desenharWiki(){
  const raiz=$('p-wiki');raiz.textContent='';const W=D.wiki||{paginas:[],vis:{},categorias:[]};
  raiz.append(h('p',{class:'sub',style:'max-width:760px'},'Wiki interna para o corpo administrativo. Cada página tem uma ',h('b',null,'visibilidade por função'),', escolhida aqui: quem não tem a função não vê a página nem na busca. Páginas para o corpo administrativo ficam em ',h('a',{href:'/wiki'},'/wiki'),'; páginas com visibilidade "Central de ajuda" formam a wiki separada dos alunos, em ',h('a',{href:'/ajuda'},'/ajuda'),'. Só owners criam e editam.'));
  const mk=(p)=>{p=p||{};const c=h('div',{class:'card',style:'margin:12px 0;max-width:760px'});
    const t=h('input',{type:'text',placeholder:'Título (ex.: Erro "Repository not found")',maxlength:'100',style:'width:100%;margin:4px 0',value:p.titulo||''});
    const cat=h('select',{style:'margin:4px 0'});for(const x of W.categorias)cat.append(h('option',{value:x,selected:x===(p.categoria||'Dúvidas frequentes')},x));
    const vis=h('select',{style:'margin:4px 0'});for(const [k,v] of Object.entries(W.vis))vis.append(h('option',{value:k,selected:k===(p.visibilidade||'equipe')},v));
    const cg=h('input',{type:'text',placeholder:'Opcional: só estes cargos da equipe (ids separados por vírgula)',style:'width:100%;margin:4px 0',value:(p.cargos||[]).join(', ')});
    const rs=h('input',{type:'text',placeholder:'Resumo de uma linha',maxlength:'240',style:'width:100%;margin:4px 0',value:p.resumo||''});
    const tg=h('input',{type:'text',placeholder:'Palavras-chave para a busca, separadas por vírgula',style:'width:100%;margin:4px 0',value:(p.tags||[]).join(', ')});
    const od=h('input',{type:'text',placeholder:'Ordem (1 aparece primeiro)',style:'width:150px;margin:4px 0',value:p.ordem!=null?String(p.ordem):'100'});
    const ar=h('input',{type:'file',accept:'.html,.htm,text/html'});
    const bt=h('button',{type:'button',class:'btn'},p.slug?'Salvar alterações':'Criar página');
    bt.onclick=async()=>{try{bt.disabled=true;const b={acao:'wiki_salvar',slug:p.slug,titulo:t.value,categoria:cat.value,visibilidade:vis.value,cargos:cg.value,resumo:rs.value,tags:tg.value,ordem:od.value};
      if(ar.files[0])b.html=await lerHtml(ar.files[0]);await enviar(b);aviso(p.slug?'Página atualizada.':'Página criada.');await carregar()}catch(e){aviso(e.message,true)}finally{bt.disabled=false}};
    c.append(t,h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},cat,vis,od),cg,rs,tg,h('div',{class:'sub'},p.slug?'Arquivo HTML (deixe vazio para manter o atual):':'Arquivo HTML da página:'),ar,h('div',{style:'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap'},bt));
    if(p.slug){const rem=h('button',{type:'button',class:'btn sec'},'Remover');
      rem.onclick=async()=>{if(rem.dataset.ok!=='1'){rem.dataset.ok='1';rem.textContent='Clique de novo para confirmar';setTimeout(()=>{rem.dataset.ok='';rem.textContent='Remover'},4000);return}
        try{await enviar({acao:'wiki_remover',slug:p.slug});aviso('Página removida.');await carregar()}catch(e){aviso(e.message,true)}};
      c.lastChild.append(h('a',{class:'btn sec',href:'/wiki/'+p.slug,target:'_blank',rel:'noopener'},'Abrir'),rem)}
    return c};
  const novo=h('details',{class:'nivel',open:!(W.paginas||[]).length},h('summary',null,h('span',{class:'nvt'},'+ Nova página')),h('div',{class:'nvcorpo'},mk()));raiz.append(novo);
  if(!(W.paginas||[]).length){raiz.append(h('p',{class:'sub'},'Nenhuma página ainda.'));return}
  for(const p of W.paginas.slice().sort((a,b)=>(a.categoria||'').localeCompare(b.categoria||'')||a.ordem-b.ordem)){
    const d=h('details',{class:'nivel pequeno'});
    d.append(h('summary',null,h('span',{class:'nvt'},p.titulo),h('span',{class:'nvc'},p.categoria+' · '+(W.vis[p.visibilidade]||p.visibilidade))),h('div',{class:'nvcorpo'},mk(p)));raiz.append(d)}
}


// ---------- contatos da equipe sem usuário do GitHub (só owners) ----------
// ---------- abas ----------
function abasDisponiveis(){const a=[];if(!D.dono&&!D.permissoes.includes('pessoas')&&!D.permissoes.includes('aulas'))a.push(['ferramentas','Ferramentas']);if(D.permissoes.includes('pessoas'))a.push(['pessoas','Pessoas']);if(D.dono)a.push(['cargos','Perfis']);if(D.permissoes.includes('pessoas'))a.push(['turmas','Turmas']);if(D.dono)a.push(['pontos','Pontuação']);if(D.dono)a.push(['reservadas','Páginas reservadas']);if(D.dono)a.push(['imagens','Banco de imagens']);if(D.dono)a.push(['wiki','Guias e dúvidas']);if(D.permissoes.includes('aulas'))a.push(['aulas','Níveis das aulas']);a.push(['guia','Guia']);return a}
function desenharFerramentas(){
  const p=$('p-ferramentas');p.textContent='';const pm=D.permissoes||[];
  const L=[[pm.includes('site'),'/personalizar','Personalizar site','Cores, logo, avisos, agenda, vitrine e destaques de ranking da tela inicial.'],
    [pm.includes('presenca')||D.papel==='monitor','/presenca','Presença e atividades','Chamada, participação, atividades e ranking das turmas.'],
    [D.editor,'/editor','Editor de slides','Criar e editar as aulas da Liga.'],
    [['owner','monitor','equipe'].includes(D.papel),'/wiki','Guias e dúvidas','Tutoriais e respostas para a equipe.']].filter(x=>x[0]);
  p.append(h('p',{class:'sub',style:'max-width:760px'},'Estas são as ferramentas liberadas para o seu perfil'+(D.titulo?' ('+D.titulo+')':'')+'. Se faltar algo, peça a um owner para ajustar o seu perfil.'));
  const g=h('div',{style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px'});
  for(const [,url,t,d] of L)g.append(h('a',{class:'cartao2',href:url,style:'text-decoration:none;color:inherit;display:block'},h('b',{style:'font-size:17px'},t),h('div',{class:'sub',style:'margin-top:6px'},d),h('div',{style:'margin-top:10px;color:var(--ouro);font-weight:700'},'Abrir →')));
  if(!L.length)p.append(h('p',{class:'sub'},'Nenhuma ferramenta liberada ainda.'));p.append(g)}
function mostrar(k){
  const disp=abasDisponiveis();if(!disp.some(x=>x[0]===k))k=disp[0][0];ABA=k;try{history.replaceState(null,'','#'+k)}catch{}
  $('abas').textContent='';for(const [id,t] of disp)$('abas').append(h('button',{type:'button',class:id===k?'on':'',onclick:()=>mostrar(id)},t));
  for(const [id] of [['ferramentas'],['pessoas'],['cargos'],['turmas'],['pontos'],['reservadas'],['imagens'],['wiki'],['aulas'],['guia']])$('p-'+id).hidden=id!==k;
  if(k==='ferramentas')desenharFerramentas();else if(k==='pessoas')desenharPessoas();else if(k==='cargos')desenharCargos();else if(k==='turmas')desenharTurmas();else if(k==='pontos')desenharPontos();else if(k==='reservadas')desenharReservadas();else if(k==='imagens')desenharImagens();else if(k==='wiki')desenharWiki();else if(k==='aulas')desenharAulas(D)}
async function carregar(){
  const r=await fetch('/api/admin');
  if(r.status===403){document.querySelector('main').innerHTML='<h1>Sem permissão</h1><p>Esta tela é para owners e para a equipe com permissão. Entre com a sua conta do GitHub ou peça acesso a um owner.</p><a class="btn" href="/api/login?next=/admin">Entrar com GitHub</a> <a class="btn sec" href="/">Início</a>';return}
  D=await r.json();D.turmas=D.turmas||{};D.cargos=D.cargos||{};D.equipe=D.equipe||(D.dono?{}:undefined);
  const pm=D.permissoes||[],ver=(id,ok)=>{const e=$(id);if(e)e.hidden=!ok};
  const soFerr=!D.dono&&!pm.includes('pessoas')&&!pm.includes('aulas');ver('f-site',!soFerr&&(D.dono||pm.includes('site')));ver('f-pres',!soFerr&&(D.dono||pm.includes('presenca')||D.papel==='monitor'));ver('f-ed',!soFerr&&!!D.editor);ver('f-wiki',!soFerr&&!D.dono&&['owner','monitor','equipe'].includes(D.papel));
  mostrar(ABA||location.hash.slice(1)||'pessoas')}
carregar();
