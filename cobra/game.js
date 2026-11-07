const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
// canvas em pé (mobile first): faixa do avatar em cima, tabuleiro embaixo
const COLS = 15, ROWS = 18, CELL = 24, TOP = 96, W = COLS * CELL, H = TOP + ROWS * CELL;
const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍉'];
const DIRS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };

let snake, dir, queue, food, score, started, over, acc, last, mood, moodUntil, timer;
let best = 0;
try { best = Number(localStorage.getItem('cobra-best')) || 0; } catch {}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const hits = (c, body) => c[0] < 0 || c[1] < 0 || c[0] >= COLS || c[1] >= ROWS || body.some(s => same(s, c));
const speed = () => Math.max(70, 170 - score * 4); // ms por passo

function setMood(m, ms = 0) { mood = m; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('score').textContent = score; $('best').textContent = best; }

function placeFood() {
  const free = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!snake.some(s => same(s, [x, y]))) free.push([x, y]);
  food = free[Math.random() * free.length | 0]; // tabuleiro cheio deixa undefined: a cobra só segue andando
  if (food) food[2] = FRUITS[Math.random() * FRUITS.length | 0];
}

function reset() {
  snake = [[7, 12], [7, 13], [7, 14]];
  dir = [0, -1]; queue = [];
  score = 0; started = false; over = false; acc = 0;
  clearTimeout(timer);
  setMood('idle');
  placeFood(); hud();
  $('overlay').hidden = true;
}

// fila de até 2 viradas: deslizar rápido "↑ ←" funciona sem a cobra dar ré
function turn(d) {
  if (over) return;
  const prev = queue.at(-1) || dir;
  started = true;
  if (same(d, prev) || (d[0] === -prev[0] && d[1] === -prev[1])) return;
  if (queue.length < 2) queue.push(d);
}

function step() {
  if (queue.length) dir = queue.shift();
  const h = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
  const eat = food && same(h, food);
  if (hits(h, eat ? snake : snake.slice(0, -1))) return die(); // a cauda sai do lugar, dá pra seguir ela
  snake.unshift(h);
  if (eat) { score++; hud(); setMood('happy', 600); placeFood(); }
  else snake.pop();
}

function die() {
  over = true; setMood('sad');
  if (score > best) { best = score; try { localStorage.setItem('cobra-best', best); } catch {} hud(); }
  timer = setTimeout(() => {
    $('overlay-title').textContent = `FIM DE JOGO\n${score} FRUTAS`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1000);
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') return reset();
  if (DIRS[k]) { turn(DIRS[k]); e.preventDefault(); }
});
// deslizar: a cada 20px no mesmo gesto conta uma virada
let swipe = null;
canvas.addEventListener('pointerdown', e => { swipe = [e.clientX, e.clientY]; });
canvas.addEventListener('pointermove', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  swipe = [e.clientX, e.clientY];
});
addEventListener('pointerup', () => { swipe = null; });
addEventListener('pointercancel', () => { swipe = null; });
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function draw(t) {
  const dt = Math.min(100, t - (last ?? t)); last = t;
  if (started && !over && (acc += dt) >= speed()) { acc -= speed(); step(); }
  if (t > moodUntil) setMood('idle');

  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#1d1438' : '#221946';
    ctx.fillRect(x * CELL, TOP + y * CELL, CELL, CELL);
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (food) { ctx.font = '19px serif'; ctx.fillText(food[2], (food[0] + .5) * CELL, TOP + (food[1] + .5) * CELL + 1); }

  snake.forEach(([x, y], i) => {
    const p = i ? 3 : 1;
    ctx.fillStyle = i ? (i % 2 ? '#66bb6a' : '#5aa85e') : '#9ccc65';
    ctx.beginPath(); ctx.roundRect(x * CELL + p, TOP + y * CELL + p, CELL - p * 2, CELL - p * 2, 6); ctx.fill();
  });
  const [hx, hy] = snake[0];
  for (const s of [-1, 1]) { // olhos olham pra onde a cobra vai
    const ex = (hx + .5) * CELL + dir[0] * 4 + dir[1] * s * 5, ey = TOP + (hy + .5) * CELL + dir[1] * 4 + dir[0] * s * 5;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(ex + dir[0], ey + dir[1], 1.8, 0, Math.PI * 2); ctx.fill();
  }

  // perigo: o próximo passo bate em algo
  const next = [hx + (queue[0] || dir)[0], hy + (queue[0] || dir)[1]];
  const danger = started && !over && mood === 'idle' && hits(next, snake.slice(0, -1));
  const m = danger ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 50, TOP - 8, 2, m, t, 1);
  const bubble = { happy: 'NHAM!', sad: 'AAAH!', worried: 'EITA!' }[m];
  if (bubble) drawBubble(ctx, 150, 36, bubble);
  else if (!started) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText('DESLIZE PARA', 220, 38); ctx.fillText('COMEÇAR', 220, 56);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem de colisão e viradas
console.assert(hits([-1, 0], []) && hits([0, ROWS], []) && hits([2, 2], [[2, 2]]) && !hits([2, 2], []), 'colisão');
turn([0, 1]); console.assert(!queue.length, 'não pode dar ré');
turn([1, 0]); turn([0, 1]); console.assert(queue.length === 2, 'fila de viradas');
reset();
