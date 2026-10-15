'use strict';
const crypto = require('crypto');
const u = require('../lib/util');
module.exports = (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) return u.paginaSimples(res, 500, 'Login não configurado', 'Falta a variável GITHUB_CLIENT_ID na Vercel. Veja o COMO-USAR-PASSO-A-PASSO.md.');
  const next = u.proximoSeguro(req.query && req.query.next);
  const state = crypto.randomBytes(16).toString('hex');
  const st = u.assinar({ s: state, n: next, exp: Date.now() + 10 * 60 * 1000 });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${u.baseUrl(req)}/api/callback`);
  url.searchParams.set('state', state);
  u.redirecionar(res, url.toString(), { 'Set-Cookie': u.cookieSet('liga_st', st, 600) });
};
