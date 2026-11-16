'use strict';
// Laboratório de Duelos: uma liga de TESTES só para owners. Cavaleiros fictícios, 3 Stands e um estado próprio (dados/lab/estado.json).
// Usa o mesmo motor da Copa (lib/copa.js), mas nunca toca em turmas, alunos, Stands ou arte reais. Serve para testar regras e animações.
const u = require('./util'); const d = require('./dados'); const C = require('./copa'); const GP = require('./golpes'); const SS = require('./stands');
const CAM = 'dados/lab/estado.json';
const ELENCO = [
  { id: 'ficticio-lab-1', nome: 'Zeca Teste', stand: 'punho', total: 20 },
  { id: 'ficticio-lab-2', nome: 'Dona Chica Teste', stand: 'arco', total: 16 },
  { id: 'ficticio-lab-3', nome: 'Nico Teste', stand: 'neblina', total: 12 },
  { id: 'ficticio-lab-4', nome: 'Lia Teste', stand: '', total: 9 },
  { id: 'ficticio-lab-5', nome: 'Beto Teste', stand: '', total: 4 },
];
const ATAQUES = ['banana', 'casco', 'turbo', 'escudo'];
const hoje = () => new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // início = ontem: sempre semana 1
const fimDe = () => new Date(Date.now() + 90 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const rankDe = () => ELENCO.map((x, i) => ({ usuario: x.id, total: x.total, posicao: i + 1 }));
const stands = () => ({ semanas: { 1: Object.fromEntries(ELENCO.filter((x) => x.stand).map((x) => [x.id, { stand: x.stand, em: new Date().toISOString() }])) } });
const oraculo = () => SS.criarOraculo(stands(), Date.now() - 864e5 * 0.5);
const standDe = (id) => { const e = ELENCO.find((x) => x.id === id); return e && e.stand ? SS.POR_ID[e.stand] : null; };
const limpo = (cur) => { const e = C.normalizar(cur); e.ativa = true; return e; };
async function visual(id) { try { return await require('./arte').visual(id, (standDe(id) || {}).id || ''); } catch { return {}; } }
async function ler(res, { dono }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  const { dados } = await d.lerJson(CAM); const est = limpo(dados); const agora = Date.now(); const pl = C.placar(est, rankDe(), agora, fimDe());
  const cav = await Promise.all(ELENCO.map(async (x) => { const s = standDe(x.id); const l = pl.find((p) => p.usuario === x.id) || {};
    return { id: x.id, nome: x.nome, stand: s ? { id: s.id, nome: s.nome, tipo: s.tipoNome, ic: s.ic, furtivo: !!s.furtivo } : null, visual: await visual(x.id), pontos: l.copa, efeito: l.efeito, escudo: !!l.escudo };
  }));
  return u.json(res, 200, { cavaleiros: cav, itens: Object.fromEntries(ATAQUES.map((k) => [k, { ...C.ITENS[k] }])), log: (est.log || []).slice(-10).reverse(), gritos: require('./cronica').GRITOS });
}
async function usar(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  const de = String(b.de || ''), alvo = String(b.alvo || ''), item = String(b.item || '');
  if (!ELENCO.some((x) => x.id === de)) return u.json(res, 400, { erro: 'Escolha quem vai agir.' });
  if (!ATAQUES.includes(item)) return u.json(res, 400, { erro: 'Item inválido.' });
  const def = C.ITENS[item]; if (def.alvo === 'outro' && !ELENCO.some((x) => x.id === alvo && x.id !== de)) return u.json(res, 400, { erro: 'Escolha o alvo.' });
  let out = null; const agora = Date.now(); const orc = oraculo(); const eu0 = standDe(de);
  await d.mudarJson(CAM, (cur) => {
    const e = limpo(cur); e.usos = {}; e.inventario[de] = [{ id: 'lab' + agora, tipo: item, semana: 1, bonus: true }]; // o laboratório sempre dá o item
    const r = C.usar(e, de, 'lab' + agora, def.alvo === 'outro' ? alvo : '', rankDe(), hoje(), agora, fimDe(), { golpe: (tp) => GP.golpe(eu0, tp), duelo: (al, ev) => orc.duelo(de, al, agora, ev) });
    out = r; if (r.erro) return e; C.limpar(e, agora); return e;
  }, `Laboratório: ${usuario} testou ${item}`);
  if (out.erro) return u.json(res, 400, { erro: out.erro });
  const g = GP.golpe(eu0, item);
  return u.json(res, 200, { ok: true, resultado: out.resultado, faixa: out.faixa, dado: out.dado, golpe: g, de, alvo, item, visualDe: await visual(de), visualAlvo: alvo ? await visual(alvo) : null });
}
async function zerar(res, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  await d.mudarJson(CAM, () => limpo(null), `Laboratório: ${usuario} zerou o placar`);
  return u.json(res, 200, { ok: true });
}
module.exports = { ler, usar, zerar, ELENCO };
