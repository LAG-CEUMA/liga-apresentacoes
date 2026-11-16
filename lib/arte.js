'use strict';
// Arte do Spin Run LAG. Enquanto um Stand, cavaleiro ou cavalo não tem arte final, o sistema mostra uma arte provisória SORTEADA
// (cores por semente fixa, então não muda a cada visita). Quando a arte final é definida, ela sempre prevalece.
// Arte de Stand é presa ao Stand: uma vez definida, não muda mais (nem ao trocar de dono). O professor só troca confirmando de propósito.
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
const vazio = () => ({ stands: {}, pilotos: {}, pendentes: {} });
async function ler() { const { dados } = await d.lerJson(CAMINHO); const x = dados && typeof dados === 'object' ? dados : {}; return { stands: x.stands || {}, pilotos: x.pilotos || {}, pendentes: x.pendentes || {} }; }
// Visual completo de um cavaleiro naquele momento (usa a arte final quando existe).
async function visual(usuario, standId) {
  const f = await ler(); const p = f.pilotos[usuario] || {}; const s = standId ? f.stands[standId] : null;
  return { cavalo: provisoriaPiloto(usuario), arteCavalo: p.cavalo ? urlDe(p.cavalo.img) : '', standCores: standId ? provisoriaStand(standId) : null, arteStand: s ? urlDe(s.img) : '', provisoria: { piloto: !p.cavalo, stand: !s } };
}
async function ler_(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const SS = require('./stands'); const copas = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta);
  let standId = '', standNome = '';
  if (copas.length) { const orc = await SS.contexto(copas); const st = orc.stand(usuario, Date.now()); if (st) { standId = st.id; standNome = st.nome; } }
  const v = await visual(usuario, standId); const f = await ler();
  const meus = (k) => (f.pendentes[k] ? { url: urlDe(f.pendentes[k].img), em: f.pendentes[k].em } : null);
  const out = { visual: v, stand: standId ? { id: standId, nome: standNome } : null, dono: !!dono, enviar: { piloto: !dono, stand: !!standId && !f.stands[standId] }, pendente: { piloto: meus('piloto:' + usuario), stand: standId ? meus('stand:' + standId) : null } };
  if (dono) {
    const us = [...new Set(Object.values(cfg.turmas || {}).flatMap((t) => t.alunos || []))].filter((a) => !/^ficticio-/.test(a)); const nm = await require('./copaapi').nomesDa(us); const nome = (k) => String(nm[k] || '').trim() || k;
    out.standsBanco = SS.BANCO.map((s) => ({ id: s.id, nome: s.nome, final: f.stands[s.id] ? urlDe(f.stands[s.id].img) : '' })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    out.alunosBanco = us.map((k) => ({ id: k, nome: nome(k), final: f.pilotos[k] && f.pilotos[k].cavalo ? urlDe(f.pilotos[k].cavalo.img) : '' })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    out.pendentes = Object.entries(f.pendentes).map(([chave, x]) => { const [tipo, id] = chave.split(':'); const alvo = tipo === 'stand' ? ((SS.POR_ID[id] || {}).nome || id) : nome(id); return { chave, tipo, alvo, por: nome(x.por), url: urlDe(x.img), em: x.em }; });
  }
  return u.json(res, 200, out);
}
async function standAtual(cfg, usuario, dono, monitor, turmaOk) {
  const copas = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta); if (!copas.length) return '';
  const orc = await require('./stands').contexto(copas); const st = orc.stand(usuario, Date.now()); return st ? st.id : '';
}
// Envio de arte (PNG, JPG, WEBP ou GIF animado, até 3 MB). O aluno envia a do próprio cavaleiro/cavalo e a do próprio Stand (se ainda não tiver arte final):
// fica pendente até o professor aprovar. O professor envia direto (vira final). Arte final de Stand fica bloqueada: trocar exige `substituir`.
async function enviar(res, b, { cfg, usuario, dono, monitor, turmaOk }) {
  const tipo = String(b.tipo || ''); if (!['piloto', 'stand'].includes(tipo)) return u.json(res, 400, { erro: 'Escolha o que enviar: cavaleiro ou Stand.' });
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dados || '')); if (!m) return u.json(res, 400, { erro: 'Imagem inválida.' });
  let id = String(b.id || '').toLowerCase().trim();
  if (!dono) { if (tipo === 'piloto') id = usuario; else { id = await standAtual(cfg, usuario, dono, monitor, turmaOk); if (!id) return u.json(res, 403, { erro: 'Você ainda não escolheu um Stand.' }); } }
  else if (!id) return u.json(res, 400, { erro: 'Escolha o Stand ou o aluno.' });
  if (tipo === 'stand' && !require('./stands').POR_ID[id]) return u.json(res, 400, { erro: 'Stand desconhecido.' });
  const f0 = await ler();
  if (tipo === 'stand' && f0.stands[id] && !(dono && b.substituir)) return u.json(res, dono ? 409 : 403, { erro: 'Este Stand já tem arte final e está bloqueado.' + (dono ? ' Para trocar, confirme a substituição.' : '') });
  const img = await require('./site').enviarImagem((tipo === 'stand' ? 'stand-' : 'cav-') + id, Buffer.from(m[1], 'base64'), usuario, []);
  const agora = new Date().toISOString();
  await d.mudarJson(CAMINHO, (cur) => {
    const x = cur && typeof cur === 'object' ? cur : vazio(); x.stands = x.stands || {}; x.pilotos = x.pilotos || {}; x.pendentes = x.pendentes || {};
    if (dono) { if (tipo === 'stand') x.stands[id] = { img, por: usuario, em: agora }; else x.pilotos[id] = { ...(x.pilotos[id] || {}), cavalo: { img, por: usuario, em: agora } }; delete x.pendentes[tipo + ':' + id]; }
    else x.pendentes[tipo + ':' + id] = { img, por: usuario, em: agora };
    return x;
  }, `Arte: ${dono ? 'final' : 'pendente'} ${tipo} ${id}`);
  return u.json(res, 200, { ok: true, pendente: !dono });
}
// Professor aprova (vira final) ou recusa (some da fila) uma arte enviada por aluno.
async function decidir(res, b, { dono, usuario }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor aprova artes.' });
  const chave = String(b.chave || ''); const [tipo, id] = chave.split(':'); if (!['piloto', 'stand'].includes(tipo) || !id) return u.json(res, 400, { erro: 'Pedido inválido.' });
  let erro = '';
  await d.mudarJson(CAMINHO, (cur) => {
    const x = cur && typeof cur === 'object' ? cur : vazio(); x.stands = x.stands || {}; x.pilotos = x.pilotos || {}; x.pendentes = x.pendentes || {}; const p = x.pendentes[chave];
    if (!p) { erro = 'Esta arte não está mais na fila.'; return x; }
    if (b.aprovar) { if (tipo === 'stand') { if (x.stands[id] && !b.substituir) { erro = 'Este Stand já tem arte final e está bloqueado.'; return x; } x.stands[id] = { img: p.img, por: p.por, em: new Date().toISOString(), aprovadaPor: usuario }; } else x.pilotos[id] = { ...(x.pilotos[id] || {}), cavalo: { img: p.img, por: p.por, em: new Date().toISOString(), aprovadaPor: usuario } }; }
    delete x.pendentes[chave]; return x;
  }, `Arte: ${b.aprovar ? 'aprovada' : 'recusada'} ${chave}`);
  if (erro) return u.json(res, 409, { erro });
  return u.json(res, 200, { ok: true });
}
module.exports = { ler: ler_, enviar, decidir, visual, provisoriaPiloto, provisoriaStand, ARQUIVO_RE, urlDe };
