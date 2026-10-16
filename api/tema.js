'use strict';
// CSS com as cores, botões e papéis de parede configurados pelos owners.
const u = require('../lib/util'); const s = require('../lib/site');
module.exports = async (req, res) => {
  let css = '';
  try { css = s.cssDoTema((await s.lerSite()).site); } catch (e) { console.error('[portal]', e && e.message); }
  u.enviar(res, 200, css, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' });
};
