'use strict';
// Arte do Spin Run LAG. Enquanto um Stand, cavaleiro ou cavalo não tem arte final, o sistema mostra uma arte provisória SORTEADA
// (cores por semente fixa, então não muda a cada visita). Quando a arte final é definida, ela sempre prevalece.
// Cada Stand tem 5 itens (nome, arte, movimento, ataque, defesa) e cada cavaleiro 1 (cavaleiro e cavalo). Depois de enviado, o item fica TRAVADO:
// só um owner pode reabrir. Tudo que o aluno envia fica pendente até o professor aprovar. Arte e nome de Stand valem para quem o escolher.
const crypto = require('crypto');
const u = require('./util'); const d = require('./dados');
const CAMINHO = 'dados/arte/final.json';
const ARQUIVO_RE = /^(\/|https:\/\/)[\w\-./%]+\.(png|gif|webp|svg)$/i; // mantido para testes
const urlDe = (img) => '/api/imagem?n=' + encodeURIComponent(img);
const PELES = [['#8a4b24', '#5e3016', '#1d0f06'], ['#e8dcc4', '#a89c82', '#5a5a5a'], ['#2b2b2b', '#161616', '#0d0d0d'], ['#b9772f', '#8a5520', '#3a2414'], ['#c9a46a', '#977a45', '#f2e3b8'], ['#6d6d70', '#4a4a4d', '#222'], ['#7a3b1c', '#52280f', '#e8dcc4']];
const ROUPAS = [['#c0392b', '#8e2418'], ['#2f5d9a', '#1d3d6e'], ['#2e7d4f', '#1b5033'], ['#6a3d8f', '#472767'], ['#d98b1f', '#a6650c'], ['#3b3b3b', '#1f1f1f'], ['#1f8a8a', '#116060']];
const CHAPEUS = ['#3a2414', '#e8dcc4', '#1f1f1f', '#7a3b1c', '#2f5d9a'];
const CACHECOIS = ['#f2b134', '#c0392b', '#e8dcc4', '#2fa6a0', '#6a3d8f'];
const STANDS = [['#9b59d6', '#4b1f7a', '#d8b4ff'], ['#27b5ae', '#0b4f55', '#a4fff5'], ['#e0553a', '#6e1f10', '#ffc2b0'], ['#e3b13b', '#7a5a0b', '#fff0b0'], ['#4f8fe0', '#16376e', '#bfd9ff'], ['#58b368', '#1c5a2a', '#c4f5cc'], ['#d159a6', '#6b1a50', '#ffc2e8'], ['#8e8e9a', '#3a3a46', '#e6e6f0']];
const hn = (t) => crypto.createHash('sha1').update(t).digest().readUInt32BE(0);
const pega = (l, t) => l[hn(t) % l.length];
// Sorteio fixo por semente: o mesmo cavaleiro/Stand sempre recebe a mesma arte provisória.
function provisoriaPiloto(usuario) { const p = pega(PELES, 'pele|' + usuario), r = pega(ROUPAS, 'roupa|' + usuario); return { pele: p[0], pele2: p[1], crina: p[2], sela: r[0], casaco: r[0], casaco2: r[1], chapeu: pega(CHAPEUS, 'chapeu|' + usuario), cachecol: pega(CACHECOIS, 'cachecol|' + usuario) }; }
function provisoriaStand(id) { const s = pega(STANDS, 'stand|' + id); return { s1: s[0], s2: s[1], s3: s[2] }; }
const SLOTS = { stand: ['nome', 'arte', 'movimento', 'ataque', 'defesa'], piloto: ['cavalo'] };
const ROTULO = { nome: 'Nome do Stand', arte: 'Arte do Stand', movimento: 'Movimento do Stand', ataque: 'Ataque do Stand', defesa: 'Defesa do Stand', cavalo: 'Cavaleiro e cavalo (galope)' };
const NOME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '\-]{2,29}$/u;
const vazio = () => ({ stands: {}, pilotos: {}, pendentes: {}, reabertos: {} });
const CACHE = { em: 0, f: null };
async function ler(fresco) {
  if (!fresco && CACHE.f && Date.now() - CACHE.em < 15000) return CACHE.f;
  const { dados } = await d.lerJson(CAMINHO); const x = dados && typeof dados === 'object' ? dados : {};
  CACHE.f = { stands: x.stands || {}, pilotos: x.pilotos || {}, pendentes: x.pendentes || {}, reabertos: x.reabertos || {} }; CACHE.em = Date.now(); return CACHE.f;
}
// Nomes aprovados valem em todo o sistema (crônica, Copa, telas).
async function aplicarNomes() {
  const SS = require('./stands'); const f = await ler();
  for (const s of SS.BANCO) { if (!s.nomeOriginal) s.nomeOriginal = s.nome; const n = f.stands[s.id] && f.stands[s.id].nome; s.nome = n && n.valor ? n.valor : s.nomeOriginal; }
}
const chaveDe = (tipo, id, slot) => `${tipo}:${id}:${slot}`;
const itemDe = (f, tipo, id, slot) => (tipo === 'stand' ? f.stands[id] : f.pilotos[id] || {})?.[slot] || null;
const valorDe = (x) => (x ? (x.valor !== undefined ? x.valor : urlDe(x.img)) : '');
// Estado de um item: livre | analise | final (final = travado; reaberto = o owner liberou para novo envio).
function estadoDe(f, tipo, id, slot) {
  const c = chaveDe(tipo, id, slot), fin = itemDe(f, tipo, id, slot), pen = f.pendentes[c];
  return { slot, rotulo: ROTULO[slot], estado: pen ? 'analise' : fin ? 'final' : 'livre', reaberto: !!f.reabertos[c], valor: valorDe(fin), pendente: pen ? valorDe(pen) : '', pode: !pen && (!fin || !!f.reabertos[c]) };
}
const estados = (f, tipo, id) => SLOTS[tipo].map((sl) => estadoDe(f, tipo, id, sl));
// Visual completo de um cavaleiro naquele momento (usa a arte final quando existe).
async function visual(usuario, standId) {
  const f = await ler(); const p = f.pilotos[usuario] || {}; const s = standId ? f.stands[standId] || {} : {};
  const anim = {}; for (const k of ['movimento', 'ataque', 'defesa']) if (s[k]) anim[k] = urlDe(s[k].img);
  return { cavalo: provisoriaPiloto(usuario), arteCavalo: p.cavalo ? urlDe(p.cavalo.img) : '', standCores: standId ? provisoriaStand(standId) : null, arteStand: s.movimento ? urlDe(s.movimento.img) : s.arte ? urlDe(s.arte.img) : '', anim, provisoria: { piloto: !p.cavalo, stand: !(s.arte || s.movimento) } };
}

