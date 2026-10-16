/* Modelos de slides e de elementos do editor. Tudo é HTML simples e posicionado em pixels (palco 1920x1080), igual ao das aulas do Nível 0. */
(function (g) {
  const ICONES = {
    Atividade: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', Conversa: '<path d="M4 5h16v11H9l-5 4z"/>', Certo: '<path d="M4 12l5 5L20 6"/>', Relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    Codigo: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>', Casa: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    Ideia: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>', Raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    Busca: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>', Estrela: '<path d="M12 3l3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z"/>',
    Joinha: '<path d="M7 11v9H3v-9zM7 11l4-8c2 0 3 1 3 3v3h6l-2 11H7"/>', Ferramenta: '<path d="M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2z"/>',
    Pessoas: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1 6 5"/>',
    Verificado: '<path d="M12 2l3 2 4 .5.5 4 2 3-2 3-.5 4-4 .5-3 2-3-2-4-.5-.5-4-2-3 2-3 .5-4 4-.5z"/><path d="M8 12l3 3 5-6"/>', Alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>' };
  const A = 'position:absolute;';
  const FT = "font-family:'Space Grotesk', Arial, sans-serif;";
  const etiqueta = (t, cor) => `<p style="${A}left:128px;top:128px;width:1300px;font-size:26px;font-weight:700;letter-spacing:4px;color:${cor || '#f5b83d'}">${t}</p>`;
  const titulo = (t, top, cor) => `<h2 style="${A}left:128px;top:${top || 176}px;width:1664px;${FT}font-size:72px;font-weight:700;line-height:1.1${cor ? ';color:' + cor : ''}">${t}</h2>`;
  const rodape = (t) => `<p style="${A}left:128px;bottom:64px;width:900px;font-size:24px;color:#8d8a82">${t}</p><p data-pag="1" style="${A}right:128px;bottom:64px;width:200px;font-size:24px;text-align:right;color:#8d8a82">01 / 01</p>`;
  const icone = (nome, cor, tam) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${cor};width:${tam}px;height:${tam}px;flex:none">${ICONES[nome]}</svg>`;
  const cartao = (x, ic, cor, t, d, n) => `<div ${n ? `data-build-in="pop ${n}" ` : ''}style="${A}left:${x}px;top:330px;width:534px;display:flex;flex-direction:column;gap:14px;background:#1d2130;padding:36px;border-radius:20px;border:1px solid rgba(255,255,255,0.12)">${icone(ic, cor, 56)}<h3 style="${FT}font-size:40px;font-weight:700">${t}</h3><p style="font-size:28px;line-height:1.3;color:#cfcbc0">${d}</p></div>`;
  const passo = (n, top, t, cl) => `<div data-build-in="rise ${cl}" style="${A}left:128px;top:${top}px;width:1664px;display:flex;align-items:center;gap:28px"><div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:#f5b83d;border-radius:50%"><p style="font-size:28px;font-weight:700;color:#12141c">${n}</p></div><p style="flex:1;font-size:34px">${t}</p></div>`;
  const RODAPE = 'Liga de Games Ceuma';
  const SLIDES = [
    { id: 'capa', nome: 'Capa', desc: 'Título grande, subtítulo e etiqueta.', fundo: '#12141c', cor: '#f3efe6',
      html: `<p style="${A}left:128px;top:128px;width:1200px;font-size:26px;font-weight:700;letter-spacing:4px;color:#f5b83d">LIGA ACADÊMICA DE GAMES · CEUMA</p>
<h1 style="${A}left:128px;top:340px;width:1560px;${FT}font-size:112px;font-weight:700;line-height:1.05">Título da aula</h1>
<p data-build-in="rise 1" style="${A}left:128px;top:740px;width:1300px;font-size:40px;line-height:1.3;color:#cfcbc0">Subtítulo: o que a turma vai fazer hoje</p>
<p data-build-in="rise 2" style="${A}left:128px;top:850px;width:560px;font-size:28px;font-weight:700;color:#12141c;background:#f5b83d;padding:14px 32px;border-radius:999px">Nível 1 · Aula</p>
${rodape(RODAPE)}` },
    { id: 'texto', nome: 'Título e texto', desc: 'Etiqueta, título e três linhas que aparecem uma a uma.', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('TEMA')}${titulo('Título do slide')}
<p data-build-in="rise 1" style="${A}left:128px;top:330px;width:1500px;font-size:44px;line-height:1.3">Primeira ideia, em uma frase curta.</p>
<p data-build-in="rise 2" style="${A}left:128px;top:450px;width:1500px;font-size:44px;line-height:1.3">Segunda ideia.</p>
<p data-build-in="rise 3" style="${A}left:128px;top:570px;width:1500px;font-size:44px;line-height:1.3">Terceira ideia.</p>
${rodape(RODAPE)}` },
    { id: 'cartoes', nome: '3 cartões', desc: 'Três blocos com ícone, título e frase.', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('TEMA')}${titulo('Três pontos importantes')}${cartao(128, 'Ideia', '#f5b83d', 'Ponto 1', 'Explique em uma frase', 1)}${cartao(693, 'Codigo', '#3ec9b0', 'Ponto 2', 'Explique em uma frase', 2)}${cartao(1258, 'Pessoas', '#ff9a8a', 'Ponto 3', 'Explique em uma frase', 3)}${rodape(RODAPE)}` },
    { id: 'passos', nome: 'Passos numerados', desc: 'Lista de passos com bolinhas numeradas.', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('PRÁTICA')}${titulo('Passo a passo', 176, '#f3efe6')}${passo(1, 300, 'Faça isto primeiro', 1)}${passo(2, 400, 'Depois faça isto', 2)}${passo(3, 500, 'Por fim, confira o resultado', 3)}${rodape(RODAPE)}` },
    { id: 'pergunta', nome: 'Pergunta', desc: 'Fundo amarelo com uma pergunta para a turma.', fundo: '#f5b83d', cor: '#14161f',
      html: `<p style="${A}left:1380px;top:40px;width:440px;${FT}font-size:640px;font-weight:700;line-height:1;color:#eaa526">?</p>
<p style="${A}left:128px;top:128px;width:1000px;font-size:26px;font-weight:700;letter-spacing:4px;color:#14161f">PERGUNTA</p>
<h1 style="${A}left:128px;top:260px;width:1380px;${FT}font-size:88px;font-weight:700;line-height:1.1">Escreva aqui a pergunta para a turma?</h1>
<p data-build-in="rise 1" style="${A}left:128px;top:660px;width:1200px;font-size:52px;font-weight:700">Pense por um minuto.</p>
<p style="${A}left:128px;bottom:64px;width:900px;font-size:24px;color:#14161f99">${RODAPE}</p><p data-pag="1" style="${A}right:128px;bottom:64px;width:200px;font-size:24px;text-align:right;color:#14161f99">01 / 01</p>` },
    { id: 'frase', nome: 'Frase de destaque', desc: 'Uma frase grande no centro.', fundo: '#12141c', cor: '#f3efe6',
      html: `<h1 style="${A}left:228px;top:380px;width:1464px;${FT}font-size:96px;font-weight:700;line-height:1.15;text-align:center">Uma frase para a turma lembrar</h1>${rodape(RODAPE)}` },
    { id: 'codigo', nome: 'Código', desc: 'Bloco de código para mostrar um exemplo (fonte monoespaçada).', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('CÓDIGO')}${titulo('Exemplo de código')}<div style="${A}left:128px;top:320px;width:1664px;height:470px;background:#0b0d13;border-radius:20px;border:1px solid rgba(255,255,255,0.12)"></div><pre data-build-in="rise 1" style="${A}left:176px;top:360px;width:1570px;margin:0;font-family:'JetBrains Mono', Consolas, monospace;font-size:36px;line-height:1.5;color:#3ec9b0;white-space:pre">func _ready():\n    print("Olá, Godot!")\n    # troque pelo seu código</pre><p style="${A}left:128px;top:830px;width:1664px;font-size:32px;color:#cfcbc0">Explique em uma frase o que o código faz.</p>${rodape(RODAPE)}` },
    { id: 'comparacao', nome: 'Comparação', desc: 'Dois lados lado a lado (antes/depois, certo/errado).', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('COMPARAÇÃO')}${titulo('A versus B')}<div style="${A}left:128px;top:330px;width:800px;height:520px;background:#1d2130;border-radius:20px;border-top:8px solid #3ec9b0"></div><h3 style="${A}left:176px;top:370px;width:700px;${FT}font-size:48px;font-weight:700;color:#3ec9b0">Lado A</h3><p data-build-in="rise 1" style="${A}left:176px;top:470px;width:704px;font-size:36px;line-height:1.4">Primeiro ponto do lado A.</p><p data-build-in="rise 2" style="${A}left:176px;top:590px;width:704px;font-size:36px;line-height:1.4">Segundo ponto do lado A.</p><div style="${A}left:992px;top:330px;width:800px;height:520px;background:#1d2130;border-radius:20px;border-top:8px solid #ff9a8a"></div><h3 style="${A}left:1040px;top:370px;width:700px;${FT}font-size:48px;font-weight:700;color:#ff9a8a">Lado B</h3><p data-build-in="rise 3" style="${A}left:1040px;top:470px;width:704px;font-size:36px;line-height:1.4">Primeiro ponto do lado B.</p><p data-build-in="rise 4" style="${A}left:1040px;top:590px;width:704px;font-size:36px;line-height:1.4">Segundo ponto do lado B.</p>${rodape(RODAPE)}` },
    { id: 'video', nome: 'Vídeo (marcador)', desc: 'Slide para anunciar um vídeo. O endereço fica no texto para o apresentador abrir.', fundo: '#12141c', cor: '#f3efe6',
      html: `${etiqueta('VÍDEO')}<div style="${A}left:128px;top:300px;width:1664px;height:520px;background:#0b0d13;border-radius:24px;border:1px solid rgba(255,255,255,0.12)"></div><div style="${A}left:860px;top:430px;width:200px;height:200px;display:flex;align-items:center;justify-content:center;background:#f5b83d;border-radius:50%"><svg viewBox="0 0 24 24" fill="#12141c" stroke="#12141c" stroke-width="1" style="width:90px;height:90px"><polygon points="8,5 19,12 8,19"/></svg></div><h2 style="${A}left:128px;top:680px;width:1664px;${FT}font-size:56px;font-weight:700;text-align:center">Título do vídeo</h2><p style="${A}left:128px;top:770px;width:1664px;font-size:32px;text-align:center;color:#cfcbc0">Endereço: cole aqui o link (abra em outra aba durante a aula)</p>${rodape(RODAPE)}` },
    { id: 'branco', nome: 'Em branco', desc: 'Só o fundo. Monte com os botões acima do slide.', fundo: '#12141c', cor: '#f3efe6', html: rodape(RODAPE) },
  ];
  const ELEMENTOS = {
    etiqueta: () => etiqueta('ETIQUETA').replace('left:128px;top:128px', 'left:128px;top:128px'),
    titulo: () => titulo('Novo título', 300),
    texto: () => `<p style="${A}left:128px;top:420px;width:1200px;font-size:40px;line-height:1.3">Escreva seu texto aqui</p>`,
    caixa: () => `<div style="${A}left:200px;top:300px;width:500px;height:260px;background:#1d2130;border-radius:20px;border:1px solid rgba(255,255,255,0.12)"></div>`,
    cartao: () => `<div style="${A}left:128px;top:330px;width:534px;display:flex;flex-direction:column;gap:14px;background:#1d2130;padding:36px;border-radius:20px;border:1px solid rgba(255,255,255,0.12)"><h3 style="${FT}font-size:40px;font-weight:700">Título do cartão</h3><p style="font-size:28px;line-height:1.3;color:#cfcbc0">Texto do cartão</p></div>`,
    numero: () => `<div style="${A}left:128px;top:400px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:#f5b83d;border-radius:50%"><p style="font-size:28px;font-weight:700;color:#12141c">1</p></div>`,
    pilula: () => `<p style="${A}left:128px;top:500px;width:420px;font-size:28px;font-weight:700;color:#12141c;background:#f5b83d;padding:14px 32px;border-radius:999px;text-align:center">Etiqueta</p>`,
    icone: (nome) => `<div style="${A}left:200px;top:400px;width:96px;height:96px">${icone(nome || 'Estrela', '#f5b83d', 96)}</div>`,
  };
  const api = { SLIDES, ELEMENTOS, ICONES };
  if (typeof module !== 'undefined') module.exports = api; else g.EditorModelos = api;
})(typeof window !== 'undefined' ? window : globalThis);
