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
  { id: 'eco', tipo: 'inusitado', ic: '📣', nome: 'Eco misterioso', tags: ['som'], piloto: true, txt: 'Um eco misterioso repetiu o que {piloto} disse, mas com a voz de um narrador de esportes. Foi a melhor entrada de personagem da corrida.' },
];
const PORTA = { armadilha: 'Armadilha', npc: 'NPC hostil', aliado: 'NPC aliado', fenomeno: 'Fenômeno', inusitado: 'Inusitado' };
const hojeBR = (agora) => new Date(agora - 3 * 36e5).toISOString().slice(0, 10);
const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);
const trechoDe = (inicio, agora) => TRECHOS[(Math.max(1, C.semanaDe(inicio, agora)) - 1) % TRECHOS.length];
function montar(ev, piloto, agora, inicio, origem) {
  const txt = ev.txt.replace(/\{piloto\}/g, piloto ? '@' + piloto : 'um piloto');
  return { id: crypto.randomBytes(4).toString('hex'), em: new Date(agora).toISOString(), tipo: ev.tipo, ic: ev.ic, nome: ev.nome, texto: txt, tags: ev.tags, trecho: trechoDe(inicio, agora), origem: origem || 'sorteio', ...(piloto ? { piloto } : {}) };
}
// Sorteia o acontecimento do dia, de forma determinística (mesma data e Copa dão o mesmo evento), sem repetir os últimos 8.
function sortear(chave, dia, recentes) {
  const livres = EVENTOS.filter((e) => !recentes.includes(e.id)); const lista = livres.length ? livres : EVENTOS;
  return lista[hash(`${chave}|${dia}`) % lista.length];
}
// Fatos reais da Copa (log) em frases curtas. O autor dos ataques continua em segredo, como no jogo.
function fatos(est, agora, dias) {
  const ini = agora - dias * 864e5, out = []; const nm = (k) => (k === 'chefao' ? 'O Chefão' : '@' + k);
  for (const l of (est.log || [])) {
    const em = new Date(l.em).getTime(); if (!(em >= ini)) continue;
    const it = C.ITENS[l.item] || C.BOSS[l.item] || null; const base = { em: l.em, tipo: 'fato' };
    if (l.evento === 'alianca' || (l.item === 'alianca' && !l.traicao && l.evento !== 'traicao')) out.push({ ...base, ic: '🤝', nome: 'Aliança', texto: `Uma aliança nasceu entre @${l.de} e @${l.para}. A pista nunca viu uma dupla tão decidida!` });
    else if (l.traicao || l.evento === 'traicao') out.push({ ...base, ic: '🗡️', nome: 'Traição', texto: 'Uma aliança se desfez de repente. Alguém olhou para o lado e viu a oportunidade. A pista guarda segredo.' });
    else if (l.item === 'evento' && C.EVENTOS[l.evento]) out.push({ ...base, ic: C.EVENTOS[l.evento].ic, nome: C.EVENTOS[l.evento].nome, texto: `${C.EVENTOS[l.evento].nome} cobre a pista! ${C.EVENTOS[l.evento].txt}` });
    else if (l.item === 'missao') out.push({ ...base, ic: '🎯', nome: 'Missão cumprida', texto: 'A missão coletiva foi cumprida! Todo mundo entregou no prazo e os itens choveram sobre a pista.' });
    else if (l.item === 'chuva-professor') out.push({ ...base, ic: '🌧️', nome: 'Chuva de itens', texto: 'Uma chuva de itens caiu sobre os pilotos! Quem estava com as mãos livres aproveitou.' });
    else if (l.de === 'roleta' && l.para) out.push({ ...base, ic: '🎰', nome: 'Roleta maluca', texto: `A Roleta maluca escolheu @${l.para}. Isso é jogo de sorte, e o destino adora uma surpresa.` });
    else if (l.faixa && it) {
      const vit = l.vit ? nm(l.vit) : ''; const boss = l.de === 'chefao';
      if (l.faixa === 'falha_critica' || l.faixa === 'falha') out.push({ ...base, ic: '🎲', nome: 'Dado falhou', texto: boss ? `O Chefão tentou usar ${it.ic} ${it.nome}, mas o dado não ajudou. Até o chefe erra!` : `Alguém tentou usar ${it.ic} ${it.nome}, mas o dado não ajudou. Respeitem o azar do piloto!` });
      else if (l.bloq && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', texto: `${vit} levantou o escudo bem na hora e bloqueou ${it.ic} ${it.nome}!` });
      else if (l.red && vit) out.push({ ...base, ic: '🛡️', nome: 'Defesa', texto: `O escudo de ${vit} amorteceu ${it.ic} ${it.nome}. Doeu menos do que podia!` });
      else if (vit && l.vit !== l.de) out.push({ ...base, ic: boss ? '👹' : '🎯', nome: boss ? 'Chefão ataca' : 'Ataque', texto: boss ? `O Chefão acordou e mandou ${it.ic} ${it.nome} em ${vit}!` : `${vit} foi atingido por ${it.ic} ${it.nome}. Quem foi? Segredo de Estado! 🕵️` });
    }
  }
  return out;
}
async function lerArquivo(chave) { const { dados } = await d.lerJson(caminho(chave)); return dados && typeof dados === 'object' ? dados : { entradas: [], dias: {} }; }
const gravar = (chave, mudar, msg) => d.mudarJson(caminho(chave), (cur) => { const x = cur && typeof cur === 'object' ? cur : {}; x.entradas = Array.isArray(x.entradas) ? x.entradas : []; x.dias = x.dias && typeof x.dias === 'object' ? x.dias : {}; const r = mudar(x); x.entradas = x.entradas.slice(-200); return r || x; }, msg);
const CACHE = new Map(); const TTL = 60000;
function copasDe(cfg, usuario, staff, turmaOk) {
  const vis = new Map();
  for (const [id, t] of Object.entries(cfg.turmas || {})) {
    if (t.status === 'arquivada') continue;
    const aluno = (t.alunos || []).includes(usuario); if (!aluno && !(staff && turmaOk(id))) continue;
    const cx = CA.contexto(cfg, id); if (!vis.has(cx.chave)) vis.set(cx.chave, { turma: id, nome: cx.plano ? (cx.plano.trilha || cx.plano.nome) : t.nome, aluno });
    else if (aluno) vis.get(cx.chave).aluno = true;
  }
  return [...vis.values()];
}
async function ler(req, res, { cfg, usuario, dono, monitor, turmaOk }) {
  const q = req.query || {}; const staff = dono || !!monitor; const agora = Date.now();
  const copas = copasDe(cfg, usuario, staff, turmaOk);
  if (!copas.length) return u.json(res, 200, { jogo: NOME_JOGO, semCopa: true });
  const alvo = copas.find((c) => c.turma === String(q.turma || '').toUpperCase()) || copas[0];
  const cx = CA.contexto(cfg, alvo.turma); const t = cx.t;
  const ck = cx.chave + '|' + (staff ? 's' : 'a'); const c = CACHE.get(ck);
  if (c && agora - c.em < TTL) return u.json(res, 200, { ...c.resp, copas: staff ? copas : undefined });
  const est = C.normalizar(await CA.lerEstado(cx));
  if (!est.ativa) return u.json(res, 200, { jogo: NOME_JOGO, inativa: true, copas: staff ? copas : undefined });
  if (!staff && est.visibilidade === 'oculta') return u.json(res, 200, { jogo: NOME_JOGO, oculta: true });
  let arq = await lerArquivo(cx.chave); const dia = hojeBR(agora);
  const alunos = (t.alunos || []).filter((a) => !/^ficticio-/.test(a));
  if (!arq.dias[dia] && alunos.length && t.inicio && agora >= new Date(t.inicio + 'T00:00:00-03:00').getTime() && (!t.fim || agora <= new Date(t.fim + 'T23:59:59-03:00').getTime() + 7 * 864e5)) {
    arq = await gravar(cx.chave, (x) => {
      if (x.dias[dia]) return x;
      const recentes = x.entradas.slice(-8).map((e) => e.evId).filter(Boolean);
      const ev = sortear(cx.chave, dia, recentes); const piloto = ev.piloto ? alunos[hash(`${cx.chave}|${dia}|p`) % alunos.length] : '';
      const e = montar(ev, piloto, agora, t.inicio, 'sorteio'); e.evId = ev.id; x.entradas.push(e); x.dias[dia] = e.id; return x;
    }, `Crônica ${cx.chave}: acontecimento do dia`);
  }
  const lista = [...(arq.entradas || []).map((e) => ({ em: e.em, tipo: e.tipo, ic: e.ic, nome: e.nome, texto: e.texto, trecho: e.trecho, origem: e.origem })), ...fatos(est, agora, 7)]
    .sort((a, b) => new Date(b.em) - new Date(a.em)).slice(0, 40);
  const resp = { jogo: NOME_JOGO, copa: { turma: alvo.turma, nome: alvo.nome }, trecho: trechoDe(t.inicio, agora), semana: C.semanaDe(t.inicio, agora), entradas: lista, tipos: PORTA, catalogo: dono ? EVENTOS.map((e) => ({ id: e.id, nome: e.nome, ic: e.ic, tipo: e.tipo })) : undefined, atualizado: new Date(agora).toISOString() };
  CACHE.set(ck, { em: agora, resp });
  return u.json(res, 200, { ...resp, copas: staff ? copas : undefined });
}
// O professor dispara um acontecimento (um do catálogo ou sorteado). No máximo 5 por dia, para não encher a crônica.
async function disparar(res, b, { cfg, dono, turmaOk }) {
  const turma = String(b.turma || '').toUpperCase(); const t0 = cfg.turmas[turma];
  if (!dono || !t0 || !turmaOk(turma)) return u.json(res, 403, { erro: 'Só o professor dispara acontecimentos.' });
  const cx = CA.contexto(cfg, turma); const t = cx.t; const agora = Date.now(); const dia = hojeBR(agora);
  const alunos = (t.alunos || []).filter((a) => !/^ficticio-/.test(a));
  let ev = EVENTOS.find((e) => e.id === String(b.evento || ''));
  if (!ev) ev = EVENTOS[crypto.randomInt(EVENTOS.length)];
  const piloto = ev.piloto && alunos.length ? alunos[crypto.randomInt(alunos.length)] : '';
  let aviso = '';
  await gravar(cx.chave, (x) => {
    const hoje = x.entradas.filter((e) => e.origem === 'professor' && hojeBR(new Date(e.em).getTime()) === dia).length;
    if (hoje >= 5) { aviso = 'Já foram disparados 5 acontecimentos hoje. Amanhã tem mais.'; return x; }
    const e = montar(ev, piloto, agora, t.inicio, 'professor'); e.evId = ev.id; x.entradas.push(e); return x;
  }, `Crônica ${cx.chave}: acontecimento disparado por professor`);
  if (aviso) return u.json(res, 400, { erro: aviso });
  CACHE.clear();
  return u.json(res, 200, { ok: true, resultado: `${ev.ic} ${ev.nome}` });
}
module.exports = { ler, disparar, EVENTOS, NOME_JOGO, fatos, sortear, TRECHOS };
