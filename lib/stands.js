'use strict';
// Stands do Spin Run LAG (Fase 1): banco de Stands, escolha semanal de 1 entre 3, rodízio (no máximo 2 semanas seguidas com o mesmo)
// e exclusividade GLOBAL: cada piloto tem um único Stand, igual em todas as trilhas, e dois pilotos nunca têm o mesmo Stand na mesma semana. Por enquanto os Stands não mudam pontos:
// têm identidade, poder e fraqueza narrativos. As etiquetas (tags) servem para as vantagens e fraquezas das próximas fases.
// Stands "criativos" (que exigem criatividade do aluno) ficam fora até serem aprovados pelo professor.
const crypto = require('crypto');
const u = require('./util'); const d = require('./dados'); const C = require('./copa'); const CA = require('./copaapi');
const TIPOS = { corpo: ['Corpo a corpo', '👊'], longo: ['Longo alcance', '🎯'], ambiente: ['Ambiente', '🌫️'], objeto: ['Objeto', '🎒'], enxame: ['Enxame', '🦅'], rastro: ['Rastreador', '🐺'], truque: ['Truque', '🎭'], sorte: ['Sorte', '🍀'] };
const ESTILOS = { forte: 'Forte', zoeiro: 'Zoeiro', incrivel: 'Incrível' };
const DIFS = { facil: 'Fácil de usar', medio: 'Médio', dificil: 'Desafiador' };
// [id, nome, tipo, estilo, dificuldade, poder, fraqueza, tags]
const T = [
  ['punho', 'Punho de Ferro Velho', 'corpo', 'forte', 'facil', 'Soca tão forte que o chão treme, e cada golpe vem com um eco metálico.', 'Fica lento no chão molhado.', ['lama', 'agua']],
  ['caval', 'Cavalo de Pau', 'corpo', 'zoeiro', 'facil', 'Um cavalinho de brinquedo gigante que dá coices e relincha na hora errada.', 'Não consegue ficar quieto no silêncio.', ['barulho']],
  ['luva', 'Luva do Xerife', 'corpo', 'forte', 'medio', 'Prende o adversário com um aperto que nenhum nó desfaz.', 'Larga tudo se alguém elogiar o dono.', ['multidao']],
  ['espora', 'Esporas Gêmeas', 'corpo', 'forte', 'medio', 'Chuta duas vezes no mesmo instante, uma de cada lado.', 'Tropeça em terreno cheio de pedras.', ['montanha']],
  ['ferradura', 'Dama de Ferradura', 'corpo', 'incrivel', 'dificil', 'Cada ferradura que acerta algo vira um ímã que o puxa de volta.', 'Enfraquece perto de madeira.', ['floresta']],
  ['chicote', 'Chicote de Faísca', 'corpo', 'forte', 'medio', 'Estala e solta uma faísca que se estende por metros.', 'Detesta chuva.', ['raio', 'agua']],
  ['bigode', 'Bigode Furioso', 'corpo', 'zoeiro', 'facil', 'Um bigode enorme que ganha vida e distribui tapas.', 'Sensível a vento forte.', ['vento']],
  ['martelo', 'Martelo de Ferreiro', 'corpo', 'forte', 'dificil', 'Bate com a força de mil bigornas, mas só uma vez por vez.', 'Pesado demais: perde na corrida.', ['maquina']],
  ['gelo', 'Pistola de Pólvora Fria', 'longo', 'forte', 'medio', 'Dispara balas de gelo que congelam o que tocam.', 'Derrete no calor.', ['frio', 'calor']],
  ['corvo', 'Pena de Corvo', 'longo', 'forte', 'medio', 'Lança penas negras que perseguem o alvo, curvando no ar.', 'Perde a mira na ventania.', ['ar', 'vento']],
  ['estilingue', 'Estilingue Real', 'longo', 'zoeiro', 'facil', 'Dispara qualquer coisa, de pedrinha a sapato, com precisão absurda.', 'A pontaria some quando alguém olha.', ['multidao']],
  ['arco', 'Arco do Cacto', 'longo', 'forte', 'dificil', 'Flechas de espinho que crescem e viram cactos no alvo.', 'Só funciona em terra seca.', ['areia', 'lama']],
  ['trovao', 'Trovão em Lata', 'longo', 'incrivel', 'dificil', 'Guarda o barulho de uma tempestade e solta tudo de uma vez.', 'Fica mudo na neblina.', ['raio', 'barulho']],
  ['sal', 'Espingarda de Sal', 'longo', 'zoeiro', 'medio', 'Atira sal que deixa o alvo salgado demais para qualquer ataque.', 'Perde tudo se chover.', ['agua', 'comida']],
  ['boleadeira', 'Boleadeira Estelar', 'longo', 'forte', 'medio', 'Bolas amarradas que giram ao redor do alvo e o prendem.', 'Enrola-se no próprio dono se ele hesitar.', ['corda']],
  ['lanca', 'Lança de Vento', 'longo', 'forte', 'medio', 'Um sopro cortante que atravessa qualquer porta.', 'Inofensivo no ar parado.', ['vento', 'ar']],
  ['canion', 'Cânion Portátil', 'ambiente', 'incrivel', 'dificil', 'Abre um desfiladeiro curto onde só passa quem ele quiser.', 'Fecha com o som de gente cantando.', ['montanha', 'som']],
  ['poeiraouro', 'Poeira Dourada', 'ambiente', 'forte', 'medio', 'Uma nuvem que embaralha o sentido de quem entra nela.', 'Some com a chuva.', ['areia', 'agua']],
  ['neblina', 'Neblina de Campina', 'ambiente', 'forte', 'facil', 'Cobre a área com uma névoa que só o dono enxerga.', 'O sol rasga tudo.', ['escuridao', 'luz']],
  ['eclipse', 'Eclipse de Bolso', 'ambiente', 'incrivel', 'dificil', 'Apaga a luz num raio curto e acende só a dele.', 'Ofuscado por fogueira.', ['escuridao', 'luz']],
  ['domingo', 'Chuva de Domingo', 'ambiente', 'zoeiro', 'facil', 'Faz chover só em cima de quem ele escolher.', 'Fica ensopado também.', ['agua']],
  ['contrario', 'Vento Contrário', 'ambiente', 'forte', 'medio', 'Qualquer sopro que atingir o dono volta ao contrário.', 'Perde o equilíbrio no ar parado.', ['vento']],
  ['vila', 'Vila Fantasma', 'ambiente', 'incrivel', 'dificil', 'Cria uma cidade vazia onde todos falam baixinho.', 'Some se alguém gritar.', ['escuridao', 'barulho']],
  ['trem', 'Estação de Trem Invisível', 'ambiente', 'forte', 'medio', 'Apita e atrasa quem tentar correr.', 'Chega sempre atrasada.', ['maquina', 'tempo']],
  ['relogio', 'Relógio de Bolso Teimoso', 'objeto', 'incrivel', 'dificil', 'Atrasa ou adianta cinco segundos de quem tocar.', 'Quebra se cair.', ['tempo', 'maquina']],
  ['mapa', 'Mapa Mal Dobrado', 'objeto', 'zoeiro', 'facil', 'Mostra o caminho mais curto, só que para outro lugar.', 'Só ajuda quando o dono desiste de usar.', ['mapa']],
  ['lampiao', 'Lampião Sem Pavio', 'objeto', 'forte', 'medio', 'Ilumina o que as outras luzes escondem.', 'Apaga na ventania.', ['luz', 'vento']],
  ['bau', 'Baú de Ouro Falso', 'objeto', 'zoeiro', 'medio', 'Vira o que o inimigo mais deseja e foge.', 'Não funciona se o alvo não quiser nada.', ['multidao']],
  ['chapeu', 'Chapéu de Aba Larga', 'objeto', 'forte', 'facil', 'Protege o dono de qualquer coisa que caia de cima.', 'Pesa no calor.', ['calor', 'altura']],
  ['sino', 'Sino da Capela', 'objeto', 'forte', 'medio', 'Cada badalada empurra para trás quem estiver perto.', 'O som atrai atenção indesejada.', ['som', 'barulho']],
  ['colher', 'Colher de Pau do Cozinheiro', 'objeto', 'zoeiro', 'facil', 'Mexe qualquer coisa e deixa tudo com cara de sopa.', 'Não funciona com gente em jejum.', ['comida']],
  ['bussola', 'Bússola do Contra', 'objeto', 'forte', 'medio', 'Aponta sempre para o que o dono não quer encontrar.', 'Inútil quando o dono não tem preferência.', ['mapa']],
  ['cartas', 'Revoada de Cartas', 'enxame', 'forte', 'medio', 'Cartas de baralho voadoras que cortam e embaralham.', 'A chuva molha tudo.', ['ar', 'agua']],
  ['vagalume', 'Nuvem de Vagalumes', 'enxame', 'forte', 'facil', 'Cegam e guiam, na mesma noite.', 'Somem de dia.', ['escuridao', 'luz']],
  ['sombras', 'Matilha de Sombras', 'enxame', 'incrivel', 'dificil', 'Cães feitos de escuro que caçam em grupo.', 'Se dispersam sob luz forte.', ['escuridao', 'luz']],
  ['formigas', 'Formigas de Ferro', 'enxame', 'forte', 'medio', 'Roem qualquer metal em segundos.', 'Param em terreno úmido.', ['maquina', 'agua']],
  ['gafanhoto', 'Gafanhotos de Ouro', 'enxame', 'zoeiro', 'medio', 'Devoram tudo, inclusive o lanche do dono.', 'Fogem do som de viola.', ['comida', 'som']],
  ['cardume', 'Cardume de Poeira', 'enxame', 'forte', 'medio', 'Peixes de areia que nadam no ar.', 'Perdem a forma na lama.', ['areia', 'lama']],
  ['ras', 'Coro de Rãs', 'enxame', 'zoeiro', 'facil', 'Coaxam tão alto que ninguém ouve mais nada.', 'Param se alguém pedir silêncio com educação.', ['barulho', 'agua']],
  ['faro', 'Faro de Lobo Solitário', 'rastro', 'forte', 'facil', 'Segue o rastro de qualquer um por quilômetros.', 'Se confunde com perfume forte.', ['floresta']],
  ['aguia', 'Olho de Águia de Papel', 'rastro', 'forte', 'medio', 'Vê tudo do alto, mas só em preto e branco.', 'Dobra com o vento.', ['ar', 'vento']],
  ['ouvido', 'Ouvido da Terra', 'rastro', 'forte', 'medio', 'Escuta passos a distância através do chão.', 'Ensurdece em ambiente barulhento.', ['barulho']],
  ['cavalosem', 'Cavalo Sem Dono', 'rastro', 'forte', 'medio', 'Encontra qualquer atalho, mas só aceita ir sozinho.', 'Empaca se alguém monta.', ['mapa']],
  ['ecocav', 'Eco de Caverna', 'rastro', 'incrivel', 'dificil', 'Repete o que ouviu até revelar onde está quem falou.', 'Precisa de silêncio absoluto.', ['som', 'montanha']],
  ['gatorancho', 'Olfato de Gato do Rancho', 'rastro', 'zoeiro', 'facil', 'Acha qualquer lanche num raio de uma légua.', 'Se distrai com peixe.', ['comida']],
  ['sombraatr', 'Sombra Atrasada', 'rastro', 'incrivel', 'dificil', 'Segue o alvo com um segundo de atraso, repetindo seus gestos.', 'Perde o rastro em multidão.', ['escuridao', 'multidao']],
  ['mascara', 'Máscara de Papel', 'truque', 'zoeiro', 'facil', 'Dá ao dono a cara de quem estiver na frente.', 'Desmancha na água.', ['agua']],
  ['palhaco', 'Palhaço do Saloon', 'truque', 'zoeiro', 'facil', 'Faz o inimigo rir e esquecer o que ia fazer.', 'Não funciona em quem já está bravo.', ['multidao']],
  ['espelho', 'Espelho de Praça', 'truque', 'incrivel', 'dificil', 'Reflete um golpe, mas só se o dono estiver sorrindo.', 'Quebra com pedra.', ['luz', 'montanha']],
  ['magico', 'Mágico de Carroça', 'truque', 'forte', 'medio', 'Faz sumir um objeto pequeno por cinco minutos.', 'O objeto volta sempre no pior momento.', ['multidao']],
  ['ventriloquo', 'Ventríloquo de Cactos', 'truque', 'zoeiro', 'medio', 'Faz qualquer cacto falar com a voz que o dono quiser.', 'Os cactos mentem.', ['areia']],
  ['laco', 'Cordão de Laço', 'truque', 'forte', 'medio', 'Amarra o alvo a qualquer coisa fixa, mas só por um piscar.', 'O nó some se alguém reparar.', ['corda']],
  ['cartomante', 'Cartomante Torta', 'truque', 'forte', 'medio', 'Prevê o que o alvo vai fazer, mas se engana metade das vezes.', 'Nunca erra quando o alvo está calado.', ['confusao']],
  ['dado', 'Dado Viciado', 'sorte', 'zoeiro', 'medio', 'Perto dele, todo sorteio muda de lado, só que nunca para o lado óbvio.', 'Perde a força se alguém contar o segredo.', ['sorte']],
  ['trevo', 'Trevo de Quatro Folhas Sem Raiz', 'sorte', 'forte', 'medio', 'Tira o azar de um aliado e joga em outro.', 'Murcha fora da primavera.', ['floresta', 'sorte']],
  ['moeda', 'Moeda de Duas Caras', 'sorte', 'forte', 'facil', 'Cai sempre do lado que o dono não escolheu, a não ser que ele escolha o contrário.', 'Fica confusa em dia par.', ['sorte', 'confusao']],
  ['poco', 'Poço dos Desejos', 'sorte', 'incrivel', 'dificil', 'Aceita uma moeda e devolve um pedido pela metade.', 'Só atende quem já agradeceu.', ['agua', 'sorte']],
  ['gatopreto', 'Gato Preto de Estimação', 'sorte', 'zoeiro', 'facil', 'Atravessa o caminho do adversário na hora certa.', 'Ignora quem não oferece comida.', ['comida', 'sorte']],
  ['coringa', 'Carta Coringa', 'sorte', 'incrivel', 'dificil', 'Vira a habilidade de outro Stand uma vez por rodada.', 'Fica vazia quando o dono tenta repetir.', ['sorte', 'confusao']],
  ['ferrasorte', 'Ferradura da Sorte Grande', 'sorte', 'forte', 'facil', 'Quem tocar nela ganha um segundo de sorte pura.', 'Enferruja com preocupação.', ['sorte']],
  ['cotovelo', 'Cotovelo de Prata', 'corpo', 'forte', 'medio', 'Cada cotovelada deixa uma marca de prata que atrai o próximo golpe.', 'Fica sem força quando a marca se apaga.', ['luz']],
  ['soco', 'Soco de Cobertor', 'corpo', 'zoeiro', 'facil', 'Golpes macios que fazem o alvo cochilar.', 'Não funciona em quem está com raiva.', ['multidao']],
  ['rodeio', 'Touro de Rodeio', 'corpo', 'forte', 'medio', 'Investe sem parar até derrubar o que estiver na frente.', 'Não sabe fazer curvas.', ['montanha']],
  ['fivela', 'Fivela Relâmpago', 'corpo', 'forte', 'dificil', 'A fivela do cinto solta raios curtos quando bate no chão.', 'Gasta a energia se o dono ficar parado.', ['raio']],
  ['botas', 'Botas de Chumbo Leve', 'corpo', 'zoeiro', 'facil', 'Pisadas que afundam o chão e fazem o inimigo escorregar.', 'Faz barulho demais para surpreender.', ['barulho', 'lama']],
  ['garra', 'Garra de Cascavel', 'corpo', 'forte', 'medio', 'Um bote veloz que paralisa por um segundo.', 'Dorme quando faz frio.', ['frio']],
  ['lutador', 'Lutador de Saloon', 'corpo', 'zoeiro', 'medio', 'Joga qualquer objeto da mesa como se fosse arma.', 'Perde a vez se alguém oferecer uma bebida.', ['comida']],
  ['povoado', 'Mão do Povoado', 'corpo', 'forte', 'facil', 'Chama os vizinhos para ajudar com golpes em coro.', 'Sozinho, é fraco.', ['multidao']],
  ['carabina', 'Carabina de Estrelas', 'longo', 'forte', 'medio', 'Tiros que viram estrelinhas e seguem o alvo.', 'Erra tudo se o dono olhar para baixo.', ['luz']],
  ['dinamite', 'Dinamite de Brinquedo', 'longo', 'zoeiro', 'facil', 'Explode em confete, mas assusta como se fosse de verdade.', 'Só funciona se o alvo ainda não viu.', ['barulho']],
  ['lacofumaca', 'Laço de Fumaça', 'longo', 'forte', 'medio', 'Um laço que aperta de longe, feito de fumaça.', 'Desmancha com vento.', ['vento', 'corda']],
  ['catapulta', 'Catapulta de Bolso', 'longo', 'zoeiro', 'medio', 'Lança objetos pequenos em arcos enormes, e quase sempre acerta.', 'Não acerta nada se o alvo estiver parado.', ['altura']],
  ['dardos', 'Dardos de Cacto', 'longo', 'forte', 'facil', 'Dardos pequenos que deixam o alvo lento por um tempo.', 'Esgotam depois de três usos.', ['areia']],
  ['algodao', 'Canhão de Algodão', 'longo', 'zoeiro', 'facil', 'Dispara nuvens de algodão que prendem o alvo numa teia macia.', 'Fogo derrete tudo.', ['calor']],
  ['flechavela', 'Flecha de Vela', 'longo', 'forte', 'dificil', 'Uma flecha que acende uma chama onde cair.', 'Apaga com chuva.', ['calor', 'agua']],
  ['raioazul', 'Raio de Poeira Azul', 'longo', 'incrivel', 'dificil', 'Um feixe fino que atravessa tudo, menos espelhos.', 'Precisa de céu limpo.', ['luz', 'raio']],
  ['oasis', 'Oásis Teimoso', 'ambiente', 'forte', 'facil', 'Cria um oásis que cura quem estiver cansado dentro dele.', 'Desaparece se o dono tiver pressa.', ['agua', 'cura']],
  ['tempestade', 'Tempestade de Bolso', 'ambiente', 'incrivel', 'dificil', 'Uma pequena tempestade que segue o dono por onde ele for.', 'Seca se o dono ficar parado.', ['raio', 'agua']],
  ['luar', 'Luar Permanente', 'ambiente', 'forte', 'medio', 'Mantém a noite acesa num pequeno raio, só para o dono ver.', 'Atrai mariposas demais.', ['escuridao', 'luz']],
  ['redemoinho', 'Redemoinho Dançante', 'ambiente', 'zoeiro', 'facil', 'Gira tudo em volta do dono, inclusive os chapéus alheios.', 'Fica tonto fácil.', ['vento']],
  ['pradaria', 'Pradaria Infinita', 'ambiente', 'forte', 'medio', 'Estica o caminho de quem persegue o dono.', 'Encolhe se o dono olhar para trás.', ['mapa']],
  ['lago', 'Lago Congelado', 'ambiente', 'forte', 'medio', 'Congela o chão em círculo e faz todo mundo deslizar.', 'Derrete rápido no calor.', ['frio', 'calor']],
  ['carnaval', 'Carnaval Surpresa', 'ambiente', 'zoeiro', 'medio', 'Faz uma festa aparecer do nada e distrai todo mundo.', 'O dono também dança.', ['barulho', 'multidao']],
  ['nevoeiro', 'Nevoeiro de Trem', 'ambiente', 'forte', 'facil', 'Fumaça de locomotiva que esconde e atrasa quem passa.', 'Cheira a carvão e denuncia o dono.', ['maquina', 'escuridao']],
  ['lanterna', 'Lanterna de Cabeceira', 'objeto', 'forte', 'facil', 'Ilumina o caminho certo, desde que ninguém pergunte qual.', 'Apaga se alguém duvidar dela.', ['luz']],
  ['cantil', 'Cantil Sem Fundo', 'objeto', 'zoeiro', 'facil', 'Guarda qualquer coisa que o dono beber ou esquecer.', 'O que entra nem sempre sai igual.', ['agua', 'comida']],
  ['cadeira', 'Cadeira de Balanço Real', 'objeto', 'incrivel', 'dificil', 'Quem senta nela revive os últimos dez segundos.', 'Só funciona uma vez por dia.', ['tempo']],
  ['telegrafo', 'Telégrafo Fantasma', 'objeto', 'forte', 'medio', 'Envia uma mensagem que só o destinatário ouve.', 'A mensagem chega sempre atrasada.', ['som', 'tempo']],
  ['cobre', 'Moeda de Cobre Fundida', 'objeto', 'forte', 'medio', 'Transforma qualquer metal em barra pesada por pouco tempo.', 'Volta ao normal quando alguém acha graça.', ['maquina']],
  ['lenco', 'Lenço do Bandido', 'objeto', 'forte', 'medio', 'Esconde o rosto do dono de qualquer olhar.', 'Todo mundo reconhece o lenço.', ['escuridao', 'multidao']],
  ['barril', 'Barril de Pólvora Mansa', 'objeto', 'zoeiro', 'medio', 'Explode só em cheiro de pólvora e deixa todo mundo tossindo.', 'Cheira bem demais.', ['barulho']],
  ['viola', 'Viola Desafinada', 'objeto', 'zoeiro', 'facil', 'Cada nota faz alguém esquecer o que estava fazendo.', 'Só funciona se o dono tocar errado.', ['som']],
  ['abelhas', 'Abelhas de Latão', 'enxame', 'forte', 'medio', 'Zumbem e picam num ritmo perfeito.', 'Param quando o dono fica nervoso.', ['ar', 'maquina']],
  ['mariposas', 'Mariposas de Lanterna', 'enxame', 'forte', 'facil', 'Seguem a luz e apagam o que tocarem.', 'Voltam para o dono ao amanhecer.', ['luz', 'escuridao']],
  ['corujas', 'Corujas de Ferro', 'enxame', 'incrivel', 'dificil', 'Voam em silêncio e enxergam tudo de noite.', 'Ficam cegas de dia.', ['escuridao', 'ar']],
  ['besouros', 'Besouros de Medalha', 'enxame', 'zoeiro', 'facil', 'Carregam moedas e as devolvem em troca de elogios.', 'Ficam bravos se o elogio for falso.', ['multidao']],
  ['morcegos', 'Morcegos de Cartola', 'enxame', 'forte', 'medio', 'Saem de dentro do chapéu e criam confusão.', 'Detestam sol.', ['escuridao', 'confusao']],
  ['serpentes', 'Serpentes de Corda', 'enxame', 'forte', 'medio', 'Corda que vira cobra e prende o alvo.', 'Viram corda de novo se alguém assobiar.', ['corda', 'som']],
  ['pardais', 'Pardais do Telhado', 'enxame', 'zoeiro', 'facil', 'Levam recados e roubam migalhas de todo mundo.', 'Ficam ansiosos com gatos.', ['comida']],
  ['raposa', 'Rastro de Raposa Prateada', 'rastro', 'forte', 'medio', 'Deixa pegadas falsas e encontra as verdadeiras.', 'Se confunde em terreno liso.', ['floresta', 'confusao']],
  ['olhomoeda', 'Olho de Moeda', 'rastro', 'forte', 'facil', 'Enxerga qualquer brilho de metal a quilômetros.', 'Cego para madeira.', ['luz', 'maquina']],
  ['nariz', 'Nariz de Mineiro', 'rastro', 'zoeiro', 'facil', 'Fareja ouro e, às vezes, lanche.', 'Espirra e entrega o dono.', ['comida', 'montanha']],
  ['cantor', 'Cantor de Eco', 'rastro', 'forte', 'dificil', 'Assobia e o som volta mostrando onde está cada um.', 'Precisa de silêncio ao redor.', ['som']],
  ['pegadas', 'Pegadas Retroativas', 'rastro', 'incrivel', 'dificil', 'Mostra por onde alguém passou nas últimas horas.', 'Só funciona com quem já cruzou com o dono.', ['tempo']],
  ['vigia', 'Vigia do Moinho', 'rastro', 'forte', 'medio', 'Vê de longe quem está chegando.', 'Dorme depois do almoço.', ['altura']],
  ['sentinela', 'Sentinela de Palha', 'rastro', 'zoeiro', 'facil', 'Um espantalho que aponta quem está escondido.', 'Ele também se assusta.', ['multidao']],
  ['cartola', 'Cartola Sem Fundo', 'truque', 'zoeiro', 'medio', 'Tira de dentro qualquer coisa que o inimigo acabou de usar.', 'Às vezes tira um coelho irritado.', ['multidao']],
  ['sombrinha', 'Sombrinha de Duelo', 'truque', 'forte', 'medio', 'Desvia qualquer golpe com um giro elegante.', 'Quebra com vento.', ['vento']],
  ['jogador', 'Jogador de Cartas Fantasma', 'truque', 'incrivel', 'dificil', 'Troca uma carta de lugar e muda o resultado de uma jogada.', 'Só uma troca por jogo.', ['sorte', 'confusao']],
  ['ilusionista', 'Ilusionista de Poeira', 'truque', 'forte', 'medio', 'Cria cópias de poeira do dono.', 'Desmancham com água.', ['areia', 'agua']],
  ['boneco', 'Boneco de Madeira', 'truque', 'zoeiro', 'facil', 'Um boneco fala por ele e diz o que não devia.', 'Quase sempre diz a verdade.', ['som']],
  ['sumico', 'Truque do Sumiço', 'truque', 'forte', 'dificil', 'Some do campo de visão por três segundos.', 'Reaparece sempre ao lado de quem procurava.', ['escuridao']],
  ['gargalhada', 'Gargalhada Contagiosa', 'truque', 'zoeiro', 'facil', 'Faz todo mundo por perto rir, inclusive os inimigos.', 'O dono também não consegue parar de rir.', ['multidao', 'barulho']],
  ['pedra', 'Pedra de Rio Falante', 'sorte', 'forte', 'medio', 'Rola e escolhe o lado mais favorável.', 'Não fala se estiver seca.', ['agua', 'sorte']],
  ['sinoazar', 'Sino do Azar Alheio', 'sorte', 'forte', 'dificil', 'Toca antes de um azar e avisa o dono.', 'O aviso chega sempre por último.', ['som', 'sorte']],
  ['bola', 'Bola de Cristal Rachada', 'sorte', 'forte', 'medio', 'Mostra o futuro, mas só o que o dono não quer ver.', 'Quebra mais a cada previsão.', ['luz', 'sorte']],
  ['pecoelho', 'Pé de Coelho Falso', 'sorte', 'zoeiro', 'facil', 'Dá sorte só quando ninguém está olhando.', 'Perde o efeito se alguém acreditar.', ['sorte']],
  ['roleta', 'Roleta do Saloon', 'sorte', 'incrivel', 'dificil', 'Gira e muda uma regra pequena da rodada.', 'O dono nunca sabe qual.', ['sorte', 'confusao']],
  ['cartatorta', 'Carta do Destino Torto', 'sorte', 'forte', 'medio', 'Puxa uma carta e vira uma vantagem pequena.', 'A carta é sempre a segunda pior.', ['sorte']],
  ['apostador', 'Apostador Teimoso', 'sorte', 'zoeiro', 'medio', 'Dobra uma aposta, mas só se o dono apostar tudo.', 'Perde sempre quando está confiante.', ['sorte']],
];
// Stands de habilidade furtiva: o ataque deles não é revelado na crônica.
const FURTIVOS = new Set(['neblina', 'eclipse', 'vila', 'sombras', 'sombraatr', 'mascara', 'magico', 'poeiraouro', 'sumico', 'lenco', 'ilusionista', 'nevoeiro', 'corujas']);
const BANCO = T.map(([id, nome, tipo, estilo, dif, poder, fraqueza, tags]) => ({ id, nome, tipo, tipoNome: TIPOS[tipo][0], ic: TIPOS[tipo][1], estilo: ESTILOS[estilo], dif: DIFS[dif], poder, fraqueza, tags: FURTIVOS.has(id) ? [...tags, 'furtivo'] : tags, furtivo: FURTIVOS.has(id) }));
const POR_ID = Object.fromEntries(BANCO.map((s) => [s.id, s]));
const MAX_SEGUIDAS = 2;
const caminho = () => 'dados/stands/global.json';
const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);
const norm = (x) => { const e = x && typeof x === 'object' ? x : {}; e.semanas = e.semanas && typeof e.semanas === 'object' ? e.semanas : {}; return e; };
const dessa = (est, sem) => est.semanas[sem] || {};
const ocupados = (est, sem, exceto) => new Set(Object.entries(dessa(est, sem)).filter(([k]) => k !== exceto).map(([, v]) => v.stand));
// Quantas semanas seguidas, terminando na semana anterior a "sem", o piloto ficou com o Stand "id".
function seguidas(est, sem, usuario, id) { let n = 0; for (let s = sem - 1; s >= 1; s--) { const e = dessa(est, s)[usuario]; if (e && e.stand === id) n++; else break; } return n; }
const jaTeve = (est, sem, usuario) => { const r = new Set(); for (const [s, m] of Object.entries(est.semanas)) if (Number(s) < sem && m[usuario]) r.add(m[usuario].stand); return r; };
// Estado do piloto na semana: o Stand escolhido, ou as 3 ofertas (sorteio fixo da semana) e se pode manter o atual.
function visao(est, sem, usuario) {
  const esc = dessa(est, sem)[usuario];
  if (esc) return { semana: sem, escolhido: { ...POR_ID[esc.stand], manteve: !!esc.manteve, seguidas: seguidas(est, sem, usuario, esc.stand) + 1 }, total: BANCO.length };
  const ocup = ocupados(est, sem); const livres = BANCO.filter((s) => !ocup.has(s.id)); const ant = dessa(est, sem - 1)[usuario];
  const seg = ant ? seguidas(est, sem, usuario, ant.stand) : 0;
  const podeManter = !!(ant && POR_ID[ant.stand] && seg < MAX_SEGUIDAS && !ocup.has(ant.stand));
  const tinha = jaTeve(est, sem, usuario); const semAnt = (ant ? livres.filter((s) => s.id !== ant.stand) : livres);
  let pool = semAnt.filter((s) => !tinha.has(s.id)); if (pool.length < 3) pool = semAnt;
  const ofertas = pool.slice().sort((a, b) => hash(`${sem}|${usuario}|${a.id}`) - hash(`${sem}|${usuario}|${b.id}`)).slice(0, 3);
  return { semana: sem, escolhido: null, ofertas, manter: podeManter ? { ...POR_ID[ant.stand], seguidas: seg } : null, atualAcabou: !!(ant && !podeManter && seg >= MAX_SEGUIDAS), total: BANCO.length };
}
async function lerEstado() { const { dados } = await d.lerJson(caminho()); return norm(dados); }
const CACHE = { em: 0, est: null }; const TTL = 20000;
async function estadoCache() { if (CACHE.est && Date.now() - CACHE.em < TTL) return CACHE.est; CACHE.est = await lerEstado(); CACHE.em = Date.now(); return CACHE.est; }
// As semanas dos Stands são globais (a mesma para todas as trilhas), contadas a partir da data de início mais antiga das Copas abertas.
const iniMs = (t) => new Date(t.inicio + 'T00:00:00-03:00').getTime();
const baseDe = (est, copas) => (est.base ? new Date(est.base).getTime() : Math.min(...copas.map((c) => iniMs(c.cx.t)).filter((x) => x > 0), Date.now()));
const semDeMs = (base, ms) => (ms >= base ? Math.floor((ms - base) / (7 * 864e5)) + 1 : 0);
async function pilotoCopa(cfg, usuario, dono, monitor, turmaOk) {
  const copas = await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk);
  const abertas = copas.filter((c) => c.aberta && c.modo === 'participa');
  return { copas, abertas, minha: copas.some((c) => c.aluno && c.aberta) };
}
async function ler(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const agora = Date.now(); const { abertas, minha } = await pilotoCopa(cfg, usuario, dono, monitor, turmaOk);
  const est = await estadoCache();
  if (dono) { // visão do professor: quem tem qual Stand na semana, em todas as trilhas
    if (!abertas.length) return u.json(res, 200, { semCopa: true });
    const sem = semDeMs(baseDe(est, abertas), agora); const alunos = [...new Set(abertas.flatMap((c) => c.cx.t.alunos || []))].filter((a) => !/^ficticio-/.test(a)).sort();
    const nomes = await CA.nomesDa(alunos);
    const lista = alunos.map((a) => { const e = dessa(est, sem)[a]; const n = String(nomes[a] || '').trim().split(/\s+/)[0]; return { usuario: a, nome: n || a, stand: e && POR_ID[e.stand] ? POR_ID[e.stand].nome : '', manteve: !!(e && e.manteve), furtivo: !!(e && POR_ID[e.stand] && POR_ID[e.stand].furtivo) }; });
    return u.json(res, 200, { dono: true, semana: sem, banco: BANCO.length, furtivos: BANCO.filter((s) => s.furtivo).length, escolheram: lista.filter((x) => x.stand).length, total: lista.length, trilhas: abertas.map((c) => c.nome), lista });
  }
  if (!minha) return u.json(res, 200, { semCopa: true });
  const mias = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta);
  const sem = semDeMs(baseDe(est, mias), agora); if (sem < 1) return u.json(res, 200, { semCopa: true });
  return u.json(res, 200, { trilhas: mias.map((c) => c.nome), ...visao(est, sem, usuario) });
}
// O piloto escolhe um Stand: uma das 3 ofertas ou "manter" o atual (no máximo 2 semanas seguidas). Vale para a semana toda e para todas as trilhas.
async function escolher(res, b, { cfg, usuario, dono, monitor, turmaOk }) {
  if (dono) return u.json(res, 403, { erro: 'Só os pilotos escolhem Stands.' });
  const copas = (await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk)).filter((c) => c.aluno && c.aberta);
  if (!copas.length) return u.json(res, 403, { erro: 'Você não participa de uma Copa aberta.' });
  const agora = Date.now(); let erro = '', escolhido = null;
  await d.mudarJson(caminho(), (cur) => {
    const est = norm(cur); if (!est.base) est.base = new Date(baseDe(est, copas)).toISOString();
    const sem = semDeMs(new Date(est.base).getTime(), agora); if (sem < 1) { erro = 'A temporada ainda não começou.'; return est; }
    const v = visao(est, sem, usuario);
    if (v.escolhido) { erro = 'Você já escolheu o Stand desta semana.'; return est; }
    let id = String(b.id || ''); let manteve = false;
    if (id === 'manter') { if (!v.manter) { erro = 'Você não pode manter o Stand desta semana. O rodízio exige trocar após 2 semanas, ou ele foi escolhido por outro piloto.'; return est; } id = v.manter.id; manteve = true; }
    else if (!v.ofertas.some((s) => s.id === id)) { erro = 'Esse Stand não está entre as suas ofertas. Atualize a página e escolha de novo.'; return est; }
    if (ocupados(est, sem).has(id)) { erro = 'Esse Stand acabou de ser escolhido por outro piloto. Atualize a página.'; return est; }
    est.semanas[sem] = est.semanas[sem] || {}; est.semanas[sem][usuario] = { stand: id, em: new Date(agora).toISOString(), ...(manteve ? { manteve: true } : {}) }; escolhido = POR_ID[id];
    return est;
  }, 'Stands: escolha da semana');
  CACHE.est = null;
  if (erro) return u.json(res, 400, { erro });
  try { require('./cronica').limparCache(); } catch { /* sem cache */ }
  return u.json(res, 200, { ok: true, stand: escolhido });
}
// Contexto para a crônica: escolhas recentes e se o piloto tinha um Stand furtivo na semana do lance (o ataque dele não é revelado).
// Vantagem de tipo (Fase 2): cada tipo vence dois outros. Vantagem = +1 no d10 do atacante; desvantagem = -1. Fraqueza ligada ao evento da semana = -1 para quem tem a etiqueta.
const ADV = { corpo: ['truque', 'objeto'], longo: ['corpo', 'enxame'], ambiente: ['longo', 'rastro'], objeto: ['ambiente', 'sorte'], enxame: ['rastro', 'truque'], rastro: ['corpo', 'longo'], truque: ['ambiente', 'sorte'], sorte: ['enxame', 'longo'] };
const FRAQ_EVENTO = { nevoeiro: ['luz'], chuva: ['agua'] };
const hnum = (t) => crypto.createHash('sha1').update(t).digest().readUInt32BE(0);
const CHANCE_FURTIVO = 70, CHANCE_VS_FURTIVO = 50, CHANCE_VS_RASTRO = 30;
function criarOraculo(est, base) {
  const stand = (usuario, ms) => { const e = dessa(est, semDeMs(base, ms))[usuario]; return (e && POR_ID[e.stand]) || null; };
  // Um Stand furtivo só se esconde com chance: 70%; cai para 50% contra outro furtivo e 30% contra um Rastreador (que fareja o atacante).
  const oculto = (de, para, emISO) => { const sa = stand(de, new Date(emISO).getTime()); if (!(sa && sa.furtivo)) return false; const sv = para ? stand(para, new Date(emISO).getTime()) : null; const ch = sv && sv.tipo === 'rastro' ? CHANCE_VS_RASTRO : sv && sv.furtivo ? CHANCE_VS_FURTIVO : CHANCE_FURTIVO; return hnum(`oculto|${emISO}|${de}|${para}`) % 100 < ch; };
  // Plano de batalha entre atacante e defensor: ajuste de +1/-1 no dado e a frase que explica.
  const duelo = (de, alvo, ms, evento) => {
    const sa = stand(de, ms), sv = alvo && alvo !== de ? stand(alvo, ms) : null; let aj = 0; const t = [];
    if (sa && sv) { if (ADV[sa.tipo].includes(sv.tipo)) { aj++; t.push(`${sa.ic} ${sa.tipoNome} leva vantagem sobre ${sv.ic} ${sv.tipoNome} (+1 no dado)`); } else if (ADV[sv.tipo].includes(sa.tipo)) { aj--; t.push(`${sv.ic} ${sv.tipoNome} leva vantagem sobre ${sa.ic} ${sa.tipoNome} (-1 no dado)`); } }
    const fr = FRAQ_EVENTO[evento] || []; if (sa && fr.some((x) => (sa.tags || []).includes(x))) { aj--; t.push(`${sa.nome} sofre com o evento da semana (-1 no dado)`); }
    return { aj, txt: t.length ? '⚔️ ' + t.join('; ') + '. ' : '' };
  };
  return { est, stand, oculto, duelo, furtivo: (usuario, ms) => { const x = stand(usuario, ms); return !!(x && x.furtivo); } };
}
async function contexto(copas) { const est = await estadoCache(); return criarOraculo(est, baseDe(est, copas)); }
function fatos(ctx, alunos, agora, dias, rot, quip) {
  const ini = agora - dias * 864e5; const out = []; const meus = new Set(alunos);
  for (const m of Object.values(ctx.est.semanas)) for (const [usu, e] of Object.entries(m)) {
    const em = new Date(e.em).getTime(); if (!(em >= ini) || !POR_ID[e.stand] || !meus.has(usu)) continue; const s = POR_ID[e.stand]; const p = rot(usu);
    out.push({ em: e.em, tipo: 'fato', ic: '👤', nome: e.manteve ? 'Stand mantido' : 'Stand desperto', falas: [
      { q: 'silas', t: e.manteve ? `${p} escutou de novo o mesmo sussurro e manteve ${s.nome}, um Stand de ${s.tipoNome.toLowerCase()}.` : `${p} escolheu uma voz entre as três e despertou ${s.nome}, um Stand de ${s.tipoNome.toLowerCase()}. ${s.poder}` },
      { q: 'tiao', t: quip(`${e.em}|${usu}`) }] });
  }
  return out;
}
module.exports = { ADV, criarOraculo, BANCO, POR_ID, TIPOS, MAX_SEGUIDAS, visao, norm, ler, escolher, contexto, fatos, seguidas, ocupados };
