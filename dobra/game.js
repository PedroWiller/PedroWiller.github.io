const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 440, TOP = 80, GAP = 8, BOARD = 352, X0 = (W - BOARD) / 2, Y0 = TOP + 4;
// dificuldade = tamanho do tabuleiro; no 3x3 não cabe um 2048, então a meta cai
const LEVELS = { facil: { n: 5, goal: 2048 }, normal: { n: 4, goal: 2048 }, dificil: { n: 3, goal: 512 } };
const SLIDE = 100; // ms
const DIRS = {
  arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1],
  arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0],
};

let grid, ghosts, score, won, over, moveAt, mood, bubble, moodUntil, timer;
let diff, N, TILE, GOAL, best;
// 'dobra-best' sem sufixo é o recorde de antes de existir dificuldade (era 4x4)
const bestKey = d => d === 'normal' ? 'dobra-best' : `dobra-best-${d}`;

function setDiff(d) {
  diff = LEVELS[d] ? d : 'normal';
  ({ n: N, goal: GOAL } = LEVELS[diff]);
  TILE = (BOARD - (N + 1) * GAP) / N;
  best = 0;
  try { best = Number(localStorage.getItem(bestKey(diff))) || 0; localStorage.setItem('dobra-diff', diff); } catch {}
  document.querySelectorAll('#diffs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.diff === diff));
  reset();
}

const tiles = () => grid.flat().filter(Boolean);
const empties = () => grid.flatMap((row, r) => row.map((t, c) => t ? null : [r, c]).filter(Boolean));
const canMove = () => empties().length > 0 ||
  grid.some((row, r) => row.some((t, c) => (c < N - 1 && row[c + 1].v === t.v) || (r < N - 1 && grid[r + 1][c].v === t.v)));

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() {
  $('score').textContent = score; $('best').textContent = best;
  $('max').textContent = Math.max(...tiles().map(t => t.v));
}

function spawn() {
  const e = empties();
  if (!e.length) return;
  const [r, c] = e[Math.random() * e.length | 0];
  grid[r][c] = { v: Math.random() < 0.9 ? 2 : 4, r, c, fr: r, fc: c, born: performance.now(), merged: false };
}

function reset() {
  grid = Array.from({ length: N }, () => Array(N).fill(null));
  ghosts = []; score = 0; won = false; over = false; moveAt = -1e9;
  clearTimeout(timer);
  setMood('idle');
  spawn(); spawn(); hud();
  $('overlay').hidden = true;
}

// desliza tudo para [dr, dc]; cada peça junta no máximo uma vez por jogada. Retorna se algo mexeu.
function move([dr, dc]) {
  let moved = false, gained = 0;
  ghosts = [];
  for (const t of tiles()) { t.fr = t.r; t.fc = t.c; t.merged = false; t.born = -1e9; }
  for (let i = 0; i < N; i++) {
    // casas da linha/coluna, começando pela borda para onde tudo vai
    const cells = Array.from({ length: N }, (_, j) => { const k = dr + dc > 0 ? N - 1 - j : j; return dr ? [k, i] : [i, k]; });
    const line = cells.map(([r, c]) => grid[r][c]).filter(Boolean);
    cells.forEach(([r, c]) => { grid[r][c] = null; });
    let out = 0;
    for (let j = 0; j < line.length; j++) {
      const t = line[j], nxt = line[j + 1], [r, c] = cells[out++];
      if (nxt && nxt.v === t.v) {
        ghosts.push({ ...nxt, r, c }); // a que some desliza até o mesmo lugar
        t.v *= 2; t.merged = true; gained += t.v; j++;
        moved = true;
      }
      if (t.r !== r || t.c !== c) moved = true;
      t.r = r; t.c = c; grid[r][c] = t;
    }
  }
  if (moved) score += gained;
  return { moved, gained };
}

function play(dir) {
  if (over || !$('overlay').hidden) return;
  const { moved, gained } = move(dir);
  if (!moved) return;
  moveAt = performance.now();
  spawn();
  if (score > best) { best = score; try { localStorage.setItem(bestKey(diff), best); } catch {} }
  hud();
  if (!won && tiles().some(t => t.v >= GOAL)) { won = true; setMood('happy', 'VENCI!', 2500); }
  else if (gained >= 64) setMood('happy', gained >= 256 ? 'UAU!' : 'BOA!', 700);
  if (!canMove()) {
    over = true; setMood('sad', 'TRAVOU');
    timer = setTimeout(() => {
      $('overlay-title').textContent = `SEM JOGADAS\n${score} PONTOS`;
      $('overlay').hidden = false; $('restart').focus();
    }, 1200);
  }
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') return reset();
  if (DIRS[k]) { e.preventDefault(); if (!e.repeat) play(DIRS[k]); }
});
// um deslize = uma jogada
let swipe = null;
canvas.addEventListener('pointerdown', e => { swipe = [e.clientX, e.clientY]; });
addEventListener('pointerup', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  play(Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0]);
});
addEventListener('pointercancel', () => { swipe = null; });
$('restart').addEventListener('click', reset);
document.querySelectorAll('#diffs button').forEach(b => b.addEventListener('click', () => { setDiff(b.dataset.diff); b.blur(); }));

