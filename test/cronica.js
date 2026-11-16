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
assert.ok(f.some((x) => x.texto.includes('@vitima')) && !f.some((x) => x.texto.includes('@velho')));
assert.ok(f.some((x) => x.nome === 'Ataque' && x.texto.includes('@segredo'))); // ataques agora são públicos
const f3 = K.fatos(est, agora, 7, null, (k) => k === 'segredo'); assert.ok(f3.every((x) => !x.texto.includes('segredo'))); // exceto Stand furtivo
const atq = f3.find((x) => x.nome === 'Ataque'); assert.equal(atq.falas.length, 2); assert.deepEqual(atq.falas.map((x) => x.q), ['silas', 'tiao']);
assert.ok(K.GRITOS.ataque.some((g) => atq.falas[1].t.includes(g)));
assert.ok(K.NARRADORES.silas && K.NARRADORES.tiao);
assert.ok(!/pixel|compil|bug|null|rollback|loop|commit|deploy/i.test(K.EVENTOS.map((e) => e.txt).join(' ')), 'catálogo fixo sem jargão digital');
const f2 = K.fatos(est, agora, 7, (k) => (k === 'vitima' ? 'Ana (vitima)' : k)); assert.ok(f2.some((x) => x.texto.includes('Ana (vitima)')));
assert.equal(typeof K.liberar, 'function');
console.log('Crônica: todos os testes passaram.');
// Stands: banco, rodízio e exclusividade
const S = require('../lib/stands');
assert.ok(S.BANCO.length >= 120 && new Set(S.BANCO.map((s) => s.id)).size === S.BANCO.length);
assert.ok(S.BANCO.every((s) => s.nome && s.poder && s.fraqueza && s.tags.length && s.tipoNome));
const e0 = S.norm({ semanas: { 1: { ana: { stand: 'punho' }, bia: { stand: 'caval' } }, 2: { ana: { stand: 'punho' } } } });
const v3 = S.visao(e0, 3, 'ana'); assert.equal(v3.manter, null); assert.equal(v3.atualAcabou, true); // 2 semanas seguidas: precisa trocar
assert.ok(v3.ofertas.length === 3 && !v3.ofertas.some((o) => o.id === 'punho'));
const v2 = S.visao(e0, 2, 'bia'); assert.ok(v2.manter && v2.manter.id === 'caval'); // pode manter na 2ª semana
assert.ok(!S.visao(e0, 2, 'bia').ofertas.some((o) => o.id === 'punho')); // ocupado por outro nesta semana
assert.deepEqual(S.visao(e0, 3, 'ana').ofertas.map((o) => o.id), S.visao(e0, 3, 'ana').ofertas.map((o) => o.id)); // sorteio estável
console.log('Stands: todos os testes passaram.');
// Golpes próprios, furtividade com chance e plano de batalha
{
  const GP = require('../lib/golpes'); const S2 = require('../lib/stands');
  for (const s of S2.BANCO) { const g = GP.G[s.id]; assert.ok(g && g.length === 3 && g.every((x) => x && x.length > 3), 'golpes de ' + s.id); assert.ok(GP.golpe(s, 'banana').nome === g[0] && GP.golpe(s, 'escudo').nome === g[2]); }
  assert.ok(Object.keys(GP.G).length === S2.BANCO.length);
  assert.ok(Object.keys(S2.ADV).every((t) => S2.ADV[t].length === 2));
  const furt = S2.BANCO.find((s) => s.furtivo), rastro = S2.BANCO.find((s) => s.tipo === 'rastro' && !s.furtivo), corpo = S2.BANCO.find((s) => s.tipo === 'corpo'), truque = S2.BANCO.find((s) => s.tipo === 'truque' && !s.furtivo);
  const orc = S2.criarOraculo({ base: '2026-01-05T00:00:00Z', semanas: { 1: { a: { stand: furt.id }, b: { stand: rastro.id }, c: { stand: corpo.id }, d: { stand: truque.id } } } }, new Date('2026-01-05T00:00:00Z').getTime());
  const ms = new Date('2026-01-06T10:00:00Z').getTime(); let ocu = 0, ocuR = 0;
  for (let i = 0; i < 400; i++) { const em = new Date(ms + i * 1000).toISOString(); if (orc.oculto('a', 'c', em)) ocu++; if (orc.oculto('a', 'b', em)) ocuR++; }
  assert.ok(ocu > 230 && ocu < 330, 'chance ~70%: ' + ocu); assert.ok(ocuR > 70 && ocuR < 170, 'contra rastreador ~30%: ' + ocuR); assert.ok(!orc.oculto('c', 'a', new Date(ms).toISOString()));
  assert.strictEqual(orc.duelo('c', 'd', ms).aj, 1); assert.strictEqual(orc.duelo('d', 'c', ms).aj, -1); assert.strictEqual(orc.duelo('c', 'c', ms).aj, 0);
  console.log('Golpes/duelo: ok');
}
{
  const A = require('../lib/arte'); const a1 = A.provisoriaPiloto('ana'), a2 = A.provisoriaPiloto('ana');
  assert.deepStrictEqual(a1, a2); assert.ok(A.provisoriaStand('punho').s1);
  assert.ok(A.ARQUIVO_RE.test('/arte/stand-arco.gif') && !A.ARQUIVO_RE.test('javascript:alert(1)') && !A.ARQUIVO_RE.test('http://x.com/a.png'));
  console.log('Arte: ok');
}

