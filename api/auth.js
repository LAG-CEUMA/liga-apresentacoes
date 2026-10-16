'use strict';
// Entrada única do login (a Vercel gratuita limita o número de funções). /api/login, /api/callback e /api/logout chegam aqui por reescrita em vercel.json.
const rotas = { login: require('../lib/rotas/login'), callback: require('../lib/rotas/callback'), logout: require('../lib/rotas/logout') };
module.exports = (req, res) => {
  const f = rotas[String((req.query || {}).rota || '')];
  if (!f) { res.statusCode = 404; return res.end('Não encontrado'); }
  return f(req, res);
};
