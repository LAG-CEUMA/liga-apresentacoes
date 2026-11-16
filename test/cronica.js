'use strict';
// Testes da crônica da corrida (puros, sem rede).
const assert = require('assert'); const K = require('../lib/cronica'); const C = require('../lib/copa');
assert.ok(K.EVENTOS.length >= 30);
const ids = new Set(K.EVENTOS.map((e) => e.id)); assert.equal(ids.size, K.EVENTOS.length);
for (const e of K.EVENTOS) { assert.ok(e.tipo && e.ic && e.nome && e.txt && Array.isArray(e.tags) && e.tags.length, e.id); if (e.piloto) assert.ok(e.txt.includes('{piloto}'), e.id); }
assert.ok(!K.EVENTOS.some((e) => /narrador de esportes/.test(e.txt)));
// sorteio determinístico, sem repetir recentes; gerador produz variedade
assert.equal(K.sortear('P', '2026-11-16', []).id, K.sortear('P', '2026-11-16', []).id);
const rec = [K.sortear('P', '2026-11-16', []).id]; assert.notEqual(K.sortear('P', '2026-11-16', rec).id, rec[0]);
const gerados = new Set(); for (let i = 1; i <= 28; i++) gerados.add(K.gerar('mundo', '2026-12-' + String(i).padStart(2, '0'), 'Deserto dos Bugs', []).txt);
assert.ok(gerados.size >= 20, 'gerador deve variar: ' + gerados.size);
// realidade e capítulos
const R = K.REALIDADES[K.REALIDADE_ATUAL]; assert.ok(R.capitulos.length >= 5 && R.capitulos.every((c, i) => c.n === i + 1 && c.txt.length > 80));
// modo de participação: trilha participa, Copa sem trilha só owners
assert.equal(K.modoDe({}, { plano: { id: 'x' } }), 'participa'); assert.equal(K.modoDe({}, { plano: null }), 'owners'); assert.equal(K.modoDe({ jogo: 'fora' }, { plano: { id: 'x' } }), 'fora');
// fatos: autor em sigilo, gritos de batalha, rótulo "Nome (github)"
const agora = Date.now(); const em = new Date(agora).toISOString();
const est = C.normalizar({ ativa: true, log: [{ em, de: 'segredo', item: 'banana', vit: 'vitima', para: 'vitima', faixa: 'normal', dado: 5 }, { em, de: 'a', item: 'alianca', evento: 'alianca', para: 'b' }, { em: new Date(agora - 30 * 864e5).toISOString(), de: 'x', item: 'banana', vit: 'velho', faixa: 'normal' }] });
const f = K.fatos(est, agora, 7); assert.equal(f.length, 2);
assert.ok(f.every((x) => !x.texto.includes('segredo'))); assert.ok(f.some((x) => x.texto.includes('@vitima')) && !f.some((x) => x.texto.includes('@velho')));
const atq = f.find((x) => x.nome === 'Ataque'); assert.equal(atq.falas.length, 2); assert.deepEqual(atq.falas.map((x) => x.q), ['silas', 'tiao']);
assert.ok(K.GRITOS.ataque.some((g) => atq.falas[1].t.includes(g)));
assert.ok(K.NARRADORES.silas && K.NARRADORES.tiao);
assert.ok(!/pixel|compil|bug|null|rollback|loop|commit|deploy/i.test(K.EVENTOS.map((e) => e.txt).join(' ')), 'catálogo fixo sem jargão digital');
const f2 = K.fatos(est, agora, 7, (k) => (k === 'vitima' ? 'Ana (vitima)' : k)); assert.ok(f2.some((x) => x.texto.includes('Ana (vitima)')));
assert.equal(typeof K.liberar, 'function');
console.log('Crônica: todos os testes passaram.');
// Stands: banco, rodízio e exclusividade
const S = require('../lib/stands');
assert.ok(S.BANCO.length >= 60 && new Set(S.BANCO.map((s) => s.id)).size === S.BANCO.length);
assert.ok(S.BANCO.every((s) => s.nome && s.poder && s.fraqueza && s.tags.length && s.tipoNome));
const e0 = S.norm({ semanas: { 1: { ana: { stand: 'punho' }, bia: { stand: 'caval' } }, 2: { ana: { stand: 'punho' } } } });
const v3 = S.visao(e0, 'p', 3, 'ana'); assert.equal(v3.manter, null); assert.equal(v3.atualAcabou, true); // 2 semanas seguidas: precisa trocar
assert.ok(v3.ofertas.length === 3 && !v3.ofertas.some((o) => o.id === 'punho'));
const v2 = S.visao(e0, 'p', 2, 'bia'); assert.ok(v2.manter && v2.manter.id === 'caval'); // pode manter na 2ª semana
assert.ok(!S.visao(e0, 'p', 2, 'bia').ofertas.some((o) => o.id === 'punho')); // ocupado por outro nesta semana
assert.deepEqual(S.visao(e0, 'p', 3, 'ana').ofertas.map((o) => o.id), S.visao(e0, 'p', 3, 'ana').ofertas.map((o) => o.id)); // sorteio estável
console.log('Stands: todos os testes passaram.');
