'use strict';
// Personalização do site (cores, logo, fundos, anúncios, agenda, redes). Guardada em site/site.json no repositório de conteúdo.
const u = require('./util'); const V = require('../public/vitrine.js');
const SITE_PATH = 'site/site.json';
const IMG_DIR = 'site/imagens';
const COR = /^#[0-9a-f]{6}$/i;
const IMG = /^[a-z0-9][a-z0-9._-]{0,80}\.(png|jpg|jpeg|webp|gif)$/;
const URL_OK = /^https?:\/\/[^\s"'<>\\]{1,300}$/;
const PAGINAS = ['inicio', 'painel', 'semanas'];
const REDES = ['Instagram', 'YouTube', 'Discord', 'WhatsApp', 'GitHub', 'LinkedIn', 'TikTok', 'X', 'Site', 'Outro'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const MAX_IMG = 3 * 1024 * 1024;

const TEMA_PADRAO = { bg: '#12141c', card: '#1d2130', txt: '#f3efe6', mut: '#8d8a82', primaria: '#f5b83d', botaoTxt: '#12141c', sucesso: '#3ec9b0' };
function padrao() {
  return {
    nome: 'Liga de Games Ceuma', tag: 'LIGA ACADÊMICA DE GAMES · CEUMA', logo: '',
    tema: { ...TEMA_PADRAO }, raio: 10,
    fundos: Object.fromEntries(PAGINAS.map((p) => [p, { img: '', escurecer: 50 }])),
    boasVindas: { titulo: 'Bem-vindo à Liga de Games Ceuma', texto: 'Aqui você encontra as aulas, os avisos e a agenda da liga. Entre com o GitHub para ver o que é só para membros.' },
    anuncios: [], agenda: [], redes: [], temas: [], vitrine: [],
  };
}
const txt = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const num = (v, a, b, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, Math.round(x))) : d; };
const cor = (v, d) => (typeof v === 'string' && COR.test(v) ? v.toLowerCase() : d);
const url = (v) => { const s = txt(v, 300); return URL_OK.test(s) ? s : ''; };
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const hora = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '');
const img = (v) => (typeof v === 'string' && IMG.test(v) ? v : '');
const vis = (v) => (v === 'membros' ? 'membros' : 'publico');
const idDe = (v, i) => (/^[a-z0-9]{4,20}$/.test(String(v || '')) ? String(v) : 'x' + Date.now().toString(36) + i);

function visual(o) {
  o = o || {}; const t = o.tema || {};
  const tema = {}; for (const k of Object.keys(TEMA_PADRAO)) tema[k] = cor(t[k], TEMA_PADRAO[k]);
  const fundos = {}; for (const p of PAGINAS) { const f = (o.fundos || {})[p] || {}; fundos[p] = { img: img(f.img), escurecer: num(f.escurecer, 0, 90, 50) }; }
  return { tema, raio: num(o.raio, 0, 30, 10), fundos };
}
function sanitizar(o) {
  o = o && typeof o === 'object' ? o : {};
  const d = padrao(); const v = visual(o);
  const bv = o.boasVindas || {};
  return {
    nome: txt(o.nome, 60) || d.nome, tag: txt(o.tag, 80), logo: img(o.logo), ...v,
    boasVindas: { titulo: txt(bv.titulo, 120), texto: txt(bv.texto, 600) },
    anuncios: (Array.isArray(o.anuncios) ? o.anuncios : []).slice(0, 50).map((a, i) => ({ id: idDe(a.id, i), titulo: txt(a.titulo, 120), texto: txt(a.texto, 800), link: url(a.link),
      visivel: vis(a.visivel), fixo: !!a.fixo, de: data(a.de), ate: data(a.ate) })).filter((a) => a.titulo),
    agenda: (Array.isArray(o.agenda) ? o.agenda : []).slice(0, 100).map((a, i) => ({ id: idDe(a.id, i), titulo: txt(a.titulo, 120), data: data(a.data), hora: hora(a.hora),
      local: txt(a.local, 120), link: url(a.link), visivel: vis(a.visivel) })).filter((a) => a.titulo && a.data),
    redes: (Array.isArray(o.redes) ? o.redes : []).slice(0, 12).map((r) => ({ nome: REDES.includes(r.nome) ? r.nome : 'Outro', url: url(r.url) })).filter((r) => r.url),
    vitrine: (Array.isArray(o.vitrine) ? o.vitrine : []).slice(0, 24).map((x, i) => { const n = V.normalizar(x); return { id: idDe(x && x.id, i), titulo: txt(x && x.titulo, 80), legenda: txt(x && x.legenda, 280), url: n.url, embed: n.embed, modo: n.modo, imagem: img(x && x.imagem), botao: txt(x && x.botao, 30), altura: n.altura, visivel: vis(x && x.visivel) }; }).filter((x) => x.titulo && (x.url || x.embed)),
    temas: (Array.isArray(o.temas) ? o.temas : []).slice(0, 20).map((t) => ({ nome: txt(t && t.nome, 40), ...visual(t) })).filter((t) => t.nome),
  };
}

