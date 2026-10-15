'use strict';
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    u.json(res, 200, { usuario, papel: u.papel(cfg, usuario) });
  } catch (e) { u.json(res, 500, { erro: 'Falha ao carregar o acesso.' }); }
};
