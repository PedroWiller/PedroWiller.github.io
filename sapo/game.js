const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
// em pé: faixa do avatar em cima; linhas de cima pra baixo: chegada, rio (1-4), grama, rua (6-10), início
const COLS = 9, ROWS = 12, CELL = 40, TOP = 80, W = COLS * CELL, H = TOP + ROWS * CELL;
const START = ROWS - 1, GOALS = [0, 2, 4, 6, 8];
const DIRS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
const CAR_COLORS = ['#e53935', '#fdd835', '#42a5f5', '#ab47bc', '#ff7043'];
// speed em casas por segundo; len/gap em casas
const LANES = [
  { row: 1, river: true, dir: 1, speed: 1.0, len: 3, gap: 3 },
  { row: 2, river: true, dir: -1, speed: 1.4, len: 2, gap: 2 },
  { row: 3, river: true, dir: 1, speed: 0.8, len: 4, gap: 3 },
  { row: 4, river: true, dir: -1, speed: 1.2, len: 3, gap: 3 },
  { row: 6, dir: -1, speed: 1.6, len: 1, gap: 3 },
  { row: 7, dir: 1, speed: 1.0, len: 2, gap: 4 },
  { row: 8, dir: -1, speed: 2.2, len: 1, gap: 4 },
  { row: 9, dir: 1, speed: 1.3, len: 1, gap: 2 },
  { row: 10, dir: -1, speed: 0.9, len: 2, gap: 3 },
];
const laneAt = row => LANES.find(l => l.row === row);

let fx, row, maxRow, filled, score, lives, level, deadAt, over, last, hopAt, mood, moodUntil, bubble, started, timer;
let best = 0;
try { best = Number(localStorage.getItem('sapo-best')) || 0; } catch {}

const colX = c => c * CELL + CELL / 2;
const mult = () => 1 + (level - 1) * .2;
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() {
  $('score').textContent = score; $('lives').textContent = lives; $('level').textContent = level; $('best').textContent = best;
}

// itens da faixa: começam em x e ocupam len casas; o período cobre a tela toda + um item, então nunca abre buraco
function items(l) {
  const span = (l.len + l.gap) * CELL, n = Math.ceil((W + span) / span), P = n * span;
  return Array.from({ length: n }, (_, k) => ((l.off + k * span) % P + P) % P - span);
}
// rua: qualquer encosto mata; rio: o centro do sapo precisa estar sobre um tronco
function hit(l, x) {
  const w = l.len * CELL;
  return items(l).some(ix => l.river ? x >= ix + 4 && x <= ix + w - 4 : x + 14 > ix + 3 && x - 14 < ix + w - 3);
}

function spawn() { fx = colX(4); row = START; maxRow = START; deadAt = null; }

function reset() {
  score = 0; lives = 3; level = 1; over = false; started = false; filled = [];
  LANES.forEach(l => { l.off = Math.random() * CELL * 4; });
  clearTimeout(timer);
  spawn(); setMood('idle'); hud();
  $('overlay').hidden = true;
}

function hop([dx, dy]) {
  if (over || deadAt) return;
  started = true; hopAt = performance.now();
  const nr = row + dy;
  if (nr < 0 || nr > START) return;
  let nx = fx + dx * CELL;
  if (!laneAt(nr)?.river) nx = colX(Math.round((nx - CELL / 2) / CELL)); // fora do rio volta pra grade
  if (nx < CELL / 2 - 1 || nx > W - CELL / 2 + 1) return;
  fx = nx; row = nr;
  if (row < maxRow) { score += 10 * (maxRow - row); maxRow = row; hud(); }
  if (row === 0) arrive();
}

function arrive() {
  const c = Math.round((fx - CELL / 2) / CELL);
  if (!GOALS.includes(c) || filled.includes(c)) return die('BATI!');
  filled.push(c); score += 50;
  if (filled.length === GOALS.length) {
    level++; score += 200; filled = [];
    setMood('happy', `FASE ${level}!`, 1400);
  } else setMood('happy', 'CHEGUEI!', 900);
  saveBest(); spawn(); hud();
}

