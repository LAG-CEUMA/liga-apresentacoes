'use strict';
// Testes locais: simulam o GitHub e chamam as funções do portal.
const assert = require('assert');
process.env.SESSION_SECRET = 'segredo-de-teste-123456';
process.env.GH_TOKEN = 'x'; process.env.GITHUB_CLIENT_ID = 'cid'; process.env.GITHUB_CLIENT_SECRET = 'sec';
process.env.ADMIN_USERS = 'chefe';

let cfg = { owners: ['dono'], monitores: { mon1: { aulas: [], roteiros: [] }, mon2: { aulas: ['nivel-00-tutorial/aula-03'], roteiros: ['nivel-00-tutorial/aula-01'] } }, alunos: ['alu1'], aulas: { 'nivel-00-tutorial/aula-01': 'publico', 'nivel-00-tutorial/aula-02': 'membros' } };
const dadosArq = {}; let dSeq = 0; const shaArq = {}; const histArq = {}; let nCommit = 0;
let siteJson = null, siteSha = null; const siteCommits = []; const imagens = {}; let modJson = null, modSha = null;
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
const reservados = {}; let nRes = 0;
const issues = {}, issuesCriadas = [], comentarios = {};
global.fetch = async (url, op = {}) => {
  const p = new URL(url).pathname;
  { const mi = /\/repos\/LAG-CEUMA\/aluno-([a-z0-9-]+)\/issues(?:\/(\d+)\/comments)?$/.exec(p);
    if (mi) { if (op.method === 'POST') { if (mi[1] === 'semrepo') return resp(404, {}); const n = (issues[mi[1]] = (issues[mi[1]] || 0) + 1); issuesCriadas.push({ aluno: mi[1], n, ...JSON.parse(op.body) }); return resp(201, { number: n, html_url: `https://github.com/LAG-CEUMA/aluno-${mi[1]}/issues/${n}` }); }
      return resp(200, comentarios[mi[1] + '#' + mi[2]] || []); } }
  if (p.endsWith('/git/trees/main')) return resp(200, { tree: [...Object.keys(arquivos).map((path) => ({ path })), ...Object.keys(dadosArq).map((path) => ({ path })), { path: 'niveis/../segredo/slides/aula-09.html' }, { path: 'docs/x.html' }] });
  if (p.endsWith('/contents/acesso/acesso.json')) {
    if (op.method === 'PUT') { const b = JSON.parse(op.body); if (b.sha !== sha) return resp(409, {}); cfg = JSON.parse(Buffer.from(b.content, 'base64').toString()); sha = 'sha' + (commits.push(b.message) + 1); return resp(200, {}); }
    return resp(200, { sha, content: Buffer.from(JSON.stringify(cfg)).toString('base64') });
  }
  { const md = /\/contents\/(dados\/.+)$/.exec(p);
    if (md) { const k = decodeURIComponent(md[1]);
      if (op.method === 'PUT') { const b = JSON.parse(op.body); if (dadosArq[k] && dadosArq[k].sha !== b.sha) return resp(409, {}); if (!dadosArq[k] && b.sha) return resp(422, {}); dadosArq[k] = { sha: 'd' + (++dSeq), texto: Buffer.from(b.content, 'base64').toString(), msg: b.message }; return resp(200, {}); }
      if (op.method === 'DELETE') { delete dadosArq[k]; return resp(200, {}); }
      if (!dadosArq[k]) return resp(404, {});
      if (String((op.headers || {}).Accept || '').includes('raw')) return resp(200, dadosArq[k].texto);
      return resp(200, { sha: dadosArq[k].sha, content: Buffer.from(dadosArq[k].texto).toString('base64') }); } }
  { const mr0 = /\/contents\/((?:reservado|wiki)\/.+)$/.exec(p);
    if (mr0) { const k = decodeURIComponent(mr0[1]);
      if (op.method === 'PUT') { const b = JSON.parse(op.body); if (reservados[k] && reservados[k].sha !== b.sha) return resp(409, {}); if (!reservados[k] && b.sha) return resp(422, {}); reservados[k] = { sha: 'r' + (++nRes), texto: Buffer.from(b.content, 'base64').toString() }; return resp(200, {}); }
      if (op.method === 'DELETE') { const b = JSON.parse(op.body); if (!reservados[k] || reservados[k].sha !== b.sha) return resp(409, {}); delete reservados[k]; return resp(200, {}); }
      if (!reservados[k]) return resp(404, {});
      if (String((op.headers || {}).Accept || '').includes('raw')) return resp(200, reservados[k].texto);
      return resp(200, { sha: reservados[k].sha, content: Buffer.from(reservados[k].texto).toString('base64') }); } }
  if (p.endsWith('/contents/site/site.json')) {
    if (op.method === 'PUT') { const b = JSON.parse(op.body); if (siteSha && b.sha !== siteSha) return resp(409, {}); siteJson = Buffer.from(b.content, 'base64').toString(); siteSha = 's' + (siteCommits.push(b.message) + 1); return resp(200, {}); }
    return siteJson === null ? resp(404, {}) : resp(200, { sha: siteSha, content: Buffer.from(siteJson).toString('base64') });
  }
  if (p.endsWith('/contents/site/imagens')) return resp(200, Object.keys(imagens).map((name) => ({ name })));
  if (p.endsWith('/contents/site/imagens/modulos.json')) {
    if (op.method === 'PUT') { const c = JSON.parse(op.body); if (modSha && c.sha !== modSha) return resp(409, {}); modJson = Buffer.from(c.content, 'base64').toString(); modSha = 'm' + Math.random().toString(36).slice(2); return resp(200, {}); }
    return modJson === null ? resp(404, {}) : resp(200, { content: Buffer.from(modJson).toString('base64'), sha: modSha });
  }
  { const mi = /\/contents\/site\/imagens\/(.+)$/.exec(p);
    if (mi) { if (op.method === 'PUT') { imagens[mi[1]] = Buffer.from(JSON.parse(op.body).content, 'base64'); return resp(201, {}); }
      if (op.method === 'DELETE') { delete imagens[mi[1]]; return resp(200, {}); }
      return imagens[mi[1]] ? { status: 200, ok: true, arrayBuffer: async () => imagens[mi[1]], json: async () => ({ sha: 'i1' }) } : resp(404, {}); } }
  const m = /\/contents\/(.+)$/.exec(p);
  if (m && op.method === 'PUT' && /^niveis\//.test(decodeURIComponent(m[1]))) { const k = decodeURIComponent(m[1]), b = JSON.parse(op.body);
    if (arquivos[k] !== undefined && b.sha !== 'sa' + (shaArq[k] || 0)) return resp(409, {}); if (arquivos[k] === undefined && b.sha) return resp(422, {});
    arquivos[k] = Buffer.from(b.content, 'base64').toString(); shaArq[k] = (shaArq[k] || 0) + 1; (histArq[k] = histArq[k] || []).unshift({ sha: String(++nCommit).padStart(40, '0'), texto: arquivos[k], msg: b.message }); return resp(200, { content: { sha: 'sa' + shaArq[k] } }); }
  if (p.endsWith('/commits')) { const k = new URL(url).searchParams.get('path'); return resp(200, (histArq[k] || []).map((x) => ({ sha: x.sha, commit: { message: x.msg, author: { date: '2026-10-16T12:00:00Z' } } }))); }
  { const mr = /\/contents\/(.+)$/.exec(p), ref = new URL(url).searchParams.get('ref');
    if (mr && /^[0-9a-f]{40}$/.test(ref || '')) { const v = ((histArq[decodeURIComponent(mr[1])]) || []).find((x) => x.sha === ref); return v ? resp(200, { sha: 'x', content: Buffer.from(v.texto).toString('base64') }) : resp(404, {}); } }
  if (m && arquivos[decodeURIComponent(m[1])] !== undefined) { const k = decodeURIComponent(m[1]);
    if (String((op.headers || {}).Accept || '').includes('raw')) return resp(200, arquivos[k]);
    return resp(200, { sha: 'sa' + (shaArq[k] || 0), content: Buffer.from(arquivos[k]).toString('base64') }); }
  return resp(404, {});
};
const u = require('../lib/util');
const ROTAS = ['login', 'callback', 'logout', 'site', 'tema', 'imagem', 'certificado', 'reservado', 'wiki'];
const h = (n) => require((ROTAS.includes(n) ? '../lib/rotas/' : '../api/') + n);
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
  // Ver como: owner navega como outra pessoa (somente leitura)
  { const cc = (user, body, extra = {}) => chamar((rq, rs) => require('../lib/rotas/como')(rq, rs), { user, method: 'POST', body, headers: { origin: 'https://site.test', 'content-type': 'application/json', ...extra } });
    assert.equal((await cc('alu1', { usuario: 'alu1' })).status, 403);
    assert.equal((await cc('dono', { usuario: 'chefe' })).status, 400);
    const r0 = await cc("dono", { usuario: "alu1" }); assert.equal(r0.status, 200); const ck = String(r0.h["Set-Cookie"]).split(';')[0];
    const comCookie = (user, metodo) => { const rq = { method: metodo, headers: { host: 'site.test', cookie: 'liga_s=' + encodeURIComponent(u.assinar({ u: user, exp: Date.now() + 1e6 })) + '; ' + ck } }; return rq; };
    assert.equal(u.usuarioDaSessao(comCookie('dono', 'GET')), 'alu1');
    assert.equal(u.usuarioDaSessao(comCookie('dono', 'POST')), null); // escrita bloqueada
    assert.equal(u.usuarioDaSessao(comCookie('outro', 'GET')), 'outro'); // cookie de outro owner não vale
  }
  // Banco de imagens: só owner lista/exclui; em uso pede confirmação
  { const ad = (b, user = 'dono') => chamar(h('admin'), { user, method: 'POST', body: b, headers: { origin: 'https://site.test', 'content-type': 'application/json' } });
    imagens['teste-a.png'] = Buffer.from('x'); imagens['teste-b.png'] = Buffer.from('x');
    assert.equal((await ad({ acao: 'imagens_listar' }, 'alu1')).status, 403);
    assert.equal((await ad({ acao: 'imagem_excluir', nome: 'teste-a.png' }, 'alu1')).status, 403);
    const ls = JSON.parse((await ad({ acao: 'imagens_listar' })).body); assert(ls.imagens.some((x) => x.nome === 'teste-a.png'));
    assert.equal((await ad({ acao: 'imagem_excluir', nome: '../x.png' })).status, 400);
    assert.equal((await ad({ acao: 'imagem_excluir', nome: 'teste-a.png' })).status, 200); assert(!imagens['teste-a.png']);
    assert.equal((await ad({ acao: 'imagem_excluir', nome: 'teste-a.png' })).status, 404);
    imagens['teste-b.png'] && delete imagens['teste-b.png']; }
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
  assert.deepEqual(cfg.monitores.novo, { aulas: [CH(3)], roteiros: [CH(1)], turmas: [] });
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
  assert.deepEqual(u.normalizar({ monitores: ['A', 'b'] }).monitores, { a: { aulas: [], roteiros: [], turmas: [] }, b: { aulas: [], roteiros: [], turmas: [] } });
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
  const completa = (x) => { if (!x || typeof x !== 'object' || x.__semPeso) return x; const o = { ...x }; o.ordem = o.ordem || { boasVindas: 10, anuncios: 20, agenda: 30, vitrine: 40, rankings: 45 };
    for (const l of ['anuncios', 'agenda', 'vitrine']) if (Array.isArray(o[l])) o[l] = o[l].map((i, n) => ({ peso: 10, ...i })); return o; };
  const salvarSite = (site, user = 'dono') => chamar(h('personalizar'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: { acao: 'salvar', site: completa(site), resumo: 'teste' } });
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
  assert.deepEqual(cfg.equipe.mkt, { titulo: 'Marketing e artes', permissoes: ['site'], cargos: [] }); assert(commits[commits.length - 1].includes('dono'));
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
  r = JSON.parse((await chamar(h('aulas'), { user: 'dono' })).body); assert.equal(r.permissoes.length, 6);
  assert.equal((await post({ acao: 'remover_equipe', usuario: 'mkt' }, {}, 'sec')).status, 403);
  assert.equal((await post({ acao: 'remover_equipe', usuario: 'mkt' })).status, 200); assert.equal((await chamar(h('personalizar'), { user: 'mkt' })).status, 403);
  // ---------- presença: chamada em até 3 momentos, participações e histórico ----------
  await post({ acao: 'listas', owners: cfg.owners, alunos: ['alu1', 'alu2', 'alu3'] });
  await eq('pres', 'Secretaria', ['presenca']);
  await post({ acao: 'monitor', usuario: 'mon2', aulas: [CH(3)], roteiros: [] });
  const pres = (corpo, user = 'dono') => chamar(h('presenca'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: corpo });
  const getp = (query, user = 'dono') => chamar(h('presenca'), { query, user });
  const T = '2026';
  assert.equal((await getp({ acao: 'contexto' }, null)).status, 401);
  assert.equal((await getp({ acao: 'contexto' }, 'alu1')).status, 403);
  assert.equal((await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 1, estados: {} }, 'alu1')).status, 403);
  r = JSON.parse((await getp({ acao: 'contexto' }, 'dono')).body); assert.equal(r.aulas.length, 3); assert.deepEqual(r.roster, ['alu1', 'alu2', 'alu3']);
  r = JSON.parse((await getp({ acao: 'contexto' }, 'mon2')).body); assert.deepEqual(r.aulas.map((a) => a.chave), [CH(3)]); // monitor só da aula concedida
  assert.equal((await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 1, estados: {} }, 'mon2')).status, 400);
  // três chamadas: início, meio, fim
  r = await pres({ acao: 'chamada', turma: T, chave: CH(1), data: '2026-11-03', n: 1, estados: { alu1: 'p', alu2: 'p', alu3: 'j', intruso: 'p' } }, 'pres'); assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).presentes, 2);
  assert(!dadosArq['dados/aulas/2026/' + CH(1) + '.json'].texto.includes('intruso')); // só quem é aluno
  await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 2, estados: { alu1: 'p' } }, 'pres'); // alu2 sem marca = ausente
  await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 3, estados: { alu1: 'p', alu2: 'p' } }, 'pres');
  assert.equal((await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 4, estados: {} })).status, 400);
  assert.equal((await pres({ acao: 'chamada', turma: '../x', chave: CH(1), n: 1, estados: {} })).status, 400);
  assert(Object.values(dadosArq).some((x) => /Portal: pres salvou a chamada 3/.test(x.msg)) && !Object.values(dadosArq).some((x) => /alu1/.test(x.msg))); // commit sem nomes de alunos
  r = JSON.parse((await pres({ acao: 'participacao', turma: T, chave: CH(1), usuario: 'alu1', tipo: 'pergunta', nota: 'Boa pergunta', pontos: 3 }, 'pres')).body); assert(r.ok);
  assert.equal((await pres({ acao: 'participacao', turma: T, chave: CH(1), usuario: 'estranho', tipo: 'pergunta', pontos: 1 }, 'pres')).status, 400);
  assert.equal((await pres({ acao: 'participacao', turma: T, chave: CH(1), usuario: 'alu1', tipo: 'inventado', pontos: 1 }, 'pres')).status, 400);
  r = JSON.parse((await getp({ acao: 'historico' }, 'pres')).body); const rs = r.sessoes[0].resumo;
  assert.equal(rs.alu1.status, 'presente'); assert.equal(rs.alu1.pontos, 3); assert.equal(rs.alu2.status, 'presente'); // 2 de 3
  assert.equal(rs.alu3.status, 'ausente'); // 1 justificada em 3: não basta
  assert.equal(r.sessoes[0].chamadas, 3);
  // cada aluno vê só o que é dele
  r = JSON.parse((await getp({ acao: 'minha' }, 'alu1')).body); assert.equal(r.sessoes.length, 1); assert.equal(r.sessoes[0].status, 'presente'); assert.equal(r.sessoes[0].participacoes[0].pontos, 3);
  assert(!JSON.stringify(r).includes('alu2'));
  assert.equal((await getp({ acao: 'historico' }, 'alu1')).status, 403);
  assert.equal((await getp({ acao: 'minha' }, null)).status, 401);
  // salvar a chamada de novo substitui só aquela chamada
  await pres({ acao: 'chamada', turma: T, chave: CH(1), n: 3, estados: { alu1: 'p', alu2: 'p', alu3: 'p' } }, 'pres');
  r = JSON.parse((await getp({ acao: 'sessao', turma: T, chave: CH(1) }, 'pres')).body); assert.equal(r.sessao.chamadas[3].estados.alu3, 'p'); assert.equal(Object.keys(r.sessao.chamadas).length, 3);
  const idp = r.sessao.participacoes[0].id;
  assert.equal((await pres({ acao: 'remover_participacao', turma: T, chave: CH(1), id: idp }, 'pres')).status, 200);
  // ---------- cargos, turmas e ficha da pessoa ----------
  assert.deepEqual(Object.keys(u.normalizar({ alunos: ['x'] }).turmas), ['2026']); // migração: turma padrão
  assert.deepEqual(u.normalizar({ alunos: ['x'] }).turmas['2026'].alunos, ['x']);
  assert.equal((await post({ acao: 'cargo', nome: 'Marketing e artes', descricao: 'Redes', permissoes: ['site', 'xx'] }, {}, 'sec')).status, 403); // só owner cria cargo
  assert.equal((await post({ acao: 'cargo', nome: 'Marketing e artes', descricao: 'Redes', permissoes: ['site', 'xx'] })).status, 200);
  assert.deepEqual(cfg.cargos['marketing-e-artes'].permissoes, ['site']);
  assert.equal((await post({ acao: 'cargo', nome: 'Tesouraria', permissoes: [] })).status, 200);
  for (const x of ['marina', 'bia', 'ex-aluno', 'davi-novato', 'luiza-dev', 'pedro-h']) await require('../lib/pendentes').salvar({ usuario: x, nome: 'Nome ' + x, email: x + '@ceuma.com.br' }, 'teste');
  assert.equal((await post({ acao: 'pessoa', usuario: 'novo-aluno', aluno: true, turmas: ['2026'] }, {}, 'sec')).status, 400);
  assert.equal((await post({ acao: 'pessoa', usuario: 'novo-aluno', nome: 'Novo Aluno', curso: 'ADS', aluno: true, turmas: ['2026'] }, {}, 'sec')).status, 200);
  assert.equal((await post({ acao: 'pessoa', usuario: 'novo-aluno', nome: 'Novo Aluno', email: 'novo@ceuma.com.br', aluno: true, turmas: ['2026'] }, {}, 'sec')).status, 200);
  assert.equal((await require('../lib/pendentes').ler()).lista.find((x) => x.usuario === 'novo-aluno').email, 'novo@ceuma.com.br');
  assert.equal((await post({ acao: 'pessoa', usuario: 'outro-aluno', nome: 'Outro', email: 'novo@ceuma.com.br', aluno: true }, {}, 'sec')).status, 400);
  assert.equal((await post({ acao: 'pessoa', usuario: 'marina', equipe: true, cargos: ['marketing-e-artes', 'tesouraria', 'nao-existe'] })).status, 200);
  assert.deepEqual(cfg.equipe.marina.cargos, ['marketing-e-artes', 'tesouraria']);
  r = JSON.parse((await chamar(h('aulas'), { user: 'marina' })).body); assert.deepEqual(r.permissoes, ['site']); assert.equal(r.titulo, 'Marketing e artes, Tesouraria');
  assert.equal((await chamar(h('personalizar'), { user: 'marina' })).status, 200);
  assert.equal((await post({ acao: 'cargo', id: 'marketing-e-artes', nome: 'Marketing e artes', permissoes: ['site', 'tarefas'] })).status, 200); // muda o cargo, muda a pessoa
  r = JSON.parse((await chamar(h('aulas'), { user: 'marina' })).body); assert.deepEqual(r.permissoes, ['site', 'tarefas']);
  assert.equal((await post({ acao: 'turma', id: '2027.1', nome: 'Turma 2027.1', status: 'planejada', inicio: '2027-03-01' }, {}, 'sec')).status, 200);
  assert.equal((await post({ acao: 'turma', id: '../x' }, {}, 'sec')).status, 400);
  assert.equal((await post({ acao: 'adicionar', papel: 'aluno', turma: '2027.1', usuarios: ['davi-novato', '@Luiza-Dev', 'https://github.com/pedro-h', 'joao silva', 'ana_clara'], pessoas: [] }, {}, 'sec')).status, 200);
  assert.equal((await post({ acao: 'adicionar', papel: 'aluno', usuarios: ['semnome1'] }, {}, 'sec')).status, 400);
  assert.equal((await post({ acao: 'pendente_remover', chave: 'davi-novato@ceuma.com.br' })).status, 400);
  assert(cfg.alunos.includes('luiza-dev') && cfg.alunos.includes('pedro-h') && !cfg.alunos.includes('ana_clara'));
  assert.deepEqual(cfg.turmas['2027.1'].alunos.sort(), ['davi-novato', 'luiza-dev', 'pedro-h']);
  assert.equal((await post({ acao: 'adicionar', papel: 'equipe', usuarios: ['qq'] }, {}, 'sec')).status, 403);
  assert.equal((await post({ acao: 'pessoa', usuario: 'bia', aluno: true, turmas: ['2026'], monitor: true, aulas: [CH(1)], roteiros: [CH(1)], monitor_turmas: ['2026', 'nada'] }, {}, 'sec')).status, 200);
  assert.deepEqual(cfg.monitores.bia, { aulas: [CH(1)], roteiros: [CH(1)], turmas: ['2026'] }); assert(cfg.turmas['2026'].alunos.includes('bia'));
  assert.equal((await post({ acao: 'pessoa', usuario: 'bia', equipe: true, cargos: ['tesouraria'] }, {}, 'sec')).status, 200); // sec não mexe em equipe
  assert.equal(cfg.equipe.bia, undefined);
  assert.equal((await post({ acao: 'mover_turma', de: '2027.1', para: '2026', usuarios: ['davi-novato'] }, {}, 'sec')).status, 200);
  assert(cfg.turmas['2026'].alunos.includes('davi-novato') && !cfg.turmas['2027.1'].alunos.includes('davi-novato'));
  // chamada usa só os alunos da turma; monitor só nas turmas dele
  r = await pres({ acao: 'chamada', turma: '2027.1', chave: CH(1), n: 1, estados: { 'luiza-dev': 'p', 'davi-novato': 'p' } }, 'dono'); assert.equal(r.status, 200); assert.equal(JSON.parse(r.body).presentes, 1);
  assert.equal((await pres({ acao: 'chamada', turma: '2027.1', chave: CH(1), n: 1, estados: {} }, 'bia')).status, 400); // bia só ensina a 2026
  r = JSON.parse((await getp({ acao: 'contexto' }, 'bia')).body); assert(r.turmas['2026'] && !r.turmas['2027.1']);
  assert.equal((await post({ acao: 'remover_pessoa', usuario: 'dono' }, {}, 'sec')).status, 400);
  assert.equal((await post({ acao: 'remover_pessoa', usuario: 'bia' }, {}, 'sec')).status, 200); assert(!cfg.monitores.bia && !cfg.turmas['2026'].alunos.includes('bia'));
  assert.equal((await post({ acao: 'remover_cargo', id: 'tesouraria' })).status, 200); assert.deepEqual(cfg.equipe.marina.cargos, ['marketing-e-artes']);
  // ---------- nível por turma, promover e acesso após arquivar ----------
  {
    const c = u.normalizar({ alunos: ['a', 'b', 'c'], aulas: { 'nivel-00/aula-01': 'membros', 'nivel-01/aula-01': 'membros', 'nivel-01/aula-02': 'publico' },
      turmas: { n0: { nome: 'N0', status: 'arquivada', nivel: 'nivel-00', acessoApos: true, alunos: ['a', 'b'] }, n1: { nome: 'N1', status: 'andamento', nivel: 'nivel-01', alunos: ['a'] }, n0x: { nome: 'x', status: 'arquivada', nivel: 'nivel-00', acessoApos: false, alunos: ['c'] } } });
    assert(u.pode(c, 'a', 'nivel-00/aula-01', false) && u.pode(c, 'a', 'nivel-01/aula-01', false)); // duas turmas: vê os dois níveis
    assert(u.pode(c, 'b', 'nivel-00/aula-01', false) && !u.pode(c, 'b', 'nivel-01/aula-01', false)); // arquivada com acesso: só o nível dela
    assert(!u.pode(c, 'c', 'nivel-00/aula-01', false)); // arquivada sem acesso
    assert(u.pode(c, 'c', 'nivel-01/aula-02', false)); // público é de todos
    assert(!u.pode(c, 'a', 'nivel-00/aula-01', true)); // roteiro nunca
    assert.equal(u.niveisDoAluno(u.normalizar({ alunos: ['z'] }), 'z'), null); // turma sem nível = todos
  }
  assert.equal((await post({ acao: 'turma', id: '2026', nome: '2026', nivel: 'nivel-00-tutorial', fim: '2026-12-15', acessoApos: false }, {}, 'sec')).status, 200);
  assert.equal(cfg.turmas['2026'].nivel, 'nivel-00-tutorial'); assert.equal(cfg.turmas['2026'].fim, '2026-12-15'); assert.equal(cfg.turmas['2026'].acessoApos, false);
  assert.equal((await post({ acao: 'turma', id: '2026', nome: '2026', nivel: 'nivel-inexistente' }, {}, 'sec')).status, 200); assert.equal(cfg.turmas['2026'].nivel, '');
  assert.equal((await post({ acao: 'turma', id: '2026.2-N1', nome: 'Nível 1', status: 'andamento' }, {}, 'sec')).status, 200);
  const alunos26 = cfg.turmas['2026'].alunos.slice();
  assert.equal((await post({ acao: 'promover', de: '2026', para: '2026.2-N1', usuarios: alunos26.slice(0, 1).concat(['intruso']) }, {}, 'sec')).status, 200);
  assert.deepEqual(cfg.turmas['2026.2-N1'].alunos, alunos26.slice(0, 1)); assert.deepEqual(cfg.turmas['2026'].alunos, alunos26); // copia, origem intacta
  assert.equal((await post({ acao: 'promover', de: '2026', para: '2026.2-N1', usuarios: [] }, {}, 'sec')).status, 400);
  // ---------- código em maiúsculas, renomear, excluir e validade do acesso ----------
  assert.equal((await post({ acao: 'turma', id: 'novo-x', nome: 'Teste', inicio: '2026-12-01', fim: '2026-11-01' }, {}, 'sec')).status, 400); // fim antes do início
  assert.equal((await post({ acao: 'turma', id: 'novo-x', nome: 'Teste', inicio: '2026-11-01', fim: '2026-12-01' }, {}, 'sec')).status, 200); assert(cfg.turmas['NOVO-X'] && !cfg.turmas['novo-x']);
  assert.equal((await post({ acao: 'turma', id: 'NOVO-X', inicio: '2026-11-03' }, {}, 'sec')).status, 200); assert.equal(cfg.turmas['NOVO-X'].fim, '2026-12-01'); // datas editáveis depois
  assert.equal((await post({ acao: 'renomear_turma', de: 'NOVO-X', para: '2026.2-n0' }, {}, 'sec')).status, 200); assert(cfg.turmas['2026.2-N0'] && !cfg.turmas['NOVO-X']);
  assert.equal((await post({ acao: 'renomear_turma', de: '2026.2-N0', para: '2026' }, {}, 'sec')).status, 400); // já existe
  assert.equal((await post({ acao: 'renomear_turma', de: '2026', para: 'OUTRA' }, {}, 'sec')).status, 400); // tem chamadas salvas
  assert.equal((await post({ acao: 'excluir_turma', id: '2026' }, {}, 'sec')).status, 400); // tem alunos
  assert.equal((await post({ acao: 'excluir_turma', id: '2026.2-N0' }, {}, 'sec')).status, 200); assert(!cfg.turmas['2026.2-N0']);
  assert.equal((await post({ acao: 'turma', id: '2026.2-N1', status: 'arquivada' }, {}, 'sec')).status, 200); assert.equal(cfg.turmas['2026.2-N1'].acessoAte, u.maisUmAno()); // arquivar = 1 ano
  assert.equal((await post({ acao: 'turma', id: '2026.2-N1', status: 'andamento' }, {}, 'sec')).status, 200); assert.equal(cfg.turmas['2026.2-N1'].acessoAte, '');
  {
    const c = u.normalizar({ alunos: ['a', 'b'], aulas: { 'n0/aula-01': 'membros' }, turmas: { X: { status: 'arquivada', nivel: 'n0', acessoApos: true, acessoAte: '2020-01-01', alunos: ['a'] }, Y: { status: 'arquivada', nivel: 'n0', acessoApos: true, acessoAte: '2999-01-01', alunos: ['b'] } } });
    assert(!u.pode(c, 'a', 'n0/aula-01', false) && u.pode(c, 'b', 'n0/aula-01', false)); // prazo vencido corta; no prazo mantém
  }
  // ---------- acesso extra por pessoa ----------
  {
    const c = u.normalizar({ alunos: [], aulas: { 'n0/aula-01': 'membros', 'n1/aula-01': 'membros' }, acessos: { Ex: [{ nivel: 'n0', ate: '2999-01-01', motivo: 'pediu para rever' }, { nivel: 'n1', ate: '2020-01-01' }] } });
    assert(u.pode(c, 'ex', 'n0/aula-01', false) && !u.pode(c, 'ex', 'n1/aula-01', false) && !u.pode(c, 'ex', 'n0/aula-01', true)); // vence, e roteiro nunca
    assert(!u.pode(c, 'outro', 'n0/aula-01', false));
  }
  assert.equal((await post({ acao: 'pessoa', usuario: 'ex-aluno', acessos: [{ nivel: 'nivel-00-tutorial', ate: '2999-01-01', motivo: 'pediu para rever' }, { nivel: 'inexistente' }] }, {}, 'sec')).status, 200);
  assert.deepEqual(cfg.acessos['ex-aluno'].map((x) => x.nivel), ['nivel-00-tutorial']);
  assert.equal((await ver('ex-aluno', 'aula-02')).status, 200); // aula-02 está como membros
  assert.equal((await post({ acao: 'pessoa', usuario: 'ex-aluno', acessos: [] }, {}, 'sec')).status, 200); assert(!cfg.acessos['ex-aluno']);
  assert.equal((await ver('ex-aluno', 'aula-02')).status, 403);
  // ---------- pontuação: presença + participação + exercícios − penalidades ----------
  {
    const P = require('../lib/pontos');
    const c = u.normalizar({ alunos: ['a', 'b', 'c'], turmas: { T: { nome: 'T', status: 'andamento', alunos: ['a', 'b', 'c'] } } });
    const mk = (ch, part, ent) => ({ turma: 'T', chave: 'n/aula-01', chamadas: { 1: { estados: ch }, 2: { estados: ch } }, participacoes: part, ...(ent ? { entregas: ent } : {}) });
    const s1 = mk({ a: 'p', b: 'p', c: 'j' }, [{ usuario: 'a', tipo: 'pergunta', pontos: 15 }, { usuario: 'b', tipo: 'penalidade', pontos: 3 }, { usuario: 'a', tipo: 'ajuda', pontos: 15 }], { a: { estado: 'prazo', nota: 10 }, b: { estado: 'atraso' }, c: { estado: 'nao' } });
    const r = P.ranking(c, 'T', [s1]);
    assert.deepEqual(r.map((x) => x.usuario), ['a', 'b', 'c']);
    assert.equal(r[0].total, 100); assert.equal(r[0].partes.participacao, 30); // 30 pts = meta
    assert.equal(r[1].total, 40 + 0 + 15 - 3); // presente + atraso (50%) − penalidade
    assert.equal(r[2].total, 20); // justificado = 50% da presença
    assert.equal(P.ranking(c, 'T', [s1, { ...s1, chave: 'n/aula-02', participacoes: [{ usuario: 'c', tipo: 'penalidade', pontos: 10 }] }]).find((x) => x.usuario === 'c').total >= 0, true); // nunca negativo
    const c2 = u.normalizar({ ...c, pontuacao: { pesos: { presenca: 100, participacao: 0, exercicios: 0 } }, turmas: { T: { ...c.turmas.T, pesos: { presenca: 10 } } } });
    assert.equal(P.ranking(c2, 'T', [s1])[0].partes.presenca, 10); // peso da turma vale mais que o padrão
    assert.deepEqual(P.configPontos(u.normalizar({})).pesos, { presenca: 40, participacao: 30, exercicios: 30 });
  }
  assert.equal((await post({ acao: 'pontuacao', pesos: { presenca: 50, participacao: 20, exercicios: 30 }, meta: 25, tipos: { pergunta: 2 } }, {}, 'sec')).status, 403); // só owner
  assert.equal((await post({ acao: 'pontuacao', pesos: { presenca: 50, participacao: 20, exercicios: 30 }, meta: 25, tipos: { pergunta: 2 }, top5Visivel: false })).status, 200);
  assert.deepEqual(cfg.pontuacao.pesos, { presenca: 50, participacao: 20, exercicios: 30 }); assert.equal(cfg.pontuacao.tipos.pergunta, 2); assert.equal(cfg.pontuacao.top5Visivel, false);
  assert.equal((await post({ acao: 'pontuacao', turma: '2026', pesos: { presenca: 60 } })).status, 200); assert.equal(cfg.turmas['2026'].pesos.presenca, 60);
  await post({ acao: 'pontuacao', turma: '2026', padrao: true }); await post({ acao: 'pontuacao', top5Visivel: true });
  r = await pres({ acao: 'entregas', turma: T, chave: CH(1), estados: { alu1: { estado: 'prazo', nota: 9 }, alu2: { estado: 'atraso' }, intruso: { estado: 'prazo' } } }, 'pres'); assert.equal(r.status, 200); assert.equal(JSON.parse(r.body).entregues, 2);
  assert.equal((await pres({ acao: 'participacao', turma: T, chave: CH(1), usuario: 'alu3', tipo: 'penalidade', nota: 'conversa', pontos: 0 }, 'pres')).status, 400);
  assert.equal((await pres({ acao: 'participacao', turma: T, chave: CH(1), usuario: 'alu3', tipo: 'penalidade', nota: 'conversa', pontos: 2 }, 'pres')).status, 200);
  r = JSON.parse((await getp({ acao: 'ranking', turma: T }, 'dono')).body); assert(r.ranking.length >= 3 && r.ranking[0].posicao === 1);
  assert.equal((await getp({ acao: 'ranking', turma: T }, 'alu1')).status, 403);
  // ---------- atividades individuais ----------
  {
    const P = require('../lib/pontos'), d = require('../lib/dados'), A = require('../lib/atividades');
    const ap = (c, user = 'dono') => pres({ turma: T, ...c }, user);
    r = await ap({ acao: 'ativ_salvar', codigo: 'N0.1-2·E1', titulo: 'Primeira cena', peso: 10, prazo: '2026-11-09T23:59:00-03:00', descricao: 'Faça a cena.' }); assert.equal(r.status, 200); const id1 = JSON.parse(r.body).id; assert.equal(id1, 'n0-1-2-e1');
    r = await ap({ acao: 'ativ_salvar', codigo: 'N0.1-2·E2', titulo: 'Plataforma', peso: 30, descricao: 'Entre.' }); const id2 = JSON.parse(r.body).id;
    assert.equal((await ap({ acao: 'ativ_salvar', titulo: 'x' }, 'alu1')).status, 403); // aluno não cria
    assert.equal((await ap({ acao: 'ativ_salvar', titulo: '' })).status, 400);
    assert.equal(JSON.parse((await getp({ acao: 'minhasatividades' }, 'alu1')).body).atividades.length, 0); // não liberada: aluno não vê
    // liberar só para alu1 e alu2
    r = JSON.parse((await ap({ acao: 'ativ_liberar', id: id1, alunos: ['alu1', 'alu2', 'intruso'] })).body); assert.equal(r.criadas, 2); assert.equal(issuesCriadas.length, 2); assert(/N0.1-2·E1 · Primeira cena/.test(issuesCriadas[0].title) && /Prazo:/.test(issuesCriadas[0].body));
    r = JSON.parse((await ap({ acao: 'ativ_liberar', id: id1, alunos: ['alu1', 'alu2'] })).body); assert.equal(r.criadas, 0); assert.equal(r.jaTinham, 2); assert.equal(issuesCriadas.length, 2); // não duplica
    assert.equal(JSON.parse((await getp({ acao: 'minhasatividades' }, 'alu1')).body).atividades.length, 1);
    assert.equal(JSON.parse((await getp({ acao: 'minhasatividades' }, 'alu3')).body).atividades.length, 0); // alu3 não recebeu
    // depois, libera para todos: só cria para quem falta
    r = JSON.parse((await ap({ acao: 'ativ_liberar', id: id1 })).body); const rosterT = JSON.parse((await getp({ acao: 'atividades', turma: T })).body).roster; assert.equal(r.criadas, rosterT.length - 2); assert.equal(issuesCriadas.length, rosterT.length);
    assert.equal(JSON.parse((await getp({ acao: 'minhasatividades' }, 'alu3')).body).atividades.length, 1);
    // conferência no GitHub
    comentarios['alu1#1'] = [{ user: { login: 'Alu1' }, created_at: '2026-11-08T12:00:00Z', body: 'feito! print', html_url: 'u1' }, { user: { login: 'monitor' }, created_at: '2026-11-08T13:00:00Z', body: 'ok' }];
    comentarios['alu2#1'] = [{ user: { login: 'alu2' }, created_at: '2026-11-11T12:00:00Z', body: 'tarde', html_url: 'u2' }];
    r = JSON.parse((await ap({ acao: 'ativ_conferir', id: id1 })).body).conferencia; assert.equal(r.alu1.sugestao, 'prazo'); assert.equal(r.alu2.sugestao, 'atraso'); assert.equal(r.alu3.respondeu, false); assert.equal(r.alu1.comentarios, 1);
    // entregas: um dispensado, um atrasado com nota, um que não entregou
    assert.equal((await ap({ acao: 'ativ_entregas', id: id1, estados: { alu1: { estado: 'prazo', nota: 10 }, alu2: { estado: 'atraso', nota: 8 }, alu3: { estado: 'dispensado' } } })).status, 200);
    const sess = await d.listarSessoes(); const ativs = await A.listar(T);
    const rk = P.ranking(cfg, T, sess, ativs); const ex = (k) => rk.find((x) => x.usuario === k).partes.exercicios;
    assert(ex('alu1') > ex('alu2')); assert.equal(ex('alu2') > 0, true);
    const antes = ex('alu3'); assert.equal(rk.find((x) => x.usuario === 'alu3').fEx, 0); // dispensado não entra: sem denominador, nada de penalidade
    // segunda atividade (peso 30) só para alu1: alu1 não entregou, pesa mais
    await ap({ acao: 'ativ_liberar', id: id2, alunos: ['alu1'] }); const rk2 = P.ranking(cfg, T, await d.listarSessoes(), await A.listar(T));
    assert(rk2.find((x) => x.usuario === 'alu1').fEx < rk.find((x) => x.usuario === 'alu1').fEx); assert.equal(rk2.find((x) => x.usuario === 'alu2').fEx, rk.find((x) => x.usuario === 'alu2').fEx);
    await ap({ acao: 'ativ_recolher', id: id2 }); assert.equal((await ap({ acao: 'ativ_remover', id: id2 })).status, 400); // já foi liberada
    r = await ap({ acao: 'ativ_salvar', codigo: 'N0.1-2·E3', titulo: 'Rascunho', peso: 5 }); const id3 = JSON.parse(r.body).id; assert.equal((await ap({ acao: 'ativ_remover', id: id3 })).status, 200);
    assert.equal((await ap({ acao: 'ativ_salvar', id: id1, codigo: 'N0.1-2·E1', titulo: 'Primeira cena', peso: 10, prazo: '2026-11-10T23:59:00-03:00', descricao: 'Faça a cena.' })).status, 200); // prazo pode ser mudado depois
    assert.equal(JSON.parse((await getp({ acao: 'atividades', turma: T })).body).atividades.find((a) => a.id === id1).prazo.slice(0, 10), '2026-11-11'); // 23:59 -03 = 02:59Z do dia seguinte
    assert(!Object.values(dadosArq).some((x) => /alu[123]/.test(x.msg || ''))); // commits sem nomes de alunos
    // opcional: não entra no total, só soma pontos extras a quem entregar; Issue deixa claro
    { const f0 = (P.ranking(cfg, T, await d.listarSessoes(), await A.listar(T))); const g = (rk, k) => rk.find((x) => x.usuario === k).fEx; const a2 = g(f0, 'alu2'), a1 = g(f0, 'alu1');
      r = await ap({ acao: 'ativ_salvar', codigo: 'N0.1-2·T4', titulo: 'Desafio', peso: 3, opcional: true, descricao: 'Extra.' }); const idO = JSON.parse(r.body).id; const nIss = issuesCriadas.length;
      await ap({ acao: 'ativ_liberar', id: idO }); assert(issuesCriadas.slice(nIss).every((x) => /\(opcional\)/.test(x.title) && /OPCIONAL/.test(x.body)));
      let rk3 = P.ranking(cfg, T, await d.listarSessoes(), await A.listar(T)); assert.equal(g(rk3, 'alu2'), a2); assert.equal(g(rk3, 'alu1'), a1); // não entregar o opcional não pune
      await ap({ acao: 'ativ_entregas', id: idO, estados: { alu2: { estado: 'prazo', nota: 10 } } }); rk3 = P.ranking(cfg, T, await d.listarSessoes(), await A.listar(T));
      assert(g(rk3, 'alu2') > a2 && g(rk3, 'alu2') <= 1); assert.equal(g(rk3, 'alu1'), a1);
      assert(JSON.parse((await getp({ acao: 'minhasatividades' }, 'alu2')).body).atividades.some((x) => x.opcional === true)); }
    assert.equal((await ap({ acao: 'ativ_liberar', id: 'nao-existe' })).status, 400);
  }
  r = JSON.parse((await getp({ acao: 'minhapontuacao' }, 'alu1')).body); assert(r.turmas[0].top5.length > 0 && r.turmas[0].posicao >= 1 && r.turmas[0].total > 0);
  // ---------- eventos, inscrição, check-in e certificado ----------
  const evp = (corpo, user = 'dono') => chamar(h('eventos'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: corpo });
  const evg = (query, user) => chamar(h('eventos'), { query, user });
  const FUT = '2999-01-01';
  assert.equal((await evp({ acao: 'evento', id: 'gamejam-1', titulo: 'Game Jam', tipo: 'gamejam', data: FUT, vagas: 1, visibilidade: 'interno', horas: 8 }, 'alu1')).status, 403); // aluno não cria
  assert.equal((await evp({ acao: 'evento', id: 'x', titulo: 'ruim' })).status, 400);
  assert.equal((await evp({ acao: 'evento', id: 'gamejam-1', titulo: 'Game Jam', tipo: 'gamejam', data: FUT, vagas: 1, visibilidade: 'interno', horas: 8 })).status, 200);
  assert(dadosArq['dados/eventos/GAMEJAM-1/evento.json']);
  assert.equal(JSON.parse((await evg({}, null)).body).eventos.length, 0); // interno: visitante não vê
  assert.equal((await evp({ acao: 'inscrever', id: 'GAMEJAM-1' }, 'estranho')).status, 403);
  assert.equal((await evp({ acao: 'inscrever', id: 'GAMEJAM-1', nome: '  Aluno Um  ' }, 'alu1')).status, 200);
  assert.equal((await evp({ acao: 'inscrever', id: 'GAMEJAM-1', nome: 'Aluno Dois' }, 'alu2')).status, 200);
  r = JSON.parse((await evg({}, 'alu2')).body).eventos[0]; assert.equal(r.inscritos, 2); assert.equal(r.minha.espera, true); assert.equal(r.minha.posicao, 2); // 1 vaga: o segundo espera
  r = JSON.parse((await evg({}, 'alu1')).body).eventos[0]; assert.equal(r.minha.espera, false); assert.equal(r.minha.nome, 'Aluno Um'); assert.equal(r.minha.codigo, null);
  assert.equal((await evp({ acao: 'confirmar', id: 'GAMEJAM-1' }, 'alu1')).status, 200);
  assert.equal((await evp({ acao: 'cancelar', id: 'GAMEJAM-1' }, 'alu2')).status, 200);
  assert.equal((await evg({ acao: 'inscritos', id: 'GAMEJAM-1' }, 'alu1')).status, 403);
  assert.equal(JSON.parse((await evg({ acao: 'inscritos', id: 'GAMEJAM-1' }, 'dono')).body).inscritos.length, 2);
  assert.equal((await evp({ acao: 'checkin', id: 'GAMEJAM-1', estados: { alu1: true } }, 'alu1')).status, 403);
  r = JSON.parse((await evp({ acao: 'checkin', id: 'GAMEJAM-1', estados: { alu1: true, visitante1: true } })).body); assert.equal(r.alterados, 2); // visitante sem inscrição entra como presente
  r = JSON.parse((await evg({}, 'alu1')).body).eventos[0]; assert(r.minha.codigo && r.minha.presente === true);
  const cod = r.minha.codigo; const C = require('../lib/certificado');
  assert.equal(C.validar(cod).usuario, 'alu1'); assert.equal(C.validar(cod.slice(0, -1) + (cod.endsWith('0') ? '1' : '0')), null); assert.equal(C.validar('GAMEJAM-1.alu2.0000000000'), null);
  r = await chamar(h('certificado'), { query: { c: cod } }); assert.equal(r.status, 200); assert(r.body.includes('Aluno Um') && r.body.includes('Game Jam') && r.body.includes(cod));
  assert.equal((await chamar(h('certificado'), { query: { c: 'GAMEJAM-1.alu2.' + C.codigo('GAMEJAM-1', 'alu2').split('.')[2] } })).status, 404); // cancelado e sem comparecimento: não emite
  assert.equal((await chamar(h('certificado'), { query: { c: 'lixo' } })).status, 404);
  assert.equal((await evp({ acao: 'evento', id: 'passado', titulo: 'Velho', data: '2020-01-01', visibilidade: 'publico' })).status, 200);
  assert.equal((await evp({ acao: 'inscrever', id: 'PASSADO' }, 'alu1')).status, 400); // inscrições encerradas
  assert.equal(JSON.parse((await evg({}, null)).body).eventos.length, 1); // público aparece para visitante
  assert(C.preencher('{{nome}}', { nome: '<b>x</b>' }) === '&lt;b&gt;x&lt;/b&gt;'); // sem injeção de HTML no certificado
  // vitrine: só embeds de sites permitidos
  { const V = require('../public/vitrine.js'), Si = require('../lib/site.js');
    assert(V.embedDe('https://youtu.be/dQw4w9WgXcQ').includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
    assert.equal(V.extrairEmbed('<iframe src="https://evil.com/x"></iframe>'), '');
    assert.equal(V.extrairEmbed('<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="https://www.instagram.com/reel/AbC_123-x/?utm_source=ig_embed&amp;utm_campaign=loading"></blockquote><script async src="//www.instagram.com/embed.js"></script>'), 'https://www.instagram.com/reel/AbC_123-x/embed/captioned/');
    assert.equal(V.extrairEmbed('<blockquote data-instgrm-permalink="https://evil.com/p/x/"></blockquote>'), '');
    assert(V.extrairEmbed('<iframe src="https://itch.io/embed/123"></iframe>').includes('itch.io/embed/123'));
    assert.equal(V.embedPermitido('javascript:alert(1)'), false);
    const lim = Si.sanitizar({ vitrine: [
      { titulo: 'Ruim', url: 'https://x.com/a', embed: 'https://evil.com/e', modo: 'direto', visivel: 'publico' },
      { titulo: '', url: 'https://x.com/b' },
      { titulo: 'Membros', url: 'https://x.com/c', visivel: 'membros' }] });
    assert.equal(lim.vitrine.length, 2); assert(!lim.vitrine[0].embed.includes('evil.com'));
    assert.equal(Si.paraLeitor(lim, 'visitante').vitrine.length, 1); }
  // Destaque de ranking: foto publicada, só com pontos, filtrada por visibilidade/data
  { const Si = require('../lib/site.js'); const pz = (b, user = 'dono') => chamar(h('personalizar'), { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: b });
    assert.equal((await pz({ acao: 'ranking_gerar', turma: 'nao-existe', quantos: 5 })).status, 400);
    assert.equal((await pz({ acao: 'ranking_gerar', turma: 'nao-existe', quantos: 5 }, 'alu1')).status, 403);
    const m = Si.sanitizar({ rankings: [{ titulo: 'Top 5 de outubro', turma: 'T', turmaNome: 'N0', foto: '2026-10-26', peso: 20, visivel: 'membros', itens: [{ posicao: 1, usuario: 'Ana', total: 12.55 }, { posicao: 2, usuario: 'ruim nome!', total: 3 }] }, { titulo: '' }] });
    assert.equal(m.rankings.length, 1); assert.equal(m.rankings[0].itens.length, 1); assert.equal(m.rankings[0].itens[0].usuario, 'ana'); assert.equal(m.rankings[0].itens[0].total, 12.6);
    assert.equal(Si.paraLeitor(m, 'visitante').rankings.length, 0); assert.equal(Si.paraLeitor(m, 'aluno').rankings.length, 1); }
  // ordem de exibição (peso obrigatório, sem peso = migra pela ordem atual)
  { const Si = require('../lib/site.js');
    const m = Si.sanitizar({ anuncios: [{ titulo: 'A' }, { titulo: 'B' }], vitrine: [{ titulo: 'V', url: 'https://x.com/a', peso: 5 }] });
    assert.deepEqual(m.anuncios.map((x) => x.peso), [10, 20]); assert.equal(m.vitrine[0].peso, 5); assert.equal(m.ordem.rankings, 45);
    assert(Si.faltaPeso({ ordem: m.ordem, anuncios: [{ titulo: 'A' }] }).includes('aviso'));
    assert(Si.faltaPeso({ ordem: { ...m.ordem, rankings: '' } }).includes('Destaques'));
    assert.equal(Si.faltaPeso({ ordem: m.ordem, anuncios: m.anuncios, vitrine: m.vitrine }), '');
    const l = Si.paraLeitor(Si.sanitizar({ agenda: [{ titulo: 'Z', data: '2099-01-01', peso: 1 }, { titulo: 'Y', data: '2098-01-01', peso: 2 }] }), 'aluno');
    assert.equal(l.agenda[0].titulo, 'Z'); }
  // ---------- editor de slides ----------
  { const Sl = require('../lib/slides.js'); const Mo = require('../public/editor-modelos.js');
    // limpeza do HTML: nada de script, evento, link perigoso, iframe, url() nem posição fixa
    const sujo = '<p onclick="x()" style="position:fixed;background:url(http://evil/x);color:#fff;left:10px">oi<script>alert(1)</script></p><iframe src="//evil"></iframe><img src="https://evil/x.png" onerror="x()"><img src="/api/imagem?n=a.png"><a href="javascript:x()">l</a><div data-build-in="rise 2" style="width:10px"></div><div data-build-in="evil 9"></div><svg viewBox="0 0 24 24" onload="x()"><path d="M1 1" fill="none"/></svg>';
    const lp = Sl.limpar(sujo);
    for (const ruim of ['<script', 'onclick', 'onerror', 'onload', 'iframe', 'evil', 'javascript', 'url(', 'fixed', '<a ']) assert(!lp.includes(ruim), 'não limpou: ' + ruim);
    assert(lp.includes('color:#fff') && lp.includes('/api/imagem?n=a.png') && lp.includes('data-build-in="rise 2"') && lp.includes('viewBox="0 0 24 24"'));
    // todos os modelos de slide sobrevivem à limpeza e o roteiro nunca vai no arquivo dos slides
    for (const m of Mo.SLIDES) assert.equal(Sl.limpar(m.html).replace(/><\/(path|circle)>/g, '/>'), m.html, 'modelo ' + m.id);
    const mod = Sl.normalizar({ titulo: 'Aula <x>', slides: [{ html: Mo.SLIDES[0].html, fundo: '#12141c', cor: '#f3efe6', notas: 'Fale devagar\nPergunte', tempo: '0:00' }, { html: Mo.SLIDES[2].html, fundo: 'red; x:y', cor: 'x', notas: '', tempo: '' }] });
    assert.equal(mod.slides[1].fundo, '#12141c'); // fundo inválido volta ao padrão
    const pagina = Sl.renderAula(mod); assert(pagina.includes('01 / 02') && pagina.includes('02 / 02') && !pagina.includes('01 / 01')); // numeração automática
    assert(!pagina.includes('Fale devagar')); assert(Sl.renderRoteiro(mod, 'aula-01').includes('Fale devagar'));
    // importar o que o editor gerou devolve o mesmo modelo
    const volta = Sl.importarHtml(pagina, Sl.renderRoteiro(mod, 'aula-01')); assert.deepEqual(volta.slides.map((x) => x.notas), mod.slides.map((x) => x.notas)); const sempag = (t) => t.replace(/\d\d \/ \d\d/g, 'NN'); assert.deepEqual(volta.slides.map((x) => sempag(x.html)), mod.slides.map((x) => sempag(x.html))); assert.deepEqual(volta.slides.map((x) => x.fundo), mod.slides.map((x) => x.fundo));
    assert.throws(() => Sl.importarHtml('<html>nada</html>'));
  }
  { const api = h('slides'), N1 = 'nivel-01-design', N2 = 'nivel-02-outro';
    const get = (q, user) => chamar(api, { query: q, user }); const post = (b, user = 'dono') => chamar(api, { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: b });
    const modelo = (t) => ({ titulo: t, slides: [{ html: '<h2 style="position:absolute;left:1px;top:2px">Oi</h2><p data-pag="1">01 / 01</p>', fundo: '#12141c', cor: '#f3efe6', notas: 'ideia 1', tempo: '0:05' }] });
    cfg.equipe = { ...(cfg.equipe || {}), edi1: { titulo: '', permissoes: [], cargos: ['slider'] }, edi2: { titulo: '', permissoes: ['slides'], cargos: [] } };
    cfg.cargos = { ...(cfg.cargos || {}), slider: { nome: 'Slider', descricao: '', permissoes: ['slides'] } };
    cfg.monitores = { ...cfg.monitores, mon3: { aulas: [], roteiros: [], turmas: [] } };
    cfg.turmas = { ...(cfg.turmas || {}), 'T-N1': { nome: 'N1', status: 'andamento', inicio: '', fim: '', nivel: N1, acessoApos: true, acessoAte: '', alunos: [] } };
    cfg.editores = { escopo1: [N1], escopo2: [N1 + '/aula-02'] };
    cfg.alunos = [...cfg.alunos, 'edi1', 'edi2']; cfg.turmas['T-N0'] = { nome: 'N0', status: 'andamento', inicio: '', fim: '', nivel: 'nivel-00-tutorial', acessoApos: true, acessoAte: '', alunos: ['edi2'] }; cfg.turmas['T-N1'].alunos = ['edi1']; // edi1 está vinculado ao nível 1; edi2 não
    u.limparCache();
    assert.equal((await get({ acao: 'lista' }, null)).status, 401);
    assert.equal((await get({ acao: 'lista' }, 'alu1')).status, 403); // sem nenhuma permissão de slides
    assert.equal((await post({ acao: 'salvar', dir: N1, id: 'aula-01', modelo: modelo('X') }, 'alu1')).status, 403);
    // owner cria nível (e só owner)
    assert.equal((await post({ acao: 'novo_nivel', numero: 1, nome: 'Design' }, 'edi1')).status, 403);
    r = await post({ acao: 'novo_nivel', numero: 1, nome: 'Pensar como Designer' }); assert.equal(r.status, 200); const nivel1 = JSON.parse(r.body).dir; assert.equal(nivel1, 'nivel-01-pensar-como-designer');
    assert.equal((await post({ acao: 'novo_nivel', numero: 1, nome: 'Outro' })).status, 400); assert.equal((await post({ acao: 'novo_nivel', numero: 500, nome: 'x' })).status, 400);
    // owner salva aula nova: gera slides, roteiro, json do editor e título no índice
    r = await post({ acao: 'salvar', dir: nivel1, id: 'aula-01', modelo: modelo('Aula <b>nova</b>'), base: null }); assert.equal(r.status, 200); let base1 = JSON.parse(r.body).base; assert(base1);
    const K = (n) => `niveis/${nivel1}/${n}`;
    assert(arquivos[K('slides/aula-01.html')].includes('01 / 01') && !arquivos[K('slides/aula-01.html')].includes('ideia 1'));
    assert(arquivos[K('slides/aula-01-roteiro.html')].includes('ideia 1') && arquivos[K('slides/aula-01-roteiro.html')].includes('Aula &lt;b&gt;nova&lt;/b&gt;'));
    assert.equal(JSON.parse(arquivos[K('editor/aula-01.json')]).slides[0].notas, 'ideia 1'); assert.equal(JSON.parse(arquivos[K('slides/indice.json')])['aula-01'], 'Aula <b>nova</b>');
    // a aula aparece na lista do portal (só owners no começo) e abre para o owner
    r = await chamar(h('ver'), { query: { dir: nivel1, id: 'aula-01' }, user: 'dono' }); assert.equal(r.status, 200); assert(r.body.includes('<div id="stage">'));
    assert.equal((await chamar(h('ver'), { query: { dir: nivel1, id: 'aula-01' }, user: 'alu1' })).status, 403);
    // conflito: salvar com base velha, ou criar de novo sem base
    assert.equal((await post({ acao: 'salvar', dir: nivel1, id: 'aula-01', modelo: modelo('Y'), base: 'velha' })).status, 409);
    assert.equal((await post({ acao: 'salvar', dir: nivel1, id: 'aula-01', modelo: modelo('Y'), base: null })).status, 409);
    r = await post({ acao: 'salvar', dir: nivel1, id: 'aula-01', modelo: modelo('Versão 2'), base: base1 }); assert.equal(r.status, 200); base1 = JSON.parse(r.body).base;
    r = JSON.parse((await get({ acao: 'aula', dir: nivel1, id: 'aula-01' }, 'dono')).body); assert.equal(r.origem, 'editor'); assert.equal(r.modelo.titulo, 'Versão 2'); assert.equal(r.base, base1);
    assert.equal(JSON.parse((await get({ acao: 'aula', dir: nivel1, id: 'aula-09' }, 'dono')).body).origem, 'nova');
    // entradas inválidas
    assert.equal((await post({ acao: 'salvar', dir: '../x', id: 'aula-01', modelo: modelo('X') })).status, 400); assert.equal((await post({ acao: 'salvar', dir: nivel1, id: 'aula-1', modelo: modelo('X') })).status, 400);
    assert.equal((await post({ acao: 'salvar', dir: nivel1, id: 'aula-03', modelo: { titulo: 'v', slides: [] } })).status, 400);
    // aula que já existia sem editor (Nível 0): precisa importar e só owner substitui
    assert.equal((await get({ acao: 'aula', dir: 'nivel-00-tutorial', id: 'aula-01' }, 'dono')).status, 200);
    assert.equal(JSON.parse((await get({ acao: 'aula', dir: 'nivel-00-tutorial', id: 'aula-01' }, 'dono')).body).origem, 'html');
    assert.equal((await post({ acao: 'salvar', dir: 'nivel-00-tutorial', id: 'aula-01', modelo: modelo('Sobrescreve'), base: null })).status, 400);
    assert.equal(arquivos['niveis/nivel-00-tutorial/slides/aula-01.html'], '<html>SLIDES1</html>'); // Nível 0 intacto
    // permissões por escopo (nível inteiro, uma aula, cargo + vínculo)
    cfg.editores = { escopo1: [nivel1], escopo2: [nivel1 + '/aula-02'] }; cfg.turmas['T-N1'].nivel = nivel1; u.limparCache();
    const pode = async (user, id, dir = nivel1) => (await post({ acao: 'salvar', dir, id, modelo: modelo('T ' + user + id), base: null }, user)).status;
    assert.equal(await pode('escopo1', 'aula-05'), 200); // nível inteiro
    assert.equal(await pode('escopo2', 'aula-02'), 200); assert.equal(await pode('escopo2', 'aula-04'), 403); // só a aula combinada
    assert.equal(await pode('edi1', 'aula-06'), 200); // cargo com "slides" + turma do nível
    assert.equal(await pode('edi2', 'aula-07'), 403); // permissão "slides", mas sem vínculo com o nível
    assert.equal(await pode('mon1', 'aula-08'), 403);
    assert.equal(await pode('escopo1', 'aula-09', 'nivel-00-tutorial'), 403); // não vale em outro nível
    cfg.monitores.mon3 = { aulas: [], roteiros: [], turmas: [] }; cfg.equipe.mon3 = { titulo: '', permissoes: ['slides'], cargos: [] }; u.limparCache();
    assert.equal(await pode('mon3', 'aula-10'), 200); // monitor de todas as turmas, com permissão: vínculo com todos os níveis
    r = JSON.parse((await get({ acao: 'lista' }, 'escopo2')).body); assert.deepEqual(r.niveis.map((n) => n.dir), [nivel1]); assert(r.niveis[0].aulas.some((a) => a.id === 'aula-02' && a.editavel) && !r.niveis[0].aulas.find((a) => a.id === 'aula-01').editavel);
    assert.equal((await get({ acao: 'importar', dir: nivel1, id: 'aula-01' }, 'escopo2')).status, 403); assert.equal((await get({ acao: 'importar', dir: nivel1, id: 'aula-01' }, 'dono')).status, 200);
    assert.equal((await post({ acao: 'salvar', dir: nivel1, id: 'aula-01', modelo: modelo('Z'), base: base1 }, 'escopo1')).status, 200); // editor da aula com base certa
    delete cfg.equipe.mon3; delete cfg.monitores.mon3; delete cfg.editores; delete cfg.turmas['T-N1']; delete cfg.turmas['T-N0']; cfg.alunos = cfg.alunos.filter((x) => !['edi1', 'edi2'].includes(x)); delete cfg.equipe.edi1; delete cfg.equipe.edi2; delete cfg.cargos.slider; u.limparCache();
  }
  // imagens e histórico do editor
  { const api = h('slides'); const post = (b, user = 'dono') => chamar(api, { method: 'POST', user, headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: b });
    const get = (q, user = 'dono') => chamar(api, { query: q, user });
    const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64');
    assert.equal((await post({ acao: 'upload', nome: 'logo.png', dados: png }, 'alu1')).status, 403);
    r = await post({ acao: 'upload', nome: 'Meu Logo.png', dados: png }); assert.equal(r.status, 200); const nomeImg = JSON.parse(r.body).nome; assert(/^meu-logo-[a-z0-9]+\.png$/.test(nomeImg));
    assert.equal((await post({ acao: 'upload', nome: 'x.png', dados: 'data:image/png;base64,AAAA' })).status, 400); assert.equal((await post({ acao: 'upload', nome: 'x', dados: 'lixo' })).status, 400);
    assert(JSON.parse((await get({ acao: 'imagens' })).body).imagens.includes(nomeImg)); assert.equal((await get({ acao: 'imagens' }, 'alu1')).status, 403);
    { // módulos das imagens: do editor só no editor; do site (Personalizar) fora do editor
      const pers = (b) => chamar(h('personalizar'), { method: 'POST', user: 'dono', headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: b });
      let L = JSON.parse((await get({ acao: 'imagens' })).body); assert(L.imagens.includes(nomeImg)); assert(L.todas.find((x) => x.nome === nomeImg).modulos.join() === 'slides');
      assert(!JSON.parse((await chamar(h('personalizar'), { query: {}, user: 'dono' })).body).imagens.includes(nomeImg));
      const rs = await pers({ acao: 'upload', nome: 'Banner Site.png', dados: png }); const nomeSite = JSON.parse(rs.body).nome;
      L = JSON.parse((await get({ acao: 'imagens' })).body); assert(!L.imagens.includes(nomeSite)); assert.equal(L.todas.find((x) => x.nome === nomeSite).modulos.join(), 'site');
      assert(JSON.parse((await chamar(h('personalizar'), { query: {}, user: 'dono' })).body).imagens.includes(nomeSite));
      assert.equal((await post({ acao: 'imagem_modulos', nome: nomeSite, modulos: ['site', 'slides'] }, 'alu1')).status, 403);
      assert.equal((await post({ acao: 'imagem_modulos', nome: '../x.png', modulos: ['slides'] })).status, 400);
      assert.equal((await post({ acao: 'imagem_modulos', nome: nomeSite, modulos: ['site', 'slides', 'lixo'] })).status, 200);
      L = JSON.parse((await get({ acao: 'imagens' })).body); assert(L.imagens.includes(nomeSite)); assert.equal(L.todas.find((x) => x.nome === nomeSite).modulos.join(), 'site,slides');
      assert.equal((await post({ acao: 'imagem_modulos', nome: nomeImg, modulos: [] })).status, 200); assert(!JSON.parse((await get({ acao: 'imagens' })).body).imagens.includes(nomeImg));
      const r2 = await post({ acao: 'upload', nome: 'Dois.png', dados: png, tambemSite: true }); const n2 = JSON.parse(r2.body).nome; assert.equal(JSON.parse((await get({ acao: 'imagens' })).body).todas.find((x) => x.nome === n2).modulos.join(), 'site,slides');
    }
    // a imagem enviada entra no slide e sobrevive à limpeza; imagem de fora é descartada
    const Sl = require('../lib/slides.js'); const mi = Sl.normalizar({ titulo: 'I', slides: [{ html: `<img src="/api/imagem?n=${nomeImg}" style="position:absolute;width:300px;object-fit:cover"><img src="https://x.com/a.png">` }] });
    assert(mi.slides[0].html.includes(nomeImg) && !mi.slides[0].html.includes('x.com'));
    // histórico: cada salvamento vira uma versão; restaurar lê o conteúdo daquele momento
    const N = 'nivel-01-pensar-como-designer'; const mod = (t) => ({ titulo: t, slides: [{ html: '<h2>' + t + '</h2>', fundo: '#12141c', cor: '#f3efe6', notas: '', tempo: '' }] });
    r = JSON.parse((await post({ acao: 'salvar', dir: N, id: 'aula-31', modelo: mod('V1'), base: null })).body); r = JSON.parse((await post({ acao: 'salvar', dir: N, id: 'aula-31', modelo: mod('V2'), base: r.base })).body);
    const vs = JSON.parse((await get({ acao: 'versoes', dir: N, id: 'aula-31' })).body).versoes; assert.equal(vs.length, 2); assert.equal(vs[0].autor, 'dono');
    assert.equal(JSON.parse((await get({ acao: 'versao', dir: N, id: 'aula-31', sha: vs[1].sha })).body).modelo.titulo, 'V1'); assert.equal(JSON.parse((await get({ acao: 'versao', dir: N, id: 'aula-31', sha: vs[0].sha })).body).modelo.titulo, 'V2');
    assert.equal((await get({ acao: 'versao', dir: N, id: 'aula-31', sha: '../etc' })).status, 400); assert.equal((await get({ acao: 'versoes', dir: N, id: 'aula-31' }, 'alu1')).status, 403);
  }
  // páginas reservadas: só owners criam; o link secreto abre sem login e não aparece em lista pública
  { const body0 = (x) => ({ acao: 'reservado_salvar', titulo: 'Plano X', html: x });
    assert.equal((await post(body0('<h1>oi</h1>'), {}, 'alu1')).status, 403);
    assert.equal((await post(body0(''))).status, 400);
    let rr = JSON.parse((await post(body0('<title>Plano</title><h1>SEGREDO1</h1>'))).body); assert(rr.ok && /^[a-f0-9]{24}$/.test(rr.item.token));
    const tk = rr.item.token;
    let pg = await chamar(h('reservado'), { query: { t: tk } }); assert.equal(pg.status, 200); assert(pg.body.includes('SEGREDO1') && pg.body.toLowerCase().startsWith('<!doctype'));
    assert(/noindex/.test(pg.h['X-Robots-Tag']) && /no-store/.test(pg.h['Cache-Control']) && pg.h['Content-Security-Policy']);
    assert.equal((await chamar(h('reservado'), { query: { t: '../x' } })).status, 404); assert.equal((await chamar(h('reservado'), { query: { t: 'a'.repeat(24) } })).status, 404);
    rr = JSON.parse((await post({ acao: 'reservado_salvar', token: tk, titulo: 'Plano X', html: '<h1>SEGREDO2</h1>' })).body); assert.equal(rr.item.token, tk);
    assert((await chamar(h('reservado'), { query: { t: tk } })).body.includes('SEGREDO2'));
    const lst = JSON.parse((await chamar(h('admin'), { user: 'dono' })).body).reservadas; assert.equal(lst.length, 1);
    assert(!JSON.parse((await chamar(h('site'))).body ? (await chamar(h('site'))).body : '{}') || !(await chamar(h('site'))).body.includes(tk));
    assert.equal((await post({ acao: 'reservado_remover', token: tk }, {}, 'alu1')).status, 403);
    assert.equal((await post({ acao: 'reservado_remover', token: tk })).status, 200);
    assert.equal((await chamar(h('reservado'), { query: { t: tk } })).status, 404);
    assert.equal(JSON.parse((await chamar(h('admin'), { user: 'dono' })).body).reservadas.length, 0); }
  // editor: conferência obrigatória dos tempos (máx. 1 hora)
  { const Mo = require('../public/editor-modelos.js'); const ct = (l) => Mo.checarTempos(l.map((x) => ({ tempo: x })));
    assert.equal(ct(['0:00 a 0:10', '', '0:10 a 0:20']).erros.length, 1); assert.equal(ct(['0:00 a 0:10', 'x']).erros.length, 1);
    assert.deepEqual(ct(['0:00 a 0:10', '0:00 a 0:10', '0:10 a 1:00']).avisos, []); assert(/passa de 1 hora/.test(ct(['0:00 a 0:30', '0:30 a 1:10']).avisos[0]));
    assert(ct(['0:00 a 0:10', '0:20 a 1:00']).avisos.some((x) => /buraco/.test(x))); }
  // Contatos da equipe (e-mail institucional sem GitHub)
  { const w = (b, user = 'dono') => post(b, {}, user); const base = (await require('../lib/pendentes').ler()).lista.length;
    assert.equal((await w({ acao: 'pendente_salvar', email: 'a1@ceuma.com.br', cargo: 'Secretário' }, 'alu1')).status, 403);
    assert.equal((await w({ acao: 'pendente_salvar', email: 'invalido' })).status, 400);
    assert.equal((await w({ acao: 'pendente_salvar', email: 'A101526@ceuma.com.br', cargo: 'Vice presidente' })).status, 200);
    assert.equal((await w({ acao: 'pendente_salvar', email: 'a194678@ceuma.com.br', cargo: 'Secretário' })).status, 200);
    assert.equal((await w({ acao: 'pendente_salvar', anterior: 'a101526@ceuma.com.br', email: 'a101526@ceuma.com.br', cargo: 'Vice presidente', usuario: '@Fulano' })).status, 200);
    assert.equal((await w({ acao: 'pendente_salvar', usuario: 'aluno-x', cargo: 'Aluno', nome: 'Fulano' })).status, 200); assert.equal((await w({ acao: 'pendente_salvar' })).status, 400);
    assert.equal((await w({ acao: 'pendente_remover', chave: '@aluno-x' })).status, 200);
    const L = (await require('../lib/pendentes').ler()).lista; assert.equal(L.length, base + 2); assert.equal(L.find((x) => x.email === 'a101526@ceuma.com.br').usuario, 'fulano');
    assert.equal((await w({ acao: 'pendente_remover', chave: 'a194678@ceuma.com.br' })).status, 200); assert.equal((await require('../lib/pendentes').ler()).lista.length, base + 1); }
  { const Mo = require('../public/editor-modelos.js'); const sl = [{ tempo: '0:00 a 0:05' }, { tempo: '' }, { tempo: '0:05 a 0:15' }];
    Mo.refazerTempos(sl, 1, 5); assert.equal(sl[1].tempo, '0:05 a 0:10'); assert.equal(sl[2].tempo, '0:10 a 0:20'); assert.equal(Mo.totalMin(sl), 20);
    assert.equal(Mo.lerDur('7 min'), 7); assert.equal(Mo.lerDur('x'), null); assert.equal(Mo.checarTempos(sl).erros.length, 0);
    const bl = [{ tempo: '0:00 a 0:10' }, { tempo: '0:00 a 0:10' }, { tempo: '0:00 a 0:10' }, { tempo: '0:10 a 0:15' }]; Mo.refazerTempos(bl, 1, 20); assert.deepEqual(bl.map((x) => x.tempo), ['0:00 a 0:20', '0:00 a 0:20', '0:00 a 0:20', '0:20 a 0:25']); assert.equal(Mo.totalMin(bl), 25); }
  // Guias e dúvidas (wiki): visibilidade por função
  { const W = require('../lib/wiki'); const w = (b, user = 'dono') => post(b, {}, user);
    assert.equal((await w({ acao: 'wiki_salvar', titulo: 'X', visibilidade: 'equipe', html: '<h1>a</h1>' }, 'alu1')).status, 403);
    assert.equal((await w({ acao: 'wiki_salvar', titulo: 'X', visibilidade: 'todos', html: '<h1>a</h1>' })).status, 400);
    assert.equal((await w({ acao: 'wiki_salvar', titulo: 'X', visibilidade: 'equipe' })).status, 400);
    const mk = async (titulo, visibilidade, html) => JSON.parse((await w({ acao: 'wiki_salvar', titulo, visibilidade, categoria: 'Problemas comuns', tags: 'git, erro', html })).body).item;
    const sOwner = await mk('Só dono', 'owner', '<h1>WIKI-OWNER</h1>'), sMon = await mk('Monitores aqui', 'monitor', '<h1>WIKI-MON</h1>'), sAdm = await mk('Corpo adm', 'equipe', '<title>t</title><h1>WIKI-ADM</h1>'), sAll = await mk('Para membros', 'aluno', '<h1>WIKI-ALL</h1>');
    assert.equal(sOwner.slug, 'so-dono');
    const lista = async (user) => (JSON.parse((await chamar(h('wiki'), { user, query: { rota: 'wiki' } })).body).paginas || []).map((x) => x.slug).sort();
    assert.deepEqual(await lista('dono'), ['corpo-adm', 'monitores-aqui', 'para-membros', 'so-dono']);
    { const esp = async (e) => (JSON.parse((await chamar(h('wiki'), { user: 'dono', query: { rota: 'wiki', espaco: e } })).body).paginas || []).map((x) => x.slug).sort(); assert.deepEqual(await esp('aluno'), ['para-membros']); assert.deepEqual(await esp('adm'), ['corpo-adm', 'monitores-aqui', 'so-dono']); }
    assert.deepEqual(await lista('mon1'), ['corpo-adm', 'monitores-aqui', 'para-membros']);
    assert.deepEqual(await lista('alu1'), ['para-membros']);
    assert.equal((await chamar(h('wiki'), { query: { rota: 'wiki' } })).status, 401);
    const pag = (s, user) => chamar(h('wiki'), { user, query: { rota: 'wikipagina', s } });
    let r1 = await pag('so-dono', 'dono'); assert.equal(r1.status, 200); assert(r1.body.includes('WIKI-OWNER') && r1.body.includes('Guias e dúvidas') && /noindex/.test(r1.h['X-Robots-Tag']));
    assert.equal((await pag('so-dono', 'mon1')).status, 404); assert.equal((await pag('monitores-aqui', 'alu1')).status, 404); assert.equal((await pag('para-membros')).status, 404);
    assert.equal((await pag('corpo-adm', 'mon1')).status, 200); assert.equal((await pag('../x', 'dono')).status, 404);
    // busca: o índice leva o texto; metadado muda sem reenviar o HTML
    const adm = JSON.parse((await chamar(h('admin'), { user: 'dono' })).body).wiki; assert.equal(adm.paginas.length, 4); assert(adm.paginas.find((x) => x.slug === 'corpo-adm').texto.includes('WIKI-ADM'));
    const up = JSON.parse((await w({ acao: 'wiki_salvar', slug: 'corpo-adm', titulo: 'Corpo adm 2', visibilidade: 'aluno' })).body).item; assert.equal(up.visibilidade, 'aluno');
    assert.equal((await pag('corpo-adm', 'alu1')).status, 200); assert((await pag('corpo-adm', 'alu1')).body.includes('WIKI-ADM'));
    // cargos: equipe só vê se tiver o cargo
    const cf = { owners: [], monitores: {}, alunos: [], equipe: { prof: { cargos: ['professor'] }, outro: { cargos: ['midia'] } }, cargos: {} };
    const pg0 = { visibilidade: 'equipe', cargos: ['professor'] }; assert(W.pode(cf, 'prof', pg0)); assert(!W.pode(cf, 'outro', pg0)); assert(!W.pode(cf, 'visitante', pg0));
    assert.equal((await w({ acao: 'wiki_remover', slug: 'so-dono' }, 'alu1')).status, 403);
    for (const s of ['so-dono', 'monitores-aqui', 'corpo-adm', 'para-membros']) assert.equal((await w({ acao: 'wiki_remover', slug: s })).status, 200);
    assert.equal(JSON.parse((await chamar(h('admin'), { user: 'dono' })).body).wiki.paginas.length, 0); }
  // painel de aulas e semanas continuam só para quem pode
  assert.equal((await chamar(h('semanas'), { user: 'alu1' })).status, 403);
  // roteadores (limite de funções da Vercel gratuita)
  assert.equal((await chamar(require('../api/auth'), { query: { rota: 'logout' } })).status, 302);
  assert.equal((await chamar(require('../api/auth'), { query: { rota: 'x' } })).status, 404);
  assert.equal((await chamar(require('../api/publico'), { query: { rota: 'site' } })).status, 200);
  assert.equal((await chamar(require('../api/publico'), { query: { rota: 'imagem', n: 'x.png' } })).status, 404);
  console.log('Todos os testes passaram.');
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
