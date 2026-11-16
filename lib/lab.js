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
async function visual(id, mapa) { const sid = ((mapa[id] && SS.POR_ID[mapa[id]]) || {}).id || ''; const A = require('./arte');
  try { return await A.visual(id, sid); } catch { return { cavalo: A.provisoriaPiloto(id), arteCavalo: '', standCores: sid ? A.provisoriaStand(sid) : null, arteStand: '', anim: {}, provisoria: { piloto: true, stand: true } }; } } // sem arte final (ou sem acesso ao GitHub): arte provisória
// Sem GitHub: o estado do laboratório vive no navegador do owner (sessionStorage) e vai e volta a cada pedido. Rápido, sem commits e sem leitura velha.
async function vista(est) {
  const mapa = mapaStands(est); const evo = est.labEvo || {}; const agora = Date.now(); const pl = C.placar(est, rankDe(), agora, fimDe());
  const cav = await Promise.all(ELENCO.map(async (x) => { const s = standDe(x.id, mapa, evo); const ass = s ? C.ASSINATURAS[s.tipo] : null; const l = pl.find((p) => p.usuario === x.id) || {};
    return { id: x.id, nome: x.nome, stand: s ? { id: s.id, nome: s.nome, tipo: s.tipoNome, tipoId: s.tipo, ic: s.ic, furtivo: !!s.furtivo, ataque: (GP.golpe(s, 'banana') || {}).nome, golpeFinal: (GP.G[s.id] || [])[1], evoluido: !!s.evoluido, casco: (GP.golpe(s, 'casco') || {}).nome, defesa: (GP.golpe(s, 'escudo') || {}).nome, assinatura: ass ? { ic: ass[0], nome: ass[1], txt: ass[2] } : null } : null, visual: await visual(x.id, mapa), pontos: l.copa, base: x.total, efeito: l.efeito, escudo: !!l.escudo };
  }));
  return { cavaleiros: cav, itens: Object.fromEntries(ATAQUES.map((k) => [k, { ...C.ITENS[k] }])), log: (est.log || []).slice(-10).reverse(), gritos: require('./cronica').GRITOS, banco: SS.BANCO.map((b) => ({ id: b.id, nome: b.nome, tipo: b.tipoNome, ic: b.ic })).sort((a, b) => a.nome.localeCompare(b.nome)) };
}
async function operar(res, b, { dono }) {
  if (!dono) return u.json(res, 403, { erro: 'O Laboratório é só para owners.' });
  let est = limpo(b.estado && typeof b.estado === 'object' && JSON.stringify(b.estado).length < 300000 ? b.estado : null);
  const op = String(b.op || 'ler'); let extra = {};
  if (op === 'zerar') { const k = { labStands: est.labStands, labEvo: est.labEvo }; est = limpo(null); if (k.labStands) est.labStands = k.labStands; if (k.labEvo) est.labEvo = k.labEvo; }
  else if (op === 'stand') {
    const id = String(b.id || ''); if (!ELENCO.some((x) => x.id === id)) return u.json(res, 400, { erro: 'Cavaleiro inválido.' });
    if (b.stand !== undefined) { const sid = String(b.stand || ''); if (sid && !SS.POR_ID[sid]) return u.json(res, 400, { erro: 'Stand desconhecido.' }); est.labStands = { ...(est.labStands || {}), [id]: sid }; }
    if (b.evoluido !== undefined) est.labEvo = { ...(est.labEvo || {}), [id]: !!b.evoluido };
  } else if (op === 'usar') {
    const de = String(b.de || ''), alvo = String(b.alvo || ''), item = String(b.item || '');
    if (!ELENCO.some((x) => x.id === de)) return u.json(res, 400, { erro: 'Escolha quem vai agir.' });
    if (!ATAQUES.includes(item)) return u.json(res, 400, { erro: 'Item inválido.' });
    const def = C.ITENS[item]; if (def.alvo === 'outro' && !ELENCO.some((x) => x.id === alvo && x.id !== de)) return u.json(res, 400, { erro: 'Escolha o alvo.' });
    const agora = Date.now(); const mapa = mapaStands(est); const orc = oraculo(mapa, est.labEvo); const eu0 = standDe(de, mapa, est.labEvo);
    const antes = Object.fromEntries(C.placar(est, rankDe(), agora, fimDe()).map((p) => [p.usuario, p.copa]));
    est.usos = {}; est.inventario[de] = [{ id: 'lab' + agora, tipo: item, semana: 1, bonus: true }]; // o laboratório sempre dá o item
    const r = C.usar(est, de, 'lab' + agora, def.alvo === 'outro' ? alvo : '', rankDe(), hoje(), agora, fimDe(), { golpe: (tp) => GP.golpe(eu0, tp), tipoStand: eu0 ? eu0.tipo : '', duelo: (al, ev) => orc.duelo(de, al, agora, ev) });
    if (r.erro) return u.json(res, 400, { erro: r.erro });
    C.limpar(est, agora);
    const depois = C.placar(est, rankDe(), agora, fimDe()); const mudou = depois.map((p) => ({ id: p.usuario, de: antes[p.usuario], para: p.copa })).filter((x) => x.de !== x.para);
    extra = { resultado: r.resultado, faixa: r.faixa, dado: r.dado, golpe: GP.golpe(eu0, item), de, alvo, item, mudou, bloqueado: !!r.bloqueado, tipoAtq: eu0 ? eu0.tipo : '', antes };
  }
  return u.json(res, 200, { estado: est, ...(await vista(est)), ...extra });
}
module.exports = { operar, ELENCO };
