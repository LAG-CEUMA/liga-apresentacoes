/* Editor de slides (sem código): palco 1920x1080, clique para selecionar, arraste para mover, duplo clique para digitar. */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
function h(t, p, ...f) { const e = document.createElement(t); for (const [k, v] of Object.entries(p || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v === false || v == null) continue; else e.setAttribute(k, v === true ? '' : v); } for (const x of f.flat()) if (x != null && x !== false) e.append(x.nodeType ? x : document.createTextNode(x)); return e; }
const Q = new URLSearchParams(location.search);
const M0 = window.EditorModelos;
function aviso(t, erro) { const m = $('msg'); m.textContent = t; m.className = erro ? 'erro' : ''; m.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => { m.hidden = true; }, erro ? 7000 : 3000); }
async function api(corpo) {
  const r = await fetch('/api/slides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.erro || 'Falha ao salvar.'); e.status = r.status; throw e; } return j;
}
async function ler(qs) {
  const r = await fetch('/api/slides?' + qs); const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.erro || 'Falha ao carregar.'); e.status = r.status; throw e; } return j;
}

// ---------- excluir aula (passo a passo no GitHub: o portal não apaga arquivos) ----------
let REPO_INFO = null;
async function modalExcluir(dir, id, titulo) {
  if (!REPO_INFO) { try { const d = await ler('acao=lista'); REPO_INFO = { repo: d.repo, branch: d.branch }; } catch (e) { aviso(e.message, 1); return; } }
  const { repo, branch } = REPO_INFO, gh = `https://github.com/${repo}`;
  const arqs = [[`niveis/${dir}/slides/${id}.html`, 'os slides'], [`niveis/${dir}/slides/${id}-roteiro.html`, 'o roteiro'], [`niveis/${dir}/editor/${id}.json`, 'o arquivo do editor']];
  const L = (t, u) => h('a', { href: u, target: '_blank', rel: 'noopener', style: 'color:var(--ouro)' }, t);
  const v = modal([h('h3', { style: 'margin-top:0' }, 'Excluir a aula "' + titulo + '"'),
    h('p', { class: 'sub' }, 'Por segurança o portal não apaga arquivos. A exclusão é feita no GitHub, em poucos cliques. Nada se perde de verdade: o GitHub guarda o histórico e dá para recuperar.'),
    h('div', { style: 'background:#2a1d1d;border:1px solid #e5604f66;border-radius:10px;padding:10px 12px;margin:8px 0;font-size:14px' }, '⚠ Antes de apagar, confira em Painel → Turmas se nenhuma turma depende desta aula. Aulas já dadas ficam no histórico de presença mesmo sem os slides.'),
    h('ol', { style: 'line-height:1.7;padding-left:20px' },
      h('li', {}, 'Entre no GitHub com sua conta de owner (a conta que pode alterar o repositório ', h('b', {}, repo), ').'),
      h('li', {}, 'Apague cada arquivo abaixo: clique no link, depois no botão ', h('b', {}, '⋯'), ' (três pontinhos) no canto direito → ', h('b', {}, 'Delete file'), ' → ', h('b', {}, 'Commit changes'), '.'),
      h('li', {}, 'Para cada arquivo:', h('ul', {}, ...arqs.map(([c, n]) => h('li', {}, L(c, `${gh}/blob/${branch}/${c}`), h('span', { class: 'sub' }, ' (' + n + ')'))))),
      h('li', {}, 'Tire o título da aula da lista: abra ', L(`niveis/${dir}/slides/indice.json`, `${gh}/edit/${branch}/niveis/${dir}/slides/indice.json`), ', apague a linha que começa com ', h('code', {}, `"${id}":`), ' (cuide para não deixar vírgula sobrando na última linha) e clique em ', h('b', {}, 'Commit changes'), '.'),
      h('li', {}, 'Volte ao portal e recarregue. Em até 1 minuto a aula some da lista, do Painel e da tela inicial.')),
    h('p', { class: 'sub' }, 'Se você só quer esconder a aula dos alunos, não precisa apagar: em Painel → Níveis das aulas, deixe como "Só owners".'),
    h('button', { class: 'b', onclick: () => v.remove() }, 'Fechar')]);
}

