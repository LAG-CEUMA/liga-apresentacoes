/* "← Início" / "← Voltar" que realmente volta para a tela de onde a pessoa veio (e não sempre para o início).
   Sem tela anterior do site (aba nova, link direto), continua indo para o início. */
(function () {
  var mesmo = false; try { mesmo = !!document.referrer && new URL(document.referrer).origin === location.origin && new URL(document.referrer).pathname !== '/'; } catch (e) { mesmo = false; }
  function alvo(a) { return a && a.getAttribute && a.getAttribute('href') === '/' && /^\s*(←|←|←)\s*(Início|Voltar)/.test(a.textContent); }
  function rotular() { if (!mesmo) return; document.querySelectorAll('a[href="/"]').forEach(function (a) { if (alvo(a)) a.textContent = '← Voltar'; }); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null; if (!a || !alvo(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (mesmo && history.length > 1) { e.preventDefault(); history.back(); }
  });
  rotular(); document.addEventListener('DOMContentLoaded', rotular); setTimeout(rotular, 600); setTimeout(rotular, 2000);
})();
