const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 720, H = 400, CELL = 120, BX = (W - CELL * 3) / 2, BY = 20;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const MISTAKE = 0.25; // chance da CPU jogar aleatório, senão ela seria imbatível

let board, placedAt, turn, over, winLine, starter = 'X', moods, timer;
const score = { p: 0, d: 0, c: 0 };

const winner = b => LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]);
// alguém tem duas na linha com a terceira livre?
const threat = (b, who) => LINES.some(l => l.filter(i => b[i] === who).length === 2 && l.some(i => !b[i]));
const empty = b => b.map((v, i) => v ? -1 : i).filter(i => i >= 0);

// minimax do ponto de vista da CPU ('O'); depth faz preferir vitórias rápidas
function minimax(b, cpuTurn, depth) {
  const w = winner(b);
  if (w) return b[w[0]] === 'O' ? 10 - depth : depth - 10;
  const free = empty(b);
  if (!free.length) return 0;
  const scores = free.map(i => { b[i] = cpuTurn ? 'O' : 'X'; const s = minimax(b, !cpuTurn, depth + 1); b[i] = ''; return s; });
  return cpuTurn ? Math.max(...scores) : Math.min(...scores);
}

function cpuMove() {
  const free = empty(board);
  let pick = free[Math.random() * free.length | 0];
  if (Math.random() > MISTAKE) {
    let best = -Infinity;
    for (const i of free) { board[i] = 'O'; const s = minimax(board, false, 1); board[i] = ''; if (s > best) { best = s; pick = i; } }
  }
  play(pick, 'O');
}

function reset() {
  board = Array(9).fill('');
  placedAt = Array(9).fill(0);
  over = false; winLine = null;
  clearTimeout(timer); // evita jogada da CPU ou placar da partida anterior caindo na nova
  turn = starter;
  starter = starter === 'X' ? 'O' : 'X'; // alterna quem começa
  $('overlay').hidden = true;
  setTurnMoods();
  if (turn === 'O') timer = setTimeout(cpuMove, 800);
}

function setTurnMoods() {
  const me = turn === 'X' ? 'p' : 'c', other = me === 'p' ? 'c' : 'p', foe = turn === 'X' ? 'O' : 'X';
  if (threat(board, turn)) moods = { [me]: 'smug', [other]: 'worried' };      // quem joga pode vencer agora
  else if (threat(board, foe)) moods = { [me]: 'worried', [other]: 'smug' };  // quem joga precisa bloquear
  else moods = { [me]: 'think', [other]: 'idle' };
}

