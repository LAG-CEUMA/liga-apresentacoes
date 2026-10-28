'use strict';
// Rotas da Copa da Liga (leitura, uso de itens e configuração). As regras ficam em lib/copa.js.
const u = require('./util'); const d = require('./dados'); const P = require('./pontos'); const A = require('./atividades'); const C = require('./copa');
const caminho = (turma) => `dados/copa/${turma}.json`;
const nomeCurto = (n) => { const p = String(n || '').trim().split(/\s+/); if (!p[0]) return ''; const ult = p.length > 1 ? p[p.length - 1] : ''; return ult && ult.length > 2 && !/^(de|da|do|dos|das|e)$/i.test(ult) ? p[0] + ' ' + ult[0] + '.' : p[0]; };
async function nomesDa(alunos) {
  const out = {}; try { const lista = (await require('./pendentes').ler()).lista; const q = new Set(alunos); for (const x of lista) { const k = String(x.usuario || '').toLowerCase(); if (q.has(k) && x.nome) out[k] = String(x.nome).slice(0, 80); } } catch { /* sem nomes */ }
  return out;
}
// Carrega o estado, entrega os itens devidos (grava só se algo mudou) e devolve tudo o que as telas precisam.
async function carregar(cfg, turma, agora) {
  const t = cfg.turmas[turma]; const sess = await d.listarSessoes(); const ativs = await A.listar(turma);
  const rank = P.ranking(cfg, turma, sess, ativs);
  let { dados } = await d.lerJson(caminho(turma)); let est = C.normalizar(dados);
  if (est.ativa) {
    const copia = JSON.parse(JSON.stringify(est));
    if (C.sincronizar(copia, turma, t.inicio, agora, rank.map((x) => x.usuario), sess, ativs, d.resumoSessao, t.fim)) {
      est = await d.mudarJson(caminho(turma), (cur) => { const e = C.normalizar(cur); C.sincronizar(e, turma, t.inicio, agora, rank.map((x) => x.usuario), sess, ativs, d.resumoSessao, t.fim); C.limpar(e, agora); return e; }, `Copa ${turma}: itens da semana`);
      est = C.normalizar(est);
    }
  }
  return { est, rank, t };
}
async function ler(req, res, { cfg, usuario, dono, turmaOk }) {
  const q = req.query || {}; const turma = String(q.turma || '').toUpperCase(); const t = cfg.turmas[turma];
  if (!d.TURMA_RE.test(turma) || !t || t.status === 'arquivada') return u.json(res, 400, { erro: 'Turma inválida.' });
  const aluno = (t.alunos || []).includes(usuario);
  if (!dono && !aluno) return u.json(res, 403, { erro: 'Sem acesso a esta turma.' });
  if (dono && !turmaOk(turma)) return u.json(res, 403, { erro: 'Sem acesso a esta turma.' });
  const agora = Date.now(); const { est, rank } = await carregar(cfg, turma, agora);
  const base = { turma, itens: C.ITENS, cap: C.CAP, diasEfeito: C.DIAS_EFEITO, inicio: t.inicio || '', fim: t.fim || '', semana: C.semanaDe(t.inicio, agora), tregua: C.emTregua(t.fim, agora), visibilidade: est.visibilidade, ativa: est.ativa };
  const placar = C.placar(est, rank, agora, t.fim);
  if (dono) return u.json(res, 200, { ...base, dono: true, placar, inventario: est.inventario, escudos: est.escudos, efeitos: C.efeitosAtivos(est, agora, t.fim), log: est.log.slice(-60).reverse() });
  if (!est.ativa || est.visibilidade === 'oculta') return u.json(res, 200, { ...base, oculta: true });
  const eu = placar.find((x) => x.usuario === usuario); if (!eu) return u.json(res, 200, { ...base, foraDoRanking: true });
  const nomes = await nomesDa(rank.map((x) => x.usuario)); const nm = (k) => nomeCurto(nomes[k]) || '@' + k;
  const acima = placar[eu.posCopa - 2]; const uso = est.usos[usuario] || {};
  const meu = { posCopa: eu.posCopa, de: placar.length, copa: eu.copa, oficial: eu.oficial, efeito: eu.efeito, escudo: eu.escudo, gapAcima: acima ? Math.round((acima.copa - eu.copa) * 10) / 10 : 0,
    inventario: est.inventario[usuario] || [], jaUsouNaSemana: uso.semana === base.semana && base.semana > 0, ultimoAlvo: uso.ultimoAlvo || '',
    recebidos: C.efeitosAtivos(est, agora, t.fim).filter((e) => e.para === usuario && e.de !== usuario).map((e) => ({ tipo: e.tipo, delta: e.delta, ate: e.ate })), // quem lançou nunca aparece
    alvos: rank.filter((x) => x.usuario !== usuario).map((x) => ({ usuario: x.usuario, nome: nm(x.usuario), posicao: x.posicao })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) };
  const linhas = est.visibilidade === 'completa' ? placar.map((x) => ({ usuario: x.usuario, nome: nm(x.usuario), copa: x.copa, posCopa: x.posCopa, escudo: x.escudo })) : null;
  return u.json(res, 200, { ...base, meu, placar: linhas });
}
async function escrever(res, b, { cfg, usuario, dono, turmaOk }) {
  const turma = String(b.turma || '').toUpperCase(); const t = cfg.turmas[turma];
  if (!d.TURMA_RE.test(turma) || !t || t.status === 'arquivada') return u.json(res, 400, { erro: 'Turma inválida.' });
  if (b.acao === 'copa_config') {
    if (!dono || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor muda a Copa.' });
    if (!C.VISIBILIDADES.includes(b.visibilidade)) return u.json(res, 400, { erro: 'Visibilidade inválida.' });
    await d.mudarJson(caminho(turma), (cur) => { const e = C.normalizar(cur); e.ativa = !!b.ativa; e.visibilidade = b.visibilidade; return e; }, `Copa ${turma}: configuração`);
    return u.json(res, 200, { ok: true });
  }
  if (b.acao === 'copa_chuva') {
    if (!dono || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor faz chover itens.' });
    const rank = P.ranking(cfg, turma, await d.listarSessoes(), await A.listar(turma)); let out = null;
    await d.mudarJson(caminho(turma), (cur) => { const e = C.normalizar(cur); if (!e.ativa) { out = { erro: 'Ative a Copa antes.' }; return e; } out = C.chuvaProfessor(e, rank, t.inicio, Date.now(), t.fim); return e; }, `Copa ${turma}: chuva de itens`);
    if (out.erro) return u.json(res, 400, { erro: out.erro });
    return u.json(res, 200, { ok: true, resultado: out.resultado });
  }
  if (!(t.alunos || []).includes(usuario)) return u.json(res, 403, { erro: 'Só alunos da turma usam itens.' });
  const agora = Date.now(); const sess = await d.listarSessoes(); const ativs = await A.listar(turma); const rank = P.ranking(cfg, turma, sess, ativs);
  let out = null;
  await d.mudarJson(caminho(turma), (cur) => {
    const e = C.normalizar(cur); if (!e.ativa || e.visibilidade === 'oculta') { out = { erro: 'A Copa não está aberta para os alunos.' }; return e; }
    C.sincronizar(e, turma, t.inicio, agora, rank.map((x) => x.usuario), sess, ativs, d.resumoSessao, t.fim);
    const r = C.usar(e, usuario, String(b.item || ''), String(b.alvo || '').toLowerCase(), rank, t.inicio, agora, t.fim); out = r; C.limpar(e, agora); return e;
  }, `Copa ${turma}: uso de item`);
  if (out.erro) return u.json(res, 400, { erro: out.erro });
  return u.json(res, 200, { ok: true, resultado: out.resultado, bloqueado: !!out.bloqueado });
}
module.exports = { ler, escrever };