// ======================= LISTA =======================
async function lista() {
  const box = $('lista-pg'); box.hidden = false; box.textContent = 'Carregando…';
  let d;
  try { d = await ler('acao=lista'); } catch (e) {
    box.textContent = ''; box.append(h('h1', {}, 'Editor de slides'), h('p', {}, e.status === 401 ? 'Entre com o GitHub para usar o editor.' : e.message), h('a', { class: 'btn', href: e.status === 401 ? '/api/login?next=/editor' : '/' }, e.status === 401 ? 'Entrar com GitHub' : 'Voltar ao início')); return;
  }
  box.textContent = '';
  box.append(h('div', { class: 'topo' }, h('div', {}, h('p', { class: 'tag' }, 'LIGA ACADÊMICA DE GAMES · CEUMA'), h('h1', {}, 'Editor de slides')), h('div', { class: 'acoes' }, h('a', { class: 'btn sec', href: '/' }, '← Início'), d.dono ? h('a', { class: 'btn sec', href: '/admin' }, 'Painel') : null)),
    h('p', { class: 'sub' }, 'Crie e edite as aulas sem mexer em código. Cada nível tem suas aulas. Aulas novas começam como "Só owners": para liberar aos alunos, use o Painel → Níveis das aulas.'));
  if (d.dono) {
    const n = h('input', { type: 'number', min: 0, max: 99, placeholder: 'Nº', style: 'width:70px' }), nm = h('input', { type: 'text', placeholder: 'Nome do nível (ex.: Pensar como designer)', style: 'width:320px' });
    box.append(h('div', { class: 'nv' }, h('b', {}, 'Novo nível'), h('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, n, nm,
      h('button', { class: 'b pri', onclick: async () => { try { await api({ acao: 'novo_nivel', numero: n.value, nome: nm.value }); aviso('Nível criado'); lista(); } catch (e) { aviso(e.message, 1); } } }, 'Criar nível'))));
  }
  const todas = d.niveis.flatMap((n) => n.aulas.map((a) => ({ dir: n.dir, nome: n.nome, ...a })));
  const lembra = (k, pad) => { try { const v = localStorage.getItem('liga_ed_' + k); return v === null ? pad : v === '1'; } catch { return pad; } };
  const grava = (k, v) => { try { localStorage.setItem('liga_ed_' + k, v ? '1' : '0'); } catch { /* sem armazenamento */ } };
  const detalhes = [];
  box.append(h('div', { style: 'display:flex;gap:8px;margin:10px 0' }, h('button', { class: 'b', onclick: () => detalhes.forEach((x) => { x.open = true; }) }, 'Expandir tudo'), h('button', { class: 'b', onclick: () => detalhes.forEach((x) => { x.open = false; }) }, 'Recolher tudo')));
  for (const n of d.niveis) {
    const proximo = 'aula-' + String(Math.max(0, ...n.aulas.map((a) => +a.id.slice(5))) + 1).padStart(2, '0');
    const c = h('details', { class: 'nv' }, h('summary', { style: 'cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline' }, h('h3', { style: 'margin:0' }, n.nome), h('span', { class: 'sub' }, n.dir), h('span', { class: 'badge', style: 'margin-left:auto' }, n.aulas.length + (n.aulas.length === 1 ? ' aula' : ' aulas'))));
    c.open = lembra(n.dir, d.niveis.length <= 2); c.addEventListener('toggle', () => grava(n.dir, c.open)); detalhes.push(c);
    if (!n.aulas.length) c.append(h('p', { class: 'sub' }, 'Nenhuma aula ainda.'));
    for (const a of n.aulas) c.append(h('div', { class: 'al' }, h('span', { class: 't' }, h('b', {}, a.titulo), h('br'), h('small', { class: 'sub' }, a.id)),
      a.editavel ? h('a', { class: 'b pri', href: `/editor?dir=${n.dir}&id=${a.id}` }, 'Editar slides') : h('span', { class: 'sub' }, 'sem permissão'), h('a', { class: 'b', href: `/aula/${n.dir}/${a.id}`, target: '_blank' }, 'Ver'), a.editavel ? h('button', { class: 'b perigo', title: 'Como excluir esta aula', onclick: () => { REPO_INFO = { repo: d.repo, branch: d.branch }; modalExcluir(n.dir, a.id, a.titulo); } }, 'Excluir…') : null));
    if (n.podeCriar) {
      const tit = h('input', { type: 'text', placeholder: 'Título da nova aula', style: 'flex:1;min-width:220px' });
      const copia = h('select', { style: 'width:260px' }, h('option', { value: '' }, 'Começar do zero'), ...todas.map((a) => h('option', { value: a.dir + '/' + a.id }, `Copiar de: ${a.nome} · ${a.titulo}`)));
      c.append(h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center' }, tit, copia,
        h('button', { class: 'b pri', onclick: () => { const t = tit.value.trim(); if (!t) return aviso('Dê um título à aula.', 1); location.href = `/editor?dir=${n.dir}&id=${proximo}&novo=1&titulo=${encodeURIComponent(t)}${copia.value ? '&copiar=' + encodeURIComponent(copia.value) : ''}`; } }, '+ Nova aula (' + proximo + ')')));
    }
    box.append(c);
  }
}

