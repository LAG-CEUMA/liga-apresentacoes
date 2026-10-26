/* Regra de novidade dos blocos recolhíveis: abre expandido quando o conteúdo mudou desde que a pessoa o recolheu/expandiu;
   depois que ela escolhe, respeita a escolha até o conteúdo mudar de novo. Guardado só neste navegador. */
window.LigaNovo={
  sig(x){const s=typeof x==='string'?x:JSON.stringify(x);let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h)},
  ler(k){try{return JSON.parse(localStorage.getItem('liga_nv_'+k)||'null')}catch{return null}},
  gravar(k,v){try{localStorage.setItem('liga_nv_'+k,JSON.stringify(v))}catch{}},
  // d = <details>; k = chave estável; conteudo = o que, se mudar, conta como novidade; padrao = aberto no primeiro acesso
  aplicar(d,k,conteudo,padrao){
    const sig=this.sig(conteudo),e=this.ler(k);let novo=false;
    if(!e)d.open=!!padrao;
    else if(e.s!==sig){d.open=true;novo=true}
    else d.open=!!e.a;
    let tag=null;
    if(novo){tag=document.createElement('span');tag.className='novo';tag.textContent='novo';const s=d.querySelector('summary');if(s)s.insertBefore(tag,s.querySelector('.nvc'))}
    d.addEventListener('toggle',()=>{this.gravar(k,{s:sig,a:d.open});if(tag){tag.remove();tag=null}});
    return novo;
  }
};
