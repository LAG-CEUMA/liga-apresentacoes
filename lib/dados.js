'use strict';
// Dados de presença e participação. Um arquivo JSON por aula e turma: dados/aulas/<turma>/<nivel>/<aula>.json.
// Só guarda o usuário do GitHub e o estado (p = presente, a = ausente, j = justificado). Sem nomes nem e-mails.
const crypto = require('crypto');
const u = require('./util');
const TURMA_RE = /^[A-Za-z0-9._-]{1,20}$/;
const TIPOS = { pergunta: 'Pergunta boa', ajuda: 'Ajudou um colega', apresentacao: 'Apresentou resultado', desafio: 'Resolveu um desafio', outro: 'Outro' };
const ROTULOS = ['Início', 'Meio', 'Fim'];
const ARQ_RE = /^dados\/aulas\/([A-Za-z0-9._-]{1,20})\/([a-z0-9-]+\/aula-\d{2})\.json$/;
const REPO = () => process.env.DATA_REPO || u.REPO();
const caminho = (turma, chave) => `dados/aulas/${turma}/${chave}.json`;
const urlConteudo = (c) => `/repos/${REPO()}/contents/${c.split('/').map(encodeURIComponent).join('/')}`;

async function lerSessao(turma, chave) {
  const r = await u.gh(`${urlConteudo(caminho(turma, chave))}?ref=${u.BRANCH()}`);
  if (r.status === 404) return { dados: null, sha: null };
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler a sessão`);
  const j = await r.json();
  return { dados: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha };
}
// Lê, aplica a mudança e grava; se alguém gravou no meio, tenta de novo.
async function atualizarSessao(turma, chave, mudar, mensagem) {
  for (let t = 0; t < 3; t++) {
    const { dados, sha } = await lerSessao(turma, chave);
    const novo = mudar(dados || { turma, chave, data: '', chamadas: {}, participacoes: [] });
    const corpo = { message: mensagem, branch: u.BRANCH(), content: Buffer.from(JSON.stringify(novo, null, 2) + '\n').toString('base64') };
    if (sha) corpo.sha = sha;
    const r = await u.gh(urlConteudo(caminho(turma, chave)), { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { u.limparCache(); return novo; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar a sessão`);
    await new Promise((ok) => setTimeout(ok, 150 * (t + 1)));
  }
  throw new Error('Conflito ao gravar a chamada. Tente de novo.');
}
async function listarSessoes() {
  return u.comCache('sessoes', 30000, async () => {
    const r = await u.gh(`/repos/${REPO()}/git/trees/${u.BRANCH()}?recursive=1`);
    if (!r.ok) throw new Error(`GitHub ${r.status} ao listar as sessões`);
    const arqs = ((await r.json()).tree || []).map((i) => ARQ_RE.exec(i.path || '')).filter(Boolean).slice(0, 600);
    const lidas = await Promise.all(arqs.map(async (m) => {
      const rr = await u.gh(`${urlConteudo(m[0])}?ref=${u.BRANCH()}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (!rr.ok) return null;
      try { const d = JSON.parse(await rr.text()); return { ...d, turma: m[1], chave: m[2] }; } catch { return null; }
    }));
    return lidas.filter(Boolean);
  });
}
// Estado final de cada aluno numa sessão: presente se esteve em pelo menos metade das chamadas salvas.
function resumoSessao(s) {
  const ns = Object.keys(s.chamadas || {});
  const salvas = ns.length;
  const alunos = new Set();
  for (const n of ns) for (const k of Object.keys(s.chamadas[n].estados || {})) alunos.add(k);
  for (const p of s.participacoes || []) alunos.add(p.usuario);
  const out = {};
  for (const a of alunos) {
    let p = 0, j = 0;
    for (const n of ns) { const e = (s.chamadas[n].estados || {})[a] || 'a'; if (e === 'p') p++; else if (e === 'j') j++; }
    const meta = Math.ceil(salvas / 2);
    const status = !salvas ? 'sem-chamada' : p >= meta ? 'presente' : p + j >= meta ? 'justificado' : 'ausente';
    const mine = (s.participacoes || []).filter((x) => x.usuario === a);
    out[a] = { status, presencas: p, justificadas: j, salvas, pontos: mine.reduce((t, x) => t + (x.pontos || 0), 0), participacoes: mine.length };
  }
  return out;
}
const novoId = () => crypto.randomBytes(5).toString('hex');
module.exports = { TURMA_RE, TIPOS, ROTULOS, lerSessao, atualizarSessao, listarSessoes, resumoSessao, novoId };
