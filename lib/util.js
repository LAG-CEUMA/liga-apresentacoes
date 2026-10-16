'use strict';
// Funções comuns do portal: sessão assinada, acesso ao GitHub e regras de permissão.
const crypto = require('crypto');

const REPO = () => process.env.CONTENT_REPO || 'LAG-CEUMA/liga-curriculo';
const BRANCH = () => process.env.CONTENT_BRANCH || 'main';
const CONFIG_PATH = 'acesso/acesso.json';
const AULA_RE = /^niveis\/([a-z0-9-]+)\/slides\/(aula-\d{2})(-roteiro)?\.html$/;
const SEMANA_RE = /^liberacao\/([a-z0-9-]+)\/(semana-\d{2})\/(aula|tarefa)\.md$/;
const USER_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const NIVEIS = ['owners', 'membros', 'publico'];
// Permissões que um owner pode dar a quem não é owner (painel Equipe).
const PERMISSOES = ['site', 'aulas', 'pessoas', 'tarefas', 'presenca'];
const SESSAO_DIAS = 7;

// ---------- resposta ----------
function enviar(res, status, corpo, cab = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(cab)) res.setHeader(k, v);
  res.end(corpo);
}
function json(res, status, obj) {
  enviar(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}
function redirecionar(res, url, cab = {}) { enviar(res, 302, '', { Location: url, 'Cache-Control': 'no-store', ...cab }); }
function paginaSimples(res, status, titulo, texto, extra = '') {
  enviar(res, status, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title><link rel="stylesheet" href="/api/tema.css"><style>:root{color-scheme:dark}body{margin:0;background:var(--bg,#12141c);color:var(--txt,#f3efe6);font-family:'DM Sans',Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:20px}main{max-width:520px}h1{font-size:28px}a{color:var(--ouro,#f5b83d)}</style><main><h1>${titulo}</h1><p>${texto}</p>${extra}<p><a href="/">Voltar para as aulas</a></p></main>`,
    { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
}

// ---------- cookies e sessão ----------
function segredo() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET ausente ou curto (mínimo 16 caracteres)');
  return s;
}
const b64 = (b) => Buffer.from(b).toString('base64url');
function assinar(obj) {
  const corpo = b64(JSON.stringify(obj));
  const mac = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return `${corpo}.${mac}`;
}
function verificar(token) {
  if (typeof token !== 'string') return null;
  const [corpo, mac] = token.split('.');
  if (!corpo || !mac) return null;
  const esperado = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!obj.exp || obj.exp < Date.now()) return null;
    return obj;
  } catch { return null; }
}
function cookies(req) {
  const out = {};
  for (const p of String(req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function cookieSet(nome, valor, segundos) {
  return `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${segundos}`;
}
const cookieLimpar = (nome) => `${nome}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function usuarioDaSessao(req) {
  const s = verificar(cookies(req).liga_s);
  return s && USER_RE.test(s.u) ? s.u.toLowerCase() : null;
}
function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `https://${host}`;
}
function proximoSeguro(n) {
  return typeof n === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : '/';
}

// ---------- GitHub ----------
async function gh(caminho, opcoes = {}) {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN ausente');
  return fetch(`https://api.github.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'liga-portal',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      ...(opcoes.headers || {}),
    },
  });
}
const cache = new Map();
async function comCache(chave, ttlMs, fn) {
  const c = cache.get(chave);
  if (c && c.exp > Date.now()) return c.v;
  const v = await fn();
  cache.set(chave, { v, exp: Date.now() + ttlMs });
  return v;
}
const limparCache = () => cache.clear();

async function lerArquivo(caminho) {
  const r = await gh(`/repos/${REPO()}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${BRANCH()}`,
    { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${caminho}`);
  return r.text();
}

// ---------- configuração de acesso ----------
function configPadrao() { return { owners: [], monitores: {}, alunos: [], aulas: {}, equipe: {} }; }
// monitores: { usuario: { aulas: [chaves com slides liberados], roteiros: [chaves com roteiro liberado] } }
function normalizar(cfg) {
  cfg = cfg || {};
  const lim = (l) => [...new Set((Array.isArray(l) ? l : []).map((x) => String(x).trim().toLowerCase()).filter((x) => USER_RE.test(x)))];
  const chaves = (l) => [...new Set((Array.isArray(l) ? l : []).map(String).filter((x) => /^[a-z0-9-]+\/aula-\d{2}$/.test(x)))];
  const aulas = {};
  for (const [k, v] of Object.entries(cfg.aulas || {})) if (v === 'membros' || v === 'publico') aulas[k] = v;
  const monitores = {};
  const fonte = Array.isArray(cfg.monitores) ? Object.fromEntries(cfg.monitores.map((m) => [m, {}])) : (cfg.monitores || {});
  for (const [usuario, g] of Object.entries(fonte)) {
    const nome = String(usuario).trim().toLowerCase();
    if (USER_RE.test(nome)) monitores[nome] = { aulas: chaves(g && g.aulas), roteiros: chaves(g && g.roteiros) };
  }
  const equipe = {};
  for (const [usuario, g] of Object.entries((cfg.equipe && typeof cfg.equipe === 'object' && !Array.isArray(cfg.equipe)) ? cfg.equipe : {})) {
    const nome = String(usuario).trim().toLowerCase();
    if (!USER_RE.test(nome)) continue;
    const perm = [...new Set((Array.isArray(g && g.permissoes) ? g.permissoes : []).filter((x) => PERMISSOES.includes(x)))];
    equipe[nome] = { titulo: String((g && g.titulo) || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40), permissoes: perm };
  }
  return { owners: lim(cfg.owners), monitores, alunos: lim(cfg.alunos), aulas, equipe };
}
async function lerConfig() {
  return comCache('config', 20000, async () => {
    const r = await gh(`/repos/${REPO()}/contents/${CONFIG_PATH}?ref=${BRANCH()}`);
    if (r.status === 404) return { cfg: configPadrao(), sha: null };
    if (!r.ok) throw new Error(`GitHub ${r.status} ao ler a configuração`);
    const j = await r.json();
    let cfg;
    try { cfg = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { cfg = configPadrao(); }
    return { cfg: normalizar(cfg), sha: j.sha };
  });
}
async function gravarConfig(cfg, mensagem) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    limparCache();
    const { sha } = await lerConfig();
    const corpo = { message: mensagem, branch: BRANCH(), content: Buffer.from(JSON.stringify(normalizar(cfg), null, 2) + '\n').toString('base64') };
    if (sha) corpo.sha = sha;
    const r = await gh(`/repos/${REPO()}/contents/${CONFIG_PATH}`, { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { limparCache(); return; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar a configuração`);
  }
  throw new Error('Conflito ao gravar a configuração. Tente de novo.');
}

// ---------- aulas ----------
async function listarAulas() {
  return comCache('aulas', 60000, async () => {
    const r = await gh(`/repos/${REPO()}/git/trees/${BRANCH()}?recursive=1`);
    if (!r.ok) throw new Error(`GitHub ${r.status} ao listar as aulas`);
    const arvore = (await r.json()).tree || [];
    const mapa = new Map();
    for (const it of arvore) {
      const m = AULA_RE.exec(it.path || '');
      if (!m) continue;
      const [, dir, id, rot] = m;
      const chave = `${dir}/${id}`;
      const a = mapa.get(chave) || { chave, dir, id };
      if (rot) a.roteiro = it.path; else a.slides = it.path;
      mapa.set(chave, a);
    }
    const dirs = [...new Set([...mapa.values()].map((a) => a.dir))];
    const titulos = {};
    await Promise.all(dirs.map(async (d) => {
      try { const t = await lerArquivo(`niveis/${d}/slides/indice.json`); titulos[d] = t ? JSON.parse(t) : {}; } catch { titulos[d] = {}; }
    }));
    return [...mapa.values()].filter((a) => a.slides).map((a) => {
      const nn = (/^nivel-(\d+)/.exec(a.dir) || [])[1];
      return { ...a,
        nivel: nn !== undefined ? `Nível ${Number(nn)}` : a.dir,
        titulo: titulos[a.dir][a.id] || `Aula ${Number(a.id.slice(5))}` };
    }).sort((x, y) => x.chave.localeCompare(y.chave));
  });
}

// Material de cada semana (aula.md e tarefa.md), para os owners avaliarem antes de liberar.
async function listarSemanas() {
  return comCache('semanas', 60000, async () => {
    const r = await gh(`/repos/${REPO()}/git/trees/${BRANCH()}?recursive=1`);
    if (!r.ok) throw new Error(`GitHub ${r.status} ao listar as semanas`);
    const itens = [];
    for (const it of (await r.json()).tree || []) {
      const m = SEMANA_RE.exec(it.path || '');
      if (m) itens.push({ dir: m[1], semana: m[2], tipo: m[3], path: it.path });
    }
    const mapa = new Map();
    await Promise.all(itens.map(async (i) => {
      const texto = (await lerArquivo(i.path)) || '';
      const k = `${i.dir}/${i.semana}`;
      const s = mapa.get(k) || { chave: k, dir: i.dir, semana: i.semana };
      s[i.tipo] = { texto, path: i.path, editar: `https://github.com/${REPO()}/edit/${BRANCH()}/${i.path}` };
      mapa.set(k, s);
    }));
    return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  });
}

// ---------- permissões ----------
// Papéis: owner (vê tudo e libera), monitor (nível de aluno + permissões dadas por pessoa), aluno, visitante.
function admins() { return String(process.env.ADMIN_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean); }
function papel(cfg, usuario) {
  if (!usuario) return 'visitante';
  if (admins().includes(usuario) || cfg.owners.includes(usuario)) return 'owner';
  if (cfg.monitores[usuario]) return 'monitor';
  if (cfg.equipe && cfg.equipe[usuario]) return 'equipe';
  if (cfg.alunos.includes(usuario)) return 'aluno';
  return 'visitante';
}
// Permissões de quem está vendo: owner tem todas; equipe tem as que um owner marcou.
function permissoes(cfg, usuario) {
  if (papel(cfg, usuario) === 'owner') return PERMISSOES.slice();
  return (cfg.equipe && cfg.equipe[usuario] && cfg.equipe[usuario].permissoes) || [];
}
const temPerm = (cfg, usuario, perm) => permissoes(cfg, usuario).includes(perm);
const tituloDe = (cfg, usuario) => (cfg.equipe && cfg.equipe[usuario] && cfg.equipe[usuario].titulo) || '';
const nivelDe = (cfg, chave) => cfg.aulas[chave] || 'owners';
// Pode abrir os slides (roteiro=false) ou o roteiro (roteiro=true) da aula `chave`?
function pode(cfg, usuario, chave, roteiro) {
  const p = papel(cfg, usuario);
  if (p === 'owner') return true;
  if (roteiro) return p === 'monitor' && cfg.monitores[usuario].roteiros.includes(chave);
  const n = nivelDe(cfg, chave);
  if (n === 'publico') return true;
  if (n === 'membros' && (p === 'aluno' || p === 'monitor' || p === 'equipe')) return true;
  return p === 'monitor' && cfg.monitores[usuario].aulas.includes(chave);
}
function origemOk(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

module.exports = { PERMISSOES, permissoes, temPerm, tituloDe, comCache, REPO, BRANCH, NIVEIS, USER_RE, SESSAO_DIAS, enviar, json, redirecionar, paginaSimples, assinar, verificar, cookies, cookieSet, cookieLimpar,
  usuarioDaSessao, baseUrl, proximoSeguro, gh, lerArquivo, lerConfig, gravarConfig, limparCache, listarAulas, listarSemanas, papel, nivelDe, pode, origemOk, normalizar, admins };
