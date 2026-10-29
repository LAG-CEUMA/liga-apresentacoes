'use strict';
// Cores do roteiro do apresentador, aplicadas na hora de servir (vale para todos os roteiros já publicados).
//   VERMELHO   = o que deve ser dito em voz alta (texto entre aspas e linhas "Diga:", "Fale:", "Leia:", "Pergunte:").
//   AZUL ROYAL = ideias a transmitir (linhas "Ideia:", "Explique", "Reforce", "Ponto-chave", "Duas ideias"...).
//   PRETO      = guia informativo para o professor (o resto).
function cores() {
  var V = '#c8102e', A = '#1f45d6';
  var st = document.createElement('style');
  st.textContent = 'section li .fala{color:' + V + ';font-weight:700}section li .rv{color:' + V + ';font-weight:700}section li .ra{color:' + A + ';font-weight:600}' +
    'section li .rot{color:#6b6f7b;font-weight:500;font-size:.82em;letter-spacing:.02em;margin-right:6px;padding:1px 7px;border:1px solid #0002;border-radius:99px;background:#fff8}' +
    '#liga-leg{display:flex;gap:16px;flex-wrap:wrap;background:#fff;border:1px solid #0002;border-radius:10px;padding:8px 14px;margin:10px 0;font-size:15px}#liga-leg b{font-weight:700}';
  document.head.appendChild(st);
  // Regra: o rótulo (Diga:, Ideia:, Guia:...) é sempre uma etiqueta cinza e NUNCA faz parte do que se lê.
  // Só o que está colorido é para dizer: vermelho = falar exatamente; azul = ideia a passar com as próprias palavras. Preto = guia para você.
  var RV = /^(diga|fale|leia|pergunte|pergunta|anuncie)\b/i;
  var RA = /^(ideias?\b|duas ideias|tr[eê]s ideias|ponto[- ]chave|mensagem|conceito|reforce|explique|destaque|lembre)/i;
  var lis = document.querySelectorAll('section li');
  for (var i = 0; i < lis.length; i++) {
    var li = lis[i], t = li.textContent, rot = '', resto = t;
    var m = /^\s*([^:"“”]{1,60}):\s*([\s\S]*)$/.exec(t);
    if (m) { rot = m[1]; resto = m[2]; }
    var classe = rot ? (RV.test(rot) ? 'rv' : (RA.test(rot) ? 'ra' : '')) : (RV.test(t) ? 'rv' : (RA.test(t) ? 'ra' : ''));
    li.textContent = '';
    if (rot) { var r = document.createElement('span'); r.className = 'rot'; r.textContent = rot; li.appendChild(r); }
    // Aspas só ficam vermelhas em linhas de FALA (Diga, Pergunte, Exemplo...). Em Guia, Alerta, Ideia etc. as aspas são só texto.
    var falaLinha = rot ? (RV.test(rot) || (/^exemplo/i.test(rot) && !/mensagem|anota|fica de fora/i.test(rot)) || /^explique/i.test(rot)) : RV.test(t);
    var partes = resto.split(/(["“][^"”]+["”])/);
    if (partes.length > 1 && falaLinha) {
      for (var j = 0; j < partes.length; j++) {
        if (!partes[j]) continue;
        var s = document.createElement('span'); if (j % 2) s.className = 'fala'; s.textContent = partes[j]; li.appendChild(s);
      }
    } else if (resto) {
      var s2 = document.createElement('span'); if (classe === 'ra' || (classe === 'rv' && partes.length === 1)) s2.className = classe; s2.textContent = resto; li.appendChild(s2);
    }
  }
  var h = document.querySelector('h1');
  if (h && h.parentNode) {
    var d = document.createElement('div');
    d.id = 'liga-leg';
    d.innerHTML = '<span><b style="color:' + V + '">Vermelho</b>: ler exatamente</span><span><b style="color:' + A + '">Azul</b>: ideia, diga com suas palavras</span><span><b>Preto</b>: guia para você (não ler)</span><span><b style="color:#6b6f7b">Etiqueta cinza</b>: tipo da linha (nunca ler)</span>';
    h.parentNode.insertBefore(d, h.nextSibling);
  }
}
module.exports = '<script>(' + cores.toString() + ')()</script>';
