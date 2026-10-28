'use strict';
// Testes das regras da Copa da Liga (puras, sem rede).
const assert = require('assert'); const C = require('../lib/copa'); const d = require('../lib/dados');
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
assert(C.usar(E, 'bia', 'b1', 'bia', rank, INI, AG).erro); // em si mesmo
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
console.log('Copa: todos os testes passaram.');
