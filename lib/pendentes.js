'use strict';
// Contatos da equipe ainda sem usuário do GitHub: e-mail institucional + cargo (a plataforma entra só por GitHub; o e-mail é só contato).
// Um arquivo só: dados/equipe-pendente.json. Só owners leem e gravam.
const u = require('./util');
const REPO = () => process.env.DATA_REPO || u.REPO(); const CAM = 'dados/equipe-pendente.json';
const chave = (x) => x.email || ('@' + x.usuario);
const url = () => `/repos/${REPO()}/contents/${CAM}`; const MAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;
// Limpa o que vem de copiar/colar: espaços no começo/fim, espaço duplo, espaço invisível (NBSP, zero-width) e quebras de linha.
const limpo = (v) => String(v || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/[\u0000-\u001f\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/ {2,}/g, ' ').trim();
const txt = (v, n) => limpo(v).slice(0, n);
const semEsp = (v) => String(v || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
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
  const email = semEsp(b.email).slice(0, 190).toLowerCase(); if (email && !MAIL_RE.test(email)) throw bad('E-mail inválido. Ex.: a000000@ceuma.com.br');
  const gh = semEsp(b.usuario).slice(0, 40).replace(/^@/, '').toLowerCase(); if (gh && !u.USER_RE.test(gh)) throw bad('Usuário do GitHub inválido.');
  if (!email && !gh) throw bad('Informe o e-mail ou o usuário do GitHub.');
  const item = { email, cargo: txt(b.cargo, 60), nome: txt(b.nome, 80), curso: txt(b.curso, 80), usuario: gh, obs: txt(b.obs, 200) };
  const ant = semEsp(b.anterior).slice(0, 190).toLowerCase();
  await gravar((l) => {
    let i = ant ? l.findIndex((x) => chave(x) === ant) : -1; if (i < 0 && gh) i = l.findIndex((x) => x.usuario === gh);
    if (i >= 0 && !item.email && !b.anterior) item.email = l[i].email; if (i >= 0 && !item.nome && !b.anterior) item.nome = l[i].nome; if (i >= 0 && b.curso === undefined) item.curso = l[i].curso || '';
    const quem = (x) => x.nome || x.cargo || x.email || ('@' + x.usuario);
    const dupU = gh && l.find((x, j) => j !== i && x.usuario === gh); if (dupU) throw bad(`O usuário @${gh} já está cadastrado para ${quem(dupU)}. Cada usuário só pode pertencer a uma pessoa.`);
    const dupE = item.email && l.find((x, j) => j !== i && x.email === item.email); if (dupE) throw bad(`O e-mail ${item.email} já está cadastrado para ${quem(dupE)}.`);
    const nn = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const dupN = item.nome && l.find((x, j) => j !== i && nn(x.nome) === nn(item.nome)); if (dupN) throw bad(`Já existe uma pessoa cadastrada com o nome "${dupN.nome}"${dupN.usuario ? ' (@' + dupN.usuario + ')' : ''}. Edite o cadastro dela em vez de criar outro. Se for outra pessoa com o mesmo nome, acrescente um sobrenome ou inicial para diferenciar.`);
    if (i >= 0) l[i] = item; else l.push(item); return l;
  }, `Portal: ${usuario} atualizou os contatos`);
  return item;
}
async function remover(chaveRem, usuario, podeRemover) {
  const e = semEsp(chaveRem).slice(0, 190).toLowerCase();
  await gravar((l) => { const x = l.find((y) => chave(y) === e); if (x && podeRemover) { const m = podeRemover(x); if (m) throw bad(m); } return l.filter((y) => chave(y) !== e); }, `Portal: ${usuario} removeu um contato`);
}
async function trocarUsuario(velho, novo, usuario) {
  if (!u.USER_RE.test(novo)) throw bad('Usuário do GitHub inválido.');
  await gravar((l) => {
    const i = l.findIndex((x) => x.usuario === velho); if (i < 0) throw bad(`@${velho} não está nos Contatos.`);
    const j = l.findIndex((x, k) => k !== i && x.usuario === novo);
    if (j >= 0 && String(l[j].nome || '').trim().toLowerCase() !== String(l[i].nome || '').trim().toLowerCase()) throw bad(`O usuário @${novo} já está cadastrado para ${l[j].nome || l[j].email || ('@' + l[j].usuario)}.`);
    const dup = j >= 0 ? l[j] : null; // mesmo nome e sem acesso: é o cadastro duplicado da mesma pessoa; unifica
    const item = { ...l[i], usuario: novo }; if (dup) { item.email = item.email || dup.email || ''; item.curso = item.curso || dup.curso || ''; }
    return l.filter((x, k) => k !== j).map((x) => (x === l[i] ? item : x));
  }, `Portal: ${usuario} corrigiu o usuário do GitHub de @${velho} para @${novo}`);
}
module.exports = { ler, salvar, remover, trocarUsuario, gravar };
