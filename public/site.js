/* Carrega nome, logo e redes do site e aplica nas páginas. Outras páginas reutilizam window.LIGA_SITE. */
window.LIGA_SITE=fetch('/api/site').then(r=>r.json()).catch(()=>({redes:[],anuncios:[],agenda:[],boasVindas:{}}));
window.LIGA_SITE.then(d=>{
  const topo=document.querySelector('.topo');
  if(topo&&d.logo&&!topo.querySelector('.logo')){const i=document.createElement('img');i.className='logo';i.alt=d.nome||'Logo';i.src='/api/imagem?n='+encodeURIComponent(d.logo);const alvo=topo.firstElementChild;const w=document.createElement('div');w.className='marca';const lk=document.createElement('a');lk.href='/';lk.title='Início';lk.setAttribute('aria-label','Ir para o início');lk.append(i);alvo.replaceWith(w);w.append(lk,alvo)}
  const tag=document.querySelector('.tag[data-site=tag]');if(tag&&d.tag)tag.textContent=d.tag;
  const main=document.querySelector('main');if(!main)return;
  const f=document.createElement('footer');f.className='rodape';
  const nome=document.createElement('small');nome.style.cssText='color:var(--mut);flex:1';nome.textContent=d.nome||'';f.append(nome);
  for(const r of d.redes||[]){const a=document.createElement('a');a.className='rede';a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=r.nome;f.append(a)}
  main.append(f);
});

// Contador da cota do GitHub (só aparece para owners): saldo da hora, quando renova, e cores de alerta.
window.ligaCota=function(onde){
  if(!onde||onde.dataset.cota)return;onde.dataset.cota='1';
  const c=document.createElement('span');c.className='cota';c.title='Consultas ao GitHub restantes nesta hora (limite de 5.000 para o portal inteiro). O portal economiza sozinho quando a cota está baixa.';c.textContent='GitHub: …';onde.append(c);
  async function ler(){if(document.hidden)return;try{const r=await fetch('/api/presenca?acao=cota');if(!r.ok){c.hidden=true;return}const d=await r.json();if(d.restante===null){c.textContent='GitHub: sem leitura ainda';return}
    const pc=d.restante/d.limite;const h=d.renova?new Date(d.renova).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    c.textContent='GitHub: '+d.restante.toLocaleString('pt-BR')+' / '+d.limite.toLocaleString('pt-BR')+' restantes'+(h?' · renova '+h:'');
    c.style.cssText='display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;border:1px solid;'+(pc<0.1?'color:#ff8a8a;border-color:#ff5d5d;background:#ff5d5d22':pc<0.3?'color:#f7b93e;border-color:#f7b93e;background:#f7b93e22':'color:#7fe0a0;border-color:#2ecc7188')}catch{c.hidden=true}}
  ler();setInterval(ler,90000)};