// ======================= EDITOR =======================
const DIR = Q.get('dir'), ID = Q.get('id');
let M = null, base = null, substituir = false, cur = 0, sujo = false, K = 1;
let hist = [], hi = -1, snapT = null;
let sel = null, foco = null, editando = null;
const slideEl = () => $('slide');
const estilo = (s) => `position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box;background:${s.fundo};color:${s.cor};font-family:'DM Sans', Arial, sans-serif;padding:128px`;
const pad2 = (n) => String(n).padStart(2, '0');
function numerar(html, n, total) { return html.replace(/(<[^>]*data-pag="1"[^>]*>)[^<]*/g, `$1${pad2(n)} / ${pad2(total)}`); }
const snapshot = () => JSON.stringify({ titulo: M.titulo, slides: M.slides });
function marcarSujo(v) { sujo = v; const e = $('est'); if (!e) return; e.textContent = v ? '● alterações não salvas' : 'Tudo salvo'; e.className = v ? 'sujo' : 'ok'; }
function agendarSnap() { clearTimeout(snapT); snapT = setTimeout(snap, 350); }
function snap() { clearTimeout(snapT); const s = snapshot(); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 120) hist.shift(); hi = hist.length - 1; atualizaBarra(); }
function desfazer(delta) {
  if (editando) fimEdicao(); snap(); const j = hi + delta; if (j < 0 || j >= hist.length) return;
  hi = j; const o = JSON.parse(hist[hi]); M.titulo = o.titulo; M.slides = o.slides; $('tit').value = M.titulo; cur = Math.min(cur, M.slides.length - 1);
  sel = foco = null; desenhaTudo(); marcarSujo(true); atualizaBarra();
}
function commit() { // lê o palco e guarda no modelo
  if (!M) return; const s = M.slides[cur]; if (!s) return;
  const el = slideEl(); el.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
  s.html = el.innerHTML.trim(); marcarSujo(true); agendarSnap(); miniatura(cur);
}
function miniaturaHtml(s, k) { const d = h('div', { class: 'esc' }); d.style.cssText = estilo(s) + ';transform:scale(.099);transform-origin:0 0'; d.innerHTML = numerar(s.html, k + 1, M.slides.length); return d; }
function miniatura(k) { const c = $('mini').querySelectorAll('.sl .mini')[k]; if (c) { c.textContent = ''; c.append(miniaturaHtml(M.slides[k], k)); } }
function tituloDe(s, k) { const m = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/.exec(s.html); const t = m ? m[1].replace(/<[^>]+>/g, '').trim() : ''; return t || 'Slide ' + (k + 1); }

function desenhaLista() {
  const box = $('mini'); box.textContent = '';
  M.slides.forEach((s, k) => {
    const mini = h('div', { class: 'mini' }); mini.append(miniaturaHtml(s, k));
    const it = h('div', { class: 'sl' + (k === cur ? ' on' : ''), draggable: 'true', title: tituloDe(s, k) }, h('span', { class: 'n' }, k + 1), mini,
      h('div', { class: 'ac' }, h('button', { class: 'b', title: 'Subir', onclick: (e) => { e.stopPropagation(); mover(k, -1); } }, '↑'), h('button', { class: 'b', title: 'Descer', onclick: (e) => { e.stopPropagation(); mover(k, 1); } }, '↓'),
        h('button', { class: 'b', title: 'Duplicar slide', onclick: (e) => { e.stopPropagation(); duplicarSlide(k); } }, '⧉'), h('button', { class: 'b perigo', title: 'Excluir slide', onclick: (e) => { e.stopPropagation(); excluirSlide(k); } }, '✕')));
    it.onclick = () => irPara(k);
    it.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(k)); };
    it.ondragover = (e) => e.preventDefault();
    it.ondrop = (e) => { e.preventDefault(); const de = +e.dataTransfer.getData('text/plain'); if (!Number.isNaN(de) && de !== k) moverPara(de, k); };
    box.append(it);
  });
  box.append(h('button', { class: 'b pri', style: 'width:100%', onclick: modalNovoSlide }, '+ Novo slide'));
}
function renderSlide() {
  const s = M.slides[cur], el = slideEl(); el.style.cssText = estilo(s); el.innerHTML = numerar(s.html, cur + 1, M.slides.length); selecionar(null);
}
function desenhaTudo() { desenhaLista(); renderSlide(); painel(); }
function irPara(k) { if (editando) fimEdicao(); commit(); snap(); cur = k; desenhaLista(); renderSlide(); painel(); $('mini').querySelectorAll('.sl')[k].scrollIntoView({ block: 'nearest' }); }
function mover(k, d) { moverPara(k, k + d); }
function moverPara(de, para) { if (para < 0 || para >= M.slides.length) return; commit(); const [x] = M.slides.splice(de, 1); M.slides.splice(para, 0, x); cur = para; marcarSujo(true); snap(); desenhaTudo(); }
function duplicarSlide(k) { commit(); M.slides.splice(k + 1, 0, JSON.parse(JSON.stringify(M.slides[k]))); cur = k + 1; marcarSujo(true); snap(); desenhaTudo(); }
function excluirSlide(k) { if (M.slides.length < 2) return aviso('A aula precisa ter pelo menos um slide.', 1); if (!confirm('Excluir o slide ' + (k + 1) + '? (dá para desfazer com Ctrl+Z)')) return; commit(); M.slides.splice(k, 1); cur = Math.min(cur, M.slides.length - 1); marcarSujo(true); snap(); desenhaTudo(); }
function novoSlide(m) { commit(); M.slides.splice(cur + 1, 0, { html: m.html, fundo: m.fundo, cor: m.cor, notas: '', tempo: '' }); cur++; marcarSujo(true); snap(); desenhaTudo(); }
function modal(corpo) { const v = h('div', { class: 'edmodal', onclick: (e) => { if (e.target === v) v.remove(); } }, h('div', {}, corpo)); document.body.append(v); return v; }
function modalNovoSlide() {
  const v = modal([h('h3', { style: 'margin-top:0' }, 'Novo slide'), h('p', { class: 'sub' }, 'Escolha um modelo. Depois é só clicar nos textos e trocar.'),
    h('div', { class: 'edmod' }, ...M0.SLIDES.map((m) => h('button', { onclick: () => { novoSlide(m); v.remove(); } }, h('b', {}, m.nome), h('span', {}, m.desc)))),
    h('button', { class: 'b', onclick: () => v.remove() }, 'Cancelar')]);
}

