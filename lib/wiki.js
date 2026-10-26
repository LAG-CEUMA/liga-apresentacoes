'use strict';
// Guias e dúvidas: wiki interna. wiki/indice.json + wiki/<slug>.html no repositório de conteúdo.
// Cada página tem uma visibilidade por função, escolhida no envio: owner < monitor < equipe < aluno (cada nível inclui os de cima).
const u = require('./util'); const R = require('./reservado');
const DIR = 'wiki'; const INDICE = `${DIR}/indice.json`; const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/; const MAX_HTML = 600 * 1024;
const VIS = { owner: 'Só owners', monitor: 'Owners e monitores', equipe: 'Corpo administrativo (owners, monitores e equipe)', aluno: 'Todos os membros logados' };
const CATEGORIAS = ['Comece aqui', 'Tutoriais', 'Dúvidas frequentes', 'Problemas comuns', 'Processos', 'Modelos'];
const txt = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
async function listar() {
  const t = await u.lerArquivo(INDICE); if (!t) return [];
  try { const l = JSON.parse(t); return Array.isArray(l) ? l.filter((x) => x && SLUG_RE.test(x.slug)) : []; } catch { return []; }
}
// Quem enxerga a página. cfg vem de u.lerConfig().
function pode(cfg, usuario, pag) {
  const p = u.papel(cfg, usuario); const v = pag.visibilidade;
  if (p === 'owner') return true;
  if (p === 'monitor') return ['monitor', 'equipe', 'aluno'].includes(v);
  if (p === 'equipe') {
    if (!['equipe', 'aluno'].includes(v)) return false;
    const cs = Array.isArray(pag.cargos) ? pag.cargos : []; if (!cs.length || v === 'aluno') return true;
    const meus = ((cfg.equipe || {})[usuario] || {}).cargos || []; return meus.some((c) => cs.includes(c));
  }
  if (p === 'aluno') return v === 'aluno';
  return false;
}
const resumo = (html) => String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
function slugDe(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
const lista = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => txt(x, 40)).filter(Boolean).slice(0, 12);
async function salvar(b, usuario) {
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  const l = await listar(); const hoje = new Date().toISOString().slice(0, 10);
  let item = b.slug ? l.find((x) => x.slug === b.slug) : null;
  if (b.slug && !item) throw bad('Página não encontrada.');
  const titulo = txt(b.titulo, 100); if (!titulo) throw bad('Dê um título para a página.');
  if (!VIS[b.visibilidade]) throw bad('Escolha quem pode ver a página.');
  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : 'Tutoriais';
  const html = b.html == null || b.html === '' ? null : String(b.html);
  if (!item && !html) throw bad('Envie o arquivo HTML da página.');
  if (html !== null && (!html.trim() || Buffer.byteLength(html) > MAX_HTML)) throw bad('O HTML está vazio ou passa de 600 KB.');
  if (!item) {
    let s = slugDe(titulo); if (!SLUG_RE.test(s)) s = 'pagina-' + Date.now().toString(36);
    let k = s, n = 2; while (l.some((x) => x.slug === k)) k = `${s}-${n++}`.slice(0, 60);
    item = { slug: k, criado: hoje }; l.push(item);
  }
  Object.assign(item, { titulo, categoria, visibilidade: b.visibilidade, cargos: lista(b.cargos), tags: lista(b.tags), resumo: txt(b.resumo, 240), ordem: Math.max(0, Math.min(999, parseInt(b.ordem, 10) || 100)), atualizado: hoje, por: usuario });
  if (html !== null) { item.texto = resumo(html).slice(0, 6000); await R.gravar(`${DIR}/${item.slug}.html`, html, `Portal: ${usuario} salvou o guia "${titulo}"`); }
  await R.gravar(INDICE, JSON.stringify(l, null, 2) + '\n', `Portal: ${usuario} atualizou o índice de Guias e dúvidas`);
  return item;
}
async function remover(slug, usuario) {
  const l = await listar(); const item = l.find((x) => x.slug === slug);
  if (!item) throw Object.assign(new Error('Página não encontrada.'), { status: 400 });
  const s = await R.sha(`${DIR}/${slug}.html`);
  if (s) { const r = await u.gh(`/repos/${u.REPO()}/contents/${DIR}/${slug}.html`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Portal: ${usuario} removeu o guia "${item.titulo}"`, branch: u.BRANCH(), sha: s }) });
    if (!r.ok) throw new Error(`GitHub ${r.status} ao remover`); }
  await R.gravar(INDICE, JSON.stringify(l.filter((x) => x.slug !== slug), null, 2) + '\n', `Portal: ${usuario} atualizou o índice de Guias e dúvidas`);
}
module.exports = { SLUG_RE, VIS, CATEGORIAS, listar, pode, salvar, remover };
