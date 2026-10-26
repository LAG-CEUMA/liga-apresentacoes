'use strict';
// Atividades individuais: cada exercício tem peso, prazo, liberação própria (para todos ou para alguns alunos),
// uma Issue por aluno e entregas/notas próprias. Um arquivo JSON por atividade e turma: dados/atividades/<turma>/<id>.json.
const u = require('./util'); const d = require('./dados');
const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const ESTADOS = ['prazo', 'atraso', 'nao', 'dispensado'];
const ORG = () => process.env.GH_ORG || 'LAG-CEUMA';
const REPO = () => process.env.DATA_REPO || u.REPO();
const caminho = (t, id) => `dados/atividades/${t}/${id}.json`;
const url = (c) => `/repos/${REPO()}/contents/${c.split('/').map(encodeURIComponent).join('/')}`;
const ARQ_RE = /^dados\/atividades\/([A-Za-z0-9._-]{1,20})\/([a-z0-9][a-z0-9-]{0,40})\.json$/;
const txt = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

async function ler(turma, id) {
  const r = await u.gh(`${url(caminho(turma, id))}?ref=${u.BRANCH()}`);
  if (r.status === 404) return { dados: null, sha: null };
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler a atividade`);
  const j = await r.json();
  return { dados: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha };
}
async function atualizar(turma, id, mudar, mensagem) {
  for (let t = 0; t < 3; t++) {
    const { dados, sha } = await ler(turma, id);
    const novo = mudar(dados);
    const corpo = { message: mensagem, branch: u.BRANCH(), content: Buffer.from(JSON.stringify(novo, null, 2) + '\n').toString('base64') };
    if (sha) corpo.sha = sha;
    const r = await u.gh(url(caminho(turma, id)), { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { u.limparCache(); return novo; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar a atividade`);
    await new Promise((ok) => setTimeout(ok, 150 * (t + 1)));
  }
  throw new Error('Conflito ao gravar a atividade. Tente de novo.');
}
async function listar(turma) {
  const todas = await u.comCache('atividades', 20000, async () => {
    const r = await u.gh(`/repos/${REPO()}/git/trees/${u.BRANCH()}?recursive=1`);
    if (!r.ok) throw new Error(`GitHub ${r.status} ao listar as atividades`);
    const arqs = ((await r.json()).tree || []).map((i) => ARQ_RE.exec(i.path || '')).filter(Boolean).slice(0, 400);
    const lidas = await Promise.all(arqs.map(async (m) => {
      const rr = await u.gh(`${url(m[0])}?ref=${u.BRANCH()}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (!rr.ok) return null;
      try { return { ...JSON.parse(await rr.text()), turma: m[1], id: m[2] }; } catch { return null; }
    }));
    return lidas.filter(Boolean);
  });
  return (turma ? todas.filter((a) => a.turma === turma) : todas).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.id.localeCompare(b.id));
}
// Quem faz a atividade: todos da turma (alvo vazio) ou só os alunos para quem ela foi liberada.
const aplica = (at, aluno) => !at.alvo || !at.alvo.length || at.alvo.includes(aluno);
async function emLote(itens, fn, n = 6) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => { while (i < itens.length) { const k = i++; out[k] = await fn(itens[k]); } }));
  return out;
}
const fim = (prazo) => (prazo ? new Date(prazo).getTime() : null);

async function tratar(b, ctx) {
  const { usuario, alunosDe } = ctx; const turma = b.turma;
  const bad = (m) => ({ status: 400, corpo: { erro: m } }); const ok = (c) => ({ status: 200, corpo: c });
  const id = String(b.id || '');
  if (b.acao === 'ativ_salvar') {
    const titulo = txt(b.titulo, 100); if (!titulo) return bad('Dê um título à atividade.');
    const peso = Math.min(100, Math.max(1, Math.round(Number(b.peso) * 10) / 10 || 10));
    let prazo = ''; if (b.prazo) { const t = new Date(b.prazo); if (!Number.isFinite(t.getTime())) return bad('Prazo inválido.'); prazo = t.toISOString(); }
    let alvoId = id;
    if (!alvoId) { const base = slug(b.codigo || titulo) || 'atividade'; const ex = new Set((await listar(turma)).map((a) => a.id)); alvoId = base; for (let i = 2; ex.has(alvoId); i++) alvoId = `${base.slice(0, 36)}-${i}`; }
    if (!ID_RE.test(alvoId)) return bad('Identificador inválido.');
    const novo = await atualizar(turma, alvoId, (a) => ({ ...(a || { criadoPor: usuario, criadoEm: new Date().toISOString(), liberada: false, alvo: [], disparos: {}, entregas: {} }),
      titulo, codigo: txt(b.codigo, 30), descricao: txt(b.descricao, 8000), peso, prazo, opcional: !!b.opcional, ordem: Number.isFinite(Number(b.ordem)) ? Number(b.ordem) : ((a || {}).ordem || 0), aula: txt(b.aula, 80) }),
    `Portal: ${usuario} salvou a atividade ${alvoId} (turma ${turma})`);
    return ok({ ok: true, id: alvoId, atividade: novo });
  }
  if (!ID_RE.test(id)) return bad('Atividade inválida.');
  const { dados: at } = await ler(turma, id);
  if (!at) return bad('Atividade não encontrada.');
  if (b.acao === 'ativ_remover') {
    if (at.liberada || Object.keys(at.disparos || {}).length) return bad('Esta atividade já foi liberada. Recolha-a em vez de remover.');
    const { sha } = await ler(turma, id);
    const r = await u.gh(url(caminho(turma, id)), { method: 'DELETE', body: JSON.stringify({ message: `Portal: ${usuario} removeu a atividade ${id} (turma ${turma})`, sha, branch: u.BRANCH() }), headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`GitHub ${r.status} ao remover a atividade`);
    u.limparCache(); return ok({ ok: true });
  }
  if (b.acao === 'ativ_recolher') {
    await atualizar(turma, id, (a) => ({ ...a, liberada: false }), `Portal: ${usuario} recolheu a atividade ${id} (turma ${turma})`);
    return ok({ ok: true });
  }
  const roster = alunosDe(turma);
  if (b.acao === 'ativ_liberar') {
    const pedidos = Array.isArray(b.alunos) && b.alunos.length ? b.alunos.map((x) => String(x).toLowerCase()).filter((x) => roster.includes(x)) : null;
    const alvos = pedidos || roster;
    if (!alvos.length) return bad('Não há alunos para receber.');
    const sem = alvos.filter((k) => !((at.disparos || {})[k] || {}).numero);
    const resultados = await emLote(sem, async (k) => {
      const corpo = `${at.opcional ? '**ATIVIDADE OPCIONAL: vale pontos extras. Só faça se quiser.**\n\n' : ''}${at.descricao || ''}\n\n---\nPeso: ${at.peso}${at.prazo ? ` · Prazo: ${new Date(at.prazo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : ''}\nResponda **neste Issue**, em um comentário. Uma atividade, uma resposta.\n`;
      try {
        const r = await u.gh(`/repos/${ORG()}/aluno-${k}/issues`, { method: 'POST', body: JSON.stringify({ title: `${at.codigo ? at.codigo + ' · ' : ''}${at.titulo}${at.opcional ? ' (opcional)' : ''}`, body: corpo }), headers: { 'Content-Type': 'application/json' } });
        if (!r.ok) return [k, { erro: r.status === 404 ? 'repositório não encontrado ou sem acesso' : `GitHub ${r.status}`, em: new Date().toISOString() }];
        const j = await r.json(); return [k, { numero: j.number, url: j.html_url, em: new Date().toISOString() }];
      } catch (e) { return [k, { erro: 'falha de rede', em: new Date().toISOString() }]; }
    });
    const todos = !pedidos;
    const novo = await atualizar(turma, id, (a) => { const disp = { ...(a.disparos || {}) }; for (const [k, v] of resultados) disp[k] = v;
      const jaTodos = a.liberada && !(a.alvo || []).length; // já foi para todos: continua para todos
      const alvo = todos || jaTodos ? [] : [...new Set([...(a.alvo || []), ...alvos])];
      return { ...a, liberada: true, liberadaEm: a.liberadaEm || new Date().toISOString(), alvo, disparos: disp }; },
    `Portal: ${usuario} liberou a atividade ${id} (turma ${turma}: ${alvos.length} aluno(s))`);
    const falhas = resultados.filter(([, v]) => v.erro).map(([k, v]) => ({ usuario: k, erro: v.erro }));
    return ok({ ok: true, criadas: resultados.length - falhas.length, jaTinham: alvos.length - sem.length, falhas, atividade: novo });
  }
  if (b.acao === 'ativ_conferir') {
    const alvos = roster.filter((k) => aplica(at, k));
    const lim = fim(at.prazo);
    const res = await emLote(alvos, async (k) => {
      const dsp = (at.disparos || {})[k]; if (!dsp || !dsp.numero) return [k, { issue: false }];
      try {
        const r = await u.gh(`/repos/${ORG()}/aluno-${k}/issues/${dsp.numero}/comments?per_page=50`);
        if (!r.ok) return [k, { issue: true, erro: `GitHub ${r.status}` }];
        const cs = (await r.json()).filter((c) => c.user && String(c.user.login).toLowerCase() === k);
        if (!cs.length) return [k, { issue: true, respondeu: false, url: dsp.url }];
        const primeira = cs[0]; const t = new Date(primeira.created_at).getTime();
        return [k, { issue: true, respondeu: true, quando: primeira.created_at, sugestao: lim && t > lim ? 'atraso' : 'prazo', comentarios: cs.length, previa: String(primeira.body || '').replace(/\s+/g, ' ').slice(0, 220), url: primeira.html_url || dsp.url }];
      } catch { return [k, { issue: true, erro: 'falha de rede' }]; }
    });
    return ok({ ok: true, conferencia: Object.fromEntries(res) });
  }
  if (b.acao === 'ativ_entregas') {
    const est = {};
    for (const k of roster) { const v = (b.estados || {})[k]; if (!v) continue; const e = ESTADOS.includes(v.estado) ? v.estado : 'nao';
      const nota = v.nota === '' || v.nota === undefined || v.nota === null ? null : Math.min(10, Math.max(0, Math.round(Number(v.nota) * 10) / 10));
      est[k] = { estado: e, ...(nota !== null && Number.isFinite(nota) && (e === 'prazo' || e === 'atraso') ? { nota } : {}), por: usuario, em: new Date().toISOString() }; }
    const cont = Object.values(est).filter((x) => x.estado === 'prazo' || x.estado === 'atraso').length;
    await atualizar(turma, id, (a) => ({ ...a, entregas: est }), `Portal: ${usuario} salvou as entregas de ${id} (turma ${turma}: ${cont} entregues)`);
    return ok({ ok: true, entregues: cont });
  }
  return bad('Ação inválida.');
}
module.exports = { listar, tratar, aplica, ESTADOS };