function die(text) {
  deadAt = performance.now(); lives--;
  setMood('sad', text, 1000);
  saveBest(); hud();
  if (lives > 0) { timer = setTimeout(spawn, 900); return; }
  over = true;
  timer = setTimeout(() => {
    $('overlay-title').textContent = `FIM DE JOGO\n${score} PONTOS\nFASE ${level}`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1100);
}

function saveBest() {
  if (score > best) { best = score; try { localStorage.setItem('sapo-best', best); } catch {} }
}

function update(dt) {
  const m = mult();
  LANES.forEach(l => { l.off += l.dir * l.speed * m * CELL * dt; });
  if (deadAt || over) return;
  const l = laneAt(row);
  if (!l) return;
  if (l.river) {
    fx += l.dir * l.speed * m * CELL * dt; // tronco carrega o sapo
    if (!hit(l, fx)) return die('SPLASH!');
    if (fx < 8 || fx > W - 8) return die('CAÍ!');
  } else if (hit(l, fx)) die('AI!');
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') return reset();
  if (DIRS[k] && !e.repeat) { e.preventDefault(); hop(DIRS[k]); }
});
// toque: deslizar pula na direção; toque simples pula pra frente
let swipe = null;
canvas.addEventListener('pointerdown', e => { swipe = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return hop([0, -1]);
  hop(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
});
canvas.addEventListener('pointercancel', () => { swipe = null; });
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function drawLane(l, y) {
  const w = l.len * CELL;
  items(l).forEach((x, i) => {
    if (l.river) {
      ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.roundRect(x + 2, y + 6, w - 4, CELL - 12, 12); ctx.fill();
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x + 10, y + 14, w - 20, 3); ctx.fillRect(x + 16, y + 23, w - 32, 3);
    } else {
      ctx.fillStyle = CAR_COLORS[(l.row + i) % CAR_COLORS.length];
      ctx.beginPath(); ctx.roundRect(x + 3, y + 7, w - 6, CELL - 14, 6); ctx.fill();
      ctx.fillStyle = '#bbdefb'; // para-brisa na frente
      const front = l.dir > 0 ? x + w - 14 : x + 6;
      ctx.fillRect(front, y + 11, 8, CELL - 22);
    }
  });
}

function draw(t) {
  const dt = Math.min(.05, (t - (last ?? t)) / 1000); last = t;
  if (started) update(dt);
  if (t > moodUntil) setMood('idle');

  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  for (let r = 0; r < ROWS; r++) {
    const y = TOP + r * CELL, l = laneAt(r);
    ctx.fillStyle = r === 0 ? '#1b5e20' : l?.river ? '#1565c0' : l ? '#37474f' : '#43a047';
    ctx.fillRect(0, y, W, CELL);
    if (l && !l.river) { ctx.fillStyle = '#90a4ae'; for (let x = 6; x < W; x += 30) ctx.fillRect(x, y + CELL - 2, 14, 2); }
    if (l) drawLane(l, y);
  }
  // vitórias-régias na chegada
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  GOALS.forEach(c => {
    ctx.fillStyle = '#1565c0'; ctx.fillRect(c * CELL, TOP, CELL, CELL);
    ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(colX(c), TOP + CELL / 2, 14, .4, Math.PI * 2 - .4); ctx.fill();
    if (filled.includes(c)) { ctx.font = '26px serif'; ctx.fillText('🐸', colX(c), TOP + CELL / 2 + 2); }
  });

  // sapo: dá um pulinho ao andar, some piscando ao morrer
  if (!over && !(deadAt && (t / 100 | 0) % 2)) {
    const p = Math.min(1, (t - (hopAt ?? -1e9)) / 120), s = 1 + Math.sin(p * Math.PI) * .25;
    ctx.save(); ctx.translate(fx, TOP + row * CELL + CELL / 2 + 2); ctx.scale(s, s);
    ctx.font = '28px serif'; ctx.fillText(deadAt ? '💥' : '🐸', 0, 0);
    ctx.restore();
  }

  const m = mood === 'idle' && laneAt(row)?.river && !deadAt ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 50, TOP - 8, 2, m, t);
  if (bubble) drawBubble(ctx, 170, 34, bubble);
  else if (!started) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText('DESLIZE PARA PULAR', 215, 30); ctx.fillText('CHEGUE NAS FOLHAS', 215, 50);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: toda faixa cobre a tela sem buraco e a colisão bate com a geometria
{
  const l = { row: 99, river: true, dir: 1, len: 2, gap: 3 };
  for (let off = -500; off < 500; off += 7) {
    l.off = off;
    const xs = items(l), span = 5 * CELL;
    console.assert(Math.min(...xs) <= 0 && Math.max(...xs) + span >= W, 'faixa cobre a tela', off);
  }
  l.off = 0; const x0 = items(l).find(x => x >= 0 && x < W - 2 * CELL);
  console.assert(hit(l, x0 + CELL) && !hit(l, x0 + 2 * CELL + 20), 'tronco');
  const car = { ...l, river: false, len: 1, off: 0 }, c0 = items(car).find(x => x >= 0 && x < W - CELL);
  console.assert(hit(car, c0 + CELL / 2) && !hit(car, c0 + CELL + 20), 'carro');
}
