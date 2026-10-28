'use strict';
// Plano = calendário (ex.: 2026.2 → 2027.1) que agrupa turmas/níveis de uma trilha.
// Ranking do plano = soma simples dos pontos de cada turma do plano. A Copa é uma por plano (trilha).
// A Arena Global (comparar trilhas pela % do possível) está pronta, mas só liga com cfg.arenaAtiva === true (previsto para 2027.2).
const P = require('./pontos');
const idsDe = (plano) => (plano && Array.isArray(plano.turmas) ? plano.turmas : []);
// Plano a que a turma pertence (ou null: turma avulsa, mantém o comportamento antigo por turma).
function doPlano(cfg, turma) {
  for (const [id, p] of Object.entries(cfg.planos || {})) if (idsDe(p).includes(turma)) return { id, ...p };
  return null;
}
function alunosDo(cfg, plano) {
  const s = new Set(); for (const t of idsDe(plano)) for (const a of ((cfg.turmas || {})[t] || {}).alunos || []) s.add(a);
  return [...s];
}
// Datas efetivas: as do plano; se faltar, menor início / maior fim das turmas.
function datas(cfg, plano) {
  const ts = idsDe(plano).map((t) => (cfg.turmas || {})[t]).filter(Boolean);
  const ini = plano.inicio || ts.map((t) => t.inicio).filter(Boolean).sort()[0] || '';
  const fim = plano.fim || ts.map((t) => t.fim).filter(Boolean).sort().slice(-1)[0] || '';
  return { inicio: ini, fim };
}
const maxPontos = (cfg, turma) => { const p = P.pesosDa(cfg, turma); return p.presenca + p.participacao + p.exercicios; };
// ativsPorTurma: { TURMA: [atividades] }. Soma os totais de cada turma; quem está em duas turmas soma as duas.
function rankingPlano(cfg, plano, sessoes, ativsPorTurma) {
  const por = {};
  for (const t of idsDe(plano)) {
    if (!(cfg.turmas || {})[t]) continue;
    for (const l of P.ranking(cfg, t, sessoes, (ativsPorTurma || {})[t] || [])) {
      const x = por[l.usuario] || (por[l.usuario] = { usuario: l.usuario, total: 0, partes: { presenca: 0, participacao: 0, exercicios: 0, penalidades: 0 }, aguardando: 0, aulas: 0, entregas: 0, possivel: 0, turmas: [], _p: 0, _e: 0 });
      x.total += l.total; for (const k of Object.keys(x.partes)) x.partes[k] += l.partes[k] || 0;
      x.aguardando += l.aguardando; x.aulas += l.aulas; x.entregas += l.entregas; x.possivel += maxPontos(cfg, t); x.turmas.push(t); x._p += l.fPres; x._e += l.fEx;
    }
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  const linhas = Object.values(por).map((x) => { const n = x.turmas.length || 1; const o = { ...x, total: r1(x.total), fPres: x._p / n, fEx: x._e / n, pct: x.possivel ? r1((x.total / x.possivel) * 100) : 0 }; for (const k of Object.keys(o.partes)) o.partes[k] = r1(o.partes[k]); delete o._p; delete o._e; return o; });
  linhas.sort((a, b) => b.total - a.total || b.fPres - a.fPres || b.fEx - a.fEx || a.usuario.localeCompare(b.usuario));
  let pos = 0, ant = null; linhas.forEach((l, i) => { if (!ant || l.total !== ant.total || l.fPres !== ant.fPres || l.fEx !== ant.fEx) pos = i + 1; l.posicao = pos; ant = l; });
  return linhas;
}
// Arena Global: todos os planos (trilhas) juntos, ordenados pela % dos pontos possíveis. Desligada por padrão.
const arenaLigada = (cfg) => cfg.arenaAtiva === true;
function rankingArena(cfg, sessoes, ativsPorTurma) {
  if (!arenaLigada(cfg)) return [];
  const por = {};
  for (const p of Object.values(cfg.planos || {})) for (const l of rankingPlano(cfg, p, sessoes, ativsPorTurma)) { const x = por[l.usuario] || (por[l.usuario] = { usuario: l.usuario, total: 0, possivel: 0 }); x.total += l.total; x.possivel += l.possivel; }
  const linhas = Object.values(por).map((x) => ({ usuario: x.usuario, total: Math.round(x.total * 10) / 10, pct: x.possivel ? Math.round((x.total / x.possivel) * 1000) / 10 : 0 })).sort((a, b) => b.pct - a.pct || a.usuario.localeCompare(b.usuario));
  linhas.forEach((l, i) => { l.posicao = i && linhas[i - 1].pct === l.pct ? linhas[i - 1].posicao : i + 1; });
  return linhas;
}
module.exports = { doPlano, alunosDo, datas, rankingPlano, rankingArena, arenaLigada, idsDe };
