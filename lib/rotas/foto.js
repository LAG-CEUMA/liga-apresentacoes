'use strict';
// /api/foto?u=<usuario>: entrega a foto de perfil. Sem foto enviada (ou se ela não é pública e quem pede não está logado), vai para o avatar do GitHub.
const u = require('../util'); const F = require('../fotos');
module.exports = async (req, res) => {
  const k = String((req.query || {}).u || '').toLowerCase();
  const gh = () => { res.statusCode = 302; res.setHeader('Location', `https://github.com/${encodeURIComponent(k)}.png?size=96`); res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); res.end(); };
  try {
    if (!u.USER_RE.test(k)) return gh();
    const pref = (await F.mapa())[k]; if (!pref) return gh();
    const logado = !!u.usuarioDaSessao(req);
    if (!pref.publica && !logado) return gh();
    const buf = await F.ler(k); if (!buf) return gh();
    u.enviar(res, 200, buf, { 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': pref.publica ? 'public, max-age=300, s-maxage=300' : 'private, max-age=300' });
  } catch (e) { console.error('[portal]', e && e.message); gh(); }
};
