'use strict';
// /certificado/<código>: o próprio certificado, que também serve de verificação pública de autenticidade.
const u = require('../util'); const d = require('../dados'); const E = require('../eventos'); const C = require('../certificado');
const pag = (res, st, corpo) => u.enviar(res, st, corpo, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" });
module.exports = async (req, res) => {
  try {
    const v = C.validar((req.query || {}).c);
    if (!v) return u.paginaSimples(res, 404, 'Certificado não encontrado', 'O código informado não é válido. Confira se ele foi copiado por inteiro.');
    const t = (await E.carregar())[v.id]; const i = t && t.inscricoes[v.usuario];
    if (!t || !i || i.presente !== true || !t.evento.certificado) return u.paginaSimples(res, 404, 'Certificado não encontrado', 'Não há registro de comparecimento para este código.');
    const ev = t.evento;
    const modelo = (await u.lerArquivo('modelos/certificado.html').catch(() => null)) || C.MODELO;
    const br = (x) => (x ? x.split('-').reverse().join('/') : '');
    pag(res, 200, C.preencher(modelo, { nome: i.nome || v.usuario, evento: ev.titulo, tipo: (E.TIPOS_EVENTO[ev.tipo] || 'Evento').toLowerCase(), data: br(ev.data), horas: ev.horas ? `, com carga horária de ${ev.horas} hora(s)` : '',
      codigo: C.codigo(v.id, v.usuario), liga: 'LIGA ACADÊMICA DE GAMES · CEUMA', emitido: br((i.checkinEm || ev.data || '').slice(0, 10)) }));
  } catch (e) { console.error('[portal]', e && e.message); u.paginaSimples(res, 500, 'Não consegui carregar', 'Tente de novo em instantes.'); }
};