// ---------- seleção, arrastar, redimensionar ----------
const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'U', 'SPAN', 'CODE']);
const topo = (n) => { while (n && n.parentElement !== slideEl()) n = n.parentElement; return n; };
function caixaSel() { const s = $('sel'); if (!sel || !sel.isConnected) { s.hidden = true; return; } const a = slideEl().getBoundingClientRect(), b = sel.getBoundingClientRect(); s.hidden = false; s.style.left = (b.left - a.left) / K + 'px'; s.style.top = (b.top - a.top) / K + 'px'; s.style.width = b.width / K + 'px'; s.style.height = b.height / K + 'px'; s.classList.toggle('edit', !!editando); }
function selecionar(el, f) { sel = el; foco = el ? (f || el) : null; caixaSel(); painel(); }
function ajustaEscala() { const a = $('area'), w = a.clientWidth - 28, hh = a.clientHeight - 28; K = Math.max(0.1, Math.min(w / 1920, hh / 1080)); $('caixa').style.width = 1920 * K + 'px'; $('caixa').style.height = 1080 * K + 'px'; $('palco').style.transform = `scale(${K})`; caixaSel(); }
function pos(e) { const r = slideEl().getBoundingClientRect(); return { x: (e.clientX - r.left) / K, y: (e.clientY - r.top) / K }; }
let arr = null;
function iniciaArrasto(e) {
  if (e.button !== 0) return; if (editando && editando.contains(e.target)) return;
  if (editando) fimEdicao();
  const el = topo(e.target); if (!el) { selecionar(null); return; }
  selecionar(el, e.target); const p = pos(e);
  arr = { el, x0: p.x, y0: p.y, l0: el.offsetLeft, t0: el.offsetTop, mov: false };
  window.addEventListener('pointermove', moveArrasto); window.addEventListener('pointerup', fimArrasto, { once: true });
}
function moveArrasto(e) {
  if (!arr) return; const p = pos(e), dx = p.x - arr.x0, dy = p.y - arr.y0;
  if (!arr.mov && Math.hypot(dx, dy) * K < 4) return;
  if (!arr.mov) { arr.mov = true; const el = arr.el; if (getComputedStyle(el).position !== 'absolute') { el.style.position = 'absolute'; el.style.width = el.offsetWidth + 'px'; } el.style.right = ''; el.style.bottom = ''; }
  let nx = arr.l0 + dx, ny = arr.t0 + dy; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ny = arr.t0; else nx = arr.l0; }
  arr.el.style.left = Math.round(nx) + 'px'; arr.el.style.top = Math.round(ny) + 'px'; caixaSel(); painelPos();
}
function fimArrasto() { window.removeEventListener('pointermove', moveArrasto); if (arr && arr.mov) commit(); arr = null; }
function iniciaRedim(e) {
  e.stopPropagation(); e.preventDefault(); if (!sel) return; const p = pos(e), el = sel, w0 = el.offsetWidth, h0 = el.offsetHeight, temH = !!el.style.height;
  const mv = (ev) => { const q = pos(ev); el.style.width = Math.max(20, Math.round(w0 + q.x - p.x)) + 'px'; if (temH) el.style.height = Math.max(20, Math.round(h0 + q.y - p.y)) + 'px'; caixaSel(); painelPos(); };
  const up = () => { window.removeEventListener('pointermove', mv); commit(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up, { once: true });
}
function comecaEdicao(e) {
  let t = e.target; if (t === slideEl() || t instanceof SVGElement || t.tagName === 'IMG') return;
  while (t.parentElement !== slideEl() && INLINE.has(t.tagName)) t = t.parentElement;
  if (editando) fimEdicao();
  editando = t; t.contentEditable = 'true'; t.focus();
  const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  t.addEventListener('blur', fimEdicao, { once: true }); t.addEventListener('keydown', teclasEdicao); t.addEventListener('paste', colar); t.addEventListener('input', () => caixaSel());
  foco = t; caixaSel();
}
function fimEdicao() { if (!editando) return; const t = editando; editando = null; t.removeAttribute('contenteditable'); t.removeEventListener('keydown', teclasEdicao); t.removeEventListener('paste', colar); commit(); caixaSel(); painel(); }
function teclasEdicao(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
  else if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
  e.stopPropagation();
}
function colar(e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); }

// ---------- operações no elemento selecionado ----------
function inserir(html) {
  if (editando) fimEdicao(); const t = h('div'); t.innerHTML = html.trim(); const el = t.firstElementChild; slideEl().append(el); commit(); selecionar(el); snap();
}
function excluirSel() { if (!sel) return; sel.remove(); sel = foco = null; commit(); snap(); caixaSel(); painel(); }
function duplicarSel() { if (!sel) return; const c = sel.cloneNode(true); c.style.left = (sel.offsetLeft + 30) + 'px'; c.style.top = (sel.offsetTop + 30) + 'px'; c.style.right = ''; c.style.bottom = ''; sel.after(c); commit(); selecionar(c); snap(); }
function camada(frente) { if (!sel) return; if (frente) slideEl().append(sel); else slideEl().prepend(sel); commit(); snap(); caixaSel(); }

