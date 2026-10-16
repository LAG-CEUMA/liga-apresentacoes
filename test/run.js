'use strict';
// Testes locais: simulam o GitHub e chamam as funções do portal.
const assert = require('assert');
process.env.SESSION_SECRET = 'segredo-de-teste-123456';
process.env.GH_TOKEN = 'x'; process.env.GITHUB_CLIENT_ID = 'cid'; process.env.GITHUB_CLIENT_SECRET = 'sec';
process.env.ADMIN_USERS = 'chefe';

let cfg = { owners: ['dono'], monitores: { mon1: { aulas: [], roteiros: [] }, mon2: { aulas: ['nivel-00-tutorial/aula-03'], roteiros: ['nivel-00-tutorial/aula-01'] } }, alunos: ['alu1'], aulas: { 'nivel-00-tutorial/aula-01': 'publico', 'nivel-00-tutorial/aula-02': 'membros' } };
let siteJson = null, siteSha = null; const siteCommits = []; const imagens = {};
let sha = 'sha1'; const commits = [];
const arquivos = {
  'niveis/nivel-00-tutorial/slides/aula-01.html': '<html>SLIDES1</html>',
  'niveis/nivel-00-tutorial/slides/aula-01-roteiro.html': '<html>ROTEIRO1</html>',
  'niveis/nivel-00-tutorial/slides/aula-02.html': '<html>SLIDES2</html>',
  'niveis/nivel-00-tutorial/slides/aula-03.html': '<html>SLIDES3</html>',
  'liberacao/nivel-00/semana-01/aula.md': '# Aula TEXTO1',
  'liberacao/nivel-00/semana-01/tarefa.md': '- [ ] TAREFA1',
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
  if (p.endsWith('/contents/site/site.json')) {
    if (op.method === 'PUT') { const b = JSON.parse(op.body); if (siteSha && b.sha !== siteSha) return resp(409, {}); siteJson = Buffer.from(b.content, 'base64').toString(); siteSha = 's' + (siteCommits.push(b.message) + 1); return resp(200, {}); }
    return siteJson === null ? resp(404, {}) : resp(200, { sha: siteSha, content: Buffer.from(siteJson).toString('base64') });
  }
  if (p.endsWith('/contents/site/imagens')) return resp(200, Object.keys(imagens).map((name) => ({ name })));
  { const mi = /\/contents\/site\/imagens\/(.+)$/.exec(p);
    if (mi) { if (op.method === 'PUT') { imagens[mi[1]] = Buffer.from(JSON.parse(op.body).content, 'base64'); return resp(201, {}); }
      return imagens[mi[1]] ? { status: 200, ok: true, arrayBuffer: async () => imagens[mi[1]] } : resp(404, {}); } }
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
const CH = (n) => 'nivel-00-tutorial/aula-0' + n;
(async () => {
  // público sem login; membros exige login; padrão é só owners
  let r = await ver(null, 'aula-01'); assert.equal(r.status, 200); assert(r.body.includes('SLIDES1')); assert(r.h['Cache-Control'].startsWith('public'));
  r = await ver(null, 'aula-02'); assert.equal(r.status, 302); assert(r.h.Location.startsWith('/api/login?next='));
  r = await ver('alu1', 'aula-02'); assert.equal(r.status, 200); assert.equal(r.h['Cache-Control'], 'private, no-store');
  r = await ver('estranho', 'aula-02'); assert.equal(r.status, 403);
  r = await ver('alu1', 'aula-03'); assert.equal(r.status, 403);
  // owner vê tudo (da lista e do ADMIN_USERS), inclusive roteiros
  for (const o of ['dono', 'chefe']) {
    assert.equal((await ver(o, 'aula-03')).status, 200);
    r = await ver(o, 'aula-01', true); assert.equal(r.status, 200); assert(r.body.includes('ROTEIRO1'));
  }
  // monitor sem permissão extra = nível de aluno
  assert.equal((await ver('mon1', 'aula-01')).status, 200);
  assert.equal((await ver('mon1', 'aula-02')).status, 200); // membros
  assert.equal((await ver('mon1', 'aula-03')).status, 403); // só owners
  assert.equal((await ver('mon1', 'aula-01', true)).status, 403); // roteiro não concedido
  // monitor com permissão: só o que foi concedido
  assert.equal((await ver('mon2', 'aula-03')).status, 200);
  assert.equal((await ver('mon2', 'aula-01', true)).status, 200);
  assert.equal((await ver('mon2', 'aula-02', true)).status, 403);
  // aluno e visitante nunca veem roteiro
  assert.equal((await ver('alu1', 'aula-01', true)).status, 403);
  assert.equal((await ver(null, 'aula-01', true)).status, 302);
  // botão voltar nos slides
  r = await ver('dono', 'aula-03'); assert(r.body.includes('liga-voltar') || r.body.includes('Aulas'));
  // semanas: só owners
  r = await chamar(h('semanas'), { user: 'dono' }); assert.equal(r.status, 200);
  const sem = JSON.parse(r.body).semanas; assert.equal(sem.length, 1); assert(sem[0].tarefa.texto.includes('TAREFA1')); assert(sem[0].aula.editar.includes('/edit/main/liberacao/nivel-00/semana-01/aula.md'));
  for (const x of ['mon2', 'alu1', 'estranho', null]) assert.equal((await chamar(h('semanas'), { user: x })).status, 403);
  // caminhos inválidos / traversal
  r = await chamar(h('ver'), { query: { dir: '../segredo', id: 'aula-09' }, user: 'dono' }); assert.equal(r.status, 404);
  r = await chamar(h('ver'), { query: { dir: 'nivel-00-tutorial', id: 'aula-99' }, user: 'dono' }); assert.equal(r.status, 404);
  // cookie adulterado, expirado e forjado
  assert.equal(u.verificar(u.assinar({ u: 'dono', exp: Date.now() + 1e5 }).replace(/.$/, 'x')), null);
  assert.equal(u.verificar(u.assinar({ u: 'dono', exp: Date.now() - 1 })), null);
  r = await chamar(h('ver'), { query: { dir: 'nivel-00-tutorial', id: 'aula-03' }, headers: { cookie: 'liga_s=forjado.abc' } }); assert.equal(r.status, 302);
  // lista de aulas por papel
  const lista = async (user) => JSON.parse((await chamar(h('aulas'), { user })).body);
  let d = await lista(null); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01']); assert.equal(d.exigeLogin, 1); assert.equal(d.aulas[0].roteiro, null);
  d = await lista('alu1'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02']);
  d = await lista('mon1'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02']); assert.equal(d.aulas[0].roteiro, null); assert.equal(d.aulas[0].acesso, undefined);
  d = await lista('mon2'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02', 'aula-03']); assert(d.aulas[0].roteiro); assert.equal(d.aulas[1].roteiro, null);
  d = await lista('dono'); assert.deepEqual(d.aulas.map((a) => a.id), ['aula-01', 'aula-02', 'aula-03']); assert(d.aulas[2].roteiro === null && d.aulas[0].roteiro);
  assert.equal(d.aulas[0].titulo, 'Aula 1: X'); assert.equal(d.aulas[0].nivel, 'Nível 0'); assert.equal(d.papel, 'owner');
  // painel: só owner
  for (const x of ['alu1', 'mon2', null]) assert.equal((await chamar(h('admin'), { user: x })).status, 403);
  d = JSON.parse((await chamar(h('admin'), { user: 'dono' })).body); assert.equal(d.aulas.length, 3); assert(d.monitores.mon2);
  const post = (corpo, extra = {}, user = 'dono') => chamar(h('admin'), { user, method: 'POST', body: corpo, headers: { origin: 'https://site.test', 'content-type': 'application/json', ...extra } });
  const AC = { acao: 'acesso', chave: CH(3), nivel: 'membros' };
  assert.equal((await post(AC, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await post(AC, { 'content-type': 'text/plain' })).status, 403);
  assert.equal((await post(AC, {}, 'mon2')).status, 403); // monitor não escreve
  assert.equal((await post({ acao: 'monitor', usuario: 'mon1', aulas: [CH(3)], roteiros: [] }, {}, 'mon1')).status, 403); // não se autoconcede
  assert.equal((await post(AC)).status, 200);
  assert.equal(cfg.aulas[CH(3)], 'membros'); assert(commits[0].includes('dono'));
  assert.equal((await ver('alu1', 'aula-03')).status, 200); // vale na hora
  assert.equal((await post({ ...AC, nivel: 'owners' })).status, 200); assert.equal(cfg.aulas[CH(3)], undefined);
  assert.equal((await post({ acao: 'acesso', chave: 'nao/existe', nivel: 'publico' })).status, 400);
  r = await post({ acao: 'acesso', chaves: [CH(2), CH(3)], nivel: 'publico', nivel_nome: 'nivel-00-tutorial' }); assert.equal(r.status, 200); assert.equal(cfg.aulas[CH(2)], 'publico'); assert.equal(cfg.aulas[CH(3)], 'publico'); assert(commits[commits.length - 1].includes('2 aulas'));
  assert.equal((await post({ acao: 'acesso', chaves: [CH(2), 'x/y'], nivel: 'publico' })).status, 400);
  await post({ acao: 'acesso', chaves: [CH(2)], nivel: 'membros' }); await post({ acao: 'acesso', chaves: [CH(3)], nivel: 'owners' });
  assert.equal((await post({ ...AC, nivel: 'monitores' })).status, 400);
  // permissões de monitor
  assert.equal((await post({ acao: 'monitor', usuario: '@Novo', aulas: [CH(3), 'x/aula-99'], roteiros: [CH(1)] })).status, 200);
  assert.deepEqual(cfg.monitores.novo, { aulas: [CH(3)], roteiros: [CH(1)] });
  assert.equal((await ver('novo', 'aula-03')).status, 200);
  assert.equal((await post({ acao: 'monitor', usuario: 'mon2', aulas: [], roteiros: [] })).status, 200);
  assert.equal((await ver('mon2', 'aula-03')).status, 403); // revogado
  assert.equal((await post({ acao: 'monitor', usuario: 'ruim nome!', aulas: [] })).status, 400);
  assert.equal((await post({ acao: 'remover_monitor', usuario: 'novo' })).status, 200); assert.equal(cfg.monitores.novo, undefined);
  assert.equal((await ver('novo', 'aula-02')).status, 403); // removido volta a visitante
  assert.equal((await post({ acao: 'remover_monitor', usuario: 'naoexiste' })).status, 400);
  // listas
  assert.equal((await post({ acao: 'listas', owners: ['dono'], alunos: ['@Ana', 'bia', 'bad name!'] })).status, 400);
  assert.equal((await post({ acao: 'listas', owners: ['outro'], alunos: [] })).status, 400); // não pode se remover
  assert.equal((await post({ acao: 'listas', owners: ['dono', 'Prof'], alunos: ['@Ana', 'bia', 'ana'] })).status, 200);
  assert.deepEqual(cfg.alunos, ['ana', 'bia']); assert.deepEqual(cfg.owners, ['dono', 'prof']);
  assert.equal((await ver('ana', 'aula-02')).status, 200);
  assert.equal((await ver('prof', 'aula-03')).status, 200);
  // compatibilidade: formato antigo (monitores como lista) vira monitores sem permissão extra
  assert.deepEqual(u.normalizar({ monitores: ['A', 'b'] }).monitores, { a: { aulas: [], roteiros: [] }, b: { aulas: [], roteiros: [] } });
  // login: state e redirect seguro
  r = await chamar(h('login'), { query: { next: '//evil.com' } });
  assert.equal(r.status, 302); assert(r.h.Location.startsWith('https://github.com/login/oauth/authorize?client_id=cid')); assert(!r.h.Location.includes('scope='));
  const st = u.verificar(decodeURIComponent(r.h['Set-Cookie'].split(';')[0].split('=').slice(1).join('='))); assert.equal(st.n, '/');
  r = await chamar(h('login'), { query: { next: '/aula/nivel-00-tutorial/aula-02' } });
  const cookieSt = r.h['Set-Cookie'].split(';')[0]; const state = new URL(r.h.Location).searchParams.get('state');
  r = await chamar(h('callback'), { query: { code: 'c', state: 'errado' }, headers: { cookie: cookieSt } }); assert.equal(r.status, 400);
  const antes = global.fetch;
  global.fetch = async (url, op) => url.includes('login/oauth/access_token') ? resp(200, { access_token: 't' }) : url.endsWith('/user') ? resp(200, { login: 'Ana' }) : antes(url, op);
  r = await chamar(h('callback'), { query: { code: 'c', state }, headers: { cookie: cookieSt } });
  assert.equal(r.status, 302); assert.equal(r.h.Location, '/aula/nivel-00-tutorial/aula-02');
  const sc = r.h['Set-Cookie'].find((c) => c.startsWith('liga_s=')); assert(sc.includes('HttpOnly') && sc.includes('Secure') && sc.includes('SameSite=Lax'));
  global.fetch = antes;
  // ---------- site: tema, imagens, anúncios, agenda ----------
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  const salvarSite = (site, user = 'dono') => chamar(h('personalizar'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: { acao: 'salvar', site, resumo: 'teste' } });
  r = await chamar(h('site')); assert.equal(r.status, 200); assert(JSON.parse(r.body).nome); // padrão sem arquivo
  r = await chamar(h('tema')); assert(r.body.includes('--ouro:#f5b83d'));
  for (const x of ['alu1', 'mon1', null]) assert.equal((await chamar(h('personalizar'), { user: x })).status, 403);
  assert.equal((await salvarSite({}, 'alu1')).status, 403);
  r = await chamar(h('personalizar'), { user: 'dono' }); assert.equal(r.status, 200);
  // upload valida o conteúdo real da imagem
  const up = (dados, user = 'dono') => chamar(h('personalizar'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: { acao: 'upload', nome: 'Meu Logo!.png', dados } });
  r = await up('data:image/png;base64,' + Buffer.from('nao sou imagem').toString('base64')); assert.equal(r.status, 400);
  r = await up('data:image/png;base64,' + PNG.toString('base64')); assert.equal(r.status, 200);
  const nomeImg = JSON.parse(r.body).nome; assert(/^meu-logo-[a-z0-9]+\.png$/.test(nomeImg));
  r = await chamar(h('imagem'), { query: { n: nomeImg } }); assert.equal(r.status, 200); assert.equal(r.h['Content-Type'], 'image/png');
  assert.equal((await chamar(h('imagem'), { query: { n: '../acesso/acesso.json' } })).status, 404);
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const ontem = new Date(Date.now() - 27 * 3600e3).toISOString().slice(0, 10), amanha = new Date(Date.now() + 21 * 3600e3).toISOString().slice(0, 10);
  r = await salvarSite({ nome: 'Liga X', logo: nomeImg, tema: { primaria: '#ff0000', bg: 'url(x)' }, raio: 99, fundos: { inicio: { img: nomeImg, escurecer: 30 }, painel: { img: '../x.png' } },
    boasVindas: { titulo: 'Oi', texto: '<script>alert(1)</script>' },
    anuncios: [{ titulo: 'Público', visivel: 'publico', link: 'javascript:alert(1)' }, { titulo: 'Só membros', visivel: 'membros', fixo: true }, { titulo: 'Vencido', ate: ontem }, { titulo: 'Futuro', de: amanha }, { titulo: '' }],
    agenda: [{ titulo: 'Passou', data: ontem }, { titulo: 'Hoje', data: hoje, hora: '13:00' }, { titulo: 'Sem data' }, { titulo: 'Membros', data: amanha, visivel: 'membros' }],
    redes: [{ nome: 'Instagram', url: 'https://instagram.com/lag' }, { nome: 'Instagram', url: 'javascript:alert(1)' }] });
  assert.equal(r.status, 200); assert(siteCommits[0].includes('dono'));
  const salvo = JSON.parse(siteJson);
  assert.equal(salvo.tema.primaria, '#ff0000'); assert.equal(salvo.tema.bg, '#12141c'); assert.equal(salvo.raio, 30); assert.equal(salvo.fundos.painel.img, ''); assert.equal(salvo.redes.length, 1); assert.equal(salvo.anuncios[0].link, '');
  r = await chamar(h('tema')); assert(r.body.includes('--ouro:#ff0000') && r.body.includes(`body[data-pg="inicio"]`) && r.body.includes(nomeImg) && !r.body.includes('url(x)') && !r.body.includes('painel"]'));
  // leitor: visitante só vê o público e o que está na validade; membro vê mais; fixo vem primeiro
  let v = JSON.parse((await chamar(h('site'))).body); assert.deepEqual(v.anuncios.map((a) => a.titulo), ['Público']); assert.deepEqual(v.agenda.map((a) => a.titulo), ['Hoje']); assert.equal(v.redes.length, 1);
  v = JSON.parse((await chamar(h('site'), { user: 'dono' })).body); assert.deepEqual(v.anuncios.map((a) => a.titulo), ['Só membros', 'Público']); assert.deepEqual(v.agenda.map((a) => a.titulo), ['Hoje', 'Membros']);
  assert(!JSON.stringify(v).includes('"owners"')); // não vaza configuração de acesso
  // ---------- equipe: cargos com permissões específicas ----------
  const eq = (usuario, titulo, permissoes, quem = 'dono') => post({ acao: 'equipe', usuario, titulo, permissoes }, {}, quem);
  assert.equal((await eq('mkt', 'Marketing e artes', ['site', 'invalida'])).status, 200);
  assert.deepEqual(cfg.equipe.mkt, { titulo: 'Marketing e artes', permissoes: ['site'] }); assert(commits[commits.length - 1].includes('dono'));
  assert.equal((await eq('sec', 'Secretaria', ['pessoas', 'tarefas'])).status, 200);
  assert.equal((await eq('aul', 'Ensino', ['aulas'])).status, 200);
  assert.equal((await eq('tes', 'Tesouraria', [])).status, 200);
  // marketing: só o site
  assert.equal((await chamar(h('personalizar'), { user: 'mkt' })).status, 200);
  assert.equal((await salvarSite({ nome: 'Marketing mudou' }, 'mkt')).status, 200);
  assert.equal((await chamar(h('semanas'), { user: 'mkt' })).status, 403);
  assert.equal((await chamar(h('admin'), { user: 'mkt' })).status, 403);
  assert.equal((await post({ ...AC, chave: CH(3) }, {}, 'mkt')).status, 403);
  assert.equal((await eq('mkt', 'Chefe', ['site', 'aulas', 'pessoas', 'tarefas'], 'mkt')).status, 403); // não se promove
  // secretaria: pessoas + tarefas, sem site e sem aulas
  assert.equal((await chamar(h('semanas'), { user: 'sec' })).status, 200);
  assert.equal((await chamar(h('personalizar'), { user: 'sec' })).status, 403);
  r = await chamar(h('admin'), { user: 'sec' }); assert.equal(r.status, 200); const ad = JSON.parse(r.body); assert(ad.alunos && !ad.equipe && ad.dono === false);
  assert.equal((await post({ ...AC, chave: CH(3) }, {}, 'sec')).status, 403);
  assert.equal((await eq('sec', 'x', ['site'], 'sec')).status, 403);
  assert.equal((await post({ acao: 'listas', owners: ['sec', 'intruso'], alunos: ['alu1', 'novo1'] }, {}, 'sec')).status, 200);
  assert(!cfg.owners.includes('intruso') && cfg.owners.includes('dono') && cfg.alunos.includes('novo1')); // não mexe em owners
  assert.equal((await post({ acao: 'monitor', usuario: 'mon9', aulas: [], roteiros: [] }, {}, 'sec')).status, 200);
  await post({ acao: 'listas', owners: cfg.owners, alunos: ['alu1'] });
  // ensino: só níveis de aula
  assert.equal((await post({ ...AC, chave: CH(3), nivel: 'membros' }, {}, 'aul')).status, 200); assert.equal(cfg.aulas[CH(3)], 'membros');
  assert.equal((await post({ acao: 'listas', owners: [], alunos: [] }, {}, 'aul')).status, 403);
  await post({ ...AC, chave: CH(3), nivel: 'owners' });
  // tesouraria: só título, vê como membro
  assert.equal((await chamar(h('admin'), { user: 'tes' })).status, 403); assert.equal((await ver('tes', 'aula-02')).status, 200); assert.equal((await ver('tes', 'aula-03')).status, 403);
  r = JSON.parse((await chamar(h('aulas'), { user: 'tes' })).body); assert.equal(r.papel, 'equipe'); assert.equal(r.titulo, 'Tesouraria'); assert.deepEqual(r.permissoes, []);
  r = JSON.parse((await chamar(h('aulas'), { user: 'dono' })).body); assert.equal(r.permissoes.length, 4);
  assert.equal((await post({ acao: 'remover_equipe', usuario: 'mkt' }, {}, 'sec')).status, 403);
  assert.equal((await post({ acao: 'remover_equipe', usuario: 'mkt' })).status, 200); assert.equal((await chamar(h('personalizar'), { user: 'mkt' })).status, 403);
  // painel de aulas e semanas continuam só para quem pode
  assert.equal((await chamar(h('semanas'), { user: 'alu1' })).status, 403);
  console.log('Todos os testes passaram.');
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
