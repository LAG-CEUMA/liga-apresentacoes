'use strict';
// Datas das aulas de uma turma. Cada aula tem uma data PREVISTA, calculada do início da turma, no dia da semana da trilha
// (de 7 em 7 dias, pulando as semanas sem aula do calendário). O professor pode fixar a data de uma aula (datasAulas);
// as aulas seguintes sem data fixada continuam 7 dias depois dela.
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const dia = (s) => new Date(s + 'T12:00:00Z');
const str = (d) => d.toISOString().slice(0, 10);
const soma = (s, n) => { const d = dia(s); d.setUTCDate(d.getUTCDate() + n); return str(d); };
function doPlano(cfg, turma) { return Object.values(cfg.planos || {}).find((p) => (p.turmas || []).includes(turma)) || null; }
// aulas: [{ chave }] de qualquer nível; só entram as do nível da turma. Retorna { chave: { data, manual } } ('' se não dá para calcular).
function calcular(cfg, turmaId, aulas) {
  const t = (cfg.turmas || {})[turmaId]; if (!t) return {};
  const pl = doPlano(cfg, turmaId) || {};
  const chaves = (aulas || []).map((a) => a.chave).filter((c) => !t.nivel || String(c).startsWith(t.nivel + '/')).sort();
  const manual = t.datasAulas || {};
  const sem = new Set((pl.semanasSemAula || []).filter((x) => DATA_RE.test(x)));
  let ini = t.inicio || pl.inicio || '';
  if (DATA_RE.test(ini) && /^[0-6]$/.test(String(pl.diaSemana))) { let n = 0; while (dia(ini).getUTCDay() !== Number(pl.diaSemana) && n++ < 7) ini = soma(ini, 1); }
  const out = {}; let prev = '';
  for (const c of chaves) {
    let d = DATA_RE.test(manual[c] || '') ? manual[c] : '';
    const eManual = !!d;
    if (!d) { d = prev ? soma(prev, 7) : (DATA_RE.test(ini) ? ini : ''); let n = 0; while (d && sem.has(d) && n++ < 60) d = soma(d, 7); }
    out[c] = { data: d, manual: eManual }; if (d) prev = d;
  }
  return out;
}
module.exports = { calcular, soma, DATA_RE };
