'use strict';
// Entrega o HTML de uma aula (ou do roteiro) se a pessoa tiver permissão.
const u = require('../lib/util');
// Botão discreto de voltar ao início. Some em tela cheia e não deixa o clique avançar o slide.
const VOLTAR = '<a id="liga-voltar" href="/" onclick="event.stopPropagation();return ligaVoltar(event)" style="position:fixed;left:12px;top:10px;z-index:99999;font:600 14px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.35);border-radius:99px;padding:6px 14px;text-decoration:none;opacity:.4" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.4">&larr; Voltar</a>' +
  '<div id="liga-pg" style="position:fixed;right:14px;bottom:10px;z-index:99998;font:600 15px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.55);border-radius:99px;padding:4px 12px;opacity:.75;display:none;pointer-events:none"></div>' +
  '<script>' +
  // voltar de verdade: volta para a tela anterior (a de onde a pessoa veio); sem histórico, vai ao início
  'function ligaVoltar(e){var r=document.referrer,mesmo=false;try{mesmo=r&&new URL(r).origin===location.origin}catch(x){}' +
  'if(history.length>1){e.preventDefault();history.back();return false}' +
  // aba aberta a partir do Painel: fecha a aba e a tela de origem continua exatamente como estava
  'e.preventDefault();try{window.close()}catch(x){}setTimeout(function(){location.href=mesmo?r:"/"},200);return false}' +
  '(function(){var a=document.getElementById("liga-voltar");if(a&&history.length<=1)a.innerHTML="&times; Fechar slides"})();' +
  // número do slide no rodapé, em qualquer slide (some quando o próprio slide já mostra o número)
  '(function(){var S=[].slice.call(document.querySelectorAll(".slide")),el=document.getElementById("liga-pg");if(!S.length||!el)return;' +
  'function p2(n){return(n<10?"0":"")+n}function up(){var k=S.findIndex(function(s){return s.classList.contains("on")});if(k<0){el.style.display="none";return}' +
  'var tem=S[k].querySelector("[data-pag]");el.textContent=p2(k+1)+" / "+p2(S.length);el.style.display=tem?"none":"block"}' +
  'new MutationObserver(up).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});up()})();' +
  // cronômetro: os slides avisam em qual slide estão; a página do roteiro (outra tela) mostra o tempo. Tecla T mostra um relógio discreto nos slides.
  '(function(){var S=[].slice.call(document.querySelectorAll(".slide"));if(!S.length||!window.BroadcastChannel)return;var ch=new BroadcastChannel("liga-slide:"+location.pathname),t0=Date.now(),ts=Date.now(),cur=-1,box=null;' +
  'function idx(){return S.findIndex(function(s){return s.classList.contains("on")})}' +
  'function envia(){var k=idx();if(k<0)return;if(k!==cur){cur=k;ts=Date.now()}ch.postMessage({k:k,n:S.length})}' +
  'new MutationObserver(envia).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});envia();' +
  'ch.onmessage=function(e){var d=e.data;if(!d)return;if(d.hello)envia();else if(typeof d.go==="number"&&d.go>=0&&d.go<S.length){var tk=function(k){dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true,cancelable:true}))};' +
  'if(d.go<idx())tk("Home");var g=0;while(idx()!==d.go&&g++<400)tk("ArrowRight");envia()}};' +
  'function f(ms){var s=Math.floor(ms/1000),m=Math.floor(s/60);return(m<10?"0":"")+m+":"+(s%60<10?"0":"")+(s%60)}' +
  'function pinta(){if(box)box.textContent="\u23F1 "+f(Date.now()-t0)+"  \u00B7  slide "+f(Date.now()-ts)}' +
  'addEventListener("keydown",function(e){if(e.key==="t"||e.key==="T"){if(box){box.remove();box=null}else{box=document.createElement("div");box.style.cssText="position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:99998;font:600 16px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.6);border-radius:99px;padding:4px 14px;pointer-events:none";document.body.appendChild(box);pinta()}}});setInterval(pinta,500)})();' +
  'document.addEventListener("fullscreenchange",function(){var a=document.getElementById("liga-voltar");if(a)a.style.display=document.fullscreenElement?"none":""})</script>';

