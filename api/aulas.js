'use strict';
// Lista só as aulas que quem está vendo pode abrir.
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const p = u.papel(cfg, usuario);
    const todas = await u.listarAulas();
    const visiveis = todas.filter((a) => u.pode(cfg, usuario, a.chave, false));
    const exigeLogin = p === 'visitante' ? todas.filter((a) => u.nivelDe(cfg, a.chave) === 'membros').length : 0;
    u.json(res, 200, {
      usuario, papel: p, titulo: u.tituloDe(cfg, usuario), permissoes: u.permissoes(cfg, usuario), exigeLogin,
      editor: !!usuario && (p === 'owner' || u.permissoes(cfg, usuario).includes('slides') || ((cfg.editores || {})[usuario] || []).length > 0),
      aulas: visiveis.map((a) => ({ chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id,
        url: `/aula/${a.chave}`, roteiro: a.roteiro && u.pode(cfg, usuario, a.chave, true) ? `/aula/${a.chave}/roteiro` : null,
        acesso: p === 'owner' ? u.nivelDe(cfg, a.chave) : undefined })),
    });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Falha ao carregar as aulas.' }); }
};
