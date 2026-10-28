'use strict';
const u = require('../util');
// Sai da Liga e apaga os cookies deste site. A página inicial avisa que, em computador compartilhado, também é preciso sair do GitHub.
module.exports = (req, res) => u.redirecionar(res, '/?saiu=1', { 'Set-Cookie': [u.cookieLimpar('liga_s'), u.cookieLimpar('liga_st')], 'Clear-Site-Data': '"cookies"' });
