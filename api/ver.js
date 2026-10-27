'use strict';
// Entrega o HTML de uma aula (ou do roteiro) se a pessoa tiver permissão.
const u = require('../lib/util');
// Botão discreto de voltar ao início. Some em tela cheia e não deixa o clique avançar o slide.
const VOLTAR = '<a id="liga-voltar" href="/" onclick="event.stopPropagation();return ligaVoltar(event)" style="position:fixed;left:12px;top:10px;z-index:99999;font:600 14px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.35);border-radius:99px;padding:6px 14px;text-decoration:none;opacity:.4" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.4">&larr; Voltar</a>' +
  '<div id="liga-pg" style="position:fixed;right:14px;bottom:10px;z-index:99998;font:600 15px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.55);border-radius:99px;padding:4px 12px;opacity:.75;display:none;pointer-events:none"></div>' +
  '<script>' +
  // voltar de verdade: volta para a tela anterior (a de onde a pessoa veio); sem histórico, vai ao início
  'function ligaVoltar(e){var r=document.referrer,mesmo=false;try{mesmo=r&&new URL(r).origin===location.origin}catch(x){}' +
  'if(history.length>1){e.preventDefault();history.back();return false}if(mesmo){e.preventDefault();location.href=r;return false}return true}' +
  // número do slide no rodapé, em qualquer slide (some quando o próprio slide já mostra o número)
  '(function(){var S=[].slice.call(document.querySelectorAll(".slide")),el=document.getElementById("liga-pg");if(!S.length||!el)return;' +
  'function p2(n){return(n<10?"0":"")+n}function up(){var k=S.findIndex(function(s){return s.classList.contains("on")});if(k<0){el.style.display="none";return}' +
  'var tem=S[k].querySelector("[data-pag]");el.textContent=p2(k+1)+" / "+p2(S.length);el.style.display=tem?"none":"block"}' +
  'new MutationObserver(up).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});up()})();' +
  'document.addEventListener("fullscreenchange",function(){var a=document.getElementById("liga-voltar");if(a)a.style.display=document.fullscreenElement?"none":""})</script>';
function comVoltar(html) {
  html = html.replace(/location\.hash\s*=\s*i\s*\+\s*1\s*;/g, "history.replaceState(null,'','#'+(i+1));"); // trocar de slide não empilha histórico
  const i = html.lastIndexOf('</body>');
  return i === -1 ? html + VOLTAR : html.slice(0, i) + VOLTAR + html.slice(i);
}
module.exports = async (req, res) => {
  try {
    const { dir, id, roteiro } = req.query || {};
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const p = u.papel(cfg, usuario);
    const aula = (await u.listarAulas()).find((a) => a.dir === dir && a.id === id);
    if (!aula) return u.paginaSimples(res, 404, 'Aula não encontrada', 'Esse endereço não existe.');
    const nivel = roteiro ? 'owners' : u.nivelDe(cfg, aula.chave);
    if (!u.pode(cfg, usuario, aula.chave, !!roteiro)) {
      if (p === 'visitante' && !usuario) return u.redirecionar(res, `/api/login?next=${encodeURIComponent(roteiro ? `/aula/${aula.chave}/roteiro` : `/aula/${aula.chave}`)}`);
      return u.paginaSimples(res, 403, 'Sem acesso', `Você entrou como <b>${usuario}</b>, mas esta aula ainda não foi liberada para você. Fale com um owner da liga.`,
        `<p><a href="/api/logout">Sair e entrar com outra conta</a></p>`);
    }
    const caminho = roteiro ? aula.roteiro : aula.slides;
    if (!caminho) return u.paginaSimples(res, 404, 'Roteiro não encontrado', 'Esta aula não tem roteiro.');
    const html = await u.lerArquivo(caminho);
    if (html === null) return u.paginaSimples(res, 404, 'Arquivo não encontrado', 'O arquivo da aula não está no repositório.');
    const publico = nivel === 'publico';
    u.enviar(res, 200, comVoltar(html), { 'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': publico ? 'public, s-maxage=60, stale-while-revalidate=300' : 'private, no-store' });
  } catch (e) { console.error('[portal]', e && e.message); u.paginaSimples(res, 500, 'Erro', 'Não consegui carregar a aula agora. Tente de novo em instantes.'); }
};