async function lerSite() {
  return u.comCache('site', 20000, async () => {
    const r = await u.gh(`/repos/${u.REPO()}/contents/${SITE_PATH}?ref=${u.BRANCH()}`);
    if (r.status === 404) return { site: padrao(), sha: null };
    if (!r.ok) throw new Error(`GitHub ${r.status} ao ler o site`);
    const j = await r.json();
    let s; try { s = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { s = {}; }
    return { site: sanitizar(s), sha: j.sha };
  });
}
async function gravarSite(site, mensagem) {
  for (let t = 0; t < 2; t++) {
    u.limparCache();
    const { sha } = await lerSite();
    const corpo = { message: mensagem, branch: u.BRANCH(), content: Buffer.from(JSON.stringify(sanitizar(site), null, 2) + '\n').toString('base64') };
    if (sha) corpo.sha = sha;
    const r = await u.gh(`/repos/${u.REPO()}/contents/${SITE_PATH}`, { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { u.limparCache(); return; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar o site`);
  }
  throw new Error('Conflito ao gravar o site. Tente de novo.');
}
function tipoDaImagem(b) {
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.slice(0, 6).toString())) return 'gif';
  return null;
}
async function enviarImagem(nomeOriginal, buf, usuario) {
  if (buf.length > MAX_IMG) throw Object.assign(new Error('Imagem maior que 3 MB.'), { status: 400 });
  const ext = tipoDaImagem(buf);
  if (!ext) throw Object.assign(new Error('Use PNG, JPG, WEBP ou GIF.'), { status: 400 });
  const base = txt(nomeOriginal, 60).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'imagem';
  const nome = `${base}-${Date.now().toString(36)}.${ext}`;
  const r = await u.gh(`/repos/${u.REPO()}/contents/${IMG_DIR}/${nome}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Portal: ${usuario} enviou a imagem ${nome}`, branch: u.BRANCH(), content: buf.toString('base64') }) });
  if (!r.ok) throw new Error(`GitHub ${r.status} ao enviar a imagem`);
  u.limparCache();
  return nome;
}
async function listarImagens() {
  return u.comCache('imagens', 20000, async () => {
    const r = await u.gh(`/repos/${u.REPO()}/contents/${IMG_DIR}?ref=${u.BRANCH()}`);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`GitHub ${r.status} ao listar imagens`);
    return (await r.json()).map((f) => f.name).filter((n) => IMG.test(n)).sort().reverse();
  });
}
async function lerImagem(nome) {
  if (!IMG.test(nome)) return null;
  const r = await u.gh(`/repos/${u.REPO()}/contents/${IMG_DIR}/${nome}?ref=${u.BRANCH()}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler a imagem`);
  return Buffer.from(await r.arrayBuffer());
}
function rgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(','); }
function cssDoTema(s) {
  const t = s.tema;
  let css = `:root{--bg:${t.bg};--card:${t.card};--txt:${t.txt};--mut:${t.mut};--ouro:${t.primaria};--btntxt:${t.botaoTxt};--ver:${t.sucesso};--raio:${s.raio}px}\n`;
  for (const p of PAGINAS) {
    const f = s.fundos[p];
    if (f.img) css += `body[data-pg="${p}"]{background-image:linear-gradient(rgba(${rgb(t.bg)},${f.escurecer / 100}),rgba(${rgb(t.bg)},${f.escurecer / 100})),url(/api/imagem?n=${f.img});background-size:cover;background-position:center;background-attachment:fixed}\n`;
  }
  return css;
}
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // America/Sao_Paulo (UTC-3)
function paraLeitor(s, papel) {
  const ok = (v) => v === 'publico' || papel !== 'visitante';
  const h = hoje();
  const anuncios = s.anuncios.filter((a) => ok(a.visivel) && (!a.de || a.de <= h) && (!a.ate || a.ate >= h)).sort((a, b) => Number(b.fixo) - Number(a.fixo));
  const agenda = s.agenda.filter((a) => ok(a.visivel) && a.data >= h).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  return { nome: s.nome, tag: s.tag, logo: s.logo, boasVindas: s.boasVindas, anuncios, agenda, redes: s.redes, vitrine: (s.vitrine || []).filter((v) => ok(v.visivel)) };
}
module.exports = { PAGINAS, REDES, TEMA_PADRAO, MIME, MAX_IMG, padrao, sanitizar, lerSite, gravarSite, enviarImagem, listarImagens, lerImagem, cssDoTema, paraLeitor, hoje };
