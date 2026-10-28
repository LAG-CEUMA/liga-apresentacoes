'use strict';
// Rotas da Copa da Liga (leitura, uso de itens e configuração). As regras ficam em lib/copa.js.
const u = require('./util'); const d = require('./dados'); const P = require('./pontos'); const A = require('./atividades'); const C = require('./copa');
const caminho = (chave) => `dados/copa/${chave}.json`;
const PL = require('./planos');
// Uma Copa por plano (trilha). Turma fora de plano continua com a Copa própria. O arquivo antigo da turma vale até o do plano existir.
function contexto(cfg, turma) {
  const t = cfg.turmas[turma]; const pl = PL.doPlano(cfg, turma);
  if (!pl) return { chave: turma, ids: [turma], t, legado: null, plano: null };
  const dt = PL.datas(cfg, pl);
  return { chave: 'plano-' + pl.id, ids: PL.idsDe(pl), t: { ...t, inicio: dt.inicio || t.inicio, fim: dt.fim || t.fim, alunos: PL.alunosDo(cfg, pl) }, legado: turma, plano: pl };
}
async function lerEstado(cx) {
  let { dados } = await d.lerJson(caminho(cx.chave)); cx.existe = !!dados;
  if (!dados && cx.legado) ({ dados } = await d.lerJson(caminho(cx.legado)));
  return dados;
}
// Ranking e dados no formato esperado por copa.js (sessões e atividades das turmas do plano marcadas com a chave da Copa).
async function dadosCopa(cfg, cx) {
  const sess = (await d.listarSessoes()).filter((x) => cx.ids.includes(x.turma)); const por = {}; let ativs = [];
  for (const id of cx.ids) { por[id] = await A.listar(id); ativs = ativs.concat(por[id].map((a) => ({ ...a, turma: cx.chave }))); }
  const rank = cx.plano ? PL.rankingPlano(cfg, cx.plano, sess, por) : P.ranking(cfg, cx.chave, sess, por[cx.chave] || []);
  return { sess: sess.map((s) => ({ ...s, turma: cx.chave })), ativs, rank };
}
const nomeCurto = (n) => { const p = String(n || '').trim().split(/\s+/); if (!p[0]) return ''; const ult = p.length > 1 ? p[p.length - 1] : ''; return ult && ult.length > 2 && !/^(de|da|do|dos|das|e)$/i.test(ult) ? p[0] + ' ' + ult[0] + '.' : p[0]; };
async function nomesDa(alunos) {
  const out = {}; try { const lista = (await require('./pendentes').ler()).lista; const q = new Set(alunos); for (const x of lista) { const k = String(x.usuario || '').toLowerCase(); if (q.has(k) && x.nome) out[k] = String(x.nome).slice(0, 80); } } catch { /* sem nomes */ }
  return out;
}
// Carrega o estado, entrega os itens devidos (grava só se algo mudou) e devolve tudo o que as telas precisam.
async function carregar(cfg, turma, agora) {
  const cx = contexto(cfg, turma); const t = cx.t; const { sess, ativs, rank } = await dadosCopa(cfg, cx);
  let est = C.normalizar(await lerEstado(cx)); const us = rank.map((x) => x.usuario);
  if (est.ativa) {
    const copia = JSON.parse(JSON.stringify(est));
    if (C.sincronizar(copia, cx.chave, t.inicio, agora, us, sess, ativs, d.resumoSessao, t.fim) || !cx.existe) {
      est = await d.mudarJson(caminho(cx.chave), (cur) => { const e = C.normalizar(cur || legadoAtual); C.sincronizar(e, cx.chave, t.inicio, agora, us, sess, ativs, d.resumoSessao, t.fim); C.limpar(e, agora); return e; }, `Copa ${cx.chave}: itens da semana`);
      est = C.normalizar(est);
    }
  }
  return { est, rank, t, cx, ativs };
}
let legadoAtual = null; // estado antigo da turma, usado só na primeira gravação da Copa do plano
async function prepararLegado(cx) { legadoAtual = null; if (cx.legado && !(await d.lerJson(caminho(cx.chave))).dados) legadoAtual = (await d.lerJson(caminho(cx.legado))).dados; }
async function ler(req, res, { cfg, usuario, dono, turmaOk }) {
  const q = req.query || {}; const turma = String(q.turma || '').toUpperCase(); const t0 = cfg.turmas[turma];
  if (!d.TURMA_RE.test(turma) || !t0 || t0.status === 'arquivada') return u.json(res, 400, { erro: 'Turma inválida.' });
  const cx0 = contexto(cfg, turma); const aluno = (cx0.t.alunos || []).includes(usuario);
  if (!dono && !aluno) return u.json(res, 403, { erro: 'Sem acesso a esta turma.' });
  if (dono && !turmaOk(turma)) return u.json(res, 403, { erro: 'Sem acesso a esta turma.' });
  await prepararLegado(cx0);
  const agora = Date.now(); const { est, rank, t, cx, ativs } = await carregar(cfg, turma, agora);
  const base = { turma, plano: cx.plano ? { id: cx.plano.id, nome: cx.plano.nome, trilha: cx.plano.trilha } : null, itens: C.ITENS, dado: C.TAB, cap: C.CAP, diasEfeito: C.DIAS_EFEITO, inicio: t.inicio || '', fim: t.fim || '', semana: C.semanaDe(t.inicio, agora), tregua: C.emTregua(t.fim, agora), visibilidade: est.visibilidade, ativa: est.ativa };
  const placar = C.placar(est, rank, agora, t.fim);
  const evK = C.eventoDe(est, base.semana); base.evento = evK ? { tipo: evK, ...C.EVENTOS[evK] } : null; base.eventos = C.EVENTOS;
  base.missao = C.missaoInfo(est, cx.chave, t.inicio, agora, rank.map((x) => x.usuario), ativs); base.trofeus = C.trofeus(est, agora);
  if (dono) { const nomes0 = await nomesDa(rank.map((x) => x.usuario)); const nm0 = (k) => nomeCurto(nomes0[k]) || '@' + k; base.trofeus = base.trofeus.map((x) => ({ ...x, quem: x.quem.map(nm0) })); base.narracao = C.narracao(est, agora, nm0, base.semana); }
  if (dono) return u.json(res, 200, { ...base, dono: true, placar, inventario: est.inventario, escudos: est.escudos, efeitos: C.efeitosAtivos(est, agora, t.fim), log: est.log.slice(-60).reverse() });
  if (!est.ativa || est.visibilidade === 'oculta') return u.json(res, 200, { ...base, oculta: true });
  const eu = placar.find((x) => x.usuario === usuario); if (!eu) return u.json(res, 200, { ...base, foraDoRanking: true });
  const nomes = await nomesDa(rank.map((x) => x.usuario)); const nm = (k) => nomeCurto(nomes[k]) || '@' + k;
  base.trofeus = base.trofeus.map((x) => ({ ...x, quem: x.quem.map(nm) })); const nev = evK === 'nevoeiro';
  const acima = nev ? null : placar[eu.posCopa - 2]; const uso = est.usos[usuario] || {};
  const meu = { posCopa: nev ? null : eu.posCopa, de: placar.length, copa: eu.copa, oficial: eu.oficial, efeito: eu.efeito, escudo: eu.escudo, gapAcima: acima ? Math.round((acima.copa - eu.copa) * 10) / 10 : 0,
    inventario: est.inventario[usuario] || [], jaUsouNaSemana: uso.semana === base.semana && base.semana > 0, ultimoAlvo: uso.ultimoAlvo || '',
    recebidos: C.efeitosAtivos(est, agora, t.fim).filter((e) => e.para === usuario && e.de !== usuario).map((e) => ({ tipo: e.tipo, delta: e.delta, ate: e.ate })), // quem lançou nunca aparece
    alvos: rank.filter((x) => x.usuario !== usuario).map((x) => ({ usuario: x.usuario, nome: nm(x.usuario), posicao: x.posicao })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) };
  const linhas = est.visibilidade === 'completa' && !nev ? placar.map((x) => ({ usuario: x.usuario, nome: nm(x.usuario), copa: x.copa, posCopa: x.posCopa, escudo: x.escudo })) : null;
  return u.json(res, 200, { ...base, meu, placar: linhas });
}
async function escrever(res, b, { cfg, usuario, dono, turmaOk }) {
  const turma = String(b.turma || '').toUpperCase(); const t0 = cfg.turmas[turma];
  if (!d.TURMA_RE.test(turma) || !t0 || t0.status === 'arquivada') return u.json(res, 400, { erro: 'Turma inválida.' });
  const cx = contexto(cfg, turma); const t = cx.t; await prepararLegado(cx);
  const antes = (cur) => { const e = C.normalizar(cur || legadoAtual); return e; };
  if (b.acao === 'copa_config') {
    if (!dono || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor muda a Copa.' });
    if (!C.VISIBILIDADES.includes(b.visibilidade)) return u.json(res, 400, { erro: 'Visibilidade inválida.' });
    await d.mudarJson(caminho(cx.chave), (cur) => { const e = antes(cur); e.ativa = !!b.ativa; e.visibilidade = b.visibilidade; return e; }, `Copa ${cx.chave}: configuração`);
    return u.json(res, 200, { ok: true });
  }
  if (b.acao === 'copa_evento') {
    if (!dono || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor define o evento da semana.' });
    const { rank } = await dadosCopa(cfg, cx); let out = null;
    await d.mudarJson(caminho(cx.chave), (cur) => { const e = antes(cur); if (!e.ativa) { out = { erro: 'Ative a Copa antes.' }; return e; } out = C.definirEvento(e, rank, t.inicio, Date.now(), String(b.tipo || ''), t.fim); return e; }, `Copa ${cx.chave}: evento da semana`);
    if (out.erro) return u.json(res, 400, { erro: out.erro });
    return u.json(res, 200, { ok: true, resultado: out.resultado });
  }
  if (b.acao === 'copa_chuva') {
    if (!dono || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor faz chover itens.' });
    const { rank } = await dadosCopa(cfg, cx); let out = null;
    await d.mudarJson(caminho(cx.chave), (cur) => { const e = antes(cur); if (!e.ativa) { out = { erro: 'Ative a Copa antes.' }; return e; } out = C.chuvaProfessor(e, rank, t.inicio, Date.now(), t.fim); return e; }, `Copa ${cx.chave}: chuva de itens`);
    if (out.erro) return u.json(res, 400, { erro: out.erro });
    return u.json(res, 200, { ok: true, resultado: out.resultado });
  }
  if (!(t.alunos || []).includes(usuario)) return u.json(res, 403, { erro: 'Só alunos da turma usam itens.' });
  const agora = Date.now(); const { sess, ativs, rank } = await dadosCopa(cfg, cx);
  let out = null;
  await d.mudarJson(caminho(cx.chave), (cur) => {
    const e = antes(cur); if (!e.ativa || e.visibilidade === 'oculta') { out = { erro: 'A Copa não está aberta para os alunos.' }; return e; }
    C.sincronizar(e, cx.chave, t.inicio, agora, rank.map((x) => x.usuario), sess, ativs, d.resumoSessao, t.fim);
    const r = C.usar(e, usuario, String(b.item || ''), String(b.alvo || '').toLowerCase(), rank, t.inicio, agora, t.fim); out = r; C.limpar(e, agora); return e;
  }, `Copa ${cx.chave}: uso de item`);
  if (out.erro) return u.json(res, 400, { erro: out.erro });
  return u.json(res, 200, { ok: true, resultado: out.resultado, bloqueado: !!out.bloqueado });
}
module.exports = { ler, escrever };
