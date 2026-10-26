'use strict';
// Ver como: só owner. POST {usuario} começa a navegar como a pessoa (somente leitura); POST {sair:true} volta ao normal.
const u = require('../util');
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    const real = u.sessaoReal(req); const { cfg } = await u.lerConfig();
    if (!real || u.papel(cfg, real) !== 'owner') return u.json(res, 403, { erro: 'Só owners podem usar esta função.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    if (b.sair) { res.setHeader('Set-Cookie', u.cookieLimpar('liga_as')); return u.json(res, 200, { ok: true }); }
    const alvo = String(b.usuario || '').trim().replace(/^@/, '').toLowerCase();
    if (!u.USER_RE.test(alvo)) return u.json(res, 400, { erro: 'Usuário inválido.' });
    if (u.papel(cfg, alvo) === 'owner') return u.json(res, 400, { erro: 'Owners já veem tudo; escolha outra pessoa.' });
    res.setHeader('Set-Cookie', u.cookieSet('liga_as', u.assinar({ por: real, como: alvo, exp: Date.now() + 3600e3 }), 3600));
    return u.json(res, 200, { ok: true, como: alvo });
  } catch (e) { console.error('[como]', e && e.message); return u.json(res, 500, { erro: 'Erro interno.' }); }
};
