'use strict';
const u = require('../lib/util');
module.exports = async (req, res) => {
  try {
    const { code, state } = req.query || {};
    const st = u.verificar(u.cookies(req).liga_st);
    if (!code || !state || !st || st.s !== state) return u.paginaSimples(res, 400, 'Login inválido', 'A tentativa de login expirou ou não confere. Tente entrar de novo.');
    const t = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'liga-portal' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${u.baseUrl(req)}/api/callback` }),
    }).then((r) => r.json());
    if (!t.access_token) return u.paginaSimples(res, 400, 'Login recusado', 'O GitHub não confirmou o login. Tente de novo.');
    const me = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${t.access_token}`, 'User-Agent': 'liga-portal', Accept: 'application/vnd.github+json' } }).then((r) => r.json());
    if (!me.login || !u.USER_RE.test(me.login)) return u.paginaSimples(res, 400, 'Login inválido', 'Não consegui ler o seu usuário do GitHub.');
    const sessao = u.assinar({ u: me.login.toLowerCase(), exp: Date.now() + u.SESSAO_DIAS * 86400000 });
    u.redirecionar(res, u.proximoSeguro(st.n), { 'Set-Cookie': [u.cookieSet('liga_s', sessao, u.SESSAO_DIAS * 86400), u.cookieLimpar('liga_st')] });
  } catch (e) {
    u.paginaSimples(res, 500, 'Erro', 'Algo deu errado no login. Tente de novo em instantes.');
  }
};
