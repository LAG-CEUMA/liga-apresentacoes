'use strict';
// Testes das regras da Copa da Liga (puras, sem rede).
const assert = require('assert'); const C = require('../lib/copa'); const d = require('../lib/dados');
C.setDado(() => 8); // d10 fixo: efeito normal (o d10 é testado no final)
const AG = new Date('2026-10-28T15:00:00-03:00').getTime(); const INI = '2026-10-12'; // semana 3
assert.equal(C.semanaDe(INI, AG), 3); assert.equal(C.semanaDe('', AG), 0); assert.equal(C.semanaDe('2027-01-01', AG), 0);
// ganhos: presença na semana 1, participação na 2, entrega no prazo na semana 3 e outra no futuro (não conta)
const ses = [{ turma: 'T', data: '2026-10-13', chamadas: { 1: { estados: { ana: 'p', bia: 'a' } } }, participacoes: [] },
  { turma: 'T', data: '2026-10-20', chamadas: { 1: { estados: { ana: 'a' } } }, participacoes: [{ usuario: 'ana', tipo: 'pergunta', pontos: 1 }, { usuario: 'bia', tipo: 'penalidade', pontos: 1 }] }];
const at = [{ turma: 'T', liberada: true, prazo: '2026-10-29T12:00:00-03:00', entregas: { ana: { estado: 'prazo' } } }, { turma: 'T', liberada: true, prazo: '2026-12-29T12:00:00-03:00', entregas: { ana: { estado: 'prazo' } } }];
assert.equal(C.ganhos('ana', 'T', INI, AG, ses, at, d.resumoSessao), 3); // presença + participação + entrega
assert.equal(C.ganhos('bia', 'T', INI, AG, ses, at, d.resumoSessao), 0); // ausente, penalidade não conta, sem entrega
// sorteio determinístico
assert.equal(C.sortear('T', 'ana', 0), C.sortear('T', 'ana', 0)); assert(C.ITENS[C.sortear('T', 'ana', 1)]);
// sincronizar: concede, é idempotente e respeita o limite
const est = C.estadoVazio(); assert(C.sincronizar(est, 'T', INI, AG, ['ana', 'bia'], ses, at, d.resumoSessao));
assert.equal(est.inventario.ana.length + (est.efeitos.length), 1); assert.equal(est.concedidos.ana, 3); // semanas passadas se perdem: só a entrega da semana 3 rende item
assert.equal(est.inventario.bia.length, 0);
assert(!C.sincronizar(est, 'T', INI, AG, ['ana', 'bia'], ses, at, d.resumoSessao)); assert.equal(est.inventario.ana.length + est.efeitos.length, 1);
// item guardado não passa de uma semana para a outra
est.inventario.ana = [{ id: 'old', tipo: 'banana', semana: 2 }]; C.sincronizar(est, 'T', INI, AG, ['ana'], ses, at, d.resumoSessao); assert(!est.inventario.ana.some((x) => x.id === 'old'));
assert(C.usar(C.normalizar({ inventario: { ana: [{ id: 'old', tipo: 'banana', semana: 2 }] } }), 'ana', 'old', 'bia', [{ usuario: 'ana', total: 1, posicao: 1 }, { usuario: 'bia', total: 1, posicao: 2 }], INI, AG).erro.includes('venceu'));
// regras de uso
const rank = [{ usuario: 'ana', total: 80, posicao: 1 }, { usuario: 'bia', total: 70, posicao: 2 }, { usuario: 'caio', total: 60, posicao: 3 }, { usuario: 'davi', total: 50, posicao: 4 }];
const E = C.normalizar({ inventario: { bia: [{ id: 'b1', tipo: 'banana', semana: 3 }, { id: 'b2', tipo: 'banana', semana: 3 }, { id: 'c1', tipo: 'casco', semana: 3 }, { id: 'e1', tipo: 'escudo', semana: 3 }, { id: 't1', tipo: 'turbo', semana: 3 }], caio: [{ id: 'k1', tipo: 'casco', semana: 3 }, { id: 'k2', tipo: 'banana', semana: 3 }] }, ativa: true });
assert(C.usar(E, 'bia', 'zzz', 'ana', rank, INI, AG).erro); // não tem
assert(C.usar(E, 'bia', 'b1', 'ninguem', rank, INI, AG).erro); // em si mesmo
assert(C.usar(E, 'bia', 'b1', 'davi', rank, INI, AG).erro); // último colocado protegido
assert(C.usar(E, 'bia', 'c1', 'caio', rank, INI, AG).erro); // casco só acerta quem está à frente
let r = C.usar(E, 'bia', 'c1', 'ana', rank, INI, AG); assert(r.ok, JSON.stringify(r)); // casco no líder
assert(C.usar(E, 'bia', 'b2', 'caio', rank, INI, AG).erro); // 1 uso por semana
assert.equal(C.placar(E, rank, AG).find((x) => x.usuario === 'ana').copa, 75); assert.equal(C.placar(E, rank, AG).find((x) => x.usuario === 'ana').oficial, 80); // só a Copa muda
assert.equal(C.placar(E, rank, AG + 8 * 864e5).find((x) => x.usuario === 'ana').copa, 80); // efeito expira em 7 dias
// ataque seguido ao mesmo alvo e limite de ataque por dia
assert(C.usar(E, 'caio', 'k2', 'ana', rank, INI, AG).erro); // ana já recebeu um ataque hoje
r = C.usar(E, 'caio', 'k1', 'bia', rank, INI, AG); assert(r.ok, JSON.stringify(r)); // bia está à frente de caio
// escudo bloqueia
const E2 = C.normalizar({ inventario: { bia: [{ id: 'e1', tipo: 'escudo', semana: 3 }], caio: [{ id: 'k2', tipo: 'banana', semana: 3 }] } });
assert(C.usar(E2, 'bia', 'e1', null, rank, INI, AG).ok); assert(E2.escudos.bia);
r = C.usar(E2, 'caio', 'k2', 'bia', rank, INI, AG); assert(r.ok && r.bloqueado); assert(!E2.escudos.bia);
assert.equal(C.placar(E2, rank, AG).find((x) => x.usuario === 'bia').copa, 70); // nada descontado
// visibilidade inválida volta para oculta
assert.equal(C.normalizar({ visibilidade: 'x' }).visibilidade, 'oculta');
// trégua final: nos últimos 2 dias nada vale
const FIM = '2026-10-29'; assert(C.emTregua(FIM, AG)); assert(!C.emTregua('2026-12-31', AG));
const E3 = C.normalizar({ inventario: { bia: [{ id: 'b9', tipo: 'banana', semana: 3 }] } }); assert(C.usar(E3, 'bia', 'b9', 'ana', rank, INI, AG, FIM).erro.includes('Trégua'));
const E4 = C.normalizar({ efeitos: [{ id: 'z', tipo: 'banana', de: 'bia', para: 'ana', delta: -3, em: '2026-10-27T10:00:00Z', ate: '2026-11-03T10:00:00Z' }] });
assert.equal(C.placar(E4, rank, AG, '2026-12-31').find((x) => x.usuario === 'ana').copa, 77); assert.equal(C.placar(E4, rank, AG, FIM).find((x) => x.usuario === 'ana').copa, 80); // na trégua vale o oficial
// roleta maluca cai sozinha; escudo bloqueia; não dá para usar
const E5 = C.normalizar({}); C.roletar(E5, 'caio', 'r1', '2026-10-28T10:00:00Z', AG); assert.equal(C.placar(E5, rank, AG).find((x) => x.usuario === 'caio').copa, 58);
const E6 = C.normalizar({ escudos: { caio: true } }); C.roletar(E6, 'caio', 'r2', '2026-10-28T10:00:00Z', AG); assert(!E6.escudos.caio && E6.efeitos.length === 0);
assert(C.usar(C.normalizar({ inventario: { bia: [{ id: 'r', tipo: 'roleta', semana: 3 }] } }), 'bia', 'r', null, rank, INI, AG).erro);
// chuva de itens: 2 acima e 2 abaixo ganham item extra (bônus), que não conta no uso semanal
const E7 = C.normalizar({ inventario: { caio: [{ id: 'ch', tipo: 'chuva', semana: 3 }] } }); r = C.usar(E7, 'caio', 'ch', null, rank, INI, AG); assert(r.ok, JSON.stringify(r));
assert(E7.inventario.ana.length === 1 && E7.inventario.ana[0].bonus && E7.inventario.davi.length === 1 && !E7.inventario.caio.length);
const gift = E7.inventario.bia[0]; assert(C.ITENS[gift.tipo].alvo !== 'auto' && gift.tipo !== 'chuva');
const E8 = C.normalizar({}); r = C.chuvaProfessor(E8, rank, INI, AG); assert(r.ok && ['ana', 'bia', 'caio', 'davi'].every((k) => E8.inventario[k].length === 1 && E8.inventario[k][0].bonus));
assert(C.chuvaProfessor(E8, rank, INI, AG).erro); assert(C.chuvaProfessor(C.normalizar({}), rank, INI, AG, FIM).erro.includes('Trégua'));
// ---------- d10 ----------
{ const mk = () => C.normalizar({ inventario: { bia: [{ id: 'b1', tipo: 'banana', semana: 3 }], caio: [{ id: 'k1', tipo: 'turbo', semana: 3 }] } });
  const ef = (e, k) => e.efeitos.filter((x) => x.para === k && !x.bloqueado);
  assert.equal(C.faixaDe('banana', 1), 'falha_critica'); assert.equal(C.faixaDe('banana', 2), 'falha'); assert.equal(C.faixaDe('banana', 5), 'fraco'); assert.equal(C.faixaDe('banana', 6), 'normal'); assert.equal(C.faixaDe('banana', 10), 'critico');
  assert(C.faixaDe('turbo', 7) === 'normal' && C.faixaDe('turbo', 6) === 'fraco'); // item forte pede mais do dado
  C.setDado(() => 10); let e = mk(); let r = C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG); assert(r.ok && r.faixa === 'critico'); assert.equal(ef(e, 'ana')[0].delta, -4.5); // 150%
  C.setDado(() => 5); e = mk(); r = C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG); assert.equal(r.faixa, 'fraco'); assert.equal(ef(e, 'ana')[0].delta, -1.5); // metade
  C.setDado(() => 2); e = mk(); r = C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG); assert.equal(r.faixa, 'falha'); assert.equal(e.efeitos.length, 0); assert.equal(e.inventario.bia.length, 0); // gasta e nada acontece
  C.setDado(() => 1); e = mk(); r = C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG); assert.equal(r.faixa, 'falha_critica'); assert.equal(e.efeitos.length, 1); assert(['bia', 'caio'].includes(e.efeitos[0].para) && e.efeitos[0].para !== 'ana'); assert(e.efeitos[0].para !== 'davi'); // cai em você ou em outro, nunca no alvo nem no último
  r = C.usar(mk(), 'caio', 'k1', null, rank, INI, AG); assert.equal(r.faixa, 'falha_critica'); // turbo com 1 vira penalidade em si
  { const e3 = mk(); C.usar(e3, 'caio', 'k1', null, rank, INI, AG); assert.equal(ef(e3, 'caio')[0].delta, -2); }
  // consolo: 3 falhas críticas seguidas dão um escudo
  { const e4 = C.normalizar({ inventario: { bia: [] } }); for (let n = 0; n < 3; n++) { e4.inventario.bia.push({ id: 'x' + n, tipo: 'turbo', semana: 3, bonus: true }); const rr = C.usar(e4, 'bia', 'x' + n, null, rank, INI, AG); assert.equal(rr.faixa, 'falha_critica'); }
    assert(e4.inventario.bia.some((x) => x.tipo === 'escudo'), 'escudo de consolo'); assert.equal(e4.azar.bia, 0); }
  C.setDado(() => 8); }
