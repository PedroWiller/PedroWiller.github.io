const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 520, TOP = 100, BASE = 480, DH = 24, PEG_X = [60, 180, 300];
const COLORS = ['#ef5350', '#ff9800', '#ffeb3b', '#66bb6a', '#29b6f6', '#5c6bc0', '#ab47bc'];

let n = 3, pegs, held, moves, over, mood, moodUntil, bubble, timer;
try { n = Number(localStorage.getItem('hanoi-n')) || 3; } catch {}
if (n < 3 || n > 7) n = 3;

// regra do jogo: só move o disco do topo e nunca em cima de um menor
const canMove = (p, a, b) => p[a].length > 0 && (p[b].length === 0 || p[b].at(-1) > p[a].at(-1));
const won = p => p[0].length === 0 && (p[1].length === 0 || p[2].length === 0);
const bestKey = () => `hanoi-best-${n}`;
function getBest() { try { return Number(localStorage.getItem(bestKey())) || 0; } catch { return 0; } }

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('moves').textContent = moves; $('min').textContent = 2 ** n - 1; $('best').textContent = getBest() || '-'; }

function reset() {
  pegs = [Array.from({ length: n }, (_, i) => n - i), [], []]; // disco n é o maior, fica embaixo
  held = null; moves = 0; over = false;
  clearTimeout(timer);
  setMood('idle');
  hud();
  $('overlay').hidden = true;
}

function tap(i) {
  if (over) return;
  if (held === null) {
    if (!pegs[i].length) return setMood('meh', 'VAZIO!', 700);
    held = i; setMood('idle');
    return;
  }
  if (i === held) { held = null; return; }
  if (!canMove(pegs, held, i)) return setMood('worried', 'NÃO PODE!', 900);
  pegs[i].push(pegs[held].pop());
  held = null; moves++;
  hud();
  if (won(pegs)) win();
}

function win() {
  over = true;
  const min = 2 ** n - 1, best = getBest();
  setMood('happy', moves === min ? 'PERFEITO!' : 'CONSEGUI!');
  if (!best || moves < best) { try { localStorage.setItem(bestKey(), moves); } catch {} hud(); }
  timer = setTimeout(() => {
    $('overlay-title').textContent = `TORRE MOVIDA!\n${moves} JOGADAS\nMÍNIMO: ${min}`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1200);
}

// cada terço do canvas é um pino: alvo de toque grande
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  tap(Math.min(2, Math.floor((e.clientX - r.left) / r.width * 3)));
});
addEventListener('keydown', e => {
  if (['1', '2', '3'].includes(e.key)) tap(e.key - 1);
  if (e.key === 'r' || e.key === 'R') reset();
});
$('restart').addEventListener('click', reset);

for (let k = 3; k <= 7; k++) {
  const b = document.createElement('button');
  b.textContent = k; b.setAttribute('aria-label', `${k} discos`);
  b.addEventListener('click', () => {
    n = k; try { localStorage.setItem('hanoi-n', n); } catch {}
    $('niveis').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    b.blur(); reset();
  });
  b.setAttribute('aria-pressed', k === n);
  $('niveis').append(b);
}

// ---------- desenho ----------
function drawDisc(size, x, y) {
  const w = 30 + (size - 1) * 80 / (n - 1);
  ctx.fillStyle = COLORS[size - 1];
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - DH, w, DH - 2, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - w / 2 + 6, y - DH + 4, w - 12, 4);
}

function draw(t) {
  if (t > moodUntil) setMood('idle');
  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);

  ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.roundRect(10, BASE, W - 20, 14, 6); ctx.fill();
  PEG_X.forEach((x, i) => {
    if (held === i) { ctx.fillStyle = 'rgba(255,204,51,.12)'; ctx.fillRect(i * 120, TOP, 120, BASE - TOP); }
    ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.roundRect(x - 5, BASE - 8 * DH - 20, 10, 8 * DH + 20, 4); ctx.fill();
    pegs[i].forEach((s, h) => {
      // disco segurado flutua acima do pino
      if (held === i && h === pegs[i].length - 1) drawDisc(s, x, TOP + 60 + Math.sin(t / 150) * 4);
      else drawDisc(s, x, BASE - h * DH);
    });
    ctx.font = '10px "Press Start 2P", monospace'; ctx.fillStyle = '#a99fd1'; ctx.textAlign = 'center';
    ctx.fillText(i + 1, x, BASE + 30);
  });

  const m = mood === 'idle' && held !== null ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 50, TOP - 10, 2, m, t, held !== null ? 1 : 0);
  if (bubble) drawBubble(ctx, 200, 38, bubble);
  else if (!moves) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center';
    ctx.fillText('LEVE A TORRE', 220, 42); ctx.fillText('PARA OUTRO PINO', 220, 60);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: a solução recursiva respeita as regras e termina em 2^k - 1 jogadas
for (let k = 3; k <= 7; k++) {
  const p = [Array.from({ length: k }, (_, i) => k - i), [], []];
  let c = 0, ok = true;
  const solve = (m, a, b, via) => {
    if (!m) return;
    solve(m - 1, a, via, b);
    ok &&= canMove(p, a, b); p[b].push(p[a].pop()); c++;
    solve(m - 1, via, b, a);
  };
  solve(k, 0, 2, 1);
  console.assert(ok && won(p) && c === 2 ** k - 1, `hanoi ${k}`);
}
console.assert(!canMove([[1], [2], []], 1, 0) && canMove([[1], [2], []], 0, 1) && !canMove([[], [1], []], 0, 1), 'regras');