// Arte: conferência do arquivo (parado x animado, tamanho)
{
  const A = require('../lib/arte'); const assert = require('assert');
  const gif = (n, w = 64) => { const q = [Buffer.from('GIF89a'), Buffer.from([w & 255, w >> 8, w & 255, w >> 8, 0x80, 0, 0]), Buffer.from([0, 0, 0, 255, 255, 255])]; for (let i = 0; i < n; i++) q.push(Buffer.from([0x21, 0xf9, 4, 1, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, w & 255, w >> 8, w & 255, w >> 8, 0, 2, 2, 0x44, 1, 0])); q.push(Buffer.from([0x3b])); return Buffer.concat(q); };
  assert(A.conferir('ataque', gif(1)).includes('parada'));
  assert.strictEqual(A.conferir('ataque', gif(8)), '');
  assert(A.conferir('ataque', gif(30)).includes('24'));
  assert(A.conferir('dano', gif(1, 600)).includes('512'));
  assert(A.conferir('cavalo_correndo', gif(1)).includes('parada'));
  assert(A.conferir('ataque', gif(8).fill(0, 0, 0) && Buffer.from(gif(8).toString('latin1').split('\x21\xf9\x04\x01').join('\x21\xf9\x04\x00'), 'latin1')).includes('transparente'));
  assert(A.conferir('cavalo', Buffer.from('lixo')).includes('ler'));
  console.log('Arte conferir: ok');
}

// Laboratório: motor roda com estado próprio e só para owner
{
  const assert = require('assert'); const L = require('../lib/lab');
  assert.strictEqual(L.ELENCO.length, 5); assert(L.ELENCO.every((x) => /^ficticio-/.test(x.id)));
  assert.strictEqual(L.ELENCO.filter((x) => x.stand).length, 3);
  console.log('Laboratório: ok');
}

// Ataque exclusivo por Stand, assinatura por tipo e evolução
{
  const assert = require('assert'); const GP = require('../lib/golpes'); const SS = require('../lib/stands'); const C = require('../lib/copa');
  const ataques = SS.BANCO.map((s) => GP.golpe(s, 'banana').nome); assert.strictEqual(new Set(ataques).size, 120, 'ataques exclusivos');
  assert(SS.BANCO.every((s) => C.ASSINATURAS[s.tipo]), 'todo tipo tem assinatura'); assert.strictEqual(Object.keys(C.ASSINATURAS).length, 8);
  const s = SS.BANCO[0]; assert.strictEqual(GP.golpe(s, 'casco').nome, GP.golpe(s, 'banana').nome);
  assert.strictEqual(GP.golpe({ ...s, evoluido: true }, 'casco').nome, GP.G[s.id][1]); assert.notStrictEqual(GP.G[s.id][1], GP.G[s.id][0]);
  const est = { semanas: { 1: { u: { stand: s.id, em: new Date().toISOString() } }, 2: { u: { stand: s.id, em: new Date().toISOString() } } } };
  const base = Date.now() - 8 * 864e5; const o = SS.criarOraculo(est, base); assert.strictEqual(o.stand('u', Date.now()).evoluido, true);
  assert.strictEqual(SS.criarOraculo({ semanas: { 2: est.semanas[2] } }, base).stand('u', Date.now()).evoluido, false);
  console.log('Ataques/assinaturas/evolução: ok');
}