// ---------- painel de propriedades ----------
const PALETA = ['#f5b83d', '#3ec9b0', '#f3efe6', '#12141c', '#1d2130', '#cfcbc0', '#8d8a82', '#ff9a8a', '#14161f', '#ffffff'];
function hex(c) { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || ''); if (!m) return '#000000'; return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join(''); }
const transp = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
function campoNum(rot, val, fn, op) { const i = h('input', { type: 'number', value: val, step: (op && op.step) || 1, min: op && op.min }); i.oninput = () => { if (i.value !== '') fn(+i.value); }; return h('div', {}, h('label', {}, rot), i); }
function campoCor(rot, val, fn, limpar) {
  const c = h('input', { type: 'color', value: val || '#000000' }); c.oninput = () => fn(c.value);
  const pal = h('div', { class: 'pal' }, ...PALETA.map((p) => h('i', { style: 'background:' + p, title: p, onclick: () => { c.value = p; fn(p); } })));
  return h('div', {}, h('label', {}, rot), h('div', { class: 'cr' }, c, limpar ? h('button', { class: 'b', onclick: () => { limpar(); } }, 'Sem cor') : null), pal);
}
function aplica(alvo, prop, val) { alvo.style[prop] = val; commit(); caixaSel(); }
function painelPos() { const e = $('props').querySelector('[data-pos]'); if (!e || !sel) return; const v = { x: sel.offsetLeft, y: sel.offsetTop, w: sel.offsetWidth, h: sel.offsetHeight }; for (const i of e.querySelectorAll('input[data-k]')) i.value = v[i.dataset.k]; }
function painel() {
  const P = $('props'); P.textContent = ''; const s = M.slides[cur];
  if (sel && sel.isConnected) {
    const cs = getComputedStyle(foco && foco.isConnected ? foco : sel), f = foco && foco.isConnected ? foco : sel;
    const rot = sel.tagName.toLowerCase() + ': ' + (sel.textContent.trim().slice(0, 28) || '(sem texto)');
    P.append(h('div', { class: 'pg' }, h('h4', {}, 'Bloco selecionado'), h('div', { class: 'sub', style: 'margin-bottom:6px' }, rot),
      h('div', { class: 'rw', 'data-pos': '1' }, campoNumPos('X', 'x', (v) => aplica(sel, 'left', v + 'px')), campoNumPos('Y', 'y', (v) => aplica(sel, 'top', v + 'px')), campoNumPos('Largura', 'w', (v) => aplica(sel, 'width', v + 'px')), sel.style.height ? campoNumPos('Altura', 'h', (v) => aplica(sel, 'height', v + 'px')) : null),
      h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, h('button', { class: 'b', onclick: () => camada(true) }, 'Para frente'), h('button', { class: 'b', onclick: () => camada(false) }, 'Para trás'), h('button', { class: 'b', onclick: duplicarSel }, 'Duplicar'), h('button', { class: 'b perigo', onclick: excluirSel }, 'Excluir')),
      h('p', { class: 'sub' }, 'Dica: arraste o bloco com o mouse, setas movem 1 px (Shift: 10 px), duplo clique edita o texto.')));
    const m = /^(\w+) (\d+)$/.exec(sel.getAttribute('data-build-in') || '');
    const ef = h('select', {}, h('option', { value: '' }, 'Já aparece com o slide'), h('option', { value: 'rise' }, 'Sobe ao clicar'), h('option', { value: 'pop' }, 'Surge ao clicar'), h('option', { value: 'fade' }, 'Aparece ao clicar')); ef.value = m ? m[1] : '';
    const nc = h('input', { type: 'number', min: 1, max: 20, value: m ? m[2] : 1 });
    const grava = () => { if (!ef.value) sel.removeAttribute('data-build-in'); else sel.setAttribute('data-build-in', `${ef.value} ${Math.max(1, Math.min(20, +nc.value || 1))}`); commit(); };
    ef.onchange = grava; nc.oninput = grava;
    P.append(h('div', { class: 'pg' }, h('h4', {}, 'Animação (apresentação)'), ef, h('div', { style: 'margin-top:6px' }, h('label', { class: 'sub' }, 'Aparece no clique nº'), nc)));
    const temTexto = f.textContent.trim().length > 0;
    if (temTexto) P.append(h('div', { class: 'pg' }, h('h4', {}, 'Texto ' + (f !== sel ? '(parte clicada)' : '')),
      h('div', { class: 'rw' }, campoNum('Tamanho (px)', Math.round(parseFloat(cs.fontSize)), (v) => aplica(f, 'fontSize', v + 'px')), campoNum('Altura da linha', parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.2, (v) => aplica(f, 'lineHeight', String(v)), { step: 0.05 })),
      campoCor('Cor do texto', hex(cs.color), (v) => aplica(f, 'color', v)),
      h('div', { style: 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap' }, h('button', { class: 'b' + (+cs.fontWeight >= 600 ? ' on' : ''), onclick: () => { aplica(f, 'fontWeight', +getComputedStyle(f).fontWeight >= 600 ? '400' : '700'); painel(); } }, 'Negrito'),
        ...['left', 'center', 'right'].map((a, k) => h('button', { class: 'b' + (cs.textAlign === a ? ' on' : ''), onclick: () => { aplica(f, 'textAlign', a); painel(); } }, ['Esquerda', 'Centro', 'Direita'][k])),
        h('button', { class: 'b', onclick: () => { const t = /Space/.test(getComputedStyle(f).fontFamily); aplica(f, 'fontFamily', t ? "'DM Sans', Arial, sans-serif" : "'Space Grotesk', Arial, sans-serif"); } }, 'Trocar fonte'))));
    P.append(h('div', { class: 'pg' }, h('h4', {}, 'Aparência ' + (f !== sel ? '(parte clicada)' : '')),
      campoCor('Cor de fundo', transp(cs.backgroundColor) ? '#000000' : hex(cs.backgroundColor), (v) => aplica(f, 'background', v), () => { aplica(f, 'background', 'transparent'); painel(); }),
      h('div', { class: 'rw' }, campoNum('Arredondar (px)', parseInt(cs.borderTopLeftRadius) || 0, (v) => aplica(f, 'borderRadius', v + 'px'), { min: 0 }), campoNum('Opacidade (%)', Math.round((+cs.opacity || 1) * 100), (v) => aplica(f, 'opacity', String(Math.max(0, Math.min(100, v)) / 100)), { min: 0 })),
      f !== sel ? h('button', { class: 'b', style: 'margin-top:6px', onclick: () => { foco = sel; painel(); } }, 'Editar o bloco inteiro') : null));
  }
  P.append(h('div', { class: 'pg' }, h('h4', {}, 'Este slide ' + (cur + 1)),
    campoCor('Cor de fundo do slide', /^#/.test(s.fundo) ? s.fundo : '#12141c', (v) => { s.fundo = v; slideEl().style.background = v; commit(); }),
    campoCor('Cor padrão do texto', /^#/.test(s.cor) ? s.cor : '#f3efe6', (v) => { s.cor = v; slideEl().style.color = v; commit(); }),
    h('div', { style: 'margin-top:8px' }, h('label', { class: 'sub' }, 'Tempo previsto (ex.: 0:05 a 0:10)'), h('input', { type: 'text', value: s.tempo, maxlength: 30, oninput: (e) => { s.tempo = e.target.value; marcarSujo(true); agendarSnap(); } })),
    h('div', { style: 'margin-top:8px' }, h('label', { class: 'sub' }, 'Roteiro do apresentador (uma ideia por linha)'), h('textarea', { rows: 7, maxlength: 4000, placeholder: 'Fica só no arquivo de roteiro. Nunca aparece no slide projetado.', oninput: (e) => { s.notas = e.target.value; marcarSujo(true); agendarSnap(); } }, s.notas))));
}
function campoNumPos(rot, k, fn) { const i = h('input', { type: 'number', 'data-k': k, value: k === 'x' ? sel.offsetLeft : k === 'y' ? sel.offsetTop : k === 'w' ? sel.offsetWidth : sel.offsetHeight }); i.oninput = () => { if (i.value !== '') fn(+i.value); }; return h('div', {}, h('label', {}, rot), i); }

// ---------- imagens ----------
function reduz(file) { // reduz para no máximo 1920 px de largura (WebP) para não pesar no repositório
  return new Promise((ok, no) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return no(new Error('Use PNG, JPG, WEBP ou GIF.'));
    const rd = new FileReader(); rd.onerror = () => no(new Error('Não consegui ler o arquivo.'));
    rd.onload = () => {
      if (file.type === 'image/gif') return file.size > 3e6 ? no(new Error('GIF maior que 3 MB.')) : ok({ dados: rd.result, w: 0, h: 0 });
      const im = new Image(); im.onerror = () => no(new Error('Imagem inválida.'));
      im.onload = () => { const k = Math.min(1, 1920 / im.naturalWidth), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok({ dados: c.toDataURL('image/webp', 0.9), w: c.width, h: c.height }); };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
function inserirImagem(nome, w, hh) {
  const lar = Math.min(w || 800, 800), alt = w ? Math.round(lar * hh / w) : 0;
  inserir(`<img src="/api/imagem?n=${nome}" alt="" style="position:absolute;left:200px;top:260px;width:${lar}px;${alt ? 'height:' + alt + 'px;' : ''}object-fit:cover;border-radius:12px">`);
}
async function modalImagens() {
  const grade = h('div', { class: 'edmod', style: 'grid-template-columns:repeat(auto-fill,minmax(120px,1fr))' }, 'Carregando…');
  const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
  const v = modal([h('h3', { style: 'margin-top:0' }, 'Imagens'), h('p', { class: 'sub' }, 'Envie uma imagem (PNG, JPG, WEBP ou GIF) ou escolha uma já enviada. As imagens ficam públicas: não envie nada confidencial.'),
    h('div', { style: 'display:flex;gap:8px;margin-bottom:8px' }, h('button', { class: 'b pri', onclick: () => arq.click() }, '⬆ Enviar nova imagem'), arq, h('button', { class: 'b', onclick: () => v.remove() }, 'Fechar')), grade]);
  arq.onchange = async () => {
    const f = arq.files[0]; if (!f) return;
    try { aviso('Enviando…'); const r = await reduz(f); const j = await api({ acao: 'upload', nome: f.name, dados: r.dados }); v.remove(); inserirImagem(j.nome, r.w, r.h); aviso('Imagem inserida'); } catch (e) { aviso(e.message, 1); }
  };
  try {
    const d = await ler('acao=imagens'); grade.textContent = '';
    if (!d.imagens.length) grade.append(h('span', { class: 'sub' }, 'Nenhuma imagem enviada ainda.'));
    for (const n of d.imagens) { const b = h('button', { title: n, style: 'padding:4px', onclick: () => { v.remove(); const im = new Image(); im.onload = () => inserirImagem(n, im.naturalWidth, im.naturalHeight); im.onerror = () => inserirImagem(n, 0, 0); im.src = '/api/imagem?n=' + n; } }, h('img', { src: '/api/imagem?n=' + n, alt: '', style: 'width:100%;height:80px;object-fit:cover;border-radius:6px;display:block' })); grade.append(b); }
  } catch (e) { grade.textContent = e.message; }
}
// ---------- histórico ----------
async function historico() {
  const lista = h('div', {}, 'Carregando…');
  const v = modal([h('h3', { style: 'margin-top:0' }, 'Histórico desta aula'), h('p', { class: 'sub' }, 'Cada salvamento é uma versão. "Restaurar" carrega a versão na tela; confira e clique em Salvar para valer (e Ctrl+Z desfaz).'), lista, h('button', { class: 'b', onclick: () => v.remove() }, 'Fechar')]);
  try {
    const d = await ler(`acao=versoes&dir=${encodeURIComponent(DIR)}&id=${encodeURIComponent(ID)}`); lista.textContent = '';
    if (!d.versoes.length) lista.append(h('p', { class: 'sub' }, 'Ainda não há versões salvas pelo editor.'));
    d.versoes.forEach((x, k) => {
      const dt = x.data ? new Date(x.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      lista.append(h('div', { class: 'al' }, h('span', { class: 't' }, h('b', {}, dt), h('span', { class: 'sub' }, x.autor ? '  por @' + x.autor : ''), k === 0 ? h('span', { class: 'badge', style: 'margin-left:8px' }, 'atual') : null),
        h('button', { class: 'b', onclick: async () => {
          if (!confirm('Carregar esta versão na tela? O que está na tela agora será substituído (dá para desfazer com Ctrl+Z).')) return;
          try { const r = await ler(`acao=versao&dir=${encodeURIComponent(DIR)}&id=${encodeURIComponent(ID)}&sha=${x.sha}`); if (editando) fimEdicao(); commit(); snap(); M.titulo = r.modelo.titulo; M.slides = r.modelo.slides; $('tit').value = M.titulo; cur = Math.min(cur, M.slides.length - 1); sel = foco = null; desenhaTudo(); marcarSujo(true); snap(); v.remove(); aviso('Versão carregada. Clique em Salvar para publicá-la.'); } catch (e) { aviso(e.message, 1); }
        } }, 'Restaurar')));
    });
  } catch (e) { lista.textContent = e.message; }
}
// ---------- barra e ferramentas ----------
function atualizaBarra() { const d = $('desf'), r = $('ref'); if (d) d.disabled = hi <= 0 && hist[hi] === snapshot(); if (r) r.disabled = hi >= hist.length - 1; }
async function salvar() {
  if (editando) fimEdicao(); commit(); snap(); const b = $('salvarb'); b.disabled = true; $('est').textContent = 'Salvando…';
  try { const r = await api({ acao: 'salvar', dir: DIR, id: ID, modelo: { titulo: M.titulo, slides: M.slides }, base, substituir }); base = r.base; substituir = false; marcarSujo(false); aviso('Salvo e publicado no repositório'); history.replaceState(null, '', `/editor?dir=${DIR}&id=${ID}`); }
  catch (e) { $('est').textContent = e.message; $('est').className = 'err'; aviso(e.message, 1); } finally { b.disabled = false; }
}
function barra() {
  const B = $('barra'); B.textContent = '';
  const tit = h('input', { id: 'tit', type: 'text', value: M.titulo, maxlength: 120, 'aria-label': 'Título da aula' }); tit.oninput = () => { M.titulo = tit.value; marcarSujo(true); agendarSnap(); };
  B.append(h('a', { class: 'b', href: '/editor' }, '← Aulas'), tit, h('span', { class: 'sub' }, DIR + ' / ' + ID), h('span', { style: 'flex:1' }), h('span', { id: 'est' }, ''),
    h('button', { class: 'b', id: 'desf', onclick: () => desfazer(-1), title: 'Ctrl+Z' }, '↶ Desfazer'), h('button', { class: 'b', id: 'ref', onclick: () => desfazer(1), title: 'Ctrl+Y' }, '↷ Refazer'),
    h('button', { class: 'b', onclick: historico, title: 'Versões salvas desta aula' }, '🕘 Histórico'), h('button', { class: 'b perigo', onclick: () => modalExcluir(DIR, ID, M.titulo), title: 'Como excluir esta aula' }, 'Excluir…'), h('a', { class: 'b', href: `/aula/${DIR}/${ID}`, target: '_blank', title: 'Abre a versão salva' }, 'Ver aula'), h('a', { class: 'b', href: `/aula/${DIR}/${ID}/roteiro`, target: '_blank' }, 'Ver roteiro'),
    h('button', { class: 'b pri', id: 'salvarb', onclick: salvar, title: 'Ctrl+S' }, 'Salvar'));
  const F = $('ferr'); F.textContent = '';
  const ic = h('select', { style: 'width:130px', 'aria-label': 'Ícone' }, ...Object.keys(M0.ICONES).map((n) => h('option', { value: n }, n)));
  F.append(h('span', { class: 'sub' }, 'Adicionar:'), ...[['Título', 'titulo'], ['Texto', 'texto'], ['Etiqueta', 'etiqueta'], ['Cartão', 'cartao'], ['Caixa', 'caixa'], ['Número', 'numero'], ['Pílula', 'pilula']].map(([t, k]) => h('button', { class: 'b', onclick: () => inserir(M0.ELEMENTOS[k]()) }, t)),
    h('button', { class: 'b', onclick: modalImagens }, '🖼 Imagem'), ic, h('button', { class: 'b', onclick: () => inserir(M0.ELEMENTOS.icone(ic.value)) }, '+ Ícone'), h('span', { style: 'flex:1' }), h('a', { class: 'b', target: '_blank', href: `/aula/${DIR}/${ID}#${cur + 1}`, onclick: (e) => { e.currentTarget.href = `/aula/${DIR}/${ID}#${cur + 1}`; } }, '▶ Ver este slide'));
  marcarSujo(sujo); atualizaBarra();
}
function teclas(e) {
  if (!M || editando) return; const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag)) { if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); } return; }
  const c = e.ctrlKey || e.metaKey;
  if (c && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); }
  else if (c && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(e.shiftKey ? 1 : -1); }
  else if (c && e.key.toLowerCase() === 'y') { e.preventDefault(); desfazer(1); }
  else if (c && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicarSel(); }
  else if (!sel) { if (e.key === 'PageDown' && cur < M.slides.length - 1) irPara(cur + 1); else if (e.key === 'PageUp' && cur > 0) irPara(cur - 1); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); excluirSel(); }
  else if (e.key === 'Escape') selecionar(null);
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const p = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key]; sel.style.left = (sel.offsetLeft + d[0]) + 'px'; sel.style.top = (sel.offsetTop + d[1]) + 'px'; sel.style.right = ''; sel.style.bottom = ''; commit(); caixaSel(); painelPos(); }
}

