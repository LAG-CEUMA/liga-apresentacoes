// Arte provisória e final do Spin Run LAG: peças em vetor (cavalo galopando, cavaleiro, Stand) com cores por variável.
// Enquanto não há arte final aprovada, o servidor sorteia cores; a arte final (imagem/GIF) sempre prevalece.
(function(){
const DEFS=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s1)" stop-opacity=".92"/><stop offset="1" stop-color="var(--s2)" stop-opacity=".55"/></linearGradient>
<pattern id="pt" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#2a1608" opacity=".22"/></pattern>

<!-- PERNA de cavalo: coxa + canela com joelho articulado. x = posição do quadril -->
<g id="perna"><g><animateTransform attributeName="transform" type="rotate" values="38 0 95;-38 0 95;38 0 95" dur=".7s" repeatCount="indefinite"/>
<path d="M-9 95 Q-13 115 -6 131 L8 131 Q11 112 10 95Z" fill="var(--pele)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<g><animateTransform attributeName="transform" type="rotate" values="0 0 131;-48 0 131;0 0 131" dur=".7s" repeatCount="indefinite"/>
<path d="M-6 131 L8 131 L6 164 L-7 164Z" fill="var(--pele)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M-9 164 L7 164 L10 172 L-12 172Z" fill="#2a1608"/></g></g></g>

<g id="pernaB"><g><animateTransform attributeName="transform" type="rotate" values="38 0 95;-38 0 95;38 0 95" dur=".7s" begin="-.35s" repeatCount="indefinite"/>
<path d="M-9 95 Q-13 115 -6 131 L8 131 Q11 112 10 95Z" fill="var(--pele)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<g><animateTransform attributeName="transform" type="rotate" values="0 0 131;-48 0 131;0 0 131" dur=".7s" begin="-.35s" repeatCount="indefinite"/>
<path d="M-6 131 L8 131 L6 164 L-7 164Z" fill="var(--pele)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M-9 164 L7 164 L10 172 L-12 172Z" fill="#2a1608"/></g></g></g>

<!-- CAVALO galopando (de lado, olhando para a direita) + CAVALEIRO -->
<g id="cavalo"><g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur=".35s" repeatCount="indefinite"/>
<!-- cauda -->
<path d="M48 70 Q20 62 2 92 Q18 84 30 96 Q8 110 14 128 Q40 100 52 86Z" fill="var(--crina)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"><animateTransform attributeName="transform" type="rotate" values="-6 50 75;8 50 75;-6 50 75" dur=".35s" repeatCount="indefinite"/></path>
<g transform="translate(62 0)" style="--pele:var(--pele2)"><use href="#pernaB"/></g><g transform="translate(150 0)" style="--pele:var(--pele2)"><use href="#perna"/></g>
<!-- corpo -->
<path d="M44 72 Q60 58 112 60 Q154 58 168 72 Q176 96 160 104 Q110 112 62 104 Q38 98 44 72Z" fill="var(--pele)" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<path d="M70 98 Q110 106 152 98" fill="none" stroke="#2a1608" stroke-width="2" opacity=".35"/>
<path d="M56 78 Q70 70 84 80 M58 90 Q72 84 84 92" fill="none" stroke="#2a1608" stroke-width="2" opacity=".3"/>
<!-- pescoço, cabeça -->
<path d="M148 68 Q168 36 184 26 L206 42 Q190 58 172 90Z" fill="var(--pele)" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<path d="M180 24 Q202 14 218 44 Q224 60 210 64 Q198 62 188 50Z" fill="var(--pele)" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<circle cx="200" cy="38" r="3.2" fill="#2a1608"/><path d="M214 56 q4 2 7 -1" fill="none" stroke="#2a1608" stroke-width="2.5"/>
<path d="M180 26 L176 8 L190 22Z" fill="var(--pele)" stroke="#2a1608" stroke-width="3"/>
<path d="M176 24 Q158 24 146 60 Q164 44 178 40 Q158 56 150 80 Q178 52 186 30Z" fill="var(--crina)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"><animateTransform attributeName="transform" type="rotate" values="-3 165 50;5 165 50;-3 165 50" dur=".35s" repeatCount="indefinite"/></path>
<!-- freio e rédea -->
<path d="M204 48 Q180 62 134 52" fill="none" stroke="#2a1608" stroke-width="2.5"/>
<g transform="translate(78 0)"><use href="#perna"/></g><g transform="translate(138 0)"><use href="#pernaB"/></g>
<!-- sela -->
<path d="M92 56 Q112 50 130 56 L128 70 Q110 74 94 70Z" fill="var(--sela)" stroke="#2a1608" stroke-width="3"/>
<!-- CAVALEIRO -->
<g>
<animateTransform attributeName="transform" type="rotate" values="-2 110 60;3 110 60;-2 110 60" dur=".35s" repeatCount="indefinite"/>
<!-- ponta do poncho/casaco ao vento -->
<path d="M98 58 Q74 62 58 86 Q82 78 100 74 Q92 86 80 100 Q108 84 118 62Z" fill="var(--casaco2)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"><animate attributeName="d" values="M98 58 Q74 62 58 86 Q82 78 100 74 Q92 86 80 100 Q108 84 118 62Z;M98 58 Q70 54 50 74 Q78 72 100 72 Q86 80 70 92 Q104 80 118 62Z;M98 58 Q74 62 58 86 Q82 78 100 74 Q92 86 80 100 Q108 84 118 62Z" dur=".35s" repeatCount="indefinite"/></path>
<!-- bota -->
<path d="M110 60 L116 86 L104 94 L98 88 L106 84 L100 62Z" fill="#4a2a14" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M99 90 L104 94 L98 99 L93 94Z" fill="#c9a24a" stroke="#2a1608" stroke-width="2"/>
<!-- tronco inclinado -->
<path d="M100 60 Q106 24 130 16 L146 26 Q128 40 126 62Z" fill="var(--casaco)" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<path d="M112 56 Q116 36 130 28" fill="none" stroke="#2a1608" stroke-width="2" opacity=".4"/>
<rect x="110" y="48" width="16" height="6" fill="#c9a24a" stroke="#2a1608" stroke-width="2"/>
<!-- braço com rédea -->
<path d="M130 24 Q146 34 156 48 L160 44 Q150 28 138 20Z" fill="var(--casaco)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<circle cx="159" cy="47" r="4" fill="#e8b48a" stroke="#2a1608" stroke-width="2"/>
<!-- cabeça -->
<path d="M128 12 Q130 -2 142 0 Q150 8 146 20 Q138 26 130 20Z" fill="#e8b48a" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M134 8 L150 6 L150 13 L136 14Z" fill="#2a1608"/><path d="M136 9 L148 8" stroke="#8fd3ff" stroke-width="2"/>
<!-- chapéu -->
<path d="M118 4 Q138 12 160 2 Q140 -4 118 4Z" fill="var(--chapeu)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M128 2 Q130 -16 142 -14 Q150 -10 148 1Z" fill="var(--chapeu)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M129 -2 L148 -2" stroke="var(--cachecol)" stroke-width="4"/>
<!-- cachecol voando -->
<path d="M128 20 Q104 12 84 22 Q100 20 112 30 Q92 34 76 46 Q108 36 130 26Z" fill="var(--cachecol)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"><animate attributeName="d" values="M128 20 Q104 12 84 22 Q100 20 112 30 Q92 34 76 46 Q108 36 130 26Z;M128 20 Q104 24 82 12 Q102 22 110 24 Q90 40 70 34 Q104 40 130 26Z;M128 20 Q104 12 84 22 Q100 20 112 30 Q92 34 76 46 Q108 36 130 26Z" dur=".4s" repeatCount="indefinite"/></path>
</g></g></g>

<!-- STAND humanoide estilo mangá de aventura (musculoso, translúcido, de frente-3/4, soco animado) -->
<g id="stand"><g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -7;0 0" dur="1.4s" repeatCount="indefinite"/>
<!-- aura -->
<ellipse cx="95" cy="100" rx="86" ry="104" fill="var(--s1)" opacity=".18"/>
<!-- cauda de névoa no lugar das pernas -->
<path d="M52 128 Q60 176 40 206 Q80 186 92 150 Q104 188 140 200 Q116 170 126 128Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<!-- braço de trás (flexionado) -->
<path d="M44 70 Q14 74 10 104 Q12 118 28 122 L36 108 Q30 102 36 90 Q48 84 58 80Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M28 122 Q18 126 14 118 L12 106" fill="none" stroke="#2a1608" stroke-width="3"/>
<circle cx="24" cy="116" r="12" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="3.5"/>
<!-- torso -->
<path d="M44 64 Q95 44 146 64 Q150 92 134 124 Q95 140 56 124 Q40 92 44 64Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<!-- peitorais, abdômen, hachuras de sombra -->
<path d="M95 62 L95 128 M52 82 Q74 98 95 86 Q116 98 138 82" fill="none" stroke="#2a1608" stroke-width="2.6" stroke-linecap="round"/>
<path d="M72 104 H118 M74 116 H116" stroke="#2a1608" stroke-width="2.2" opacity=".8"/>
<path d="M56 90 l8 6 M54 100 l8 6 M62 112 l8 4 M134 90 l-8 6 M136 100 l-8 6 M128 112 l-8 4" stroke="#2a1608" stroke-width="2" opacity=".55"/>
<path d="M58 76 q14 -8 32 -4" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>
<!-- cinto com fivela -->
<path d="M58 124 Q95 140 134 124 L132 134 Q95 150 60 134Z" fill="var(--s2)" stroke="#2a1608" stroke-width="3"/><circle cx="95" cy="138" r="7" fill="var(--s3)" stroke="#2a1608" stroke-width="3"/>
<!-- ombreiras com espinhos -->
<path d="M22 66 Q40 48 60 66 L56 82 Q36 86 24 78Z" fill="var(--s3)" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M26 62 L20 44 L36 56 M38 56 L38 38 L50 54" fill="var(--s3)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M130 66 Q150 48 170 66 L164 80 Q146 86 128 80Z" fill="var(--s3)" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M140 56 L142 38 L152 54 M154 56 L164 40 L168 58" fill="var(--s3)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<!-- pescoço e cabeça: capacete com visor e crista -->
<path d="M82 52 L108 52 L106 66 L84 66Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="3"/>
<path d="M66 34 Q68 6 96 4 Q124 6 126 34 Q124 56 96 60 Q68 56 66 34Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="4" stroke-linejoin="round"/>
<path d="M96 4 Q80 -14 56 -8 Q74 2 80 14 M96 4 Q112 -14 136 -8 Q118 2 112 14" fill="var(--s3)" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M70 26 L122 26 L118 38 L74 38Z" fill="#12091f" stroke="#2a1608" stroke-width="3"/>
<path d="M80 31 H110" stroke="#ffe27a" stroke-width="3.4" stroke-linecap="round"/>
<path d="M82 46 Q96 54 110 46" fill="none" stroke="#2a1608" stroke-width="3"/>
<path d="M70 14 q6 -6 14 -6" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>
<!-- braço da frente: soco (anima) -->
<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;26 -4;26 -4;0 0" keyTimes="0;.45;.55;.7;1" dur="1.4s" repeatCount="indefinite"/>
<path d="M146 70 Q170 74 184 84 L178 100 Q164 94 144 92Z" fill="var(--s1)" fill-opacity=".78" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M156 78 q8 2 14 8" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>
<path d="M178 80 L212 76 Q226 78 226 92 Q224 106 210 106 L178 102Z" fill="var(--s3)" stroke="#2a1608" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M198 80 V105 M208 80 V105 M188 82 V102" stroke="#2a1608" stroke-width="2"/>
</g>
</g></g>

</defs></svg>`;
function pronto(){if(document.getElementById('arte-defs'))return;const d=document.createElement('div');d.id='arte-defs';d.innerHTML=DEFS;document.body.appendChild(d)}
const css=o=>Object.entries(o||{}).map(([k,v])=>'--'+k+':'+v).join(';');
const img=(src,cl)=>`<image href="${String(src).replace(/"/g,'')}" ${cl}/>`;
// v = {cavalo:{pele,pele2,crina,sela,casaco,casaco2,chapeu,cachecol}, arteCavalo, standCores:{s1,s2,s3}, arteStand}
function cena(v){pronto();v=v||{};
  const stand=v.arteStand?img(v.arteStand,'x="0" y="10" width="200" height="200"'):`<g transform="translate(10 20) scale(.8)" style="${css(v.standCores||{s1:'#8e8e9a',s2:'#3a3a46',s3:'#e6e6f0'})}"><use href="#stand"/></g>`;
  const cav=v.arteCavalo?img(v.arteCavalo,'x="190" y="40" width="300" height="190"'):`<g transform="translate(250 56) scale(1.05)" style="${css(v.cavalo)}"><use href="#cavalo"/></g>`;
  return `<svg viewBox="0 0 520 250" role="img" aria-label="Seu cavaleiro e seu Stand" style="width:100%;max-width:520px;border:4px solid #2a1608;border-radius:6px;background:#f6c98a"><rect y="190" width="520" height="60" fill="#d9a766"/><rect y="190" width="520" height="60" fill="url(#pt)"/>${stand}${cav}</svg>`}
window.Arte={cena};
})();
