'use strict';
// Editor de slides: modelo (JSON), limpeza do HTML, geração dos arquivos da aula e do roteiro.
// Fonte da verdade das aulas criadas no editor: niveis/<nivel>/editor/<aula>.json
// Gerados a cada salvamento: niveis/<nivel>/slides/<aula>.html e <aula>-roteiro.html (+ indice.json).
const sanitizeHtml = require('sanitize-html');
const u = require('./util');

const DIR_RE = /^nivel-\d{2}-[a-z0-9-]{1,40}$/;
const AULA_ID_RE = /^aula-\d{2}$/;
const MAX_SLIDES = 60;

// ---------- limpeza ----------
const SEGURO = /^(?!.*(?:url\s*\(|expression|javascript|@import|\\|<|>))[^;{}]{0,200}$/i;
const PROPS = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'left', 'top', 'right', 'bottom', 'color', 'background', 'background-color', 'font-size', 'font-weight',
  'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'margin', 'margin-left',
  'margin-right', 'margin-top', 'margin-bottom', 'border', 'border-left', 'border-right', 'border-top', 'border-bottom', 'border-radius', 'border-color', 'border-width', 'border-style', 'border-collapse',
  'box-shadow', 'display', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'overflow', 'opacity', 'box-sizing', 'white-space', 'vertical-align', 'list-style', 'object-fit', 'stroke', 'fill'];
