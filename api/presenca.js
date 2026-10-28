'use strict';
// Chamada de aula (até 3 por aula, salvas pelo instrutor), participações e histórico. Cada aluno só vê a própria presença.
const u = require('../lib/util'); const d = require('../lib/dados'); const P = require('../lib/pontos'); const A = require('../lib/atividades');
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
    const q = { ...(req.query || {}) }; if (q.turma) q.turma = String(q.turma).toUpperCase();
    const turmaMon = (turma) => { const m = cfg.monitores[usuario]; return geral || !m || !m.turmas.length || m.turmas.includes(turma); };
    const alunosDe = (turma) => (cfg.turmas[turma] ? cfg.turmas[turma].alunos : cfg.alunos);
    const turmasVisiveis = Object.fromEntries(Object.entries(cfg.turmas).filter(([id, t]) => t.status !== 'arquivada' && turmaMon(id)).map(([id, t]) => [id, { nome: t.nome, status: t.status, nivel: t.nivel, alunos: t.alunos, inicio: t.inicio || '', fim: t.fim || '' }]));
    const validaSessao = (turma, chave) => d.TURMA_RE.test(String(turma || '')) && turmaMon(turma) && aulas.some((a) => a.chave === chave) && podeChamar(chave);

    if (req.method === 'GET') {
      if (q.acao === 'meurepo') { // o aluno vê se já aceitou o convite do repositório; se não, recebe o atalho para aceitar
        const ORG = process.env.GH_ORG || 'LAG-CEUMA'; const k = String(usuario).toLowerCase();
        if (!cfg.alunos.includes(k) || /^ficticio-/.test(k)) return u.json(res, 200, { estado: 'nenhum' });
        try {
          const rp = await u.gh(`/repos/${ORG}/aluno-${k}`); if (rp.status === 404) return u.json(res, 200, { estado: 'sem-repo' });
          if (!rp.ok) return u.json(res, 200, { estado: 'nenhum' });
          const c = await u.gh(`/repos/${ORG}/aluno-${k}/collaborators/${k}`);
          const base = `https://github.com/${ORG}/aluno-${k}`;
          if (c.status === 204) return u.json(res, 200, { estado: 'ok', url: base });
          return u.json(res, 200, { estado: 'convite', url: base + '/invitations', repo: base });
        } catch { return u.json(res, 200, { estado: 'nenhum' }); }
      }
      if (q.acao === 'meuperfil') {
        if (u.papel(cfg, usuario) === 'visitante') return u.json(res, 403, { erro: 'Sem acesso.' });
        const c = (await require('../lib/pendentes').ler()).lista.find((x) => x.usuario === usuario);
        return u.json(res, 200, { usuario, cadastrado: !!c, nome: (c && c.nome) || '', email: (c && c.email) || '', emailPessoal: (c && c.emailPessoal) || '', curso: (c && c.curso) || '', cpf: (c && c.cpf) || '' });
      }
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
        return u.json(res, 200, { usuario, sessoes: lista, aluno: Object.values(cfg.turmas || {}).some((t) => (t.alunos || []).includes(usuario)) });
      }
      if (q.acao === 'copa') return require('../lib/copaapi').ler(req, res, { cfg, usuario, dono: u.papel(cfg, usuario) === 'owner', turmaOk: turmaMon });
      if (q.acao === 'minhapontuacao') {
        const sess = await d.listarSessoes(); const ativs = await A.listar(); const conf = P.configPontos(cfg); const out = [];
        for (const [id, t] of Object.entries(cfg.turmas)) {
          if (!t.alunos.includes(usuario)) continue;
          const rk = P.ranking(cfg, id, sess, ativs); const eu = rk.find((x) => x.usuario === usuario); if (!eu) continue; // owners e monitores da turma ficam fora do ranking
          out.push({ turma: id, nome: t.nome, status: t.status, pesos: P.pesosDa(cfg, id), total: eu.total, aguardando: eu.aguardando || 0, partes: eu.partes, posicao: eu.posicao, de: rk.length,
            top5: conf.top5Visivel ? (t.status === 'arquivada' && t.rankingFinal ? t.rankingFinal.filter((x) => x.total > 0).map((x, i) => ({ posicao: i + 1, usuario: x.usuario, total: x.total })) : rk.filter((x) => x.total > 0).slice(0, 5).map((x) => ({ posicao: x.posicao, usuario: x.usuario, total: x.total }))) : [] });
        }
        return u.json(res, 200, { usuario, turmas: out });
      }
      if (q.acao === 'minhasatividades') {
        const todas = await A.listar(); const out = [];
        for (const a of todas) { const t = cfg.turmas[a.turma]; if (!a.liberada || !t || !t.alunos.includes(usuario) || !A.aplica(a, usuario)) continue;
          const e = (a.entregas || {})[usuario] || {}; const dsp = (a.disparos || {})[usuario] || {};
          out.push({ turma: a.turma, id: a.id, codigo: a.codigo, titulo: a.titulo, peso: a.peso, notaMax: a.notaMax || 10, opcional: !!a.opcional, prazo: a.prazo, estado: e.estado || '', nota: e.nota === undefined ? null : e.nota, aguardando: (e.estado === 'prazo' || e.estado === 'atraso') && typeof e.nota !== 'number', issue: dsp.url || '' }); }
        return u.json(res, 200, { usuario, atividades: out, aluno: Object.values(cfg.turmas || {}).some((t) => (t.alunos || []).includes(usuario)) });
      }
    if (!minhas.length) return u.json(res, 403, { erro: 'Você não tem permissão para fazer chamadas.' });
      if (q.acao === 'cota') { // contador de consultas do GitHub: só owners
        if (u.papel(cfg, usuario) !== 'owner') return u.json(res, 403, { erro: 'Só owners veem a cota.' });
        return u.json(res, 200, await u.cotaGitHub());
      }
      if (q.acao === 'correcao_resumo') {
        if (u.cotaBaixa(800)) return u.json(res, 200, { turmas: [], acorrigir: 0, revisadas: 0, duvidas: 0, falhou: false, economia: true }); // aviso na plataforma: quantas respostas dos alunos esperam correção, por turma
        const out = []; let falhou = false;
        for (const [id, t] of Object.entries(turmasVisiveis)) { if (t.status === 'arquivada') continue;
          try { const p = await A.painel(id, alunosDe(id)); if (p.atividades.length) out.push({ turma: id, nome: t.nome, ...p.resumo, duv: p.duvidas.map((x) => ({ usuario: x.usuario, numero: x.numero, atualizado: x.atualizado })) }); } catch { falhou = true; } }
        return u.json(res, 200, { turmas: out, acorrigir: out.reduce((n, x) => n + x.acorrigir + x.novas + x.revisadas, 0), revisadas: out.reduce((n, x) => n + x.revisadas, 0), duvidas: out.reduce((n, x) => n + x.duvidas, 0), falhou });
      }
      if (q.acao === 'atividades') {
        if (!d.TURMA_RE.test(String(q.turma || '')) || !cfg.turmas[q.turma] || !turmaMon(q.turma)) return u.json(res, 400, { erro: 'Turma inválida.' });
        return u.json(res, 200, { turma: q.turma, roster: alunosDe(q.turma), atividades: await A.listar(q.turma) });
      }
      if (q.acao === 'ranking') {
        if (!d.TURMA_RE.test(String(q.turma || '')) || !cfg.turmas[q.turma] || !turmaMon(q.turma)) return u.json(res, 400, { erro: 'Turma inválida.' });
        return u.json(res, 200, { turma: q.turma, pesos: P.pesosDa(cfg, q.turma), config: P.configPontos(cfg), ranking: P.ranking(cfg, q.turma, await d.listarSessoes(), await A.listar(q.turma)) });
      }
      if (q.acao === 'ranking_plano') {
        if (!d.TURMA_RE.test(String(q.turma || '')) || !cfg.turmas[q.turma] || !turmaMon(q.turma)) return u.json(res, 400, { erro: 'Turma inválida.' });
        const PL = require('../lib/planos'); const pl = PL.doPlano(cfg, q.turma);
        if (!pl) return u.json(res, 200, { plano: null });
        const sess = await d.listarSessoes(); const por = {}; for (const id of PL.idsDe(pl)) por[id] = await A.listar(id);
        const dt = PL.datas(cfg, pl);
        return u.json(res, 200, { plano: { id: pl.id, nome: pl.nome, trilha: pl.trilha, inicio: dt.inicio, fim: dt.fim, turmas: PL.idsDe(pl).map((id) => ({ id, nome: cfg.turmas[id].nome })) }, ranking: PL.rankingPlano(cfg, pl, sess, por), arena: { ligada: PL.arenaLigada(cfg), aviso: 'Arena Global: disponível quando houver trilhas paralelas (previsto para 2027.2).' } });
      }
      if (q.acao === 'contexto') {
        let nomes = {}; // nome completo (dos Contatos) só para quem usa a Presença; o e-mail nunca sai daqui
        try { const lista = (await require('../lib/pendentes').ler()).lista; const quem = new Set([...cfg.alunos, ...Object.values(cfg.turmas || {}).flatMap((t) => t.alunos || [])]); for (const x of lista) if (x.usuario && x.nome && quem.has(String(x.usuario).toLowerCase())) nomes[String(x.usuario).toLowerCase()] = String(x.nome).slice(0, 80); } catch { nomes = {}; }
        return u.json(res, 200, { usuario, geral, dono: u.papel(cfg, usuario) === 'owner', aulas: minhas.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo })), roster: cfg.alunos, nomes, turmas: turmasVisiveis, tipos: d.TIPOS, rotulos: d.ROTULOS, hoje: hoje() });
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
    if (b.turma) b.turma = String(b.turma).toUpperCase();
      if (b.acao === 'meuperfil') {
      if (u.papel(cfg, usuario) === 'visitante') return u.json(res, 403, { erro: 'Sem acesso.' });
      try { const c = await require('../lib/pendentes').salvarPerfil(usuario, b); return u.json(res, 200, { ok: true, email: c.email || '', emailPessoal: c.emailPessoal || '', curso: c.curso || '', cpf: c.cpf || '' }); }
      catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; }
    }
      if (b.acao === 'copa_usar' || b.acao === 'copa_config' || b.acao === 'copa_chuva' || b.acao === 'copa_evento') return require('../lib/copaapi').escrever(res, b, { cfg, usuario, dono: u.papel(cfg, usuario) === 'owner', turmaOk: turmaMon });
    if (!minhas.length) return u.json(res, 403, { erro: 'Você não tem permissão para fazer chamadas.' });
    if (String(b.acao || '').startsWith('ativ_')) {
      if (!d.TURMA_RE.test(String(b.turma || '')) || !cfg.turmas[b.turma] || !turmaMon(b.turma)) return u.json(res, 400, { erro: 'Turma inválida.' });
      const r = await A.tratar(b, { usuario, alunosDe }); return u.json(res, r.status, r.corpo);
    }
    if (!validaSessao(b.turma, b.chave)) return u.json(res, 400, { erro: 'Aula ou turma inválida (ou sem permissão para esta aula).' });
    const alunos = new Set(alunosDe(b.turma));
    if (b.acao === 'recuperacao') {
      // Sessão de recuperação (sábado, online, opcional): um membro de destaque ministra para quem perdeu a aula. Presença aqui vale como presença na aula perdida.
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : hoje();
      const min = String(b.ministrante || '').trim().toLowerCase();
      if (min && !/^[a-z0-9-]{1,39}$/.test(min)) return u.json(res, 400, { erro: 'Usuário do ministrante inválido.' });
      const estados = {}; for (const k of alunos) if ((b.estados || {})[k] === 'p') estados[k] = 'p';
      const todas = await d.listarSessoes(); let pontua = !!min;
      if (min) { const dia = new Date(data + 'T12:00:00Z').getTime(); pontua = !todas.some((x) => x.turma === b.turma && (x.recuperacoes || []).some((r) => r.ministrante === min && r.pontuou && Math.abs(new Date(r.data + 'T12:00:00Z').getTime() - dia) < 7 * 864e5 && !(x.chave === b.chave && r.data === data))); } // no máximo 1 sessão pontuada por semana para o mesmo ministrante
      const rid = 'rec-' + data;
      await d.atualizarSessao(b.turma, b.chave, (s) => { s.turma = b.turma; s.chave = b.chave; s.data = s.data || data; s.chamadas = s.chamadas || {}; s.participacoes = (s.participacoes || []).filter((x) => x.recId !== rid);
        s.recuperacoes = (s.recuperacoes || []).filter((r) => r.data !== data); s.recuperacoes.push({ data, ministrante: min, estados, pontuou: pontua, por: usuario, em: new Date().toISOString() });
        if (pontua) s.participacoes.push({ id: d.novoId(), usuario: min, tipo: 'apresentacao', nota: 'Ministrou a recuperação de ' + data.split('-').reverse().join('/'), pontos: 2, por: usuario, em: new Date().toISOString(), recId: rid });
        return s; }, `Portal: ${usuario} salvou a recuperação de ${b.chave} em ${data} (turma ${b.turma}: ${Object.keys(estados).length} presentes)`);
      return u.json(res, 200, { ok: true, presentes: Object.keys(estados).length, pontuou: pontua });
    }
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
    if (b.acao === 'entregas') {
      const est = {};
      for (const k of alunos) { const v = (b.estados || {})[k] || {}; const e = ['prazo', 'atraso'].includes(v.estado) ? v.estado : 'nao';
        const nota = v.nota === '' || v.nota === undefined || v.nota === null ? null : Math.min(10, Math.max(0, Math.round(Number(v.nota) * 10) / 10));
        est[k] = { estado: e, ...(nota !== null && Number.isFinite(nota) && e !== 'nao' ? { nota } : {}) }; }
      const cont = Object.values(est).filter((x) => x.estado !== 'nao').length;
      await d.atualizarSessao(b.turma, b.chave, (s) => { s.turma = b.turma; s.chave = b.chave; s.entregas = Object.fromEntries(Object.entries(est).map(([k, v]) => [k, { ...v, por: usuario, em: new Date().toISOString() }])); return s; },
        `Portal: ${usuario} salvou as entregas de ${b.chave} (turma ${b.turma}: ${cont} entregues de ${Object.keys(est).length})`);
      return u.json(res, 200, { ok: true, entregues: cont });
    }
    if (b.acao === 'participacao') {
      const alvo = String(b.usuario || '').toLowerCase();
      if (!alunos.has(alvo) || !d.TIPOS[b.tipo]) return u.json(res, 400, { erro: 'Aluno ou tipo inválido.' });
      const pontos = Math.min(10, Math.max(0, Math.round(Number(b.pontos))) || 0);
      if (b.tipo === 'penalidade' && !pontos) return u.json(res, 400, { erro: 'Informe quantos pontos a penalidade tira (1 a 10).' });
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
