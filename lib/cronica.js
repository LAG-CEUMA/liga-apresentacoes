'use strict';
const GP = require('./golpes');
// Crônica da corrida (pré-temporada do jogo). Um narrador conta o que acontece na Copa: fatos reais (itens, alianças, eventos)
// e acontecimentos de pista (armadilhas, NPCs, fenômenos), que por enquanto só têm história, sem efeito em pontos.
// Os registros ficam em dados/cronica/<chave da Copa>.json e viram o roteiro do jogo futuro.
const crypto = require('crypto');
const u = require('./util'); const d = require('./dados'); const C = require('./copa'); const CA = require('./copaapi');
const NOME_JOGO = 'Spin Run LAG'; // nome de trabalho: trocar só aqui
const caminho = (chave) => `dados/cronica/${chave}.json`;
const TRECHOS = ['Planície do Primeiro Galope', 'Deserto dos Bugs', 'Cânion dos Ecos', 'Rio Barrento', 'Cidade Fantasma de Cinzas', 'Pradaria dos Cataventos', 'Montanha da Forca', 'Pântano das Serpentes', 'Estação do Último Trem', 'Mina do Eco Surdo', 'Vale dos Cactos Falantes', 'Costa da Poeira Vermelha'];
// Catálogo: tipo, ícone, nome, etiquetas (para as fraquezas e vantagens dos stands, nas próximas fases) e texto. {piloto} = aluno sorteado.
const EVENTOS = [
  // armadilhas de trecho
  { id: 'areia', tipo: 'armadilha', ic: '🏜️', nome: 'Areia movediça', tags: ['areia'], txt: 'A terra vermelha engoliu os cascos até o joelho. Os pilotos avançaram devagar, sem respirar. Ninguém afundou. Por pouco.' },
  { id: 'ponte', tipo: 'armadilha', ic: '🌉', nome: 'Ponte de cordas', tags: ['altura'], piloto: true, txt: '{piloto} atravessou a ponte de cordas sobre o cânion. Cada tábua estalava como um osso. Chegou ao outro lado. A ponte, não.' },
  { id: 'espinhos', tipo: 'armadilha', ic: '🌵', nome: 'Campo de cactos', tags: ['espinhos'], txt: 'Cactos brotaram em fileiras, apontando os espinhos como baionetas. Os pilotos passaram em zigue-zague, de olhos fixos no chão.' },
  { id: 'pedras', tipo: 'armadilha', ic: '🪨', nome: 'Avalanche de pedras', tags: ['montanha'], txt: 'Do alto do desfiladeiro, as pedras desceram rugindo. Houve poeira, gritos e chapéus voando. Ninguém se feriu.' },
  { id: 'cipo', tipo: 'armadilha', ic: '🪢', nome: 'Laço escondido', tags: ['corda'], piloto: true, txt: 'Um laço escondido na poeira prendeu a bota de {piloto}, que ficou pendurado de cabeça para baixo até a corda ceder.' },
  { id: 'gelo', tipo: 'armadilha', ic: '🧊', nome: 'Geada na madrugada', tags: ['frio'], txt: 'Uma geada inesperada cobriu a trilha. Os pilotos deslizaram de lado, de olhos arregalados, segurando as rédeas com as duas mãos.' },
  { id: 'lama', tipo: 'armadilha', ic: '🟤', nome: 'Lama vermelha', tags: ['lama'], piloto: true, txt: '{piloto} perdeu uma bota na lama vermelha. Seguiu de meia, com o queixo erguido e muita lama no resto.' },
  { id: 'labirinto', tipo: 'armadilha', ic: '🌀', nome: 'Cercas de arame', tags: ['confusao'], txt: 'Cercas de arame farpado surgiram em todas as direções. Os pilotos acharam a saída seguindo o barulho de quem já tinha saído.' },
  // NPCs hostis
  { id: 'bandido', tipo: 'npc', ic: '🕵️', nome: 'Bandido do Chapéu Torto', tags: ['multidao'], piloto: true, txt: 'O Bandido do Chapéu Torto tentou cobrar pedágio de {piloto}, que respondeu com um olhar tão firme que o bandido tropeçou no próprio chapéu.' },
  { id: 'corvo', tipo: 'npc', ic: '🐦‍⬛', nome: 'Corvo Ladrão', tags: ['ar'], piloto: true, txt: 'Um corvo negro mergulhou do céu e levou o lanche de {piloto}. Só o lanche. O piloto prometeu vingança, com muita calma.' },
  { id: 'golem', tipo: 'npc', ic: '🗿', nome: 'Gigante de Pedra', tags: ['montanha', 'barulho'], txt: 'O Gigante de Pedra barrou o desfiladeiro e só saiu quando os pilotos aprenderam a pedir licença no tom certo.' },
  { id: 'fantasma', tipo: 'npc', ic: '👻', nome: 'Cavaleiro Fantasma', tags: ['escuridao'], txt: 'O Cavaleiro Fantasma cruzou a estrada sussurrando "o prazo chegou...". Deu um arrepio coletivo. Quem já entregou nem ouviu.' },
  { id: 'lobos', tipo: 'npc', ic: '🐺', nome: 'Matilha de Coiotes', tags: ['floresta', 'barulho'], txt: 'Uma matilha de coiotes cercou a trilha. Só queriam brincar de buscar o graveto. Os pilotos jogaram, e os coiotes foram felizes.' },
  { id: 'pedagio', tipo: 'npc', ic: '⭐', nome: 'Xerife de Mentira', tags: ['multidao'], txt: 'Um xerife sem estrela apareceu cobrando "um sorriso por piloto". Todos pagaram, e ele foi embora sem saber o que fazer com tanto sorriso.' },
  // NPCs aliados
  { id: 'mecanico', tipo: 'aliado', ic: '🔨', nome: 'Ferreiro Itinerante', tags: ['maquina'], piloto: true, txt: 'Um ferreiro itinerante reforçou a sela e as ferraduras do cavalo de {piloto} de graça. Disse apenas: "Boa sorte, cavaleiro".' },
  { id: 'cartografa', tipo: 'aliado', ic: '🗺️', nome: 'Cartógrafa Misteriosa', tags: ['mapa'], txt: 'Uma cartógrafa misteriosa vendeu mapas por uma moeda. O mapa tinha um atalho. Ou uma pegadinha. Ninguém sabe ainda.' },
  { id: 'curandeira', tipo: 'aliado', ic: '🩹', nome: 'Curandeira do Povoado', tags: ['cura'], txt: 'A curandeira do povoado ofereceu chá de ervas a todos os pilotos. Todos beberam, e a corrida seguiu mais animada.' },
  { id: 'cozinheiro', tipo: 'aliado', ic: '🍲', nome: 'Cozinheiro de Fogueira', tags: ['comida'], piloto: true, txt: 'Um cozinheiro de carroça serviu feijão quente para {piloto} e para quem passasse na fila. O cheiro rendeu três paradas não planejadas.' },
  { id: 'bardo', tipo: 'aliado', ic: '🎻', nome: 'Violeiro Cronista', tags: ['som'], txt: 'Um violeiro cantou a história da corrida até agora. Vários pilotos descobriram que são personagens muito melhores do que imaginavam.' },
  { id: 'carroceiro', tipo: 'aliado', ic: '🛒', nome: 'Carroceiro Gentil', tags: ['maquina'], piloto: true, txt: 'Um carroceiro gentil deu carona a {piloto} por um quilômetro e ainda contou três fofocas da estrada. Valeu cada metro.' },
  // fenômenos
  { id: 'tempestade', tipo: 'fenomeno', ic: '🌪️', nome: 'Tempestade de areia', tags: ['areia', 'vento'], txt: 'A tempestade de areia fechou o céu. Os pilotos cobriram o rosto com lenços e avançaram às cegas, guiados pelo som das rédeas.' },
  { id: 'neblina', tipo: 'fenomeno', ic: '🌫️', nome: 'Neblina do pântano', tags: ['escuridao', 'confusao'], txt: 'A neblina cobriu tudo. Os pilotos andaram de mãos dadas por precaução, e alguém ficou conversando com um poste por dez minutos.' },
  { id: 'eclipse', tipo: 'fenomeno', ic: '🌘', nome: 'Eclipse sobre a estrada', tags: ['escuridao'], txt: 'O sol sumiu atrás da lua. O deserto ficou azul, os cavalos ficaram inquietos, e os pilotos esqueceram de respirar.' },
  { id: 'vento', tipo: 'fenomeno', ic: '💨', nome: 'Redemoinho', tags: ['vento', 'ar'], txt: 'Um redemoinho varreu o trecho. Os chapéus foram embora, os mapas viraram pipa, e os pilotos riram de si mesmos.' },
  { id: 'aurora', tipo: 'fenomeno', ic: '🌅', nome: 'Céu de fogo', tags: ['luz'], txt: 'O entardecer pintou o céu de vermelho e laranja. Os pilotos pararam para olhar. Foi a primeira vez que a corrida ficou em silêncio.' },
  { id: 'calor', tipo: 'fenomeno', ic: '🔥', nome: 'Sol de rachar', tags: ['calor'], txt: 'O sol apertou até entortar o horizonte. Os pilotos passaram o trecho procurando sombra. Quem tinha chapéu de aba larga virou celebridade.' },
  // situações inusitadas
  { id: 'gato', tipo: 'inusitado', ic: '🐈', nome: 'O gato do rancho', tags: ['mapa'], piloto: true, txt: 'Um gato enorme do rancho sentou em cima do mapa de {piloto} e não saiu mais. Disse, em miado claro, que estava confortável.' },
  { id: 'patos', tipo: 'inusitado', ic: '🐂', nome: 'Boiada desgarrada', tags: ['barulho'], txt: 'Uma boiada desgarrada atravessou a estrada em silêncio, sem pressa. A corrida parou por cinco minutos, em respeito.' },
  { id: 'placa', tipo: 'inusitado', ic: '🪧', nome: 'Placa trocada', tags: ['confusao'], txt: 'Alguém trocou a placa da bifurcação, e metade dos pilotos foi parar na Rua dos Atalhos Inúteis. Voltaram, mas com histórias.' },
  { id: 'relogio', tipo: 'inusitado', ic: '⏰', nome: 'O relógio da estação parou', tags: ['tempo'], txt: 'O relógio da estação parou por cinco minutos. Os pilotos ficaram imóveis, olhando uns para os outros, até que ele voltou como se nada tivesse acontecido.' },
  { id: 'semaforo', tipo: 'inusitado', ic: '🪑', nome: 'Cadeira de balanço', tags: ['maquina'], txt: 'Uma cadeira de balanço apareceu no meio do deserto. Balançava sozinha. Ninguém ousou se sentar.' },
  { id: 'eco', tipo: 'inusitado', ic: '📣', nome: 'Eco misterioso', tags: ['som'], piloto: true, txt: 'Um eco misterioso repetiu o que {piloto} disse, só que um pouco mais alto, e depois um pouco mais alto ainda. A pista inteira ficou ouvindo, sem saber de onde vinha.' },
];

