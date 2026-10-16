'use strict';
// Painel: nível de cada aula, listas, monitores e equipe. Cada ação exige a permissão certa; só owners mexem na lista de owners e na equipe.
const u = require('../lib/util');
const ler = (l) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const perm = u.permissoes(cfg, usuario);
    const dono = u.papel(cfg, usuario) === 'owner';
    if (!dono && !perm.includes('aulas') && !perm.includes('pessoas')) return u.json(res, 403, { erro: 'Sem permissão.' });
    const aulas = await u.listarAulas();
    if (req.method === 'GET') {
      const v = { usuario, dono, permissoes: perm, fixos: dono ? u.admins() : [] };
      if (perm.includes('aulas') || perm.includes('pessoas')) v.aulas = aulas.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id, tem_roteiro: !!a.roteiro,
        acesso: u.nivelDe(cfg, a.chave), url: `/aula/${a.chave}`, roteiro: a.roteiro ? `/aula/${a.chave}/roteiro` : null }));
      if (perm.includes('pessoas')) { v.owners = cfg.owners; v.alunos = cfg.alunos; v.monitores = cfg.monitores; }
      if (dono) { v.equipe = cfg.equipe; v.listaPermissoes = u.PERMISSOES; }
      return u.json(res, 200, v);
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const nao = () => u.json(res, 403, { erro: 'Você não tem permissão para esta ação.' });
    const novo = JSON.parse(JSON.stringify(cfg));
    const existe = new Set(aulas.map((a) => a.chave));
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
      if (!perm.includes('pessoas')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros) };
      msg = `Portal: ${usuario} definiu permissões do monitor ${nome} (${novo.monitores[nome].aulas.length} aulas, ${novo.monitores[nome].roteiros.length} roteiros)`;
    } else if (b.acao === 'remover_monitor') {
      if (!perm.includes('pessoas')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.monitores[nome]) return u.json(res, 400, { erro: 'Monitor não encontrado.' });
      delete novo.monitores[nome];
      msg = `Portal: ${usuario} removeu o monitor ${nome}`;
    } else if (b.acao === 'equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const permissoes = (Array.isArray(b.permissoes) ? b.permissoes : []).filter((x) => u.PERMISSOES.includes(x));
      novo.equipe[nome] = { titulo: String(b.titulo || '').trim().slice(0, 40), permissoes };
      msg = `Portal: ${usuario} definiu a equipe de ${nome} (${novo.equipe[nome].titulo || 'sem título'}: ${permissoes.join(', ') || 'sem permissões'})`;
    } else if (b.acao === 'remover_equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.equipe[nome]) return u.json(res, 400, { erro: 'Pessoa não encontrada na equipe.' });
      delete novo.equipe[nome];
      msg = `Portal: ${usuario} removeu ${nome} da equipe`;
    } else return u.json(res, 400, { erro: 'Ação inválida.' });
    await u.gravarConfig(novo, msg);
    u.json(res, 200, { ok: true });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo.' }); }
};
