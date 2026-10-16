'use strict';
// Entrega as imagens do site (logo, fundos). Públicas, só as que estão em site/imagens.
const u = require('../lib/util'); const s = require('../lib/site');
module.exports = async (req, res) => {
  try {
    const nome = String((req.query || {}).n || '');
    const buf = await s.lerImagem(nome);
    if (!buf) return u.enviar(res, 404, 'Imagem não encontrada', { 'Content-Type': 'text/plain; charset=utf-8' });
    u.enviar(res, 200, buf, { 'Content-Type': s.MIME[nome.split('.').pop()], 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable' });
  } catch (e) { console.error('[portal]', e && e.message); u.enviar(res, 500, 'Erro', { 'Content-Type': 'text/plain; charset=utf-8' }); }
};
