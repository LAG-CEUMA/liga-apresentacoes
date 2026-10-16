'use strict';
// Painel: nível de cada aula, listas, monitores e equipe. Cada ação exige a permissão certa; só owners mexem na lista de owners e na equipe.
const u = require('../lib/util'); const d = require('../lib/dados');
const nomeGh = (x) => String(x).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();
const ler = (l) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
module.exports = async (req, res) => {
  try {
    const usuario = u.usuarioDaSessao(req);
    const { cfg } = await u.lerConfig();
    const perm = u.permissoes(cfg, usuario);
    const dono = u.papel(cfg, usuario) === 'owner';
    if (!dono && !perm.includes('aulas') && !perm.includes('pessoas')) return u.json(res, 403, { erro: 'Sem permissão.' });
    const aulas = await u.listarAulas();
    if (req.method === 'GET') {
      const v = { usuario, dono, permissoes: perm, fixos: dono ? u.admins() : [] };
      if (perm.includes('aulas') || perm.includes('pessoas')) v.aulas = aulas.map((a) => ({ dir: a.dir, chave: a.chave, nivel: a.nivel, titulo: a.titulo, id: a.id, tem_roteiro: !!a.roteiro,
        acesso: u.nivelDe(cfg, a.chave), url: `/aula/${a.chave}`, roteiro: a.roteiro ? `/aula/${a.chave}/roteiro` : null }));
      if (perm.includes('pessoas')) { v.owners = cfg.owners; v.alunos = cfg.alunos; v.monitores = cfg.monitores; v.turmas = cfg.turmas; v.cargos = cfg.cargos; }
      if (dono) { v.equipe = cfg.equipe; }
      v.listaPermissoes = u.PERMISSOES;
      return u.json(res, 200, v);
    }
    if (req.method !== 'POST') return u.json(res, 405, { erro: 'Método inválido.' });
    if (!u.origemOk(req) || !String(req.headers['content-type'] || '').includes('application/json')) return u.json(res, 403, { erro: 'Requisição recusada.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== 'object') return u.json(res, 400, { erro: 'Corpo inválido.' });
    const nao = () => u.json(res, 403, { erro: 'Você não tem permissão para esta ação.' });
    const novo = JSON.parse(JSON.stringify(cfg));
    const existe = new Set(aulas.map((a) => a.chave));
    const dirs = new Set(aulas.map((a) => a.dir));
    let msg;
    if (b.acao === 'acesso') {
      if (!perm.includes('aulas')) return nao();
      const chaves = Array.isArray(b.chaves) ? b.chaves : [b.chave];
      if (!chaves.length || chaves.length > 500 || !chaves.every((c) => existe.has(c)) || !u.NIVEIS.includes(b.nivel)) return u.json(res, 400, { erro: 'Aula ou nível inválido.' });
      for (const c of chaves) { if (b.nivel === 'owners') delete novo.aulas[c]; else novo.aulas[c] = b.nivel; }
      msg = chaves.length === 1 ? `Portal: ${usuario} definiu ${chaves[0]} como ${b.nivel}` : `Portal: ${usuario} definiu ${chaves.length} aulas (${String(b.nivel_nome || 'várias').slice(0, 40)}) como ${b.nivel}`;
    } else if (b.acao === 'listas') {
      if (!perm.includes('pessoas')) return nao();
      const alu = ler(b.alunos);
      let own = cfg.owners;
      if (dono) {
        own = ler(b.owners);
        if (!own.includes(usuario) && !u.admins().includes(usuario)) return u.json(res, 400, { erro: 'Você não pode se remover da lista de owners.' });
      }
      const ruim = [...own, ...alu].filter((x) => !u.USER_RE.test(x));
      if (ruim.length) return u.json(res, 400, { erro: `Usuário(s) inválido(s): ${ruim.slice(0, 5).join(', ')}` });
      novo.owners = own; novo.alunos = alu;
      msg = `Portal: ${usuario} atualizou as listas (${own.length} owners, ${alu.length} alunos)`;
    } else if (b.acao === 'monitor') {
      if (!perm.includes('pessoas')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros), turmas: (novo.monitores[nome] || {}).turmas || [] };
      msg = `Portal: ${usuario} definiu permissões do monitor ${nome} (${novo.monitores[nome].aulas.length} aulas, ${novo.monitores[nome].roteiros.length} roteiros)`;
    } else if (b.acao === 'remover_monitor') {
      if (!perm.includes('pessoas')) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.monitores[nome]) return u.json(res, 400, { erro: 'Monitor não encontrado.' });
      delete novo.monitores[nome];
      msg = `Portal: ${usuario} removeu o monitor ${nome}`;
    } else if (b.acao === 'equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const permissoes = (Array.isArray(b.permissoes) ? b.permissoes : []).filter((x) => u.PERMISSOES.includes(x));
      novo.equipe[nome] = { titulo: String(b.titulo || '').trim().slice(0, 40), permissoes, cargos: (novo.equipe[nome] || {}).cargos || [] };
      msg = `Portal: ${usuario} definiu a equipe de ${nome} (${novo.equipe[nome].titulo || 'sem título'}: ${permissoes.join(', ') || 'sem permissões'})`;
    } else if (b.acao === 'remover_equipe') {
      if (!dono) return nao();
      const nome = ler([b.usuario])[0];
      if (!nome || !novo.equipe[nome]) return u.json(res, 400, { erro: 'Pessoa não encontrada na equipe.' });
      delete novo.equipe[nome];
      msg = `Portal: ${usuario} removeu ${nome} da equipe`;
    } else if (b.acao === 'pessoa') {
      if (!perm.includes('pessoas')) return nao();
      const nome = nomeGh(b.usuario || '');
      if (!nome || !u.USER_RE.test(nome)) return u.json(res, 400, { erro: 'Usuário inválido.' });
      const filtro = (l) => (Array.isArray(l) ? l : []).filter((c) => existe.has(c));
      const turmasOk = (Array.isArray(b.turmas) ? b.turmas : []).map(String).filter((t) => novo.turmas[t]);
      if (b.aluno !== undefined) {
        novo.alunos = novo.alunos.filter((a) => a !== nome);
        for (const t of Object.values(novo.turmas)) t.alunos = t.alunos.filter((a) => a !== nome);
        if (b.aluno) {
          novo.alunos.push(nome);
          const destino = turmasOk.length ? turmasOk : [Object.keys(novo.turmas).find((k) => novo.turmas[k].status === 'andamento') || Object.keys(novo.turmas)[0]];
          for (const t of destino) novo.turmas[t].alunos.push(nome);
        }
      }
      if (b.monitor !== undefined) {
        if (b.monitor) novo.monitores[nome] = { aulas: filtro(b.aulas), roteiros: filtro(b.roteiros), turmas: (Array.isArray(b.monitor_turmas) ? b.monitor_turmas : []).map(String).filter((t) => novo.turmas[t]) };
        else delete novo.monitores[nome];
      }
      if (dono && b.equipe !== undefined) {
        if (b.equipe) novo.equipe[nome] = { titulo: '', permissoes: (Array.isArray(b.extras) ? b.extras : []).filter((x) => u.PERMISSOES.includes(x)), cargos: (Array.isArray(b.cargos) ? b.cargos : []).map(String).filter((c) => novo.cargos[c]) };
        else delete novo.equipe[nome];
      }
      if (dono && b.owner !== undefined) {
        if (b.owner) { if (!novo.owners.includes(nome)) novo.owners.push(nome); }
        else {
          if (nome === usuario || u.admins().includes(nome)) return u.json(res, 400, { erro: 'Este owner não pode ser removido por aqui.' });
          novo.owners = novo.owners.filter((o) => o !== nome);
        }
      }
      msg = `Portal: ${usuario} atualizou a ficha de ${nome}`;
    } else if (b.acao === 'adicionar') {
      if (!perm.includes('pessoas')) return nao();
      const papelNovo = String(b.papel || 'aluno');
      if (!['aluno', 'monitor', 'equipe'].includes(papelNovo) || (papelNovo === 'equipe' && !dono)) return nao();
      const turma = novo.turmas[b.turma] ? b.turma : (Object.keys(novo.turmas).find((k) => novo.turmas[k].status === 'andamento') || Object.keys(novo.turmas)[0]);
      const bruto = (Array.isArray(b.usuarios) ? b.usuarios : []).slice(0, 300).map(nomeGh);
      const validos = [...new Set(bruto.filter((x) => u.USER_RE.test(x)))];
      if (!validos.length) return u.json(res, 400, { erro: 'Nenhum usuário válido.' });
      for (const nome of validos) {
        if (papelNovo === 'aluno') { if (!novo.alunos.includes(nome)) novo.alunos.push(nome); if (!novo.turmas[turma].alunos.includes(nome)) novo.turmas[turma].alunos.push(nome); }
        else if (papelNovo === 'monitor') { if (!novo.monitores[nome]) novo.monitores[nome] = { aulas: [], roteiros: [], turmas: [turma] }; }
        else if (!novo.equipe[nome]) novo.equipe[nome] = { titulo: '', permissoes: [], cargos: [] };
      }
      msg = `Portal: ${usuario} adicionou ${validos.length} pessoa(s) como ${papelNovo}`;
    } else if (b.acao === 'remover_pessoa') {
      if (!perm.includes('pessoas')) return nao();
      const nome = nomeGh(b.usuario || '');
      if (!nome || novo.owners.includes(nome) || u.admins().includes(nome)) return u.json(res, 400, { erro: 'Esta pessoa não pode ser removida por aqui (owner).' });
      novo.alunos = novo.alunos.filter((a) => a !== nome);
      for (const t of Object.values(novo.turmas)) t.alunos = t.alunos.filter((a) => a !== nome);
      delete novo.monitores[nome];
      if (dono) delete novo.equipe[nome];
      msg = `Portal: ${usuario} removeu ${nome} das listas`;
    } else if (b.acao === 'cargo') {
      if (!dono) return nao();
      const nomeC = String(b.nome || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40);
      if (!nomeC) return u.json(res, 400, { erro: 'Dê um nome ao cargo.' });
      const id = /^[a-z0-9][a-z0-9-]{0,29}$/.test(String(b.id || '')) ? b.id : nomeC.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (!id) return u.json(res, 400, { erro: 'Nome inválido.' });
      novo.cargos[id] = { nome: nomeC, descricao: String(b.descricao || '').trim().slice(0, 100), permissoes: (Array.isArray(b.permissoes) ? b.permissoes : []).filter((x) => u.PERMISSOES.includes(x)) };
      msg = `Portal: ${usuario} definiu o cargo ${nomeC} (${novo.cargos[id].permissoes.join(', ') || 'sem permissões'})`;
    } else if (b.acao === 'remover_cargo') {
      if (!dono) return nao();
      if (!novo.cargos[b.id]) return u.json(res, 400, { erro: 'Cargo não encontrado.' });
      delete novo.cargos[b.id];
      for (const e of Object.values(novo.equipe)) e.cargos = (e.cargos || []).filter((c) => c !== b.id);
      msg = `Portal: ${usuario} removeu o cargo ${b.id}`;
    } else if (b.acao === 'turma') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!/^[A-Za-z0-9._-]{1,20}$/.test(id)) return u.json(res, 400, { erro: 'Código da turma: até 20 letras, números, ponto ou traço, sem espaço (ex.: 2026.2-N0).' });
      const atual = novo.turmas[id] || { alunos: [] };
      const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
      const inicio = b.inicio === undefined ? (atual.inicio || '') : data(b.inicio), fim = b.fim === undefined ? (atual.fim || '') : data(b.fim);
      if (inicio && fim && fim < inicio) return u.json(res, 400, { erro: 'O fim previsto não pode ser antes do início.' });
      const status = ['andamento', 'planejada', 'arquivada'].includes(b.status) ? b.status : (atual.status || 'planejada');
      let acessoAte = b.acessoAte === undefined ? (atual.acessoAte || '') : data(b.acessoAte);
      if (status !== 'arquivada') acessoAte = '';
      else if (!acessoAte) acessoAte = u.maisUmAno(); // arquivou: material continua por 1 ano (editável)
      novo.turmas[id] = { nome: String(b.nome || id).trim().slice(0, 40) || id, status, inicio, fim,
        nivel: b.nivel === undefined ? (atual.nivel || '') : (dirs.has(b.nivel) ? b.nivel : ''),
        acessoApos: b.acessoApos === undefined ? atual.acessoApos !== false : b.acessoApos !== false, acessoAte, alunos: atual.alunos };
      msg = `Portal: ${usuario} salvou a turma ${id} (${status})`;
    } else if (b.acao === 'renomear_turma') {
      // Trocar o código é seguro só se ainda não há presença gravada (os arquivos de presença usam o código).
      if (!perm.includes('pessoas')) return nao();
      const de = String(b.de || '').trim().toUpperCase(), para = String(b.para || '').trim().toUpperCase();
      if (!novo.turmas[de] || !/^[A-Za-z0-9._-]{1,20}$/.test(para)) return u.json(res, 400, { erro: 'Código inválido (até 20 letras, números, ponto ou traço, sem espaço).' });
      if (para === de) return u.json(res, 200, { ok: true });
      if (novo.turmas[para]) return u.json(res, 400, { erro: 'Já existe uma turma com esse código.' });
      if ((await d.listarSessoes()).some((x) => String(x.turma).toUpperCase() === de)) return u.json(res, 400, { erro: 'Esta turma já tem chamadas salvas, então o código não pode mudar (o histórico ficaria órfão). Você pode mudar o nome, o nível e as datas.' });
      const ordem = Object.entries(novo.turmas).map(([k, v]) => [k === de ? para : k, v]);
      novo.turmas = Object.fromEntries(ordem);
      for (const m of Object.values(novo.monitores)) m.turmas = m.turmas.map((x) => (x === de ? para : x));
      msg = `Portal: ${usuario} renomeou a turma ${de} para ${para}`;
    } else if (b.acao === 'excluir_turma') {
      if (!perm.includes('pessoas')) return nao();
      const id = String(b.id || '').trim().toUpperCase();
      if (!novo.turmas[id]) return u.json(res, 400, { erro: 'Turma não encontrada.' });
      if (Object.keys(novo.turmas).length <= 1) return u.json(res, 400, { erro: 'Precisa existir pelo menos uma turma.' });
      if (novo.turmas[id].alunos.length) return u.json(res, 400, { erro: 'A turma ainda tem alunos. Mova-os ou, se ela já terminou, use Arquivar.' });
      if ((await d.listarSessoes()).some((x) => String(x.turma).toUpperCase() === id)) return u.json(res, 400, { erro: 'A turma tem chamadas salvas. Use Arquivar para guardar o histórico.' });
      delete novo.turmas[id];
      for (const m of Object.values(novo.monitores)) m.turmas = m.turmas.filter((x) => x !== id);
      msg = `Portal: ${usuario} excluiu a turma ${id} (vazia)`;
    } else if (b.acao === 'promover') {
      // Promover = copiar: os escolhidos entram na turma nova e continuam na de origem (que guarda o histórico e o acesso ao material).
      if (!perm.includes('pessoas')) return nao();
      if (!novo.turmas[b.de] || !novo.turmas[b.para] || b.de === b.para) return u.json(res, 400, { erro: 'Turmas inválidas.' });
      const quem = ler(Array.isArray(b.usuarios) ? b.usuarios : []).filter((a) => novo.turmas[b.de].alunos.includes(a));
      if (!quem.length) return u.json(res, 400, { erro: 'Escolha pelo menos um aluno.' });
      for (const a of quem) if (!novo.turmas[b.para].alunos.includes(a)) novo.turmas[b.para].alunos.push(a);
      msg = `Portal: ${usuario} promoveu ${quem.length} aluno(s) da turma ${b.de} para ${b.para}`;
    } else if (b.acao === 'mover_turma') {
      if (!perm.includes('pessoas')) return nao();
      if (!novo.turmas[b.de] || !novo.turmas[b.para] || b.de === b.para) return u.json(res, 400, { erro: 'Turmas inválidas.' });
      const quem = Array.isArray(b.usuarios) && b.usuarios.length ? new Set(ler(b.usuarios)) : new Set(novo.turmas[b.de].alunos);
      const mover = novo.turmas[b.de].alunos.filter((a) => quem.has(a));
      novo.turmas[b.de].alunos = novo.turmas[b.de].alunos.filter((a) => !quem.has(a));
      for (const a of mover) if (!novo.turmas[b.para].alunos.includes(a)) novo.turmas[b.para].alunos.push(a);
      msg = `Portal: ${usuario} moveu ${mover.length} aluno(s) da turma ${b.de} para ${b.para}`;
    } else return u.json(res, 400, { erro: 'Ação inválida.' });
    await u.gravarConfig(novo, msg);
    u.json(res, 200, { ok: true });
  } catch (e) { console.error('[portal]', e && e.message); u.json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo.' }); }
};
