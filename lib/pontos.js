'use strict';
// Pontuação por turma: presença + participação + exercícios − penalidades. Pesos configuráveis (globais e por turma).
const d = require('./dados');
const PESOS_PADRAO = { presenca: 40, participacao: 30, exercicios: 30 };
const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : pad; };
function configPontos(cfg) {
  const c = cfg.pontuacao || {};
  const pesos = {}; for (const k of Object.keys(PESOS_PADRAO)) pesos[k] = num((c.pesos || {})[k], 0, 100, PESOS_PADRAO[k]);
  const tipos = {}; for (const k of Object.keys(d.TIPOS)) tipos[k] = num((c.tipos || {})[k], 0, 5, 1);
  return { pesos, tipos, meta: num(c.meta, 1, 500, 30), top5Visivel: c.top5Visivel !== false };
}
function pesosDa(cfg, turma) {
  const base = configPontos(cfg).pesos, o = ((cfg.turmas || {})[turma] || {}).pesos || {};
  const out = {}; for (const k of Object.keys(base)) out[k] = o[k] === undefined ? base[k] : num(o[k], 0, 100, base[k]);
  return out;
}
const VAL_ENTREGA = { prazo: 1, atraso: 0.5, nao: 0 };
// sessoes: lista de sessões (qualquer turma); devolve ranking completo da turma, do primeiro ao último.
function ranking(cfg, turma, sessoes) {
  const t = (cfg.turmas || {})[turma]; if (!t) return [];
  const conf = configPontos(cfg), pesos = pesosDa(cfg, turma);
  const ss = sessoes.filter((s) => s.turma === turma);
  const comChamada = ss.filter((s) => Object.keys(s.chamadas || {}).length);
  const comEntrega = ss.filter((s) => s.entregas && typeof s.entregas === 'object');
  const resumos = comChamada.map((s) => d.resumoSessao(s));
  const linhas = t.alunos.map((a) => {
    let pres = 0; for (const r of resumos) { const x = r[a]; pres += !x ? 0 : x.status === 'presente' ? 1 : x.status === 'justificado' ? 0.5 : 0; }
    const fPres = resumos.length ? pres / resumos.length : 0;
    let pos = 0, pen = 0;
    for (const s of ss) for (const p of s.participacoes || []) if (p.usuario === a) { if (p.tipo === 'penalidade') pen += (p.pontos || 0) * conf.tipos.penalidade; else pos += (p.pontos || 0) * (conf.tipos[p.tipo] === undefined ? 1 : conf.tipos[p.tipo]); }
    let ex = 0; for (const s of comEntrega) { const e = s.entregas[a]; if (!e) continue; const base = VAL_ENTREGA[e.estado] || 0; ex += typeof e.nota === 'number' ? base * (e.nota / 10) : base; }
    const fEx = comEntrega.length ? ex / comEntrega.length : 0;
    const partes = { presenca: Math.round(fPres * pesos.presenca * 10) / 10, participacao: Math.round(Math.min(1, pos / conf.meta) * pesos.participacao * 10) / 10, exercicios: Math.round(fEx * pesos.exercicios * 10) / 10, penalidades: Math.round(pen * 10) / 10 };
    const total = Math.max(0, Math.round((partes.presenca + partes.participacao + partes.exercicios - partes.penalidades) * 10) / 10);
    return { usuario: a, total, partes, fPres, fEx, aulas: resumos.length, entregas: comEntrega.length };
  });
  linhas.sort((x, y) => y.total - x.total || y.fPres - x.fPres || y.fEx - x.fEx || x.usuario.localeCompare(y.usuario));
  let pos = 0, ant = null;
  linhas.forEach((l, i) => { if (!ant || l.total !== ant.total || l.fPres !== ant.fPres || l.fEx !== ant.fEx) pos = i + 1; l.posicao = pos; ant = l; });
  return linhas;
}
module.exports = { PESOS_PADRAO, configPontos, pesosDa, ranking };
