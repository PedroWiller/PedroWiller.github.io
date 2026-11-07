const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const COLS = 10, ROWS = 5, DW = 34, DH = 24, SX = 52, SY = 38, PY = H - 46, MARGIN = 12;
const KINDS = [
  { pts: 40, col: '#ff5252' }, // comandante (linha de cima)
  { pts: 20, col: '#ffb300' }, // caça
  { pts: 10, col: '#4fc3f7' }, // sonda
];
const rowKind = r => r === 0 ? 0 : r < 3 ? 1 : 2;
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const STARS = Array.from({ length: 70 }, (_, i) => [hash(i) * W, hash(i + 99) * (H - 120), hash(i + 7)]);

let best = 0;
try { best = Number(localStorage.getItem('invasao-best')) || 0; } catch {}
$('best').textContent = best;

let playing = false, score, lives, wave, player, shots, bombs, drones, dir, bunkers, boss, bossTimer, parts, pops, cool, inv, last = 0;
const keys = {};

function makeWave() {
  drones = [];
  const drop = Math.min(wave - 1, 4) * 12; // ondas seguintes começam mais baixo
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    drones.push({ x: 60 + c * SX, y: 50 + r * SY + drop, w: DW, h: DH, kind: rowKind(r), col: c });
  dir = 1; shots = []; bombs = [];
}

// trincheiras de sacos de areia: blocos de 8px que somem a cada impacto
function makeBunkers() {
  bunkers = [];
  for (let b = 0; b < 4; b++) for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
    if (r === 3 && c >= 3 && c <= 5) continue; // vão embaixo
    if (r === 0 && (c === 0 || c === 8)) continue; // cantos arredondados
    bunkers.push({ x: 92 + b * 160 + c * 8, y: PY - 70 + r * 8, w: 8, h: 8 });
  }
}

function reset() {
  score = 0; lives = 3; wave = 1; parts = []; pops = [];
  player = { x: W / 2 - 22, y: PY, w: 44, h: 24 };
  cool = 0; inv = 0; boss = null; bossTimer = 900;
  makeWave(); makeBunkers(); hud();
}

function start() {
  reset();
  $('overlay').hidden = true; playing = true;
}

function hud() {
  $('score').textContent = score;
  $('lives').textContent = '❤'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives));
  $('wave').textContent = wave;
}

function boom(x, y, col, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, col });
  }
}

function gameOver(text) {
  playing = false;
  if (score > best) { best = score; try { localStorage.setItem('invasao-best', best); } catch {} $('best').textContent = best; }
  $('title').textContent = `${text}\n${score} pontos · onda ${wave}`;
  $('start').textContent = 'Jogar de novo';
  $('overlay').hidden = false;
  $('start').focus();
}

function hurt() {
  if (inv > 0) return;
  lives--; hud(); inv = 120;
  boom(player.x + 22, player.y + 10, '#ff7043', 30);
  if (lives <= 0) gameOver('Base destruída!');
}

function hitBunker(o) {
  const i = bunkers.findIndex(b => hit(o, b));
  if (i < 0) return false;
  bunkers.splice(i, 1);
  return true;
}

