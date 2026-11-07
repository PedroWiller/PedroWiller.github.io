const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 720, H = 480, COLS = 10, ROWS = 20, CELL = 22, BX = (W - COLS * CELL) / 2, BY = (H - ROWS * CELL) / 2;
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]],
};
const COLORS = { I: '#4fc3f7', O: '#ffcc33', T: '#ba68c8', S: '#66bb6a', Z: '#ef5350', J: '#5c6bc0', L: '#ff9800' };
const POINTS = [0, 100, 300, 500, 800];
// pistas de dança: x, y do chão e qual passo cada um faz
const DANCERS = [[80, 190, 0], [185, 320, 1], [80, 450, 2], [640, 190, 3], [535, 320, 0], [640, 450, 1]];

let grid, piece, next, bag = [], score, lines, level, over, paused, dropAcc, last, mood, moodUntil, clearing;
let best = 0;
try { best = Number(localStorage.getItem('blocos-best')) || 0; } catch {}
$('best').textContent = best;

const rotate = m => m[0].map((_, x) => m.map(r => r[x]).reverse()); // horário
const fromBag = () => {
  if (!bag.length) bag = Object.keys(SHAPES).sort(() => Math.random() - 0.5); // shortcut: sort aleatório não é embaralhamento perfeito, basta pra um saco de 7
  const k = bag.pop();
  return { k, m: SHAPES[k], x: 0, y: 0 };
};
const fits = (m, px, py, g = grid) => m.every((r, y) => r.every((v, x) =>
  !v || (px + x >= 0 && px + x < COLS && py + y < ROWS && (py + y < 0 || !g[py + y][px + x]))));
const speed = () => Math.max(60, 800 - (level - 1) * 70); // ms por linha

function spawn() {
  piece = next; next = fromBag();
  piece.x = (COLS - piece.m[0].length) / 2 | 0;
  piece.y = piece.k === 'I' ? -1 : 0;
  if (!fits(piece.m, piece.x, piece.y)) gameOver();
}

function reset() {
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  bag = []; next = fromBag();
  score = 0; lines = 0; level = 1; over = false; paused = false; dropAcc = 0; clearing = null;
  setMood('dance', 0);
  spawn(); hud();
  $('overlay').hidden = true;
}

function hud() {
  $('score').textContent = score; $('lines').textContent = lines; $('level').textContent = level;
}

function setMood(m, ms) { mood = m; moodUntil = ms ? performance.now() + ms : Infinity; }

function move(dx, dy) {
  if (!fits(piece.m, piece.x + dx, piece.y + dy)) return false;
  piece.x += dx; piece.y += dy;
  return true;
}

function turn(dir) {
  const m = dir > 0 ? rotate(piece.m) : rotate(rotate(rotate(piece.m)));
  for (const k of [0, -1, 1, -2, 2]) // chute simples de parede
    if (fits(m, piece.x + k, piece.y)) { piece.m = m; piece.x += k; return; }
}

function lock() {
  piece.m.forEach((r, y) => r.forEach((v, x) => { if (v && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = piece.k; }));
  if (piece.m.some((r, y) => r.some(v => v) && piece.y + y < 0)) return gameOver();
  const full = grid.map((r, y) => r.every(Boolean) ? y : -1).filter(y => y >= 0);
  if (full.length) {
    clearing = { rows: full, until: performance.now() + 250 }; // pisca antes de sumir
    score += POINTS[full.length] * level;
    lines += full.length;
    level = 1 + (lines / 10 | 0);
    setMood(full.length === 4 ? 'party' : 'cheer', 1500);
    hud();
  } else spawn();
}

function finishClear() {
  grid = grid.filter((_, y) => !clearing.rows.includes(y));
  while (grid.length < ROWS) grid.unshift(Array(COLS).fill(''));
  clearing = null;
  spawn();
}

function gameOver() {
  over = true; setMood('sad', 0);
  if (score > best) { best = score; try { localStorage.setItem('blocos-best', best); } catch {} $('best').textContent = best; }
  setTimeout(() => {
    $('overlay-title').textContent = `FIM DE JOGO\n${score} PONTOS`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1200);
}

addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') return reset();
  if (over || clearing) return;
  if (e.key === 'p' || e.key === 'P') { paused = !paused; return; }
  if (paused) return;
  const k = e.key;
  if (k === 'ArrowLeft') move(-1, 0);
  else if (k === 'ArrowRight') move(1, 0);
  else if (k === 'ArrowDown') { if (move(0, 1)) score++; else lock(); dropAcc = 0; hud(); }
  else if (k === 'ArrowUp' || k === 'x' || k === 'X') turn(1);
  else if (k === 'z' || k === 'Z') turn(-1);
  else if (k === ' ') { while (move(0, 1)) score += 2; lock(); hud(); }
  else return;
  e.preventDefault(); // setas e espaço não rolam a página
});
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function block(x, y, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color; ctx.fillRect(x, y, CELL, CELL);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, CELL, 4); ctx.fillRect(x, y, 4, CELL);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, y + CELL - 4, CELL, 4); ctx.fillRect(x + CELL - 4, y, 4, CELL);
  ctx.globalAlpha = 1;
}

function stackHeight() {
  const top = grid.findIndex(r => r.some(Boolean));
  return top < 0 ? 0 : ROWS - top;
}

