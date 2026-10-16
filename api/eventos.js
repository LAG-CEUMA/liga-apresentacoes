'use strict';
// Eventos: lista, inscrição (login do GitHub), confirmação, check-in e criação por quem tem a permissão Presença.
const u = require('../lib/util'); const d = require('../lib/dados'); const E = require('../lib/eventos'); const C = require('../lib/certificado');
const lote = async (itens, fn, n = 6) => { for (let i = 0; i < itens.length; i += n) await Promise.all(itens.slice(i, i + n).map(fn)); };
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const gestor = !!usuario && u.temPerm(cfg, usuario, 'presenca');
    const membro = !!usuario && u.papel(cfg, usuario) !== 'visitante';
    const hoje = u.hojeBR();
    const q = req.query || {};
    if (req.method === 'GET') {
      const todos = await E.carregar();
      if (q.acao === 'inscritos') {
        if (!gestor) return u.json(res, 403, { erro: 'Sem permissão.' });
        const t = todos[q.id]; if (!t) return u.json(res, 404, { erro: 'Evento não encontrado.' });
        const s = E.situacao(t.evento, t.inscricoes);
        return u.json(res, 200, { evento: t.evento, inscritos: Object.values(t.inscricoes).sort((a, b) => String(a.em).localeCompare(String(b.em))).map((i) => ({ usuario: i.usuario, nome: i.nome, estado: i.estado, presente: i.presente === undefined ? null : i.presente, espera: i.estado !== 'cancelado' && s.espera(i.usuario) })) });
      }
      const lista = [];
      for (const { evento: ev, inscricoes } of Object.values(todos)) {
        if (ev.visibilidade !== 'publico' && !membro) continue;
        const s = E.situacao(ev, inscricoes); const mi = usuario ? inscricoes[usuario] : null;
        const limite = ev.inscricaoAte || ev.data;
        const aberto = (!limite || hoje <= limite) && (!ev.data || hoje <= ev.data);
        const todosI = Object.values(inscricoes);
        lista.push({ ...ev, aberto, passou: !!ev.data && ev.data < hoje, inscritos: s.ativos.length, vagasLivres: s.vagasLivres,
          ...(gestor ? { presentes: todosI.filter((i) => i.presente === true).length, naoCompareceram: todosI.filter((i) => i.presente === false && i.estado !== 'cancelado').length } : {}),
          minha: mi ? { estado: mi.estado, nome: mi.nome, presente: mi.presente === undefined ? null : mi.presente, espera: mi.estado !== 'cancelado' && s.espera(usuario), posicao: s.pos[usuario] || null,
            codigo: mi.presente === true && ev.certificado ? C.codigo(ev.id, usuario) : null } : null });
      }
      lista.sort((a, b) => String(b.data).localeCompare(String(a.data)));
      return u.json(res, 200, { usuario, gestor, membro, hoje, tipos: E.TIPOS_EVENTO, eventos: lista });
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    if (!usuario) return u.json(res, 401, { erro: 'Entre com o GitHub.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const id = String(b.id || '').trim().toUpperCase();
    if (!E.ID_RE.test(id)) return u.json(res, 400, { erro: 'Código do evento: 2 a 30 letras, números ou traço (ex.: GAMEJAM-2026).' });
    const todos = await E.carregar(); const t = todos[id];
    if (b.acao === 'evento') {
      if (!gestor) return u.json(res, 403, { erro: 'Você não tem permissão para criar eventos.' });
      const novo = E.limpar(b, id, t ? t.evento.criadoPor : usuario);
      if (!novo.titulo) return u.json(res, 400, { erro: 'Dê um título ao evento.' });
      await d.mudarJson(E.caminhoEvento(id), () => novo, `Portal: ${usuario} ${t ? 'editou' : 'criou'} o evento ${id}`);
      return u.json(res, 200, { ok: true });
    }
    if (!t) return u.json(res, 404, { erro: 'Evento não encontrado.' });
    const ev = t.evento;
    if (b.acao === 'excluir_evento') {
      if (!gestor) return u.json(res, 403, { erro: 'Sem permissão.' });
      return u.json(res, 400, { erro: `Por segurança o portal não apaga arquivos. Para excluir, apague a pasta dados/eventos/${id} no repositório liga-curriculo (GitHub) ou deixe o evento como histórico.` });
    }
    if (b.acao === 'inscrever') {
      if (ev.visibilidade !== 'publico' && !membro) return u.json(res, 403, { erro: 'Evento só para membros da liga.' });
      const limite = ev.inscricaoAte || ev.data;
      if ((limite && hoje > limite) || (ev.data && hoje > ev.data)) return u.json(res, 400, { erro: 'As inscrições deste evento já encerraram.' });
      const nome = E.txt(b.nome, 60) || usuario; const atual = t.inscricoes[usuario];
      await d.mudarJson(E.caminhoInsc(id, usuario), (x) => ({ ...(x || {}), usuario, nome, estado: x && x.estado === 'confirmado' ? 'confirmado' : 'inscrito', em: x && x.estado !== 'cancelado' ? x.em : new Date().toISOString() }), `Portal: inscrição no evento ${id}`);
      return u.json(res, 200, { ok: true, novo: !atual });
    }
    if (b.acao === 'cancelar' || b.acao === 'confirmar') {
      const mi = t.inscricoes[usuario]; if (!mi || mi.estado === 'cancelado') return u.json(res, 400, { erro: 'Você não está inscrito neste evento.' });
      if (ev.data && hoje > ev.data) return u.json(res, 400, { erro: 'O evento já aconteceu.' });
      await d.mudarJson(E.caminhoInsc(id, usuario), (x) => ({ ...x, estado: b.acao === 'cancelar' ? 'cancelado' : 'confirmado' }), `Portal: ${b.acao === 'cancelar' ? 'cancelamento' : 'confirmação'} no evento ${id}`);
      return u.json(res, 200, { ok: true });
    }
    if (b.acao === 'checkin') {
      if (!gestor) return u.json(res, 403, { erro: 'Sem permissão.' });
      const alvos = Object.entries(b.estados && typeof b.estados === 'object' ? b.estados : {}).filter(([k]) => u.USER_RE.test(k)).slice(0, 400);
      const mudar = alvos.filter(([k, v]) => { const i = t.inscricoes[k]; return typeof v === 'boolean' && (!i || i.presente !== v); });
      await lote(mudar, ([k, v]) => d.mudarJson(E.caminhoInsc(id, k), (x) => ({ ...(x || { usuario: k, nome: k, estado: 'confirmado', em: new Date().toISOString() }), presente: v, checkinPor: usuario, checkinEm: new Date().toISOString() }), `Portal: ${usuario} registrou o comparecimento no evento ${id}`));
      return u.json(res, 200, { ok: true, alterados: mudar.length });
    }
    return u.json(res, 400, { erro: 'Ação inválida.' });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui carregar ou salvar agora. Tente de novo.' }); }
};
