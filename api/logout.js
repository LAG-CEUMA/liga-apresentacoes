'use strict';
const u = require('../lib/util');
module.exports = (req, res) => u.redirecionar(res, '/', { 'Set-Cookie': u.cookieLimpar('liga_s') });
