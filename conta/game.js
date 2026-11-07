const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 520, TOP = 100, TOTAL = 60; // segundos
const BW = 160, BH = 100, GAP = 12, BX = (W - 2 * BW - GAP) / 2, BY = 290;

let q, score, streak, endAt, over, mood, moodUntil, bubble, flash, shownSecs;
let best = 0;
try { best = Number(localStorage.getItem('conta-best')) || 0; } catch {}

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('score').textContent = score; $('streak').textContent = streak; $('best').textContent = best || '-'; }

// fica mais difícil a cada 5 acertos: +, depois -, ×, ÷ e números maiores
function makeQuestion(score) {
  const lvl = Math.min(score / 5 | 0, 6);
  const op = '+-×÷'[rnd(0, Math.min(lvl, 3))];
  const max = 10 + lvl * 8;
  let a, b, ans;
  if (op === '+') { a = rnd(1, max); b = rnd(1, max); ans = a + b; }
  if (op === '-') { a = rnd(2, max); b = rnd(1, a); ans = a - b; }
  if (op === '×') { a = rnd(2, 5 + lvl); b = rnd(2, 10); ans = a * b; }
  if (op === '÷') { b = rnd(2, 5 + lvl); ans = rnd(1, 10); a = b * ans; }
  const opts = new Set([ans]);
  while (opts.size < 4) { const d = ans + rnd(-6, 6); if (d >= 0) opts.add(d); }
  return { text: `${a} ${op} ${b}`, ans, opts: shuffle([...opts]) };
}

function reset() {
  score = 0; streak = 0; endAt = null; over = false; flash = null; shownSecs = -1;
  q = makeQuestion(0);
  setMood('idle');
  hud(); $('time').textContent = TOTAL;
  $('overlay').hidden = true;
}

function answer(i) {
  if (over || i < 0 || i > 3) return;
  const now = performance.now();
  endAt ??= now + TOTAL * 1000;
  const ok = q.opts[i] === q.ans;
  flash = { i, ok, at: now };
  if (ok) {
    score++; streak++;
    endAt = Math.min(endAt + 1000, now + TOTAL * 1000); // acerto devolve 1s
    setMood('happy', streak >= 5 ? `${streak} SEGUIDAS!` : 'ISSO!', 700);
  } else {
    streak = 0; endAt -= 3000; // erro custa 3s
    setMood('sad', `ERA ${q.ans}`, 900);
  }
  if (score > best) { best = score; try { localStorage.setItem('conta-best', best); } catch {} }
  q = makeQuestion(score);
  hud();
}

function finish() {
  over = true;
  setMood(score >= best && score ? 'happy' : 'meh', 'ACABOU!');
  setTimeout(() => {
    $('overlay-title').textContent = `TEMPO!\n${score} ACERTOS\nRECORDE ${best}`;
    $('overlay').hidden = false; $('restart').focus();
  }, 900);
}

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width - BX, y = (e.clientY - r.top) * H / r.height - BY;
  const col = Math.floor(x / (BW + GAP)), row = Math.floor(y / (BH + GAP));
  if (col < 0 || row < 0 || col > 1 || row > 1 || x - col * (BW + GAP) > BW || y - row * (BH + GAP) > BH) return;
  answer(row * 2 + col);
});
addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') reset();
  else if (e.key >= '1' && e.key <= '4') answer(+e.key - 1);
});
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function draw(t) {
  if (t > moodUntil) setMood('idle');
  const left = endAt ? Math.max(0, (endAt - t) / 1000) : TOTAL;
  if (endAt && !over && left <= 0) finish();
  const secs = Math.ceil(left);
  if (secs !== shownSecs) { shownSecs = secs; $('time').textContent = secs; }

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);

  // barra de tempo
  ctx.fillStyle = '#3d2e73'; ctx.fillRect(20, TOP + 16, W - 40, 10);
  ctx.fillStyle = left < 10 ? '#e53935' : '#ffcc33'; ctx.fillRect(20, TOP + 16, (W - 40) * left / TOTAL, 10);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '32px "Press Start 2P", monospace'; ctx.fillStyle = '#f4f0ff';
  ctx.fillText(over ? '--' : `${q.text} = ?`, W / 2, 205);

  q.opts.forEach((v, i) => {
    const x = BX + (i % 2) * (BW + GAP), y = BY + (i / 2 | 0) * (BH + GAP);
    const lit = flash && flash.i === i && t - flash.at < 250;
    ctx.fillStyle = lit ? (flash.ok ? '#2e7d32' : '#c62828') : '#3d2e73';
    ctx.beginPath(); ctx.roundRect(x, y, BW, BH, 10); ctx.fill();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#a99fd1'; ctx.fillText(i + 1, x + 14, y + 14);
    ctx.font = '26px "Press Start 2P", monospace'; ctx.fillStyle = '#f4f0ff'; ctx.fillText(over ? '' : v, x + BW / 2, y + BH / 2 + 2);
  });

  const m = mood === 'idle' && endAt && left < 10 && !over ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 50, TOP - 10, 2, m, t);
  if (bubble) drawBubble(ctx, 170, 38, bubble);
  else if (!endAt) {
    ctx.font = '9px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
    ctx.fillText('RESPONDA PARA', 210, 42); ctx.fillText('COMEÇAR O RELÓGIO', 210, 60);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: 4 opções distintas, não negativas, com a resposta certa
for (let s = 0; s < 60; s++) {
  const t = makeQuestion(s), [a, op, b] = t.text.split(' ').map((v, i) => i === 1 ? v : +v);
  const real = { '+': a + b, '-': a - b, '×': a * b, '÷': a / b }[op];
  console.assert(real === t.ans && Number.isInteger(real) && real >= 0 && new Set(t.opts).size === 4 &&
    t.opts.includes(t.ans) && t.opts.every(o => o >= 0), 'pergunta', t);
}
