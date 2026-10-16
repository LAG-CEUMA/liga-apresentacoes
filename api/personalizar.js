'use strict';
// Painel de personalização (só owners): ler e salvar o site, enviar imagens.
const u = require('../lib/util'); const s = require('../lib/site');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    if (!u.temPerm(cfg, usuario, 'site')) return u.json(res, 403, { erro: 'Só owners.' });
    if (req.method === 'GET') {
      const [{ site }, imagens] = await Promise.all([s.lerSite(), s.listarImagensDo('site')]);
      return u.json(res, 200, { usuario, site, imagens, redes: s.REDES, padrao: s.padrao() });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    if (b.acao === 'salvar') {
      const falta = s.faltaPeso(b.site); if (falta) return u.json(res, 400, { erro: falta });
      const resumo = String(b.resumo || 'ajustes').replace(/[^\p{L}\p{N} ,.()\-]/gu, '').slice(0, 80) || 'ajustes';
      await s.gravarSite(b.site, `Portal: ${usuario} atualizou o site (${resumo})`);
      return u.json(res, 200, { ok: true });
    }
    if (b.acao === 'upload') {
      const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dados || ''));
      if (!m) return u.json(res, 400, { erro: 'Imagem inválida.' });
      const nome = await s.enviarImagem(b.nome, Buffer.from(m[1], 'base64'), usuario, ['site']);
      return u.json(res, 200, { ok: true, nome });
    }
    u.json(res, 400, { erro: 'Ação inválida.' });
  } catch (e) {
    console.error('[portal]', e && e.message);
    u.json(res, e && e.status ? e.status : 500, { erro: e && e.status ? e.message : 'Não consegui salvar agora. Tente de novo.' });
  }
};
