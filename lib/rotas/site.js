'use strict';
// Dados públicos do site (nome, logo, boas-vindas, anúncios, agenda, redes) filtrados para quem está vendo.
const u = require('../util'); const s = require('../site');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const p = u.papel(cfg, usuario);
    const { site } = await s.lerSite();
    u.json(res, 200, { usuario, papel: p, personificando: u.personificado(req) || undefined, ...s.paraLeitor(site, p) });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 200, { usuario: null, papel: 'visitante', ...s.paraLeitor(s.padrao(), 'visitante') }); }
};
