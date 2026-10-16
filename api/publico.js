'use strict';
// Entrada única das rotas públicas do site: /api/site, /api/tema.css e /api/imagem (reescritas em vercel.json).
const rotas = { site: require('../lib/rotas/site'), tema: require('../lib/rotas/tema'), imagem: require('../lib/rotas/imagem') };
module.exports = (req, res) => {
  const f = rotas[String((req.query || {}).rota || '')];
  if (!f) { res.statusCode = 404; return res.end('Não encontrado'); }
  return f(req, res);
};
