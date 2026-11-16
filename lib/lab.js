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
// Stand de cada cavaleiro de teste: o padrão do elenco, ou o que o owner trocou (est.labStands).
const mapaStands = (est) => Object.fromEntries(ELENCO.map((x) => [x.id, (est && est.labStands && x.id in est.labStands) ? est.labStands[x.id] : x.stand]));
const stands = (mapa, evo) => { const f = (so) => Object.fromEntries(Object.entries(mapa).filter(([id, sid]) => sid && SS.POR_ID[sid] && (!so || evo[id])).map(([id, sid]) => [id, { stand: sid, em: new Date().toISOString() }])); return { semanas: { 1: f(true), 2: f(false) } }; }; // semana 2 = atual; semana 1 só para quem está evoluído
const oraculo = (mapa, evo) => SS.criarOraculo(stands(mapa, evo || {}), Date.now() - 8 * 864e5);
const standDe = (id, mapa, evo) => { const sid = mapa[id]; return sid && SS.POR_ID[sid] ? { ...SS.POR_ID[sid], evoluido: !!(evo && evo[id]) } : null; };
const limpo = (cur) => { const e = C.normalizar(cur); e.ativa = true; return e; };
async function visual(id, mapa) { try { return await require('./arte').visual(id, ((mapa[id] && SS.POR_ID[mapa[id]]) || {}).id || ''); } catch { return {}; } }
async function ler(res, { dono }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  const { dados } = await d.lerJson(CAM); const est = limpo(dados); const mapa = mapaStands(est); const evo = est.labEvo || {}; const agora = Date.now(); const pl = C.placar(est, rankDe(), agora, fimDe());
  const cav = await Promise.all(ELENCO.map(async (x) => { const s = standDe(x.id, mapa, evo); const ass = s ? C.ASSINATURAS[s.tipo] : null; const l = pl.find((p) => p.usuario === x.id) || {};
    return { id: x.id, nome: x.nome, stand: s ? { id: s.id, nome: s.nome, tipo: s.tipoNome, tipoId: s.tipo, ic: s.ic, furtivo: !!s.furtivo, ataque: (GP.golpe(s, 'banana') || {}).nome, golpeFinal: (GP.G[s.id] || [])[1], evoluido: !!s.evoluido, casco: (GP.golpe(s, 'casco') || {}).nome, defesa: (GP.golpe(s, 'escudo') || {}).nome, assinatura: ass ? { ic: ass[0], nome: ass[1], txt: ass[2] } : null } : null, visual: await visual(x.id, mapa), pontos: l.copa, efeito: l.efeito, escudo: !!l.escudo };
  }));
  return u.json(res, 200, { cavaleiros: cav, itens: Object.fromEntries(ATAQUES.map((k) => [k, { ...C.ITENS[k] }])), log: (est.log || []).slice(-10).reverse(), gritos: require('./cronica').GRITOS, banco: SS.BANCO.map((b) => ({ id: b.id, nome: b.nome, tipo: b.tipoNome, ic: b.ic })).sort((a, b) => a.nome.localeCompare(b.nome)) });
}
async function usar(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  const de = String(b.de || ''), alvo = String(b.alvo || ''), item = String(b.item || '');
  if (!ELENCO.some((x) => x.id === de)) return u.json(res, 400, { erro: 'Escolha quem vai agir.' });
  if (!ATAQUES.includes(item)) return u.json(res, 400, { erro: 'Item inválido.' });
  const def = C.ITENS[item]; if (def.alvo === 'outro' && !ELENCO.some((x) => x.id === alvo && x.id !== de)) return u.json(res, 400, { erro: 'Escolha o alvo.' });
  let out = null; const agora = Date.now(); let orc = null, eu0 = null;
  await d.mudarJson(CAM, (cur) => {
    const e = limpo(cur); const mapa = mapaStands(e); orc = oraculo(mapa, e.labEvo); eu0 = standDe(de, mapa, e.labEvo); e.usos = {}; e.inventario[de] = [{ id: 'lab' + agora, tipo: item, semana: 1, bonus: true }]; // o laboratório sempre dá o item
    const r = C.usar(e, de, 'lab' + agora, def.alvo === 'outro' ? alvo : '', rankDe(), hoje(), agora, fimDe(), { golpe: (tp) => GP.golpe(eu0, tp), tipoStand: eu0 ? eu0.tipo : '', duelo: (al, ev) => orc.duelo(de, al, agora, ev) });
    out = r; if (r.erro) return e; C.limpar(e, agora); return e;
  }, `Laboratório: ${usuario} testou ${item}`);
  if (out.erro) return u.json(res, 400, { erro: out.erro });
  const g = GP.golpe(eu0, item); const mapa2 = mapaStands(limpo((await d.lerJson(CAM)).dados));
  return u.json(res, 200, { ok: true, resultado: out.resultado, faixa: out.faixa, dado: out.dado, golpe: g, de, alvo, item, visualDe: await visual(de, mapa2), visualAlvo: alvo ? await visual(alvo, mapa2) : null });
}
async function trocarStand(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  const id = String(b.id || ''), sid = b.stand === undefined ? null : String(b.stand || '');
  if (!ELENCO.some((x) => x.id === id)) return u.json(res, 400, { erro: 'Cavaleiro inválido.' });
  if (sid && !SS.POR_ID[sid]) return u.json(res, 400, { erro: 'Stand desconhecido.' });
  await d.mudarJson(CAM, (cur) => { const e = limpo(cur); if (sid !== null) e.labStands = { ...(e.labStands || {}), [id]: sid }; if (b.evoluido !== undefined) e.labEvo = { ...(e.labEvo || {}), [id]: !!b.evoluido }; return e; }, `Laboratório: ${usuario} trocou o Stand de ${id}`);
  return u.json(res, 200, { ok: true });
}
async function zerar(res, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  await d.mudarJson(CAM, (cur) => { const e = limpo(null); if (cur && cur.labStands) e.labStands = cur.labStands; if (cur && cur.labEvo) e.labEvo = cur.labEvo; return e; }, `Laboratório: ${usuario} zerou o placar`);
  return u.json(res, 200, { ok: true });
}
module.exports = { ler, usar, zerar, trocarStand, ELENCO };
