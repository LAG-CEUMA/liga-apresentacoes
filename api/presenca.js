'use strict';
// Chamada de aula (até 3 por aula, salvas pelo instrutor), participações e histórico. Cada aluno só vê a própria presença.
const u = require('../lib/util'); const d = require('../lib/dados');
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const txt = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    if (!usuario) return u.json(res, 401, { erro: 'Entre com o GitHub.' });
    const { cfg } = await u.lerConfig();
    const geral = u.temPerm(cfg, usuario, 'presenca');
    const aulas = await u.listarAulas();
    const titulos = Object.fromEntries(aulas.map((a) => [a.chave, a.titulo]));
    const podeChamar = (chave) => geral || (u.papel(cfg, usuario) === 'monitor' && cfg.monitores[usuario].aulas.includes(chave));
    const minhas = aulas.filter((a) => podeChamar(a.chave));
    const q = req.query || {};
    const turmaMon = (turma) => { const m = cfg.monitores[usuario]; return geral || !m || !m.turmas.length || m.turmas.includes(turma); };
    const alunosDe = (turma) => (cfg.turmas[turma] ? cfg.turmas[turma].alunos : cfg.alunos);
    const turmasVisiveis = Object.fromEntries(Object.entries(cfg.turmas).filter(([id, t]) => t.status !== 'arquivada' && turmaMon(id)).map(([id, t]) => [id, { nome: t.nome, status: t.status, alunos: t.alunos }]));
    const validaSessao = (turma, chave) => d.TURMA_RE.test(String(turma || '')) && turmaMon(turma) && aulas.some((a) => a.chave === chave) && podeChamar(chave);

    if (req.method === 'GET') {
      if (q.acao === 'minha') {
        const todas = await d.listarSessoes();
        const lista = [];
        for (const s of todas) {
          const r = d.resumoSessao(s)[usuario];
          if (!r) continue;
          lista.push({ turma: s.turma, chave: s.chave, titulo: titulos[s.chave] || s.chave, data: s.data || '', ...r,
            participacoes: (s.participacoes || []).filter((x) => x.usuario === usuario).map((x) => ({ tipo: d.TIPOS[x.tipo] || x.tipo, nota: x.nota, pontos: x.pontos })) });
        }
        lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        return u.json(res, 200, { usuario, sessoes: lista });
      }
      if (!minhas.length) return u.json(res, 403, { erro: 'Você não tem permissão para fazer chamadas.' });
      if (q.acao === 'contexto') {
        return u.json(res, 200, { usuario, geral, aulas: minhas.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo })), roster: cfg.alunos, turmas: turmasVisiveis, tipos: d.TIPOS, rotulos: d.ROTULOS, hoje: hoje() });
      }
      if (q.acao === 'sessao') {
        if (!validaSessao(q.turma, q.chave)) return u.json(res, 400, { erro: 'Aula ou turma inválida.' });
        const { dados } = await d.lerSessao(q.turma, q.chave);
        return u.json(res, 200, { sessao: dados, roster: alunosDe(q.turma) });
      }
      if (q.acao === 'historico') {
        const permitidas = new Set(minhas.map((a) => a.chave));
        const sessoes = (await d.listarSessoes()).filter((s) => permitidas.has(s.chave));
        return u.json(res, 200, { roster: cfg.alunos, sessoes: sessoes.map((s) => ({ turma: s.turma, chave: s.chave, titulo: titulos[s.chave] || s.chave, data: s.data || '',
          chamadas: Object.keys(s.chamadas || {}).length, resumo: d.resumoSessao(s) })) });
      }
      return u.json(res, 400, { erro: 'Ação inválida.' });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    if (!minhas.length) return u.json(res, 403, { erro: 'Você não tem permissão para fazer chamadas.' });
    if (!validaSessao(b.turma, b.chave)) return u.json(res, 400, { erro: 'Aula ou turma inválida (ou sem permissão para esta aula).' });
    const alunos = new Set(alunosDe(b.turma));
    if (b.acao === 'chamada') {
      const n = Number(b.n);
      if (![1, 2, 3].includes(n)) return u.json(res, 400, { erro: 'A chamada deve ser 1, 2 ou 3.' });
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : hoje();
      const estados = {}; let p = 0, a = 0, j = 0;
      for (const k of alunos) { const v = (b.estados || {})[k]; const e = v === 'p' || v === 'j' ? v : 'a'; estados[k] = e; if (e === 'p') p++; else if (e === 'j') j++; else a++; }
      await d.atualizarSessao(b.turma, b.chave, (s) => { s.turma = b.turma; s.chave = b.chave; s.data = data; s.chamadas = s.chamadas || {};
        s.chamadas[n] = { rotulo: d.ROTULOS[n - 1], por: usuario, em: new Date().toISOString(), estados }; return s; },
      `Portal: ${usuario} salvou a chamada ${n} de ${b.chave} (turma ${b.turma}: ${p} presentes, ${a} ausentes, ${j} justificados)`);
      return u.json(res, 200, { ok: true, presentes: p, ausentes: a, justificados: j });
    }
    if (b.acao === 'participacao') {
      const alvo = String(b.usuario || '').toLowerCase();
      if (!alunos.has(alvo) || !d.TIPOS[b.tipo]) return u.json(res, 400, { erro: 'Aluno ou tipo inválido.' });
      const pontos = Math.min(10, Math.max(0, Math.round(Number(b.pontos))) || 0);
      const item = { id: d.novoId(), usuario: alvo, tipo: b.tipo, nota: txt(b.nota, 140), pontos, por: usuario, em: new Date().toISOString() };
      await d.atualizarSessao(b.turma, b.chave, (s) => { s.participacoes = (s.participacoes || []).concat(item); return s; },
        `Portal: ${usuario} registrou participação (${b.tipo}) em ${b.chave} (turma ${b.turma})`);
      return u.json(res, 200, { ok: true, id: item.id });
    }
    if (b.acao === 'remover_participacao') {
      await d.atualizarSessao(b.turma, b.chave, (s) => { s.participacoes = (s.participacoes || []).filter((x) => x.id !== b.id); return s; },
        `Portal: ${usuario} removeu uma participação de ${b.chave} (turma ${b.turma})`);
      return u.json(res, 200, { ok: true });
    }
    u.json(res, 400, { erro: 'Ação inválida.' });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui carregar ou salvar agora. Tente de novo.' }); }
};
