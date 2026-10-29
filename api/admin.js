'use strict';
// Painel: nível de cada aula, listas, monitores e equipe. Cada ação exige a permissão certa; só owners mexem na lista de owners e na equipe.
const u = require('../lib/util'); const d = require('../lib/dados'); const P = require('../lib/pontos');
const nomeGh = (x) => String(x).replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '').replace(/^https?:\/\/github\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();
const ler = (l) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const perm = u.permissoes(cfg, usuario);
    const dono = u.papel(cfg, usuario) === 'owner';
    const papelU = u.papel(cfg, usuario);
    const editor = !!usuario && (dono || perm.includes('slides') || ((cfg.editores || {})[usuario] || []).length > 0);
    const temFerramenta = perm.length > 0 || papelU === 'monitor' || editor;
    if (!dono && !temFerramenta) return u.json(res, 403, { erro: 'Sem permissão.' });
    const aulas = await u.listarAulas();
    if (req.method === 'GET') {
      const v = { usuario, dono, papel: papelU, editor, titulo: u.tituloDe(cfg, usuario), permissoes: perm, fixos: dono ? u.admins() : [] };
      if (perm.includes('aulas') || perm.includes('pessoas')) v.aulas = aulas.map((a) => ({ dir: a.dir, chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id, tem_roteiro: !!a.roteiro,
        acesso: u.nivelDe(cfg, a.chave), url: `/aula/${a.chave}`, roteiro: a.roteiro ? `/aula/${a.chave}/roteiro` : null }));
      if (!perm.includes('pessoas') && papelU === 'monitor') { // monitor: só as turmas que ele ministra (para os atalhos de chamada, atividades e ranking)
        const m = cfg.monitores[usuario]; const ids = (m && m.turmas && m.turmas.length) ? m.turmas : Object.keys(cfg.turmas);
        v.turmas = Object.fromEntries(ids.filter((id) => cfg.turmas[id] && cfg.turmas[id].status !== 'arquivada').map((id) => [id, { nome: cfg.turmas[id].nome, status: cfg.turmas[id].status, nivel: cfg.turmas[id].nivel, inicio: cfg.turmas[id].inicio || '', fim: cfg.turmas[id].fim || '', alunos: cfg.turmas[id].alunos }]));
      }
      if (perm.includes('pessoas')) { v.owners = cfg.owners; v.alunos = cfg.alunos; v.monitores = cfg.monitores; v.turmas = cfg.turmas; v.planos = cfg.planos || {}; v.assuntos = cfg.assuntos || {}; v.arenaAtiva = cfg.arenaAtiva === true; v.cargos = cfg.cargos; v.acessos = cfg.acessos; v.hoje = u.hojeBR(); }
      if (perm.includes('pessoas')) { v.contatos = (await require('../lib/pendentes').ler()).lista.map((x) => (dono ? { ...x, cpf: undefined, cpfOk: !!x.cpf } : { ...x, email: '', emailPessoal: '', cpf: undefined, cpfOk: !!x.cpf })); }
      if (dono) { v.pontuacao = cfg.pontuacao; v.tiposParticipacao = d.TIPOS; }
      if (dono) { v.equipe = cfg.equipe; v.editores = cfg.editores; v.reservadas = await require('../lib/reservado').listar(); const W = require('../lib/wiki'); v.wiki = { paginas: await W.listar(), vis: W.VIS, categorias: W.CATEGORIAS }; }
      v.listaPermissoes = u.PERMISSOES;
      return u.json(res, 200, v);
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const nao = () => u.json(res, 403, { erro: 'Você não tem permissão para esta ação.' });
    if (b.acao === 'reservado_salvar' || b.acao === 'reservado_remover') {
      if (!dono) return nao();
      const RS = require('../lib/reservado');
      try {
        if (b.acao === 'reservado_remover') { await RS.remover(String(b.token || ''), usuario); return u.json(res, 200, { ok: true }); }
        const item = await RS.salvar({ token: b.token ? String(b.token) : '', titulo: b.titulo, html: b.html }, usuario);
        return u.json(res, 200, { ok: true, item });
      } catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; }
    }
    if (b.acao === 'imagens_listar' || b.acao === 'imagem_excluir') {
      if (!dono) return nao();
      const Site = require('../lib/site');
      try {
        if (b.acao === 'imagens_listar') {
          const lista = await Site.imagensComModulos(); const { site } = await Site.lerSite(); const js = JSON.stringify(site);
          return u.json(res, 200, { ok: true, imagens: lista.map((x) => ({ ...x, noSite: js.includes(x.nome) })) });
        }
        await Site.excluirImagem(String(b.nome || ''), usuario, b.forcar === true);
        return u.json(res, 200, { ok: true });
      } catch (e) { if (e && e.status) return u.json(res, e.status, { erro: e.message, usos: e.usos }); throw e; }
    }
    if (b.acao === 'repos_auditoria') {
      if (!dono) return nao();
      const ORG = process.env.GH_ORG || 'LAG-CEUMA'; const alertas = { orfaos: [], semTurma: [], contasInexistentes: [], acessosEstranhos: [], convitesPendentes: [] };
      const conhecidos = new Set([...cfg.owners, ...u.admins(), ...cfg.alunos, ...Object.keys(cfg.monitores || {}), ...Object.keys(cfg.equipe || {}), ...Object.values(cfg.turmas || {}).flatMap((x) => x.alunos || [])].map((x) => String(x).toLowerCase()));
      const donos = new Set([...cfg.owners, ...u.admins()].map((x) => String(x).toLowerCase()));
      const emTurma = new Map(); for (const [id, tt] of Object.entries(cfg.turmas || {})) for (const a of tt.alunos || []) (emTurma.get(String(a).toLowerCase()) || emTurma.set(String(a).toLowerCase(), []).get(String(a).toLowerCase())).push(id);
      let repos = []; for (let pg = 1; pg <= 5; pg++) { const r = await u.gh(`/orgs/${ORG}/repos?per_page=100&type=all&page=${pg}`); if (!r.ok) return u.json(res, 502, { erro: `GitHub ${r.status} ao listar os repositórios da organização (o token precisa enxergar todos os repositórios).` }); const l = await r.json(); repos.push(...l); if (l.length < 100) break; }
      repos = repos.filter((r) => /^aluno-/.test(r.name) && r.name !== 'aluno-modelo').slice(0, 120);
      const url = (n) => `https://github.com/${ORG}/${n}/settings/access`;
      const unico = async (r) => {
        const k = r.name.slice(6).toLowerCase(); const lista = [];
        if (!conhecidos.has(k)) alertas.orfaos.push({ repo: r.name, usuario: k, url: url(r.name), motivo: 'O usuário deste repositório não está cadastrado na plataforma.' });
        else if (!donos.has(k) && !emTurma.has(k)) alertas.semTurma.push({ repo: r.name, usuario: k, url: url(r.name), motivo: 'A pessoa está cadastrada, mas não está em nenhuma turma (ex-aluno ou acesso removido).' });
        try { const co = await u.gh(`/repos/${ORG}/${r.name}/collaborators?affiliation=direct&per_page=100`); if (co.ok) for (const x of await co.json()) { const lg = String(x.login).toLowerCase(); if (lg !== k && !donos.has(lg)) alertas.acessosEstranhos.push({ repo: r.name, usuario: lg, url: url(r.name), motivo: conhecidos.has(lg) ? `@${lg} tem acesso a um repositório que não é dele(a).` : `@${lg} tem acesso e não está cadastrado na plataforma.` }); } } catch { /* segue */ }
        try { const iv = await u.gh(`/repos/${ORG}/${r.name}/invitations?per_page=100`); if (iv.ok) for (const x of await iv.json()) { const lg = String((x.invitee || {}).login || '').toLowerCase(); alertas.convitesPendentes.push({ repo: r.name, usuario: lg, url: url(r.name), desde: x.created_at || '', motivo: lg === k ? 'Convite enviado e ainda não aceito.' : `Convite pendente para @${lg}, que não é o dono do repositório.` }); } } catch { /* segue */ }
        return lista;
      };
      for (let i = 0; i < repos.length; i += 5) await Promise.all(repos.slice(i, i + 5).map(unico));
      const contas = [...new Set([...cfg.alunos, ...Object.keys(cfg.monitores || {}), ...Object.keys(cfg.equipe || {}), ...cfg.owners].map((x) => String(x).toLowerCase()))].filter((x) => !/^ficticio-/.test(x)).slice(0, 150);
      for (let i = 0; i < contas.length; i += 8) await Promise.all(contas.slice(i, i + 8).map(async (k) => { try { const r = await u.gh(`/users/${k}`); if (r.ok) { let j = null; try { j = await r.json(); } catch { j = null; } if (j && j.login && String(j.login).toLowerCase() !== k) alertas.contasInexistentes.push({ usuario: k, url: `https://github.com/${j.login}`, motivo: `A conta @${k} trocou de nome no GitHub e agora é @${j.login}. Atualize o usuário na ficha da pessoa (Corrigir usuário do GitHub); o nome antigo pode ser registrado por outra pessoa.` }); }
          if (r.status === 404) alertas.contasInexistentes.push({ usuario: k, url: `https://github.com/${k}`, motivo: `A conta @${k} não existe mais no GitHub (trocou de nome ou foi apagada). Se alguém criar uma conta com esse nome, poderia entrar como esta pessoa na plataforma.` }); } catch { /* segue */ } }));
      return u.json(res, 200, { ok: true, total: repos.length, alertas });
    }
    if (b.acao === 'repos_alunos') {
      if (!dono) return nao();
      const t = (cfg.turmas || {})[String(b.turma || '')]; if (!t) return u.json(res, 400, { erro: 'Turma inválida.' });
      const ORG = process.env.GH_ORG || 'LAG-CEUMA'; const criar = b.criar === true;
      const um = async (k) => {
        if (/^ficticio-/.test(k)) return { usuario: k, estado: 'ficticio' }; // aluno de teste: nunca cria repositório nem convida ninguém no GitHub
        try {
          let r = await u.gh(`/repos/${ORG}/aluno-${k}`); let existe = r.ok, criado = false;
          if (!existe && r.status !== 404) return { usuario: k, estado: 'erro', msg: `GitHub ${r.status} ao consultar o repositório` };
          if (!existe && criar) {
            const g = await u.gh(`/repos/${ORG}/aluno-modelo/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: ORG, name: `aluno-${k}`, private: true, description: `Repositório do aluno @${k} na Liga de Games Ceuma` }) });
            if (!g.ok) return { usuario: k, estado: 'erro', msg: g.status === 404 ? 'o repositório-modelo "aluno-modelo" não existe ou não está marcado como modelo (Template repository)' : `GitHub ${g.status} ao criar o repositório` };
            existe = true; criado = true;
          }
          if (!existe) return { usuario: k, estado: 'sem-repo' };
          if (criar) { try { await u.gh(`/repos/${ORG}/aluno-${k}/topics`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: ['liga-aluno', 'turma-' + String(b.turma).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)] }) }); } catch { /* etiqueta é só organização */ } }
          const c = await u.gh(`/repos/${ORG}/aluno-${k}/collaborators/${k}`);
          if (c.status === 204) return { usuario: k, estado: criado ? 'criado-com-acesso' : 'ok' };
          if (!criar) {
            const inv = await u.gh(`/repos/${ORG}/aluno-${k}/invitations`); let pend = false;
            if (inv.ok) pend = (await inv.json()).some((x) => x.invitee && String(x.invitee.login).toLowerCase() === k);
            return { usuario: k, estado: pend ? 'convite-pendente' : 'sem-convite' };
          }
          const pu = await u.gh(`/repos/${ORG}/aluno-${k}/collaborators/${k}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission: 'push' }) });
          if (!pu.ok) return { usuario: k, estado: 'erro', msg: pu.status === 404 ? 'usuário do GitHub não encontrado (confira a grafia)' : `GitHub ${pu.status} ao convidar` };
          return { usuario: k, estado: pu.status === 204 ? 'ok' : (criado ? 'criado-e-convidado' : 'convidado') };
        } catch (e) { return { usuario: k, estado: 'erro', msg: 'falha de rede' }; }
      };
      const alunos = (t.alunos || []).slice(0, 60); const out = [];
      for (let i = 0; i < alunos.length; i += 5) out.push(...await Promise.all(alunos.slice(i, i + 5).map(um)));
      return u.json(res, 200, { ok: true, criar, resultados: out });
    }
    if (b.acao === 'pendente_salvar' || b.acao === 'pendente_remover') {
      if (!dono) return nao();
      const PD = require('../lib/pendentes');
      try {
        if (b.acao === 'pendente_remover') { await PD.remover(b.chave || b.email, usuario, (x) => (x.usuario && u.papel(cfg, x.usuario) !== 'visitante') ? `@${x.usuario} ainda tem acesso à plataforma (${u.papel(cfg, x.usuario)}). Remova primeiro o acesso em Pessoas e depois exclua o contato.` : ''); return u.json(res, 200, { ok: true }); }
        return u.json(res, 200, { ok: true, item: await PD.salvar(b, usuario) });
      } catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; }
    }
    if (b.acao === 'wiki_salvar' || b.acao === 'wiki_remover') {
      if (!dono) return nao();
      const W = require('../lib/wiki');
      try {
        if (b.acao === 'wiki_remover') { await W.remover(String(b.slug || ''), usuario); return u.json(res, 200, { ok: true }); }
        const item = await W.salvar(b, usuario);
        return u.json(res, 200, { ok: true, item });
      } catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; }
    }
    const novo = JSON.parse(JSON.stringify(cfg));
    const existe = new Set(aulas.map((a) => a.chave));
    const dirs = new Set([...aulas.map((a) => a.dir), ...Object.values(cfg.assuntos || {}).flatMap((p) => p.niveis || [])]);
    let msg;
    if (b.acao === 'acesso') {
      if (!perm.includes('aulas')) return nao();
      const chaves = Array.isArray(b.chaves) ? b.chaves : [b.chave];
      if (!chaves.length || chaves.length > 500 || !chaves.every((c) => existe.has(c)) || !u.NIVEIS.includes(b.nivel)) return u.json(res, 400, { erro: 'Aula ou nível inválido.' });
      for (const c of chaves) { if (b.nivel === 'owners') delete novo.aulas[c]; else novo.aulas[c] = b.nivel; }
      msg = chaves.length === 1 ? `Portal: ${usuario} definiu ${chaves[0]} como ${b.nivel}` : `Portal: ${usuario} definiu ${chaves.length} aulas (${String(b.nivel_nome || 'várias').slice(0, 40)}) como ${b.nivel}`;
    } else if (b.acao === 'listas') {
      if (!perm.includes('pessoas')) return nao();
      const alu = ler(b.alunos);
      let own = cfg.owners;
      if (dono) {
        own = ler(b.owners);
        if (!own.includes(usuario) && !u.admins().includes(usuario)) return u.json(res, 400, { erro: 'Você não pode se remover da lista de owners.' });
      }
      const ruim = [...own, ...alu].filter((x) => !u.USER_RE.test(x));
      if (ruim.length) return u.json(res, 400, { erro: `Usuário(s) inválido(s): ${ruim.slice(0, 5).join(', ')}` });
      novo.owners = own; novo.alunos = alu;
      msg = `Portal: ${usuario} atualizou as listas (${own.length} owners, ${alu.length} alunos)`;
    } else if (b.acao === 'monitor') {
      if (!perm.includes('pessoas') || (!dono && papelU === 'monitor')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros), turmas: (novo.monitores[nome] || {}).turmas || [] };
      msg = `Portal: ${usuario} definiu permissões do monitor ${nome} (${novo.monitores[nome].aulas.length} aulas, ${novo.monitores[nome].roteiros.length} roteiros)`;
    } else if (b.acao === 'remover_monitor') {
      if (!perm.includes('pessoas') || (!dono && papelU === 'monitor')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.monitores[nome]) return u.json(res, 400, { erro: 'Monitor não encontrado.' });
      delete novo.monitores[nome];
      msg = `Portal: ${usuario} removeu o monitor ${nome}`;
    } else if (b.acao === 'equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const permissoes = (Array.isArray(b.permissoes) ? b.permissoes : []).filter((x) => u.PERMISSOES.includes(x));
      novo.equipe[nome] = { titulo: String(b.titulo || '').trim().slice(0, 40), permissoes, cargos: (novo.equipe[nome] || {}).cargos || [] };
      msg = `Portal: ${usuario} definiu a equipe de ${nome} (${novo.equipe[nome].titulo || 'sem título'}: ${permissoes.join(', ') || 'sem permissões'})`;
    } else if (b.acao === 'remover_equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.equipe[nome]) return u.json(res, 400, { erro: 'Pessoa não encontrada na equipe.' });
      delete novo.equipe[nome];
      msg = `Portal: ${usuario} removeu ${nome} da equipe`;
    } else if (b.acao === 'pessoa') {
      if (!perm.includes('pessoas')) return nao();
      const nome = nomeGh(b.usuario || '');
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      { const PDp = require('../lib/pendentes'); const ex = (await PDp.ler()).lista.find((x) => x.usuario === nome); const nm = String(b.nome || (ex && ex.nome) || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/[\s\u00a0]+/g, ' ').trim();
        if (!nm) return u.json(res, 400, { erro: 'Falta o nome da pessoa (campo Nome, em Dados da pessoa).' });
        const em = String(b.email || '').replace(/[\s\u200b-\u200d\u2060\ufeff\u00a0]/g, '') || (ex && ex.email) || '';
        try { await PDp.salvar({ usuario: nome, nome: nm, email: em, curso: b.curso !== undefined ? b.curso : (ex && ex.curso), cargo: b.cargo !== undefined ? b.cargo : (ex && ex.cargo), emailPessoal: b.emailPessoal, anterior: b.anterior || (ex ? (ex.email || ('@' + ex.usuario)) : '') }, usuario); } catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; } }
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      const turmasOk = (Array.isArray(b.turmas) ? b.turmas : []).map(String).filter((t) => novo.turmas[t]);
      if (b.aluno !== undefined) {
        novo.alunos = novo.alunos.filter((a) => a !== nome);
        for (const t of Object.values(novo.turmas)) t.alunos = t.alunos.filter((a) => a !== nome);
        if (b.aluno) {
          novo.alunos.push(nome);
          const destino = turmasOk.length ? turmasOk : [Object.keys(novo.turmas).find((k) => novo.turmas[k].status === 'andamento') || Object.keys(novo.turmas)[0]];
          for (const t of destino) novo.turmas[t].alunos.push(nome);
        }
      }
      if (!dono && papelU === 'monitor') { // monitor só cadastra/atribui alunos: nunca mexe em monitores, equipe ou owners
        const alvoPapel = u.papel(cfg, nome); if (!['aluno', 'visitante'].includes(alvoPapel)) return u.json(res, 403, { erro: 'Monitor só mexe em alunos. Para monitores, equipe ou owners, peça a um owner.' });
        if (b.monitor !== undefined && !!b.monitor !== !!(cfg.monitores || {})[nome]) return u.json(res, 403, { erro: 'Monitor só atribui alunos. Para criar ou remover monitores, peça a um owner.' });
      }
      if (b.monitor !== undefined) {
        if (b.monitor) novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros), turmas: (Array.isArray(b.monitor_turmas) ? b.monitor_turmas : []).map(String).filter((t) => novo.turmas[t]) };
        else delete novo.monitores[nome];
      }
      if (Array.isArray(b.acessos)) {
        const itens = b.acessos.filter((x) => x && dirs.has(x.nivel)).slice(0, 20).map((x) => ({ nivel: x.nivel, ate: /^\d{4}-\d{2}-\d{2}$/.test(String(x.ate || '')) ? x.ate : u.maisUmAno(), motivo: String(x.motivo || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) }));
        if (itens.length) novo.acessos[nome] = itens; else delete novo.acessos[nome];
      }
      if (dono && b.equipe !== undefined) {
        if (b.equipe) { const antigas = ((cfg.equipe || {})[nome] || {}).permissoes || []; const novas = (Array.isArray(b.extras) ? b.extras : []).filter((x) => !antigas.includes(x)); if (novas.length) return u.json(res, 400, { erro: 'Permissão individual não é mais usada. Crie um perfil na aba Perfis com essa permissão e atribua o perfil à pessoa.' }); }
        if (b.equipe) novo.equipe[nome] = { titulo: '', permissoes: (Array.isArray(b.extras) ? b.extras : []).filter((x) => u.PERMISSOES.includes(x)), cargos: (Array.isArray(b.cargos) ? b.cargos : []).map(String).filter((c) => novo.cargos[c]) };
        else delete novo.equipe[nome];
      }
      if (dono && Array.isArray(b.editor)) {
        const itens = [...new Set(b.editor.map(String).filter((x) => /^nivel-\d{2}-[a-z0-9-]{1,40}(\/aula-\d{2})?$/.test(x)))].slice(0, 60);
        if (itens.length) novo.editores[nome] = itens; else delete novo.editores[nome];
      }
      if (dono && b.owner !== undefined) {
        if (b.owner) { if (!novo.owners.includes(nome)) novo.owners.push(nome); }
        else {
          if (nome === usuario || u.admins().includes(nome)) return u.json(res, 400, { erro: 'Este owner não pode ser removido por aqui.' });
          novo.owners = novo.owners.filter((o) => o !== nome);
        }
      }
      msg = `Portal: ${usuario} atualizou a ficha de ${nome}`;
    } else if (b.acao === 'trocar_usuario') {
      if (!perm.includes('pessoas')) return nao();
      const velho = nomeGh(b.usuario || ''), nv = nomeGh(b.novo || '');
      if (!velho || !nv || !u.USER_RE.test(velho) || !u.USER_RE.test(nv)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      if (velho === nv) return u.json(res, 400, { erro: 'O usuário novo é igual ao atual.' });
      if (novo.owners.includes(velho) || u.admins().includes(velho) || novo.equipe[velho]) return u.json(res, 400, { erro: 'Owners e equipe não podem ter o usuário trocado por aqui.' });
      if (u.papel(cfg, nv) !== 'visitante' || novo.alunos.includes(nv) || novo.monitores[nv]) return u.json(res, 400, { erro: `@${nv} já está cadastrado na plataforma.` });
      try { await require('../lib/pendentes').trocarUsuario(velho, nv, usuario); } catch (e) { if (e && e.status === 400) return u.json(res, 400, { erro: e.message }); throw e; }
      const tr = (l) => (Array.isArray(l) ? l.map((x) => (x === velho ? nv : x)) : l);
      novo.alunos = tr(novo.alunos);
      for (const t of Object.values(novo.turmas)) t.alunos = tr(t.alunos);
      for (const k of ['monitores', 'acessos', 'editores']) if (novo[k] && novo[k][velho] !== undefined) { novo[k][nv] = novo[k][velho]; delete novo[k][velho]; }
      msg = `Portal: ${usuario} corrigiu o usuário do GitHub de ${velho} para ${nv}`;
    } else if (b.acao === 'adicionar') {
      if (!perm.includes('pessoas')) return nao();
      const papelNovo = String(b.papel || 'aluno');
      if (!['aluno', 'monitor', 'equipe'].includes(papelNovo) || (papelNovo === 'equipe' && !dono)) return nao();
      const turma = novo.turmas[b.turma] ? b.turma : (Object.keys(novo.turmas).find((k) => novo.turmas[k].status === 'andamento') || Object.keys(novo.turmas)[0]);
      const bruto = (Array.isArray(b.usuarios) ? b.usuarios : []).slice(0, 300).map(nomeGh);
      const validos = [...new Set(bruto.filter((x) => u.USER_RE.test(x)))];
      if (!validos.length) return u.json(res, 400, { erro: 'Nenhum usuário válido.' });
      const contatos = (await require('../lib/pendentes').ler()).lista;
      for (const nome of validos) { const c0 = contatos.find((x) => x.usuario === nome); if (!c0 || !c0.nome) return u.json(res, 400, { erro: `@${nome} não está nos Contatos com nome. Cadastre primeiro em Contatos (nome, e-mail e usuário do GitHub), depois atribua o papel aqui.` }); }
      for (const nome of validos) {
        if (papelNovo === 'aluno') { if (!novo.alunos.includes(nome)) novo.alunos.push(nome); if (!novo.turmas[turma].alunos.includes(nome)) novo.turmas[turma].alunos.push(nome); }
        else if (papelNovo === 'monitor') { if (!novo.monitores[nome]) novo.monitores[nome] = { aulas: [], roteiros: [], turmas: [turma] }; }
        else if (!novo.equipe[nome]) novo.equipe[nome] = { titulo: '', permissoes: [], cargos: [] };
      }
      msg = `Portal: ${usuario} adicionou ${validos.length} pessoa(s) como ${papelNovo}`;
    } else if (b.acao === 'remover_pessoa') {
      if (!perm.includes('pessoas')) return nao();
      const nome = nomeGh(b.usuario || '');
      if (!nome || novo.owners.includes(nome) || u.admins().includes(nome)) return u.json(res, 400, { erro: 'Esta pessoa não pode ser removida por aqui (owner).' });
      if (!dono && novo.equipe[nome]) return u.json(res, 400, { erro: 'Esta pessoa é da equipe; só owners podem remover o acesso dela.' });
      novo.alunos = novo.alunos.filter((a) => a !== nome);
      for (const t of Object.values(novo.turmas)) t.alunos = t.alunos.filter((a) => a !== nome);
      delete novo.monitores[nome]; delete novo.acessos[nome]; delete novo.editores[nome];
      if (dono) delete novo.equipe[nome];
      msg = `Portal: ${usuario} removeu ${nome} das listas`;
    } else if (b.acao === 'cargo') {
      if (!dono) return nao();
      const nomeC = String(b.nome || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40);
      if (!nomeC) return u.json(res, 400, { erro: 'Dê um nome ao cargo.' });
      const id = /^[a-z0-9][a-z0-9-]{0,29}$/.test(String(b.id || '')) ? b.id : nomeC.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (!id) return u.json(res, 400, { erro: 'Nome inválido.' });
      novo.cargos[id] = { nome: nomeC, descricao: String(b.descricao || '').trim().slice(0, 100), permissoes: (Array.isArray(b.permissoes) ? b.permissoes : []).filter((x) => u.PERMISSOES.includes(x)) };
      msg = `Portal: ${usuario} definiu o cargo ${nomeC} (${novo.cargos[id].permissoes.join(', ') || 'sem permissões'})`;
    } else if (b.acao === 'remover_cargo') {
      if (!dono) return nao();
      if (!novo.cargos[b.id]) return u.json(res, 400, { erro: 'Cargo não encontrado.' });
      delete novo.cargos[b.id];
      for (const e of Object.values(novo.equipe)) e.cargos = (e.cargos || []).filter((c) => c !== b.id);
      msg = `Portal: ${usuario} removeu o cargo ${b.id}`;
    } else if (b.acao === 'turma') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!/^[A-Za-z0-9._-]{1,20}$/.test(id)) return u.json(res, 400, { erro: 'Código da turma: até 20 letras, números, ponto ou traço, sem espaço (ex.: 2026.2-N0).' });
      const atual = novo.turmas[id] || { alunos: [] };
      const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
      const inicio = b.inicio === undefined ? (atual.inicio || '') : data(b.inicio), fim = b.fim === undefined ? (atual.fim || '') : data(b.fim);
      if (inicio && fim && fim < inicio) return u.json(res, 400, { erro: 'O fim previsto não pode ser antes do início.' });
      const status = ['andamento', 'planejada', 'arquivada'].includes(b.status) ? b.status : (atual.status || 'planejada');
      let acessoAte = b.acessoAte === undefined ? (atual.acessoAte || '') : data(b.acessoAte);
      if (status !== 'arquivada') acessoAte = '';
      else if (!acessoAte) acessoAte = u.maisUmAno(); // arquivou: material continua por 1 ano (editável)
      novo.turmas[id] = { nome: String(b.nome || id).trim().slice(0, 40) || id, status, inicio, fim,
        nivel: b.nivel === undefined ? (atual.nivel || '') : (dirs.has(b.nivel) ? b.nivel : ''),
        acessoApos: b.acessoApos === undefined ? atual.acessoApos !== false : b.acessoApos !== false, acessoAte, alunos: atual.alunos,
        ...(atual.pesos ? { pesos: atual.pesos } : {}), ...(atual.rankingFinal ? { rankingFinal: atual.rankingFinal } : {}) };
      if (status === 'arquivada' && atual.status !== 'arquivada') novo.turmas[id].rankingFinal = P.ranking(novo, id, await d.listarSessoes(), await require('../lib/atividades').listar(id)).slice(0, 5).map((x) => ({ usuario: x.usuario, total: x.total })); // congela o Top 5
      if (status !== 'arquivada') delete novo.turmas[id].rankingFinal;
      msg = `Portal: ${usuario} salvou a turma ${id} (${status})`;
    } else if (b.acao === 'plano') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!/^[A-Za-z0-9._-]{1,20}$/.test(id)) return u.json(res, 400, { erro: 'Código do plano: até 20 letras, números, ponto ou traço (ex.: 2026.2-2027.1).' });
      const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
      const atual = (novo.planos || {})[id] || {};
      const inicio = b.inicio === undefined ? (atual.inicio || '') : data(b.inicio), fim = b.fim === undefined ? (atual.fim || '') : data(b.fim);
      if (inicio && fim && fim < inicio) return u.json(res, 400, { erro: 'O fim do plano não pode ser antes do início.' });
      const turmas = (Array.isArray(b.turmas) ? b.turmas : (atual.turmas || [])).map(String).filter((t) => novo.turmas[t]);
      for (const [oid, op] of Object.entries(novo.planos || {})) if (oid !== id) { const dup = turmas.find((t) => (op.turmas || []).includes(t)); if (dup) return u.json(res, 400, { erro: `A turma ${dup} já está no plano ${oid}. Tire-a de lá primeiro.` }); }
      novo.planos = novo.planos || {};
      const diaSemana = b.diaSemana === undefined ? (atual.diaSemana === undefined ? '' : atual.diaSemana) : (/^[0-6]$/.test(String(b.diaSemana)) ? Number(b.diaSemana) : '');
      const horario = String(b.horario === undefined ? (atual.horario || '') : b.horario).trim().slice(0, 30);
      const semanasSemAula = (Array.isArray(b.semanasSemAula) ? b.semanasSemAula : (atual.semanasSemAula || [])).map(data).filter(Boolean).slice(0, 60).sort();
      novo.planos[id] = { nome: String(b.nome || id).trim().slice(0, 40) || id, trilha: String(b.trilha === undefined ? (atual.trilha || 'Trilha 1') : b.trilha).trim().slice(0, 30) || 'Trilha 1', inicio, fim, turmas, premiacao: b.premiacao === undefined ? (atual.premiacao || '') : data(b.premiacao), diaSemana, horario, semanasSemAula };
      msg = `Portal: ${usuario} salvou o plano ${id}`;
    } else if (b.acao === 'assunto') { // cria ou renomeia um assunto (Artes, Música…); os níveis pertencem a ele
      if (!perm.includes('pessoas')) return nao();
      const nome = String(b.nome || '').replace(/\s+/g, ' ').trim().slice(0, 30); if (!nome) return u.json(res, 400, { erro: 'Informe o nome do assunto.' });
      novo.assuntos = novo.assuntos || {};
      const id = String(b.id || '').trim() || (nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'assunto');
      if (Object.entries(novo.assuntos).some(([k, v]) => k !== id && String(v.nome).toLowerCase() === nome.toLowerCase())) return u.json(res, 400, { erro: 'Já existe um assunto com esse nome.' });
      novo.assuntos[id] = { nome, niveis: (novo.assuntos[id] || {}).niveis || [] };
      msg = `Portal: ${usuario} salvou o assunto ${id}`; b.__resp = { ok: true, id };
    } else if (b.acao === 'excluir_assunto') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || ''); const as = (novo.assuntos || {})[id]; if (!as) return u.json(res, 400, { erro: 'Assunto não encontrado.' });
      const uso = Object.values(novo.turmas).filter((t) => (as.niveis || []).includes(t.nivel)).length;
      if (uso) return u.json(res, 400, { erro: `Há ${uso} turma(s) usando níveis deste assunto. Troque o nível delas antes.` });
      delete novo.assuntos[id]; msg = `Portal: ${usuario} excluiu o assunto ${id}`;
    } else if (b.acao === 'novo_nivel') { // cria um nível (pasta de aulas) dentro de um assunto
      if (!perm.includes('pessoas')) return nao();
      const as = (novo.assuntos || {})[String(b.assunto || '')]; if (!as) return u.json(res, 400, { erro: 'Escolha o assunto.' });
      const n = Math.round(Number(b.numero));
      if ((as.niveis || []).some((x) => Number(x.slice(6, 8)) === n)) return u.json(res, 400, { erro: `O assunto ${as.nome} já tem o Nível ${n}.` });
      const S = require('../lib/slides'); let dir;
      try { dir = await S.novoNivel(b.numero, b.nome || as.nome, usuario, true); } catch (e) { return u.json(res, 400, { erro: e.message }); }
      as.niveis = [...(as.niveis || []), dir].sort();
      msg = `Portal: ${usuario} criou o nível ${dir} no assunto ${b.assunto}`;
      b.__resp = { ok: true, dir };
    } else if (b.acao === 'adotar_nivel') { // liga um nível já existente (sem dono) a um assunto
      if (!perm.includes('pessoas')) return nao();
      const as = (novo.assuntos || {})[String(b.assunto || '')]; const dir = String(b.dir || '');
      if (!as || !/^nivel-\d{2}-[a-z0-9-]{1,40}$/.test(dir)) return u.json(res, 400, { erro: 'Assunto ou nível inválido.' });
      for (const [k, v] of Object.entries(novo.assuntos)) if ((v.niveis || []).includes(dir) && k !== b.assunto) v.niveis = v.niveis.filter((x) => x !== dir);
      if ((as.niveis || []).some((x) => x.slice(6, 8) === dir.slice(6, 8) && x !== dir)) return u.json(res, 400, { erro: 'Este assunto já tem um nível com esse número.' });
      as.niveis = [...new Set([...(as.niveis || []), dir])].sort(); msg = `Portal: ${usuario} ligou ${dir} ao assunto ${b.assunto}`;
    } else if (b.acao === 'excluir_plano') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!(novo.planos || {})[id]) return u.json(res, 400, { erro: 'Plano não encontrado.' });
      delete novo.planos[id];
      msg = `Portal: ${usuario} excluiu o plano ${id}`;
    } else if (b.acao === 'renomear_turma') {
      // Trocar o código é seguro só se ainda não há presença gravada (os arquivos de presença usam o código).
      if (!perm.includes('pessoas')) return nao();
      const de = String(b.de || '').trim().toUpperCase(), para = String(b.para || '').trim().toUpperCase();
      if (!novo.turmas[de] || !/^[A-Za-z0-9._-]{1,20}$/.test(para)) return u.json(res, 400, { erro: 'Código inválido (até 20 letras, números, ponto ou traço, sem espaço).' });
      if (para === de) return u.json(res, 200, { ok: true });
      if (novo.turmas[para]) return u.json(res, 400, { erro: 'Já existe uma turma com esse código.' });
      if ((await d.listarSessoes()).some((x) => String(x.turma).toUpperCase() === de)) return u.json(res, 400, { erro: 'Esta turma já tem chamadas salvas, então o código não pode mudar (o histórico ficaria órfão). Você pode mudar o nome, o nível e as datas.' });
      const ordem = Object.entries(novo.turmas).map(([k, v]) => [k === de ? para : k, v]);
      novo.turmas = Object.fromEntries(ordem);
      for (const m of Object.values(novo.monitores)) m.turmas = m.turmas.map((x) => (x === de ? para : x));
      msg = `Portal: ${usuario} renomeou a turma ${de} para ${para}`;
    } else if (b.acao === 'excluir_turma') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!novo.turmas[id]) return u.json(res, 400, { erro: 'Turma não encontrada.' });
      if (Object.keys(novo.turmas).length <= 1) return u.json(res, 400, { erro: 'Precisa existir pelo menos uma turma.' });
      if (novo.turmas[id].alunos.length) return u.json(res, 400, { erro: 'A turma ainda tem alunos. Mova-os ou, se ela já terminou, use Arquivar.' });
      if ((await d.listarSessoes()).some((x) => String(x.turma).toUpperCase() === id)) return u.json(res, 400, { erro: 'A turma tem chamadas salvas. Use Arquivar para guardar o histórico.' });
      delete novo.turmas[id];
      for (const m of Object.values(novo.monitores)) m.turmas = m.turmas.filter((x) => x !== id);
      msg = `Portal: ${usuario} excluiu a turma ${id} (vazia)`;
    } else if (b.acao === 'excluir_turma_forcado') {
      // Exclusão forçada (só owners): apaga chamadas, atividades e Copa da turma, tira a turma e, se pedido, os repositórios dos alunos que só estavam nela.
      if (!dono) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!novo.turmas[id]) return u.json(res, 400, { erro: 'Turma não encontrada.' });
      if (Object.keys(novo.turmas).length <= 1) return u.json(res, 400, { erro: 'Precisa existir pelo menos uma turma.' });
      const ORG = process.env.GH_ORG || 'LAG-CEUMA', DR = process.env.DATA_REPO || u.REPO();
      const tr = await u.gh(`/repos/${DR}/git/trees/${u.BRANCH()}?recursive=1`);
      if (!tr.ok) return u.json(res, 502, { erro: `GitHub ${tr.status} ao listar os arquivos de dados.` });
      const arqs = ((await tr.json()).tree || []).filter((i) => (i.type === 'blob' || !i.type) && (i.path.startsWith(`dados/aulas/${id}/`) || i.path.startsWith(`dados/atividades/${id}/`) || i.path === `dados/copa/${id}.json`));
      const outros = new Set(); for (const [k, t] of Object.entries(novo.turmas)) if (k !== id) for (const a of t.alunos || []) outros.add(a);
      const protegidos = new Set([...(novo.owners || []), ...u.admins(), ...Object.keys(novo.equipe || {}), ...Object.keys(novo.monitores || {})]);
      const soDela = (novo.turmas[id].alunos || []).filter((a) => !outros.has(a));
      const repos = soDela.filter((a) => !protegidos.has(a)).map((a) => `aluno-${a}`);
      if (b.simular) return u.json(res, 200, { ok: true, simulacao: true, turma: id, nome: novo.turmas[id].nome, arquivos: arqs.length, chamadas: arqs.filter((x) => x.path.startsWith('dados/aulas/')).length, atividades: arqs.filter((x) => x.path.startsWith('dados/atividades/')).length, alunos: (novo.turmas[id].alunos || []).length, repos, aviso: soDela.some((a) => protegidos.has(a)) ? 'Há owners/equipe/monitores entre os alunos: os repositórios deles não serão apagados.' : '' });
      if (String(b.confirma || '').trim().toUpperCase() !== id) return u.json(res, 400, { erro: 'Digite o código da turma para confirmar.' });
      let apagados = 0; const falhas = [];
      for (const f of arqs) {
        const r = await u.gh(`/repos/${DR}/contents/${f.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Portal: ${usuario} excluiu a turma ${id} (exclusão forçada)`, sha: f.sha, branch: u.BRANCH() }) });
        if (r.ok) apagados++; else falhas.push(f.path);
      }
      const reposOk = [], reposManual = [];
      if (b.apagarRepos) for (const rp of repos) {
        const r = await u.gh(`/repos/${ORG}/${rp}`, { method: 'DELETE' });
        if (r.ok || r.status === 404) reposOk.push(rp); else reposManual.push({ repo: rp, url: `https://github.com/${ORG}/${rp}/settings`, status: r.status });
      }
      u.limparCache();
      delete novo.turmas[id];
      for (const m of Object.values(novo.monitores)) m.turmas = (m.turmas || []).filter((x) => x !== id);
      novo.alunos = (novo.alunos || []).filter((a) => outros.has(a) || !soDela.includes(a));
      for (const pl of Object.values(novo.planos || {})) pl.turmas = (pl.turmas || []).filter((x) => x !== id);
      msg = `Portal: ${usuario} excluiu a turma ${id} (exclusão forçada: ${apagados} arquivos de dados)`;
      b.__resp = { ok: true, forcado: true, apagados, falhas, reposOk, reposManual, reposNaoPedidos: b.apagarRepos ? [] : repos };
    } else if (b.acao === 'pontuacao') {
      if (!dono) return nao();
      const n = (v, a, z) => { const x = Number(v); return Number.isFinite(x) ? Math.min(z, Math.max(a, Math.round(x * 10) / 10)) : null; };
      const alvo = b.turma ? String(b.turma).toUpperCase() : '';
      if (alvo) {
        if (!novo.turmas[alvo]) return u.json(res, 400, { erro: 'Turma não encontrada.' });
        if (b.padrao) delete novo.turmas[alvo].pesos;
        else { const ps = {}; for (const k of ['presenca', 'participacao', 'exercicios']) { const x = n((b.pesos || {})[k], 0, 100); if (x !== null) ps[k] = x; } novo.turmas[alvo].pesos = ps; }
        msg = `Portal: ${usuario} ajustou os pesos da turma ${alvo}`;
      } else {
        for (const k of ['presenca', 'participacao', 'exercicios']) { const x = n((b.pesos || {})[k], 0, 100); if (x !== null) novo.pontuacao.pesos[k] = x; }
        for (const k of Object.keys(novo.pontuacao.tipos)) { const x = n((b.tipos || {})[k], 0, 5); if (x !== null) novo.pontuacao.tipos[k] = x; }
        const m = n(b.meta, 1, 500); if (m !== null) novo.pontuacao.meta = m;
        if (b.top5Visivel !== undefined) novo.pontuacao.top5Visivel = !!b.top5Visivel;
        msg = `Portal: ${usuario} ajustou a pontuação padrão`;
      }
    } else if (b.acao === 'promover') {
      // Promover = copiar: os escolhidos entram na turma nova e continuam na de origem (que guarda o histórico e o acesso ao material).
      if (!perm.includes('pessoas')) return nao();
      if (!novo.turmas[b.de] || !novo.turmas[b.para] || b.de === b.para) return u.json(res, 400, { erro: 'Turmas inválidas.' });
      const quem = ler(Array.isArray(b.usuarios) ? b.usuarios : []).filter((a) => novo.turmas[b.de].alunos.includes(a));
      if (!quem.length) return u.json(res, 400, { erro: 'Escolha pelo menos um aluno.' });
      for (const a of quem) if (!novo.turmas[b.para].alunos.includes(a)) novo.turmas[b.para].alunos.push(a);
      msg = `Portal: ${usuario} promoveu ${quem.length} aluno(s) da turma ${b.de} para ${b.para}`;
    } else if (b.acao === 'mover_turma') {
      if (!perm.includes('pessoas')) return nao();
      if (!novo.turmas[b.de] || !novo.turmas[b.para] || b.de === b.para) return u.json(res, 400, { erro: 'Turmas inválidas.' });
      const quem = Array.isArray(b.usuarios) && b.usuarios.length ? new Set(ler(b.usuarios)) : new Set(novo.turmas[b.de].alunos);
      const mover = novo.turmas[b.de].alunos.filter((a) => quem.has(a));
      novo.turmas[b.de].alunos = novo.turmas[b.de].alunos.filter((a) => !quem.has(a));
      for (const a of mover) if (!novo.turmas[b.para].alunos.includes(a)) novo.turmas[b.para].alunos.push(a);
      msg = `Portal: ${usuario} moveu ${mover.length} aluno(s) da turma ${b.de} para ${b.para}`;
    } else return u.json(res, 400, { erro: 'Ação inválida.' });
    await u.gravarConfig(novo, msg);
    u.json(res, 200, b.__resp || { ok: true });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo.' }); }
};
