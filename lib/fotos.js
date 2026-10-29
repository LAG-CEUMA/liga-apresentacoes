'use strict';
// Foto de perfil enviada pelo aluno: um JPEG pequeno (até ~80 KB, reduzido no navegador) em dados/fotos/<usuario>.jpg.
// A preferência (usar a do GitHub ou a enviada; se é pública) fica no cadastro da pessoa (Contatos): fotoModo e fotoPublica.
const u = require('./util');
const P = require('./pendentes');
const REPO = () => process.env.DATA_REPO || u.REPO();
const cam = (k) => `dados/fotos/${k}.jpg`;
const url = (k) => `/repos/${REPO()}/contents/${cam(k)}`;
const MAX = 80 * 1024;
const bad = (m) => Object.assign(new Error(m), { status: 400 });

async function ler(k) {
  if (!u.USER_RE.test(k)) return null;
  const r = await u.gh(`${url(k)}?ref=${u.BRANCH()}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}
async function salvar(k, dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw bad('Envie uma imagem (a página reduz a foto sozinha).');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 200 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw bad('A foto precisa ser uma imagem JPEG válida.');
  if (buf.length > MAX) throw bad('A foto ficou grande demais. Tente uma imagem menor.');
  for (let t = 0; t < 3; t++) {
    const r0 = await u.gh(`${url(k)}?ref=${u.BRANCH()}`); let sha = null; if (r0.ok) sha = (await r0.json()).sha;
    const corpo = { message: `Portal: @${k} atualizou a foto de perfil`, branch: u.BRANCH(), content: buf.toString('base64') }; if (sha) corpo.sha = sha;
    const r = await u.gh(url(k), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (r.ok) { u.limparCache(); return buf.length; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar a foto`);
  }
  throw new Error('Conflito ao gravar a foto. Tente de novo.');
}
async function remover(k) {
  const r0 = await u.gh(`${url(k)}?ref=${u.BRANCH()}`); if (!r0.ok) return;
  const { sha } = await r0.json();
  await u.gh(url(k), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Portal: @${k} removeu a foto de perfil`, sha, branch: u.BRANCH() }) });
  u.limparCache();
}
// Preferência: modo 'github' (padrão) ou 'upload'; publica = aparece também nas páginas públicas.
async function preferencia(k, modo, publica) {
  await P.gravar((l) => {
    const i = l.findIndex((x) => x.usuario === k); if (i < 0) throw bad('Seu cadastro ainda não está nos Contatos. Fale com o professor.');
    l[i] = { ...l[i], fotoModo: modo === 'upload' ? 'upload' : 'github', fotoPublica: !!publica }; return l;
  }, `Portal: @${k} ajustou a preferência de foto`);
  u.limparCache();
}
// Mapa usuário -> {modo, publica} (cache curto)
async function mapa() {
  return u.comCache('fotosmapa', 60000, async () => {
    const m = {}; for (const x of (await P.ler()).lista) if (x.usuario && x.fotoModo === 'upload') m[x.usuario] = { publica: !!x.fotoPublica }; return m;
  });
}
module.exports = { ler, salvar, remover, preferencia, mapa, MAX };
