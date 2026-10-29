'use strict';
// Funções comuns do portal: sessão assinada, acesso ao GitHub e regras de permissão.
const crypto = require('crypto');

const REPO = () => process.env.CONTENT_REPO || 'LAG-CEUMA/liga-curriculo';
const BRANCH = () => process.env.CONTENT_BRANCH || 'main';
const CONFIG_PATH = 'acesso/acesso.json';
const AULA_RE = /^niveis\/([a-z0-9-]+)\/slides\/(aula-\d{2})(-roteiro)?\.html$/;
const SEMANA_RE = /^liberacao\/([a-z0-9-]+)\/(semana-\d{2})\/(aula|tarefa)\.md$/;
const USER_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const NIVEIS = ['owners', 'membros']; // nenhuma aula é pública: 'membros' = quem tem perfil/turma
// Permissões que um owner pode dar a quem não é owner (painel Equipe).
const PERMISSOES = ['site', 'aulas', 'pessoas', 'tarefas', 'presenca', 'slides'];
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
function sessaoReal(req) {
  const s = verificar(cookies(req).liga_s);
  return s && USER_RE.test(s.u) ? s.u.toLowerCase() : null;
}
// "Ver como": owner navega como outra pessoa (cookie assinado liga_as, 1 h). Somente leitura: qualquer escrita vira "sem login".
function personificado(req) {
  const real = sessaoReal(req); if (!real) return null;
  const a = verificar(cookies(req).liga_as);
  return a && a.por === real && USER_RE.test(a.como) ? a.como.toLowerCase() : null;
}
function usuarioDaSessao(req) {
  const real = sessaoReal(req); const como = personificado(req);
  if (!como) return real;
  return (req.method === 'GET' || req.method === 'HEAD') ? como : null;
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
  const r = await fetch(`https://api.github.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'liga-portal',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      ...(opcoes.headers || {}),
    },
  });
  COTA.chamadas++; const hd = (r && r.headers && typeof r.headers.get === 'function') ? r.headers : { get: () => null }; const rem = hd.get('x-ratelimit-remaining');
  if (rem !== null) { COTA.restante = Number(rem); COTA.limite = Number(hd.get('x-ratelimit-limit')) || COTA.limite; COTA.renova = Number(hd.get('x-ratelimit-reset')) * 1000 || COTA.renova; COTA.visto = Date.now(); }
  return r;
}
// Cota do GitHub (5.000 consultas por hora para o portal inteiro). Cada resposta traz o saldo; esta cópia é por instância do servidor.
const COTA = { chamadas: 0, restante: null, limite: 5000, renova: 0, visto: 0 };
async function cotaGitHub() { // saldo exato, vindo do próprio GitHub (consultar o saldo não gasta cota)
  try { const r = await gh('/rate_limit'); if (r.ok) { const c = (await r.json()).resources.core; COTA.restante = c.remaining; COTA.limite = c.limit; COTA.renova = c.reset * 1000; COTA.visto = Date.now(); } } catch { /* usa o último saldo conhecido */ }
  return { restante: COTA.restante, limite: COTA.limite, renova: COTA.renova ? new Date(COTA.renova).toISOString() : '', vistoEm: COTA.visto ? new Date(COTA.visto).toISOString() : '', chamadasDestaInstancia: COTA.chamadas };
}
const cotaBaixa = (min = 600) => COTA.restante !== null && COTA.restante < min && Date.now() < COTA.renova; // economia: pouca cota e a hora ainda não virou
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
  for (const [k, v] of Object.entries(cfg.aulas || {})) if (v === 'membros' || v === 'publico') aulas[k] = 'membros'; // 'publico' legado vira membros
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
      ...(t && t.pesos && typeof t.pesos === 'object' ? { pesos: Object.fromEntries(['presenca', 'participacao', 'exercicios'].filter((k) => t.pesos[k] !== undefined && Number.isFinite(Number(t.pesos[k]))).map((k) => [k, Math.min(100, Math.max(0, Math.round(Number(t.pesos[k]) * 10) / 10))])) } : {}),
      ...(Array.isArray(t && t.rankingFinal) ? { rankingFinal: t.rankingFinal.slice(0, 5).map((x) => ({ usuario: String(x.usuario).toLowerCase(), total: Number(x.total) || 0 })) } : {}),
      alunos: lim(t && t.alunos).filter((a) => alunos.includes(a)) };
  }
  if (!Object.keys(turmas).length) turmas['2026'] = { nome: '2026', status: 'andamento', inicio: '', fim: '', nivel: '', acessoApos: true, acessoAte: '', alunos: [] };
  const padrao = Object.keys(turmas).find((k) => turmas[k].status === 'andamento') || Object.keys(turmas).find((k) => turmas[k].status !== 'arquivada') || Object.keys(turmas)[0];
  for (const a of alunos) if (!Object.values(turmas).some((t) => t.alunos.includes(a))) turmas[padrao].alunos.push(a);
  for (const m of Object.values(monitores)) m.turmas = m.turmas.filter((x) => turmas[x]);
  // Planos (calendários): agrupam turmas de uma trilha. Cada turma pertence a no máximo um plano.
  const planos = {}; const usadas = new Set();
  for (const [id, p] of Object.entries((cfg.planos && typeof cfg.planos === 'object' && !Array.isArray(cfg.planos)) ? cfg.planos : {})) {
    if (!TURMA_ID.test(id)) continue;
    const dt = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
    const ts = [...new Set((Array.isArray(p && p.turmas) ? p.turmas : []).map(String))].filter((t) => turmas[t] && !usadas.has(t)); ts.forEach((t) => usadas.add(t));
    planos[id] = { nome: limpo(p && p.nome, 40) || id, trilha: limpo(p && p.trilha, 30) || 'Trilha 1', inicio: dt(p && p.inicio), fim: dt(p && p.fim), turmas: ts, premiacao: dt(p && p.premiacao),
      diaSemana: p && /^[0-6]$/.test(String(p.diaSemana)) ? Number(p.diaSemana) : '', horario: limpo(p && p.horario, 30), semanasSemAula: (Array.isArray(p && p.semanasSemAula) ? p.semanasSemAula : []).map(dt).filter(Boolean).slice(0, 60).sort() };
  }
  // Assuntos (Artes, Música…): cada um tem seus níveis (pastas de aulas); um nível pertence a um assunto só.
  const assuntos = {}; const nivelUsado = new Set();
  for (const [id, a] of Object.entries((cfg.assuntos && typeof cfg.assuntos === 'object' && !Array.isArray(cfg.assuntos)) ? cfg.assuntos : {})) {
    if (!/^[a-z0-9-]{1,20}$/.test(id)) continue;
    const ns = [...new Set((Array.isArray(a && a.niveis) ? a.niveis : []).map(String))].filter((d) => /^nivel-\d{2}-[a-z0-9-]{1,40}$/.test(d) && !nivelUsado.has(d)); ns.forEach((d) => nivelUsado.add(d));
    assuntos[id] = { nome: limpo(a && a.nome, 30) || id, niveis: ns.sort() };
  }
  // Acesso extra ao material de um nível, por pessoa, com validade: { usuario: [{ nivel, ate, motivo }] }
  const acessos = {};
  for (const [usuario, l] of Object.entries((cfg.acessos && typeof cfg.acessos === 'object' && !Array.isArray(cfg.acessos)) ? cfg.acessos : {})) {
    const nome = String(usuario).trim().toLowerCase();
    if (!USER_RE.test(nome) || !Array.isArray(l)) continue;
    const itens = l.filter((x) => x && /^[a-z0-9-]{1,60}$/.test(String(x.nivel || ''))).slice(0, 20)
      .map((x) => ({ nivel: x.nivel, ate: /^\d{4}-\d{2}-\d{2}$/.test(String(x.ate || '')) ? x.ate : maisUmAno(), motivo: limpo(x.motivo, 80) }));
    if (itens.length) acessos[nome] = itens;
  }
  const pn = (v, a, b, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, Math.round(n * 10) / 10)) : pad; };
  const pc = cfg.pontuacao && typeof cfg.pontuacao === 'object' ? cfg.pontuacao : {};
  const pontuacao = { pesos: { presenca: pn((pc.pesos || {}).presenca, 0, 100, 40), participacao: pn((pc.pesos || {}).participacao, 0, 100, 30), exercicios: pn((pc.pesos || {}).exercicios, 0, 100, 30) },
    meta: pn(pc.meta, 1, 500, 30), top5Visivel: pc.top5Visivel !== false, tipos: {} };
  for (const k of ['pergunta', 'ajuda', 'apresentacao', 'desafio', 'outro', 'penalidade']) pontuacao.tipos[k] = pn((pc.tipos || {})[k], 0, 5, 1);
  // Escopos do editor de slides por pessoa: "nivel-01-x" (nível inteiro) ou "nivel-01-x/aula-02" (uma aula)
  const editores = {};
  for (const [usuario, l] of Object.entries((cfg.editores && typeof cfg.editores === 'object' && !Array.isArray(cfg.editores)) ? cfg.editores : {})) {
    const nome = String(usuario).trim().toLowerCase();
    if (!USER_RE.test(nome) || !Array.isArray(l)) continue;
    const itens = [...new Set(l.map(String).filter((x) => /^nivel-\d{2}-[a-z0-9-]{1,40}(\/aula-\d{2})?$/.test(x)))].slice(0, 60);
    if (itens.length) editores[nome] = itens;
  }
  return { owners: lim(cfg.owners), monitores, alunos, aulas, equipe, cargos, turmas, planos, assuntos, arenaAtiva: cfg.arenaAtiva === true, acessos, pontuacao, editores };
}
let ULTIMA_CFG = null; // última configuração lida com sucesso: se o GitHub recusar por um tempo (cota), o login continua funcionando com ela
async function lerConfig() {
  return comCache('config', 30000, async () => {
    const r = await gh(`/repos/${REPO()}/contents/${CONFIG_PATH}?ref=${BRANCH()}`);
    if (r.status === 404) return { cfg: configPadrao(), sha: null };
    if (!r.ok) {
      let det = ''; try { det = String((await r.json()).message || '').slice(0, 120); } catch { /* sem corpo */ }
      const lim = `restante=${COTA.restante} renova=${COTA.renova ? new Date(COTA.renova).toISOString() : '?'}`;
      console.error(`[portal] GitHub ${r.status} ao ler a configuração: ${det} (${lim})`);
      if (ULTIMA_CFG) return ULTIMA_CFG;
      throw new Error(`GitHub ${r.status} ao ler a configuração`);
    }
    const j = await r.json();
    let cfg;
    try { cfg = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { cfg = configPadrao(); }
    return (ULTIMA_CFG = { cfg: normalizar(cfg), sha: j.sha });
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
const temExtra = (cfg, usuario, dir) => ((cfg.acessos || {})[usuario] || []).some((x) => x.nivel === dir && x.ate >= hojeBR());
// Níveis a que a pessoa está vinculada pelas turmas (aluno ou monitor). null = todos.
function niveisVinculados(cfg, usuario) {
  const m = (cfg.monitores || {})[usuario];
  const ids = m ? (m.turmas && m.turmas.length ? m.turmas : Object.keys(cfg.turmas || {})) : Object.keys(cfg.turmas || {}).filter((k) => (cfg.turmas[k].alunos || []).includes(usuario));
  const ts = ids.map((k) => (cfg.turmas || {})[k]).filter(Boolean);
  if (!ts.length) return new Set();
  if (ts.some((t) => !t.nivel)) return null;
  return new Set(ts.map((t) => t.nivel));
}
// Editor de slides: owner; escopo dado pelo owner (nível inteiro ou aula); ou cargo/permissão "slides" + vínculo com o nível pela turma.
function podeEditarSlides(cfg, usuario, dir, id) {
  if (!usuario) return false;
  if (papel(cfg, usuario) === 'owner') return true;
  if (((cfg.editores || {})[usuario] || []).some((x) => x === dir || (id && x === `${dir}/${id}`))) return true;
  if (!permissoes(cfg, usuario).includes('slides')) return false;
  const v = niveisVinculados(cfg, usuario);
  return v === null || v.has(dir);
}
const nivelDe = (cfg, chave) => cfg.aulas[chave] || 'owners';
// Pode abrir os slides (roteiro=false) ou o roteiro (roteiro=true) da aula `chave`?
function pode(cfg, usuario, chave, roteiro) {
  const p = papel(cfg, usuario);
  if (p === 'owner') return true;
  if (roteiro) return p === 'monitor' && cfg.monitores[usuario].roteiros.includes(chave);
  const n = nivelDe(cfg, chave);
  if (n === 'membros' && usuario && temExtra(cfg, usuario, chave.split('/')[0])) return true;
  if (n === 'membros' && (p === 'monitor' || p === 'equipe')) return true;
  if (n === 'membros' && p === 'aluno') { const v = niveisDoAluno(cfg, usuario); if (v === null || v.has(chave.split('/')[0])) return true; }
  return p === 'monitor' && cfg.monitores[usuario].aulas.includes(chave);
}
function origemOk(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

module.exports = { cotaGitHub, cotaBaixa, COTA, niveisVinculados, podeEditarSlides, temExtra, hojeBR, maisUmAno, niveisDoAluno, PERMISSOES, permissoes, temPerm, tituloDe, comCache, REPO, BRANCH, NIVEIS, USER_RE, SESSAO_DIAS, enviar, json, redirecionar, paginaSimples, assinar, verificar, cookies, cookieSet, cookieLimpar,
  usuarioDaSessao, sessaoReal, personificado, baseUrl, proximoSeguro, gh, lerArquivo, lerConfig, gravarConfig, limparCache, listarAulas, listarSemanas, papel, nivelDe, pode, origemOk, normalizar, admins };
