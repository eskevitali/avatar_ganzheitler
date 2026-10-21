// Independent background layer: original hall + a bounded, local Canvas2D light pass.
// No models, speech, messages, network requests or generated responses are involved.
export function startBackground(root, {clean = false} = {}) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha: true});
  const motion = root.querySelector('#background-motion') || document.createElement('input');
  const strength = root.querySelector('#background-strength') || Object.assign(document.createElement('input'), {value:'78'});
  const metrics = root.querySelector('#background-metrics') || document.createElement('output');
  const status = root.querySelector('#background-status') || document.createElement('output');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  motion.checked = !reduced;
  let writing = false, editing = false;
  const apply = value => {
    motion.checked = value.motion; strength.value = String(value.strength);
    updateStatus();
  };
  const sync = async () => {
    if (writing || editing) return;
    try {
      const response = await fetch('/api/background');
      if (!response.ok) throw new Error();
      apply(await response.json());
    } catch { if (!clean) status.textContent = 'Нет связи с настройками сцены. Обновите страницу и проверьте вход.'; }
  };
  const save = async () => {
    writing = true;
    try {
      const response = await fetch('/api/background', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({motion:motion.checked, strength:Number(strength.value)})});
      if(!response.ok) throw new Error();
      updateStatus();
    } catch { status.textContent = 'Настройки фона не сохранены. Проверьте связь и вход.'; }
    finally { writing=false; editing=false; }
  };
  const sprites = new Map();
  for (const [name, color] of [['gold', '255,170,73'], ['ice', '96,218,255']]) {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const brush = sprite.getContext('2d');
    const gradient = brush.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0, `rgba(${color},.98)`);
    gradient.addColorStop(.10, `rgba(${color},.82)`);
    gradient.addColorStop(.34, `rgba(${color},.18)`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    brush.fillStyle = gradient; brush.fillRect(0,0,64,64); sprites.set(name, sprite);
  }
  let width = 1, height = 1, dpr = 1, raf, disposed = false;
  let previous = performance.now(), clock = 0, measuredAt = previous, frames = 0;
  let totalDrawMs = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const racks = [.027,.131,.232,.313,.370,.419];
  const fract = x => x - Math.floor(x);
  const glow = (x,y,size,color,alpha) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites.get(color), x*width-size/2, y*height-size/2, size, size);
  };
  function draw(t) {
    ctx.clearRect(0,0,width,height);
    ctx.globalCompositeOperation = 'lighter';
    const intensity = Number(strength.value)/100;
    // Paired vertical scans: the original bilateral architecture stays symmetric.
    racks.forEach((x, index) => {
      const depth = 1-index*.13;
      const top=.04+index*.057, bottom=.96-index*.065;
      for (let row=0;row<7;row++) {
        const p=fract(row/7+t*(.022+index*.002)+index*.131);
        const y=top+(bottom-top)*p;
        const pulse=.35+.65*(.5+.5*Math.sin(t*1.8+row*2.1+index));
        for (const sign of [1,-1]) {
          const rackX=sign===1?x:1-x;
          glow(rackX,y,(18+depth*20)*width/1672,'gold',intensity*pulse*.72);
          // Small pinpoints give motion a readable core without obscuring rack detail.
          ctx.globalAlpha=intensity*pulse*.74;
          ctx.fillStyle='#ffe1a0';ctx.fillRect(rackX*width-1,y*height-1,2,2);
        }
      }
    });
    // Short pulses travel on perspective floor rails, never across the face/text layer.
    for (const end of [.015,.16,.30,.70,.84,.985]) {
      for(let pulse=0;pulse<2;pulse++) {
        const p=fract(t*.10+pulse*.5+end);
        const p0=Math.max(0,p-.047), ease=v=>v*v;
        const x=v=>.5+(end-.5)*ease(v), y=v=>.545+.46*ease(v);
        ctx.globalAlpha=intensity*(.25+p*.55);ctx.strokeStyle='#7cdeff';
        ctx.lineWidth=.7+p*1.2;ctx.beginPath();ctx.moveTo(x(p0)*width,y(p0)*height);ctx.lineTo(x(p)*width,y(p)*height);ctx.stroke();
        glow(x(p),y(p),(12+p*26)*width/1672,'ice',intensity*(.25+p*.55));
      }
    }
    // Light sweeps on existing horizontal rack edges, reflected on both sides.
    for(let i=0;i<6;i++) {
      const p=fract(t*.065+i*.165), x=.025+p*.385, y=.19+i*.063+p*.10;
      glow(x,y,24*width/1672,'ice',intensity*.60);
      glow(1-x,y,24*width/1672,'ice',intensity*.60);
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  const updateStatus = () => {
    status.textContent = motion.checked ? 'Световой слой движется · фон без затемнения' : 'Движение приостановлено';
    root.dataset.motion = motion.checked ? 'running' : 'paused';
  };
  motion.addEventListener('change', () => { updateStatus(); save(); });
  strength.addEventListener('input', () => { editing=true; draw(clock); });
  strength.addEventListener('change', save);
  updateStatus();
  sync();
  const syncTimer=setInterval(sync,1000);
  const tick = now => {
    if(disposed)return;
    const dt=Math.min((now-previous)/1000,.1);previous=now;
    if(motion.checked)clock+=dt;
    const started=performance.now();draw(clock);totalDrawMs+=performance.now()-started;frames++;
    root.dataset.animationTime=clock.toFixed(2);
    if(now-measuredAt>=2000) {
      const fps=Math.round(frames*1000/(now-measuredAt));
      const drawMs=(totalDrawMs/frames).toFixed(2);
      metrics.textContent=`${fps} fps · световой слой ${drawMs} мс/кадр · ${canvas.width} × ${canvas.height}`;
      metrics.dataset.fps=String(fps);metrics.dataset.drawMs=drawMs;
      measuredAt=now;frames=0;totalDrawMs=0;
    }
    raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return {dispose(){disposed=true;cancelAnimationFrame(raf);clearInterval(syncTimer);observer.disconnect();}};
}
