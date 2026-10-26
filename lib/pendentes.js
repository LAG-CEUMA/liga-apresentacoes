'use strict';
// Contatos da equipe ainda sem usuário do GitHub: e-mail institucional + cargo (a plataforma entra só por GitHub; o e-mail é só contato).
// Um arquivo só: dados/equipe-pendente.json. Só owners leem e gravam.
const u = require('./util');
const REPO = () => process.env.DATA_REPO || u.REPO(); const CAM = 'dados/equipe-pendente.json';
const chave = (x) => x.email || ('@' + x.usuario);
const url = () => `/repos/${REPO()}/contents/${CAM}`; const MAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;
const txt = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
async function ler() {
  const r = await u.gh(`${url()}?ref=${u.BRANCH()}`); if (r.status === 404) return { lista: [], sha: null }; if (!r.ok) throw new Error(`GitHub ${r.status} ao ler os contatos`);
  const j = await r.json(); let l = []; try { l = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch { l = []; }
  return { lista: Array.isArray(l) ? l.filter((x) => x && ((x.email && MAIL_RE.test(x.email)) || x.usuario)) : [], sha: j.sha };
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
  const email = txt(b.email, 190).toLowerCase(); if (email && !MAIL_RE.test(email)) throw bad('E-mail inválido. Ex.: a000000@ceuma.com.br');
  const gh = txt(b.usuario, 40).replace(/^@/, '').toLowerCase(); if (gh && !u.USER_RE.test(gh)) throw bad('Usuário do GitHub inválido.');
  if (!email && !gh) throw bad('Informe o e-mail ou o usuário do GitHub.');
  const item = { email, cargo: txt(b.cargo, 60), nome: txt(b.nome, 80), usuario: gh, obs: txt(b.obs, 200) };
  const ant = txt(b.anterior, 190).toLowerCase();
  await gravar((l) => {
    let i = ant ? l.findIndex((x) => chave(x) === ant) : -1; if (i < 0 && gh) i = l.findIndex((x) => x.usuario === gh);
    if (i >= 0 && !item.email && !b.anterior) item.email = l[i].email; if (i >= 0 && !item.nome && !b.anterior) item.nome = l[i].nome;
    const quem = (x) => x.nome || x.cargo || x.email || ('@' + x.usuario);
    const dupU = gh && l.find((x, j) => j !== i && x.usuario === gh); if (dupU) throw bad(`O usuário @${gh} já está cadastrado para ${quem(dupU)}. Cada usuário só pode pertencer a uma pessoa.`);
    const dupE = item.email && l.find((x, j) => j !== i && x.email === item.email); if (dupE) throw bad(`O e-mail ${item.email} já está cadastrado para ${quem(dupE)}.`);
    if (i >= 0) l[i] = item; else l.push(item); return l;
  }, `Portal: ${usuario} atualizou os contatos`);
  return item;
}
async function remover(chaveRem, usuario, podeRemover) {
  const e = txt(chaveRem, 190).toLowerCase();
  await gravar((l) => { const x = l.find((y) => chave(y) === e); if (x && podeRemover) { const m = podeRemover(x); if (m) throw bad(m); } return l.filter((y) => chave(y) !== e); }, `Portal: ${usuario} removeu um contato`);
}
module.exports = { ler, salvar, remover };
