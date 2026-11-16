'use strict';
// Crônica da corrida (pré-temporada do jogo). Um narrador conta o que acontece na Copa: fatos reais (itens, alianças, eventos)
// e acontecimentos de pista (armadilhas, NPCs, fenômenos), que por enquanto só têm história, sem efeito em pontos.
// Os registros ficam em dados/cronica/<chave da Copa>.json e viram o roteiro do jogo futuro.
const crypto = require('crypto');
const u = require('./util'); const d = require('./dados'); const C = require('./copa'); const CA = require('./copaapi');
const NOME_JOGO = 'Spin Run LAG'; // nome de trabalho: trocar só aqui
const caminho = (chave) => `dados/cronica/${chave}.json`;
const TRECHOS = ['Planície dos Sprites', 'Floresta dos Shaders', 'Deserto dos Bugs', 'Rio do Loop Infinito', 'Montanha do Commit', 'Vale dos Pixels', 'Cânion do Cache', 'Pântano do Lag', 'Cidade das Engrenagens', 'Ponte do Game Over', 'Planalto dos Checkpoints', 'Costa dos Respawns'];
// Catálogo: tipo, ícone, nome, etiquetas (para as fraquezas e vantagens dos stands, nas próximas fases) e texto. {piloto} = aluno sorteado.
const EVENTOS = [
  // armadilhas de trecho
  { id: 'areia', tipo: 'armadilha', ic: '🏜️', nome: 'Areia movediça', tags: ['areia'], txt: 'Um trecho de areia movediça surgiu do nada! Os pilotos atravessaram devagar, olhando para os próprios pés. Ninguém afundou... por pouco.' },
  { id: 'ponte', tipo: 'armadilha', ic: '🌉', nome: 'Ponte bamba', tags: ['altura'], piloto: true, txt: 'A ponte de madeira estalou sob {piloto}, que atravessou na ponta dos pés, segurando a respiração. Passou! A ponte, não tanto.' },
  { id: 'espinhos', tipo: 'armadilha', ic: '🌵', nome: 'Campo de espinhos de pixel', tags: ['espinhos'], txt: 'Pixels pontudos brotaram do chão! Os pilotos desviaram em zigue-zague, e alguém jura que ouviu a pista rindo.' },
  { id: 'pedras', tipo: 'armadilha', ic: '🪨', nome: 'Chuva de pedras', tags: ['montanha'], txt: 'Pedras despencaram da encosta! Foi um sobe e desce de capacetes. Ninguém se feriu, mas houve muito grito.' },
  { id: 'cipo', tipo: 'armadilha', ic: '🌿', nome: 'Cipó traiçoeiro', tags: ['floresta'], piloto: true, txt: 'Um cipó enroscou na bota de {piloto}, que ficou de cabeça para baixo por alguns segundos até se soltar. A dignidade ficou intacta, quase.' },
  { id: 'gelo', tipo: 'armadilha', ic: '🧊', nome: 'Poça de gelo', tags: ['frio'], txt: 'Uma placa de gelo apareceu na curva! Houve pilotos deslizando de lado, de olhos arregalados, e um aplauso discreto da plateia.' },
  { id: 'lama', tipo: 'armadilha', ic: '🟤', nome: 'Estrada de lama', tags: ['lama'], piloto: true, txt: 'A estrada virou lama e {piloto} perdeu uma bota. Seguiu de meia, com a cabeça erguida e muita lama no resto.' },
  { id: 'labirinto', tipo: 'armadilha', ic: '🌀', nome: 'Labirinto de cercas', tags: ['confusao'], txt: 'Cercas surgiram em todas as direções! Os pilotos acharam a saída seguindo o barulho de quem já tinha saído.' },
  // NPCs hostis
  { id: 'bandido', tipo: 'npc', ic: '🕵️', nome: 'Bandido do Chapéu Torto', tags: ['multidao'], piloto: true, txt: 'O Bandido do Chapéu Torto tentou cobrar pedágio de {piloto}, que respondeu mostrando o crachá de piloto. O bandido saiu confuso, tropeçando no próprio chapéu.' },
  { id: 'corvo', tipo: 'npc', ic: '🐦‍⬛', nome: 'Corvo Ladrão', tags: ['ar'], piloto: true, txt: 'Um corvo ladrão mergulhou e levou o lanche de {piloto}. Só o lanche! O piloto prometeu vingança com muita calma.' },
  { id: 'golem', tipo: 'npc', ic: '🗿', nome: 'Golem de Pedra', tags: ['montanha', 'barulho'], txt: 'O Golem de Pedra bloqueou a estrada e só saiu quando os pilotos aprenderam a dizer "com licença" no tom certo. Foi educativo.' },
  { id: 'fantasma', tipo: 'npc', ic: '👻', nome: 'Fantasma da Estrada', tags: ['escuridao'], txt: 'O Fantasma da Estrada passou sussurrando "chegou o prazo..." e deu um arrepio coletivo. Quem já entregou nem ouviu.' },
  { id: 'lobos', tipo: 'npc', ic: '🐺', nome: 'Matilha de Pixelobos', tags: ['floresta', 'barulho'], txt: 'Uma matilha de lobos de pixel cercou a trilha, mas só queria brincar de buscar o graveto. Os pilotos jogaram, e os lobos foram felizes.' },
  { id: 'pedagio', tipo: 'npc', ic: '🚧', nome: 'Pedágio Fantasma', tags: ['multidao'], txt: 'Um pedágio apareceu no meio do nada, cobrando "um sorriso por piloto". Todos pagaram, e a cancela subiu envergonhada.' },
  // NPCs aliados
  { id: 'mecanico', tipo: 'aliado', ic: '🔧', nome: 'Mecânico Itinerante', tags: ['maquina'], piloto: true, txt: 'Um mecânico itinerante ajustou a engrenagem do veículo de {piloto} de graça. Disse apenas: "Boa sorte, piloto".' },
  { id: 'cartografa', tipo: 'aliado', ic: '🗺️', nome: 'Cartógrafa Misteriosa', tags: ['mapa'], txt: 'Uma cartógrafa misteriosa vendeu mapas a preço de bala. Os pilotos descobriram que o mapa tinha um atalho. Ou uma pegadinha. Ninguém sabe ainda.' },
  { id: 'curandeira', tipo: 'aliado', ic: '🩹', nome: 'Curandeira da Vila', tags: ['cura'], txt: 'A curandeira da vila ofereceu chá a todos os pilotos. Todos beberam, e a corrida continuou mais animada.' },
  { id: 'cozinheiro', tipo: 'aliado', ic: '🍲', nome: 'Cozinheiro Ambulante', tags: ['comida'], piloto: true, txt: 'Um cozinheiro ambulante serviu uma sopa quentinha para {piloto} e para quem passasse na fila. O cheiro rendeu três paradas não planejadas.' },
  { id: 'bardo', tipo: 'aliado', ic: '🎻', nome: 'Bardo Cronista', tags: ['som'], txt: 'Um bardo cantou a história da corrida até agora, e vários pilotos descobriram que são personagens muito melhores do que imaginavam.' },
  { id: 'carroceiro', tipo: 'aliado', ic: '🛒', nome: 'Carroceiro Gentil', tags: ['maquina'], piloto: true, txt: 'Um carroceiro gentil deu carona a {piloto} por um quilômetro e ainda contou três fofocas da pista. Valeu cada metro.' },
  // fenômenos
  { id: 'tempestade', tipo: 'fenomeno', ic: '⛈️', nome: 'Tempestade', tags: ['agua', 'raio'], txt: 'Uma tempestade fechou o céu! Os pilotos trocaram o chapéu por capa de chuva, e a pista virou um espelho de água.' },
  { id: 'neblina', tipo: 'fenomeno', ic: '🌫️', nome: 'Neblina espessa', tags: ['escuridao', 'confusao'], txt: 'A neblina cobriu tudo. Os pilotos andaram de mãos dadas por precaução, e alguém ficou conversando com um poste por dez minutos.' },
  { id: 'eclipse', tipo: 'fenomeno', ic: '🌘', nome: 'Eclipse na pista', tags: ['escuridao'], txt: 'O sol sumiu atrás da lua! A pista ficou na penumbra e os vaga-lumes aproveitaram para fazer um showzinho.' },
  { id: 'vento', tipo: 'fenomeno', ic: '💨', nome: 'Ventania', tags: ['vento', 'ar'], txt: 'Uma ventania varreu o trecho! Os chapéus foram embora, os mapas viraram pipa, e os pilotos riram de si mesmos.' },
  { id: 'aurora', tipo: 'fenomeno', ic: '🌌', nome: 'Aurora sobre a pista', tags: ['luz'], txt: 'Uma aurora iluminou o céu e os pilotos pararam para olhar. Foi a primeira vez que a corrida ficou em silêncio.' },
  { id: 'calor', tipo: 'fenomeno', ic: '🔥', nome: 'Onda de calor', tags: ['calor'], txt: 'O sol apertou, e os pilotos passaram a corrida procurando sombra. Quem tinha guarda-chuva virou celebridade.' },
  // situações inusitadas
  { id: 'gato', tipo: 'inusitado', ic: '🐈', nome: 'O gato gigante', tags: ['mapa'], piloto: true, txt: 'Um gato gigante sentou em cima do mapa de {piloto} e não saiu mais. Disse, em miado claro, que estava confortável.' },
  { id: 'patos', tipo: 'inusitado', ic: '🦆', nome: 'Invasão de patos de borracha', tags: ['agua', 'barulho'], txt: 'Um bando de patos de borracha invadiu a pista, fazendo "quá" em coro. A corrida parou por um minuto para um momento de respeito.' },
  { id: 'placa', tipo: 'inusitado', ic: '🪧', nome: 'Placa trocada', tags: ['confusao'], txt: 'Alguém trocou a placa da bifurcação, e metade dos pilotos foi parar na Rua dos Atalhos Inúteis. Voltaram, mas com histórias.' },
  { id: 'relogio', tipo: 'inusitado', ic: '⏰', nome: 'O relógio travou', tags: ['tempo'], txt: 'O relógio da pista parou por cinco minutos. Os pilotos ficaram parados, olhando uns para os outros, até que ele voltou como se nada tivesse acontecido.' },
  { id: 'semaforo', tipo: 'inusitado', ic: '🚦', nome: 'Semáforo no meio do nada', tags: ['maquina'], txt: 'Um semáforo apareceu no meio do deserto. Ficou vermelho por 30 segundos e todos esperaram, porque ninguém sabe o que acontece quando ignora.' },
  { id: 'eco', tipo: 'inusitado', ic: '📣', nome: 'Eco misterioso', tags: ['som'], piloto: true, txt: 'Um eco misterioso repetiu o que {piloto} disse, só que um pouco mais alto, e depois um pouco mais alto ainda. A pista inteira ficou ouvindo, sem saber de onde vinha.' },
];
// Realidade atual do mundo. Para uma temática nova no futuro, basta criar outra realidade e apontar REALIDADE_ATUAL para ela:
// os registros antigos continuam na crônica, e a nova história começa por cima.
const REALIDADES = {
  distorcao: {
    nome: 'A Grande Distorção', ic: '🌀',
    atos: [{ de: 1, nome: 'Ato I · A Pista de Brinquedo' }, { de: 4, nome: 'Ato II · O Sussurro' }, { de: 6, nome: 'Ato III · A Grande Corrida' }],
    capitulos: [
      { n: 1, nome: 'O dia em que a Liga sumiu', txt: 'Era um dia comum de aula. De repente, todos os computadores piscaram ao mesmo tempo e a tela ficou branca. Quando a cor voltou, a sala tinha sumido. No lugar dela, uma pista de corrida de brinquedo se estendia até o horizonte, com uma placa torta: "Bem-vindos à Copa". A Liga inteira havia sido sugada para um mundo paralelo. Ninguém sabe por quê. Todos sabem o que fazer: correr.' },
      { n: 2, nome: 'As regras que ninguém escreveu', txt: 'Os pilotos descobriram que o mundo tem regras próprias: itens caem do céu, o dado decide quem acerta e quem erra, e um Chefão acorda toda semana de mau humor. Parece um jogo de kart, daqueles em que ninguém leva nada a sério. Mas o horizonte tem um brilho esquisito, como se algo estivesse só esperando a gente baixar a guarda.' },
      { n: 3, nome: 'Rachaduras no céu', txt: 'À noite, apareceram rachaduras no céu, e dentro delas dava para ler linhas de código correndo. O mundo está sendo reescrito, e a cada madrugada a pista fica um pouco mais longa. O Bardo Cronista cantou uma única frase antes de desaparecer: "Isto nunca foi só um passeio".' },
      { n: 4, nome: 'O sussurro', txt: 'Alguns pilotos juram ter visto uma silhueta atrás de si, repetindo cada gesto com um segundo de atraso. Os mais velhos da pista dão um nome ao fenômeno: Stand. Dizem que ele só obedece a quem aprende a escutá-lo, e que cada piloto ouve um sussurro diferente.' },
      { n: 5, nome: 'A verdadeira linha de largada', txt: 'O Chefão finalmente falou: a Copa de brinquedo era só o aquecimento. A corrida de verdade cruza o mundo inteiro, trecho por trecho, do Deserto dos Bugs até a Costa dos Respawns. Quem chegar à última linha poderá pedir ao mundo uma coisa: voltar ao normal, ou ser reescrito do jeito que o vencedor quiser.' },
      { n: 6, nome: 'Etapa por etapa', txt: 'A partir de agora, cada semana é uma etapa. Os pilotos vão atravessar trechos cada vez mais estranhos, enfrentar o que a pista inventar e descobrir o que o sussurro quer dizer. A pista de brinquedo ficou para trás. Ajustem os capacetes: a Spin Run LAG começou.' },
    ],
  },
};
const REALIDADE_ATUAL = 'distorcao';
// Gritos de batalha: a narração berra durante ataques e defesas (originais, no espírito dos gritos de anime de luta).
const GRITOS = {
  ataque: ['PIXEL PIXEL PIXEL PIXEL PIXEL!', 'BUG BUG BUG BUG BUG!', 'LOOP LOOP LOOP LOOP LOOP!', 'COMMIT COMMIT COMMIT COMMIT!', 'DEPLOY DEPLOY DEPLOY DEPLOY!', 'LAG LAG LAG LAG LAG!', 'SPAWN SPAWN SPAWN SPAWN!'],
  defesa: ['ROLLBACK! ROLLBACK! ROLLBACK!', 'FIREWALL! FIREWALL!', 'NÃO PASSA! NÃO PASSA! NÃO PASSA!', 'CTRL+Z! CTRL+Z! CTRL+Z!'],
  falha: ['ERRO 404... DADO NÃO ENCONTRADO!', 'NULL POINTER... NA CARA!', 'O DADO CAIU PARA O LADO, E O PILOTO TAMBÉM!'],
  chefao: ['O CHEFÃO ACORDOU! TREMAM, PILOTOS!', 'SEU TEMPO ACABOU... DE COMPILAR!', 'CHEFÃO! CHEFÃO! CHEFÃO!'],
};
// Gerador de acontecimentos: combina trecho, ocorrência, reação e desfecho, para não ficar repetitivo (centenas de combinações, além do catálogo fixo).
const OCORR = {
  armadilha: ['uma armadilha de pixels quebrados', 'um fosso coberto de comentários inúteis', 'um laço infinito disfarçado de estrada', 'uma cerca elétrica de variáveis globais', 'um tapete de erros de sintaxe', 'um alçapão de parênteses sem par', 'um portão trancado com cadeado de recursão', 'uma rampa de cache vencido'],
  npc: ['um mercador de patches duvidosos', 'uma sombra com crachá de estagiária', 'um robô de manutenção perdido', 'uma raposa que vende atalhos', 'um vigia sonolento do checkpoint', 'um cavaleiro de armadura de plástico bolha', 'uma criança prodígio de mochila gigante', 'um viajante que só fala em perguntas'],
  fenomeno: ['uma chuva de semicolons', 'uma nuvem de sprites perdidos', 'um vento que sopra de trás para frente', 'uma maré de luz azul', 'um pôr do sol de 16 bits', 'uma onda de lag que deixou tudo em câmera lenta', 'um tremor que embaralhou os mapas', 'uma tempestade de confetes de debug'],
};
const REACAO = ['Os pilotos pararam, trocaram olhares e decidiram fingir que era normal.', 'Houve um segundo de silêncio, seguido de um grito coletivo.', 'Alguém sugeriu voltar atrás. Ninguém voltou.', 'Um piloto anotou tudo num caderninho, só por precaução.', 'A plateia invisível aplaudiu, sem que ninguém soubesse de onde.', 'A maioria riu. Os outros riram depois.', 'Dois pilotos apostaram quem sairia primeiro. Os dois perderam.', 'O Bardo Cronista, escondido num arbusto, já estava compondo a música.'];
const DESFECHO = ['No fim, todo mundo passou, com histórias novas para contar.', 'Ninguém se feriu, mas o orgulho de alguns ficou com um arranhão.', 'O trecho cobrou seu preço em chapéus, lanches e dignidade.', 'A pista, satisfeita, voltou ao normal. Por enquanto.', 'Quem estava atento ouviu a pista sussurrar: "isso foi só o aquecimento".', 'Os pilotos seguiram viagem, um pouco mais espertos.', 'O Chefão, de longe, anotou o nome de todo mundo.', 'E assim a etapa continuou, como se nada tivesse acontecido.'];
const PORTA = { armadilha: 'Armadilha', npc: 'NPC hostil', aliado: 'NPC aliado', fenomeno: 'Fenômeno', inusitado: 'Inusitado' };
function gerar(chave, dia, trecho, recentes) {
  const tipos = ['armadilha', 'npc', 'fenomeno']; const h0 = hash(`${chave}|${dia}|g`); const tipo = tipos[h0 % 3];
  const lista = OCORR[tipo]; let i = (h0 >>> 3) % lista.length; const rec = new Set(recentes);
  for (let k = 0; k < lista.length && rec.has('g:' + tipo + i); k++) i = (i + 1) % lista.length;
  const r = REACAO[(h0 >>> 7) % REACAO.length], f = DESFECHO[(h0 >>> 11) % DESFECHO.length];
  const ic = { armadilha: '🪤', npc: '🧙', fenomeno: '✨' }[tipo]; const nome = { armadilha: 'Armadilha na pista', npc: 'Encontro na estrada', fenomeno: 'Fenômeno estranho' }[tipo];
  return { id: 'g:' + tipo + i, tipo, ic, nome, tags: [tipo], txt: `Em ${trecho}, os pilotos toparam com ${lista[i]}. ${r} ${f}` };
}
const hojeBR = (agora) => new Date(agora - 3 * 36e5).toISOString().slice(0, 10);
const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);
const trechoDe = (inicio, agora) => TRECHOS[(Math.max(1, C.semanaDe(inicio, agora)) - 1) % TRECHOS.length];
function montar(ev, piloto, agora, inicio, origem) {
  const txt = ev.txt.replace(/\{piloto\}/g, piloto ? '@' + piloto : 'um piloto');
  return { id: crypto.randomBytes(4).toString('hex'), em: new Date(agora).toISOString(), tipo: ev.tipo, ic: ev.ic, nome: ev.nome, texto: txt, tags: ev.tags, trecho: trechoDe(inicio, agora), origem: origem || 'sorteio', ...(piloto ? { piloto } : {}) };
}
// Sorteia o acontecimento do dia, de forma determinística (mesma data e chave dão o mesmo resultado), sem repetir os últimos 8.
// Metade dos dias vem do catálogo fixo e metade do gerador, para a variedade ser grande.
function sortear(chave, dia, recentes, trecho) {
  if (trecho && hash(`${chave}|${dia}|m`) % 2) return gerar(chave, dia, trecho, recentes);
  const livres = EVENTOS.filter((e) => !recentes.includes(e.id)); const lista = livres.length ? livres : EVENTOS;
  return lista[hash(`${chave}|${dia}`) % lista.length];
}
const gr = (k, sem) => { const l = GRITOS[k]; return l[hash(sem) % l.length]; };
// Fatos reais da Copa (log) em frases de narrador de luta. O autor dos ataques continua em segredo, como no jogo.
// rot(k) devolve o rótulo do piloto (ex.: "Afonso (afonsofarias)").
function fatos(est, agora, dias, rot) {
  const ini = agora - dias * 864e5, out = []; const nm = (k) => (k === 'chefao' ? 'O Chefão' : (rot ? rot(k) : '@' + k));
  for (const l of (est.log || [])) {
    const em = new Date(l.em).getTime(); if (!(em >= ini)) continue;
    const it = C.ITENS[l.item] || C.BOSS[l.item] || null; const base = { em: l.em, tipo: 'fato' }; const sem = `${l.em}|${l.item}|${l.vit || ''}`;
    if (l.evento === 'alianca' || (l.item === 'alianca' && !l.traicao && l.evento !== 'traicao')) out.push({ ...base, ic: '🤝', nome: 'Aliança', texto: `Uma aliança nasceu entre ${nm(l.de)} e ${nm(l.para)}. Dois pilotos, um só caminho! A pista nunca viu uma dupla tão decidida!` });
    else if (l.traicao || l.evento === 'traicao') out.push({ ...base, ic: '🗡️', nome: 'Traição', texto: 'E então... a aliança se partiu! Alguém olhou para o lado e viu a oportunidade. Quem foi? A pista guarda segredo, mas jamais esquece.' });
    else if (l.item === 'evento' && C.EVENTOS[l.evento]) out.push({ ...base, ic: C.EVENTOS[l.evento].ic, nome: C.EVENTOS[l.evento].nome, texto: `${C.EVENTOS[l.evento].nome} cobre a pista! ${C.EVENTOS[l.evento].txt}` });
    else if (l.item === 'missao') out.push({ ...base, ic: '🎯', nome: 'Missão cumprida', texto: 'A missão coletiva foi cumprida! Todo mundo entregou no prazo e os itens choveram sobre a pista.' });
    else if (l.item === 'chuva-professor') out.push({ ...base, ic: '🌧️', nome: 'Chuva de itens', texto: 'O céu se abriu e uma chuva de itens caiu sobre os pilotos! Quem estava com as mãos livres aproveitou.' });
    else if (l.de === 'roleta' && l.para) out.push({ ...base, ic: '🎰', nome: 'Roleta maluca', texto: `A Roleta maluca girou, girou, girou... e parou em ${nm(l.para)}! Jogo de sorte, e o destino adora uma surpresa.` });
    else if (l.faixa && it) {
      const vit = l.vit ? nm(l.vit) : ''; const boss = l.de === 'chefao';
      if (l.faixa === 'falha_critica' || l.faixa === 'falha') out.push({ ...base, ic: '🎲', nome: 'Dado falhou', texto: boss ? `${gr('falha', sem)} O Chefão tentou usar ${it.ic} ${it.nome}, mas o dado não ajudou. Até o chefe erra!` : `${gr('falha', sem)} Alguém tentou usar ${it.ic} ${it.nome}, mas o dado não ajudou. Respeitem o azar do piloto!` });
      else if (l.bloq && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', texto: `${gr('defesa', sem)} ${vit} levantou o escudo bem na hora e bloqueou ${it.ic} ${it.nome}!` });
      else if (l.red && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', texto: `${gr('defesa', sem)} O escudo de ${vit} amorteceu ${it.ic} ${it.nome}. Doeu menos do que podia!` });
      else if (vit && l.vit !== l.de) out.push({ ...base, ic: boss ? '👹' : '🎯', nome: boss ? 'Chefão ataca' : 'Ataque', texto: boss ? `${gr('chefao', sem)} Ele mandou ${it.ic} ${it.nome} em ${vit}!` : `${gr('ataque', sem)} ${vit} foi atingido por ${it.ic} ${it.nome}! Quem mandou? Segredo de Estado! 🕵️` });
    }
  }
  return out;
}
async function lerArquivo(chave) { const { dados } = await d.lerJson(caminho(chave)); return dados && typeof dados === 'object' ? dados : { entradas: [], dias: {} }; }
const gravar = (chave, mudar, msg) => d.mudarJson(caminho(chave), (cur) => { const x = cur && typeof cur === 'object' ? cur : {}; x.entradas = Array.isArray(x.entradas) ? x.entradas : []; x.dias = x.dias && typeof x.dias === 'object' ? x.dias : {}; const r = mudar(x); x.entradas = x.entradas.slice(-200); return r || x; }, msg);
const CACHE = new Map(); const TTL = 60000; const INFO = new Map(); const TTL_INFO = 120000;
const MODOS = ['participa', 'owners', 'fora'];
// Participação no jogo, por Copa (trilha): "participa" (alunos veem), "owners" (só donos, para testes ou uso institucional) ou "fora".
// Padrão: trilhas participam; Copas sem trilha (ex.: Roteiro institucional) ficam só para owners.
const modoDe = (est, cx) => (MODOS.includes(est.jogo) ? est.jogo : (cx.plano ? 'participa' : 'owners'));
async function infoDe(cx) {
  const c = INFO.get(cx.chave); if (c && Date.now() - c.em < TTL_INFO) return c;
  const est = C.normalizar(await CA.lerEstado(cx)); const r = { em: Date.now(), modo: modoDe(est, cx), ativa: est.ativa, vis: est.visibilidade, est };
  INFO.set(cx.chave, r); return r;
}
async function copasDe(cfg, usuario, dono, monitor, turmaOk) {
  const vis = new Map(); const staff = dono || !!monitor;
  for (const [id, t] of Object.entries(cfg.turmas || {})) {
    if (t.status === 'arquivada') continue;
    const aluno = (t.alunos || []).includes(usuario); if (!aluno && !(staff && turmaOk(id))) continue;
    const cx = CA.contexto(cfg, id); if (!vis.has(cx.chave)) vis.set(cx.chave, { turma: id, nome: cx.plano ? (cx.plano.trilha || cx.plano.nome) : t.nome, aluno, cx });
    else if (aluno) vis.get(cx.chave).aluno = true;
  }
  const out = [];
  for (const c of vis.values()) {
    const inf = await infoDe(c.cx); if (!inf.ativa) continue;
    const aberta = inf.modo === 'participa' && inf.vis !== 'oculta';
    if (dono || (aberta && (c.aluno || monitor))) out.push({ turma: c.turma, nome: c.nome, modo: inf.modo, aluno: c.aluno, cx: c.cx, aberta });
  }
  return out;
}
const pub = (c) => ({ turma: c.turma, nome: c.nome, modo: c.modo });
const rotuloDe = (nomes) => (k) => { const n = String(nomes[k] || '').trim().split(/\s+/)[0]; return n ? `${n[0].toUpperCase()}${n.slice(1).toLowerCase()} (${k})` : '@' + k; };
function atoDe(sem) { const R = REALIDADES[REALIDADE_ATUAL]; let a = R.atos[0]; for (const x of R.atos) if (sem >= x.de) a = x; return a.nome; }
const semMundo = (criado, agora) => Math.max(1, Math.floor((agora - new Date(criado).getTime()) / (7 * 864e5)) + 1);
async function lerGeral(copas, agora, dono) {
  const R = REALIDADES[REALIDADE_ATUAL]; const part = copas.filter((c) => c.modo === 'participa');
  const alunos = [...new Set(part.flatMap((c) => (c.cx.t.alunos || [])))].filter((a) => !/^ficticio-/.test(a)).sort();
  let arq = await lerArquivo('mundo'); const dia = hojeBR(agora);
  if (part.length && (!arq.criado || !arq.dias[dia] || (arq.caps || 0) < Math.min(R.capitulos.length, semMundo(arq.criado, agora)))) {
    arq = await gravar('mundo', (x) => {
      if (!x.criado) x.criado = new Date(agora).toISOString();
      const sem = semMundo(x.criado, agora); const liberados = Math.min(R.capitulos.length, sem);
      for (let n = (x.caps || 0) + 1; n <= liberados; n++) { const cap = R.capitulos[n - 1]; x.entradas.push({ id: 'cap' + n, em: new Date(new Date(x.criado).getTime() + (n - 1) * 7 * 864e5).toISOString(), tipo: 'capitulo', ic: '📖', nome: `Capítulo ${n} · ${cap.nome}`, texto: cap.txt, origem: 'historia' }); x.caps = n; }
      if (!x.dias[dia] && alunos.length) {
        const recentes = x.entradas.slice(-8).map((e) => e.evId).filter(Boolean); const trecho = TRECHOS[(sem - 1) % TRECHOS.length];
        const ev = sortear('mundo', dia, recentes, trecho); const piloto = ev.piloto ? alunos[hash(`mundo|${dia}|p`) % alunos.length] : '';
        const e = montar(ev, piloto, agora, new Date(x.criado).toISOString().slice(0, 10), 'sorteio'); e.evId = ev.id; e.piloto = piloto || undefined; x.entradas.push(e); x.dias[dia] = e.id;
      }
      return x;
    }, 'Crônica do mundo: capítulo e acontecimento do dia');
  }
  const sem = arq.criado ? semMundo(arq.criado, agora) : 1;
  return { arq, sem, alunos, cab: `${R.ic} ${R.nome} · ${atoDe(sem)} · ${TRECHOS[(sem - 1) % TRECHOS.length]}` };
}
async function ler(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const q = req.query || {}; const agora = Date.now(); const staff = dono || !!monitor;
  const copas = await copasDe(cfg, usuario, dono, monitor, turmaOk);
  if (!copas.length) return u.json(res, 200, { jogo: NOME_JOGO, semCopa: true });
  const pedido = String(q.turma || '').toUpperCase(); const alvo = copas.find((c) => c.turma === pedido);
  const vista = alvo ? 'trilha' : 'geral';
  const ck = (alvo ? alvo.cx.chave : 'mundo') + '|' + (dono ? 'd' : staff ? 's' : 'a') + '|' + (dono ? 'x' : usuario); const c = CACHE.get(ck);
  const base = { jogo: NOME_JOGO, vista, copas: copas.map(pub), tipos: { ...PORTA, capitulo: 'História', fato: 'Fato' } };
  if (c && agora - c.em < TTL) return u.json(res, 200, { ...base, ...c.resp });
  let resp;
  if (vista === 'geral') {
    const g = await lerGeral(copas, agora, dono);
    const nomes = await CA.nomesDa(g.alunos); const rot = rotuloDe(nomes);
    const lista = (g.arq.entradas || []).map((e) => ({ em: e.em, tipo: e.tipo, ic: e.ic, nome: e.nome, texto: e.piloto ? e.texto.split('@' + e.piloto).join(rot(e.piloto)) : e.texto, origem: e.origem })).sort((a, b) => new Date(b.em) - new Date(a.em)).slice(0, 40);
    resp = { cabecalho: g.cab, entradas: lista, alvo: 'geral' };
  } else {
    const cx = alvo.cx; const t = cx.t; const est = (await infoDe(cx)).est;
    const arq = await lerArquivo(cx.chave); const nomes = await CA.nomesDa((t.alunos || []).filter((a) => !/^ficticio-/.test(a))); const rot = rotuloDe(nomes);
    const lista = [...(arq.entradas || []).filter((e) => e.origem === 'professor').map((e) => ({ em: e.em, tipo: e.tipo, ic: e.ic, nome: e.nome, texto: e.piloto ? e.texto.split('@' + e.piloto).join(rot(e.piloto)) : e.texto, origem: e.origem })), ...fatos(est, agora, 7, rot)]
      .sort((a, b) => new Date(b.em) - new Date(a.em)).slice(0, 40);
    resp = { cabecalho: `${alvo.nome} · etapa ${C.semanaDe(t.inicio, agora) || 1}`, entradas: lista, alvo: alvo.turma };
  }
  resp.catalogo = dono ? EVENTOS.map((e) => ({ id: e.id, nome: e.nome, ic: e.ic, tipo: e.tipo })) : undefined;
  resp.atualizado = new Date(agora).toISOString();
  CACHE.set(ck, { em: agora, resp });
  return u.json(res, 200, { ...base, ...resp });
}
// O professor dispara um acontecimento (um do catálogo ou sorteado) no mundo (Geral). No máximo 5 por dia, para não encher a crônica.
async function disparar(res, b, { cfg, dono, turmaOk }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor dispara acontecimentos.' });
  const agora = Date.now(); const dia = hojeBR(agora); const copas = await copasDe(cfg, '', true, false, turmaOk);
  const alunos = [...new Set(copas.filter((c) => c.modo === 'participa').flatMap((c) => c.cx.t.alunos || []))].filter((a) => !/^ficticio-/.test(a));
  let ev = EVENTOS.find((e) => e.id === String(b.evento || '')); if (!ev) ev = EVENTOS[crypto.randomInt(EVENTOS.length)];
  const piloto = ev.piloto && alunos.length ? alunos[crypto.randomInt(alunos.length)] : ''; let aviso = '';
  await gravar('mundo', (x) => {
    if (!x.criado) x.criado = new Date(agora).toISOString();
    const hoje = x.entradas.filter((e) => e.origem === 'professor' && hojeBR(new Date(e.em).getTime()) === dia).length;
    if (hoje >= 5) { aviso = 'Já foram disparados 5 acontecimentos hoje. Amanhã tem mais.'; return x; }
    const e = montar(ev, piloto, agora, x.criado.slice(0, 10), 'professor'); e.evId = ev.id; x.entradas.push(e); return x;
  }, 'Crônica do mundo: acontecimento disparado por professor');
  if (aviso) return u.json(res, 400, { erro: aviso });
  CACHE.clear();
  return u.json(res, 200, { ok: true, resultado: `${ev.ic} ${ev.nome}` });
}
function limparCache() { CACHE.clear(); INFO.clear(); }
module.exports = { ler, disparar, EVENTOS, NOME_JOGO, fatos, sortear, gerar, TRECHOS, REALIDADES, REALIDADE_ATUAL, GRITOS, MODOS, modoDe, limparCache };
