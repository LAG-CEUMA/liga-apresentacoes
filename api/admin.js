'use strict';
// Painel dos monitores: ver tudo, definir o acesso de cada aula e as listas de pessoas.
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    if (u.papel(cfg, usuario) !== 'monitor') return u.json(res, 403, { erro: 'Só monitores.' });
    if (req.method === 'GET') {
      const aulas = (await u.listarAulas()).map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id,
        tem_roteiro: !!a.roteiro, acesso: u.nivelDe(cfg, a.chave), url: `/aula/${a.chave}`, roteiro: a.roteiro ? `/aula/${a.chave}/roteiro` : null }));
      return u.json(res, 200, { usuario, aulas, monitores: cfg.monitores, alunos: cfg.alunos, fixos: u.admins() });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const novo = JSON.parse(JSON.stringify(cfg));
    let msg;
    if (b.acao === 'acesso') {
      const aula = (await u.listarAulas()).find((a) => a.chave === b.chave);
      if (!aula || !u.NIVEIS.includes(b.nivel)) return u.json(res, 400, { erro: 'Aula ou nível inválido.' });
      if (b.nivel === 'monitores') delete novo.aulas[b.chave]; else novo.aulas[b.chave] = b.nivel;
      msg = `Portal: ${usuario} definiu ${b.chave} como ${b.nivel}`;
    } else if (b.acao === 'listas') {
      const ler = (l) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
      const mon = ler(b.monitores), alu = ler(b.alunos);
      const ruim = [...mon, ...alu].filter((x) => !u.USER_RE.test(x));
      if (ruim.length) return u.json(res, 400, { erro: `Usuário(s) inválido(s): ${ruim.slice(0, 5).join(', ')}` });
      if (!mon.includes(usuario) && !u.admins().includes(usuario)) return u.json(res, 400, { erro: 'Você não pode se remover da lista de monitores.' });
      novo.monitores = mon; novo.alunos = alu;
      msg = `Portal: ${usuario} atualizou as listas (${mon.length} monitores, ${alu.length} alunos)`;
    } else return u.json(res, 400, { erro: 'Ação inválida.' });
    await u.gravarConfig(novo, msg);
    u.json(res, 200, { ok: true });
  } catch (e) { u.json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo.' }); }
};
