/* Faixa fixa "Você está como @x" quando um owner usa Ver como. Só aparece nesse caso. */
fetch('/api/site').then(r=>r.json()).then(d=>{
  if(!d||!d.personificando)return;
  const f=document.createElement('div');
  f.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#c9b3ff;color:#1a1230;padding:10px 16px;display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;font:600 14px system-ui,sans-serif;box-shadow:0 -2px 10px #0006';
  const t=document.createElement('span');t.textContent='Você está navegando como @'+d.personificando+' (somente leitura).';
  const b=document.createElement('button');b.type='button';b.textContent='Sair desta visualização';b.style.cssText='background:#1a1230;color:#fff;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit';
  b.onclick=async()=>{b.disabled=true;try{await fetch('/api/como',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sair:true})})}catch(e){}location.href='/admin'};
  f.append(t,b);document.body.append(f);document.body.style.paddingBottom='56px';
}).catch(()=>{});