async function iniciar() {
  let d;
  try { d = await ler(`acao=aula&dir=${encodeURIComponent(DIR)}&id=${encodeURIComponent(ID)}`); } catch (e) {
    const b = $('lista-pg'); b.hidden = false; b.append(h('h1', {}, 'Editor de slides'), h('p', {}, e.status === 401 ? 'Entre com o GitHub para usar o editor.' : e.message), h('a', { class: 'btn', href: e.status === 401 ? `/api/login?next=${encodeURIComponent(location.pathname + location.search)}` : '/editor' }, e.status === 401 ? 'Entrar com GitHub' : 'Voltar')); return;
  }
  if (d.origem === 'editor') { M = d.modelo; base = d.base; }
  else if (d.origem === 'html') {
    if (!confirm('Esta aula foi criada fora do editor.\n\nVou importar os slides para o editor. Nada muda até você clicar em Salvar, e a versão atual continua guardada no histórico do GitHub.\n\nContinuar?')) { location.href = '/editor'; return; }
    try { M = (await ler(`acao=importar&dir=${encodeURIComponent(DIR)}&id=${encodeURIComponent(ID)}`)).modelo; substituir = true; } catch (e) { alert(e.message); location.href = '/editor'; return; }
    sujo = true;
  } else {
    const t = Q.get('titulo') || 'Nova aula', c = Q.get('copiar');
    if (c) { const [cd, ci] = c.split('/'); try { M = (await ler(`acao=importar&dir=${encodeURIComponent(cd)}&id=${encodeURIComponent(ci)}`)).modelo; M.titulo = t; } catch (e) { alert(e.message); location.href = '/editor'; return; } }
    else { M = { titulo: t, slides: [M0.SLIDES[0], M0.SLIDES[1]].map((m) => ({ html: m.html, fundo: m.fundo, cor: m.cor, notas: '', tempo: '' })) }; M.slides[0].html = M.slides[0].html.replace('Título da aula', t.replace(/[<>&]/g, '')); }
    sujo = true;
  }
  $('lista-pg').hidden = true; $('ed').classList.add('on'); barra(); hist = [snapshot()]; hi = 0; desenhaTudo(); ajustaEscala(); marcarSujo(sujo);
  const el = slideEl(); el.addEventListener('pointerdown', iniciaArrasto); el.addEventListener('dblclick', comecaEdicao); $('sel').querySelector('.hd').addEventListener('pointerdown', iniciaRedim);
  document.addEventListener('keydown', teclas); addEventListener('resize', ajustaEscala);
  addEventListener('beforeunload', (e) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });
  new ResizeObserver(ajustaEscala).observe($('area'));
}
if (DIR && ID) iniciar(); else lista();
})();