function update(k) {
  // jogador
  const mv = (keys.arrowleft || keys.a ? -1 : 0) + (keys.arrowright || keys.d ? 1 : 0);
  player.x = Math.max(8, Math.min(W - 8 - player.w, player.x + mv * 4.5 * k));
  cool -= k; inv -= k;
  if (keys[' '] && cool <= 0 && shots.length < 2) { shots.push({ x: player.x + 32, y: player.y - 12, w: 4, h: 12 }); cool = 18; }

  // formação: fica mais rápida conforme sobram menos drones
  const speed = (0.35 + wave * 0.12) * (1 + 3 * (1 - drones.length / (ROWS * COLS)));
  for (const d of drones) d.x += dir * speed * k;
  const minX = Math.min(...drones.map(d => d.x)), maxX = Math.max(...drones.map(d => d.x + d.w));
  if (minX < MARGIN || maxX > W - MARGIN) {
    const shift = minX < MARGIN ? MARGIN - minX : W - MARGIN - maxX; // volta pra dentro, senão inverte de novo no próximo quadro
    dir *= -1;
    for (const d of drones) { d.x += shift; d.y += 14; }
  }
  for (const d of drones) {
    bunkers = bunkers.filter(b => !hit(b, d)); // drone baixo atropela a trincheira
    if (d.y + d.h >= player.y) { lives = 0; hud(); return gameOver('Invadiram a base!'); }
  }

  // tiros do jogador
  for (const s of shots) s.y -= 9 * k;
  shots = shots.filter(s => {
    if (s.y + s.h < 0) return false;
    const d = drones.find(d => hit(s, d));
    if (d) {
      drones.splice(drones.indexOf(d), 1);
      score += KINDS[d.kind].pts; hud();
      boom(d.x + d.w / 2, d.y + d.h / 2, KINDS[d.kind].col);
      return false;
    }
    if (boss && hit(s, boss)) {
      const pts = [50, 100, 150, 300][Math.random() * 4 | 0];
      score += pts; hud();
      pops.push({ text: '+' + pts, x: boss.x + boss.w / 2, y: boss.y + 10, life: 60 });
      boom(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ce93d8', 30);
      boss = null;
      return false;
    }
    return !hitBunker(s);
  });

  // drones atiram: só o mais de baixo de cada coluna; às vezes mira na coluna do jogador
  if (drones.length && Math.random() < (0.012 + wave * 0.004) * k) {
    const low = {};
    for (const d of drones) if (!low[d.col] || d.y > low[d.col].y) low[d.col] = d;
    const list = Object.values(low);
    const near = list.reduce((a, b) => Math.abs(b.x - player.x) < Math.abs(a.x - player.x) ? b : a);
    const d = Math.random() < 0.3 ? near : list[Math.random() * list.length | 0];
    bombs.push({ x: d.x + d.w / 2 - 2, y: d.y + d.h, w: 4, h: 10 });
  }
  for (const b of bombs) b.y += (3 + wave * 0.25) * k;
  bombs = bombs.filter(b => {
    if (b.y > H || hitBunker(b)) return false;
    if (hit(b, player)) { hurt(); return false; }
    return true;
  });
  if (!playing) return;

  // nave-mãe de bônus cruzando o topo
  bossTimer -= k;
  if (!boss && bossTimer <= 0) {
    const left = Math.random() < 0.5;
    boss = { x: left ? -60 : W, y: 18, w: 56, h: 18, vx: left ? 2.2 : -2.2 };
    bossTimer = 900 + Math.random() * 600;
  }
  if (boss) { boss.x += boss.vx * k; if (boss.x < -80 || boss.x > W + 20) boss = null; }

  if (!drones.length) {
    wave++; hud();
    pops.push({ text: 'ONDA ' + wave, x: W / 2, y: H / 2, life: 90 });
    makeWave(); makeBunkers();
  }
}

// ---------- desenho ----------
function eye(x, y, r) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  const look = Math.max(-1, Math.min(1, (player.x + 22 - x) / 150)); // todos os olhos seguem o tanque
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + look * r * 0.45, y + r * 0.2, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

function drawDrone(d, f) {
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
  ctx.fillStyle = KINDS[d.kind].col;
  if (d.kind === 0) { // comandante: hexágono com antenas piscando
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 12); }
    ctx.fill();
    ctx.fillRect(cx - 9, d.y - 6, 2, 6); ctx.fillRect(cx + 7, d.y - 6, 2, 6);
    ctx.fillStyle = f ? '#fff59d' : '#ff8a80';
    ctx.fillRect(cx - 10, d.y - 9, 4, 4); ctx.fillRect(cx + 6, d.y - 9, 4, 4);
    eye(cx, cy, 7);
  } else if (d.kind === 1) { // caça: corpo em ponta com asas que batem
    ctx.beginPath(); ctx.moveTo(cx, d.y + d.h); ctx.lineTo(cx - 9, d.y + 2); ctx.lineTo(cx + 9, d.y + 2); ctx.fill();
    const wy = f ? 2 : 12;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + s * 6, cy + 2); ctx.lineTo(cx + s * 17, d.y + wy); ctx.lineTo(cx + s * 7, d.y + 4); ctx.fill();
    }
    eye(cx, d.y + 9, 5);
  } else { // sonda: bola com hélice girando e perninhas
    ctx.beginPath(); ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 1, d.y - 3, 2, 5);
    ctx.fillRect(cx - (f ? 13 : 4), d.y - 4, f ? 26 : 8, 2);
    ctx.fillRect(cx - 8, cy + 10, 2, 5); ctx.fillRect(cx + 6, cy + 10, 2, 5);
    eye(cx, cy + 2, 5);
  }
}

