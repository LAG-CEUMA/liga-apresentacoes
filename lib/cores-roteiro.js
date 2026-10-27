'use strict';
// Cores do roteiro do apresentador, aplicadas na hora de servir (vale para todos os roteiros já publicados).
//   VERMELHO   = o que deve ser dito em voz alta (texto entre aspas e linhas "Diga:", "Fale:", "Leia:", "Pergunte:").
//   AZUL ROYAL = ideias a transmitir (linhas "Ideia:", "Explique", "Reforce", "Ponto-chave", "Duas ideias"...).
//   PRETO      = guia informativo para o professor (o resto).
function cores() {
  var V = '#c8102e', A = '#1f45d6';
  var st = document.createElement('style');
  st.textContent = 'section li .fala{color:' + V + ';font-weight:700}section li.v{color:' + V + ';font-weight:700}section li.a{color:' + A + ';font-weight:600}' +
    '#liga-leg{display:flex;gap:16px;flex-wrap:wrap;background:#fff;border:1px solid #0002;border-radius:10px;padding:8px 14px;margin:10px 0;font-size:15px}#liga-leg b{font-weight:700}';
  document.head.appendChild(st);
  var RV = /^\s*(diga|fale|leia|pergunte|pergunta|anuncie|pe[cç]a)\s*:/i;
  var RA = /^\s*(ideias?\b|duas ideias|tr[eê]s ideias|ponto[- ]chave|mensagem|conceito|reforce|explique|destaque|lembre)/i;
  var lis = document.querySelectorAll('section li');
  for (var i = 0; i < lis.length; i++) {
    var li = lis[i], t = li.textContent, partes = t.split(/(["“][^"”]+["”])/);
    if (partes.length > 1) {
      li.textContent = '';
      for (var j = 0; j < partes.length; j++) {
        if (!partes[j]) continue;
        var s = document.createElement('span');
        if (j % 2) s.className = 'fala';
        s.textContent = partes[j];
        li.appendChild(s);
      }
    }
    if (RV.test(t) && partes.length === 1) li.className = 'v';
    else if (RA.test(t)) li.className = 'a';
  }
  var h = document.querySelector('h1');
  if (h && h.parentNode) {
    var d = document.createElement('div');
    d.id = 'liga-leg';
    d.innerHTML = '<span><b style="color:' + V + '">Vermelho</b>: ler/falar em voz alta</span><span><b style="color:' + A + '">Azul</b>: ideias a passar</span><span><b>Preto</b>: guia para você</span>';
    h.parentNode.insertBefore(d, h.nextSibling);
  }
}
module.exports = '<script>(' + cores.toString() + ')()</script>';
