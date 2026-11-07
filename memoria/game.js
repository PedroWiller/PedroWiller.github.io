const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 520, TOP = 100, N = 4, CW = 78, CH = 92, GAP = 8;
const X0 = (W - N * CW - (N - 1) * GAP) / 2, Y0 = TOP + 14;
const POOL = ['🍕', '🚀', '🐱', '⚽', '🎸', '🌵', '🍩', '👾', '🐙', '🎈', '🦄', '🍉'];
const FLIP = 180; // ms

let cards, first, lock, moves, pairs, startAt, over, mood, moodUntil, bubble, timer, shownSecs;
let best = 0;
try { best = Number(localStorage.getItem('memoria-best')) || 0; } catch {}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() {
  $('moves').textContent = moves; $('pairs').textContent = `${pairs}/8`; $('best').textContent = best || '-';
}

function reset() {
  const faces = shuffle([...POOL]).slice(0, N * N / 2);
  cards = shuffle([...faces, ...faces]).map(f => ({ f, up: false, done: false, flipAt: -1e9 }));
  first = null; lock = false; moves = 0; pairs = 0; startAt = null; over = false; shownSecs = -1;
  clearTimeout(timer);
  setMood('idle');
  hud(); $('time').textContent = 0;
  $('overlay').hidden = true;
}

function flip(c, up) { c.up = up; c.flipAt = performance.now(); }

function tap(i) {
  const c = cards[i];
  if (!c || lock || over || c.up) return;
  startAt ??= performance.now();
  flip(c, true);
  if (first === null) { first = i; setMood('idle'); return; }
  const a = cards[first];
  first = null; moves++;
  if (a.f === c.f) {
    a.done = c.done = true; pairs++;
    if (pairs === N * N / 2) return win();
    setMood('happy', 'ACHEI!', 900);
  } else {
    lock = true;
    setMood(moves > 12 ? 'sad' : 'meh', moves > 12 ? 'AFF' : 'ERREI', 900);
    timer = setTimeout(() => { flip(a, false); flip(c, false); lock = false; }, 800);
  }
  hud();
}

function win() {
  over = true; hud();
  setMood('happy', 'VENCI!');
  const secs = Math.round((performance.now() - startAt) / 1000);
  if (!best || moves < best) { best = moves; try { localStorage.setItem('memoria-best', best); } catch {} hud(); }
  timer = setTimeout(() => {
    $('overlay-title').textContent = `ACHOU TUDO!\n${moves} JOGADAS\n${secs}s`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1200);
}

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width - X0, y = (e.clientY - r.top) * H / r.height - Y0;
  const col = Math.floor(x / (CW + GAP)), row = Math.floor(y / (CH + GAP));
  // toque no vão entre cartas não conta
  if (col < 0 || row < 0 || col >= N || row >= N || x - col * (CW + GAP) > CW || y - row * (CH + GAP) > CH) return;
  tap(row * N + col);
});
addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') reset(); });
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function drawCard(c, i, t) {
  const x = X0 + (i % N) * (CW + GAP), y = Y0 + (i / N | 0) * (CH + GAP);
  const p = Math.min(1, Math.max(0, (t - c.flipAt) / FLIP));
  const face = p < .5 ? !c.up : c.up; // meio do giro troca de lado
  const sx = Math.abs(1 - 2 * p) || .02;
  ctx.save(); ctx.translate(x + CW / 2, y + CH / 2); ctx.scale(sx, 1);
  ctx.fillStyle = face ? (c.done ? '#2e7d32' : '#f4f0ff') : '#3d2e73';
  ctx.beginPath(); ctx.roundRect(-CW / 2, -CH / 2, CW, CH, 8); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (face) { ctx.font = '38px serif'; ctx.fillText(c.f, 0, 3); }
  else {
    ctx.strokeStyle = '#5a47a3'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-CW / 2 + 6, -CH / 2 + 6, CW - 12, CH - 12, 5); ctx.stroke();
    ctx.font = '20px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.fillText('?', 0, 2);
  }
  ctx.restore();
}

function draw(t) {
  if (t > moodUntil) setMood('idle');
  const secs = startAt && !over ? Math.floor((performance.now() - startAt) / 1000) : shownSecs;
  if (secs !== shownSecs) { shownSecs = secs; $('time').textContent = secs; }

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  cards.forEach((c, i) => drawCard(c, i, t));

  // pensando quando tem uma carta virada esperando o par
  const m = mood === 'idle' && first !== null ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 50, TOP - 10, 2, m, t, first !== null ? 1 : 0);
  if (bubble) drawBubble(ctx, 150, 38, bubble);
  else if (!startAt) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center';
    ctx.fillText('TOQUE NAS CARTAS', 210, 42); ctx.fillText('E ACHE OS PARES', 210, 60);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: baralho com 8 pares
console.assert(cards.length === 16 && new Set(cards.map(c => c.f)).size === 8 &&
  cards.every(c => cards.filter(d => d.f === c.f).length === 2), 'baralho');
