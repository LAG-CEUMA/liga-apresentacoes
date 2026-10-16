'use strict';
const u = require('../util');
module.exports = (req, res) => u.redirecionar(res, '/', { 'Set-Cookie': u.cookieLimpar('liga_s') });
