/* Dicas de ajuda.
   1) Botão "?": window.ajuda('chave') devolve um círculo "?". Passar o mouse mostra a dica; clicar (ou tocar) fixa/solta.
   2) Qualquer campo ou botão: window.dica(elemento, 'chave') (ou o atributo data-aj="chave") mostra a mesma dica ao passar o mouse ou ao focar.
   Os textos ficam em window.AJUDA = { chave: { t: 'Título', l: ['linha 1', 'linha 2'] } } (já carregados com a página: não gera nenhum pedido extra).
   Um único cartão flutuante e poucos ouvintes de evento no documento: custo praticamente zero. */
(function () {
  let pop = null, dono = null, y0 = 0, fixo = false, tAbre = 0, tFecha = 0;
  const hover = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
  function fechar() { clearTimeout(tAbre); clearTimeout(tFecha); fixo = false; if (pop) { pop.remove(); pop = null; } if (dono) { if (dono.classList.contains('ajuda')) dono.setAttribute('aria-expanded', 'false'); dono = null; } }
  function abrir(alvo, d, pino) {
    clearTimeout(tFecha); if (dono === alvo && pop) { if (pino) fixo = true; return; }
    const antes = fixo; fechar(); fixo = !!pino; y0 = window.scrollY; dono = alvo; if (alvo.classList.contains('ajuda')) alvo.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'ajuda-pop'; pop.setAttribute('role', 'tooltip');
    const x = document.createElement('button'); x.type = 'button'; x.className = 'ajuda-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Fechar ajuda'); x.onclick = fechar;
    const t = document.createElement('b'); t.textContent = d.t; pop.append(x, t);
    for (const l of d.l || []) { const p = document.createElement('p'); p.textContent = l; pop.append(p); }
    pop.addEventListener('mouseenter', () => clearTimeout(tFecha));
    pop.addEventListener('mouseleave', () => { if (!fixo) agendaFechar(); });
    document.body.append(pop);
    const r = alvo.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    let top = r.bottom + 8; if (top + hgt > window.innerHeight - 12) top = Math.max(12, r.top - hgt - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function agendaFechar() { clearTimeout(tFecha); tFecha = setTimeout(() => { if (!fixo) fechar(); }, 220); }
  function agendaAbrir(alvo, chave, atraso) { const d = (window.AJUDA || {})[chave]; if (!d) return; clearTimeout(tAbre); tAbre = setTimeout(() => abrir(alvo, d, false), atraso); }

  window.ajuda = function (chave) {
    const d = (window.AJUDA || {})[chave]; if (!d) return document.createTextNode('');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ajuda'; b.textContent = '?';
    b.setAttribute('aria-label', 'Ajuda: ' + d.t); b.setAttribute('aria-expanded', 'false'); b.dataset.aj = chave;
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (dono === b && pop && fixo) fechar(); else abrir(b, d, true); };
    return b;
  };
  window.dica = function (el, chave) { if (el && el.setAttribute) { el.setAttribute('data-aj', chave); if (!/^(input|select|textarea|button|a)$/i.test(el.tagName) && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); } return el; };

  const achar = (n) => (n && n.closest ? n.closest('[data-aj]') : null);
  if (hover) {
    document.addEventListener('mouseover', (e) => { const a = achar(e.target); if (!a || a === dono) { if (a === dono) clearTimeout(tFecha); return; } if (fixo) return; agendaAbrir(a, a.dataset.aj, a.classList.contains('ajuda') ? 120 : 450); });
    document.addEventListener('mouseout', (e) => { const a = achar(e.target); if (!a) return; clearTimeout(tAbre); if (a === dono && !fixo) agendaFechar(); });
  }
  document.addEventListener('focusin', (e) => { const a = achar(e.target); if (a && !a.classList.contains('ajuda') && !fixo) agendaAbrir(a, a.dataset.aj, 150); });
  document.addEventListener('focusout', (e) => { const a = achar(e.target); if (a && a === dono && !fixo) agendaFechar(); });
  document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target) && !(dono && dono.contains(e.target))) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  window.addEventListener('scroll', () => { if (pop && Math.abs(window.scrollY - y0) > 60) fechar(); }, { passive: true });
  window.addEventListener('resize', fechar);
})();
