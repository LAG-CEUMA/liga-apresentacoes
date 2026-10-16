'use strict';
// Painel dos owners: ver tudo, definir o acesso de cada aula, as listas e as permissões de cada monitor.
const u = require('../lib/util');
const ler = (l) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    if (u.papel(cfg, usuario) !== 'owner') return u.json(res, 403, { erro: 'Só owners.' });
    const aulas = await u.listarAulas();
    if (req.method === 'GET') {
      return u.json(res, 200, { usuario, fixos: u.admins(), owners: cfg.owners, alunos: cfg.alunos, monitores: cfg.monitores,
        aulas: aulas.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id, tem_roteiro: !!a.roteiro,
          acesso: u.nivelDe(cfg, a.chave), url: `/aula/${a.chave}`, roteiro: a.roteiro ? `/aula/${a.chave}/roteiro` : null })) });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const novo = JSON.parse(JSON.stringify(cfg));
    const existe = new Set(aulas.map((a) => a.chave));
    let msg;
    if (b.acao === 'acesso') {
      const chaves = Array.isArray(b.chaves) ? b.chaves : [b.chave];
      if (!chaves.length || chaves.length > 500 || !chaves.every((c) => existe.has(c)) || !u.NIVEIS.includes(b.nivel)) return u.json(res, 400, { erro: 'Aula ou nível inválido.' });
      for (const c of chaves) { if (b.nivel === 'owners') delete novo.aulas[c]; else novo.aulas[c] = b.nivel; }
      msg = chaves.length === 1 ? `Portal: ${usuario} definiu ${chaves[0]} como ${b.nivel}` : `Portal: ${usuario} definiu ${chaves.length} aulas (${b.nivel_nome || 'várias'}) como ${b.nivel}`;
    } else if (b.acao === 'listas') {
      const own = ler(b.owners), alu = ler(b.alunos);
      const ruim = [...own, ...alu].filter((x) => !u.USER_RE.test(x));
      if (ruim.length) return u.json(res, 400, { erro: `Usuário(s) inválido(s): ${ruim.slice(0, 5).join(', ')}` });
      if (!own.includes(usuario) && !u.admins().includes(usuario)) return u.json(res, 400, { erro: 'Você não pode se remover da lista de owners.' });
      novo.owners = own; novo.alunos = alu;
      msg = `Portal: ${usuario} atualizou as listas (${own.length} owners, ${alu.length} alunos)`;
    } else if (b.acao === 'monitor') {
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros) };
      msg = `Portal: ${usuario} definiu permissões do monitor ${nome} (${novo.monitores[nome].aulas.length} aulas, ${novo.monitores[nome].roteiros.length} roteiros)`;
    } else if (b.acao === 'remover_monitor') {
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.monitores[nome]) return u.json(res, 400, { erro: 'Monitor não encontrado.' });
      delete novo.monitores[nome];
      msg = `Portal: ${usuario} removeu o monitor ${nome}`;
    } else return u.json(res, 400, { erro: 'Ação inválida.' });
    await u.gravarConfig(novo, msg);
    u.json(res, 200, { ok: true });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo.' }); }
};
