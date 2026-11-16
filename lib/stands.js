'use strict';
// Stands do Spin Run LAG (Fase 1): banco de Stands, escolha semanal de 1 entre 3, rodízio (no máximo 2 semanas seguidas com o mesmo)
// e exclusividade (dois pilotos da mesma Copa não têm o mesmo Stand na mesma semana). Por enquanto os Stands não mudam pontos:
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
];
const BANCO = T.map(([id, nome, tipo, estilo, dif, poder, fraqueza, tags]) => ({ id, nome, tipo, tipoNome: TIPOS[tipo][0], ic: TIPOS[tipo][1], estilo: ESTILOS[estilo], dif: DIFS[dif], poder, fraqueza, tags }));
const POR_ID = Object.fromEntries(BANCO.map((s) => [s.id, s]));
const MAX_SEGUIDAS = 2;
const caminho = (chave) => `dados/stands/${chave}.json`;
const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);
const vazio = () => ({ semanas: {} });
const norm = (x) => { const e = x && typeof x === 'object' ? x : vazio(); e.semanas = e.semanas && typeof e.semanas === 'object' ? e.semanas : {}; return e; };
const dessa = (est, sem) => est.semanas[sem] || {};
const ocupados = (est, sem, exceto) => new Set(Object.entries(dessa(est, sem)).filter(([k]) => k !== exceto).map(([, v]) => v.stand));
// Quantas semanas seguidas, terminando na semana anterior a "sem", o piloto ficou com o Stand "id".
function seguidas(est, sem, usuario, id) { let n = 0; for (let s = sem - 1; s >= 1; s--) { const e = dessa(est, s)[usuario]; if (e && e.stand === id) n++; else break; } return n; }
const jaTeve = (est, sem, usuario) => { const r = new Set(); for (const [s, m] of Object.entries(est.semanas)) if (Number(s) < sem && m[usuario]) r.add(m[usuario].stand); return r; };
// Estado do piloto na semana: o Stand escolhido, ou as 3 ofertas (sorteio fixo da semana) e se pode manter o atual.
function visao(est, chave, sem, usuario) {
  const esc = dessa(est, sem)[usuario];
  if (esc) return { semana: sem, escolhido: { ...POR_ID[esc.stand], manteve: !!esc.manteve, seguidas: seguidas(est, sem, usuario, esc.stand) + 1 }, total: BANCO.length };
  const livres = BANCO.filter((s) => !ocupados(est, sem).has(s.id)); const ant = dessa(est, sem - 1)[usuario];
  const seg = ant ? seguidas(est, sem, usuario, ant.stand) : 0;
  const podeManter = !!(ant && seg < MAX_SEGUIDAS && !ocupados(est, sem).has(ant.stand));
  const tinha = jaTeve(est, sem, usuario); const semAnt = (ant ? livres.filter((s) => s.id !== ant.stand) : livres);
  let pool = semAnt.filter((s) => !tinha.has(s.id)); if (pool.length < 3) pool = semAnt;
  const ofertas = pool.slice().sort((a, b) => hash(`${chave}|${sem}|${usuario}|${a.id}`) - hash(`${chave}|${sem}|${usuario}|${b.id}`)).slice(0, 3);
  return { semana: sem, escolhido: null, ofertas, manter: podeManter ? { ...POR_ID[ant.stand], seguidas: seg } : null, atualAcabou: !!(ant && !podeManter && seg >= MAX_SEGUIDAS), total: BANCO.length };
}
const semDe = (cx, agora) => Math.max(0, C.semanaDe(cx.t.inicio, agora));
async function lerEstado(chave) { const { dados } = await d.lerJson(caminho(chave)); return norm(dados); }
const CACHE = new Map(); const TTL = 20000;
async function estadoCache(chave) { const c = CACHE.get(chave); if (c && Date.now() - c.em < TTL) return c.est; const est = await lerEstado(chave); CACHE.set(chave, { em: Date.now(), est }); return est; }
async function pilotoCopa(cfg, usuario, dono, monitor, turmaOk, turma) {
  const copas = await require('./cronica').copasDe(cfg, usuario, dono, monitor, turmaOk);
  const minhas = copas.filter((c) => c.aluno && c.aberta);
  return { copas, alvo: minhas.find((c) => c.turma === String(turma || '').toUpperCase()) || minhas[0] || null };
}
async function ler(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const q = req.query || {}; const agora = Date.now();
  const { copas, alvo } = await pilotoCopa(cfg, usuario, dono, monitor, turmaOk, q.turma);
  if (dono) { // visão do professor: quem tem qual Stand na semana
    const c = copas.find((x) => x.turma === String(q.turma || '').toUpperCase()) || copas.find((x) => x.modo === 'participa') || copas[0]; if (!c) return u.json(res, 200, { semCopa: true });
    const est = await estadoCache(c.cx.chave); const sem = semDe(c.cx, agora); const nomes = await CA.nomesDa(c.cx.t.alunos || []);
    const lista = (c.cx.t.alunos || []).filter((a) => !/^ficticio-/.test(a)).sort().map((a) => { const e = dessa(est, sem)[a]; const n = String(nomes[a] || '').trim().split(/\s+/)[0]; return { usuario: a, nome: n || a, stand: e ? POR_ID[e.stand].nome : '', manteve: !!(e && e.manteve) }; });
    return u.json(res, 200, { copa: { turma: c.turma, nome: c.nome }, semana: sem, dono: true, banco: BANCO.length, escolheram: lista.filter((x) => x.stand).length, total: lista.length, lista });
  }
  if (!alvo) return u.json(res, 200, { semCopa: true });
  const sem = semDe(alvo.cx, agora); if (sem < 1) return u.json(res, 200, { semCopa: true });
  const est = await estadoCache(alvo.cx.chave);
  return u.json(res, 200, { copa: { turma: alvo.turma, nome: alvo.nome }, ...visao(est, alvo.cx.chave, sem, usuario) });
}
// O piloto escolhe um Stand: uma das 3 ofertas ou "manter" o atual (no máximo 2 semanas seguidas). Vale para a semana toda.
async function escolher(res, b, { cfg, usuario, dono, monitor, turmaOk }) {
  if (dono) return u.json(res, 403, { erro: 'Só os pilotos escolhem Stands.' });
  const { alvo } = await pilotoCopa(cfg, usuario, dono, monitor, turmaOk, b.turma);
  if (!alvo) return u.json(res, 403, { erro: 'Você não participa de uma Copa aberta.' });
  const agora = Date.now(); const sem = semDe(alvo.cx, agora); if (sem < 1) return u.json(res, 400, { erro: 'A temporada ainda não começou.' });
  const chave = alvo.cx.chave; let erro = '', escolhido = null;
  await d.mudarJson(caminho(chave), (cur) => {
    const est = norm(cur); const v = visao(est, chave, sem, usuario);
    if (v.escolhido) { erro = 'Você já escolheu o Stand desta semana.'; return est; }
    let id = String(b.id || ''); let manteve = false;
    if (id === 'manter') { if (!v.manter) { erro = 'Você não pode manter o Stand desta semana. O rodízio exige trocar após 2 semanas, ou ele foi escolhido por outro piloto.'; return est; } id = v.manter.id; manteve = true; }
    else if (!v.ofertas.some((s) => s.id === id)) { erro = 'Esse Stand não está entre as suas ofertas. Atualize a página e escolha de novo.'; return est; }
    if (ocupados(est, sem).has(id)) { erro = 'Esse Stand acabou de ser escolhido por outro piloto. Atualize a página.'; return est; }
    est.semanas[sem] = est.semanas[sem] || {}; est.semanas[sem][usuario] = { stand: id, em: new Date(agora).toISOString(), ...(manteve ? { manteve: true } : {}) }; escolhido = POR_ID[id];
    return est;
  }, `Stands ${chave}: escolha da semana ${sem}`);
  CACHE.delete(chave);
  if (erro) return u.json(res, 400, { erro });
  try { require('./cronica').limparCache(); } catch { /* sem cache */ }
  return u.json(res, 200, { ok: true, stand: escolhido });
}
// Escolhas recentes viram fatos da crônica da trilha (dois narradores). rot(k) = rótulo do piloto.
async function fatos(chave, agora, dias, rot, quip) {
  const est = await estadoCache(chave); const ini = agora - dias * 864e5; const out = [];
  for (const m of Object.values(est.semanas)) for (const [usu, e] of Object.entries(m)) {
    const em = new Date(e.em).getTime(); if (!(em >= ini) || !POR_ID[e.stand]) continue; const s = POR_ID[e.stand]; const p = rot(usu);
    out.push({ em: e.em, tipo: 'fato', ic: '👤', nome: e.manteve ? 'Stand mantido' : 'Stand desperto', falas: [
      { q: 'silas', t: e.manteve ? `${p} escutou de novo o mesmo sussurro e manteve ${s.nome}, um Stand de ${s.tipoNome.toLowerCase()}.` : `${p} escolheu uma voz entre as três e despertou ${s.nome}, um Stand de ${s.tipoNome.toLowerCase()}. ${s.poder}` },
      { q: 'tiao', t: quip(`${e.em}|${usu}`) }] });
  }
  return out;
}
module.exports = { BANCO, POR_ID, TIPOS, MAX_SEGUIDAS, visao, norm, ler, escolher, fatos, seguidas, ocupados };
