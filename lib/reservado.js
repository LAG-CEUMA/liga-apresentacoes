'use strict';
// Páginas reservadas: HTML guardado em reservado/<codigo>.html, acessível só por /r/<codigo> (código secreto, sem login e sem aparecer em lista pública).
// O índice (reservado/indice.json) só é lido pelo painel dos owners.
const crypto = require('crypto'); const u = require('./util');
const DIR = 'reservado'; const INDICE = `${DIR}/indice.json`; const TOKEN_RE = /^[a-f0-9]{24}$/; const MAX_HTML = 600 * 1024;
const cam = (p) => p.split('/').map(encodeURIComponent).join('/');
async function sha(caminho) {
  const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(caminho)}?ref=${u.BRANCH()}`);
  if (r.status === 404) return null; if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${caminho}`);
  return (await r.json()).sha || null;
}
async function gravar(caminho, texto, msg) {
  for (let t = 0; t < 2; t++) {
    const s = await sha(caminho);
    const corpo = { message: msg, branch: u.BRANCH(), content: Buffer.from(texto).toString('base64') }; if (s) corpo.sha = s;
    const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(caminho)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (r.ok) { u.limparCache(); return; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar ${caminho}`);
  }
  throw new Error('Conflito ao gravar. Tente de novo.');
}
async function listar() {
  const t = await u.lerArquivo(INDICE); if (!t) return [];
  try { const l = JSON.parse(t); return Array.isArray(l) ? l.filter((x) => x && TOKEN_RE.test(x.token)) : []; } catch { return []; }
}
const titulo = (v) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
async function salvar({ token, titulo: t, html }, usuario) {
  html = String(html || ''); t = titulo(t);
  if (!t) throw Object.assign(new Error('Dê um nome para a página.'), { status: 400 });
  if (!html.trim() || Buffer.byteLength(html) > MAX_HTML) throw Object.assign(new Error('O arquivo HTML está vazio ou passa de 600 KB.'), { status: 400 });
  const lista = await listar(); const hoje = new Date().toISOString().slice(0, 10);
  let item = token ? lista.find((x) => x.token === token) : null;
  if (token && !item) throw Object.assign(new Error('Página não encontrada.'), { status: 400 });
  if (!item) { item = { token: crypto.randomBytes(12).toString('hex'), criado: hoje, por: usuario }; lista.unshift(item); }
  item.titulo = t; item.atualizado = hoje; item.por = usuario;
  await gravar(`${DIR}/${item.token}.html`, html, `Portal: ${usuario} salvou a página reservada "${t}"`);
  await gravar(INDICE, JSON.stringify(lista, null, 2) + '\n', `Portal: ${usuario} atualizou o índice de páginas reservadas`);
  return item;
}
async function remover(token, usuario) {
  const lista = await listar(); const item = lista.find((x) => x.token === token);
  if (!item) throw Object.assign(new Error('Página não encontrada.'), { status: 400 });
  const s = await sha(`${DIR}/${token}.html`);
  if (s) { const r = await u.gh(`/repos/${u.REPO()}/contents/${cam(`${DIR}/${token}.html`)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Portal: ${usuario} removeu a página reservada "${item.titulo}"`, branch: u.BRANCH(), sha: s }) });
    if (!r.ok) throw new Error(`GitHub ${r.status} ao remover`); }
  await gravar(INDICE, JSON.stringify(lista.filter((x) => x.token !== token), null, 2) + '\n', `Portal: ${usuario} atualizou o índice de páginas reservadas`);
}
// Páginas coladas do Artifact vêm sem <!doctype>: completa o documento.
function embrulhar(html) {
  if (/^\s*<!doctype/i.test(html)) return html;
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">' +
    '<style>html{color-scheme:light dark}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>';
}
module.exports = { TOKEN_RE, MAX_HTML, listar, salvar, remover, embrulhar, sha, gravar };
