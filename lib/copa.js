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
// Tabela do d10 por item: [máx. falha crítica, máx. falha, máx. fraco, máx. normal]; acima disso (10) é crítico.
const TAB = { turbo: [1, 3, 6, 9], escudo: [1, 3, 3, 9], chuva: [1, 3, 6, 9], banana: [1, 3, 5, 9], casco: [1, 4, 7, 9] };
// 👹 Chefão da Liga: owners e professores não estão no ranking, então jogam como o "inimigo de todos". 1 item por semana, só mexe nos pontos da Copa.
const BOSS = {
  trovao: { ic: '⚡', nome: 'Trovão do Chefão', delta: -4, alvo: 'lider', txt: 'Cai no líder da Copa: -4 pontos na Copa por 7 dias.' },
  maldicao: { ic: '🧙', nome: 'Maldição', delta: -3, alvo: 'outro', txt: 'Um aluno escolhido perde 3 pontos na Copa por 7 dias.' },
  bencao: { ic: '🎁', nome: 'Bênção do Chefão', delta: 3, alvo: 'outro', txt: 'Um aluno escolhido ganha 3 pontos na Copa por 7 dias.' },
};
Object.assign(TAB, { trovao: [1, 3, 6, 9], maldicao: [1, 3, 5, 9], bencao: [1, 2, 4, 9] });
const itemChefao = (quem, sem) => { const k = Object.keys(BOSS); return k[crypto.createHash('sha1').update(`chefao|${quem}|${sem}`).digest().readUInt32BE(0) % k.length]; };
const MULT = { fraco: 0.5, normal: 1, critico: 1.5 };
const FAIXA_TXT = { falha_critica: 'falha crítica', falha: 'falha', fraco: 'efeito fraco', normal: 'efeito normal', critico: 'crítico' };
const meio = (n) => Math.round(n * 2) / 2;
function faixaDe(tipo, r) { const t = TAB[tipo] || TAB.banana; return r <= t[0] ? 'falha_critica' : r <= t[1] ? 'falha' : r <= t[2] ? 'fraco' : r <= t[3] ? 'normal' : 'critico'; }
let rolar = () => crypto.randomInt(1, 11); // d10; os testes trocam por um dado fixo
const setDado = (f) => { rolar = f || (() => crypto.randomInt(1, 11)); };
// Evento da semana: um modificador (escolhido pelo professor ou sorteado) que vale só naquela semana da turma.
const EVENTOS = {
  nevoeiro: { ic: '🌫️', nome: 'Semana do nevoeiro', txt: 'Ninguém vê o placar da Copa nesta semana, só os próprios pontos.' },
  dado_dobro: { ic: '🎲🎲', nome: 'Dado em dobro', txt: 'Cada lançamento rola 2 dados e vale o melhor.' },
  paz: { ic: '🕊️', nome: 'Semana da paz', txt: 'Ataques ficam bloqueados; só os itens de ajuda funcionam.' },
  chuva: { ic: '🌧️', nome: 'Semana da chuva', txt: 'Todos ganham 1 item extra assim que o evento começa.' },
};
const eventoDe = (est, sem) => { const k = (est.eventos || {})[String(sem)]; return k && EVENTOS[k] ? k : null; };
const estadoVazio = () => ({ visibilidade: 'oculta', ativa: false, concedidos: {}, inventario: {}, efeitos: [], escudos: {}, usos: {}, azar: {}, eventos: {}, missoes: {}, chefes: {}, log: [] });
function normalizar(e) {
  const b = estadoVazio(), x = e && typeof e === 'object' ? e : {};
  return { ...b, ...x, visibilidade: VISIBILIDADES.includes(x.visibilidade) ? x.visibilidade : 'oculta', ativa: !!x.ativa,
    concedidos: x.concedidos || {}, inventario: x.inventario || {}, efeitos: Array.isArray(x.efeitos) ? x.efeitos : [], escudos: x.escudos || {}, usos: x.usos || {}, azar: x.azar || {}, eventos: x.eventos || {}, missoes: x.missoes || {}, chefes: x.chefes || {}, log: Array.isArray(x.log) ? x.log : [] };
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
  if (missao(est, turma, inicio, agora, alunos, atividades, fim)) mudou = true;
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
  // Dado d10: o aluno não escolhe nada, o servidor rola. A tabela depende do item (quanto mais forte, mais arriscado).
  const ev = eventoDe(est, sem);
  const rolagem = () => { let r = rolar(); if (ev === 'dado_dobro') r = Math.max(r, rolar()); return { r, faixa: faixaDe(tipo, r) }; };
  const dadoTxt = (d) => '🎲 Tirou ' + d.r + ' (' + FAIXA_TXT[d.faixa] + '). ';
  const efeito = (para, delta, t) => est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo: t || tipo, de: quem, para, delta, em: desde, ate });
  const bonusItem = (para, k) => { const perm = Object.keys(ITENS).filter((x) => ITENS[x].alvo !== 'auto' && x !== 'chuva'); (est.inventario[para] = est.inventario[para] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: perm[k % perm.length], semana: sem, em: desde, bonus: true }); };
  // Consolo: 3 falhas críticas seguidas dão um escudo de presente.
  const azar = (d) => { est.azar = est.azar || {}; if (d.faixa === 'falha_critica') { est.azar[quem] = (est.azar[quem] || 0) + 1; if (est.azar[quem] >= 3) { est.azar[quem] = 0; (est.inventario[quem] = est.inventario[quem] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: 'escudo', semana: sem, em: desde, bonus: true }); return ' 🍀 Três azares seguidos: você ganhou um Escudo de consolo.'; } } else est.azar[quem] = 0; return ''; };
  const fim_ = (d, txt, extra, mais) => { reg(txt + ' [d10=' + d.r + ']'); Object.assign(est.log[est.log.length - 1], { faixa: d.faixa, dado: d.r, alvo: alvo || quem }, mais || {}); return { ok: true, faixa: d.faixa, dado: d.r, resultado: dadoTxt(d) + txt + (extra || '') }; };
  if (def.alvo === 'si') {
    const d = rolagem(); consome(); const cz = azar(d);
    if (tipo === 'escudo') {
      if (d.faixa === 'falha_critica') { efeito(quem, -1, 'azar'); return fim_(d, 'O escudo estourou na sua mão: -1 ponto na Copa por ' + DIAS_EFEITO + ' dias.', cz); }
      if (d.faixa === 'falha') return fim_(d, 'O escudo não abriu. O item foi gasto.', cz);
      if (!est.escudos[quem]) est.escudos[quem] = true;
      if (d.faixa === 'critico') bonusItem(quem, d.r + sem);
      return fim_(d, 'Escudo ativado: ele bloqueia o próximo ataque que você receber.' + (d.faixa === 'critico' ? ' Crítico! Você ganhou também um item extra.' : ''), cz);
    }
    if (d.faixa === 'falha_critica') { efeito(quem, -2, 'azar'); return fim_(d, 'O Turbo engasgou: -2 pontos na Copa por ' + DIAS_EFEITO + ' dias.', cz); }
    if (d.faixa === 'falha') return fim_(d, 'O Turbo não pegou. O item foi gasto.', cz);
    const v = meio(def.delta * MULT[d.faixa]); efeito(quem, v, 'turbo'); return fim_(d, 'Turbo ligado: +' + v + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.', cz);
  }
  if (def.alvo === 'todos') {
    const pl = placar(est, rank, agora, fim), pos = pl.findIndex((x) => x.usuario === quem); const viz = pl.filter((x, k) => k !== pos && Math.abs(k - pos) <= 2);
    if (!viz.length) return { erro: 'Não há colegas perto de você.' };
    const d = rolagem(); consome(); const cz = azar(d);
    if (d.faixa === 'falha_critica') { efeito(quem, -2, 'azar'); return fim_(d, 'A chuva virou tempestade em cima de você: -2 pontos na Copa por ' + DIAS_EFEITO + ' dias.', cz); }
    if (d.faixa === 'falha') return fim_(d, 'Não choveu nada. O item foi gasto.', cz);
    const alvos = d.faixa === 'fraco' ? viz.slice(0, Math.max(1, Math.ceil(viz.length / 2))) : viz;
    alvos.forEach((v, k) => bonusItem(v.usuario, rolar() + k));
    if (d.faixa === 'critico') bonusItem(quem, d.r + sem);
    return fim_(d, '🌧️ Choveu item! ' + alvos.length + ' colega(s) perto de você ganharam um item extra.' + (d.faixa === 'critico' ? ' Crítico! Sobrou um para você também.' : ''), cz);
  }
  if (ev === 'paz') return { erro: '🕊️ Semana da paz: ataques estão bloqueados. Use um item de ajuda ou espere a próxima semana.' };
  const alvoL = rank.find((x) => x.usuario === alvo); if (!alvoL) return { erro: 'Escolha um colega da turma.' };
  if (alvo === quem) return { erro: 'Não dá para usar isso em você mesmo.' };
  if (uso.ultimoAlvo === alvo) return { erro: 'Escolha outro colega: você não pode atacar a mesma pessoa duas vezes seguidas.' };
  const ultimoLugar = (k) => rank.length >= 4 && (rank.find((x) => x.usuario === k) || {}).posicao === Math.max(...rank.map((x) => x.posicao));
  if (ultimoLugar(alvo)) return { erro: 'Quem está em último lugar está protegido (semana de graça).' };
  if (def.soFrente && !(alvoL.posicao < meu.posicao)) return { erro: 'O casco só acerta quem está à sua frente no ranking.' };
  const inicioDia = agora - 864e5; const recebeuHoje = (k) => est.efeitos.filter((e) => e.para === k && e.de !== k && new Date(e.em).getTime() > inicioDia).length >= ATAQUES_DIA;
  if (recebeuHoje(alvo)) return { erro: 'Essa pessoa já recebeu um ataque hoje. Tente outro colega ou outro dia.' };
  const d = rolagem(); consome(); const cz = azar(d);
  const acertar = (vitima, delta) => {
    if (est.escudos[vitima]) { delete est.escudos[vitima]; est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: quem, para: vitima, delta: 0, em: desde, ate: desde, bloqueado: true }); return false; }
    efeito(vitima, delta); return true;
  };
  if (d.faixa === 'falha') return fim_(d, 'Errou o alvo: nada aconteceu. O item foi gasto.', cz);
  if (d.faixa === 'falha_critica') {
    // 50%: acerta você mesmo; 50%: cai em outro colega sorteado (nunca o alvo, o último lugar ou quem já levou ataque hoje).
    const cand = rank.filter((x) => x.usuario !== quem && x.usuario !== alvo && !ultimoLugar(x.usuario) && !recebeuHoje(x.usuario) && (!def.soFrente || x.posicao < meu.posicao));
    const aSi = rolar() <= 5 || !cand.length; const vit = aSi ? quem : cand[(rolar() - 1) % cand.length].usuario;
    const bateu = acertar(vit, def.delta);
    return fim_(d, aSi ? (bateu ? 'FALHA CRÍTICA! ' + def.ic + ' voltou e acertou você mesmo: ' + def.delta + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.' : 'FALHA CRÍTICA! O item voltou, mas seu escudo segurou.') : 'FALHA CRÍTICA! ' + def.ic + ' errou o alvo e acertou outro colega sorteado.', cz, { vit, bloq: !bateu });
  }
  est.usos[quem] = { semana: (est.usos[quem] || {}).semana, ultimoAlvo: alvo };
  const v = meio(def.delta * MULT[d.faixa]);
  if (!acertar(alvo, v)) return { ...fim_(d, 'O colega estava com escudo e bloqueou seu ataque.', cz, { vit: alvo, bloq: true }), bloqueado: true };
  return fim_(d, def.ic + ' Acertou! O colega perde ' + Math.abs(v) + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.' + (d.faixa === 'critico' ? ' Crítico!' : d.faixa === 'fraco' ? ' (acerto fraco)' : ''), cz, { vit: alvo });
}
// Chefão: dono/professor joga sem estar no ranking. Mesmas proteções dos alunos (escudo, último lugar, 1 efeito negativo por dia, trégua, paz) e o mesmo d10.
function chefaoInfo(est, quem, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora); const tipo = sem >= 1 ? itemChefao(quem, sem) : null; const uso = (est.chefes || {})[quem] || {};
  return { semana: sem, tipo, def: tipo ? BOSS[tipo] : null, usado: uso.semana === sem, tregua: emTregua(fim, agora) };
}
function usarChefao(est, quem, alvo, rank, inicio, agora, fim) {
  const inf = chefaoInfo(est, quem, inicio, agora, fim); const sem = inf.semana;
  if (inf.tregua) return { erro: 'Trégua final: o Chefão descansa até o fim da turma.' };
  if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (inf.usado) return { erro: 'O Chefão já agiu nesta semana. Na próxima vem outro item.' };
  const ev = eventoDe(est, sem); const def = inf.def, tipo = inf.tipo;
  if (ev === 'paz' && def.delta < 0) return { erro: '🕊️ Semana da paz: ataques estão bloqueados, até os do Chefão.' };
  const pl = placar(est, rank, agora, fim); if (!pl.length) return { erro: 'Não há alunos no ranking.' };
  const ultimo = (k) => rank.length >= 4 && (rank.find((x) => x.usuario === k) || {}).posicao === Math.max(...rank.map((x) => x.posicao));
  const inicioDia = agora - 864e5; const recebeuHoje = (k) => est.efeitos.some((e) => e.para === k && e.delta < 0 && e.de !== k && new Date(e.em).getTime() > inicioDia);
  const alvoK = def.alvo === 'lider' ? pl[0].usuario : alvo;
  if (!rank.find((x) => x.usuario === alvoK)) return { erro: 'Escolha um aluno da turma.' };
  if (def.delta < 0 && ultimo(alvoK)) return { erro: 'Quem está em último lugar está protegido (semana de graça).' };
  if (def.delta < 0 && recebeuHoje(alvoK)) return { erro: 'Esse aluno já recebeu um ataque hoje. Escolha outro ou espere.' };
  let r = rolar(); if (ev === 'dado_dobro') r = Math.max(r, rolar()); const faixa = faixaDe(tipo, r);
  const desde = new Date(agora).toISOString(), ate = new Date(Math.min(agora + DIAS_EFEITO * 864e5, fimMs(fim) - TREGUA_DIAS * 864e5)).toISOString();
  est.chefes[quem] = { semana: sem, usado: true };
  const reg = (txt, mais) => { est.log.push({ em: desde, de: 'chefao', item: tipo, para: alvoK, txt, faixa, dado: r, alvo: alvoK, ...(mais || {}) }); if (est.log.length > 300) est.log.splice(0, est.log.length - 300); };
  const pre = '🎲 Tirou ' + r + ' (' + FAIXA_TXT[faixa] + '). ';
  const aplica = (k, delta) => {
    if (delta < 0 && est.escudos[k]) { delete est.escudos[k]; est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: 'chefao', para: k, delta: 0, em: desde, ate: desde, bloqueado: true }); return false; }
    est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: 'chefao', para: k, delta, em: desde, ate }); return true;
  };
  if (faixa === 'falha') { reg('O Chefão errou o golpe'); return { ok: true, faixa, dado: r, resultado: pre + 'O golpe errou. O item foi gasto.' }; }
  if (faixa === 'falha_critica') {
    if (def.alvo === 'lider') { const k = rank[(r + sem) % rank.length].usuario; darItemATodos(est, [k], sem, agora, 'tesouro'); reg('O Chefão tropeçou e deixou cair um tesouro', { vit: k }); return { ok: true, faixa, dado: r, resultado: pre + 'FALHA CRÍTICA! O Chefão tropeçou e deixou cair um tesouro: um aluno sorteado ganhou um item extra.' }; }
    const inverso = -def.delta; const b = aplica(alvoK, inverso); reg('A magia do Chefão virou ao contrário', { vit: alvoK, bloq: !b });
    return { ok: true, faixa, dado: r, resultado: pre + 'FALHA CRÍTICA! A magia virou ao contrário: ' + (inverso > 0 ? 'o aluno ganhou +' + inverso : 'o aluno perdeu ' + Math.abs(inverso)) + ' pontos na Copa.' };
  }
  const v = meio(def.delta * MULT[faixa]); const bateu = aplica(alvoK, v);
  reg(bateu ? 'acertou' : 'bloqueado pelo escudo', { vit: alvoK, bloq: !bateu });
  return { ok: true, faixa, dado: r, bloqueado: !bateu, resultado: pre + (bateu ? def.ic + ' ' + def.nome + (v > 0 ? ': o aluno ganha +' + v : ': o aluno perde ' + Math.abs(v)) + ' pontos na Copa por ' + DIAS_EFEITO + ' dias.' + (faixa === 'critico' ? ' Crítico!' : faixa === 'fraco' ? ' (efeito fraco)' : '') : 'O aluno estava com escudo e bloqueou o golpe.') };
}
// Item bônus (vale até o fim da semana) para cada aluno da lista.
function darItemATodos(est, alunos, sem, agora, tag) {
  const perm = Object.keys(ITENS).filter((k) => ITENS[k].alvo !== 'auto' && k !== 'chuva'), em = new Date(agora).toISOString();
  for (const a of alunos) { const hh = crypto.createHash('sha1').update(`${tag}|${a}|${sem}`).digest().readUInt32BE(0); (est.inventario[a] = est.inventario[a] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: perm[hh % perm.length], semana: sem, em, bonus: true }); }
}
// Define o evento de uma semana. tipo: chave de EVENTOS, 'sorteio' ou 'nenhum'. A chuva entrega os itens uma única vez.
function definirEvento(est, rank, inicio, agora, tipo, fim) {
  const sem = semanaDe(inicio, agora); if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (emTregua(fim, agora)) return { erro: 'Trégua final: não há eventos agora.' };
  if (tipo === 'nenhum') { delete est.eventos[String(sem)]; return { ok: true, resultado: 'Evento da semana removido.' }; }
  const ks = Object.keys(EVENTOS); const k = tipo === 'sorteio' ? ks[crypto.createHash('sha1').update(`ev|${sem}|${rank.length}`).digest().readUInt32BE(0) % ks.length] : tipo;
  if (!EVENTOS[k]) return { erro: 'Evento inválido.' };
  const antes = est.eventos[String(sem)]; est.eventos[String(sem)] = k;
  if (k === 'chuva' && antes !== 'chuva') darItemATodos(est, rank.map((x) => x.usuario), sem, agora, 'evento');
  est.log.push({ em: new Date(agora).toISOString(), de: 'professor', item: 'evento', para: 'todos', txt: EVENTOS[k].nome, evento: k });
  return { ok: true, resultado: EVENTOS[k].ic + ' ' + EVENTOS[k].nome + ': ' + EVENTOS[k].txt };
}
// Missão da turma: se todos entregaram no prazo as atividades que venceram nesta semana, a turma ganha 1 item extra cada (uma vez por semana).
function missaoInfo(est, turma, inicio, agora, alunos, atividades) {
  const sem = semanaDe(inicio, agora); if (sem < 1) return { sem, cumprida: false, atividades: 0, faltam: 0 };
  const list = atividades.filter((x) => x.turma === turma && x.liberada && !x.opcional && x.prazo && semanaDe(inicio, x.prazo) === sem && new Date(x.prazo).getTime() <= agora);
  const doAluno = (x, a) => !x.alvo || !x.alvo.length || x.alvo.includes(a);
  const faltam = alunos.filter((a) => list.some((x) => doAluno(x, a) && ((x.entregas || {})[a] || {}).estado !== 'prazo' && ((x.entregas || {})[a] || {}).estado !== 'dispensado')).length;
  const todas = atividades.filter((x) => x.turma === turma && x.liberada && !x.opcional && x.prazo && semanaDe(inicio, x.prazo) === sem);
  let total = 0, feitas = 0; for (const x of todas) for (const a of alunos) if (doAluno(x, a)) { const e = ((x.entregas || {})[a] || {}).estado; if (e === 'dispensado') continue; total++; if (e === 'prazo') feitas++; }
  return { sem, cumprida: !!est.missoes[String(sem)], atividades: list.length, faltam, vida: total ? Math.round((1 - feitas / total) * 100) : null };
}
function missao(est, turma, inicio, agora, alunos, atividades, fim) {
  if (emTregua(fim, agora) || !alunos.length) return false;
  const m = missaoInfo(est, turma, inicio, agora, alunos, atividades); if (m.cumprida || !m.atividades || m.faltam) return false;
  est.missoes[String(m.sem)] = { em: new Date(agora).toISOString() }; darItemATodos(est, alunos, m.sem, agora, 'missao');
  est.log.push({ em: new Date(agora).toISOString(), de: 'turma', item: 'missao', para: 'todos', txt: 'Missão cumprida: todos entregaram no prazo' });
  return true;
}
// Troféus sem pontos, só para dar graça. Janela: últimos 7 dias ("da semana") ou 30 ("do mês").
function trofeus(est, agora) {
  const out = [];
  for (const [per, dias] of [['semana', 7], ['mês', 30]]) {
    const ini = agora - dias * 864e5; const L = est.log.filter((l) => l.faixa && new Date(l.em).getTime() >= ini);
    const top = (arr, chave) => { const c = {}; for (const l of arr) c[chave(l)] = (c[chave(l)] || 0) + 1; const mx = Math.max(0, ...Object.values(c)); return mx ? { qtd: mx, quem: Object.keys(c).filter((k) => c[k] === mx).sort() } : null; };
    const rei = top(L.filter((l) => l.faixa === 'critico'), (l) => l.de), az = top(L.filter((l) => l.faixa === 'falha_critica'), (l) => l.de), esc = top(L.filter((l) => l.bloq && l.vit && l.vit !== l.de), (l) => l.vit);
    if (rei) out.push({ id: 'rei', ic: '👑', titulo: 'Rei do crítico', periodo: per, ...rei });
    if (az) out.push({ id: 'azarado', ic: '🍀', titulo: 'Azarado', periodo: per, ...az });
    if (esc) out.push({ id: 'escudo', ic: '🛡️', titulo: 'Escudo de ferro', periodo: per, ...esc });
  }
  return out;
}
// Texto pronto para o WhatsApp. Quem acerta um colega NÃO é citado (ninguém vê quem lançou); só as falhas, que são a graça, citam o nome.
function narracao(est, agora, nome, sem) {
  const ini = agora - 7 * 864e5, nm = (k) => (k === 'chefao' ? '👹 O Chefão' : nome ? nome(k) : '@' + k); const linhas = [];
  const ev = eventoDe(est, sem); if (ev) linhas.push(`${EVENTOS[ev].ic} ${EVENTOS[ev].nome}: ${EVENTOS[ev].txt}`);
  if (est.missoes[String(sem)]) linhas.push('🎯 Missão da turma cumprida: choveu item para todo mundo!');
  for (const l of est.log.filter((x) => x.faixa && new Date(x.em).getTime() >= ini)) {
    const dd = ITENS[l.item] || BOSS[l.item] || {}; const ic = dd.ic || '🎲', it = dd.nome || l.item;
    if (l.faixa === 'falha_critica') linhas.push(`🎲 ${nm(l.de)} tirou ${l.dado} com ${ic} ${it}` + (l.vit && l.vit !== l.de ? ` e acertou ${nm(l.vit)} sem querer 😅` : l.vit === l.de ? ' e acertou a si mesmo 😅' : ' e a coisa deu errado 😅'));
    else if (l.faixa === 'falha') linhas.push(`🎲 ${nm(l.de)} tirou ${l.dado} e errou o ${ic} ${it}`);
    else if (l.faixa === 'critico') linhas.push(l.vit && l.vit !== l.de ? `💥 Crítico! Alguém acertou ${nm(l.vit)} com ${ic} ${it} (dado ${l.dado})` : `💥 ${nm(l.de)} tirou ${l.dado} e mandou um ${ic} ${it} crítico!`);
    else if (l.bloq) linhas.push(`🛡️ ${nm(l.vit)} bloqueou um ${ic} ${it}`);
  }
  for (const t of trofeus(est, agora).filter((x) => x.periodo === 'semana')) linhas.push(`${t.ic} ${t.titulo}: ${t.quem.map(nm).join(', ')} (${t.qtd}x)`);
  return linhas.length ? ['🏆 Copa da Liga · resumo da semana', ...linhas].join('\n') : 'Semana tranquila na Copa: ainda não houve jogadas.';
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
module.exports = { BOSS, itemChefao, chefaoInfo, usarChefao, EVENTOS, eventoDe, definirEvento, missaoInfo, missao, trofeus, narracao, darItemATodos, TAB, MULT, faixaDe, setDado, chuvaProfessor, ITENS, CAP, DIAS_EFEITO, TREGUA_DIAS, emTregua, fimMs, roletar, VISIBILIDADES, estadoVazio, normalizar, semanaDe, ganhos, sortear, sincronizar, placar, usar, efeitosAtivos, limpar };
