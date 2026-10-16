/* Vitrine da liga: cartões simples ou embeds (iframes) de domínios permitidos. Usado no servidor (validação) e no navegador (exibição e prévia). */
(function (raiz) {
  const ORIGENS = { 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'youtube-nocookie.com': 'YouTube', 'vimeo.com': 'Vimeo', 'instagram.com': 'Instagram', 'itch.io': 'itch.io', 'spotify.com': 'Spotify', 'discord.com': 'Discord', 'discord.gg': 'Discord', 'google.com': 'Google', 'tiktok.com': 'TikTok', 'github.com': 'GitHub' };
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').replace(/^player\./, '').replace(/^open\./, '').replace(/^docs\./, '').replace(/^drive\./, ''); } catch { return ''; } };
  const origemDe = (u) => { const h = host(u); if (!h) return 'Link'; const k = Object.keys(ORIGENS).find((x) => h === x || h.endsWith('.' + x)); return k ? ORIGENS[k] : h; };
  // Endereços de iframe aceitos (https, domínio e caminho conhecidos).
  const PERMITIDOS = [
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{6,20}(\?[\w=&%.-]*)?$/, /^https:\/\/www\.youtube\.com\/embed\/[\w-]{6,20}(\?[\w=&%.-]*)?$/, /^https:\/\/player\.vimeo\.com\/video\/\d+(\?[\w=&%.-]*)?$/,
    /^https:\/\/itch\.io\/embed(-upload)?\/\d+(\?[\w=&%.-]*)?$/, /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/embed\/?(captioned\/?)?$/,
    /^https:\/\/open\.spotify\.com\/embed\/(track|album|playlist|episode|show|artist)\/\w+(\?[\w=&%.-]*)?$/, /^https:\/\/discord\.com\/widget\?id=\d+(&[\w=&%.-]*)?$/,
    /^https:\/\/docs\.google\.com\/presentation\/d\/[\w-]+\/embed(\?[\w=&%.-]*)?$/, /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/preview$/, /^https:\/\/www\.tiktok\.com\/embed\/v2\/\d+$/,
  ];
  const embedPermitido = (e) => typeof e === 'string' && e.length < 300 && PERMITIDOS.some((r) => r.test(e));
  // Tenta montar o endereço de embed a partir do link comum. Se não der, devolve ''.
  function embedDe(url) {
    let u; try { u = new URL(String(url || '')); } catch { return ''; }
    if (u.protocol !== 'https:') return '';
    const h = u.hostname.replace(/^www\./, ''); const p = u.pathname; let m;
    if (h === 'youtu.be' && (m = /^\/([\w-]{6,20})/.exec(p))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    if (h === 'youtube.com' || h === 'm.youtube.com') {
      if (p === '/watch' && /^[\w-]{6,20}$/.test(u.searchParams.get('v') || '')) return 'https://www.youtube-nocookie.com/embed/' + u.searchParams.get('v');
      if ((m = /^\/(shorts|embed|live)\/([\w-]{6,20})/.exec(p))) return 'https://www.youtube-nocookie.com/embed/' + m[2];
    }
    if (h === 'vimeo.com' && (m = /^\/(\d+)/.exec(p))) return 'https://player.vimeo.com/video/' + m[1];
    if (h === 'instagram.com' && (m = /^\/(p|reel|tv)\/([\w-]+)/.exec(p))) return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
    if (h === 'itch.io' && (m = /^\/embed(-upload)?\/(\d+)/.exec(p))) return `https://itch.io/embed${m[1] || ''}/${m[2]}`;
    if (h === 'open.spotify.com' && (m = /^\/(track|album|playlist|episode|show|artist)\/(\w+)/.exec(p))) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
    if (h === 'docs.google.com' && (m = /^\/presentation\/d\/([\w-]+)/.exec(p))) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
    if (h === 'drive.google.com' && (m = /^\/file\/d\/([\w-]+)/.exec(p))) return `https://drive.google.com/file/d/${m[1]}/preview`;
    return '';
  }
  // Aceita o código <iframe ...> colado (itch.io, Discord…) ou um endereço, e devolve só o endereço do iframe permitido.
  function extrairEmbed(texto) {
    const t = String(texto || '').trim(); if (!t) return '';
    const m = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(t); const src = (m ? m[1] : t).replace(/&amp;/g, '&').trim();
    return embedPermitido(src) ? src : (embedDe(src) || '');
  }
  const MODOS = { cartao: 'Cartão simples', clique: 'Embed com clique para carregar', direto: 'Embed já aberto' };
  function normalizar(v) {
    v = v || {};
    const url = /^https:\/\/[^\s"'<>\\]{1,300}$/.test(String(v.url || '')) ? String(v.url) : '';
    const embed = embedPermitido(v.embed) ? v.embed : (embedDe(url) || '');
    return { url, embed, modo: MODOS[v.modo] ? v.modo : 'cartao', origem: origemDe(url || embed), altura: Math.min(800, Math.max(150, Math.round(Number(v.altura)) || 360)) };
  }
  // ---- só no navegador ----
  function render(item, modo, opts) {
    opts = opts || {}; const d = document; const n = normalizar(item); modo = modo || n.modo;
    const el = (t, c, x) => { const e = d.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
    const card = el('div', 'vit-card'); const emb = n.embed && modo !== 'cartao';
    const abrir = () => { const a = el('a', 'btn' + (emb ? ' sec' : ''), item.botao || ('Abrir no ' + n.origem)); a.href = n.url || n.embed || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    const ifr = () => { const f = d.createElement('iframe'); f.src = n.embed; f.loading = 'lazy'; f.title = item.titulo || 'Conteúdo'; f.style.cssText = 'width:100%;border:0;border-radius:10px;height:' + n.altura + 'px;background:#000';
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation'); f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); f.setAttribute('allow', 'fullscreen; encrypted-media; picture-in-picture'); f.allowFullscreen = true; return f; };
    const topo = el('div', 'vit-topo'); topo.append(el('b', '', item.titulo || 'Sem título'), el('span', 'badge', n.origem)); card.append(topo);
    const capa = () => { const c = el('div', 'vit-capa'); if (item.imagem) { const i = d.createElement('img'); i.src = '/api/imagem?n=' + encodeURIComponent(item.imagem); i.alt = item.titulo || ''; i.loading = 'lazy'; c.append(i); } else c.append(el('span', '', n.origem)); return c; };
    if (modo === 'direto' && emb) card.append(ifr());
    else if (modo === 'clique' && emb) {
      const c = capa(); c.classList.add('vit-clicavel'); const bt = el('button', 'btn', '▶ Carregar aqui'); bt.type = 'button';
      bt.onclick = () => { c.replaceWith(ifr()); }; c.append(bt); card.append(c);
    } else card.append(capa());
    if (item.legenda) card.append(el('p', 'vit-leg', item.legenda));
    if (n.url || n.embed) card.append(abrir());
    if (modo !== 'cartao' && !n.embed) card.append(el('small', 'vit-aviso', 'Este link não permite embed; mostrando como cartão. Cole o código de incorporação do site para habilitar.'));
    if (modo === 'clique' && emb && !opts.semAviso) card.append(el('small', 'vit-aviso', 'O conteúdo de terceiros só carrega depois do seu clique.'));
    return card;
  }
  const api = { ORIGENS, origemDe, embedPermitido, embedDe, extrairEmbed, normalizar, render, MODOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.LigaVitrine = api;
})(typeof window !== 'undefined' ? window : globalThis);