// ---------- desenho ----------
const clamp01 = x => Math.min(1, Math.max(0, x));
function drawTile(t, now) {
  const p = clamp01((now - moveAt) / SLIDE), e = 1 - (1 - p) ** 2;
  const r = t.fr + (t.r - t.fr) * e, c = t.fc + (t.c - t.fc) * e;
  let s = 1;
  if (t.born > 0) s = clamp01((now - t.born - SLIDE) / 120);           // nasce depois de deslizar
  else if (t.merged && p >= 1) s = 1 + 0.15 * Math.sin(Math.PI * clamp01((now - moveAt - SLIDE) / 150)); // pulsa ao juntar
  if (s <= 0) return;
  const x = X0 + GAP + c * (TILE + GAP) + TILE / 2, y = Y0 + GAP + r * (TILE + GAP) + TILE / 2;
  const lvl = Math.log2(t.v);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = `hsl(${(lvl * 33 + 180) % 360}, 70%, ${Math.min(62, 38 + lvl * 2)}%)`;
  ctx.beginPath(); ctx.roundRect(-TILE / 2, -TILE / 2, TILE, TILE, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-TILE / 2 + 6, -TILE / 2 + 5, TILE - 12, 4);
  if (t.v >= GOAL) { ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 3; ctx.stroke(); }
  const digits = String(t.v).length;
  ctx.font = `${[0, 24, 22, 18, 14, 11][Math.min(digits, 5)] * TILE / 78 | 0}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillText(t.v, 2, 4);
  ctx.fillStyle = '#fff'; ctx.fillText(t.v, 0, 2);
  ctx.restore();
}

function draw(t) {
  const now = performance.now(); // mesmo relógio do moveAt/born
  if (now > moodUntil) setMood('idle');

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3d2e73'; ctx.beginPath(); ctx.roundRect(X0, Y0, BOARD, BOARD, 10); ctx.fill();
  ctx.fillStyle = '#241a45';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    ctx.beginPath(); ctx.roundRect(X0 + GAP + c * (TILE + GAP), Y0 + GAP + r * (TILE + GAP), TILE, TILE, 8); ctx.fill();
  }
  if (now - moveAt < SLIDE) ghosts.forEach(g => drawTile(g, now));
  tiles().forEach(tl => drawTile(tl, now));

  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  const m = mood === 'idle' && !over && empties().length <= 2 ? 'worried' : mood; // tabuleiro quase cheio
  drawMood(ctx, currentAvatar(), 46, TOP - 8, 1.8, m, t);
  const text = bubble || (m === 'worried' ? 'EITA!' : '');
  if (text) drawBubble(ctx, 150, 32, text);
  else if (!score) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center';
    ctx.fillText('DESLIZE E JUNTE', 220, 32); ctx.fillText(`ATÉ O ${GOAL}`, 220, 50);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
let saved = 'normal';
try { saved = localStorage.getItem('dobra-diff') || 'normal'; } catch {}
setDiff(saved);
requestAnimationFrame(draw);

// auto-checagem das regras de junção (em 4x4, depois volta pra dificuldade salva)
{
  N = 4;
  const set = rows => { grid = rows.map((row, r) => row.map((v, c) => v ? { v, r, c } : null)); };
  const vals = () => grid.map(row => row.map(t => t ? t.v : 0).join(',')).join('|');
  set([[2, 2, 2, 2], [2, 2, 4, 0], [4, 0, 0, 4], [0, 0, 0, 0]]);
  console.assert(move([0, -1]).gained === 20 && vals() === '4,4,0,0|4,4,0,0|8,0,0,0|0,0,0,0', 'esquerda junta uma vez por peça');
  set([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  move([0, 1]); console.assert(vals().startsWith('0,0,0,4'), 'direita');
  set([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]]);
  move([1, 0]); console.assert(vals() === '0,0,0,0|0,0,0,0|4,0,0,0|8,0,0,0', 'baixo');
  set([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  console.assert(!canMove() && !move([0, -1]).moved, 'travado');
  set([[2, 2, 0], [0, 0, 0], [0, 0, 4]]); N = 3;
  move([0, -1]); console.assert(vals() === '4,0,0|0,0,0|4,0,0', '3x3');
  setDiff(diff);
}