// Lê o arquivo de verdade (não confia na extensão): formato, tamanho em pixels e se tem animação.
function examinar(buf) {
  const r = { fmt: '', w: 0, h: 0, quadros: 1, ms: 0 };
  if (buf.length > 12 && buf.slice(0, 3).toString('latin1') === 'GIF') {
    r.fmt = 'gif'; r.w = buf.readUInt16LE(6); r.h = buf.readUInt16LE(8); r.quadros = 0;
    let i = 13; const gct = buf[10] & 0x80 ? 3 * (1 << ((buf[10] & 7) + 1)) : 0; i += gct;
    while (i < buf.length) {
      const b = buf[i];
      if (b === 0x2c) { r.quadros++; const lct = buf[i + 9] & 0x80 ? 3 * (1 << ((buf[i + 9] & 7) + 1)) : 0; i += 10 + lct + 1; while (i < buf.length && buf[i] !== 0) i += buf[i] + 1; i++; }
      else if (b === 0x21) { if (buf[i + 1] === 0xf9) r.ms += buf.readUInt16LE(i + 4) * 10; i += 2; while (i < buf.length && buf[i] !== 0) i += buf[i] + 1; i++; }
      else if (b === 0x3b) break; else i++;
    }
  } else if (buf.slice(1, 4).toString('latin1') === 'PNG') {
    r.fmt = 'png'; r.w = buf.readUInt32BE(16); r.h = buf.readUInt32BE(20);
    let i = 8; while (i + 8 <= buf.length) { const n = buf.readUInt32BE(i), t = buf.slice(i + 4, i + 8).toString('latin1'); if (t === 'acTL') r.quadros = buf.readUInt32BE(i + 8); if (t === 'fcTL') { const num = buf.readUInt16BE(i + 28), den = buf.readUInt16BE(i + 30) || 100; r.ms += Math.round(1000 * num / den); } if (t === 'IDAT') break; i += 12 + n; }
  } else if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') {
    r.fmt = 'webp'; let i = 12; while (i + 8 <= buf.length) { const t = buf.slice(i, i + 4).toString('latin1'), n = buf.readUInt32LE(i + 4);
      if (t === 'VP8X') { r.w = 1 + buf.readUIntLE(i + 12, 3); r.h = 1 + buf.readUIntLE(i + 15, 3); }
      if (t === 'VP8 ') { r.w = buf.readUInt16LE(i + 14) & 0x3fff; r.h = buf.readUInt16LE(i + 16) & 0x3fff; }
      if (t === 'VP8L') { const v = buf.readUInt32LE(i + 9); r.w = (v & 0x3fff) + 1; r.h = ((v >> 14) & 0x3fff) + 1; }
      if (t === 'ANMF') { r.quadros = (r.quadros === 1 ? 0 : r.quadros) + 1; r.ms += buf.readUIntLE(i + 20, 3); }
      i += 8 + n + (n & 1); }
  } else if (buf[0] === 0xff && buf[1] === 0xd8) {
    r.fmt = 'jpg'; let i = 2; while (i + 9 < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { r.h = buf.readUInt16BE(i + 5); r.w = buf.readUInt16BE(i + 7); break; } i += 2 + buf.readUInt16BE(i + 2); }
  }
  return r;
}
const ANIMADOS = ['movimento', 'ataque', 'defesa', 'cavalo'];
// Confere o arquivo contra as regras do item. Devolve a mensagem de erro, ou '' se estiver ok.
function conferir(slot, buf) {
  const x = examinar(buf);
  if (!x.fmt || !x.w || !x.h) return 'Não consegui ler esse arquivo. Envie PNG, GIF ou WEBP.';
  if (x.w > 512 || x.h > 512) return `A imagem tem ${x.w} x ${x.h} pixels. O máximo é 512 x 512. Reduza o tamanho e envie de novo.`;
  if (x.w < 32 || x.h < 32) return 'A imagem está pequena demais (mínimo 32 x 32 pixels).';
  if (ANIMADOS.includes(slot)) {
    if (x.fmt === 'jpg') return 'Este item precisa ser animado, e JPG não anima. Envie um GIF (ou WEBP/APNG) animado.';
    if (x.quadros < 4) return x.quadros < 2 ? 'Esta imagem é parada. Este item precisa ser uma animação (GIF animado com 4 a 24 quadros).' : 'A animação tem poucos quadros. Use de 4 a 24.';
    if (x.quadros > 24) return `A animação tem ${x.quadros} quadros. Use no máximo 24.`;
    if (x.ms > 3000) return 'A animação passa de 3 segundos. Deixe curta e em loop (até 3 s).';
  } else if (x.quadros > 1) return 'A arte do Stand é uma imagem parada. Para animar, use os itens de movimento, ataque e defesa.';
  return '';
}
// Nomes que já existem em outras obras, e termos que não podem ir para a Copa.
const NOME_PROIBIDO = /(star platinum|the world|crazy diamond|gold experience|killer queen|king crimson|silver chariot|hierophant|magician'?s red|purple haze|stone free|tusk|d4c|made in heaven|dio|jojo|jotaro|giorno|joestar|pikachu|goku|naruto|batman|mario|sonic)/i;
const NOME_FEIO = /(porra|caralho|merda|puta|viado|buceta|cu\b|fdp|nazi|hitler)/i;
const REGRAS = ['Formato: PNG, WEBP ou GIF, até 3 MB e até 512 x 512 pixels. O site confere o arquivo na hora de enviar.', 'Arte do Stand: imagem PARADA (sem animação).', 'Movimento, ataque, defesa e cavaleiro com cavalo: precisam ser ANIMADOS (GIF animado de 4 a 24 quadros, até 3 segundos, em loop). Imagem parada ou JPG é recusada.', 'Fundo transparente e personagem virado para a direita.', 'Arte original, feita por você. Nada de print, foto ou desenho copiado, nem personagens, Stands ou marcas que já existem. Se usar IA, avise o professor.', 'Nome do Stand: de 3 a 30 caracteres, original (sem nomes de outras obras), diferente de qualquer outro Stand, sem ofensas.', 'Sem nomes reais de pessoas e sem conteúdo impróprio.', 'Cada item é enviado uma vez. Depois de enviado, fica travado. Só o professor pode reabrir para você refazer.', 'O professor aprova antes de valer. Enquanto isso, a arte provisória continua.'];
async function standAtual(cfg, usuario, dono, monitor, turmaOk) {
  const copas = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta); if (!copas.length) return '';
  const orc = await require('./stands').contexto(copas); const st = orc.stand(usuario, Date.now()); return st ? st.id : '';
}
async function ler_(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const SS = require('./stands'); await aplicarNomes(); const standId = await standAtual(cfg, usuario, dono, monitor, turmaOk);
  const v = await visual(usuario, standId); const f = await ler();
  const out = { visual: v, dono: !!dono, regras: REGRAS, stand: standId ? { id: standId, nome: SS.POR_ID[standId].nome } : null,
    itens: { stand: standId && !dono ? estados(f, 'stand', standId) : [], piloto: !dono ? estados(f, 'piloto', usuario) : [] } };
  if (dono) {
    const us = [...new Set(Object.values(cfg.turmas || {}).flatMap((t) => t.alunos || []))].filter((a) => !/^ficticio-/.test(a)); const nm = await require('./copaapi').nomesDa(us); const nome = (k) => String(nm[k] || '').trim() || k;
    out.standsBanco = SS.BANCO.map((s) => ({ id: s.id, nome: s.nome, itens: estados(f, 'stand', s.id) })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    out.alunosBanco = us.map((k) => ({ id: k, nome: nome(k), itens: estados(f, 'piloto', k) })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    out.pendentes = Object.entries(f.pendentes).map(([chave, x]) => { const [tipo, id, slot] = chave.split(':'); return { chave, tipo, slot, rotulo: ROTULO[slot], alvo: tipo === 'stand' ? ((SS.POR_ID[id] || {}).nome || id) : nome(id), por: nome(x.por), valor: valorDe(x), texto: x.valor !== undefined, em: x.em }; });
  }
  return u.json(res, 200, out);
}
async function nomeLivre(valor, ignorarId) {
  await aplicarNomes(); const SS = require('./stands'); const alvo = valor.trim().toLowerCase();
  if (SS.BANCO.some((s) => s.id !== ignorarId && (s.nome.toLowerCase() === alvo || (s.nomeOriginal || '').toLowerCase() === alvo))) return false;
  const f = await ler(true); return !Object.entries(f.pendentes).some(([c, x]) => x.valor !== undefined && c.split(':')[1] !== ignorarId && String(x.valor).toLowerCase() === alvo);
}
// Envio. Aluno: só do próprio cavaleiro e do Stand que está com ele; item livre (sem arte e sem envio em análise) ou reaberto por um owner; fica pendente.
// Owner: envia direto (vale na hora); se já houver item final, precisa confirmar a substituição.
async function enviar(res, b, { cfg, usuario, dono, monitor, turmaOk }) {
  const tipo = String(b.tipo || ''), slot = String(b.slot || ''); if (!SLOTS[tipo] || !SLOTS[tipo].includes(slot)) return u.json(res, 400, { erro: 'Escolha o que enviar.' });
  let id = String(b.id || '').toLowerCase().trim();
  if (!dono) { if (tipo === 'piloto') id = usuario; else { id = await standAtual(cfg, usuario, dono, monitor, turmaOk); if (!id) return u.json(res, 403, { erro: 'Você ainda não escolheu um Stand.' }); } }
  else if (!id) return u.json(res, 400, { erro: 'Escolha o Stand ou o aluno.' });
  if (tipo === 'stand' && !require('./stands').POR_ID[id]) return u.json(res, 400, { erro: 'Stand desconhecido.' });
  const f0 = await ler(true); const st = estadoDe(f0, tipo, id, slot);
  if (st.estado === 'analise' && !dono) return u.json(res, 409, { erro: 'Este item já foi enviado e está em análise.' });
  if (!dono && !st.pode) return u.json(res, 403, { erro: 'Este item já foi enviado e está travado. Peça ao professor para reabrir se precisar refazer.' });
  if (dono && st.estado === 'final' && !b.substituir) return u.json(res, 409, { erro: 'Este item já está definido e travado. Para trocar, confirme a substituição.' });
  let reg = { por: usuario, em: new Date().toISOString() };
  if (slot === 'nome') {
    const valor = String(b.valor || '').trim().replace(/\s+/g, ' '); if (!NOME_RE.test(valor)) return u.json(res, 400, { erro: 'Nome de 3 a 30 letras, números, espaço, hífen ou apóstrofo.' });
    if (NOME_PROIBIDO.test(valor)) return u.json(res, 400, { erro: 'Esse nome lembra um personagem ou Stand que já existe em outra obra. Invente um nome original.' });
    if (NOME_FEIO.test(valor)) return u.json(res, 400, { erro: 'Esse nome não é permitido.' });
    if (!(await nomeLivre(valor, id))) return u.json(res, 409, { erro: 'Já existe um Stand com esse nome (ou alguém sugeriu o mesmo). Escolha outro.' });
    reg.valor = valor;
  } else {
    const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dados || '')); if (!m) return u.json(res, 400, { erro: 'Imagem inválida.' });
    const buf = Buffer.from(m[1], 'base64'); const falha = conferir(slot, buf); if (falha) return u.json(res, 400, { erro: falha });
    reg.img = await require('./site').enviarImagem(`${tipo === 'stand' ? 'stand' : 'cav'}-${id}-${slot}`, buf, usuario, []);
  }
  const c = chaveDe(tipo, id, slot);
  await d.mudarJson(CAMINHO, (cur) => {
    const x = Object.assign(vazio(), cur && typeof cur === 'object' ? cur : {});
    if (dono) { if (tipo === 'stand') x.stands[id] = { ...(x.stands[id] || {}), [slot]: reg }; else x.pilotos[id] = { ...(x.pilotos[id] || {}), [slot]: reg }; delete x.pendentes[c]; delete x.reabertos[c]; }
    else x.pendentes[c] = reg;
    return x;
  }, `Arte: ${dono ? 'definida' : 'enviada'} ${c}`);
  CACHE.em = 0; if (dono && slot === 'nome') await aplicarNomes();
  return u.json(res, 200, { ok: true, pendente: !dono });
}
// Professor aprova (vira final e trava) ou recusa (some da fila; o aluno pode enviar outro).
async function decidir(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor aprova.' });
  const chave = String(b.chave || ''); const [tipo, id, slot] = chave.split(':'); if (!SLOTS[tipo] || !SLOTS[tipo].includes(slot) || !id) return u.json(res, 400, { erro: 'Pedido inválido.' });
  let erro = '', recusada = '';
  if (b.aprovar && slot === 'nome') { const f = await ler(true); const p = f.pendentes[chave]; if (p && !(await nomeLivreAprov(p.valor, id, chave))) erro = 'Esse nome já está em uso por outro Stand.'; }
  if (erro) return u.json(res, 409, { erro });
  await d.mudarJson(CAMINHO, (cur) => {
    const x = Object.assign(vazio(), cur && typeof cur === 'object' ? cur : {}); const p = x.pendentes[chave];
    if (!p) { erro = 'Este item não está mais na fila.'; return x; }
    if (b.aprovar) { const reg = { ...p, aprovadaPor: usuario, aprovadaEm: new Date().toISOString() }; if (tipo === 'stand') x.stands[id] = { ...(x.stands[id] || {}), [slot]: reg }; else x.pilotos[id] = { ...(x.pilotos[id] || {}), [slot]: reg }; delete x.reabertos[chave]; }
    if (!b.aprovar && p.img) recusada = p.img;
    delete x.pendentes[chave]; return x;
  }, `Arte: ${b.aprovar ? 'aprovada' : 'recusada'} ${chave}`);
  if (erro) return u.json(res, 409, { erro });
  // Recusada: apaga o arquivo da imagem do repositório (só se nenhum outro item usa o mesmo arquivo).
  if (recusada) { try { const f = await ler(true); const emUso = JSON.stringify(f).includes(recusada); if (!emUso) await require('./site').excluirImagem(String(recusada).replace(/^.*[?&]n=/, ''), usuario, true); } catch (e) { /* o registro já saiu da fila; o arquivo solto pode ser apagado depois na galeria */ } }
  CACHE.em = 0; if (b.aprovar && slot === 'nome') await aplicarNomes();
  return u.json(res, 200, { ok: true });
}
async function nomeLivreAprov(valor, id, chave) {
  await aplicarNomes(); const SS = require('./stands'); const alvo = String(valor).toLowerCase();
  return !SS.BANCO.some((s) => s.id !== id && (s.nome.toLowerCase() === alvo || (s.nomeOriginal || '').toLowerCase() === alvo));
}
// Só um owner reabre um item travado para novo envio do aluno.
async function reabrir(res, b, { dono }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor reabre.' });
  const chave = String(b.chave || ''); const [tipo, id, slot] = chave.split(':'); if (!SLOTS[tipo] || !SLOTS[tipo].includes(slot) || !id) return u.json(res, 400, { erro: 'Pedido inválido.' });
  await d.mudarJson(CAMINHO, (cur) => { const x = Object.assign(vazio(), cur && typeof cur === 'object' ? cur : {}); if (b.reabrir === false) delete x.reabertos[chave]; else x.reabertos[chave] = true; return x; }, `Arte: ${b.reabrir === false ? 'travada' : 'reaberta'} ${chave}`);
  CACHE.em = 0; return u.json(res, 200, { ok: true });
}
module.exports = { ler_: ler, ler: ler_, enviar, decidir, reabrir, visual, aplicarNomes, provisoriaPiloto, provisoriaStand, ARQUIVO_RE, urlDe, SLOTS, REGRAS, examinar, conferir };
