'use strict';
// Material de cada semana (o que o aluno recebe e a tarefa de casa), só para owners.
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    if (!u.temPerm(cfg, usuario, 'tarefas')) return u.json(res, 403, { erro: 'Só owners.' });
    u.json(res, 200, { usuario, semanas: await u.listarSemanas() });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Falha ao carregar as semanas.' }); }
};