function drawPlayer() {
  if (inv > 0 && (inv / 6 | 0) % 2) return; // pisca enquanto está invencível
  const { x, y } = player;
  // personagem saindo da escotilha (desenhado antes, a cúpula cobre o corpo)
  ctx.save(); ctx.translate(x + 18, y + 3); ctx.scale(0.5, 0.5);
  drawAvatar(ctx, currentAvatar(), 0, -16, 0, -1, false);
  ctx.restore();
  ctx.fillStyle = '#556b2f'; ctx.beginPath(); ctx.arc(x + 18, y + 8, 11, Math.PI, 0); ctx.fill(); // cúpula
  ctx.fillStyle = '#3e4f22'; ctx.fillRect(x + 30, y - 12, 5, 20); // cano
  ctx.fillStyle = '#6b8e23'; ctx.beginPath(); ctx.roundRect(x, y + 7, 44, 10, 3); ctx.fill(); // casco
  ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.roundRect(x - 2, y + 16, 48, 9, 4); ctx.fill(); // esteira
  ctx.fillStyle = '#777'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + 5 + i * 8.5, y + 20.5, 2.5, 0, Math.PI * 2); ctx.fill(); }
}

function draw(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05030f'); sky.addColorStop(0.7, '#1a0b2e'); sky.addColorStop(1, '#4a1505');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const [sx, sy, b] of STARS) { ctx.fillStyle = `rgba(255,255,255,${0.3 + b * 0.6 * (0.6 + 0.4 * Math.sin(t / 500 + b * 9))})`; ctx.fillRect(sx, sy, 2, 2); }
  // cidade ao fundo
  ctx.fillStyle = '#12060a';
  for (let x = 0, i = 0; x < W; i++) { const w = 30 + hash(i + 300) * 40, h = 20 + hash(i + 400) * 50; ctx.fillRect(x, H - 22 - h, w, h); x += w + 2; }
  ctx.fillStyle = '#2b1a10'; ctx.fillRect(0, H - 22, W, 22);

  ctx.fillStyle = '#b08d57'; ctx.strokeStyle = '#7a5f36'; ctx.lineWidth = 1;
  for (const b of bunkers) { ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1); }

  const f = (t / 400 | 0) % 2;
  for (const d of drones) drawDrone(d, f);

  if (boss) {
    const cx = boss.x + boss.w / 2;
    ctx.fillStyle = '#9c27b0'; ctx.beginPath(); ctx.ellipse(cx, boss.y + 11, 28, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ce93d8'; ctx.beginPath(); ctx.arc(cx, boss.y + 8, 10, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = (t / 120 | 0) % 4 === i ? '#ffeb3b' : '#4a148c'; ctx.fillRect(cx - 21 + i * 12, boss.y + 10, 6, 3); }
  }

  if (player) drawPlayer();

  ctx.fillStyle = '#ffeb3b'; for (const s of shots) ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = '#ff5252';
  for (const b of bombs) { const z = (t / 60 | 0) % 2 ? 1 : -1; ctx.fillRect(b.x + z, b.y, 2, 5); ctx.fillRect(b.x - z + 2, b.y + 5, 2, 5); }

  parts = parts.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    ctx.globalAlpha = Math.min(1, p.life / 20); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3);
    return --p.life > 0;
  });
  ctx.globalAlpha = 1;

  ctx.font = '14px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  pops = pops.filter(p => {
    p.y -= 0.5; ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = '#ffeb3b'; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
    return --p.life > 0;
  });
}

function frame(t) {
  const k = Math.min(3, (t - last) / (1000 / 60)) || 1; last = t; // k = quadros de 60fps passados
  if (playing) update(k);
  draw(t);
  requestAnimationFrame(frame);
}

// ---------- entrada ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'arrowleft' || k === 'arrowright' || k === ' ') e.preventDefault();
  if (k === 'r' && playing) start();
  if (k === 'enter' && !playing) { e.preventDefault(); start(); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
$('start').addEventListener('click', e => { start(); e.currentTarget.blur(); });

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(frame);

// auto-checagem
console.assert(drones.length === ROWS * COLS, 'formação completa');
console.assert(hit({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) && !hit({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }), 'hit()');
console.assert(bunkers.length === 4 * (4 * 9 - 3 - 2), 'trincheiras');
