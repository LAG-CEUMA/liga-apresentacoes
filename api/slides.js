'use strict';
// Editor de slides: quem pode editar (owner, escopo por nível/aula, ou cargo "slides" + vínculo com o nível).
const u = require('../lib/util'); const S = require('../lib/slides');
const SUBSTITUIR_IMPORTADA = true;
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    if (!usuario) return u.json(res, 401, { erro: 'Entre com o GitHub para usar o editor.' });
    const { cfg } = await u.lerConfig();
    const dono = u.papel(cfg, usuario) === 'owner';
    const pode = (dir, id) => u.podeEditarSlides(cfg, usuario, dir, id);
    const erro = (c, m) => u.json(res, c, { erro: m });
    const validar = (dir, id) => S.DIR_RE.test(String(dir || '')) && S.AULA_ID_RE.test(String(id || ''));
    if (req.method === 'GET') {
      const q = req.query || {}; const acao = q.acao || 'lista';
      if (acao === 'lista') {
        const aulas = await u.listarAulas(); const dirs = await S.listarNiveis();
        const todas = new Set([...dirs, ...aulas.map((a) => a.dir)]);
        const niveis = [...todas].sort().map((d) => ({ dir: d, nome: (/^nivel-(\d+)/.exec(d) ? `Nível ${Number(/^nivel-(\d+)/.exec(d)[1])}` : d), podeCriar: pode(d, null),
          aulas: aulas.filter((a) => a.dir === d).map((a) => ({ id: a.id, titulo: a.titulo, editavel: pode(d, a.id) })) }));
        const visiveis = niveis.filter((n) => dono || n.podeCriar || n.aulas.some((a) => a.editavel));
        if (!visiveis.length && !dono) return erro(403, 'Você não tem permissão para editar slides. Peça a um owner.');
        return u.json(res, 200, { usuario, dono, niveis: visiveis });
      }
      if (!validar(q.dir, q.id)) return erro(400, 'Aula inválida.');
      if (acao === 'aula') {
        if (!pode(q.dir, q.id)) return erro(403, 'Sem permissão para editar esta aula.');
        const a = await S.lerAula(q.dir, q.id);
        return u.json(res, 200, a || { origem: 'nova', modelo: null, base: null });
      }
      if (acao === 'importar') { // lê uma aula existente (qualquer origem) para virar modelo editável; o salvamento é separado
        const chave = `${q.dir}/${q.id}`;
        if (!pode(q.dir, q.id) && !u.pode(cfg, usuario, chave, true)) return erro(403, 'Sem permissão para ler esta aula.');
        const m = await S.importarExistente(q.dir, q.id);
        return m ? u.json(res, 200, { modelo: m }) : erro(404, 'Aula não encontrada.');
      }
      return erro(400, 'Ação inválida.');
    }
    if (req.method !== 'POST') return erro(405, 'Método inválido.');
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return erro(403, 'Requisição recusada.');
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return erro(400, 'Corpo inválido.');
    if (b.acao === 'salvar') {
      if (!validar(b.dir, b.id)) return erro(400, 'Aula inválida.');
      if (!pode(b.dir, b.id)) return erro(403, 'Sem permissão para editar esta aula.');
      if (b.substituir && !dono) return erro(403, 'Só owners podem substituir uma aula que já existia fora do editor.');
      try {
        const r = await S.salvarAula(b.dir, b.id, b.modelo, usuario, b.base || null, SUBSTITUIR_IMPORTADA && !!b.substituir);
        return u.json(res, 200, { ok: true, base: r.base, modelo: r.modelo });
      } catch (e) { if (e && e.status) return erro(e.status, e.message); throw e; }
    }
    if (b.acao === 'novo_nivel') {
      if (!dono) return erro(403, 'Só owners criam níveis.');
      try { return u.json(res, 200, { ok: true, dir: await S.novoNivel(b.numero, b.nome, usuario) }); } catch (e) { return erro(400, e.message); }
    }
    return erro(400, 'Ação inválida.');
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Falha no editor de slides. Tente de novo.' }); }
};
