const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 462, TOP = 100, CS = 38, X0 = (W - 9 * CS) / 2, Y0 = TOP + 10;
const LEVELS = { 'FÁCIL': 40, 'MÉDIO': 32, 'DIFÍCIL': 26 }; // casas já preenchidas

let level = 'FÁCIL', grid, given, solution, sel, errors, startAt, over, mood, moodUntil, bubble, timer, shownSecs, wrongAt;
try { if (LEVELS[localStorage.getItem('sudoku-nivel')]) level = localStorage.getItem('sudoku-nivel'); } catch {}

// ---------- gerador ----------
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function fits(g, i, v) {
  const r = i / 9 | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
  for (let k = 0; k < 9; k++)
    if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + (k / 3 | 0)) * 9 + bc + k % 3] === v) return false;
  return true;
}
// conta soluções até `limit` (preenche g com a primeira se random)
function solve(g, limit, random = false) {
  const i = g.indexOf(0);
  if (i < 0) return 1;
  let n = 0;
  for (const v of random ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]) : [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    if (!fits(g, i, v)) continue;
    g[i] = v;
    n += solve(g, limit - n, random);
    if (n >= limit) { if (random) return n; break; }
    g[i] = 0;
  }
  g[i] = 0;
  return n;
}
function generate(clues) {
  const full = Array(81).fill(0);
  solve(full, 1, true);
  const puzzle = [...full];
  let left = 81;
  // tira casas em ordem aleatória, mas só se a solução continuar única
  for (const i of shuffle([...Array(81).keys()])) {
    if (left <= clues) break;
    const v = puzzle[i];
    puzzle[i] = 0;
    if (solve([...puzzle], 2) !== 1) puzzle[i] = v; else left--;
  }
  return { puzzle, full };
}

// ---------- jogo ----------
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
const bestKey = () => `sudoku-best-${level}`;
function getBest() { try { return Number(localStorage.getItem(bestKey())) || 0; } catch { return 0; } }
function hud() {
  $('errors').textContent = errors; $('best').textContent = getBest() ? getBest() + 's' : '-';
  // número que já está completo nas 9 casas some do teclado
  $('teclas').querySelectorAll('button[data-v]').forEach(b => b.disabled = grid.filter((v, i) => v === +b.dataset.v && v === solution[i]).length === 9);
}

function reset() {
  const { puzzle, full } = generate(LEVELS[level]);
  grid = puzzle; given = puzzle.map(v => v > 0); solution = full;
  sel = grid.indexOf(0); errors = 0; startAt = null; over = false; shownSecs = -1; wrongAt = -1;
  clearTimeout(timer);
  setMood('idle');
  hud(); $('time').textContent = 0;
  $('overlay').hidden = true;
}

function put(v) {
  if (over || sel < 0 || given[sel]) return;
  startAt ??= performance.now();
  if (v === 0) { grid[sel] = 0; return hud(); }
  grid[sel] = v;
  if (v !== solution[sel]) {
    errors++; wrongAt = performance.now();
    setMood(errors > 5 ? 'sad' : 'worried', errors > 5 ? 'AI AI AI' : 'ERRADO!', 900);
  } else if (grid.every((x, i) => x === solution[i])) return win();
  else setMood('idle');
  hud();
}

function win() {
  over = true; hud();
  const secs = Math.round((performance.now() - startAt) / 1000), best = getBest();
  setMood('happy', 'RESOLVI!');
  if (!best || secs < best) { try { localStorage.setItem(bestKey(), secs); } catch {} hud(); }
  timer = setTimeout(() => {
    $('overlay-title').textContent = `RESOLVIDO!\n${level}\n${secs}s · ${errors} ERROS`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1200);
}

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const c = Math.floor(((e.clientX - r.left) * W / r.width - X0) / CS), w = Math.floor(((e.clientY - r.top) * H / r.height - Y0) / CS);
  if (c >= 0 && c < 9 && w >= 0 && w < 9) sel = w * 9 + c;
});
addEventListener('keydown', e => {
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
  if (e.key in moves) { e.preventDefault(); sel = (Math.max(sel, 0) + moves[e.key] + 81) % 81; }
  else if (/^[1-9]$/.test(e.key)) put(+e.key);
  else if (['Backspace', 'Delete', '0'].includes(e.key)) put(0);
  else if (e.key === 'r' || e.key === 'R') reset();
});
$('restart').addEventListener('click', reset);

for (let v = 1; v <= 10; v++) {
  const b = document.createElement('button');
  if (v < 10) { b.textContent = v; b.dataset.v = v; } else { b.textContent = '⌫'; b.setAttribute('aria-label', 'Apagar'); }
  b.addEventListener('click', () => { put(v % 10); b.blur(); });
  $('teclas').append(b);
}
for (const k in LEVELS) {
  const b = document.createElement('button');
  b.textContent = k; b.setAttribute('aria-pressed', k === level);
  b.addEventListener('click', () => {
    level = k; try { localStorage.setItem('sudoku-nivel', k); } catch {}
    $('niveis').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    b.blur(); reset();
  });
  $('niveis').append(b);
}

// ---------- desenho ----------
function draw(t) {
  if (t > moodUntil) setMood('idle');
  const secs = startAt && !over ? Math.floor((performance.now() - startAt) / 1000) : shownSecs;
  if (secs !== shownSecs) { shownSecs = secs; $('time').textContent = secs; }

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);

  const sr = sel / 9 | 0, sc = sel % 9, sv = grid[sel];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '16px "Press Start 2P", monospace';
  for (let i = 0; i < 81; i++) {
    const r = i / 9 | 0, c = i % 9, x = X0 + c * CS, y = Y0 + r * CS;
    const same = sel >= 0 && (r === sr || c === sc || ((r / 3 | 0) === (sr / 3 | 0) && (c / 3 | 0) === (sc / 3 | 0)));
    ctx.fillStyle = i === sel ? '#5a47a3' : sv && grid[i] === sv ? '#4a3d8a' : same ? '#2e2358' : '#f4f0ff10';
    ctx.fillRect(x, y, CS, CS);
    if (!grid[i]) continue;
    const wrong = grid[i] !== solution[i];
    ctx.fillStyle = wrong ? '#ef5350' : given[i] ? '#f4f0ff' : '#ffcc33';
    const shake = wrong && i === sel && t - wrongAt < 300 ? Math.sin(t / 20) * 3 : 0;
    ctx.fillText(grid[i], x + CS / 2 + 1 + shake, y + CS / 2 + 2);
  }
  for (let k = 0; k <= 9; k++) {
    ctx.fillStyle = k % 3 ? '#3d2e73' : '#a99fd1';
    const w = k % 3 ? 1 : 3;
    ctx.fillRect(X0 + k * CS - w / 2, Y0, w, 9 * CS);
    ctx.fillRect(X0, Y0 + k * CS - w / 2, 9 * CS, w);
  }

  drawMood(ctx, currentAvatar(), 50, TOP - 10, 2, mood, t);
  if (bubble) drawBubble(ctx, 200, 38, bubble);
  else if (!startAt) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText('1 A 9 EM CADA LINHA,', 220, 36); ctx.fillText('COLUNA E QUADRADO', 220, 56);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: solução completa válida, pistas batem com ela e a resposta é única
{
  const { puzzle, full } = generate(26);
  console.assert(full.every((v, i) => { full[i] = 0; const ok = fits(full, i, v); full[i] = v; return ok; }), 'solução válida');
  console.assert(puzzle.every((v, i) => !v || v === full[i]) && solve([...puzzle], 2) === 1, 'pistas e unicidade');
}
