'use strict';
// Testes da crônica da corrida (puros, sem rede).
const assert = require('assert'); const K = require('../lib/cronica'); const C = require('../lib/copa');
assert.ok(K.EVENTOS.length >= 30);
const ids = new Set(K.EVENTOS.map((e) => e.id)); assert.equal(ids.size, K.EVENTOS.length); // ids únicos
for (const e of K.EVENTOS) { assert.ok(e.tipo && e.ic && e.nome && e.txt && Array.isArray(e.tags) && e.tags.length, e.id); if (e.piloto) assert.ok(e.txt.includes('{piloto}'), e.id); }
// sorteio: determinístico e sem repetir os recentes
assert.equal(K.sortear('P', '2026-11-16', []).id, K.sortear('P', '2026-11-16', []).id);
const rec = [K.sortear('P', '2026-11-16', []).id]; assert.notEqual(K.sortear('P', '2026-11-16', rec).id, rec[0]);
// fatos: autor do ataque em sigilo; evento e aliança aparecem
const agora = Date.now(); const em = new Date(agora).toISOString();
const est = C.normalizar({ ativa: true, log: [{ em, de: 'segredo', item: 'banana', vit: 'vitima', para: 'vitima', faixa: 'normal', dado: 5 }, { em, de: 'a', item: 'alianca', evento: 'alianca', para: 'b' }, { em: new Date(agora - 30 * 864e5).toISOString(), de: 'x', item: 'banana', vit: 'velho', faixa: 'normal' }] });
const f = K.fatos(est, agora, 7); assert.equal(f.length, 2);
assert.ok(f.every((x) => !x.texto.includes('segredo'))); assert.ok(f.some((x) => x.texto.includes('@vitima')) && !f.some((x) => x.texto.includes('@velho')));
console.log('Crônica: todos os testes passaram.');
