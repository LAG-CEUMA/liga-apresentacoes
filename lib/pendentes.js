'use strict';
// Contatos da equipe ainda sem usuário do GitHub: e-mail institucional + cargo (a plataforma entra só por GitHub; o e-mail é só contato).
// Um arquivo só: dados/equipe-pendente.json. Só owners leem e gravam.
const u = require('./util');
const REPO = () => process.env.DATA_REPO || u.REPO(); const CAM = 'dados/equipe-pendente.json';
const url = () => `/repos/${REPO()}/contents/${CAM}`; const MAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;
const txt = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
async function ler() {
  const r = await u.gh(`${url()}?ref=${u.BRANCH()}`); if (r.status === 404) return { lista: [], sha: null }; if (!r.ok) throw new Error(`GitHub ${r.status} ao ler os contatos`);
  const j = await r.json(); let l = []; try { l = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { l = []; }
  return { lista: Array.isArray(l) ? l.filter((x) => x && MAIL_RE.test(x.email || '')) : [], sha: j.sha };
}
async function gravar(mudar, msg) {
  for (let t = 0; t < 3; t++) {
    const { lista, sha } = await ler(); const nova = mudar(lista);
    const corpo = { message: msg, branch: u.BRANCH(), content: Buffer.from(JSON.stringify(nova, null, 2) + '\n').toString('base64') }; if (sha) corpo.sha = sha;
    const r = await u.gh(url(), { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) return nova; if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status} ao gravar os contatos`);
  }
  throw new Error('Conflito ao gravar. Tente de novo.');
}
const bad = (m) => Object.assign(new Error(m), { status: 400 });
async function salvar(b, usuario) {
  const email = txt(b.email, 190).toLowerCase(); if (!MAIL_RE.test(email)) throw bad('E-mail inválido.');
  const gh = txt(b.usuario, 40).replace(/^@/, '').toLowerCase(); if (gh && !u.USER_RE.test(gh)) throw bad('Usuário do GitHub inválido.');
  const item = { email, cargo: txt(b.cargo, 60), nome: txt(b.nome, 80), usuario: gh, obs: txt(b.obs, 200) };
  await gravar((l) => { const i = l.findIndex((x) => x.email === (txt(b.anterior, 190).toLowerCase() || email)); if (i >= 0) l[i] = item; else l.push(item); return l; }, `Portal: ${usuario} atualizou os contatos da equipe`);
  return item;
}
async function remover(email, usuario) {
  const e = txt(email, 190).toLowerCase(); await gravar((l) => l.filter((x) => x.email !== e), `Portal: ${usuario} removeu um contato da equipe`);
}
module.exports = { ler, salvar, remover };