// Painel de tempo na página do roteiro (outra tela): segue o slide projetado, mostra o tempo previsto e o real.
const PAINEL_DIV = '<div id="liga-tempo" style="position:sticky;top:0;z-index:50;background:#14161f;color:#fff;border-radius:12px;padding:10px 14px;margin:0 0 14px;font:600 16px Arial,sans-serif;display:flex;gap:14px;flex-wrap:wrap;align-items:center"></div>';
const PAINEL_JS = '<script>(function(){var P=document.getElementById("liga-tempo");if(!P||!window.BroadcastChannel){if(P)P.remove();return}' +
  'var SEC=[].slice.call(document.querySelectorAll("section")),N=SEC.length,PL=SEC.map(function(s){var m=/Tempo:\\s*(\\d+):(\\d+)\\s*a\\s*(\\d+):(\\d+)/.exec(s.textContent);return m?{a:+m[1]*60+ +m[2],b:+m[3]*60+ +m[4]}:null});' +
  'var fim=Math.max.apply(null,PL.map(function(x){return x?x.b:0}).concat([0]));var ch=new BroadcastChannel("liga-slide:"+location.pathname.replace(/\\/roteiro\\/?$/,"")),k=-1,run=false,base=0,t0=0;' +
  'try{var sv=JSON.parse(sessionStorage.getItem("ligaTempo"+location.pathname)||"null");if(sv){base=sv.base||0;run=!!sv.run;t0=sv.t0||0}}catch(e){}' +
  'function salva(){try{sessionStorage.setItem("ligaTempo"+location.pathname,JSON.stringify({base:base,run:run,t0:t0}))}catch(e){}}' +
  'function dec(){return base+(run?Date.now()-t0:0)}function f(ms){var s=Math.max(0,Math.floor(Math.abs(ms)/1000)),m=Math.floor(s/60);return(ms<0?"-":"")+m+":"+(s%60<10?"0":"")+(s%60)}' +
  'var el=function(h){var d=document.createElement("span");d.innerHTML=h;return d};' +
  'var bt=document.createElement("button");bt.style.cssText="font:700 14px Arial;padding:6px 12px;border-radius:8px;border:0;background:#f5b83d;color:#14161f;cursor:pointer";' +
  'var rz=document.createElement("button");rz.textContent="Zerar";rz.style.cssText="font:600 13px Arial;padding:6px 10px;border-radius:8px;border:1px solid #fff6;background:transparent;color:#fff;cursor:pointer";' +
  'var inf=document.createElement("span"),st=document.createElement("span");P.append(bt,rz,inf,st);' +
  'bt.onclick=function(){if(run){base=dec();run=false}else{t0=Date.now();run=true}salva();pinta()};rz.onclick=function(){base=0;run=false;salva();pinta()};' +
  'ch.onmessage=function(e){if(e.data&&typeof e.data.k==="number"){var novo=e.data.k!==k;k=e.data.k;if(!run&&base===0){t0=Date.now();run=true;salva()}if(novo&&SEC[k]){SEC.forEach(function(s,i){s.style.outline=i===k?"3px solid #f5b83d":"";s.style.background=i===k?"#fff6dd":""});SEC[k].scrollIntoView({behavior:"smooth",block:"start"})}pinta()}};ch.postMessage({hello:1});' +
  'SEC.forEach(function(s,i){s.style.cursor="pointer";s.title="Clique para levar a apresenta\u00E7\u00E3o a este slide";s.addEventListener("click",function(e){if(String(getSelection())||e.target.closest("a,button"))return;ch.postMessage({go:i})})});' +
  'function pinta(){var d=dec(),min=d/60000;bt.textContent=run?"\\u23F8 Pausar":"\\u25B6 Iniciar";var tot=fim?" de "+fim+" min":"";inf.innerHTML="\\u23F1 <b>"+f(d)+"</b>"+tot+(k>=0?" \\u00B7 slide "+(k+1)+"/"+N:"");' +
  'var pl=k>=0?PL[k]:null,c="#9aa3b8",tx="Abra os slides na outra tela para sincronizar.";if(k>=0&&pl){if(min>pl.b){c="#ff6b5b";tx="atrasado "+f(d-pl.b*60000)+" (previsto at\\u00E9 "+Math.floor(pl.b/60)+":"+(pl.b%60<10?"0":"")+(pl.b%60)+")"}else if(min<pl.a){c="#3ec9b0";tx="adiantado "+f(pl.a*60000-d)}else{c="#3ec9b0";tx="no tempo \\u00B7 restam "+f(pl.b*60000-d)+" neste slide"}}else if(k>=0){tx="slide sem tempo previsto"}st.style.color=c;st.textContent=tx}' +
  'setInterval(pinta,1000);pinta()})()</script>';
const CORES = require('../lib/cores-roteiro');
function comVoltar(html, roteiro) {
  html = html.replace(/location\.hash\s*=\s*i\s*\+\s*1\s*;/g, "history.replaceState(null,'','#'+(i+1));"); // trocar de slide não empilha histórico
  if (roteiro) { const b = html.indexOf('<h1'); if (b > -1) html = html.slice(0, b) + PAINEL_DIV + html.slice(b); }
  const extra = VOLTAR + (roteiro ? PAINEL_JS + CORES : '');
  const i = html.lastIndexOf('</body>');
  return i === -1 ? html + extra : html.slice(0, i) + extra + html.slice(i);
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
    u.enviar(res, 200, comVoltar(html, !!roteiro), { 'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': publico ? 'public, s-maxage=60, stale-while-revalidate=300' : 'private, no-store' });
  } catch (e) { console.error('[portal]', e && e.message); u.paginaSimples(res, 500, 'Erro', 'Não consegui carregar a aula agora. Tente de novo em instantes.'); }
};
