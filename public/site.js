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
