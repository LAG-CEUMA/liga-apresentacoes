/* Janelas de ajuda "?": botão pequeno que abre um cartão flutuante explicando o que o botão faz.
   Uso: window.AJUDA = { chave: { t: 'Título', l: ['linha 1', 'linha 2'] } }; ajuda('chave') devolve o botão "?". */
(function () {
  let pop = null, dono = null, y0 = 0;
  function fechar() { if (pop) { pop.remove(); pop = null; } if (dono) { dono.setAttribute('aria-expanded', 'false'); dono = null; } }
  function abrir(btn, d) {
    fechar(); y0 = window.scrollY; dono = btn; btn.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'ajuda-pop'; pop.setAttribute('role', 'dialog');
    const x = document.createElement('button'); x.type = 'button'; x.className = 'ajuda-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Fechar ajuda'); x.onclick = fechar;
    const t = document.createElement('b'); t.textContent = d.t; pop.append(x, t);
    for (const l of d.l || []) { const p = document.createElement('p'); p.textContent = l; pop.append(p); }
    document.body.append(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    let top = r.bottom + 8; if (top + hgt > window.innerHeight - 12) top = Math.max(12, r.top - hgt - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  window.ajuda = function (chave) {
    const d = (window.AJUDA || {})[chave]; if (!d) return document.createTextNode('');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ajuda'; b.textContent = '?';
    b.setAttribute('aria-label', 'Ajuda: ' + d.t); b.setAttribute('aria-expanded', 'false'); b.title = 'O que é isto?';
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (dono === b) fechar(); else abrir(b, d); };
    return b;
  };
  document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target)) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  window.addEventListener('scroll', () => { if (pop && Math.abs(window.scrollY - y0) > 60) fechar(); }, { passive: true }); window.addEventListener('resize', fechar);
})();
