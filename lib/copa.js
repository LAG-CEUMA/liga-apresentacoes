'use strict';
// Copa da Liga: camada divertida por cima do ranking oficial. Itens ganhos por semana e usados contra colegas
// afetam SOMENTE os pontos da Copa. O ranking oficial, as notas e os certificados nunca são alterados aqui.
// Estado por turma em dados/copa/<TURMA>.json:
// { visibilidade:'oculta'|'propria'|'completa', ativa:bool, concedidos:{usuario:n}, inventario:{usuario:[{id,tipo,semana,em}]},
//   efeitos:[{id,tipo,de,para,delta,em,ate,bloqueado}], escudos:{usuario:true}, usos:{usuario:{semana,ultimoAlvo}}, log:[...] }
const crypto = require('crypto');
const SEMANA_MS = 7 * 864e5;
const CAP = 3;                // itens guardados por aluno
const DIAS_EFEITO = 7;        // um ataque ou turbo dura 7 dias
const TREGUA_DIAS = 2;        // nos últimos 2 dias da turma nada vale: a Copa final é só o ranking oficial
const ATAQUES_DIA = 1;        // máximo de ataques que um mesmo aluno recebe por dia
const VISIBILIDADES = ['oculta', 'propria', 'completa'];
const ITENS = {
  turbo: { ic: '🍄', nome: 'Turbo', alvo: 'si', delta: 3, peso: 3, txt: 'Você ganha +3 pontos na Copa por 7 dias.' },
  escudo: { ic: '🛡️', nome: 'Escudo', alvo: 'si', delta: 0, peso: 3, txt: 'Bloqueia o próximo ataque que você receber.' },
  chuva: { ic: '🌧️', nome: 'Chuva de itens', alvo: 'todos', delta: 0, peso: 1, txt: 'Dá 1 item sorteado a cada colega perto de você no ranking (2 acima e 2 abaixo).' },
  roleta: { ic: '🎰', nome: 'Roleta maluca', alvo: 'auto', delta: -2, peso: 1, txt: 'Cai sozinha em quem tirou: -2 pontos na Copa por 7 dias, a não ser que tenha escudo.' },
  banana: { ic: '🍌', nome: 'Banana', alvo: 'outro', delta: -3, peso: 4, txt: 'O colega perde 3 pontos na Copa por 7 dias.' },
  casco: { ic: '🐢', nome: 'Casco', alvo: 'outro', delta: -5, peso: 2, soFrente: true, txt: 'Acerta só quem está à sua frente: perde 5 pontos na Copa por 7 dias.' },
};
const estadoVazio = () => ({ visibilidade: 'oculta', ativa: false, concedidos: {}, inventario: {}, efeitos: [], escudos: {}, usos: {}, log: [] });
function normalizar(e) {
  const b = estadoVazio(), x = e && typeof e === 'object' ? e : {};
  return { ...b, ...x, visibilidade: VISIBILIDADES.includes(x.visibilidade) ? x.visibilidade : 'oculta', ativa: !!x.ativa,
    concedidos: x.concedidos || {}, inventario: x.inventario || {}, efeitos: Array.isArray(x.efeitos) ? x.efeitos : [], escudos: x.escudos || {}, usos: x.usos || {}, log: Array.isArray(x.log) ? x.log : [] };
}
// Semana da turma (1 = primeira) a partir da data de início; antes do início = 0.
function semanaDe(inicio, quando) {
  if (!inicio) return 0;
  const a = new Date(inicio + 'T00:00:00-03:00').getTime(), t = typeof quando === 'number' ? quando : new Date(quando).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(t) || t < a) return 0;
  return Math.floor((t - a) / SEMANA_MS) + 1;
}
// Quantas "vagas de item" o aluno ganhou até a semana atual: até 3 por semana (presença, entrega no prazo, participação).
function ganhosPorSemana(usuario, turma, inicio, sessoes, atividades, resumoSessao) {
  const por = {}; const marca = (sem, tipo) => { if (sem < 1) return; (por[sem] = por[sem] || new Set()).add(tipo); };
  for (const s of sessoes.filter((x) => x.turma === turma && x.data)) {
    const sem = semanaDe(inicio, s.data + 'T12:00:00-03:00');
    if (Object.keys(s.chamadas || {}).length && (resumoSessao(s)[usuario] || {}).status === 'presente') marca(sem, 'presenca');
    if ((s.participacoes || []).some((p) => p.usuario === usuario && p.tipo !== 'penalidade')) marca(sem, 'participacao');
  }
  for (const a of atividades.filter((x) => x.turma === turma && x.liberada && !x.opcional && x.prazo)) {
    const e = (a.entregas || {})[usuario] || {};
    if (e.estado === 'prazo') marca(semanaDe(inicio, a.prazo), 'entrega');
  }
  return Object.fromEntries(Object.entries(por).map(([k, v]) => [k, v.size]));
}
// Vagas de item ganhas até a semana 'ate' (inclusive).
function ganhos(usuario, turma, inicio, agora, sessoes, atividades, resumoSessao, ate) {
  const por = ganhosPorSemana(usuario, turma, inicio, sessoes, atividades, resumoSessao), lim = ate === undefined ? semanaDe(inicio, agora) : ate;
  return Object.entries(por).reduce((n, [sem, q]) => n + (Number(sem) <= lim ? q : 0), 0);
}
const fimMs = (fim) => (fim ? new Date(fim + 'T23:59:59-03:00').getTime() : Infinity);
const emTregua = (fim, agora) => agora >= fimMs(fim) - TREGUA_DIAS * 864e5;
// Sorteio ponderado, mas determinístico (mesma turma, aluno e posição dão sempre o mesmo item).
function sortear(turma, usuario, indice) {
  const total = Object.values(ITENS).reduce((n, i) => n + i.peso, 0);
  const h = crypto.createHash('sha1').update(`${turma}|${usuario}|${indice}`).digest().readUInt32BE(0) % total;
  let acc = 0; for (const [k, i] of Object.entries(ITENS)) { acc += i.peso; if (h < acc) return k; }
  return 'banana';
}
// Entrega os itens a que cada aluno tem direito (respeita o limite de itens guardados). Devolve true se algo mudou.
function sincronizar(est, turma, inicio, agora, alunos, sessoes, atividades, resumoSessao, fim) {
  let mudou = false; const sem = semanaDe(inicio, agora); const tregua = emTregua(fim, agora);
  for (const a of alunos) {
    const inv = (est.inventario[a] = est.inventario[a] || []);
    const antes = inv.length; est.inventario[a] = inv.filter((x) => x.semana === sem); // item guardado não passa de uma semana para a outra
    if (est.inventario[a].length !== antes) mudou = true;
    let n = est.concedidos[a] || 0; const passado = ganhos(a, turma, inicio, agora, sessoes, atividades, resumoSessao, sem - 1);
    if (n < passado) { n = passado; mudou = true; } // o que não foi concedido em semanas passadas se perde
    const direito = ganhos(a, turma, inicio, agora, sessoes, atividades, resumoSessao, sem);
    while (n < direito && sem > 0 && !tregua) {
      const tipo = sortear(turma, a, n), id = crypto.createHash('sha1').update(`${turma}|${a}|${n}`).digest('hex').slice(0, 8), em = new Date(agora).toISOString();
      if (tipo === 'roleta') { roletar(est, a, id, em, agora); } else if (est.inventario[a].length < CAP) est.inventario[a].push({ id, tipo, semana: sem, em }); else break;
      n++; mudou = true;
    }
    if (n !== (est.concedidos[a] || 0)) { est.concedidos[a] = n; mudou = true; }
  }
  return mudou;
}
// A roleta maluca cai sozinha em quem tirou (baixa incidência). Escudo bloqueia.
function roletar(est, a, id, em, agora) {
  if (est.escudos[a]) { delete est.escudos[a]; est.log.push({ em, de: 'roleta', item: 'roleta', para: a, txt: 'bloqueada pelo escudo' }); return; }
  est.efeitos.push({ id, tipo: 'roleta', de: 'roleta', para: a, delta: ITENS.roleta.delta, em, ate: new Date(agora + DIAS_EFEITO * 864e5).toISOString() });
  est.log.push({ em, de: 'roleta', item: 'roleta', para: a, txt: 'caiu em quem tirou' });
}
const ativo = (e, agora) => new Date(e.ate).getTime() > agora;
function efeitosAtivos(est, agora, fim) { return emTregua(fim, agora) ? [] : est.efeitos.filter((e) => !e.bloqueado && ativo(e, agora)); }
// Pontos da Copa = pontos oficiais + efeitos ativos (nunca abaixo de zero). 'rank' é o ranking oficial da turma.
function placar(est, rank, agora, fim) {
  const delta = {}; for (const e of efeitosAtivos(est, agora, fim)) delta[e.para] = (delta[e.para] || 0) + e.delta;
  const linhas = rank.map((x) => ({ usuario: x.usuario, oficial: x.total, posOficial: x.posicao, copa: Math.max(0, Math.round((x.total + (delta[x.usuario] || 0)) * 10) / 10), efeito: delta[x.usuario] || 0, escudo: !!est.escudos[x.usuario] }));
  linhas.sort((a, b) => b.copa - a.copa || a.posOficial - b.posOficial || a.usuario.localeCompare(b.usuario));
  linhas.forEach((l, i) => { l.posCopa = i + 1; });
  return linhas;
}
// Usa um item. Devolve { erro } ou { ok, resultado, est } (altera est). Regras para ninguém ser perseguido.
function usar(est, quem, itemId, alvo, rank, inicio, agora, fim) {
  const inv = est.inventario[quem] || []; const i = inv.findIndex((x) => x.id === itemId);
  if (i < 0) return { erro: 'Você não tem esse item.' };
  const tipo = inv[i].tipo, def = ITENS[tipo]; if (!def) return { erro: 'Item desconhecido.' };
  const sem = semanaDe(inicio, agora); const uso = est.usos[quem] || {};
  if (emTregua(fim, agora)) return { erro: 'Trégua final: nos últimos dias da turma os itens ficam guardados e a Copa vale só o ranking oficial.' };
  if (def.alvo === 'auto') return { erro: 'Esse item cai sozinho, não dá para usar.' };
  if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (inv[i].semana !== sem) return { erro: 'Esse item venceu: itens valem só na semana em que foram ganhos.' };
  if (uso.semana === sem && !inv[i].bonus) return { erro: 'Você já usou um item nesta semana. Na próxima você pode usar outro.' };
  const meu = rank.find((x) => x.usuario === quem); if (!meu) return { erro: 'Você não está no ranking desta turma.' };
  const desde = new Date(agora).toISOString(), ate = new Date(Math.min(agora + DIAS_EFEITO * 864e5, fimMs(fim) - TREGUA_DIAS * 864e5)).toISOString();
  const bonus = !!inv[i].bonus; const consome = () => { inv.splice(i, 1); if (!bonus) est.usos[quem] = { semana: sem, ultimoAlvo: uso.ultimoAlvo || '' }; };
  const reg = (txt) => { est.log.push({ em: desde, de: quem, item: tipo, para: alvo || quem, txt }); if (est.log.length > 300) est.log.splice(0, est.log.length - 300); };
  if (def.alvo === 'si') {
    if (tipo === 'escudo') { if (est.escudos[quem]) return { erro: 'Seu escudo já está ativo.' }; est.escudos[quem] = true; consome(); reg('escudo ativado'); return { ok: true, resultado: 'Escudo ativado: ele bloqueia o próximo ataque que você receber.' }; }
    est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: quem, para: quem, delta: def.delta, em: desde, ate }); consome(); reg('turbo'); return { ok: true, resultado: 'Turbo ligado: +' + def.delta + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.' };
  }
  if (def.alvo === 'todos') {
    const pl = placar(est, rank, agora, fim), pos = pl.findIndex((x) => x.usuario === quem); const viz = pl.filter((x, k) => k !== pos && Math.abs(k - pos) <= 2);
    if (!viz.length) return { erro: 'Não há colegas perto de você.' };
    const permitidos = Object.keys(ITENS).filter((k) => ITENS[k].alvo !== 'auto' && k !== 'chuva');
    for (const v of viz) { const hh = crypto.createHash('sha1').update(`${quem}|${v.usuario}|${agora}`).digest().readUInt32BE(0); (est.inventario[v.usuario] = est.inventario[v.usuario] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: permitidos[hh % permitidos.length], semana: sem, em: desde, bonus: true }); }
    consome(); reg('chuva de itens para ' + viz.length + ' colegas'); return { ok: true, resultado: '🌧️ Choveu item! ' + viz.length + ' colegas perto de você ganharam um item extra.' };
  }
  const alvoL = rank.find((x) => x.usuario === alvo); if (!alvoL) return { erro: 'Escolha um colega da turma.' };
  if (alvo === quem) return { erro: 'Não dá para usar isso em você mesmo.' };
  if (uso.ultimoAlvo === alvo) return { erro: 'Escolha outro colega: você não pode atacar a mesma pessoa duas vezes seguidas.' };
  if (rank.length >= 4 && alvoL.posicao === Math.max(...rank.map((x) => x.posicao))) return { erro: 'Quem está em último lugar está protegido (semana de graça).' };
  if (def.soFrente && !(alvoL.posicao < meu.posicao)) return { erro: 'O casco só acerta quem está à sua frente no ranking.' };
  const inicioDia = agora - 864e5; const recebidos = est.efeitos.filter((e) => e.para === alvo && e.de !== alvo && new Date(e.em).getTime() > inicioDia).length;
  if (recebidos >= ATAQUES_DIA) return { erro: 'Essa pessoa já recebeu um ataque hoje. Tente outro colega ou outro dia.' };
  consome(); est.usos[quem].ultimoAlvo = alvo;
  if (est.escudos[alvo]) { delete est.escudos[alvo]; est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: quem, para: alvo, delta: 0, em: desde, ate: desde, bloqueado: true }); reg('bloqueado pelo escudo'); return { ok: true, bloqueado: true, resultado: 'O colega estava com escudo e bloqueou seu ataque.' }; }
  est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: quem, para: alvo, delta: def.delta, em: desde, ate }); reg('acertou');
  return { ok: true, resultado: def.ic + ' Acertou! O colega perde ' + Math.abs(def.delta) + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.' };
}
// Chuva de itens do professor: 1 item extra (bônus) para cada aluno da turma, valendo até o fim da semana. No máximo 1 por dia.
function chuvaProfessor(est, rank, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora); if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (emTregua(fim, agora)) return { erro: 'Trégua final: não dá para distribuir itens agora.' };
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10); if (est.log.some((l) => l.item === 'chuva-professor' && String(l.em).slice(0, 10) === new Date(agora).toISOString().slice(0, 10) && hoje)) return { erro: 'Já houve uma chuva de itens hoje.' };
  const permitidos = Object.keys(ITENS).filter((k) => ITENS[k].alvo !== 'auto' && k !== 'chuva'); const em = new Date(agora).toISOString();
  for (const x of rank) { const hh = crypto.createHash('sha1').update(`prof|${x.usuario}|${agora}`).digest().readUInt32BE(0); (est.inventario[x.usuario] = est.inventario[x.usuario] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: permitidos[hh % permitidos.length], semana: sem, em, bonus: true }); }
  est.log.push({ em, de: 'professor', item: 'chuva-professor', para: 'todos', txt: 'chuva de itens para ' + rank.length + ' alunos' });
  return { ok: true, resultado: 'Choveu item para ' + rank.length + ' alunos. Valem até o fim desta semana.' };
}
// Limpeza: guarda só efeitos recentes (os antigos já não contam).
function limpar(est, agora) { est.efeitos = est.efeitos.filter((e) => new Date(e.ate).getTime() > agora - 30 * 864e5); }
module.exports = { chuvaProfessor, ITENS, CAP, DIAS_EFEITO, TREGUA_DIAS, emTregua, fimMs, roletar, VISIBILIDADES, estadoVazio, normalizar, semanaDe, ganhos, sortear, sincronizar, placar, usar, efeitosAtivos, limpar };