const estilos = {}; for (const p of PROPS) estilos[p] = [SEGURO];
estilos.position = [/^(absolute|relative)$/];
estilos['z-index'] = [/^\d{1,2}$/];
estilos['font-family'] = [/^[\w\s'",\-]{1,100}$/];
estilos.transform = [/^(?:\s*(?:rotate|scale|translate)[XY]?\([-\d.,a-z%\s]*\))+$/i];
estilos['clip-path'] = [/^polygon\([\d.,%\s\-]*\)$/i];
const SVG_ATTR = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'];
const IMG_RE = /^\/api\/imagem\?n=[\w.\-]{1,120}$/;
const OPCOES = {
  allowedTags: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'span', 'b', 'strong', 'i', 'em', 'u', 'br', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'code', 'pre',
    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'],
  allowedAttributes: { '*': ['style', 'data-build-in', 'data-pag'], svg: ['viewBox', 'preserveAspectRatio', ...SVG_ATTR], path: ['d', ...SVG_ATTR], circle: ['cx', 'cy', 'r', ...SVG_ATTR],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', ...SVG_ATTR], line: ['x1', 'y1', 'x2', 'y2', ...SVG_ATTR], polyline: ['points', ...SVG_ATTR], polygon: ['points', ...SVG_ATTR],
    ellipse: ['cx', 'cy', 'rx', 'ry', ...SVG_ATTR], g: SVG_ATTR, img: ['src', 'alt'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
  allowedStyles: { '*': estilos },
  allowedSchemes: [], allowProtocolRelative: false, disallowedTagsMode: 'discard',
  parser: { lowerCaseAttributeNames: false },
  transformTags: { '*': (tag, at) => {
    const a = { ...at };
    if (a['data-build-in'] !== undefined && !/^(rise|pop|fade) \d{1,2}$/.test(a['data-build-in'])) delete a['data-build-in'];
    if (a['data-pag'] !== undefined) a['data-pag'] = '1';
    if (tag === 'img' && !IMG_RE.test(a.src || '')) delete a.src;
    return { tagName: tag, attribs: a };
  } },
  exclusiveFilter: (f) => f.tag === 'img' && !f.attribs.src,
};
const limpar = (html) => sanitizeHtml(String(html || '').slice(0, 80000), OPCOES);

// ---------- modelo ----------
const COR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|(?:linear|radial)-gradient\([#\w\s.,%()\-]+\))$/i;
const cor = (v, pad) => (COR_RE.test(String(v || '').trim()) ? String(v).trim().slice(0, 200) : pad);
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
function normalizar(m) {
  m = m && typeof m === 'object' ? m : {};
  const slides = (Array.isArray(m.slides) ? m.slides : []).slice(0, MAX_SLIDES).map((s) => ({
    html: limpar(s && s.html), fundo: cor(s && s.fundo, '#12141c'), cor: cor(s && s.cor, '#f3efe6'),
    notas: txt(s && s.notas, 4000), tempo: txt(s && s.tempo, 30) }));
  return { v: 1, titulo: txt(m.titulo, 120) || 'Aula sem título', slides };
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textoPlano = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
function tituloDoSlide(s, i) {
  const m = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/.exec(s.html); const t = m ? textoPlano(m[1]) : '';
  return t || `Slide ${i + 1}`;
}
const cliques = (s) => Math.max(0, ...[...s.html.matchAll(/data-build-in="\w+ (\d+)"/g)].map((x) => +x[1]));

// ---------- geração da página de slides (mesmo visual e teclas das aulas do Nível 0) ----------
const CSS = `*{margin:0;box-sizing:border-box}html,body{height:100%;background:#000;overflow:hidden}
#stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
.slide{display:none}.slide.on{display:block}
.slide [data-b]{transition:opacity .45s,transform .45s}.slide [data-b].hid{opacity:0;pointer-events:none}
.slide [data-b].hid.rise{transform:translateY(40px)}.slide [data-b].hid.pop{transform:scale(.9)}.slide [data-b].hid.fade{transform:none}
table{border-collapse:collapse;width:100%}td,th{padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.18);text-align:left;vertical-align:top}
#notes{position:fixed;left:0;right:0;bottom:0;background:#111c;color:#fff;font:20px/1.4 'DM Sans',Arial,sans-serif;padding:18px 28px;display:none;z-index:9}
#help{position:fixed;right:12px;top:8px;color:#fff8;font:14px Arial;z-index:9}`;
const JS = `const S=[...document.querySelectorAll('.slide')];let i=0,st=0;
const NOTES=JSON.parse(document.getElementById('nt').textContent);
S.forEach(s=>s.querySelectorAll('[data-build-in]').forEach(e=>{const[ef,n]=e.dataset.buildIn.split(' ');e.dataset.b=n;e.classList.add(ef);}));
const mx=s=>Math.max(0,...[...s.querySelectorAll('[data-b]')].map(e=>+e.dataset.b));
function show(){S.forEach((s,k)=>s.classList.toggle('on',k===i));S[i].querySelectorAll('[data-b]').forEach(e=>e.classList.toggle('hid',+e.dataset.b>st));
document.getElementById('notes').textContent=NOTES[i]||'';history.replaceState(null,'','#'+(i+1));}
function fit(){const k=Math.min(innerWidth/1920,innerHeight/1080);const t=document.getElementById('stage');t.style.transform='scale('+k+')';t.style.left=(innerWidth-1920*k)/2+'px';t.style.top=(innerHeight-1080*k)/2+'px';}
function next(){if(st<mx(S[i]))st++;else if(i<S.length-1){i++;st=0}show()}
function prev(){if(st>0)st--;else if(i>0){i--;st=mx(S[i])}show()}
addEventListener('keydown',e=>{const k=e.key;if([' ','ArrowRight','ArrowDown','PageDown','Enter'].includes(k)){e.preventDefault();next()}
else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k)){e.preventDefault();prev()}
else if(k==='Home'){i=0;st=0;show()}else if(k==='End'){i=S.length-1;st=mx(S[i]);show()}
else if(k==='f'||k==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
else if(k==='n'||k==='N'){const n=document.getElementById('notes');n.style.display=n.style.display==='block'?'none':'block'}});
addEventListener('click',e=>{if(e.clientX<innerWidth*0.2)prev();else next()});addEventListener('resize',fit);
const h=parseInt(location.hash.slice(1));if(h>0&&h<=S.length)i=h-1;fit();show();`;
const FONTES = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap">';
const pad2 = (n) => String(n).padStart(2, '0');
function estiloSlide(s) {
  return `position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box;background:${s.fundo};color:${s.cor};font-family:'DM Sans', Arial, sans-serif;padding:128px`;
}
function numerar(html, n, total) { // rodapé "NN / MM" automático nos elementos marcados com data-pag
  return html.replace(/(<[^>]*data-pag="1"[^>]*>)[^<]*/g, `$1${pad2(n)} / ${pad2(total)}`);
}
function renderAula(m) {
  const sl = m.slides.map((s, k) => `<div class="slide" data-transition="fade" style="${estiloSlide(s).replace(/"/g, '&quot;')}">\n${numerar(s.html, k + 1, m.slides.length)}\n</div>`);
  const nt = JSON.stringify(m.slides.map(() => '')).replace(/<\//g, '<\\/'); // o roteiro nunca vai junto dos slides
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.titulo)}</title>${FONTES}<style>${CSS}</style></head><body><div id="stage">${sl.join('\n')}</div><div id="notes"></div><div id="help"></div><script id="nt" type="application/json">${nt}</script><script>${JS}</script></body></html>\n`;
}
function renderRoteiro(m, idAula) {
  const linhas = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const resumo = m.slides.map((s, k) => `<tr><td>${k + 1}</td><td>${esc(tituloDoSlide(s, k))}</td><td>${esc(s.tempo)}</td></tr>`).join('');
  const secoes = m.slides.map((s, k) => {
    const li = linhas(s.notas).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>Sem anotações para este slide.</li>';
    const c = cliques(s);
    return `<section><h3>Slide ${k + 1}: ${esc(tituloDoSlide(s, k))}</h3><p class="t">${s.tempo ? 'Tempo: ' + esc(s.tempo) + ' · ' : ''}Cliques para completar o slide: ${c}</p><ul>${li}</ul></section>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.titulo)} · ROTEIRO (não projetar)</title>
<style>body{font:18px/1.5 'DM Sans',Arial,sans-serif;max-width:860px;margin:24px auto;padding:0 20px;color:#14161f;background:#f3efe6}h1{font-size:28px}.aviso{background:#c0392b;color:#fff;padding:12px 16px;border-radius:8px;font-weight:700}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border-bottom:1px solid #0002;padding:8px;text-align:left}section{background:#fff;border-radius:12px;padding:12px 20px;margin:14px 0;border:1px solid #0002}h3{margin:6px 0}.t{color:#6a6a62;margin:0}</style></head><body>
<p class="aviso">ROTEIRO DO APRESENTADOR. NÃO PROJETAR. Abra em outra tela ou no celular.</p>
<h1>${esc(m.titulo)}</h1><p>Slides correspondentes: <b>${esc(idAula)}.html</b>. Teclas nos slides: seta direita/espaço avança, seta esquerda volta, F tela cheia.</p>
<h2>Resumo</h2><table><tr><th>N</th><th>Slide</th><th>Tempo</th></tr>${resumo}</table>
<h2>Roteiro slide a slide</h2>${secoes}</body></html>\n`;
}

// ---------- importar aulas já existentes (geradas pelo script do Nível 0 ou por este editor) ----------
function importarHtml(html, roteiroHtml) {
  html = String(html || '');
  const ini = html.indexOf('<div id="stage">');
  const fim = html.indexOf('<div id="notes">');
  if (ini < 0 || fim < 0) throw new Error('Formato de slides não reconhecido para importação.');
  const miolo = html.slice(ini + '<div id="stage">'.length, fim).replace(/<\/div>\s*$/, ''); // fecha o #stage
  const partes = miolo.split(/(?=<div class="slide")/).filter((p) => p.trim().startsWith('<div class="slide"'));
  if (!partes.length) throw new Error('Nenhum slide encontrado no arquivo.');
  const titulo = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || 'Aula importada';
  const slides = partes.map((p) => {
    const cab = /^<div class="slide"([^>]*)>/.exec(p);
    const est = (/style="([^"]*)"/.exec(cab ? cab[1] : '') || [])[1] || '';
    const pega = (nome) => { const m = new RegExp('(?:^|;)\\s*' + nome + ':\\s*([^;]+)').exec(est.replace(/&quot;/g, '"')); return m ? m[1].trim() : ''; };
    let interno = p.slice(cab ? cab[0].length : 0).replace(/<\/div>\s*$/, '');
    interno = interno.replace(/<(p|div|span)([^>]*)>(\d{2} \/ \d{1,3})<\/\1>/g, (m, t, a, n) => `<${t}${a} data-pag="1">${n}</${t}>`);
    return { html: interno.trim(), fundo: pega('background') || pega('background-color'), cor: pega('color'), notas: '', tempo: '' };
  });
  if (roteiroHtml) {
    for (const sec of String(roteiroHtml).matchAll(/<section><h3>Slide (\d+):[\s\S]*?<\/h3><p class="t">([\s\S]*?)<\/p>([\s\S]*?)<\/section>/g)) {
      const s = slides[+sec[1] - 1]; if (!s) continue;
      const tm = /Tempo:\s*([^·<]+)/.exec(sec[2]); if (tm) s.tempo = tm[1].trim();
      const itens = [...sec[3].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => textoPlano(x[1]));
      s.notas = itens.filter((x) => x !== 'Sem anotações para este slide.').join('\n');
    }
  }
  return normalizar({ titulo: textoPlano(titulo), slides });
}

// ---------- gravação no repositório de conteúdo ----------
const cam = (p) => p.split('/').map(encodeURIComponent).join('/');
async function sha(path) {
  const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(path)}?ref=${u.BRANCH()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${path}`);
  return (await r.json()).sha;
}
async function gravar(path, texto, mensagem, esperado) {
  for (let t = 0; t < 3; t++) {
    const atual = await sha(path);
    if (esperado !== undefined && (atual || null) !== (esperado || null)) { const e = new Error('Outra pessoa salvou antes de você. Recarregue a página para ver a versão mais nova.'); e.status = 409; throw e; }
    const corpo = { message: mensagem, branch: u.BRANCH(), content: Buffer.from(texto).toString('base64') };
    if (atual) corpo.sha = atual;
    const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(path)}`, { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { const j = await r.json().catch(() => ({})); return (j.content && j.content.sha) || null; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar ${path}`);
    esperado = undefined; await new Promise((ok) => setTimeout(ok, 150 * (t + 1)));
  }
  throw new Error('Conflito ao gravar. Tente de novo.');
}
async function lerJsonRepo(path) {
  const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(path)}?ref=${u.BRANCH()}`);
  if (r.status === 404) return { dados: null, sha: null };
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${path}`);
  const j = await r.json();
  try { return { dados: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha }; } catch { return { dados: null, sha: j.sha }; }
}
const caminhos = (dir, id) => ({ json: `niveis/${dir}/editor/${id}.json`, html: `niveis/${dir}/slides/${id}.html`, roteiro: `niveis/${dir}/slides/${id}-roteiro.html`, indice: `niveis/${dir}/slides/indice.json` });
async function salvarAula(dir, id, bruto, usuario, base, substituir) {
  const c = caminhos(dir, id), m = normalizar(bruto);
  if (!m.slides.length) throw Object.assign(new Error('A aula precisa de pelo menos um slide.'), { status: 400 });
  const jaTemJson = await sha(c.json);
  if ((jaTemJson || null) !== (base || null)) { const e = new Error('Outra pessoa salvou antes de você (ou esta aula já existe). Recarregue a página para ver a versão mais nova.'); e.status = 409; throw e; }
  if (!jaTemJson && (await sha(c.html)) && !substituir) throw Object.assign(new Error('Esta aula já existe sem o editor. Abra-a pelo editor para importar antes de salvar.'), { status: 400 });
  const msg = `Portal: ${usuario} editou os slides de ${dir}/${id}`;
  await gravar(c.html, renderAula(m), msg);
  await gravar(c.roteiro, renderRoteiro(m, id), msg);
  const novoSha = await gravar(c.json, JSON.stringify(m, null, 2) + '\n', msg);
  const ind = await lerJsonRepo(c.indice); const obj = ind.dados && typeof ind.dados === 'object' ? ind.dados : {};
  if (obj[id] !== m.titulo) { obj[id] = m.titulo; await gravar(c.indice, JSON.stringify(obj, null, 2) + '\n', msg); }
  u.limparCache();
  return { modelo: m, base: novoSha };
}
async function lerAula(dir, id) {
  const c = caminhos(dir, id);
  const j = await lerJsonRepo(c.json);
  if (j.dados) return { modelo: normalizar(j.dados), base: j.sha, origem: 'editor' };
  const html = await u.lerArquivo(c.html);
  return html === null ? null : { modelo: null, base: null, origem: 'html' };
}
async function importarExistente(dir, id) {
  const c = caminhos(dir, id);
  const html = await u.lerArquivo(c.html); if (html === null) return null;
  return importarHtml(html, await u.lerArquivo(c.roteiro));
}
// Histórico: commits do arquivo-fonte da aula (cada salvamento no editor é um commit).
async function versoes(dir, id) {
  const r = await u.gh(`/repos/${u.REPO()}/commits?sha=${encodeURIComponent(u.BRANCH())}&path=${encodeURIComponent(caminhos(dir, id).json)}&per_page=30`);
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler o histórico`);
  return (await r.json()).map((c) => ({ sha: c.sha, data: (c.commit && c.commit.author && c.commit.author.date) || '', autor: ((/^Portal: (\S+) /.exec((c.commit && c.commit.message) || '') || [])[1]) || '' }));
}
async function lerVersao(dir, id, ref) {
  if (!/^[0-9a-f]{40}$/.test(String(ref || ''))) throw Object.assign(new Error('Versão inválida.'), { status: 400 });
  const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(caminhos(dir, id).json)}?ref=${ref}`);
  if (!r.ok) throw Object.assign(new Error('Versão não encontrada.'), { status: 404 });
  const j = await r.json();
  try { return normalizar(JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'))); } catch { throw Object.assign(new Error('Versão ilegível.'), { status: 404 }); }
}
async function listarNiveis() {
  const r = await u.gh(`/repos/${u.REPO()}/git/trees/${u.BRANCH()}?recursive=1`);
  if (!r.ok) throw new Error(`GitHub ${r.status} ao listar os níveis`);
  const ds = new Set();
  for (const it of (await r.json()).tree || []) { const m = /^niveis\/(nivel-\d{2}-[a-z0-9-]+)\//.exec(it.path || ''); if (m && DIR_RE.test(m[1])) ds.add(m[1]); }
  return [...ds].sort();
}
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
async function novoNivel(numero, nome, usuario) {
  const n = Math.round(Number(numero)); if (!(n >= 0 && n <= 99)) throw Object.assign(new Error('Número do nível inválido (0 a 99).'), { status: 400 });
  const s = slug(nome); if (!s) throw new Error('Informe o nome do nível.');
  const dir = `nivel-${pad2(n)}-${s}`; if (!DIR_RE.test(dir)) throw new Error('Nome do nível inválido.');
  if ((await listarNiveis()).some((d) => d.startsWith(`nivel-${pad2(n)}-`))) throw new Error(`Já existe um Nível ${n}.`);
  await gravar(`niveis/${dir}/slides/indice.json`, '{}\n', `Portal: ${usuario} criou o nível ${dir}`);
  u.limparCache();
  return dir;
}
module.exports = { versoes, lerVersao, DIR_RE, AULA_ID_RE, limpar, normalizar, renderAula, renderRoteiro, importarHtml, salvarAula, lerAula, importarExistente, listarNiveis, novoNivel, caminhos, tituloDoSlide, pad2 };
