'use strict';
// Copa da Liga: camada divertida por cima do ranking oficial. Itens ganhos por semana e usados contra colegas
// afetam SOMENTE os pontos da Copa. O ranking oficial, as notas e os certificados nunca são alterados aqui.
// Estado por turma em dados/copa/<TURMA>.json:
// { visibilidade:'oculta'|'propria'|'completa', ativa:bool, concedidos:{usuario:n}, inventario:{usuario:[{id,tipo,semana,em}]},
//   efeitos:[{id,tipo,de,para,delta,em,ate,bloqueado}], escudos:{usuario:forca 0.25|0.5|0.75}, usos:{usuario:{semana,ultimoAlvo}}, log:[...] }
const crypto = require('crypto');
const SEMANA_MS = 7 * 864e5;
const CAP = 3;                // itens guardados por aluno
const DIAS_EFEITO = 28;       // um ataque ou turbo dura 4 semanas, perdendo força a cada semana (100%, 75%, 50%, 25%)
const DURACAO_TXT = '4 semanas (vai diminuindo a cada semana)';
const ALIANCA_DIAS = 7, CASTIGO_TRAICAO_DIAS = 14, CONVITE_DIAS = 3;
const aliancaAtiva = (est, k, agora) => Object.values(est.aliancas || {}).find((a) => (a.a === k || a.b === k) && new Date(a.ate).getTime() > agora) || null;
const aliadoDe = (est, k, agora) => { const a = aliancaAtiva(est, k, agora); return a ? (a.a === k ? a.b : a.a) : null; };
// Efeito com aliança: perdas (ataques e falhas críticas) são divididas 50/50 com o aliado; ganhos dão +50% do valor também ao aliado.
function aplicaEfeito(est, ef, agora) {
  const al = ef.bloqueado || ef.rateio || !ef.delta ? null : aliadoDe(est, ef.para, agora);
  if (!al) { est.efeitos.push(ef); return; }
  const metade = Math.round(ef.delta / 2 * 100) / 100;
  est.efeitos.push(ef.delta < 0 ? { ...ef, delta: metade } : ef);
  est.efeitos.push({ ...ef, id: ef.id + 'r', para: al, delta: metade, rateio: true });
}
const fatorEfeito = (e, agora) => { const sem = Math.floor((agora - new Date(e.em).getTime()) / SEMANA_MS); return sem <= 0 ? 1 : sem >= 4 ? 0 : 1 - 0.25 * sem; };
const TREGUA_DIAS = 2;        // nos últimos 2 dias da turma nada vale: a Copa final é só o ranking oficial
const ATAQUES_DIA = 2;        // máximo de ataques que um mesmo aluno recebe por dia
const VISIBILIDADES = ['oculta', 'propria', 'completa'];
const ITENS = {
  turbo: { ic: '🍄', nome: 'Turbo', alvo: 'si', delta: 2, peso: 3, txt: 'Você ganha +2 pontos na Copa por 4 semanas (vai diminuindo a cada semana).' },
  escudo: { ic: '🛡️', nome: 'Escudo', alvo: 'si', delta: 0, peso: 2, txt: 'Reduz o próximo ataque que você receber. Seu dado decide a força base (fraco 25%, normal 50%, crítico 75%) e o dado de quem atacou ajusta: golpe fraco é reduzido mais, golpe crítico passa mais. Só 1 escudo por vez: quem já tem escudo ganha outro item.' },
  chuva: { ic: '🌧️', nome: 'Chuva de itens', alvo: 'todos', delta: 0, peso: 1, txt: 'Dá 1 item sorteado a cada colega perto de você no ranking (2 acima e 2 abaixo).' },
  roleta: { ic: '🎰', nome: 'Roleta maluca', alvo: 'auto', delta: -2, peso: 1, txt: 'Cai sozinha em quem tirou: -2 pontos na Copa por 4 semanas (vai diminuindo); o escudo, se houver, reduz o golpe.' },
  banana: { ic: '🍌', nome: 'Banana', alvo: 'outro', delta: -4, peso: 4, txt: 'O colega perde 4 pontos na Copa por 4 semanas (vai diminuindo) e você ROUBA 25% disso.' },
  casco: { ic: '🐢', nome: 'Casco', alvo: 'outro', delta: -7, peso: 2, soFrente: true, txt: 'Acerta só quem está à sua frente: perde 7 pontos na Copa por 4 semanas (vai diminuindo) e você ROUBA 25% disso.' },
};
// Tabela do d10 por item: [máx. falha crítica, máx. falha, máx. fraco, máx. normal]; acima disso (10) é crítico.
const TAB = { turbo: [1, 3, 6, 9], escudo: [1, 3, 5, 9], chuva: [1, 3, 6, 9], banana: [1, 3, 5, 9], casco: [1, 4, 7, 9] };
// 👹 Chefão da Liga: owners e professores não estão no ranking, então jogam como o "inimigo de todos". 1 item por semana, só mexe nos pontos da Copa.
const BOSS = {
  trovao: { ic: '⚡', nome: 'Trovão do Chefão', delta: -4, alvo: 'lider', txt: 'Cai no líder da Copa: -4 pontos na Copa por 4 semanas (vai diminuindo a cada semana).' },
  maldicao: { ic: '🧙', nome: 'Maldição', delta: -3, alvo: 'outro', txt: 'Um aluno escolhido perde 3 pontos na Copa por 4 semanas (vai diminuindo a cada semana).' },
  bencao: { ic: '🎁', nome: 'Bênção do Chefão', delta: 3, alvo: 'outro', txt: 'Um aluno escolhido ganha 3 pontos na Copa por 4 semanas (vai diminuindo a cada semana).' },
};
Object.assign(TAB, { trovao: [1, 3, 6, 9], maldicao: [1, 3, 5, 9], bencao: [1, 2, 4, 9] });
const itemChefao = (quem, sem) => { const k = Object.keys(BOSS); return k[crypto.createHash('sha1').update(`chefao|${quem}|${sem}`).digest().readUInt32BE(0) % k.length]; };
const MULT = { fraco: 0.5, normal: 1, critico: 1.5 };
const FAIXA_TXT = { falha_critica: 'falha crítica', falha: 'falha', fraco: 'efeito fraco', normal: 'efeito normal', critico: 'crítico' };
const meio = (n) => Math.round(n * 2) / 2;
// Escudo: não bloqueia 100%, reduz o golpe conforme os dados (força do escudo 25/50/75% e nível do dado do atacante). Só um por vez.
const FORCA_ESCUDO = { fraco: 0.25, normal: 0.5, critico: 0.75 };
const forcaEscudo = (est, k) => { const v = est.escudos[k]; return !v ? 0 : v === true ? 0.5 : Number(v) || 0.5; };
const temEscudo = (est, k) => !!est.escudos[k] || (est.inventario[k] || []).some((x) => x.tipo === 'escudo');
// Quem já tem escudo (ativo ou guardado) recebe outro item no lugar, até ficar sem.
const trocaEscudo = (est, k, tipo, h) => { if (tipo !== 'escudo' || !temEscudo(est, k)) return tipo; const alt = Object.keys(ITENS).filter((x) => ITENS[x].alvo !== 'auto' && x !== 'chuva' && x !== 'escudo'); return alt[h % alt.length]; };
// Aplica o escudo a um golpe negativo: devolve o valor final e a fração reduzida (golpe positivo não gasta escudo).
// A redução final = força do escudo (dado de quem ativou) ajustada pelo dado de quem atacou: golpe fraco é reduzido mais, golpe crítico passa mais.
const AJUSTE_ATAQUE = { falha_critica: 0.25, fraco: 0.25, normal: 0, critico: -0.25 };
function absorver(est, k, delta, faixaAtaque) {
  if (!(delta < 0) || !est.escudos[k]) return { delta, red: 0 };
  const f = Math.min(0.9, Math.max(0.1, forcaEscudo(est, k) + (AJUSTE_ATAQUE[faixaAtaque] || 0))); delete est.escudos[k];
  return { delta: meio(delta * (1 - f)), red: f };
}
const redTxt = (red) => (red ? ' 🛡️ O escudo reduziu o golpe em ' + Math.round(red * 100) + '%.' : '');
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
const estadoVazio = () => ({ visibilidade: 'oculta', ativa: false, concedidos: {}, inventario: {}, efeitos: [], escudos: {}, usos: {}, azar: {}, eventos: {}, missoes: {}, chefes: {}, aliancas: {}, convites: [], traidores: {}, log: [] });
function normalizar(e) {
  const b = estadoVazio(), x = e && typeof e === 'object' ? e : {};
  return { ...b, ...x, visibilidade: VISIBILIDADES.includes(x.visibilidade) ? x.visibilidade : 'oculta', ativa: !!x.ativa,
    concedidos: x.concedidos || {}, inventario: x.inventario || {}, efeitos: Array.isArray(x.efeitos) ? x.efeitos : [], escudos: x.escudos || {}, usos: x.usos || {}, azar: x.azar || {}, eventos: x.eventos || {}, missoes: x.missoes || {}, chefes: x.chefes || {}, aliancas: x.aliancas && typeof x.aliancas === 'object' ? x.aliancas : {}, convites: Array.isArray(x.convites) ? x.convites : [], traidores: x.traidores && typeof x.traidores === 'object' ? x.traidores : {}, log: Array.isArray(x.log) ? x.log.map((l) => (l && l.txt === 'caiu em quem tirou' ? { ...l, txt: 'tirou a Roleta maluca no sorteio de itens e ela caiu nele mesmo: -2 pontos na Copa por 4 semanas (vai diminuindo a cada semana)' } : l)) : [] };
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
    { // só 1 escudo por vez: escudos repetidos guardados viram outro item (e, com escudo ativo, nenhum fica guardado)
      let tem = !!est.escudos[a];
      for (const it of est.inventario[a]) { if (it.tipo !== 'escudo') continue; if (!tem) { tem = true; continue; } const h = crypto.createHash('sha1').update(String(it.id)).digest().readUInt32BE(0); const alt = Object.keys(ITENS).filter((x) => ITENS[x].alvo !== 'auto' && x !== 'chuva' && x !== 'escudo'); it.tipo = alt[h % alt.length]; mudou = true; }
    }
    let n = est.concedidos[a] || 0; const passado = ganhos(a, turma, inicio, agora, sessoes, atividades, resumoSessao, sem - 1);
    if (n < passado) { n = passado; mudou = true; } // o que não foi concedido em semanas passadas se perde
    const direito = ganhos(a, turma, inicio, agora, sessoes, atividades, resumoSessao, sem);
    while (n < direito && sem > 0 && !tregua) {
      const tipo = trocaEscudo(est, a, sortear(turma, a, n), n), id = crypto.createHash('sha1').update(`${turma}|${a}|${n}`).digest('hex').slice(0, 8), em = new Date(agora).toISOString();
      if (tipo === 'roleta') { roletar(est, a, id, em, agora); } else if (est.inventario[a].length < CAP) est.inventario[a].push({ id, tipo, semana: sem, em }); else break;
      n++; mudou = true;
    }
    if (n !== (est.concedidos[a] || 0)) { est.concedidos[a] = n; mudou = true; }
  }
  if (missao(est, turma, inicio, agora, alunos, atividades, fim)) mudou = true;
  return mudou;
}
// A roleta maluca cai sozinha em quem tirou (baixa incidência). O escudo reduz o golpe.
function roletar(est, a, id, em, agora) {
  const ab = absorver(est, a, ITENS.roleta.delta);
  if (ab.red && ab.delta === 0) { est.log.push({ em, de: 'roleta', item: 'roleta', para: a, txt: 'bloqueada pelo escudo' }); return; }
  aplicaEfeito(est, { id, tipo: 'roleta', de: 'roleta', para: a, delta: ab.delta, em, ate: new Date(agora + DIAS_EFEITO * 864e5).toISOString() }, agora);
  est.log.push({ em, de: 'roleta', item: 'roleta', para: a, txt: 'tirou a Roleta maluca no sorteio de itens e ela caiu nele mesmo: ' + ab.delta + ' pontos na Copa por 4 semanas (vai diminuindo a cada semana)' + (ab.red ? '; o escudo reduziu o golpe em ' + Math.round(ab.red * 100) + '%' : '') });
}
const ativo = (e, agora) => new Date(e.ate).getTime() > agora;
function efeitosAtivos(est, agora, fim) { return emTregua(fim, agora) ? [] : est.efeitos.filter((e) => !e.bloqueado && ativo(e, agora)); }
// Pontos da Copa = pontos oficiais + efeitos ativos (nunca abaixo de zero). 'rank' é o ranking oficial da turma.
function placar(est, rank, agora, fim) {
  const delta = {}; for (const e of efeitosAtivos(est, agora, fim)) delta[e.para] = Math.round(((delta[e.para] || 0) + e.delta * fatorEfeito(e, agora)) * 100) / 100;
  const linhas = rank.map((x) => ({ usuario: x.usuario, oficial: x.total, posOficial: x.posicao, copa: Math.max(0, Math.round((x.total + (delta[x.usuario] || 0)) * 10) / 10), efeito: delta[x.usuario] || 0, escudo: !!est.escudos[x.usuario] }));
  linhas.sort((a, b) => b.copa - a.copa || a.posOficial - b.posOficial || a.usuario.localeCompare(b.usuario));
  linhas.forEach((l, i) => { l.posCopa = i + 1; });
  return linhas;
}
// Usa um item. Devolve { erro } ou { ok, resultado, est } (altera est). Regras para ninguém ser perseguido.
function usar(est, quem, itemId, alvo, rank, inicio, agora, fim, opts) {
  const trair = !!(opts && opts.trair);
  const inv = est.inventario[quem] || []; const i = inv.findIndex((x) => x.id === itemId);
  if (i < 0) return { erro: 'Você não tem esse item.' };
  const tipo = inv[i].tipo, def = ITENS[tipo]; if (!def) return { erro: 'Item desconhecido.' };
  const sem = semanaDe(inicio, agora); const uso = est.usos[quem] || {};
  if (emTregua(fim, agora)) return { erro: 'Trégua final: nos últimos dias da turma os itens ficam guardados e a Copa vale só o ranking oficial.' };
  if (def.alvo === 'auto') return { erro: 'Esse item cai sozinho, não dá para usar.' };
  if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (inv[i].semana !== sem) return { erro: 'Esse item venceu: itens valem só na semana em que foram ganhos.' };
  if (uso.semana === sem && !inv[i].bonus) return { erro: 'Você já usou um item nesta semana. Na próxima você pode usar outro.' };
  if (tipo === 'escudo' && est.escudos[quem]) return { erro: '🛡️ Você já está com um escudo ativo. Só dá para ter um por vez: espere ele segurar um golpe.' };
  const meu = rank.find((x) => x.usuario === quem); if (!meu) return { erro: 'Você não está no ranking desta turma.' };
  const desde = new Date(agora).toISOString(), ate = new Date(Math.min(agora + DIAS_EFEITO * 864e5, fimMs(fim) - TREGUA_DIAS * 864e5)).toISOString();
  const bonus = !!inv[i].bonus; const consome = () => { inv.splice(i, 1); if (!bonus) est.usos[quem] = { semana: sem, ultimoAlvo: uso.ultimoAlvo || '' }; };
  const reg = (txt) => { est.log.push({ em: desde, de: quem, item: tipo, para: alvo || quem, txt }); if (est.log.length > 300) est.log.splice(0, est.log.length - 300); };
  // Dado d10: o aluno não escolhe nada, o servidor rola. A tabela depende do item (quanto mais forte, mais arriscado).
  const ev = eventoDe(est, sem);
  const rolagem = () => { let r = rolar(); if (ev === 'dado_dobro') r = Math.max(r, rolar()); if (trair) r = Math.max(1, r - 2); return { r, faixa: faixaDe(tipo, r) }; };
  const dadoTxt = (d) => '🎲 Tirou ' + d.r + ' (' + FAIXA_TXT[d.faixa] + '). ';
  const efeito = (para, delta, t) => aplicaEfeito(est, { id: crypto.randomBytes(4).toString('hex'), tipo: t || tipo, de: quem, para, delta, em: desde, ate }, agora);
  const aliado = aliadoDe(est, quem, agora);
  const bonusItem = (para, k) => { const perm = Object.keys(ITENS).filter((x) => ITENS[x].alvo !== 'auto' && x !== 'chuva'); (est.inventario[para] = est.inventario[para] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: trocaEscudo(est, para, perm[k % perm.length], k), semana: sem, em: desde, bonus: true }); };
  // Consolo: 3 falhas críticas seguidas dão um escudo de presente (ou um Turbo, se já tiver escudo).
  const azar = (d) => { est.azar = est.azar || {}; if (d.faixa === 'falha_critica') { est.azar[quem] = (est.azar[quem] || 0) + 1; if (est.azar[quem] >= 3) { est.azar[quem] = 0; (est.inventario[quem] = est.inventario[quem] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: temEscudo(est, quem) ? 'turbo' : 'escudo', semana: sem, em: desde, bonus: true }); return ' 🍀 Três azares seguidos: você ganhou um item de consolo.'; } } else est.azar[quem] = 0; return ''; };
  const fim_ = (d, txt, extra, mais) => { reg(txt + ' [d10=' + d.r + ']'); Object.assign(est.log[est.log.length - 1], { faixa: d.faixa, dado: d.r, alvo: alvo || quem }, mais || {}, trair ? { traicao: true } : {}); return { ok: true, faixa: d.faixa, dado: d.r, resultado: dadoTxt(d) + txt + (extra || '') }; };
  if (def.alvo === 'si') {
    const d = rolagem(); consome(); const cz = azar(d);
    if (tipo === 'escudo') {
      if (d.faixa === 'falha_critica') { efeito(quem, -1, 'azar'); return fim_(d, 'O escudo estourou na sua mão: -1 ponto na Copa por ' + DURACAO_TXT + '.', cz); }
      if (d.faixa === 'falha') return fim_(d, 'O escudo não abriu. O item foi gasto.', cz);
      const forca = FORCA_ESCUDO[d.faixa] || 0.5; est.escudos[quem] = forca;
      if (d.faixa === 'critico') bonusItem(quem, d.r + sem);
      return fim_(d, 'Escudo ativado (' + (d.faixa === 'fraco' ? 'fraco' : d.faixa === 'critico' ? 'reforçado' : 'normal') + '): ele reduz em ' + Math.round(forca * 100) + '% o próximo ataque que você receber.' + (d.faixa === 'critico' ? ' Crítico! Você ganhou também um item extra.' : ''), cz);
    }
    if (d.faixa === 'falha_critica') { efeito(quem, -2, 'azar'); return fim_(d, 'O Turbo engasgou: -2 pontos na Copa por ' + DURACAO_TXT + '.', cz); }
    if (d.faixa === 'falha') return fim_(d, 'O Turbo não pegou. O item foi gasto.', cz);
    const v = meio(def.delta * MULT[d.faixa]); efeito(quem, v, 'turbo'); return fim_(d, 'Turbo ligado: +' + v + ' pontos na Copa por ' + DURACAO_TXT + '.', cz);
  }
  if (def.alvo === 'todos') {
    const pl = placar(est, rank, agora, fim), pos = pl.findIndex((x) => x.usuario === quem); const viz = pl.filter((x, k) => k !== pos && Math.abs(k - pos) <= 2);
    if (!viz.length) return { erro: 'Não há colegas perto de você.' };
    const d = rolagem(); consome(); const cz = azar(d);
    if (d.faixa === 'falha_critica') { efeito(quem, -2, 'azar'); return fim_(d, 'A chuva virou tempestade em cima de você: -2 pontos na Copa por ' + DURACAO_TXT + '.', cz); }
    if (d.faixa === 'falha') return fim_(d, 'Não choveu nada. O item foi gasto.', cz);
    const alvos = d.faixa === 'fraco' ? viz.slice(0, Math.max(1, Math.ceil(viz.length / 2))) : viz;
    alvos.forEach((v, k) => bonusItem(v.usuario, rolar() + k));
    if (d.faixa === 'critico') bonusItem(quem, d.r + sem);
    return fim_(d, '🌧️ Choveu item! ' + alvos.length + ' colega(s) perto de você ganharam um item extra.' + (d.faixa === 'critico' ? ' Crítico! Sobrou um para você também.' : ''), cz);
  }
  if (ev === 'paz') return { erro: '🕊️ Semana da paz: ataques estão bloqueados. Use um item de ajuda ou espere a próxima semana.' };
  const ultimoLugar = (k) => rank.length >= 4 && (rank.find((x) => x.usuario === k) || {}).posicao === Math.max(...rank.map((x) => x.posicao));
  const inicioDia = agora - 864e5; const recebeuHoje = (k) => est.efeitos.filter((e) => e.para === k && e.de !== k && !e.rateio && new Date(e.em).getTime() > inicioDia).length >= ATAQUES_DIA;
  if (alvo === '__eu') alvo = quem; // a própria pessoa é sempre uma opção, mesmo que se prejudique
  if (alvo === '__sorteio') { // o aluno não quer escolher: o sistema sorteia entre todos, inclusive você
    const cand = rank.filter((x) => x.usuario === quem || x.usuario !== uso.ultimoAlvo && x.usuario !== aliado && !ultimoLugar(x.usuario) && !recebeuHoje(x.usuario) && (!def.soFrente || x.posicao < meu.posicao));
    if (!cand.length) return { erro: 'Ninguém pode ser atingido agora (todos protegidos ou fora do alcance). Tente outro dia.' };
    alvo = cand[(rolar() - 1 + sem) % cand.length].usuario;
  }
  const alvoL = rank.find((x) => x.usuario === alvo); if (!alvoL) return { erro: 'Escolha um colega da turma.' };
  const eu = alvo === quem;
  if (!eu && alvo === aliado && !trair) return { erro: '🤝 Esse colega é seu aliado. Para atacá-lo é preciso trair (quebra a aliança e você fica 2 semanas sem aliar).' };
  if (trair && alvo !== aliado) return { erro: 'Só dá para trair o seu aliado.' };
  if (!eu && uso.ultimoAlvo === alvo) return { erro: 'Escolha outro colega: você não pode atacar a mesma pessoa duas vezes seguidas.' };
  if (!eu && ultimoLugar(alvo)) return { erro: 'Quem está em último lugar está protegido (semana de graça).' };
  if (!eu && def.soFrente && !(alvoL.posicao < meu.posicao)) return { erro: 'O casco só acerta quem está à sua frente no ranking.' };
  if (!eu && recebeuHoje(alvo)) return { erro: 'Essa pessoa já recebeu um ataque hoje. Tente outro colega ou outro dia.' };
  const d = rolagem(); consome(); const cz = azar(d);
  if (trair) { const al = aliancaAtiva(est, quem, agora); if (al) delete est.aliancas[al.id]; est.traidores[quem] = new Date(agora + CASTIGO_TRAICAO_DIAS * 864e5).toISOString(); est.log.push({ em: desde, de: quem, item: 'alianca', para: alvo, evento: 'traicao', txt: 'aliança quebrada por traição' }); }
  const acertar = (vitima, delta, faixaAtq) => { // o escudo reduz o golpe (não bloqueia 100%); só bloqueia de vez se o valor chegar a zero
    const ab = absorver(est, vitima, delta, faixaAtq || d.faixa);
    if (ab.red && ab.delta === 0) { est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: quem, para: vitima, delta: 0, em: desde, ate: desde, bloqueado: true }); return { ok: false, delta: 0, red: ab.red }; }
    efeito(vitima, ab.delta); return { ok: true, delta: ab.delta, red: ab.red };
  };
  if (d.faixa === 'falha') return fim_(d, 'Errou o alvo: nada aconteceu. O item foi gasto.', cz);
  if (d.faixa === 'falha_critica') {
    // 50%: acerta você mesmo; 50%: cai em outro colega sorteado (nunca o alvo, o último lugar ou quem já levou ataque hoje).
    const cand = rank.filter((x) => x.usuario !== quem && x.usuario !== alvo && x.usuario !== aliado && !ultimoLugar(x.usuario) && !recebeuHoje(x.usuario) && (!def.soFrente || x.posicao < meu.posicao));
    const aSi = rolar() <= 5 || !cand.length; const vit = aSi ? quem : cand[(rolar() - 1) % cand.length].usuario;
    const ac = acertar(vit, def.delta), bateu = ac.ok; const pena = !aSi || !bateu; if (pena) efeito(quem, -2, 'azar'); // falha crítica sempre custa caro: ou o item volta em você, ou você perde 2 pontos
    return fim_(d, aSi ? (bateu ? 'FALHA CRÍTICA! ' + def.ic + ' voltou e acertou você mesmo: ' + ac.delta + ' pontos na Copa por ' + DURACAO_TXT + '.' + redTxt(ac.red) : 'FALHA CRÍTICA! O item voltou, mas seu escudo segurou. Mesmo assim você perde 2 pontos pelo vexame (' + DURACAO_TXT + ').') : 'FALHA CRÍTICA! ' + def.ic + ' errou o alvo e acertou outro colega sorteado. Você perde 2 pontos pelo vexame (' + DURACAO_TXT + ').', cz, { vit, bloq: !bateu, red: ac.red, dano: ac.delta });
  }
  est.usos[quem] = { semana: (est.usos[quem] || {}).semana, ultimoAlvo: eu ? uso.ultimoAlvo : alvo };
  const v = meio(def.delta * MULT[d.faixa] * (trair ? 2 : 1));
  if (eu) { const ac = acertar(quem, v), b = ac.ok; return fim_(d, b ? def.ic + ' Você acertou você mesmo: perde ' + Math.abs(ac.delta) + ' pontos na Copa por ' + DURACAO_TXT + '.' + redTxt(ac.red) : 'Você mirou em si mesmo, mas seu escudo segurou.', cz, { vit: quem, bloq: !b, red: ac.red, dano: ac.delta }); }
  const ac = acertar(alvo, v);
  if (!ac.ok) return { ...fim_(d, 'O colega estava com escudo e o golpe foi todo absorvido.', cz, { vit: alvo, bloq: true, red: ac.red, dano: ac.delta }), bloqueado: true };
  const roubo = ac.delta < 0 ? Math.round(Math.abs(ac.delta) * 0.25 * 2) / 2 : 0; if (roubo > 0) aplicaEfeito(est, { id: crypto.randomBytes(4).toString('hex'), tipo: 'roubo', de: quem, para: quem, delta: roubo, em: desde, ate }, agora);
  return fim_(d, (trair ? '💔 TRAIÇÃO! ' : '') + def.ic + ' Acertou! O colega perde ' + Math.abs(ac.delta) + ' pontos na Copa por ' + DURACAO_TXT + '.' + redTxt(ac.red) + (roubo ? ' Você roubou +' + roubo + '.' : '') + (d.faixa === 'critico' ? ' Crítico!' : d.faixa === 'fraco' ? ' (acerto fraco)' : ''), cz, { vit: alvo, red: ac.red, dano: ac.delta });
}
// Chefão: dono/professor joga sem estar no ranking. Mesmas proteções dos alunos (escudo, último lugar, 1 efeito negativo por dia, trégua, paz) e o mesmo d10.
function chefaoInfo(est, quem, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora); const tipo = sem >= 1 ? itemChefao(quem, sem) : null; const uso = (est.chefes || {})[quem] || {};
  return { semana: sem, tipo, def: tipo ? BOSS[tipo] : null, usado: uso.semana === sem, tregua: emTregua(fim, agora) };
}
function usarChefao(est, quem, alvo, rank, inicio, agora, fim, aleatorio) {
  const inf = chefaoInfo(est, quem, inicio, agora, fim); const sem = inf.semana;
  if (inf.tregua) return { erro: 'Trégua final: o Chefão descansa até o fim da turma.' };
  if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (inf.usado) return { erro: 'O Chefão já agiu nesta semana. Na próxima vem outro item.' };
  const ev = eventoDe(est, sem); const def = inf.def, tipo = inf.tipo;
  if (ev === 'paz' && def.delta < 0) return { erro: '🕊️ Semana da paz: ataques estão bloqueados, até os do Chefão.' };
  const pl = placar(est, rank, agora, fim); if (!pl.length) return { erro: 'Não há alunos no ranking.' };
  const ultimo = (k) => rank.length >= 4 && (rank.find((x) => x.usuario === k) || {}).posicao === Math.max(...rank.map((x) => x.posicao));
  const inicioDia = agora - 864e5; const recebeuHoje = (k) => est.efeitos.some((e) => e.para === k && e.delta < 0 && e.de !== k && !e.rateio && new Date(e.em).getTime() > inicioDia);
  if ((aleatorio || alvo === '__sorteio') && def.alvo !== 'lider') { // monitores não escolhem: o alvo é sorteado entre quem pode ser atingido
    const cand = rank.filter((x) => !(def.delta < 0 && (ultimo(x.usuario) || recebeuHoje(x.usuario))));
    if (!cand.length) return { erro: 'Ninguém pode ser atingido agora (todos protegidos). Tente outro dia.' };
    alvo = cand[(rolar() - 1 + sem) % cand.length].usuario;
  }
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
    const ab = absorver(est, k, delta, faixa);
    if (ab.red && ab.delta === 0) { est.efeitos.push({ id: crypto.randomBytes(4).toString('hex'), tipo, de: 'chefao', para: k, delta: 0, em: desde, ate: desde, bloqueado: true }); return { ok: false, delta: 0, red: ab.red }; }
    aplicaEfeito(est, { id: crypto.randomBytes(4).toString('hex'), tipo, de: 'chefao', para: k, delta: ab.delta, em: desde, ate }, agora); return { ok: true, delta: ab.delta, red: ab.red };
  };
  if (faixa === 'falha') { reg('O Chefão errou o golpe'); return { ok: true, faixa, dado: r, resultado: pre + 'O golpe errou. O item foi gasto.' }; }
  if (faixa === 'falha_critica') {
    if (def.alvo === 'lider') { const k = rank[(r + sem) % rank.length].usuario; darItemATodos(est, [k], sem, agora, 'tesouro'); reg('O Chefão tropeçou e deixou cair um tesouro', { vit: k }); return { ok: true, faixa, dado: r, resultado: pre + 'FALHA CRÍTICA! O Chefão tropeçou e deixou cair um tesouro: um aluno sorteado ganhou um item extra.' }; }
    const inverso = -def.delta; const ap = aplica(alvoK, inverso), b = ap.ok; reg('A magia do Chefão virou ao contrário', { vit: alvoK, bloq: !b, red: ap.red, dano: ap.delta });
    return { ok: true, faixa, dado: r, resultado: pre + 'FALHA CRÍTICA! A magia virou ao contrário: ' + (inverso > 0 ? 'o aluno ganhou +' + inverso : 'o aluno perdeu ' + Math.abs(ap.delta)) + ' pontos na Copa.' + redTxt(ap.red) };
  }
  const v = meio(def.delta * MULT[faixa]); const ap = aplica(alvoK, v), bateu = ap.ok;
  reg(bateu ? 'acertou' : 'bloqueado pelo escudo', { vit: alvoK, bloq: !bateu, red: ap.red, dano: ap.delta });
  return { ok: true, faixa, dado: r, bloqueado: !bateu, resultado: pre + (bateu ? def.ic + ' ' + def.nome + (v > 0 ? ': o aluno ganha +' + v : ': o aluno perde ' + Math.abs(ap.delta)) + ' pontos na Copa por ' + DURACAO_TXT + '.' + redTxt(ap.red) + (faixa === 'critico' ? ' Crítico!' : faixa === 'fraco' ? ' (efeito fraco)' : '') : 'O aluno estava com escudo e o golpe foi todo absorvido.') };
}
// Item bônus (vale até o fim da semana) para cada aluno da lista.
function darItemATodos(est, alunos, sem, agora, tag) {
  const perm = Object.keys(ITENS).filter((k) => ITENS[k].alvo !== 'auto' && k !== 'chuva'), em = new Date(agora).toISOString();
  for (const a of alunos) { const hh = crypto.createHash('sha1').update(`${tag}|${a}|${sem}`).digest().readUInt32BE(0); (est.inventario[a] = est.inventario[a] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: trocaEscudo(est, a, perm[hh % perm.length], hh), semana: sem, em, bonus: true }); }
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
// O narrador tem personagem: exagerado, torcedor, dramático e fofoqueiro. Cada tipo de lance tem 8+ frases; dentro de um mesmo texto
// a frase nunca se repete antes de acabar a lista, e a ordem muda a cada semana/dia. opts.horas = 24 gera o boletim do dia.
const FRASES = {
  alianca: ['🤝 Nova aliança na pista: {A} e {B} juntaram forças! Será amor ou interesse? 👀', '🤝 {A} + {B}: a dupla da semana está formada! Quem se atreve a mexer com eles?', '🫱🫲 {A} e {B} apertaram as mãos. Eu só pergunto: até quando? Aposto que não passa de quinta. 🍿', '💍 {A} e {B} anunciaram aliança! Já podem escolher o nome do casal. #Time{A}{B}', '🦸 Nasceu uma dupla de heróis: {A} e {B}! Ou de vilões. O tempo dirá. 😈', '📜 Pacto selado entre {A} e {B}. Cláusula secreta: quem trair vira meme. 🐍', '🤜🤛 {A} e {B} agora dividem tudo: pontos, glória e, claro, a culpa!', '🛡️ Atenção, pista: {A} e {B} entraram em aliança. Mexeu com um, mexeu com... metade do outro! 😅'],
  traicao: ['💔😱 TRAIÇÃO!!! Uma aliança acabou em golpe pelas costas... eu vi, a torcida viu, e ninguém vai esquecer! 🗡️', '🗡️💔 TRAIÇÃO na pista! Alguém jogou limpo demais... até não jogar mais! Que novela!', '🐍 TRAIÇÃO! Tem cobra na pista! Uma aliança desabou com uma facada nas costas. Mandem lenços e pipoca. 🍿😭', '🎭 PLOT TWIST: TRAIÇÃO! O "confia em mim" durou menos que um commit sem mensagem!', '😱 TRAIÇÃO confirmada! O aperto de mão foi só pra pegar a mira. Cinema puro! 🎬', '🔪 TRAIÇÃO!!! Quem tem aliado assim nem precisa de Chefão. Nota 10 pra frieza, nota 0 pra amizade!', '📢 URGENTE: TRAIÇÃO na pista! A aliança acabou e a pizza do rolê que ia rolar também. 🍕💔'],
  falhaCritOutro: ['😱 DESASTRE! {de} tirou {d}... e o {ic} {it} acertou {vit} sem querer! Que mira, hein? Treina mais no simulador! 🎯', '🙈 Oh, não! {de} tirou {d}... e o {ic} {it} foi parar em {vit}! Pede desculpa aí!', '🤡 {de} tirou {d} e o {ic} {it} escolheu outro destino: {vit}! O dado ri da cara de todo mundo!', '📣 ATENÇÃO: {de} tirou {d} e mandou o {ic} {it} pro lugar errado ({vit})! A torcida quer explicação! 🎤', '🎯 Era pra ser um golpe perfeito. {de} tirou {d} e o {ic} {it} acertou {vit}. Não foi dessa vez, campeão!', '🚑 {de} tirou {d}. O {ic} {it} entrou em pânico, fez a curva errada e atingiu {vit}. Chamem o resgate!', '🧠 Cálculo perfeito: {de} tirou {d} e o {ic} {it} atingiu {vit}. Estratégia ousada ou só falta de café? ☕', '🌀 O universo olhou pro {d} de {de} e disse "hoje não": o {ic} {it} foi parar em {vit}! 😂', '🎲 {de} tirou {d}! O {ic} {it} se confundiu, perdeu o mapa e bateu em {vit}. O dado tem senso de humor!'],
  falhaCritSi: ['🤦 PLOT TWIST! {de} tirou {d} e acertou o {ic} {it} em si mesmo! Fogo amigo nível máximo 😅', '🙃 {de} tirou {d} e jogou o {ic} {it} em si mesmo! Atirou no pé e ainda comemorou o gol! ⚽', '🤣 Gente, {de} tirou {d} e o {ic} {it} bateu e voltou: acertou em si mesmo! Nem o Chefão faria melhor!', '🪃 {de} tirou {d}: o {ic} {it} virou bumerangue e acertou em si mesmo! Tá certo, né?', '🤡 {de} tirou {d} e se atingiu com o próprio {ic} {it}, em si mesmo! Alguém avisa que o adversário é o outro!', '🔄 Efeito rebote! {de} tirou {d} e levou o {ic} {it} na testa, em si mesmo. Isso é o que chamam de auto-sabotagem!', '😵 {de} tirou {d}... e o {ic} {it} fez meia-volta e acertou em si mesmo! Ele nem entendeu o que houve!', '💀 {de} tirou {d}. O {ic} {it} acertou em si mesmo. A torcida chora de rir, o dado nem pisca!'],
  falhaCritVazio: ['😅 {de} tirou {d} e o {ic} {it} deu totalmente errado. A torcida ficou em silêncio...', '🦗 *grilos* {de} tirou {d} e o {ic} {it} sumiu no vazio. Ninguém sabe onde foi parar.', '🫥 {de} tirou {d}. O {ic} {it} nem saiu do lugar. Nem o VAR entendeu.', '🕳️ {de} tirou {d}: o {ic} {it} caiu num buraco negro. Pedimos um minuto de silêncio. 🙏', '📉 {de} tirou {d} e o {ic} {it} virou pó. Mande o pêsames para o seu próprio dado!', '🥶 {de} tirou {d}. O {ic} {it} congelou, rachou e quebrou. Tem gente que nasceu pra outra coisa...', '🧊 O {ic} {it} de {de} (dado {d}) travou como o Wi-Fi do laboratório. Boa sorte na próxima!', '🪦 Aqui jaz o {ic} {it} de {de}. Nasceu com {d} e morreu sem acertar nada.'],
  falha: ['🎲 Ihhh! {de} tirou {d} e o {ic} {it} passou longe!', '💨 {de} rolou {d}: o {ic} {it} errou o alvo por pouco! Vento contra?', '🫠 {de} rolou {d} e o {ic} {it} foi pra outro CEP! Mandem GPS pro rapaz!', '🪁 O {ic} {it} de {de} (dado {d}) voou, voou... e não acertou nada! Bonito de ver, inútil de pontuar.', '🎯 {de} mirou, respirou, jogou e tirou {d}. O {ic} {it} acertou o... ar. Muito bem! 👏', '🐌 O {ic} {it} de {de} (dado {d}) ficou no meio do caminho. Cansou, sentou e desistiu.', '🧐 {de} tirou {d}. O {ic} {it} quase, quase, quase... não! Quase só vale no pênalti!', '😬 Com {d} no dado, o {ic} {it} de {de} resolveu fazer um tour pela pista sem acertar ninguém!', '🤷 {de} jogou o {ic} {it} (dado {d}) e ele errou tão feio que o alvo nem ficou sabendo!'],
  critVitima: ['💥🔥 CRÍTICO!!! Alguém mandou um {ic} {it} em {vit} com dado {d}! Que pancada, minha gente!', '⚡ BOOOM! {vit} foi atingido por um {ic} {it} CRÍTICO (dado {d})! A pista tremeu e o mistério continua: quem foi? 🕵️', '🚨 CRÍTICO NA ÁREA! {vit} levou um {ic} {it} de {d} e ainda está procurando o culpado. Desconfie de todos, inclusive do colega do lado! 👀', '😭 {vit} acordou, abriu o grupo e viu: {ic} {it} CRÍTICO (dado {d}). Foi pessoal? Ninguém sabe! (Eu sei, mas não conto.) 🤫', '☄️ Um {ic} {it} CRÍTICO (dado {d}) caiu do céu em {vit}! O autor tá sorrindo em algum canto... 😈', '🔔 Notificação nova para {vit}: "você foi atingido por um {ic} {it} CRÍTICO (dado {d})". Remetente: desconhecido. 🕵️', '🎬 Cena de cinema: {vit} caminhava tranquilo e... {ic} {it} CRÍTICO (dado {d})! Que sorte a do atacante, que azar o do alvo!', '🧨 {vit} tomou um {ic} {it} CRÍTICO de {d} e ainda perdeu o dia! Quem foi? Façam suas apostas! 🎰', '🏹 Direto no alvo! O {ic} {it} CRÍTICO (dado {d}) encontrou {vit} sem pedir licença. Cirúrgico!'],
  critProprio: ['💥🎉 {de} tirou {d} e mandou um {ic} {it} CRÍTICO! É sorte ou é talento?!', '🚀 INACREDITÁVEL! {de} rolou {d} e o {ic} {it} CRÍTICO foi com tudo! Chama o VAR, que isso é bonito demais!', '🔥 {de} tirou {d}: {ic} {it} CRÍTICO! Vai ter que explicar esse nível de sorte na segunda!', '🏆 {de} tirou {d} e fez um {ic} {it} CRÍTICO! Alguém avisa que isso aqui é uma corrida, não uma exibição! 😎', '🤩 {de} rolou {d}, o {ic} {it} CRÍTICO explodiu de glória! Respeitem o piloto, ele está inspirado!', '🧙 Magia pura! {de} tirou {d} e o {ic} {it} CRÍTICO brilhou como se fosse milagre!', '😎 {de} tirou {d} e o {ic} {it} CRÍTICO foi lindo de ver. Ele treina escondido, eu sei!', '🍀 O trevo de quatro folhas é {de}: tirou {d} e fez um {ic} {it} CRÍTICO!'],
  reducaoLeve: ['🛡️🩹 O escudo de {vit} segurou só um pouquinho do {ic} {it}: reduziu {red} e ainda sobrou {dano} pontos de dor! Escudo de papel? 😅', '🛡️ {vit} levantou o escudo, mas o {ic} {it} veio forte: só {red} amorteceu. Levou {dano} pontos na cara!', '🧻 O escudo de {vit} é fino! Absorveu só {red} do {ic} {it}. Dói do mesmo jeito: -{dano}!', '🥴 O {ic} {it} quase atravessou o escudo de {vit}! Segurou apenas {red}, e o resto veio: -{dano}!', '🪟 O escudo de {vit} trincou feio! Reduziu {red} do {ic} {it}, mas passaram -{dano} pontos pela rachadura!', '🌬️ Quase nada! O escudo de {vit} cortou só {red} do {ic} {it}. Lição aprendida: escudo bom é escudo grosso!'],
  reducaoMedia: ['🛡️ {vit} segurou o {ic} {it} com o escudo: reduziu {red} do golpe e levou só -{dano}. Dano controlado!', '🧱 O escudo de {vit} absorveu {red} do {ic} {it}! Doeu, mas poderia ter sido muito pior: -{dano}.', '🤕 {vit} tomou o {ic} {it}, mas o escudo cortou {red} do estrago! Resultado: -{dano} e um sorriso amarelo.', '⚖️ Meio a meio! O escudo de {vit} reduziu {red} do {ic} {it}, e sobraram -{dano} pontos pra chorar.', '🛟 Boia salva-vidas! O escudo de {vit} amorteceu {red} do {ic} {it}. Só -{dano} no placar!', '🪖 {vit} se agachou atrás do escudo! O {ic} {it} perdeu {red} da força e acertou só -{dano}. Sobreviveu!'],
  reducaoForte: ['🏰 FORTALEZA! O escudo de {vit} engoliu {red} do {ic} {it}! Sobrou só -{dano}: arranhão de gato!', '🛡️✨ Escudaço! {vit} reduziu {red} do {ic} {it} e quase nem sentiu: -{dano}. Quem atacou gastou item pra fazer cócegas! 😂', '🧤 Que defesa! O escudo de {vit} segurou {red} do {ic} {it}! Levou só -{dano}, e ainda mandou beijo pro atacante.', '🐢 Casco duro! O {ic} {it} bateu no escudo de {vit}, que absorveu {red}! Sobrou -{dano}: quase um carinho.', '🦾 O escudo de {vit} é de titânio! Cortou {red} do {ic} {it}. Resultado: -{dano} e cara de paisagem. 😎', '🌟 Quase um bloqueio total! {vit} reduziu {red} do {ic} {it} e perdeu só -{dano}. O atacante deve estar revoltado!'],
  bloqueio: ['🛡️✨ DEFESA! {vit} bloqueou um {ic} {it} bem na hora! Nada passa!', '🛡️ Que reflexo! {vit} se protegeu do {ic} {it} e saiu ileso! Quem mandou desistiu da vida.', '🧱 PAREDÃO! {vit} levantou o escudo e o {ic} {it} bateu e caiu! Quem atacou deve estar assistindo de camarote... chorando. 😅', '🏰 O {ic} {it} bateu no escudo de {vit} e voltou com o rabo entre as pernas! Fortaleza inabalável!', '🤺 {vit} defendeu o {ic} {it} com uma elegância digna de esgrima! Ataque? Que ataque?', '🥅 Defesaça de {vit}! O {ic} {it} ia direto no gol e foi pro escanteio. Quem lançou, tá ligado!', '🧤 Goleirão! {vit} agarrou o {ic} {it} sem tirar o sorriso do rosto! 😎', '🚫 ACESSO NEGADO! {vit} bloqueou o {ic} {it}. O atacante gastou item e levou só vento!'],
  acerto: ['🎯 Alguém acertou um {ic} {it} em {vit}! Não vou dizer quem foi... mas {vit} já tem uma lista de suspeitos. 🕵️', '👀 {vit} levou um {ic} {it} e agora desconfia até do próprio reflexo no espelho!', '🕶️ O {ic} {it} chegou em {vit} sem aviso. O autor? Segredo de Estado!', '📮 {vit} recebeu uma encomenda surpresa: {ic} {it}! Remetente anônimo, entrega expressa.', '🤐 O narrador sabe quem mandou o {ic} {it} em {vit}, mas jurou segredo. (Mentira, não sei, só finjo.) 😂', '🎣 {vit} mordeu a isca! O {ic} {it} entrou limpo e o culpado já sumiu no mato.', '🥷 Um ninja invisível jogou um {ic} {it} em {vit}! Só sobrou o barulho do estrago.', '🔮 Minha bola de cristal vê: {vit} levou um {ic} {it}. Quem foi? Cobrança de volta marcada para breve!', '💣 BUM! {vit} foi atingido por um {ic} {it}! Investigação aberta; testemunhas, apresentem-se!'],
  chefaoAtaque: ['👹 O Chefão acordou de mau humor e mandou um {ic} {it} em {vit}! Respeitem o chefe!', '😈 O Chefão sorriu, apontou pra {vit} e... {ic} {it}! Ninguém escapa do patrão!', '🌋 Do alto do trono, o Chefão lançou {ic} {it} em {vit}! Terremoto na pista!', '🦇 O Chefão deu o bote: {ic} {it} em {vit}! Até o dado tremeu!'],
  chefaoFalha: ['👹 {de} tirou {d} e o {ic} {it} se perdeu no caminho! Até o chefão erra, imagina a gente!', '🙊 {de} tirou {d}... o {ic} {it} não deu certo! O Chefão tá com sono, deixa ele!', '🤭 {de} tirou {d} e o {ic} {it} foi pro lugar errado! Humaniza, chefe!', '😴 {de} tirou {d}: o {ic} {it} dormiu na mão do patrão. A turma respira aliviada!']
};
function narracao(est, agora, nome, sem, opts) {
  opts = opts || {}; const dia = opts.horas === 24; const horas = opts.horas || 168;
  const ini = agora - horas * 36e5, nm = (k) => (k === 'chefao' ? '👹 O Chefão' : nome ? nome(k) : '@' + k); const linhas = [];
  const seed = (Number(sem) || 0) * 7 + (dia ? new Date(agora - 3 * 36e5).getUTCDate() : 0); const usos = {};
  const dire = (cat, v) => { const arr = FRASES[cat]; const n = usos[cat] = (usos[cat] || 0); usos[cat]++; return arr[(seed + n) % arr.length].replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : m)); };
  const pick = (i, arr) => arr[(i + seed) % arr.length];
  const ev = eventoDe(est, sem); if (ev) linhas.push(`${EVENTOS[ev].ic} *${EVENTOS[ev].nome.toUpperCase()}* está valendo! ${EVENTOS[ev].txt}`);
  if (!dia && est.missoes[String(sem)]) linhas.push(pick(0, ['🎯🔥 MISSÃO CUMPRIDA! A turma inteira se juntou, entregou no prazo e CHOVEU ITEM pra todo mundo! 🌧️🎁', '🎯🎉 É HISTÓRICO, MINHA GENTE! Todo mundo entregou no prazo e o céu abriu: ITEM PRA TODOS! Quem chora agora é o Chefão! 😭👹', '🤯 A TURMA INTEIRA ENTREGOU?! Eu preciso sentar. Chuva de itens liberada! 🌧️🎁']));
  est.log.filter((x) => x.evento === 'alianca' && new Date(x.em).getTime() >= ini).forEach((l) => linhas.push(dire('alianca', { A: nm(l.de), B: nm(l.para) })));
  const jogadas = est.log.filter((x) => x.faixa && new Date(x.em).getTime() >= ini);
  let nAtq = 0, nFalhas = 0, nCrit = 0, nBloq = 0, nRed = 0; const plain = [];
  jogadas.forEach((l) => {
    if (l.traicao) { nAtq++; linhas.push(dire('traicao')); return; }
    const dd = ITENS[l.item] || BOSS[l.item] || {}; const ic = dd.ic || '🎲', it = dd.nome || l.item, de = nm(l.de), vit = l.vit ? nm(l.vit) : '';
    const v = { de, d: l.dado, ic, it, vit }; const boss = l.de === 'chefao';
    if (l.faixa === 'falha_critica') { nFalhas++; linhas.push(boss ? dire('chefaoFalha', v) : l.vit && l.vit !== l.de ? dire('falhaCritOutro', v) : l.vit === l.de ? dire('falhaCritSi', v) : dire('falhaCritVazio', v)); }
    else if (l.faixa === 'falha') { nFalhas++; linhas.push(boss ? dire('chefaoFalha', v) : dire('falha', v)); }
    else if (l.red && !l.bloq && l.vit && l.vit !== l.de) { nAtq++; nRed++; if (l.faixa === 'critico') nCrit++; const pc = Math.round(l.red * 100); const w = { ...v, red: pc + '%', dano: String(Math.abs(l.dano || 0)) }; linhas.push(dire(pc <= 35 ? 'reducaoLeve' : pc <= 60 ? 'reducaoMedia' : 'reducaoForte', w)); }
    else if (l.faixa === 'critico') { nAtq++; nCrit++; linhas.push(boss ? dire('chefaoAtaque', v) + ' (CRÍTICO, dado ' + l.dado + ')' : l.vit && l.vit !== l.de ? dire('critVitima', v) : dire('critProprio', v)); }
    else if (l.bloq) { nBloq++; linhas.push(dire('bloqueio', v)); }
    else if (l.vit && l.vit !== l.de) { nAtq++; if (boss) linhas.push(dire('chefaoAtaque', v)); else plain.push(v); }
  });
  // acertos comuns: poucos viram linhas soltas (cada um com sua frase); muitos viram uma lista, para o texto não ficar um paredão
  if (plain.length <= 3) plain.forEach((v) => linhas.push(dire('acerto', v)));
  else { const por = {}; plain.forEach((v) => { const k = v.ic + ' ' + v.it; (por[k] = por[k] || []).push(v.vit); });
    linhas.push(pick(0, ['🎯 *Quem levou pancada (e não sabe quem foi):*', '🎯 *Lista de vítimas da vez (autores sob sigilo):*', '🕵️ *Caso aberto! Estes aqui levaram e estão procurando o culpado:*', '💢 *Mural dos atingidos (sem identificar o criminoso):*']));
    for (const k of Object.keys(por)) linhas.push(`   ${k}: ${por[k].join(', ')}`); }
  if (!dia) for (const t of trofeus(est, agora).filter((x) => x.periodo === 'semana')) linhas.push(`${t.ic} *${t.titulo}*: ${t.quem.map(nm).join(', ')} (${t.qtd}x) 👏 ${pick(t.qtd, ['Palmas pra eles!', 'Mereceu (ou foi sorte)!', 'Entra pra história da pista!', 'Pode pedir autógrafo!', 'A torcida vai à loucura!'])}`);
  if (!linhas.length) return dia
    ? pick(0, ['🎙️ Boletim do dia: pista vazia, dado parado e nenhum item no ar. Quem vai quebrar o gelo hoje? 🏎️💨', '🎙️ Alô, pilotos! Hoje a pista dormiu. Que tal acordar o Chefão com um bom item? 😈', '🎙️ Plantão do narrador: nenhum lance hoje! O silêncio está tão alto que dá pra ouvir o dado rolando na gaveta! 🎲🦗'])
    : pick(0, ['🎙️ Atenção, pilotos! A pista está silenciosa... ninguém jogou item nesta semana. Quem vai quebrar o gelo e agitar a Copa? 🏎️💨', '🎙️ Alô, alô? Tem alguém aí? A pista está tão quieta que dá para ouvir o dado rolando na gaveta! 🎲🦗 Quem vai ter coragem de atacar primeiro?']);
  const resumo = (nAtq + nFalhas) ? [`📊 *Placar ${dia ? 'do dia' : 'da guerra'}:* ${nAtq} ataque${nAtq === 1 ? '' : 's'} certeiro${nAtq === 1 ? '' : 's'}, ${nFalhas} falha${nFalhas === 1 ? '' : 's'}${nCrit ? `, ${nCrit} crítico${nCrit === 1 ? '' : 's'}` : ''}${(nBloq + nRed) ? ` e ${nBloq + nRed} defesa${nBloq + nRed === 1 ? '' : 's'}` : ''}. ${pick(0, ['A pista está pegando fogo! 🔥', 'Ninguém está seguro! 😈', 'Isso aqui virou campo de batalha! ⚔️', 'O Chefão está assistindo e anotando! 👹'])}`] : [];
  const abre = dia
    ? pick(0, ['🏆🎙️ *COPA DA LIGA · BOLETIM DO DIA!* O que rolou hoje na pista:', '🏆🎙️ *COPA DA LIGA · PLANTÃO DO NARRADOR!* Notícia fresquinha:', '🏆🎙️ *COPA DA LIGA · AGORA NA PISTA!* Fofoca quente do dia:'])
    : pick(0, ['🏆🎙️ *COPA DA LIGA · O NARRADOR CONTA A SEMANA!*', '🏆🎙️ *COPA DA LIGA · PLANTÃO DO NARRADOR!* Senta que lá vem história!', '🏆🎙️ *COPA DA LIGA · RESENHA DA SEMANA!* Fofoca quente, direto da pista!']);
  const fecha = pick(0, ['🏁 Entregou no prazo? Ganhou pontos e itens! A próxima volta é de vocês! 🚀', '🏁 Entregou no prazo? Ganhou item! E item é munição. Pensem bem em quem vão acertar... 😈', '🏁 Entregou no prazo? Subiu na pista e ganhou item! Quem não entregou: o Chefão manda lembranças. 👹', '🏁 Entregou no prazo? Item no bolso, sorriso no rosto e alvo na mira! 🎯']);
  const pergunta = pick(0, ['💬 E aí, quem foi o suspeito do dia? Respondam aqui no grupo! 🕵️', '💬 Quem merece a coroa de MVP? Votação aberta nos comentários! 👑', '💬 Vai ter vingança? A resposta: amanhã, na pista. Vejo vocês lá! 🏎️💨', '💬 Quem vocês acham que mandou aquele crítico? Palpites no grupo! 🔍']);
  return [abre, '', ...linhas, '', ...resumo, ...(resumo.length ? [''] : []), fecha, pergunta].join('\n');
}
// ---------- Aliança e traição ----------
function livreParaAlianca(est, k, sem, agora) {
  if (aliancaAtiva(est, k, agora)) return 'já tem uma aliança ativa';
  if (est.traidores[k] && new Date(est.traidores[k]).getTime() > agora) return 'está de castigo por ter traído (2 semanas sem aliança)';
  if (Object.values(est.aliancas).some((a) => (a.a === k || a.b === k) && a.sem === sem)) return 'já fez uma aliança nesta semana';
  return '';
}
const convitesValidos = (est, agora) => (est.convites || []).filter((c) => new Date(c.em).getTime() > agora - CONVITE_DIAS * 864e5);
function convidarAlianca(est, de, para, rank, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora);
  if (emTregua(fim, agora)) return { erro: 'Trégua final: não dá para formar aliança agora.' };
  if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (!rank.find((x) => x.usuario === de) || !rank.find((x) => x.usuario === para) || de === para) return { erro: 'Escolha outro colega da turma.' };
  const a = livreParaAlianca(est, de, sem, agora); if (a) return { erro: 'Você não pode formar aliança agora: ' + a + '.' };
  const b = livreParaAlianca(est, para, sem, agora); if (b) return { erro: 'Esse colega não pode formar aliança agora (já tem aliança, já fez uma nesta semana ou está de castigo).' };
  est.convites = convitesValidos(est, agora);
  if (est.convites.some((c) => c.de === de && c.para === para)) return { erro: 'Você já convidou esse colega. Espere a resposta.' };
  if (est.convites.filter((c) => c.de === de).length >= 3) return { erro: 'Você já tem 3 convites esperando resposta.' };
  est.convites.push({ id: crypto.randomBytes(4).toString('hex'), de, para, em: new Date(agora).toISOString() });
  return { ok: true, resultado: '🤝 Convite enviado! Quando o colega aceitar, vocês viram aliados por 7 dias.' };
}
function responderAlianca(est, quem, id, aceitar, rank, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora); est.convites = convitesValidos(est, agora);
  const c = est.convites.find((x) => x.id === id && x.para === quem); if (!c) return { erro: 'Esse convite não existe mais.' };
  if (!aceitar) { est.convites = est.convites.filter((x) => x.id !== id); return { ok: true, resultado: 'Convite recusado.' }; }
  if (emTregua(fim, agora)) return { erro: 'Trégua final: não dá para formar aliança agora.' };
  if (livreParaAlianca(est, c.de, sem, agora) || livreParaAlianca(est, quem, sem, agora)) { est.convites = est.convites.filter((x) => x.id !== id); return { erro: 'A aliança não pode mais ser formada (um de vocês já tem aliança, fez uma nesta semana ou está de castigo).' }; }
  const ate = new Date(Math.min(agora + ALIANCA_DIAS * 864e5, fimMs(fim) - TREGUA_DIAS * 864e5)).toISOString();
  est.aliancas[id] = { id, a: c.de, b: quem, em: new Date(agora).toISOString(), ate, sem };
  est.convites = est.convites.filter((x) => ![c.de, quem].some((k) => x.de === k || x.para === k));
  est.log.push({ em: new Date(agora).toISOString(), de: c.de, item: 'alianca', para: quem, evento: 'alianca', txt: 'aliança formada' });
  return { ok: true, resultado: '🤝 Aliança formada! Por 7 dias vocês dividem ataques e falhas críticas, não se atacam e dividem os bônus.' };
}
// Chuva de itens do professor: 1 item extra (bônus) para cada aluno da turma, valendo até o fim da semana. No máximo 1 por dia.
function chuvaProfessor(est, rank, inicio, agora, fim) {
  const sem = semanaDe(inicio, agora); if (sem < 1) return { erro: 'A turma ainda não começou.' };
  if (emTregua(fim, agora)) return { erro: 'Trégua final: não dá para distribuir itens agora.' };
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10); if (est.log.some((l) => l.item === 'chuva-professor' && String(l.em).slice(0, 10) === new Date(agora).toISOString().slice(0, 10) && hoje)) return { erro: 'Já houve uma chuva de itens hoje.' };
  const permitidos = Object.keys(ITENS).filter((k) => ITENS[k].alvo !== 'auto' && k !== 'chuva'); const em = new Date(agora).toISOString();
  for (const x of rank) { const hh = crypto.createHash('sha1').update(`prof|${x.usuario}|${agora}`).digest().readUInt32BE(0); (est.inventario[x.usuario] = est.inventario[x.usuario] || []).push({ id: crypto.randomBytes(4).toString('hex'), tipo: trocaEscudo(est, x.usuario, permitidos[hh % permitidos.length], hh), semana: sem, em, bonus: true }); }
  est.log.push({ em, de: 'professor', item: 'chuva-professor', para: 'todos', txt: 'chuva de itens para ' + rank.length + ' alunos' });
  return { ok: true, resultado: 'Choveu item para ' + rank.length + ' alunos. Valem até o fim desta semana.' };
}
// Limpeza: guarda só efeitos recentes (os antigos já não contam).
function limpar(est, agora) { est.aliancas = Object.fromEntries(Object.entries(est.aliancas || {}).filter(([, a]) => new Date(a.ate).getTime() > agora - 30 * 864e5)); est.convites = convitesValidos(est, agora); est.efeitos = est.efeitos.filter((e) => new Date(e.ate).getTime() > agora - 30 * 864e5); }
module.exports = { trocaEscudo, convidarAlianca, responderAlianca, aliancaAtiva, aliadoDe, ALIANCA_DIAS, BOSS, itemChefao, chefaoInfo, usarChefao, EVENTOS, eventoDe, definirEvento, missaoInfo, missao, trofeus, narracao, darItemATodos, TAB, MULT, faixaDe, setDado, chuvaProfessor, ITENS, CAP, DIAS_EFEITO, TREGUA_DIAS, emTregua, fimMs, roletar, VISIBILIDADES, estadoVazio, normalizar, semanaDe, ganhos, sortear, sincronizar, placar, usar, efeitosAtivos, limpar };
