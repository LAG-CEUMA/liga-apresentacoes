'use strict';
// /r/<codigo>: entrega uma página reservada para quem tem o link (sem login). Nunca é listada nem indexada.
const u = require('../util'); const R = require('../reservado');
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
module.exports = async (req, res) => {
  try {
    const t = String((req.query || {}).t || '');
    const html = R.TOKEN_RE.test(t) ? await u.lerArquivo(`reservado/${t}.html`) : null;
    if (html === null) return u.paginaSimples(res, 404, 'Página não encontrada', 'Esse endereço não existe ou foi removido.');
    u.enviar(res, 200, R.embrulhar(html), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP });
  } catch (e) { console.error('[portal]', e && e.message); u.paginaSimples(res, 500, 'Erro', 'Não consegui carregar a página agora. Tente de novo em instantes.'); }
};
