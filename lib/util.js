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
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const maisUmAno = () => { const d = new Date(Date.now() - 3 * 3600e3); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); };
const TURMA_ID = /^[A-Za-z0-9._-]{1,20}$/;
const CARGO_ID = /^[a-z0-9][a-z0-9-]{0,29}$/;
const limpo = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

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
function configPadrao() { return normalizar({}); }
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
    if (USER_RE.test(nome)) monitores[nome] = { aulas: chaves(g && g.aulas), roteiros: chaves(g && g.roteiros), turmas: [...new Set((Array.isArray(g && g.turmas) ? g.turmas : []).map(String).filter((x) => TURMA_ID.test(x)))] };
  }
  const cargos = {};
  for (const [id, c] of Object.entries((cfg.cargos && typeof cfg.cargos === 'object' && !Array.isArray(cfg.cargos)) ? cfg.cargos : {})) {
    if (!CARGO_ID.test(id)) continue;
    cargos[id] = { nome: limpo(c && c.nome, 40) || id, descricao: limpo(c && c.descricao, 100),
      permissoes: [...new Set((Array.isArray(c && c.permissoes) ? c.permissoes : []).filter((x) => PERMISSOES.includes(x)))] };
  }
  const equipe = {};
  for (const [usuario, g] of Object.entries((cfg.equipe && typeof cfg.equipe === 'object' && !Array.isArray(cfg.equipe)) ? cfg.equipe : {})) {
    const nome = String(usuario).trim().toLowerCase();
    if (!USER_RE.test(nome)) continue;
    const perm = [...new Set((Array.isArray(g && g.permissoes) ? g.permissoes : []).filter((x) => PERMISSOES.includes(x)))];
    const cs = [...new Set((Array.isArray(g && g.cargos) ? g.cargos : []).map(String).filter((x) => cargos[x]))];
    equipe[nome] = { titulo: String((g && g.titulo) || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40), permissoes: perm, cargos: cs };
  }
  const alunos = lim(cfg.alunos);
  // Turmas: cada aluno pertence a pelo menos uma turma (migração: quem não tem turma vai para a turma ativa).
  const turmas = {};
  for (const [id, t] of Object.entries((cfg.turmas && typeof cfg.turmas === 'object' && !Array.isArray(cfg.turmas)) ? cfg.turmas : {})) {
    if (!TURMA_ID.test(id)) continue;
    turmas[id] = { nome: limpo(t && t.nome, 40) || id, status: ['andamento', 'planejada', 'arquivada'].includes(t && t.status) ? t.status : 'andamento',
      inicio: /^\d{4}-\d{2}-\d{2}$/.test(String((t && t.inicio) || '')) ? t.inicio : '',
      fim: /^\d{4}-\d{2}-\d{2}$/.test(String((t && t.fim) || '')) ? t.fim : '',
      nivel: /^[a-z0-9-]{1,60}$/.test(String((t && t.nivel) || '')) ? t.nivel : '',
      acessoApos: !(t && t.acessoApos === false),
      acessoAte: /^\d{4}-\d{2}-\d{2}$/.test(String((t && t.acessoAte) || '')) ? t.acessoAte : '',
      alunos: lim(t && t.alunos).filter((a) => alunos.includes(a)) };
  }
  if (!Object.keys(turmas).length) turmas['2026'] = { nome: '2026', status: 'andamento', inicio: '', fim: '', nivel: '', acessoApos: true, acessoAte: '', alunos: [] };
  const padrao = Object.keys(turmas).find((k) => turmas[k].status === 'andamento') || Object.keys(turmas).find((k) => turmas[k].status !== 'arquivada') || Object.keys(turmas)[0];
  for (const a of alunos) if (!Object.values(turmas).some((t) => t.alunos.includes(a))) turmas[padrao].alunos.push(a);
  for (const m of Object.values(monitores)) m.turmas = m.turmas.filter((x) => turmas[x]);
  return { owners: lim(cfg.owners), monitores, alunos, aulas, equipe, cargos, turmas };
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
// Permissões de uma pessoa da equipe = extras dela + as de cada cargo que ocupa (união).
function permissoes(cfg, usuario) {
  if (papel(cfg, usuario) === 'owner') return PERMISSOES.slice();
  const e = cfg.equipe && cfg.equipe[usuario];
  if (!e) return [];
  const todas = new Set(e.permissoes || []);
  for (const c of e.cargos || []) for (const p of ((cfg.cargos || {})[c] || {}).permissoes || []) todas.add(p);
  return PERMISSOES.filter((p) => todas.has(p));
}
const temPerm = (cfg, usuario, perm) => permissoes(cfg, usuario).includes(perm);
const tituloDe = (cfg, usuario) => {
  const e = cfg.equipe && cfg.equipe[usuario];
  if (!e) return '';
  return [...(e.cargos || []).map((c) => (cfg.cargos[c] || {}).nome).filter(Boolean), e.titulo].filter(Boolean).join(', ');
};
// Níveis (pastas de aula) que o aluno enxerga pelas turmas dele. null = todos (turma sem nível definida).
// Turma arquivada só conta se mantém acesso após arquivar.
function niveisDoAluno(cfg, usuario) {
  const ts = Object.values(cfg.turmas || {}).filter((t) => t.alunos.includes(usuario) && (t.status !== 'arquivada' || (t.acessoApos && (!t.acessoAte || t.acessoAte >= hojeBR()))));
  if (!ts.length) return new Set();
  if (ts.some((t) => !t.nivel)) return null;
  return new Set(ts.map((t) => t.nivel));
}
const nivelDe = (cfg, chave) => cfg.aulas[chave] || 'owners';
// Pode abrir os slides (roteiro=false) ou o roteiro (roteiro=true) da aula `chave`?
function pode(cfg, usuario, chave, roteiro) {
  const p = papel(cfg, usuario);
  if (p === 'owner') return true;
  if (roteiro) return p === 'monitor' && cfg.monitores[usuario].roteiros.includes(chave);
  const n = nivelDe(cfg, chave);
  if (n === 'publico') return true;
  if (n === 'membros' && (p === 'monitor' || p === 'equipe')) return true;
  if (n === 'membros' && p === 'aluno') { const v = niveisDoAluno(cfg, usuario); if (v === null || v.has(chave.split('/')[0])) return true; }
  return p === 'monitor' && cfg.monitores[usuario].aulas.includes(chave);
}
function origemOk(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

module.exports = { hojeBR, maisUmAno, niveisDoAluno, PERMISSOES, permissoes, temPerm, tituloDe, comCache, REPO, BRANCH, NIVEIS, USER_RE, SESSAO_DIAS, enviar, json, redirecionar, paginaSimples, assinar, verificar, cookies, cookieSet, cookieLimpar,
  usuarioDaSessao, baseUrl, proximoSeguro, gh, lerArquivo, lerConfig, gravarConfig, limparCache, listarAulas, listarSemanas, papel, nivelDe, pode, origemOk, normalizar, admins };