function drawDancer(a, x, ground, step, i, t) {
  const beat = speed() * 0.75, ph = t / beat * Math.PI + i; // dança acelera com o nível
  const danger = mood === 'dance' && stackHeight() >= 15;
  let y = 0, sx = x, rot = 0, flip = 1, mouth = 'smile', dx = Math.sin(ph) , dy = 0, bubble = '';
  if (mood === 'sad') { y = 4; mouth = 'sad'; dy = 1; dx = 0; sx += Math.sin(t / 90 + i) * 2; }
  else if (danger) { sx += Math.sin(t / 35 + i) * 2; mouth = 'open'; dx = x < W / 2 ? 1 : -1; if (i === 1) bubble = 'EITA!'; }
  else if (mood === 'cheer' || mood === 'party') {
    y = -Math.abs(Math.sin(t / 120 + i)) * (mood === 'party' ? 40 : 22); mouth = 'open'; dy = -1;
    if (mood === 'party') rot = (t / 150 + i) % (Math.PI * 2);
    if (i === 0 || i === 3) bubble = mood === 'party' ? 'QUADRA!' : 'BOA!';
  } else if (step === 0) y = -Math.abs(Math.sin(ph)) * 10;                    // pulinho
  else if (step === 1) { rot = Math.sin(ph) * 0.3; y = -Math.abs(Math.cos(ph)) * 4; } // balanço
  else if (step === 2) { sx += Math.sin(ph) * 14; flip = Math.cos(ph) > 0 ? 1 : -1; } // passinho de lado
  else { flip = Math.cos(ph / 2); y = -Math.abs(Math.sin(ph)) * 6; }           // giro

  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sx, ground, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(sx, ground + y); ctx.rotate(rot); ctx.scale(2 * flip, 2);
  drawAvatar(ctx, { ...a, mouth }, 0, -16, dx, dy, false);
  ctx.restore();
  if (mood === 'sad') for (const s of [-1, 1]) {
    ctx.fillStyle = '#64b5f6';
    ctx.fillRect(sx + s * 10 - 2, ground + y - 40 + (t / 12 + (s > 0 ? 15 : 0)) % 30, 3, 5);
  }
  if (bubble) drawBubble(ctx, sx, ground + y - 92, bubble);
}

function draw(t) {
  const dt = Math.min(100, t - (last ?? t)); last = t;
  if (!over && !paused) {
    if (clearing) { if (t >= clearing.until) finishClear(); }
    else if ((dropAcc += dt) >= speed()) { dropAcc = 0; if (!move(0, 1)) lock(); }
  }
  if (t > moodUntil) setMood('dance', 0);

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  // luzes de pista piscando no ritmo
  const beatN = t / (speed() * 1.5) | 0;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `hsla(${(i * 60 + beatN * 40) % 360},80%,60%,${(beatN + i) % 2 ? .08 : .16})`;
    ctx.beginPath(); ctx.moveTo(i * 144, 0); ctx.lineTo(i * 144 - 80, H); ctx.lineTo(i * 144 + 80, H); ctx.fill();
  }

  ctx.fillStyle = '#0b0b18'; ctx.fillRect(BX - 4, BY - 4, COLS * CELL + 8, ROWS * CELL + 8);
  ctx.strokeStyle = '#3d2e73'; ctx.lineWidth = 4; ctx.strokeRect(BX - 4, BY - 4, COLS * CELL + 8, ROWS * CELL + 8);
  grid.forEach((r, y) => r.forEach((k, x) => {
    if (!k) return;
    const flash = clearing?.rows.includes(y) && (t / 60 | 0) % 2;
    block(BX + x * CELL, BY + y * CELL, flash ? '#fff' : COLORS[k]);
  }));

  if (!over && !clearing) {
    let gy = piece.y;
    while (fits(piece.m, piece.x, gy + 1)) gy++;
    piece.m.forEach((r, y) => r.forEach((v, x) => {
      if (!v) return;
      if (gy + y >= 0) block(BX + (piece.x + x) * CELL, BY + (gy + y) * CELL, COLORS[piece.k], 0.2); // fantasma
      if (piece.y + y >= 0) block(BX + (piece.x + x) * CELL, BY + (piece.y + y) * CELL, COLORS[piece.k]);
    }));
  }

  // próxima peça
  ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a99fd1'; ctx.fillText('PRÓXIMA', 535, 24);
  ctx.fillStyle = '#0b0b18'; ctx.fillRect(490, 34, 90, 60);
  const nm = next.m, s = 16;
  nm.forEach((r, y) => r.forEach((v, x) => {
    if (!v) return;
    const px = 535 - nm[0].length * s / 2 + x * s, py = 64 - nm.length * s / 2 + y * s;
    ctx.fillStyle = COLORS[next.k]; ctx.fillRect(px, py, s - 2, s - 2);
  }));

  const me = AVATARS.indexOf(currentAvatar());
  DANCERS.forEach(([x, g, step], i) => drawDancer(AVATARS[(me + i) % AVATARS.length], x, g, step, i, t));

  if (paused) {
    ctx.fillStyle = 'rgba(10,6,24,.7)'; ctx.fillRect(BX, BY, COLS * CELL, ROWS * CELL);
    ctx.font = '14px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText('PAUSA', W / 2, H / 2);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem de rotação e colisão
console.assert(JSON.stringify(rotate([[0, 1, 0], [1, 1, 1]])) === '[[1,0],[1,1],[1,0]]', 'rotação T');
console.assert(fits(SHAPES.O, 0, 0) && !fits(SHAPES.O, -1, 0) && !fits(SHAPES.O, 9, 0) && !fits(SHAPES.O, 0, 19), 'paredes e chão');
