'use strict';
// Testes locais: simulam o GitHub e chamam as funções do portal.
const assert = require('assert');
process.env.SESSION_SECRET = 'segredo-de-teste-123456';
process.env.GH_TOKEN = 'x'; process.env.GITHUB_CLIENT_ID = 'cid'; process.env.GITHUB_CLIENT_SECRET = 'sec';
process.env.ADMIN_USERS = 'chefe';

let cfg = { monitores: ['mon1'], alunos: ['alu1'], aulas: { 'nivel-00-tutorial/aula-01': 'publico', 'nivel-00-tutorial/aula-02': 'membros' } };
let sha = 'sha1'; const commits = [];
const arquivos = {
  'niveis/nivel-00-tutorial/slides/aula-01.html': '<html>SLIDES1</html>',
  'niveis/nivel-00-tutorial/slides/aula-01-roteiro.html': '<html>ROTEIRO1</html>',
  'niveis/nivel-00-tutorial/slides/aula-02.html': '<html>SLIDES2</html>',
  'niveis/nivel-00-tutorial/slides/aula-03.html': '<html>SLIDES3</html>',
  'niveis/nivel-00-tutorial/slides/indice.json': JSON.stringify({ 'aula-01': 'Aula 1: X', 'aula-02': 'Aula 2: Y', 'aula-03': 'Aula 3: Z' }),
};
const resp = (status, corpo) => ({ status, ok: status < 300, json: async () => corpo, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
global.fetch = async (url, op = {}) => {
  const p = new URL(url).pathname;
  if (p.endsWith('/git/trees/main')) return resp(200, { tree: [...Object.keys(arquivos).map((path) => ({ path })), { path: 'niveis/../segredo/slides/aula-09.html' }, { path: 'docs/x.html' }] });
  if (p.endsWith('/contents/acesso/acesso.json')) {
    if (op.method === 'PUT') { const b = JSON.parse(op.body); if (b.sha !== sha) return resp(409, {}); cfg = JSON.parse(Buffer.from(b.content, 'base64').toString()); sha = 'sha' + (commits.push(b.message) + 1); return resp(200, {}); }
    return resp(200, { sha, content: Buffer.from(JSON.stringify(cfg)).toString('base64') });
  }
  const m = /\/contents\/(.+)$/.exec(p);
  if (m && arquivos[decodeURIComponent(m[1])] !== undefined) return resp(200, arquivos[decodeURIComponent(m[1])]);
  return resp(404, {});
};
const u = require('../lib/util');
const h = (n) => require('../api/' + n);
function chamar(fn, { query = {}, user = null, method = 'GET', body, headers = {} } = {}) {
  const req = { query, method, body, headers: { host: 'site.test', ...headers } };
  if (user) req.headers.cookie = 'liga_s=' + encodeURIComponent(u.assinar({ u: user, exp: Date.now() + 1e6 }));
  return new Promise((ok) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(c) { ok({ status: this.statusCode, body: c, h: this.headers }); } };
    Promise.resolve(fn(req, res));
  });
}
const ver = (user, id, roteiro) => chamar(h('ver'), { query: { dir: 'nivel-00-tutorial', id, ...(roteiro ? { roteiro: '1' } : {}) }, user });
(async () => {
  // público sem login
  let r = await ver(null, 'aula-01'); assert.equal(r.status, 200); assert(r.body.includes('SLIDES1')); assert(r.h['Cache-Control'].startsWith('public'));
  // membros: visitante vai para login; aluno vê; desconhecido recebe 403
  r = await ver(null, 'aula-02'); assert.equal(r.status, 302); assert(r.h.Location.startsWith('/api/login?next='));
  r = await ver('alu1', 'aula-02'); assert.equal(r.status, 200); assert.equal(r.h['Cache-Control'], 'private, no-store');
  r = await ver('estranho', 'aula-02'); assert.equal(r.status, 403);
  // padrão: aula não listada é só de monitores
  r = await ver('alu1', 'aula-03'); assert.equal(r.status, 403);
  r = await ver('mon1', 'aula-03'); assert.equal(r.status, 200);
  r = await ver('chefe', 'aula-03'); assert.equal(r.status, 200); // ADMIN_USERS
  // roteiro: só monitor, mesmo se aula é pública
  r = await ver('alu1', 'aula-01', true); assert.equal(r.status, 403);
  r = await ver(null, 'aula-01', true); assert.equal(r.status, 302);
  r = await ver('mon1', 'aula-01', true); assert.equal(r.status, 200); assert(r.body.includes('ROTEIRO1'));
  // caminhos inválidos / traversal
  r = await chamar(h('ver'), { query: { dir: '../segredo', id: 'aula-09' }, user: 'mon1' }); assert.equal(r.status, 404);
  r = await chamar(h('ver'), { query: { dir: 'nivel-00-tutorial', id: 'aula-99' }, user: 'mon1' }); assert.equal(r.status, 404);
  // cookie adulterado e expirado
  assert.equal(u.verificar(u.assinar({ u: 'mon1', exp: Date.now() + 1e5 }).replace(/.$/, 'x')), null);
  assert.equal(u.verificar(u.assinar({ u: 'mon1', exp: Date.now() - 1 })), null);
  r = await chamar(h('ver'), { query: { dir: 'nivel-00-tutorial', id: 'aula-03' }, headers: { cookie: 'liga_s=forjado.abc' } }); assert.equal(r.status, 302);
  // lista de aulas por papel
  const lista = async (user) => JSON.parse((await chamar(h('aulas'), { user })).body);
  let d = await lista(null); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01']); assert.equal(d.exigeLogin, 1); assert.equal(d.aulas[0].roteiro, null);
  d = await lista('alu1'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02']);
  d = await lista('mon1'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02', 'aula-03']); assert(d.aulas[0].roteiro);
  assert.equal(d.aulas[0].titulo, 'Aula 1: X'); assert.equal(d.aulas[0].nivel, 'Nível 0');
  // admin: só monitor; POST exige origem e JSON
  r = await chamar(h('admin'), { user: 'alu1' }); assert.equal(r.status, 403);
  r = await chamar(h('admin'), { user: null }); assert.equal(r.status, 403);
  const post = (corpo, extra = {}) => chamar(h('admin'), { user: 'mon1', method: 'POST', body: corpo, headers: { origin: 'https://site.test', 'content-type': 'application/json', ...extra } });
  r = await post({ acao: 'acesso', chave: 'nivel-00-tutorial/aula-03', nivel: 'membros' }, { origin: 'https://evil.test' }); assert.equal(r.status, 403);
  r = await post({ acao: 'acesso', chave: 'nivel-00-tutorial/aula-03', nivel: 'membros' }, { 'content-type': 'text/plain' }); assert.equal(r.status, 403);
  r = await chamar(h('admin'), { user: 'alu1', method: 'POST', body: {}, headers: { origin: 'https://site.test', 'content-type': 'application/json' } }); assert.equal(r.status, 403);
  r = await post({ acao: 'acesso', chave: 'nivel-00-tutorial/aula-03', nivel: 'membros' }); assert.equal(r.status, 200);
  assert.equal(cfg.aulas['nivel-00-tutorial/aula-03'], 'membros'); assert(commits[0].includes('mon1'));
  assert.equal((await ver('alu1', 'aula-03')).status, 200); // vale na hora (cache limpo)
  r = await post({ acao: 'acesso', chave: 'nivel-00-tutorial/aula-03', nivel: 'monitores' }); assert.equal(r.status, 200);
  assert.equal(cfg.aulas['nivel-00-tutorial/aula-03'], undefined);
  r = await post({ acao: 'acesso', chave: 'nao/existe', nivel: 'publico' }); assert.equal(r.status, 400);
  r = await post({ acao: 'acesso', chave: 'nivel-00-tutorial/aula-03', nivel: 'xxx' }); assert.equal(r.status, 400);
  // listas
  r = await post({ acao: 'listas', monitores: ['mon1'], alunos: ['@Ana', 'bia', 'bad name!'] }); assert.equal(r.status, 400);
  r = await post({ acao: 'listas', monitores: ['outro'], alunos: [] }); assert.equal(r.status, 400); // não pode se remover
  r = await post({ acao: 'listas', monitores: ['mon1', 'Prof'], alunos: ['@Ana', 'bia', 'ana'] }); assert.equal(r.status, 200);
  assert.deepEqual(cfg.alunos, ['ana', 'bia']); assert.deepEqual(cfg.monitores, ['mon1', 'prof']);
  assert.equal((await ver('ana', 'aula-02')).status, 200);
  // login: state e redirect seguro
  r = await chamar(h('login'), { query: { next: '//evil.com' } });
  assert.equal(r.status, 302); assert(r.h.Location.startsWith('https://github.com/login/oauth/authorize?client_id=cid')); assert(!r.h.Location.includes('scope='));
  const st = u.verificar(decodeURIComponent(r.h['Set-Cookie'].split(';')[0].split('=').slice(1).join('='))); assert.equal(st.n, '/');
  r = await chamar(h('login'), { query: { next: '/aula/nivel-00-tutorial/aula-02' } });
  const cookieSt = r.h['Set-Cookie'].split(';')[0]; const state = new URL(r.h.Location).searchParams.get('state');
  // callback com state errado
  r = await chamar(h('callback'), { query: { code: 'c', state: 'errado' }, headers: { cookie: cookieSt } }); assert.equal(r.status, 400);
  // callback ok (mock do GitHub OAuth)
  const antes = global.fetch;
  global.fetch = async (url, op) => url.includes('login/oauth/access_token') ? resp(200, { access_token: 't' }) : url.endsWith('/user') ? resp(200, { login: 'Ana' }) : antes(url, op);
  r = await chamar(h('callback'), { query: { code: 'c', state }, headers: { cookie: cookieSt } });
  assert.equal(r.status, 302); assert.equal(r.h.Location, '/aula/nivel-00-tutorial/aula-02');
  const sc = r.h['Set-Cookie'].find((c) => c.startsWith('liga_s=')); assert(sc.includes('HttpOnly') && sc.includes('Secure') && sc.includes('SameSite=Lax'));
  global.fetch = antes;
  console.log('Todos os testes passaram.');
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
