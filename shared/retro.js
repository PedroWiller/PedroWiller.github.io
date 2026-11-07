// Filtro retrô: botão que alterna ORIGINAL / NES / SNES / PS1. Copia cada canvas do jogo para uma
// versão em baixa resolução e paleta reduzida, desenhada por cima (os cliques continuam indo pro jogo).
(() => {
  const MODES = [
    { name: 'ORIGINAL' },
    { name: 'ATARI', w: 96, levels: 3 },              // blocos enormes, 27 cores
    { name: 'NES', w: 192, levels: 4 },               // 64 cores, pixels grandes
    { name: 'SNES', w: 288, levels: 16 },             // mais cores, resolução 16 bits
    { name: 'PS1', w: 400, levels: 8, dither: true, relief: true }, // dithering do PS1 + relevo/luz fingindo 3D
    // resolução cheia, relevo mais forte + correção de cor para um tom mais realista
    { name: 'PS2', w: 'full', levels: 256, relief: 2.5, shine: .3, bevel: 4,
      filter: 'saturate(.8) contrast(1.08) sepia(.18) brightness(1.02) blur(.4px)' }, // quente, suave, volume arredondado
    // fotorrealista (o máximo que um filtro sobre desenho 2D alcança): sombra projetada, textura, bloom, grão de câmera
    { name: 'XBOX', w: 'full', levels: 256, relief: 3, shine: .9, bevel: 2.5, photo: true,
      filter: 'saturate(.85) contrast(1.15) brightness(1.02) hue-rotate(-6deg)' },
  ];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  let mode = 0;
  try { mode = Number(localStorage.getItem('retro')) || 0; } catch {}
  if (!MODES[mode]) mode = 0;

  const layers = [...document.querySelectorAll('canvas')]
    .filter(c => c.width >= 300) // ignora miniaturas de avatar
    .map(src => {
      const out = document.createElement('canvas');
      out.style.cssText = 'pointer-events:none;image-rendering:pixelated;';
      src.after(out);
      const hmap = document.createElement('canvas'); // mapa de altura desfocado para o chanfro 3D
      return { src, out, ctx: out.getContext('2d', { willReadFrequently: true }), hmap, hctx: hmap.getContext('2d', { willReadFrequently: true }) };
    });

  const btn = document.createElement('button');
  btn.className = 'retro-btn';
  const style = document.createElement('style');
  style.textContent = `.retro-btn{position:fixed;top:12px;right:12px;z-index:50;padding:8px 10px;
    font:9px 'Press Start 2P',monospace;color:#ffeb3b;background:#000a;border:2px solid #ffeb3b;
    border-radius:0;box-shadow:none;cursor:pointer}.retro-btn:active{transform:none;box-shadow:none}`;
  document.head.append(style);
  document.body.append(btn);

  // botão de voltar fixo, espelhando o VISUAL; só nas páginas de jogo (as que têm o link .back pro menu)
  const backLink = document.querySelector('.back');
  if (backLink) {
    const back = document.createElement('a');
    back.className = 'retro-btn';
    back.href = backLink.href;
    back.textContent = '← VOLTAR';
    back.style.cssText = 'left:12px;right:auto;text-decoration:none';
    document.body.append(back);
  }

  const label = () => { btn.textContent = 'VISUAL: ' + MODES[mode].name; };
  label();
  btn.addEventListener('click', () => {
    mode = (mode + 1) % MODES.length;
    try { localStorage.setItem('retro', mode); } catch {}
    label();
    btn.blur(); // senão Enter/Espaço do jogo apertam o botão de novo
  });

  function frame() {
    const m = MODES[mode];
    for (const { src, out, ctx, hmap, hctx } of layers) {
      src.style.opacity = m.w ? 0 : '';
      out.style.filter = m.filter || '';
      out.style.display = m.w ? 'block' : 'none'; // `hidden` não basta: o CSS dos jogos força canvas{display:block}
      if (!m.w) continue;

      // acompanha posição e tamanho do canvas original
      const fixed = getComputedStyle(src).position === 'fixed';
      Object.assign(out.style, {
        position: fixed ? 'fixed' : 'absolute',
        left: src.offsetLeft + 'px', top: src.offsetTop + 'px',
        width: src.offsetWidth + 'px', height: src.offsetHeight + 'px',
        borderRadius: getComputedStyle(src).borderRadius,
      });

      // 'full' limitado a 800: o fundo do menu ocupa a tela toda e o relevo é calculado pixel a pixel em JS
      const w = m.w === 'full' ? Math.min(src.width, 800) : m.w, h = Math.max(1, Math.round(w * src.height / src.width));
      if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, w, h);

      const img = ctx.getImageData(0, 0, w, h), d = img.data, step = 255 / (m.levels - 1);
      // relevo: a luminância vira altura; luz vindo de cima-esquerda sombreia as bordas como volume.
      // Não mexe na geometria, então os cliques continuam batendo com o que se vê.
      let lum, hd = d, o = 1;
      if (m.relief) {
        if (m.bevel) { // altura desfocada: as bordas viram rampas arredondadas em vez de degrau de 1px
          if (hmap.width !== w || hmap.height !== h) { hmap.width = w; hmap.height = h; }
          hctx.filter = `blur(${m.bevel}px)`;
          hctx.clearRect(0, 0, w, h);
          hctx.drawImage(src, 0, 0, w, h);
          hd = hctx.getImageData(0, 0, w, h).data;
          o = 2;
        }
        lum = new Float32Array(w * h);
        for (let p = 0; p < lum.length; p++) lum[p] = hd[p * 4] * .3 + hd[p * 4 + 1] * .59 + hd[p * 4 + 2] * .11;
      }
      let far;
      if (m.photo) { // altura bem desfocada: o que está "em cima" projeta sombra macia pra baixo-direita
        hctx.filter = 'blur(7px)';
        hctx.clearRect(0, 0, w, h);
        hctx.drawImage(src, 0, 0, w, h);
        const fd = hctx.getImageData(0, 0, w, h).data;
        far = new Float32Array(w * h);
        for (let p = 0; p < far.length; p++) far[p] = fd[p * 4] * .3 + fd[p * 4 + 1] * .59 + fd[p * 4 + 2] * .11;
      }
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const t = m.dither ? BAYER[((p / w | 0) & 3) * 4 + (p % w & 3)] / 16 - 0.5 : 0;
        let k = 1, s = 0;
        if (lum) {
          const x = p % w, y = p / w | 0;
          const gx = lum[p] - lum[y * w + Math.max(0, x - o)];
          const gy = lum[p] - lum[Math.max(0, y - o) * w + x];
          k = Math.max(.45, Math.min(1.7, 1 + (gx + gy) / 160 * m.relief));
          if (m.shine) s = Math.max(0, gx + gy) * m.shine; // brilho branco nas bordas viradas pra luz
        }
        if (far) {
          const x = p % w, y = p / w | 0;
          const blocker = far[Math.max(0, y - 9) * w + Math.max(0, x - 9)] - far[p];
          if (blocker > 0) k *= 1 - Math.min(.55, blocker / 90);           // sombra projetada
          k *= .82 + .18 * Math.min(1, lum[p] / Math.max(1, far[p]));      // oclusão ambiente nos cantos
          s += (Math.random() - .5) * 16;                                   // grão/textura de material
        }
        d[i] = Math.round((d[i] * k + s) / step + t) * step;
        d[i + 1] = Math.round((d[i + 1] * k + s) / step + t) * step;
        d[i + 2] = Math.round((d[i + 2] * k + s) / step + t) * step;
      }
      ctx.putImageData(img, 0, 0);
      if (m.relief) { // vinheta: bordas escuras dão profundidade de cena
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      if (m.photo) { // bloom: partes claras "vazam" luz como lente de câmera
        hctx.filter = 'blur(10px) brightness(.9) contrast(1.6)';
        hctx.clearRect(0, 0, w, h);
        hctx.drawImage(out, 0, 0);
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .45;
        ctx.drawImage(hmap, 0, 0);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
