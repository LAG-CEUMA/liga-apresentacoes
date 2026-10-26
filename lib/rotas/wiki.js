'use strict';
// /api/wiki: lista (só o que o leitor pode ver) e /wiki/<slug>: a página, com checagem de função.
const u = require('../util'); const W = require('../wiki'); const R = require('../reservado');
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const CAB = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'same-origin' };
const BARRA = '<div style="position:sticky;top:0;z-index:99;background:#0b0d14;color:#e8eaf2;font:14px system-ui,sans-serif;padding:8px 16px;border-bottom:1px solid #fff3"><a href="{h}" style="color:#8fd3ff;text-decoration:none">&larr; {n}</a>&nbsp;&nbsp;<span style="opacity:.7">{t}</span></div>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req); const { cfg } = await u.lerConfig();
    const papel = u.papel(cfg, usuario);
    const aluno = String((req.query || {}).espaco) === 'aluno';
    const itens = (await W.listar()).filter((p) => W.pode(cfg, usuario, p) && (!(req.query || {}).espaco || (p.visibilidade === 'aluno') === aluno));
    const q = req.query || {};
    if (String(q.rota) === 'wiki') {
      if (!itens.length && papel === 'visitante') return u.json(res, 401, { erro: 'Entre com sua conta do GitHub.' });
      return u.json(res, 200, { papel, espaco: aluno ? 'aluno' : 'adm', categorias: W.CATEGORIAS, paginas: itens.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo)) });
    }
    const slug = String(q.s || ''); const pag = W.SLUG_RE.test(slug) ? itens.find((p) => p.slug === slug) : null;
    if (!pag) return u.paginaSimples(res, 404, 'Página não encontrada', 'Ela não existe ou você não tem acesso. Se acha que deveria ter, peça a um owner.', '<p><a href="/ajuda">Central de ajuda</a> · <a href="/wiki">Guias e dúvidas</a></p>');
    const html = await u.lerArquivo(`wiki/${slug}.html`);
    if (html === null) return u.paginaSimples(res, 404, 'Página não encontrada', 'O arquivo desta página não foi encontrado.');
    const doc = R.embrulhar(html).replace(/<body[^>]*>/i, (m) => m + BARRA.replace('{t}', esc(pag.titulo)).replace('{h}', pag.visibilidade === 'aluno' ? '/ajuda' : '/wiki').replace('{n}', pag.visibilidade === 'aluno' ? 'Central de ajuda' : 'Guias e dúvidas'));
    u.enviar(res, 200, doc, { 'Content-Type': 'text/html; charset=utf-8', ...CAB, 'Content-Security-Policy': CSP });
  } catch (e) { console.error('[portal]', e && e.message); u.paginaSimples(res, 500, 'Erro', 'Não consegui carregar agora. Tente de novo em instantes.'); }
};
