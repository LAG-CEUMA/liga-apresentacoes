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
    'section li .guia{display:block;margin:4px 0 2px 0;padding:3px 10px;border-left:4px solid #9aa0ad;background:#0000000a;color:#2b2f3a;font-style:italic;font-weight:400;font-size:.92em}section li .guia i{font-style:normal;font-size:.8em;font-weight:700;letter-spacing:.04em;color:#6b6f7b;margin-right:6px}' +
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
      if (classe === 'ra') {
        // Azul = só a ideia. Se há trecho entre aspas, só ele é azul; sem aspas, frases de instrução ao professor (Deixe, Peça...) ficam pretas.
        var GUIA = /^(deixe|pe[çc]a|pe[çc]am|espere|aguarde|n[ãa]o (puxe|precisa|feche|leia|explique|entre|passe|mostre|use|fale|deixe|corrija|d[êe]|resolva|avance|pule|demore|insista)|(uma|duas|tr[eê]s|quatro) ideias? s[óo]|quem esquecer,|mostre|anote|escreva|circule|pause|d[êe]|se |caso|cuidado|opcional|se der tempo|depois|ent[ãa]o|volte|chame|conte|use|fa[çc]a|incentive|valide|corrija)/i;
        var blocos = [];
        if (partes.length > 1) { for (var q = 0; q < partes.length; q++) if (partes[q]) blocos.push([partes[q], q % 2 === 1]); }
        else { var fr = resto.match(/[^.!?]+[.!?]*\s*/g) || [resto]; for (var q2 = 0; q2 < fr.length; q2++) blocos.push([fr[q2], !GUIA.test(fr[q2].replace(/^\s+/, ''))]); }
        for (var b = 0; b < blocos.length; b++) { var sb = document.createElement('span'); if (blocos[b][1]) sb.className = 'ra'; sb.textContent = blocos[b][0]; li.appendChild(sb); }
      } else {
        var s2 = document.createElement('span'); if (classe === 'rv' && partes.length === 1) s2.className = classe; s2.textContent = resto; li.appendChild(s2);
      }
    }
    // Separação rígida: se a linha tem trecho colorido (para dizer), todo texto preto que sobrar vai para um bloco próprio "GUIA · não ler", embaixo.
    var kids = [].slice.call(li.children), temCor = kids.some(function (k) { return k.className === 'fala' || k.className === 'ra' || k.className === 'rv'; });
    if (temCor) {
      var guias = [];
      kids.forEach(function (k) {
        if (k.className) return;
        var tx = k.textContent.replace(/^[\s.,;:\u2014-]+/, '').replace(/\s+$/, '');
        if (tx.length > 3) { guias.push(tx); li.removeChild(k); }
        else if (/^[\s.,;:!?]*$/.test(k.textContent)) { /* pontuação solta entre trechos: mantém */ }
      });
      if (guias.length) { var g = document.createElement('span'); g.className = 'guia'; var ic = document.createElement('i'); ic.textContent = 'GUIA \u00B7 N\u00C3O LER'; g.appendChild(ic); g.appendChild(document.createTextNode(guias.join(' '))); li.appendChild(g); }
    }
  }
  var h = document.querySelector('h1');
  if (h && h.parentNode) {
    var d = document.createElement('div');
    d.id = 'liga-leg';
    d.innerHTML = '<span><b style="color:' + V + '">Vermelho</b>: ler exatamente</span><span><b style="color:' + A + '">Azul</b>: ideia, diga com suas palavras</span><span><b>Bloco cinza \"GUIA\"</b>: instrução para você (não ler)</span><span><b>Preto</b>: guia (não ler)</span><span><b style="color:#6b6f7b">Etiqueta cinza</b>: tipo da linha (nunca ler)</span>';
    h.parentNode.insertBefore(d, h.nextSibling);
  }
}
module.exports = '<script>(' + cores.toString() + ')()</script>';