function play(i, who) {
  if (over || board[i] || turn !== who) return;
  board[i] = who; placedAt[i] = performance.now();
  winLine = winner(board);
  if (winLine || !empty(board).length) {
    over = true;
    const k = !winLine ? 'd' : who === 'X' ? 'p' : 'c';
    score[k]++;
    $('score-' + k).textContent = score[k];
    const lose = Math.random() < 0.5 ? 'sad' : 'angry';
    moods = k === 'd' ? { p: 'meh', c: 'meh' } : k === 'p' ? { p: 'happy', c: lose } : { p: lose, c: 'happy' };
    timer = setTimeout(() => {
      $('overlay-title').textContent = { p: 'VOCÊ VENCEU!', c: 'A CPU VENCEU!', d: 'DEU VELHA!' }[k];
      $('overlay').hidden = false;
      $('restart').focus();
    }, 1200);
    return;
  }
  turn = who === 'X' ? 'O' : 'X';
  setTurnMoods();
  if (turn === 'O') timer = setTimeout(cpuMove, 700);
}

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width - BX, y = (e.clientY - r.top) * H / r.height - BY;
  if (x < 0 || y < 0 || x >= CELL * 3 || y >= CELL * 3) return;
  play((y / CELL | 0) * 3 + (x / CELL | 0), 'X');
});
addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') play(+e.key - 1, 'X');
  if (e.key === 'r' || e.key === 'R') reset();
});
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function drawPiece(i, t) {
  const cx = BX + (i % 3 + 0.5) * CELL, cy = BY + ((i / 3 | 0) + 0.5) * CELL;
  // t do rAF pode ser anterior ao placedAt; raio negativo quebrava o arc() e travava o jogo
  const k = Math.min(1, Math.max(0, (t - placedAt[i]) / 200)), r = 36 * k; // animação de "pop"
  ctx.lineWidth = 12; ctx.lineCap = 'round';
  if (board[i] === 'X') {
    ctx.strokeStyle = '#ff7043';
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  } else {
    ctx.strokeStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawPlayer(a, x, mood, label, t, i) {
  const ground = 320;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x, ground, 34, 8, 0, 0, Math.PI * 2); ctx.fill();

  let y = Math.sin(t / 400 + i) * 2, dx = x < W / 2 ? 1 : -1, dy = 0, mouth = a.mouth, sx = x; // olha pro tabuleiro
  if (mood === 'think') dy = -1;
  if (mood === 'happy') { y = -Math.abs(Math.sin(t / 150)) * 24; mouth = 'smile'; }
  if (mood === 'sad') { sx += Math.sin(t / 90) * 3; y = 4; dx = 0; dy = 1; mouth = 'sad'; }
  if (mood === 'meh') mouth = 'flat';
  if (mood === 'worried') { sx += Math.sin(t / 40) * 1.5; mouth = 'open'; }
  if (mood === 'smug') { y = Math.sin(t / 200) * 3; mouth = 'smile'; dy = -0.5; }
  if (mood === 'angry') { sx += Math.sin(t / 30) * 4; mouth = 'sad'; dx = 0; }

  ctx.save(); ctx.translate(sx, ground + y); ctx.scale(2.6, 2.6);
  drawAvatar(ctx, { ...a, mouth }, 0, -16, dx, dy, false);
  const brows = { angry: [-27, -24], worried: [-24, -27], smug: [-26, -25] }[mood]; // [ponta de fora, ponta de dentro]
  if (brows) {
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const s of [-1, 1]) { ctx.moveTo(s * 9, brows[0]); ctx.lineTo(s * 3, brows[1]); }
    ctx.stroke();
  }
  if (mood === 'angry') { ctx.fillStyle = 'rgba(255,40,0,.35)'; ctx.beginPath(); ctx.arc(0, -21, 12, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();

  if (mood === 'sad') for (const s of [-1, 1]) {
    ctx.fillStyle = '#64b5f6';
    ctx.fillRect(sx + s * 13 - 2, ground + y - 52 + (t / 12 + (s > 0 ? 15 : 0)) % 40, 4, 6);
  }
  const bubble = { happy: 'GANHEI!', sad: 'NÃÃO', meh: 'VELHA', angry: 'GRRR!', worried: 'EITA!', smug: 'HEHE', think: (t / 400 | 0) % 2 ? '...' : '?' }[mood];
  if (bubble) drawBubble(ctx, sx, ground + y - 104, bubble);

  ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = mood === 'think' ? '#ffcc33' : '#a99fd1';
  ctx.fillText(label, x, ground + 30);
}

function draw(t) {
  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#3d2e73'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const k of [1, 2]) {
    ctx.moveTo(BX + k * CELL, BY + 8); ctx.lineTo(BX + k * CELL, BY + CELL * 3 - 8);
    ctx.moveTo(BX + 8, BY + k * CELL); ctx.lineTo(BX + CELL * 3 - 8, BY + k * CELL);
  }
  ctx.stroke();
  board.forEach((v, i) => v && drawPiece(i, t));

  if (winLine) {
    const c = i => [BX + (i % 3 + 0.5) * CELL, BY + ((i / 3 | 0) + 0.5) * CELL];
    const [x1, y1] = c(winLine[0]), [x2, y2] = c(winLine[2]);
    ctx.strokeStyle = `rgba(255,204,51,${0.7 + Math.sin(t / 100) * 0.3})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  const me = AVATARS.indexOf(currentAvatar());
  drawPlayer(AVATARS[me], 90, moods.p, 'VOCÊ (X)', t, 0);
  drawPlayer(AVATARS[(me + 1) % AVATARS.length], W - 90, moods.c, 'CPU (O)', t, 1);
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem do juiz e da CPU
console.assert(winner(['X', 'X', 'X', '', '', '', '', '', '']), 'linha deveria vencer');
console.assert(!winner(['X', 'O', 'X', '', '', '', '', '', '']), 'não deveria vencer');
console.assert(threat(['X', 'X', '', '', '', '', '', '', ''], 'X') && !threat(['X', 'X', 'O', '', '', '', '', '', ''], 'X'), 'ameaça');
console.assert(minimax(['O', 'O', '', 'X', 'X', '', '', '', ''], true, 0) > 0, 'CPU deveria achar a vitória');
