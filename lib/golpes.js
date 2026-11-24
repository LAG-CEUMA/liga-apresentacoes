'use strict';
// Golpes próprios de cada Stand. Substituem os nomes dos itens antigos da Copa (banana, casco, escudo...):
// o efeito em pontos continua sendo o da regra da Copa, mas quem age é o Stand, com o golpe dele.
// [ataque (papel da banana), golpe final (papel do casco), defesa (papel do escudo)]
const G = {
  punho: ['Soco Ferrugem', 'Martelada do Ferro-Velho', 'Muro de Sucata'], caval: ['Coice Fora de Hora', 'Galope Desembestado', 'Cerca de Pau'],
  luva: ['Aperto do Xerife', 'Prisão em Nome da Lei', 'Distintivo Blindado'], espora: ['Chute Duplo', 'Estrela de Esporas', 'Salto Atrás'],
  ferradura: ['Ferradura Ímã', 'Retorno da Dama', 'Arco de Sorte Pesada'], chicote: ['Estalo de Faísca', 'Raio do Laço Elétrico', 'Cortina de Faíscas'],
  bigode: ['Tapa de Bigode', 'Bigodaço Furioso', 'Bigode Eriçado'], martelo: ['Batida de Bigorna', 'Mil Bigornas', 'Escudo de Forja'],
  gelo: ['Bala de Gelo', 'Rajada Congelante', 'Pólvora Fria em Casca'], corvo: ['Pena Perseguidora', 'Chuva de Penas Negras', 'Asa Fechada'],
  estilingue: ['Pedrada Real', 'Sapatada de Honra', 'Pulo do Estilingue'], arco: ['Flecha de Espinho', 'Cacto no Alvo', 'Moita de Cactos'],
  trovao: ['Estalo da Lata', 'Tempestade Engarrafada', 'Silêncio de Chumbo'], sal: ['Tiro de Sal', 'Salgadão Geral', 'Crosta de Sal'],
  boleadeira: ['Bola Giratória', 'Laço Estelar', 'Giro de Defesa'], lanca: ['Sopro Cortante', 'Lança Atravessa-Porta', 'Vento em Volta'],
  canion: ['Fenda Curta', 'Desfiladeiro Fechado', 'Parede de Cânion'], poeiraouro: ['Nuvem Dourada', 'Tontura de Ouro', 'Cortina de Poeira'],
  neblina: ['Véu de Campina', 'Neblina Cega', 'Manto de Névoa'], eclipse: ['Apagão de Bolso', 'Eclipse Total', 'Sombra Própria'],
  domingo: ['Pé-d-Água Dirigido', 'Dilúvio de Domingo', 'Guarda-Chuva do Dono'], contrario: ['Sopro de Volta', 'Furacão ao Contrário', 'Rajada Refletida'],
  vila: ['Sussurro da Vila', 'Cidade Que Some', 'Portão Fantasma'], trem: ['Apito Atrasa-Tudo', 'Trem Que Não Passa', 'Trilho Interditado'],
  relogio: ['Cinco Segundos Roubados', 'Ponteiro Quebrado', 'Tique-Taque Defensivo'], mapa: ['Atalho Errado', 'Caminho Pro Nada', 'Dobra do Mapa'],
  lampiao: ['Clarão Sem Pavio', 'Luz Que Revela Tudo', 'Chama Guardiã'], bau: ['Ouro Falso', 'Tesouro Sumido', 'Tampa Pesada'],
  chapeu: ['Chapeuzada', 'Voo da Aba Larga', 'Sombra do Chapéu'], sino: ['Badalada', 'Dobre Final da Capela', 'Eco de Proteção'],
  colher: ['Colherada', 'Panelaço Final', 'Tampa de Panela'], bussola: ['Norte Trocado', 'Desorientação Total', 'Agulha Teimosa'],
  cartas: ['Carta Navalha', 'Chuva de Baralho', 'Muro de Cartas'], vagalume: ['Ofuscada de Vagalumes', 'Noite Acesa', 'Nuvem de Luz'],
  sombras: ['Mordida de Sombra', 'Matilha Completa', 'Escuridão em Roda'], formigas: ['Ferroada de Ferro', 'Marcha das Formigas', 'Formigueiro Blindado'],
  gafanhoto: ['Nuvem de Gafanhotos', 'Praga de Ouro', 'Revoada Defensiva'], cardume: ['Peixe de Poeira', 'Correnteza Seca', 'Redemoinho de Cardume'],
  ras: ['Coaxar Alto', 'Coro Ensurdecedor', 'Lagoa Barulhenta'], faro: ['Rastro Fiel', 'Uivo do Lobo Solitário', 'Pelo Eriçado'],
  aguia: ['Mergulho de Papel', 'Olhar de Cima', 'Dobra de Asa'], ouvido: ['Passo Denunciado', 'Terra Que Fala', 'Chão em Alerta'],
  cavalosem: ['Passada Sem Dono', 'Estouro da Manada', 'Parada Súbita'], ecocav: ['Eco Que Volta', 'Mil Vozes Presas', 'Caverna Fechada'],
  gatorancho: ['Garra de Gato', 'Bote do Rancho', 'Pulo de Gato'], sombraatr: ['Sombra Que Chega Depois', 'Golpe Atrasado', 'Passo Fora do Tempo'],
  mascara: ['Troca de Rosto', 'Máscara Final', 'Rosto de Papel'], palhaco: ['Torta no Saloon', 'Número de Circo', 'Cambalhota Defensiva'],
  espelho: ['Reflexo Traiçoeiro', 'Praça dos Espelhos', 'Espelho Devolve'], magico: ['Truque de Feira', 'Grande Sumiço', 'Cortina de Mágico'],
  ventriloquo: ['Voz do Cacto', 'Cactos Gritam', 'Silêncio dos Cactos'], laco: ['Laço Curto', 'Cordão do Fim', 'Nó Cego'],
  cartomante: ['Carta Torta', 'Profecia Ruim', 'Aviso das Cartas'], dado: ['Dado Viciado', 'Seis Sempre Vira Um', 'Dado de Proteção'],
  trevo: ['Folha Perdida', 'Trevo Murcho', 'Sorte Sem Raiz'], moeda: ['Cara de Azar', 'Coroa de Espinhos', 'Moeda ao Ar'],
  poco: ['Desejo Torto', 'Poço Sem Fundo', 'Pedido de Paz'], gatopreto: ['Travessia Maldita', 'Sete Vidas Perdidas', 'Gato Atravessado'],
  coringa: ['Curinga Sujo', 'Jogada Final', 'Carta na Manga'], ferrasorte: ['Sorte Grande', 'Ferradura Premiada', 'Amuleto Pesado'],
  cotovelo: ['Cotovelada de Prata', 'Golpe Brilhante', 'Cotovelo Defensivo'], soco: ['Soco de Cobertor', 'Abafo Geral', 'Cobertor Grosso'],
  rodeio: ['Chifrada', 'Touro Solto', 'Arena Fechada'], fivela: ['Fivelada', 'Relâmpago de Cinto', 'Cinto Apertado'],
  botas: ['Passo de Chumbo', 'Pisão Leve', 'Raiz Nos Pés'], garra: ['Mordida de Cascavel', 'Veneno Lento', 'Chocalho de Aviso'],
  lutador: ['Voadora de Saloon', 'Cadeirada', 'Guarda de Saloon'], povoado: ['Empurrão do Povo', 'Multidão em Fúria', 'Roda de Gente'],
  carabina: ['Tiro de Estrela', 'Chuva de Estrelas', 'Brilho Defensivo'], dinamite: ['Estalinho de Dinamite', 'Explosão de Mentirinha', 'Fumaça de Pólvora'],
  lacofumaca: ['Laço de Fumaça', 'Nó Que Sufoca', 'Cortina de Fumaça'], catapulta: ['Pedrinha de Bolso', 'Bola de Fogo Pequena', 'Muro de Bolso'],
  dardos: ['Dardo de Cacto', 'Salva de Dardos', 'Espinhos Eriçados'], algodao: ['Tiro de Algodão', 'Nevasca de Algodão', 'Colchão de Algodão'],
  flechavela: ['Flecha de Vela', 'Chama Veloz', 'Cera Quente'], raioazul: ['Raio Azul', 'Trovão Azul de Poeira', 'Faísca Defensiva'],
  oasis: ['Miragem Teimosa', 'Oásis Falso', 'Água Real'], tempestade: ['Raio de Bolso', 'Temporal Pessoal', 'Nuvem Guarda-Costas'],
  luar: ['Lua Que Cega', 'Noite Eterna', 'Luar Protetor'], redemoinho: ['Giro Dançante', 'Tornado de Salão', 'Pirueta de Poeira'],
  pradaria: ['Capim Alto', 'Horizonte Sem Fim', 'Mato Fechado'], lago: ['Piso de Gelo', 'Lago Rachado', 'Gelo Grosso'],
  carnaval: ['Confete Surpresa', 'Bloco na Rua', 'Máscara de Folia'], nevoeiro: ['Apito Embaçado', 'Névoa de Locomotiva', 'Vapor Defensivo'],
  lanterna: ['Facho no Olho', 'Pesadelo Aceso', 'Luz de Cabeceira'], cantil: ['Banho de Cantil', 'Cheia do Cantil', 'Cantil Cheio'],
  cadeira: ['Balanço Hipnótico', 'Sono Real', 'Trono de Balanço'], telegrafo: ['Telegrama Fantasma', 'Aviso Final', 'Fio Cortado'],
  cobre: ['Moedada de Cobre', 'Fusão Final', 'Cobre Derretido'], lenco: ['Lenço no Rosto', 'Assalto Relâmpago', 'Nó no Lenço'],
  barril: ['Pólvora Mansa', 'Barril Rolante', 'Barril Tampado'], viola: ['Nota Desafinada', 'Cantoria Insuportável', 'Corda Arrebentada'],
  abelhas: ['Ferrão de Latão', 'Enxame Metálico', 'Colmeia Fechada'], mariposas: ['Poeira de Asa', 'Nuvem de Mariposas', 'Luz Falsa'],
  corujas: ['Piado Fatal', 'Voo Noturno', 'Olhos Arregalados'], besouros: ['Chifrada de Medalha', 'Besouro Condecorado', 'Casco de Medalha'],
  morcegos: ['Guincho de Cartola', 'Revoada de Cartolas', 'Capa de Morcegos'], serpentes: ['Bote de Corda', 'Nó de Serpentes', 'Espiral Defensiva'],
  pardais: ['Bicada de Telhado', 'Bando Furioso', 'Telhado Fechado'], raposa: ['Dentada Prateada', 'Rastro Que Engana', 'Toca Escondida'],
  olhomoeda: ['Olhar de Ganância', 'Moeda Que Vê', 'Pálpebra de Prata'], nariz: ['Farejada de Mineiro', 'Filão Descoberto', 'Nariz Entupido de Propósito'],
  cantor: ['Eco Cantado', 'Coral de Eco', 'Nota Aguda'], pegadas: ['Pegada Que Volta', 'Passos do Passado', 'Trilha Apagada'],
  vigia: ['Pá do Moinho', 'Vendaval de Pás', 'Moinho Parado'], sentinela: ['Espanto de Palha', 'Susto Final', 'Palha Eriçada'],
  cartola: ['Coelho Surpresa', 'Mil Coelhos', 'Fundo Falso'], sombrinha: ['Ponta de Sombrinha', 'Duelo de Sombrinhas', 'Guarda-Sol de Duelo'],
  jogador: ['Mão Fantasma', 'Aposta Alta', 'Blefe Forte'], ilusionista: ['Poeira nos Olhos', 'Clone de Poeira', 'Sumiço de Poeira'],
  boneco: ['Puxão de Fio', 'Marionete Total', 'Corpo de Madeira'], sumico: ['Pisca-Pisca', 'Desaparição Final', 'Sumiço de Emergência'],
  gargalhada: ['Risada Contagiosa', 'Gargalhada Geral', 'Riso Escudo'], pedra: ['Fofoca da Pedra', 'Pedra Que Grita', 'Pedra no Caminho'],
  sinoazar: ['Badalada do Azar', 'Dobre Fúnebre', 'Sino ao Contrário'], bola: ['Visão Rachada', 'Cristal Estilhaçado', 'Previsão Defensiva'],
  pecoelho: ['Pata Falsa', 'Sorte Emprestada', 'Pata Defensiva'], roleta: ['Giro do Saloon', 'Roleta-Russa de Pontos', 'Casa Sempre Ganha'],
  cartatorta: ['Destino Torto', 'Sentença Torta', 'Carta Virada'], apostador: ['Aposta Teimosa', 'Tudo ou Nada', 'Cobrir a Aposta']
};
// Papel de cada item da Copa dentro do golpe do Stand (o efeito em pontos continua o da regra da Copa).
// Cada Stand tem um ataque exclusivo. Ao evoluir (2ª semana seguida com ele), libera o segundo golpe (golpe final), usado no item Casco.
// Cada Stand tem UM ataque exclusivo (o primeiro nome da tabela): é ele que aparece nos itens de ataque (banana e casco). A defesa vem no escudo.
const PAPEL = { banana: 0, casco: 0, escudo: 2 };
const IC = { banana: '💥', casco: '☄️', escudo: '🛡️', turbo: '🏇', chuva: '🌩️', roleta: '🎲' };
// Nome do golpe de um Stand para o item usado; sem Stand, devolve null (a tela mostra o item antigo).
function golpe(stand, item) {
  if (!stand) return null; const g = G[stand.id]; if (!g) return null;
  if (item === 'casco' && stand.evoluido) return { ic: IC.casco, nome: g[1], evoluido: true }; // Stand evoluído: o casco vira o golpe final dele
  if (item in PAPEL) return { ic: IC[item], nome: g[PAPEL[item]] };
  const base = { turbo: 'Galope de ', chuva: 'Tempestade de ', roleta: 'Capricho de ' }[item]; if (!base) return null;
  return { ic: IC[item], nome: base + stand.nome };
}
module.exports = { G, golpe };
