'use strict';
// Certificado padrão: um modelo único, preenchido com os dados de cada pessoa. O modelo pode ser trocado
// editando modelos/certificado.html no repositório de conteúdo (campos: {{nome}} {{evento}} {{tipo}} {{data}} {{horas}} {{codigo}} {{liga}} {{emitido}}).
const crypto = require('crypto');
const u = require('./util');
const esc = (t) => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mac = (id, usuario) => crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(`certificado|${id}|${usuario}`).digest('hex').slice(0, 10).toUpperCase();
const codigo = (id, usuario) => `${id}.${usuario}.${mac(id, usuario)}`;
function validar(c) {
  const m = /^([A-Z0-9][A-Z0-9-]{1,29})\.([a-z0-9][a-z0-9-]{0,38})\.([0-9A-F]{10})$/.exec(String(c || ''));
  if (!m) return null;
  const a = Buffer.from(m[3]), b = Buffer.from(mac(m[1], m[2]));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { id: m[1], usuario: m[2] } : null;
}
const MODELO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Certificado — {{nome}}</title>
<style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#0d0f16;font-family:Georgia,'Times New Roman',serif;color:#1a1730;display:grid;place-items:center;min-height:100vh}
.folha{width:297mm;height:210mm;max-width:100vw;background:#fbf8ef;border:10px solid #f5b83d;outline:3px solid #1a1730;outline-offset:-22px;padding:20mm 24mm;text-align:center;display:flex;flex-direction:column;justify-content:space-between;position:relative}
.liga{letter-spacing:6px;font:700 13pt Arial,sans-serif;color:#8a5a00}h1{font-size:40pt;margin:6mm 0 2mm;letter-spacing:3px}.p{font-size:15pt;line-height:1.6;margin:0}.nome{font-size:34pt;font-style:italic;margin:6mm 0;border-bottom:1px solid #1a173055;display:inline-block;padding:0 14mm 2mm}
.ass{display:flex;justify-content:space-around;margin-top:8mm;font:11pt Arial,sans-serif}.ass div{border-top:1px solid #1a1730;padding-top:2mm;min-width:70mm}
.cod{font:9pt Arial,sans-serif;color:#555;margin-top:4mm}.imp{position:fixed;right:12px;top:12px;font:14px Arial;padding:8px 14px;border-radius:8px;border:0;background:#f5b83d;cursor:pointer}@media print{.imp{display:none}body{background:none}.folha{border-width:10px}}</style></head>
<body><button class="imp" onclick="window.print()">Imprimir / salvar PDF</button>
<div class="folha"><div><div class="liga">{{liga}}</div><h1>CERTIFICADO</h1></div>
<div><p class="p">Certificamos que</p><div class="nome">{{nome}}</div><p class="p">participou do(a) <b>{{tipo}}</b> “{{evento}}”,<br>realizado em {{data}}{{horas}}.</p></div>
<div><div class="ass"><div>Presidência da Liga</div><div>Professor responsável</div></div><div class="cod">Emitido em {{emitido}} · Código de verificação: <b>{{codigo}}</b><br>Para conferir a autenticidade, acesse este endereço e confira os dados acima.</div></div></div></body></html>`;
function preencher(modelo, v) {
  return String(modelo).replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] !== undefined ? esc(v[k]) : ''));
}
module.exports = { codigo, validar, MODELO, preencher, esc };
