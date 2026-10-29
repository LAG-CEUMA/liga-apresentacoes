'use strict';
// Interesses dos alunos: a frente que cada um quer seguir, nível a nível (ex.: atividade N0.1-2·T3 e a revisão de metas de cada nível). Só owners leem e gravam.
// Um arquivo só: dados/perfis/interesses.json = { alunos: { <usuario>: { historico: [{ nivel, turma, frente, outras, metas, fome, motivo, perfil, dica, fonte, por, em }] } } }.
// O último item do histórico é o atual. "motivo" (resumo) e a frente podem aparecer para o próprio aluno; "perfil" e "dica" são só dos owners.
const u = require('./util');
const REPO = () => process.env.DATA_REPO || u.REPO(); const URL_ARQ = () => `/repos/${REPO()}/contents/dados/perfis/interesses.json`;
const FRENTES = { programacao: 'Programação', design: 'Design', arte: 'Arte', audio: 'Áudio', producao: 'Produção', testes: 'Testes' };
const METAS = { '': 'Primeira resposta', mesmas: 'Manteve as metas', mudou: 'Mudou as metas' };
const MARCADOR = '{{interesse_anterior}}';
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const txt = (v, n) => String(v || '').replace(/[​-‍⁠﻿]/g, '').replace(/[\u0000-\u001f ]/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, n);
const nomeNivel = (n) => { const m = /^nivel-(\d+)/.exec(String(n || '')); return m ? `Nível ${Number(m[1])}` : (n || 'nível anterior'); };
async function ler() {
  const r = await u.gh(`${URL_ARQ()}?ref=${u.BRANCH()}`); if (r.status === 404) return { dados: { alunos: {} }, sha: null }; if (!r.ok) throw new Error(`GitHub ${r.status} ao ler os interesses`);
  const j = await r.json(); let d = null; try { d = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { d = null; }
  return { dados: d && d.alunos && typeof d.alunos === 'object' ? d : { alunos: {} }, sha: j.sha };
}
// Um registro por nível: salvar no mesmo nível do último registro corrige esse registro; num nível novo, acrescenta ao histórico.
async function salvar(aluno, nivel, turma, b, usuario) {
  const frente = String(b.frente || ''); if (frente && !FRENTES[frente]) throw bad('Frente inválida.');
  const metas = String(b.metas || ''); if (!(metas in METAS)) throw bad('Situação das metas inválida.');
  const fome = b.fome === '' || b.fome === undefined || b.fome === null ? null : Number(b.fome); if (fome !== null && !(Number.isInteger(fome) && fome >= 1 && fome <= 5)) throw bad('A vontade de aprender vai de 1 a 5.');
  const outras = [...new Set((Array.isArray(b.outras) ? b.outras : []).map(String))].filter((x) => FRENTES[x] && x !== frente);
  const item = { nivel: txt(nivel, 60), turma: txt(turma, 20), frente, outras, metas, fome, motivo: txt(b.motivo, 300), perfil: txt(b.perfil, 80), dica: txt(b.dica, 300), fonte: txt(b.fonte, 60), por: usuario, em: new Date().toISOString() };
  const vazio = !item.frente && !item.outras.length && item.fome === null && !item.motivo && !item.perfil && !item.dica;
  for (let t = 0; t < 3; t++) {
    const { dados, sha } = await ler(); const h = ((dados.alunos[aluno] || {}).historico || []).slice(); const ult = h[h.length - 1];
    if (ult && ult.nivel === item.nivel) h.pop(); if (!vazio) h.push(item);
    if (h.length) dados.alunos[aluno] = { historico: h }; else delete dados.alunos[aluno];
    const corpo = { message: `Portal: ${usuario} atualizou os interesses de um aluno (turma ${item.turma})`, branch: u.BRANCH(), content: Buffer.from(JSON.stringify(dados, null, 2) + '\n').toString('base64') }; if (sha) corpo.sha = sha;
    const r = await u.gh(URL_ARQ(), { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) return h; if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar os interesses`);
  }
  throw new Error('Conflito ao gravar. Tente de novo.');
}
// Texto que entra no lugar de {{interesse_anterior}} na Issue do aluno: só a frente e o resumo (nunca perfil nem dica).
function paraAluno(dados, aluno) {
  const h = ((dados.alunos[aluno] || {}).historico || []); const a = h[h.length - 1];
  if (!a) return '> Ainda não temos uma resposta sua registrada. Responda as perguntas abaixo como se fosse a primeira vez.';
  const fr = [FRENTES[a.frente], ...(a.outras || []).map((x) => FRENTES[x])].filter(Boolean);
  return [`> **Sua resposta anterior (${nomeNivel(a.nivel)}):**`, `> Frente: ${fr.length ? fr.join(', ') : 'não informada'}`, a.motivo ? `> O que você disse, em resumo: ${a.motivo}` : ''].filter(Boolean).join('\n');
}
// Fome de conhecimento: compara, para cada aluno, um registro com o seguinte. A mudança é creditada ao nível que ele tinha acabado de fazer (o registro anterior).
// Por nível: quantos ampliaram as frentes de interesse, mantiveram, reduziram, trocaram a frente principal, e a variação média da vontade de aprender (1 a 5).
function fomePorNivel(dados) {
  const nivel = {}; const de = (n) => (nivel[n] = nivel[n] || { nivel: n, nome: nomeNivel(n), respostas: 0, fomeSoma: 0, fomeN: 0, transicoes: 0, ampliaram: 0, mantiveram: 0, reduziram: 0, trocaram: 0, deltaSoma: 0, deltaN: 0 });
  const nFrentes = (x) => (x.frente ? 1 : 0) + (x.outras || []).length;
  for (const al of Object.values(dados.alunos || {})) {
    const h = al.historico || [];
    h.forEach((x, i) => { const s = de(x.nivel); s.respostas++; if (x.fome) { s.fomeSoma += x.fome; s.fomeN++; }
      if (!i) return; const a = h[i - 1], t = de(a.nivel); t.transicoes++;
      const d = nFrentes(x) - nFrentes(a); if (d > 0) t.ampliaram++; else if (d < 0) t.reduziram++; else t.mantiveram++;
      if (a.frente && x.frente && a.frente !== x.frente) t.trocaram++;
      if (a.fome && x.fome) { t.deltaSoma += x.fome - a.fome; t.deltaN++; } });
  }
  const r = (v) => Math.round(v * 10) / 10;
  const lista = Object.values(nivel).sort((x, y) => String(x.nivel).localeCompare(String(y.nivel))).map((s) => ({ nivel: s.nivel, nome: s.nome, respostas: s.respostas, fomeMedia: s.fomeN ? r(s.fomeSoma / s.fomeN) : null,
    transicoes: s.transicoes, ampliaram: s.ampliaram, mantiveram: s.mantiveram, reduziram: s.reduziram, trocaram: s.trocaram, deltaFome: s.deltaN ? r(s.deltaSoma / s.deltaN) : null,
    indice: s.transicoes ? r(((s.ampliaram - s.reduziram) / s.transicoes) * 100 + (s.deltaN ? (s.deltaSoma / s.deltaN) * 25 : 0)) : null }));
  const com = lista.filter((x) => x.indice !== null); const destaque = com.length ? com.reduce((m, x) => (x.indice > m.indice ? x : m)).nivel : '';
  return { niveis: lista, destaque };
}
const ATIVIDADE_METAS = (nivel) => ({
  titulo: 'Suas metas continuam as mesmas?', codigo: `${nomeNivel(nivel).replace('Nível ', 'N')}·Metas`, peso: 10, notaMax: 10,
  descricao: `**Tempo: 10 minutos.**\n\nNo nível anterior você contou qual frente da Liga queria seguir (design, programação, arte, áudio, produção ou testes). Veja o que ficou registrado:\n\n${MARCADOR}\n\nComente aqui:\n\n1. **Suas metas continuam as mesmas?** Responda "sim" ou "não".\n2. **Se sim:** em 1 ou 2 frases, o que você fez no último nível que confirmou essa escolha?\n3. **Se não:** qual frente você quer seguir agora e o que fez você mudar de ideia?\n4. **Resumo:** em até 3 frases, explique o que você quer aprender neste nível e por quê.\n5. **De 1 a 5, quanto você quer aprender mais depois do último nível?** (1 = quase nada, 5 = estou com muita vontade de aprender mais)\n\nNão existe resposta errada: mudar de ideia faz parte do caminho. Travou? Escreva um comentário aqui.`,
});
module.exports = { FRENTES, METAS, MARCADOR, nomeNivel, ler, salvar, paraAluno, fomePorNivel, ATIVIDADE_METAS };
