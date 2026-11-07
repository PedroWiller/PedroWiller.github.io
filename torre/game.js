const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 600, TOP = 90, BH = 24, BASE = H - 30, START_W = 200, PERFECT = 5;

let stack, cur, debris, cam, over, last, mood, bubble, moodUntil, timer, perfects;
let best = 0;
try { best = Number(localStorage.getItem('torre-best')) || 0; } catch {}

const color = n => `hsl(${n * 14 % 360}, 70%, 58%)`;
const levelY = n => BASE - (n + 1) * BH; // topo do andar n, em coordenada de mundo (sem câmera)
const speed = n => Math.min(420, 140 + n * 7); // px/s
const score = () => stack.length - 1;

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('score').textContent = score(); $('best').textContent = best; }

function spawn() {
  const top = stack.at(-1), left = stack.length % 2;
  cur = { x: left ? 0 : W - top.w, w: top.w, vx: left ? 1 : -1 };
}

function reset() {
  stack = [{ x: (W - START_W) / 2, w: START_W }];
  debris = []; cam = 0; over = false; perfects = 0;
  clearTimeout(timer);
  setMood('idle');
  spawn(); hud();
  $('overlay').hidden = true;
}

// corta o bloco pelo que encosta no de baixo; retorna o pedaço que sobra ou null se errou tudo
function cut(top, b) {
  const l = Math.max(b.x, top.x), r = Math.min(b.x + b.w, top.x + top.w);
  return r > l ? { x: l, w: r - l } : null;
}

function drop() {
  if (over) return;
  const top = stack.at(-1), n = stack.length;
  if (Math.abs(cur.x - top.x) < PERFECT) cur.x = top.x; // perdoa quase-acertos
  const kept = cut(top, cur);
  if (!kept) {
    debris.push({ ...cur, y: levelY(n), vy: 0, n });
    over = true; setMood('sad', 'NÃÃO');
    if (score() > best) { best = score(); try { localStorage.setItem('torre-best', best); } catch {} }
    hud();
    timer = setTimeout(() => {
      $('overlay-title').textContent = `A TORRE CAIU!\n${score()} ANDARES`;
      $('overlay').hidden = false; $('restart').focus();
    }, 1200);
    return;
  }
  if (kept.w < cur.w) { // pedaço que sobrou cai
    const chip = cur.x < kept.x ? { x: cur.x, w: kept.x - cur.x } : { x: kept.x + kept.w, w: cur.x + cur.w - kept.x - kept.w };
    debris.push({ ...chip, y: levelY(n), vy: 0, n });
    perfects = 0;
    setMood('happy', '', 400);
  } else {
    perfects++;
    setMood('happy', perfects > 2 ? `${perfects}X!` : 'PERFEITO!', 800);
  }
  stack.push(kept);
  spawn(); hud();
}

canvas.addEventListener('pointerdown', drop);
addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') return reset();
  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && $('overlay').hidden) { e.preventDefault(); drop(); }
});
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function block(b, y, c) {
  ctx.fillStyle = c; ctx.fillRect(b.x, y, b.w, BH);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(b.x, y, b.w, 4);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x, y + BH - 4, b.w, 4);
}

function draw(t) {
  const dt = Math.min(100, t - (last ?? t)) / 1000; last = t;
  if (t > moodUntil) setMood('idle');

  if (!over) {
    cur.x += cur.vx * speed(stack.length) * dt;
    if (cur.x < 0) { cur.x = 0; cur.vx = 1; }
    if (cur.x > W - cur.w) { cur.x = W - cur.w; cur.vx = -1; }
  }
  // câmera sobe para o bloco em movimento ficar uns 150px abaixo da faixa do avatar
  const target = Math.max(0, TOP + 150 - levelY(stack.length));
  cam += (target - cam) * Math.min(1, dt * 6);
  for (const d of debris) { d.vy += 1500 * dt; d.y += d.vy * dt; }
  debris = debris.filter(d => d.y + cam < H);

  ctx.fillStyle = `hsl(250, 45%, ${Math.max(6, 24 - cam / 60)}%)`; ctx.fillRect(0, 0, W, H); // céu escurece ao subir
  ctx.fillStyle = '#4e342e'; ctx.fillRect(0, BASE + cam, W, H);
  stack.forEach((b, n) => block(b, levelY(n) + cam, color(n)));
  debris.forEach(d => block(d, d.y + cam, color(d.n)));
  if (!over) block(cur, levelY(stack.length) + cam, color(stack.length));

  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  const m = mood === 'idle' && !over && cur.w < 50 ? 'worried' : mood; // bloco fininho dá medo
  drawMood(ctx, currentAvatar(), 50, TOP - 8, 2, m, t, cur.x + cur.w / 2 > 50 ? 1 : -1);
  const text = bubble || (m === 'worried' ? 'EITA!' : '');
  if (text) drawBubble(ctx, 170, 36, text);
  else if (!score() && !over) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center';
    ctx.fillText('TOQUE PARA', 210, 38); ctx.fillText('SOLTAR O BLOCO', 210, 56);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem do corte
console.assert(JSON.stringify(cut({ x: 0, w: 100 }, { x: 30, w: 100 })) === '{"x":30,"w":70}', 'corte à direita');
console.assert(JSON.stringify(cut({ x: 50, w: 100 }, { x: 0, w: 100 })) === '{"x":50,"w":50}', 'corte à esquerda');
console.assert(cut({ x: 0, w: 50 }, { x: 60, w: 50 }) === null, 'errou tudo');
