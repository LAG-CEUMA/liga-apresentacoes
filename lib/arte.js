'use strict';
// Arte do Spin Run LAG. Enquanto um Stand, cavaleiro ou cavalo não tem arte final, o sistema mostra uma arte provisória SORTEADA
// (cores por semente fixa, então não muda a cada visita). Quando a arte final é definida, ela sempre prevalece.
// Arte de Stand é presa ao Stand: uma vez definida, não muda mais (nem ao trocar de dono). O professor só troca confirmando de propósito.
const crypto = require('crypto');
const u = require('./util'); const d = require('./dados');
const CAMINHO = 'dados/arte/final.json';
const ARQUIVO_RE = /^(\/|https:\/\/)[\w\-./%]+\.(png|gif|webp|svg)$/i;
const PELES = [['#8a4b24', '#5e3016', '#1d0f06'], ['#e8dcc4', '#a89c82', '#5a5a5a'], ['#2b2b2b', '#161616', '#0d0d0d'], ['#b9772f', '#8a5520', '#3a2414'], ['#c9a46a', '#977a45', '#f2e3b8'], ['#6d6d70', '#4a4a4d', '#222'], ['#7a3b1c', '#52280f', '#e8dcc4']];
const ROUPAS = [['#c0392b', '#8e2418'], ['#2f5d9a', '#1d3d6e'], ['#2e7d4f', '#1b5033'], ['#6a3d8f', '#472767'], ['#d98b1f', '#a6650c'], ['#3b3b3b', '#1f1f1f'], ['#1f8a8a', '#116060']];
const CHAPEUS = ['#3a2414', '#e8dcc4', '#1f1f1f', '#7a3b1c', '#2f5d9a'];
const CACHECOIS = ['#f2b134', '#c0392b', '#e8dcc4', '#2fa6a0', '#6a3d8f'];
const STANDS = [['#9b59d6', '#4b1f7a', '#d8b4ff'], ['#27b5ae', '#0b4f55', '#a4fff5'], ['#e0553a', '#6e1f10', '#ffc2b0'], ['#e3b13b', '#7a5a0b', '#fff0b0'], ['#4f8fe0', '#16376e', '#bfd9ff'], ['#58b368', '#1c5a2a', '#c4f5cc'], ['#d159a6', '#6b1a50', '#ffc2e8'], ['#8e8e9a', '#3a3a46', '#e6e6f0']];
const hn = (t) => crypto.createHash('sha1').update(t).digest().readUInt32BE(0);
const pega = (l, t) => l[hn(t) % l.length];
// Sorteio fixo por semente: o mesmo piloto/Stand sempre recebe a mesma arte provisória.
function provisoriaPiloto(usuario) { const p = pega(PELES, 'pele|' + usuario), r = pega(ROUPAS, 'roupa|' + usuario); return { pele: p[0], pele2: p[1], crina: p[2], sela: r[0], casaco: r[0], casaco2: r[1], chapeu: pega(CHAPEUS, 'chapeu|' + usuario), cachecol: pega(CACHECOIS, 'cachecol|' + usuario) }; }
function provisoriaStand(id) { const s = pega(STANDS, 'stand|' + id); return { s1: s[0], s2: s[1], s3: s[2] }; }
const vazio = () => ({ stands: {}, pilotos: {} });
async function ler() { const { dados } = await d.lerJson(CAMINHO); const x = dados && typeof dados === 'object' ? dados : {}; return { stands: x.stands || {}, pilotos: x.pilotos || {} }; }
// Visual completo de um piloto naquele momento (usa a arte final quando existe).
async function visual(usuario, standId) {
  const f = await ler(); const p = f.pilotos[usuario] || {}; const s = standId ? f.stands[standId] : null;
  return { cavalo: provisoriaPiloto(usuario), arteCavalo: p.cavalo ? p.cavalo.arquivo : '', standCores: standId ? provisoriaStand(standId) : null, arteStand: s ? s.arquivo : '', provisoria: { piloto: !p.cavalo, stand: !s } };
}
async function ler_(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const SS = require('./stands'); const copas = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta);
  let standId = '', standNome = '';
  if (copas.length) { const orc = await SS.contexto(copas); const st = orc.stand(usuario, Date.now()); if (st) { standId = st.id; standNome = st.nome; } }
  const v = await visual(usuario, standId);
  const out = { visual: v, stand: standId ? { id: standId, nome: standNome } : null };
  if (dono) { const f = await ler(); out.dono = true; out.finais = { stands: Object.keys(f.stands).length, pilotos: Object.keys(f.pilotos).length, lista: [...Object.entries(f.stands).map(([k, x]) => ({ tipo: 'stand', id: k, arquivo: x.arquivo })), ...Object.entries(f.pilotos).flatMap(([k, x]) => ['cavalo'].filter((q) => x[q]).map((q) => ({ tipo: 'piloto', id: k, arquivo: x[q].arquivo })))] }; out.standsBanco = SS.BANCO.map((s) => ({ id: s.id, nome: s.nome })); }
  return u.json(res, 200, out);
}
// Só o professor define arte final. Arte de Stand já definida fica bloqueada, a menos que `substituir` seja confirmado.
async function definir(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor define a arte final.' });
  const tipo = String(b.tipo || ''), id = String(b.id || '').toLowerCase().trim(), arquivo = String(b.arquivo || '').trim();
  if (!['stand', 'piloto'].includes(tipo) || !id) return u.json(res, 400, { erro: 'Escolha o tipo e o Stand ou piloto.' });
  if (tipo === 'stand' && !require('./stands').POR_ID[id]) return u.json(res, 400, { erro: 'Stand desconhecido.' });
  if (!ARQUIVO_RE.test(arquivo)) return u.json(res, 400, { erro: 'O arquivo precisa ser um caminho (/arte/...) ou link https terminando em png, gif, webp ou svg.' });
  let erro = '';
  await d.mudarJson(CAMINHO, (cur) => {
    const x = cur && typeof cur === 'object' ? cur : vazio(); x.stands = x.stands || {}; x.pilotos = x.pilotos || {};
    if (tipo === 'stand') { if (x.stands[id] && !b.substituir) { erro = 'Este Stand já tem arte final e está bloqueado. Para trocar, confirme a substituição.'; return x; } x.stands[id] = { arquivo, por: usuario, em: new Date().toISOString() }; }
    else { x.pilotos[id] = { ...(x.pilotos[id] || {}), cavalo: { arquivo, por: usuario, em: new Date().toISOString() } }; }
    return x;
  }, `Arte final: ${tipo} ${id}`);
  if (erro) return u.json(res, 409, { erro });
  return u.json(res, 200, { ok: true });
}
module.exports = { ler: ler_, definir, visual, provisoriaPiloto, provisoriaStand, ARQUIVO_RE };