// ---------- evento da semana, missão, troféus, narração ----------
{ const mk = () => C.normalizar({ ativa: true, inventario: { bia: [{ id: 'b1', tipo: 'banana', semana: 3 }], caio: [] } });
  let e = mk(); assert(C.definirEvento(e, rank, INI, AG, 'xx', '2999-01-01').erro); assert(C.definirEvento(e, rank, '2999-01-01', AG, 'paz', '3000-01-01').erro); // inválido / não começou
  assert(C.definirEvento(e, rank, INI, AG, 'paz', '2999-01-01').ok); assert.equal(C.eventoDe(e, 3), 'paz');
  assert(/paz/i.test(C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG).erro)); // paz bloqueia ataque
  C.definirEvento(e, rank, INI, AG, 'nenhum', '2999-01-01'); assert.equal(C.eventoDe(e, 3), null);
  e = mk(); C.definirEvento(e, rank, INI, AG, 'chuva', '2999-01-01'); const n1 = rank.reduce((n, x) => n + (e.inventario[x.usuario] || []).length, 0); C.definirEvento(e, rank, INI, AG, 'chuva', '2999-01-01');
  assert.equal(rank.reduce((n, x) => n + (e.inventario[x.usuario] || []).length, 0), n1); assert(n1 >= rank.length); // chuva entrega uma vez só
  e = mk(); C.definirEvento(e, rank, INI, AG, 'dado_dobro', '2999-01-01'); let seq = [1, 9]; C.setDado(() => seq.shift() || 1); const r = C.usar(e, 'bia', 'b1', 'ana', rank, INI, AG); assert.equal(r.dado, 9); C.setDado(() => 8); // vale o melhor dos dois
  assert(['nevoeiro', 'dado_dobro', 'paz', 'chuva'].includes(C.eventoDe((() => { const x = mk(); C.definirEvento(x, rank, INI, AG, 'sorteio', '2999-01-01'); return x; })(), 3)));
  // missão: todos entregaram no prazo as atividades vencidas da semana
  const ex = C.normalizar({ ativa: true }); const us = rank.map((x) => x.usuario); const prazo = '2026-10-28T10:00:00-03:00';
  const atv = (ok) => [{ turma: 'T', liberada: true, prazo, entregas: Object.fromEntries(us.map((a, i) => [a, { estado: ok || i ? 'prazo' : 'atraso' }])) }];
  assert.equal(C.missaoInfo(ex, 'T', INI, AG, us, atv(false)).faltam, 1); assert.equal(C.missao(ex, 'T', INI, AG, us, atv(false), '2999-01-01'), false);
  assert.equal(C.missao(ex, 'T', INI, AG, us, atv(true), '2999-01-01'), true); assert(ex.missoes['3']); assert.equal(C.missao(ex, 'T', INI, AG, us, atv(true), '2999-01-01'), false); // só uma vez
  assert(us.every((a) => ex.inventario[a].length === 1));
  // troféus e narração
  const eg = C.normalizar({ log: [{ em: new Date(AG).toISOString(), de: 'bia', item: 'banana', faixa: 'critico', dado: 10, vit: 'ana' }, { em: new Date(AG).toISOString(), de: 'caio', item: 'turbo', faixa: 'falha_critica', dado: 1, vit: 'caio' }, { em: new Date(AG).toISOString(), de: 'bia', item: 'casco', faixa: 'normal', dado: 8, bloq: true, vit: 'ana' }] });
  const tf = C.trofeus(eg, AG); assert(tf.some((x) => x.id === 'rei' && x.quem[0] === 'bia')); assert(tf.some((x) => x.id === 'azarado' && x.quem[0] === 'caio')); assert(tf.some((x) => x.id === 'escudo' && x.quem[0] === 'ana'));
  const tx = C.narracao(eg, AG, (k) => k.toUpperCase(), 3); assert(/CAIO tirou 1/.test(tx) && /acertou a si mesmo/.test(tx)); assert(!/BIA acertou/.test(tx) && /Crítico! Alguém acertou ANA/.test(tx)); // quem acerta não é citado
}
// ---------- recuperação (sábado) ----------
{ const base = { chamadas: { 1: { estados: { ana: 'p', bia: 'a', caio: 'a' } } }, participacoes: [] };
  assert.equal(d.resumoSessao(base).bia.status, 'ausente');
  const comRec = { ...base, recuperacoes: [{ data: '2026-11-07', ministrante: 'ana', estados: { bia: 'p', novato: 'p' } }] };
  const rs = d.resumoSessao(comRec); assert.equal(rs.bia.status, 'presente'); assert(rs.bia.recuperou); assert.equal(rs.caio.status, 'ausente'); assert.equal(rs.novato.status, 'presente'); // quem perdeu ou entrou depois recupera a presença
}
// ---------- Chefão (professor/owner joga) ----------
{ const mk = () => C.normalizar({ ativa: true }); const FIM = '2999-01-01';
  const tipo = C.itemChefao('prof', 3); assert(C.BOSS[tipo]); assert.equal(C.itemChefao('prof', 3), tipo); // determinístico
  // acha um semana/professor em que o item seja de alvo escolhido, para testar com alvo
  let e = mk(); let alvo = rank.find((x) => x.posicao > 1 && x.posicao < Math.max(...rank.map((y) => y.posicao))).usuario;
  assert(C.chefaoInfo(e, 'prof', INI, AG, FIM).def); assert.equal(C.chefaoInfo(e, 'prof', INI, AG, FIM).usado, false);
  let r = C.usarChefao(e, 'prof', alvo, rank, INI, AG, FIM); assert(r.ok, JSON.stringify(r)); assert.equal(r.faixa, 'normal'); // dado fixo 8
  assert(e.efeitos.some((x) => x.de === 'chefao' && x.delta !== 0)); assert(C.usarChefao(e, 'prof', alvo, rank, INI, AG, FIM).erro); // 1 por semana
  assert(C.usarChefao(mk(), 'prof', alvo, rank, INI, AG, '2026-10-29').erro); // trégua
  assert(C.usarChefao(mk(), 'prof', 'nao-existe', rank, INI, AG, FIM).erro || C.BOSS[tipo].alvo === 'lider');
  { const e5 = mk(); const t5 = C.chefaoInfo(e5, 'mon', INI, AG, FIM).tipo; const r5 = C.usarChefao(e5, 'mon', 'qualquer-coisa', rank, INI, AG, FIM, true); // monitor: alvo sorteado, o informado é ignorado
    assert(r5.ok, JSON.stringify(r5)); const ef5 = e5.efeitos.filter((x) => x.de === 'chefao'); assert.equal(ef5.length, 1); assert(rank.some((x) => x.usuario === ef5[0].para));
    if (C.BOSS[t5].delta < 0) assert.notEqual(ef5[0].para, rank.find((x) => x.posicao === Math.max(...rank.map((y) => y.posicao))).usuario); } // nunca no último colocado
  // oficial nunca muda: placar com efeito do chefão difere só na Copa
  const pl = C.placar(e, rank, AG, FIM); assert(pl.some((x) => x.copa !== x.oficial));
  // falha crítica: a magia vira ao contrário (ou tesouro, no trovão)
  C.setDado(() => 1); e = mk(); r = C.usarChefao(e, 'prof', alvo, rank, INI, AG, FIM); assert.equal(r.faixa, 'falha_critica'); assert(r.ok);
  C.setDado(() => 2); e = mk(); r = C.usarChefao(e, 'prof', alvo, rank, INI, AG, FIM); assert.equal(r.faixa, 'falha'); assert.equal(e.efeitos.length, 0);
  C.setDado(() => 8);
  // paz bloqueia ataque do chefão, mas não a bênção
  e = mk(); C.definirEvento(e, rank, INI, AG, 'paz', FIM); const t2 = C.chefaoInfo(e, 'prof', INI, AG, FIM).tipo; r = C.usarChefao(e, 'prof', alvo, rank, INI, AG, FIM); assert(t2 === 'bencao' ? r.ok : r.erro);
  // vida do chefão: entregas no prazo da semana
  const us = rank.map((x) => x.usuario); const at = [{ turma: 'T', liberada: true, prazo: '2026-11-01T12:00:00-03:00', entregas: { [us[0]]: { estado: 'prazo' } } }];
  const mi = C.missaoInfo(C.normalizar({}), 'T', INI, AG, us, at); assert.equal(mi.vida, Math.round((1 - 1 / us.length) * 100));
  assert(C.narracao(C.normalizar({ log: [{ em: new Date(AG).toISOString(), de: 'chefao', item: 'maldicao', faixa: 'falha_critica', dado: 1, vit: 'ana' }] }), AG, (k) => k, 3).includes('O Chefão'));
}
// ---------- sorteio de alvo ----------
{ const e = C.normalizar({ ativa: true, inventario: { bia: [{ id: 'b1', tipo: 'banana', semana: 3 }] } }); const r = C.usar(e, 'bia', 'b1', '__eu', rank, INI, AG); assert(r.ok, JSON.stringify(r)); assert(e.efeitos.some((x) => x.para === 'bia' && x.delta < 0), 'eu mesmo'); }
{ const e = C.normalizar({ ativa: true, inventario: { bia: [{ id: 'b1', tipo: 'banana', semana: 3 }] } }); const r = C.usar(e, 'bia', 'b1', '__sorteio', rank, INI, AG);
  assert(r.ok, JSON.stringify(r)); const alvo = e.efeitos[0].para; assert(alvo !== 'davi'); // nunca no último colocado (você mesmo pode)
  const e2 = C.normalizar({ ativa: true }); const r2 = C.usarChefao(e2, 'prof', '__sorteio', rank, INI, AG, '2999-01-01'); assert(r2.ok, JSON.stringify(r2)); assert(e2.efeitos.length === 1); }
console.log('Copa: todos os testes passaram.');