// Realidade atual do mundo. Para uma temática nova no futuro, basta criar outra realidade e apontar REALIDADE_ATUAL para ela:
// os registros antigos continuam na crônica, e a nova história começa por cima.
// Os capítulos são privados (rascunho, só owners) até o owner liberar um por um, na ordem. Novos capítulos podem ser acrescentados a qualquer momento.
const REALIDADES = {
  distorcao: {
    nome: 'A Grande Distorção', ic: '🌀',
    atos: [{ de: 1, nome: 'Ato I · A Pista de Brinquedo Racha' }, { de: 4, nome: 'Ato II · A Poeira Sobe' }, { de: 6, nome: 'Ato III · A Grande Corrida' }, { de: 14, nome: 'Ato IV · A Última Linha' }],
    capitulos: [
      { n: 1, nome: 'O céu rasgou', txt: 'A Copa seguia como sempre: karts de brinquedo, itens caindo do céu e um Chefão de mau humor. Até que um vento quente, com cheiro de pólvora, atravessou a pista. O céu rasgou como papel. Pela fenda passou o mundo inteiro da Liga, pista, pilotos e plateia, e foi parar numa realidade paralela onde alguém reescrevia as regras.' },
      { n: 2, nome: 'Poeira onde havia asfalto', txt: 'O asfalto de brinquedo começou a rachar, e por baixo apareceu terra vermelha. As cores berrantes desbotaram para um tom de sépia. As placas de "Bem-vindos à Copa" queimaram ao sol, e em cada uma, em letras novas, surgiu uma frase: "Grande Corrida". Os pilotos olharam para o horizonte sem entender o que mudava.' },
      { n: 3, nome: 'Os karts foram deixados para trás', txt: 'Os karts de plástico rangeram, enferrujaram e ficaram abandonados à beira da estrada, como brinquedos esquecidos. Ninguém sentiu falta. No lugar deles, cada piloto encontrou um cavalo esperando, já selado, como se o mundo inteiro tivesse sido remanejado durante a noite: não existem mais rodas, motores nem asfalto. Os itens continuam caindo do céu, mas agora chegam embrulhados em papel pardo, amarrados com barbante. O mundo esqueceu o que era um jogo de brinquedo, e a corrida ficou séria.' },
      { n: 4, nome: 'O sussurro', txt: 'Alguns pilotos juram ter visto uma silhueta atrás de si, repetindo cada gesto com um segundo de atraso. Os mais velhos da pista dão um nome ao fenômeno: Stand. Dizem que ele só obedece a quem aprende a escutá-lo, e que cada piloto ouve um sussurro diferente.' },
      { n: 5, nome: 'Três vozes na poeira', txt: 'Na noite de acampamento, o sussurro ganhou forma. Cada piloto ouviu três vozes diferentes, e cada uma prometeu algo. Uma oferecia força, outra astúcia, outra sorte. Só uma poderia ficar. As outras desapareceram quando o piloto escolheu, e levaram embora a memória do que ofereciam. O Violeiro Cronista, de longe, anotou: "toda semana o sussurro volta, e toda semana é preciso escolher de novo".' },
      { n: 6, nome: 'Cartazes de procurado', txt: 'Nos postes das cidades fantasma apareceram cartazes: a Grande Corrida cruza o continente inteiro, etapa por etapa, do deserto até a costa. Quem chegar à última linha poderá pedir uma única coisa ao mundo: que ele volte ao que era, ou que seja reescrito do jeito que o vencedor quiser.' },
      { n: 7, nome: 'A primeira etapa', txt: 'O Chefão subiu num palanque de madeira e anunciou: a Copa de brinquedo foi só o aquecimento. A partir de agora, cada semana é uma etapa, e cada etapa tem seus perigos. Os pilotos ajustaram os chapéus, a poeira subiu, e a Spin Run LAG começou.' },
      { n: 8, nome: 'A cidade que não está no mapa', txt: 'Ao fim da primeira etapa, os pilotos chegaram a uma cidade que nenhum mapa mostrava: casas de madeira, um salão vazio, um relógio parado. Nas janelas, silhuetas observavam em silêncio. A Cartógrafa Misteriosa abriu o mapa sobre uma mesa e mostrou o que faltava: o continente tem doze trechos, e cada um é uma etapa. Quem fica para trás não é esquecido. Mas a cidade guarda lugar para todos.' },
      { n: 9, nome: 'O pacto de poeira', txt: 'Um aperto de mãos na estrada deixa uma marca na palma, e a marca queima quando alguém quebra a palavra. É o pacto de poeira: dois pilotos juntam forças e a pista passa a tratar os dois como um. Mas o mundo também gosta de histórias de traição. Silas anotou apenas: "a poeira não perdoa, mas também não esquece quem cumpriu".' },
      { n: 10, nome: 'O Chefão também correu', txt: 'Numa fogueira, o Chefão tirou o chapéu e contou o que nunca contava: ele também correu a Grande Corrida, muito tempo atrás, e perdeu a última etapa por um segundo. Desde então, cuida da pista como quem cuida de uma ferida. Os pilotos não souberam se riam ou se ficavam calados. No dia seguinte, ele estava tão mal-humorado como sempre, mas o chapéu estava mais inclinado para trás.' },
      { n: 11, nome: 'Todo Stand cresce, ou se perde', txt: 'Quem escuta o sussurro com atenção descobre que ele cresce: o que começou como um eco fraco vira uma sombra firme, depois uma presença que se move antes do piloto. Mas quem troca de voz toda semana, sem escutar nenhuma, deixa o sussurro frio. O Violeiro avisou: "o poder não é de quem tem muitos. É de quem aprende o que o seu quer dizer".' },
      { n: 12, nome: 'Noite no Deserto dos Bugs', txt: 'Existe um trecho do deserto onde a realidade é fina como papel. O chão repete o mesmo pedaço três vezes, as sombras andam para trás, e os cactos às vezes dão bom dia. Os pilotos chamam o lugar de Deserto dos Bugs. Nas rachaduras daquele chão, alguns juram ter visto, por um instante, uma sala de aula com computadores acesos. Foi só um segundo. Mas foi real.' },
      { n: 13, nome: 'A tempestade dos nomes', txt: 'Uma tempestade de areia varreu a pista e, quando passou, os pilotos perceberam que o mundo começava a esquecer os nomes de todos. As placas, os cartazes, até a plateia: ninguém sabia dizer quem era quem. Para não esquecer, cada piloto passou a gravar o próprio nome numa pedra do caminho. A pista guardou todas. Quem deixou a pedra, mesmo atrasado, continua lembrado.' },
      { n: 14, nome: 'A última linha tem dono', txt: 'Perto do fim, os pilotos encontraram o Organizador da Grande Corrida, sentado numa cadeira de balanço, com um relógio parado nas mãos. Ele foi o campeão da corrida anterior. Pediu ao mundo que fosse reescrito, e o mundo obedeceu, mas o prendeu como guardião da última linha. "A pista não termina em quem chega primeiro", disse. "Termina em quem decide o que vem depois."' },
      { n: 15, nome: 'A trégua', txt: 'Na última semana da corrida, o vento parou. Nenhum item caiu do céu, nenhum Chefão acordou, nenhum golpe veio das sombras. O Organizador chamou a pausa de trégua: um intervalo em que todos os pilotos são iguais, e cada um mostra, sem armas nem sustos, o que realmente aprendeu. Silas anotou, pela primeira vez, sem ironia: "a trégua é a parte mais difícil da corrida".' },
      { n: 16, nome: 'Quem escreve o próximo mundo', txt: 'A última linha se abriu como um portão de madeira, e do outro lado havia uma página em branco. Quem chegasse primeiro poderia pedir ao mundo que voltasse ao que era, ou que fosse reescrito do jeito que quisesse. O Organizador soltou o relógio, e ele voltou a andar. No céu, uma nova rachadura brilhou. Era outro mundo, esperando alguém corajoso para começar outra corrida.' },
    ],
  },
};
const REALIDADE_ATUAL = 'distorcao';
// Dois narradores: Silas, o Cronista (sério, voz grave) e Tião Trovão (comentarista cômico). O contraste é o charme da crônica.
const NARRADORES = { silas: { nome: 'Silas, o Cronista', ic: '🕯️', estilo: 'sério' }, tiao: { nome: 'Tião Trovão', ic: '🎙️', estilo: 'cômico' } };
// Gritos do Tião (originais, de narrador animado de luta no faroeste).
const GRITOS = {
  ataque: ['HIIIA! HIIIA! HIIIA! HIIIA!', 'BANG! BANG! BANG! BANG!', 'POEIRA! POEIRA! POEIRA! POEIRA!', 'TRÓ-TRÓ-TRÓ-TRÓ-TRÓ!'],
  defesa: ['NÃO PASSA! NÃO PASSA! NÃO PASSA!', 'FIRME! FIRME! FIRME! FIRME!'],
  falha: ['ESSE DADO FUGIU PRA FAZENDA!', 'O DADO PEDIU DEMISSÃO!'],
  chefao: ['CHEFÃO! CHEFÃO! CHEFÃO! CHEFÃO!'],
};
// Comentários do Tião para os acontecimentos de pista.
const TIAO = ['Eu avisei! Quer dizer, eu ia avisar!', 'Isso rende um bom causo na hora do jantar!', 'Alguém chama o fiscal! Ah, não tem fiscal. Perfeito!', 'Meu coração está a mil, e olha que ele é de lata!', 'Silas, você viu isso? Silas? Ele está anotando de novo...', 'Palmas para a pista, que hoje caprichou!', 'Eu só quero saber quem vai pagar o conserto da paisagem!', 'Gente, ninguém sai ileso. Alguns saem estilosos, mas ileso ninguém!', 'Se isso fosse no meu tempo, eu já tinha perdido o chapéu duas vezes!', 'Isso não estava no roteiro. Quer dizer, tinha roteiro?'];
// Gerador de acontecimentos: combina trecho, ocorrência e desfecho, para não ficar repetitivo (além do catálogo fixo).
const OCORR = {
  armadilha: ['um desfiladeiro cheio de pedras soltas', 'uma ponte de cordas podres', 'um campo de cactos de espinhos longos', 'uma vala coberta de lona, disfarçada de estrada', 'um trecho de areia que engole botas', 'um portão trancado com corrente enferrujada', 'uma poça de lama vermelha até o joelho', 'uma fileira de estacas escondida na poeira', 'um erro na pista, que repetiu o mesmo trecho três vezes (um bug!)'],
  npc: ['um caixeiro-viajante com tônicos duvidosos', 'uma sombra de chapéu largo à beira da estrada', 'um vaqueiro perdido que só falava por provérbios', 'uma raposa que vendia atalhos', 'um xerife sonolento de bigode enorme', 'um pistoleiro de colete de crochê', 'uma garotinha de chapéu maior que a cabeça, com um mapa na mão', 'um forasteiro que respondia tudo com outra pergunta'],
  fenomeno: ['uma tempestade de areia vermelha', 'um redemoinho que levou todos os chapéus', 'um céu cor de brasa ao entardecer', 'uma noite de lua enorme e silêncio absoluto', 'uma onda de calor que entortava o horizonte', 'um tremor que embaralhou todos os mapas', 'uma chuva repentina que cheirava a ferro', 'um vento seco que sussurrava nomes'],
};
const DESFECHO = ['No fim, todos passaram, com uma história a mais para contar.', 'A pista cobrou seu preço em chapéus, lanches e dignidade.', 'Os pilotos seguiram viagem, mais calados do que antes.', 'Quem estava atento ouviu a terra sussurrar: "isso foi só o começo".', 'O Chefão, ao longe, anotou o nome de cada um.', 'A poeira baixou. A corrida continuou.', 'Ninguém se feriu. Por enquanto.', 'E o horizonte, indiferente, continuou esperando.'];
const PORTA = { armadilha: 'Armadilha', npc: 'NPC hostil', aliado: 'NPC aliado', fenomeno: 'Fenômeno', inusitado: 'Inusitado' };
function gerar(chave, dia, trecho, recentes) {
  const tipos = ['armadilha', 'npc', 'fenomeno']; const h0 = hash(`${chave}|${dia}|g`); const tipo = tipos[h0 % 3];
  const lista = OCORR[tipo]; let i = (h0 >>> 3) % lista.length; const rec = new Set(recentes);
  for (let k = 0; k < lista.length && rec.has('g:' + tipo + i); k++) i = (i + 1) % lista.length;
  const f = DESFECHO[(h0 >>> 11) % DESFECHO.length];
  const ic = { armadilha: '🪤', npc: '🤠', fenomeno: '🌅' }[tipo]; const nome = { armadilha: 'Armadilha na estrada', npc: 'Encontro na estrada', fenomeno: 'Fenômeno na estrada' }[tipo];
  return { id: 'g:' + tipo + i, tipo, ic, nome, tags: [tipo], txt: `Em ${trecho}, os pilotos toparam com ${lista[i]}. ${f}` };
}
const hojeBR = (agora) => new Date(agora - 3 * 36e5).toISOString().slice(0, 10);
const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);
const trechoDe = (inicio, agora) => TRECHOS[(Math.max(1, C.semanaDe(inicio, agora)) - 1) % TRECHOS.length];
function montar(ev, piloto, agora, inicio, origem) {
  const txt = ev.txt.replace(/\{piloto\}/g, piloto ? '@' + piloto : 'um piloto'); const id = crypto.randomBytes(4).toString('hex');
  const tiao = TIAO[hash(id + ev.id) % TIAO.length];
  return { id, em: new Date(agora).toISOString(), tipo: ev.tipo, ic: ev.ic, nome: ev.nome, texto: txt, falas: [{ q: 'silas', t: txt }, { q: 'tiao', t: tiao }], tags: ev.tags, trecho: trechoDe(inicio, agora), origem: origem || 'sorteio', ...(piloto ? { piloto } : {}) };
}
// Sorteia o acontecimento do dia, de forma determinística (mesma data e chave dão o mesmo resultado), sem repetir os últimos 8.
// Metade dos dias vem do catálogo fixo e metade do gerador, para a variedade ser grande.
function sortear(chave, dia, recentes, trecho) {
  if (trecho && hash(`${chave}|${dia}|m`) % 2) return gerar(chave, dia, trecho, recentes);
  const livres = EVENTOS.filter((e) => !recentes.includes(e.id)); const lista = livres.length ? livres : EVENTOS;
  return lista[hash(`${chave}|${dia}`) % lista.length];
}
const TIAO_STAND = ['Olha o poder chegando! Eu até arrepiei, e olha que sou de lata!', 'Mais um Stand na pista! Quem ficou com a melhor voz?', 'Escolheu bem? Só a poeira dirá!', 'E o sussurro tem dono novo! Palmas, gente, palmas!'];
const gr = (k, sem) => { const l = GRITOS[k]; return l[hash(sem) % l.length]; };
const fala = (silas, tiao) => ({ falas: [{ q: 'silas', t: silas }, { q: 'tiao', t: tiao }], texto: silas + ' ' + tiao });
// Fatos reais da Copa (log) contados pelos dois narradores: Silas (sério) e Tião (cômico, de gritos). O autor dos ataques continua em segredo.
// rot(k) devolve o rótulo do piloto (ex.: "Afonso (afonsofarias)").
function fatos(est, agora, dias, rot, secreto, golpeDe) {
  const ini = agora - dias * 864e5, out = []; const nm = (k) => (k === 'chefao' ? 'O Chefão' : (rot ? rot(k) : '@' + k));
  for (const l of (est.log || [])) {
    const em = new Date(l.em).getTime(); if (!(em >= ini)) continue;
    const it = C.ITENS[l.item] || C.BOSS[l.item] || null; const base = { em: l.em, tipo: 'fato' }; const sem = `${l.em}|${l.item}|${l.vit || ''}`;
    // Os ataques são públicos, exceto os de quem tem um Stand furtivo na semana (aí o autor continua em segredo).
    const oculto = !l.de || l.de === 'roleta' || (l.de !== 'chefao' && secreto && secreto(l.de, em, l.para)); const autor = oculto ? '' : nm(l.de); const gp = !oculto && l.de !== 'chefao' && golpeDe ? golpeDe(l.de, l.item, em) : null; const ig = gp || it;
    if (l.evento === 'alianca' || (l.item === 'alianca' && !l.traicao && l.evento !== 'traicao')) out.push({ ...base, ic: '🤝', nome: 'Aliança', ...fala(`Dois pilotos apertaram as mãos sob o sol: ${nm(l.de)} e ${nm(l.para)}. Uma aliança nasceu.`, 'Que fofo! Que perigoso! Os dois ao mesmo tempo!') });
    else if (l.traicao || l.evento === 'traicao') out.push({ ...base, ic: '🗡️', nome: 'Traição', ...fala('A aliança se partiu. Em silêncio, alguém escolheu o próprio caminho. A pista guarda o segredo, mas jamais esquece.', 'TRAIÇÃO! TRAIÇÃO! Alguém traz pipoca!') });
    else if (l.item === 'evento' && C.EVENTOS[l.evento]) out.push({ ...base, ic: C.EVENTOS[l.evento].ic, nome: C.EVENTOS[l.evento].nome, ...fala(`${C.EVENTOS[l.evento].nome} cobre a pista. ${C.EVENTOS[l.evento].txt}`, TIAO[hash(sem) % TIAO.length]) });
    else if (l.item === 'missao') out.push({ ...base, ic: '🎯', nome: 'Missão cumprida', ...fala('A missão coletiva foi cumprida. Todos entregaram no prazo, e a pista premiou os pilotos com itens.', 'Todo mundo entregou no prazo! Eu choro! Choro de lata!') });
    else if (l.item === 'chuva-professor') out.push({ ...base, ic: '🌧️', nome: 'Chuva de itens', ...fala('O céu se abriu e uma chuva de itens caiu sobre os pilotos. Quem estava com as mãos livres aproveitou.', 'CHOVEU! CHOVEU! CHOVEU! Abram os chapéus!') });
    else if (l.de === 'roleta' && l.para) out.push({ ...base, ic: '🎰', nome: 'Roleta maluca', ...fala(`A roleta girou e girou. Quando parou, apontava para ${nm(l.para)}.`, 'GIRA! GIRA! GIRA! ...e parou! Destino é destino!') });
    else if (l.faixa && it) {
      const vit = l.vit ? nm(l.vit) : ''; const boss = l.de === 'chefao';
      if (l.faixa === 'falha_critica' || l.faixa === 'falha') out.push({ ...base, ic: '🎲', nome: 'Dado falhou', ...fala(`${boss ? 'O Chefão' : (autor || 'Alguém')} tentou usar ${ig.ic} ${ig.nome}. O dado rolou para o lado errado.`, `${gr('falha', sem)} Respeitem o azar do piloto!`) });
      else if (l.bloq && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', ...fala(`${vit} ergueu o escudo no último instante. ${ig.ic} ${ig.nome}${autor ? ', lançado por ' + autor + ',' : ''} não passou.`, `${gr('defesa', sem)} ${vit} é duro na queda!`) });
      else if (l.red && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', ...fala(`O escudo de ${vit} rachou, mas segurou o pior de ${ig.ic} ${ig.nome}${autor ? ', lançado por ' + autor : ''}.`, `${gr('defesa', sem)} Doeu menos do que podia!`) });
      else if (vit && l.vit !== l.de) out.push({ ...base, ic: boss ? '👹' : '🎯', nome: boss ? 'Chefão ataca' : 'Ataque', ...(boss ? fala(`O Chefão acordou. A terra tremeu quando ${ig.ic} ${ig.nome} saiu de sua mão e foi na direção de ${vit}.`, `${gr('chefao', sem)} Todos para trás, menos eu, eu estou longe!`) : (autor ? fala(`${autor} atacou ${vit} com ${ig.ic} ${ig.nome}. Os dois se encararam sob o sol.`, `${gr('ataque', sem)} ${autor} mandou, ${vit} levou!`) : fala(`Um golpe veio das sombras. ${vit} foi atingido por ${ig.ic} ${ig.nome}. Ninguém viu a mão que lançou.`, `${gr('ataque', sem)} ${vit} tomou uma! Quem foi? Segredo de Estado! 🕵️`))) });
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
const trocar = (e, rot) => { const f = (t) => (e.piloto ? String(t).split('@' + e.piloto).join(rot(e.piloto)) : t); return { em: e.em, tipo: e.tipo, ic: e.ic, nome: e.nome, texto: f(e.texto), falas: e.falas ? e.falas.map((x) => ({ q: x.q, t: f(x.t) })) : undefined, origem: e.origem }; };
const pub = (c) => ({ turma: c.turma, nome: c.nome, modo: c.modo });
const rotuloDe = (nomes) => (k) => { const n = String(nomes[k] || '').trim().split(/\s+/)[0]; return n ? `${n[0].toUpperCase()}${n.slice(1).toLowerCase()} (${k})` : '@' + k; };
function atoDe(n) { const R = REALIDADES[REALIDADE_ATUAL]; let a = R.atos[0]; for (const x of R.atos) if (n >= x.de) a = x; return a.nome; }
const ultimoLiberado = (arq) => Math.max(0, ...Object.keys(arq.liberados || {}).map(Number));
const semMundo = (criado, agora) => Math.max(1, Math.floor((agora - new Date(criado).getTime()) / (7 * 864e5)) + 1);
async function lerGeral(copas, agora, dono) {
  const R = REALIDADES[REALIDADE_ATUAL]; const part = copas.filter((c) => c.modo === 'participa');
  const alunos = [...new Set(part.flatMap((c) => (c.cx.t.alunos || [])))].filter((a) => !/^ficticio-/.test(a)).sort();
  let arq = await lerArquivo('mundo'); const dia = hojeBR(agora);
  if (part.length && (!arq.criado || !arq.dias[dia])) {
    arq = await gravar('mundo', (x) => {
      if (!x.criado) x.criado = new Date(agora).toISOString();
      const sem = semMundo(x.criado, agora);
      if (!x.dias[dia] && alunos.length) {
        const recentes = x.entradas.slice(-8).map((e) => e.evId).filter(Boolean); const trecho = TRECHOS[(sem - 1) % TRECHOS.length];
        const ev = sortear('mundo', dia, recentes, trecho); const piloto = ev.piloto ? alunos[hash(`mundo|${dia}|p`) % alunos.length] : '';
        const e = montar(ev, piloto, agora, new Date(x.criado).toISOString().slice(0, 10), 'sorteio'); e.evId = ev.id; e.piloto = piloto || undefined; x.entradas.push(e); x.dias[dia] = e.id;
      }
      return x;
    }, 'Crônica do mundo: capítulo e acontecimento do dia');
  }
  const sem = arq.criado ? semMundo(arq.criado, agora) : 1;
  return { arq, sem, alunos, cab: `${R.ic} ${R.nome} · ${atoDe(Math.max(1, ultimoLiberado(arq)))} · ${TRECHOS[(sem - 1) % TRECHOS.length]}` };
}
async function ler(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const q = req.query || {}; const agora = Date.now(); const staff = dono || !!monitor;
  const copas = await copasDe(cfg, usuario, dono, monitor, turmaOk);
  if (!copas.length) return u.json(res, 200, { jogo: NOME_JOGO, semCopa: true });
  const pedido = String(q.turma || '').toUpperCase(); const alvo = copas.find((c) => c.turma === pedido);
  const vista = alvo ? 'trilha' : 'geral';
  const ck = (alvo ? alvo.cx.chave : 'mundo') + '|' + (dono ? 'd' : staff ? 's' : 'a') + '|' + (dono ? 'x' : usuario); const c = CACHE.get(ck);
  const base = { jogo: NOME_JOGO, vista, copas: copas.map(pub), tipos: { ...PORTA, capitulo: 'História', fato: 'Fato' }, narradores: NARRADORES };
  if (c && agora - c.em < TTL) return u.json(res, 200, { ...base, ...c.resp });
  let resp;
  if (vista === 'geral') {
    const g = await lerGeral(copas, agora, dono);
    const nomes = await CA.nomesDa(g.alunos); const rot = rotuloDe(nomes);
    const R = REALIDADES[REALIDADE_ATUAL]; const lib = g.arq.liberados || {};
    const todos = R.capitulos.map((cap) => ({ n: cap.n, nome: `Capítulo ${cap.n} · ${cap.nome}`, em: lib[cap.n] || null, liberado: !!lib[cap.n], falas: [{ q: 'silas', t: cap.txt }], texto: cap.txt }));
    const historia = (dono ? todos : todos.filter((c) => c.liberado)).slice(0, 40);
    const lista = (g.arq.entradas || []).filter((e) => e.tipo !== 'capitulo').map((e) => trocar(e, rot)).sort((a, b) => new Date(b.em) - new Date(a.em)).slice(0, 40);
    resp = { cabecalho: g.cab, entradas: lista, historia, alvo: 'geral' };
  } else {
    const cx = alvo.cx; const t = cx.t; const est = (await infoDe(cx)).est;
    const SS = require('./stands'); const sctx0 = await SS.contexto([alvo]);
    const arq = await lerArquivo(cx.chave); const nomes = await CA.nomesDa((t.alunos || []).filter((a) => !/^ficticio-/.test(a))); const rot = rotuloDe(nomes);
    const lista = [...(arq.entradas || []).filter((e) => e.origem === 'professor').map((e) => trocar(e, rot)), ...fatos(est, agora, 7, rot, sctx0.oculto, (de, item, ms) => GP.golpe(sctx0.stand(de, ms), item)), ...SS.fatos(sctx0, t.alunos || [], agora, 7, rot, (k) => TIAO_STAND[hash(k) % TIAO_STAND.length])]
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
// O owner libera (ou recolhe) capítulos da história, sempre na ordem: só o próximo pode ser liberado e só o último pode ser recolhido.
async function liberar(res, b, { dono }) {
  if (!dono) return u.json(res, 403, { erro: 'Só o professor libera capítulos.' });
  const R = REALIDADES[REALIDADE_ATUAL]; const n = parseInt(b.n, 10); if (!(n >= 1 && n <= R.capitulos.length)) return u.json(res, 400, { erro: 'Capítulo inválido.' });
  let erro = '';
  await gravar('mundo', (x) => {
    x.liberados = x.liberados && typeof x.liberados === 'object' ? x.liberados : {}; const ult = ultimoLiberado(x);
    if (b.liberar === false) { if (n !== ult) { erro = 'Só o último capítulo liberado pode ser recolhido.'; return x; } delete x.liberados[n]; }
    else { if (n !== ult + 1) { erro = 'Os capítulos são liberados em ordem. O próximo é o ' + (ult + 1) + '.'; return x; } x.liberados[n] = new Date().toISOString(); }
    if (!x.criado) x.criado = new Date().toISOString(); return x;
  }, `Crônica do mundo: capítulo ${n} ${b.liberar === false ? 'recolhido' : 'liberado'}`);
  if (erro) return u.json(res, 400, { erro });
  CACHE.clear(); return u.json(res, 200, { ok: true });
}
function limparCache() { CACHE.clear(); INFO.clear(); }
module.exports = { copasDe, TIAO, NARRADORES, ler, disparar, liberar, EVENTOS, NOME_JOGO, fatos, sortear, gerar, TRECHOS, REALIDADES, REALIDADE_ATUAL, GRITOS, MODOS, modoDe, limparCache };
