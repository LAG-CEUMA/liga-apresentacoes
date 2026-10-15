'use strict';
// Lista só as aulas que quem está vendo pode abrir.
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const p = u.papel(cfg, usuario);
    const todas = await u.listarAulas();
    const visiveis = todas.filter((a) => u.pode(p, u.nivelDe(cfg, a.chave)));
    const exigeLogin = p === 'visitante' ? todas.filter((a) => u.nivelDe(cfg, a.chave) === 'membros').length : 0;
    u.json(res, 200, {
      usuario, papel: p, exigeLogin,
      aulas: visiveis.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id,
        url: `/aula/${a.chave}`, roteiro: p === 'monitor' && a.roteiro ? `/aula/${a.chave}/roteiro` : null,
        acesso: p === 'monitor' ? u.nivelDe(cfg, a.chave) : undefined })),
    });
  } catch (e) { u.json(res, 500, { erro: 'Falha ao carregar as aulas.' }); }
};
