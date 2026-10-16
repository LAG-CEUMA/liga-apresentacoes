'use strict';
// Eventos (palestras, oficinas, game jams, cursos): um JSON por evento e um por inscrição, em dados/eventos/<ID>/.
const u = require('./util'); const d = require('./dados');
const ID_RE = /^[A-Z0-9][A-Z0-9-]{1,29}$/;
const TIPOS_EVENTO = { palestra: 'Palestra', oficina: 'Oficina', gamejam: 'Game jam', curso: 'Curso', outro: 'Evento' };
const ARQ = /^dados\/eventos\/([A-Z0-9][A-Z0-9-]{1,29})\/(evento|inscricoes\/([a-z0-9][a-z0-9-]{0,38}))\.json$/;
const txt = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
function limpar(b, id, criadoPor) {
  return { id, titulo: txt(b.titulo, 80), tipo: TIPOS_EVENTO[b.tipo] ? b.tipo : 'outro', descricao: txt(b.descricao, 600), local: txt(b.local, 100), data: data(b.data), hora: /^\d{2}:\d{2}$/.test(String(b.hora || '')) ? b.hora : '',
    horas: Math.min(200, Math.max(0, Math.round(Number(b.horas) * 10) / 10 || 0)), vagas: Math.min(5000, Math.max(0, Math.round(Number(b.vagas)) || 0)), inscricaoAte: data(b.inscricaoAte),
    visibilidade: b.visibilidade === 'publico' ? 'publico' : 'interno', certificado: b.certificado !== false, criadoPor };
}
// Lê tudo de uma vez (poucos arquivos): { eventos: {ID: {evento, inscricoes: {usuario: {...}}}} }
async function carregar() {
  return u.comCache('eventos', 20000, async () => {
    const arqs = await d.listarArquivos(ARQ, 800);
    const out = {};
    await Promise.all(arqs.map(async ({ m, path }) => {
      const j = await d.lerRaw(path); if (!j) return;
      const e = (out[m[1]] = out[m[1]] || { evento: null, inscricoes: {} });
      if (m[3]) e.inscricoes[m[3]] = j; else e.evento = j;
    }));
    for (const k of Object.keys(out)) if (!out[k].evento) delete out[k];
    return out;
  });
}
// Ordem de chegada: quem passa do limite de vagas fica na lista de espera.
function situacao(ev, insc) {
  const ativos = Object.values(insc).filter((i) => i.estado !== 'cancelado').sort((a, b) => String(a.em).localeCompare(String(b.em)) || a.usuario.localeCompare(b.usuario));
  const pos = {}; ativos.forEach((i, k) => { pos[i.usuario] = k + 1; });
  const espera = (usuario) => ev.vagas > 0 && pos[usuario] > ev.vagas;
  return { ativos, pos, espera, vagasLivres: ev.vagas ? Math.max(0, ev.vagas - ativos.length) : null };
}
const caminhoEvento = (id) => `dados/eventos/${id}/evento.json`;
const caminhoInsc = (id, usuario) => `dados/eventos/${id}/inscricoes/${usuario}.json`;
module.exports = { ID_RE, TIPOS_EVENTO, limpar, carregar, situacao, caminhoEvento, caminhoInsc, txt };
