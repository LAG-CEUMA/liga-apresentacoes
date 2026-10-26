'use strict';
// Painel de personalização (só owners): ler e salvar o site, enviar imagens.
const u = require('../lib/util'); const s = require('../lib/site');
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    if (!u.temPerm(cfg, usuario, 'site')) return u.json(res, 403, { erro: 'Só owners.' });
    if (req.method === 'GET') {
      const [{ site }, imagens] = await Promise.all([s.lerSite(), s.listarImagensDo('site')]);
      const turmas = Object.entries(cfg.turmas || {}).map(([id, t]) => ({ id, nome: t.nome || id, status: t.status || 'andamento', alunos: (t.alunos || []).length }));
      return u.json(res, 200, { usuario, site, imagens, redes: s.REDES, padrao: s.padrao(), turmas });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    if (b.acao === 'salvar') {
      const falta = s.faltaPeso(b.site); if (falta) return u.json(res, 400, { erro: falta });
      const resumo = String(b.resumo || 'ajustes').replace(/[^\p{L}\p{N} ,.()\-]/gu, '').slice(0, 80) || 'ajustes';
      await s.gravarSite(b.site, `Portal: ${usuario} atualizou o site (${resumo})`);
      return u.json(res, 200, { ok: true });
    }
    if (b.acao === 'ranking_gerar') {
      const t = (cfg.turmas || {})[String(b.turma || '')]; if (!t) return u.json(res, 400, { erro: 'Turma inválida.' });
      const n = [3, 5, 10].includes(Number(b.quantos)) ? Number(b.quantos) : 5;
      const rk = t.status === 'arquivada' && t.rankingFinal ? t.rankingFinal.map((x, i) => ({ posicao: i + 1, usuario: x.usuario, total: x.total }))
        : require('../lib/pontos').ranking(cfg, String(b.turma), await require('../lib/dados').listarSessoes(), await require('../lib/atividades').listar());
      const itens = rk.filter((x) => x.total > 0).slice(0, n).map((x) => ({ posicao: x.posicao, usuario: x.usuario, total: x.total }));
      if (!itens.length) return u.json(res, 400, { erro: 'Ninguém tem pontos nesta turma ainda; não há o que publicar.' });
      return u.json(res, 200, { ok: true, itens, turmaNome: t.nome || String(b.turma), foto: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) });
    }
    if (b.acao === 'upload') {
      const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dados || ''));
      if (!m) return u.json(res, 400, { erro: 'Imagem inválida.' });
      const nome = await s.enviarImagem(b.nome, Buffer.from(m[1], 'base64'), usuario, ['site']);
      return u.json(res, 200, { ok: true, nome });
    }
    u.json(res, 400, { erro: 'Ação inválida.' });
  } catch (e) {
    console.error('[portal]', e && e.message);
    u.json(res, e && e.status ? e.status : 500, { erro: e && e.status ? e.message : 'Não consegui salvar agora. Tente de novo.' });
  }
};
