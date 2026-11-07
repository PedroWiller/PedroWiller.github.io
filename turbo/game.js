const T = 32, ROWS = 14, VIEW_W = 800, VIEW_H = ROWS * T;
const ACC = 0.22, AIR_ACC = 0.18, SKID = 0.6, FRICTION = 0.12, TOP = 7, MAX = 14;
const GRAV = 0.55, JUMP = -11, JUMP_CUT = -4, SPRING = -17, PAD_SPEED = 13, MAX_FALL = 16;
const PW = 22, PH = 30, STEP_MS = 1000 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

// ---------- fase ----------
// '#' chão, '=' plataforma, 'o' anel, 'e' robô, '^' espinho, 'S' mola, '>' acelerador, 'F' chegada
// cada trecho lista só as linhas de baixo; o topo é completado com vazio
const CHUNKS = {
  start: [
    '   o o o o o   >          ',
    '##########################',
    '##########################',
  ],
  gap: [
    '      o o o         ',
    '    o       o       ',
    '                    ',
    '#######      #######',
    '#######      #######',
  ],
  platforms: [
    '            o o o           ',
    '           =====            ',
    '                            ',
    '    o o o                   ',
    '   =====                    ',
    '                            ',
    '                    e       ',
    '############################',
    '############################',
  ],
  enemies: [
    '     o o o        o o o      ',
    '        e           e     >  ',
    '#############################',
    '#############################',
  ],
  spikes: [
    '           o o o o          ',
    '                            ',
    '                            ',
    '                            ',
    '                            ',
    '                            ',
    '                            ',
    '      S   ^^^^^^      e     ',
    '############################',
    '############################',
  ],
  stairs: [
    '                 o o o     ',
    '               =====       ',
    '          o o              ',
    '         =====             ',
    '    o o                    ',
    '   =====                   ',
    '                           ',
    '#####    ######    ########',
    '#####    ######    ########',
  ],
  finish: [
    '  o o o        F    ',
    '####################',
    '####################',
  ],
};
const ORDER = ['start', 'platforms', 'gap', 'enemies', 'spikes', 'stairs', 'gap', 'enemies', 'platforms', 'spikes', 'gap', 'finish'];

function buildLevel() {
  const rows = Array.from({ length: ROWS }, () => '');
  for (const name of ORDER) {
    const lines = CHUNKS[name];
    const w = Math.max(...lines.map(l => l.length));
    const full = [...Array(ROWS - lines.length).fill(''), ...lines];
    full.forEach((l, r) => { rows[r] += l.padEnd(w); });
  }
  return rows.map(r => r.split(''));
}

let grid, W, rings, enemies, loose, particles, player, cam, frame, state, ringCount, springAt;

function reset() {
  grid = buildLevel();
  W = grid[0].length;
  rings = []; enemies = []; loose = []; particles = [];
  springAt = {};
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) {
    const ch = grid[r][c];
    if (ch === 'o') { rings.push({ x: c * T + T / 2, y: r * T + T / 2 }); grid[r][c] = ' '; }
    if (ch === 'e') { enemies.push({ x: c * T + 3, y: (r + 1) * T - 24, w: 26, h: 24, vx: -1.2 }); grid[r][c] = ' '; }
  }
  player = { x: 2 * T, y: 11 * T, vx: 0, vy: 0, onGround: false, facing: 1, angle: 0, inv: 0, jumpBuf: 0 };
  cam = 0; frame = 0; ringCount = 0;
  state = 'playing';
  $('overlay').hidden = true;
}

const tile = (c, r) => (c < 0 || c >= W ? '#' : r < 0 || r >= ROWS ? ' ' : grid[r][c]);
const isSolid = ch => ch === '#' || ch === '=';

function tilesIn(x, y, w, h, fn) {
  for (let r = Math.floor(y / T); r <= Math.floor((y + h - 0.01) / T); r++)
    for (let c = Math.floor(x / T); c <= Math.floor((x + w - 0.01) / T); c++) fn(tile(c, r), c, r);
}
function hitsSolid(x, y, w, h) {
  let hit = false;
  tilesIn(x, y, w, h, ch => { if (isSolid(ch)) hit = true; });
  return hit;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---------- entrada ----------
const keys = {};
const JUMP_KEYS = [' ', 'arrowup', 'w'];
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (JUMP_KEYS.includes(k) && !e.repeat) player.jumpBuf = 6; // perdoa apertar um pouco antes de tocar o chão
  keys[k] = true;
  if (k === 'r') reset();
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
$('restart').addEventListener('click', reset);

// ---------- lógica ----------
function finish(newState, text) {
  state = newState;
  $('overlay-title').textContent = text;
  $('overlay').hidden = false;
  $('restart').focus();
}

function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30, color });
  }
}

function hurt() {
  const p = player;
  if (p.inv > 0) return;
  if (ringCount === 0) return finish('dead', '💥 Você foi atingido!');
  const cx = p.x + PW / 2, cy = p.y + PH / 2;
  for (let i = 0; i < Math.min(ringCount, 12); i++) {
    const a = -Math.PI * (0.15 + 0.7 * (i / 11));
    loose.push({ x: cx, y: cy, vx: Math.cos(a) * 4, vy: Math.sin(a) * 5, life: 200 });
  }
  ringCount = 0;
  p.inv = 120;
  p.vx = -p.facing * 4;
  p.vy = -6;
  p.onGround = false;
}

function step() {
  const p = player;
  frame++;

  // corrida com embalo
  const dir = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  if (dir) {
    if (p.onGround && p.vx * dir < 0) p.vx += dir * SKID;
    else if (p.vx * dir < TOP) p.vx += dir * (p.onGround ? ACC : AIR_ACC);
    p.facing = dir;
  } else if (p.onGround) {
    p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), FRICTION);
  }
  p.vx = Math.max(-MAX, Math.min(MAX, p.vx));

  if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.jumpBuf && p.onGround) { p.vy = JUMP; p.onGround = false; p.jumpBuf = 0; }
  if (!JUMP_KEYS.some(k => keys[k]) && p.vy < JUMP_CUT) p.vy = JUMP_CUT; // pulo curto ao soltar
  p.vy = Math.min(p.vy + GRAV, MAX_FALL);

  // movimento eixo a eixo
  p.x += p.vx;
  if (hitsSolid(p.x, p.y, PW, PH)) {
    p.x = p.vx > 0 ? Math.floor((p.x + PW) / T) * T - PW : Math.floor(p.x / T + 1) * T;
    p.vx = 0;
  }
  p.y += p.vy;
  p.onGround = false;
  if (hitsSolid(p.x, p.y, PW, PH)) {
    if (p.vy > 0) { p.y = Math.floor((p.y + PH) / T) * T - PH; p.onGround = true; }
    else p.y = Math.floor(p.y / T + 1) * T;
    p.vy = 0;
  }

  // objetos do cenário
  tilesIn(p.x, p.y, PW, PH, (ch, c, r) => {
    if (ch === '^' && p.y + PH > r * T + T / 2) hurt();
    if (ch === 'S' && p.vy >= 0) { p.vy = SPRING; p.onGround = false; springAt[c] = frame; }
    if (ch === '>') { p.vx = PAD_SPEED; p.facing = 1; }
    if (ch === 'F' && state === 'playing') finish('won', `🏁 Fase completa!\n${(frame / 60).toFixed(1)}s · ${ringCount} anéis`);
  });
  if (p.y > VIEW_H + 60) return finish('dead', '🕳️ Você caiu!');
  if (p.inv > 0) p.inv--;
  p.angle = p.onGround ? 0 : p.angle + 0.25 * p.facing + p.vx * 0.03;

  // anéis
  const pc = { x: p.x + PW / 2, y: p.y + PH / 2 };
  rings = rings.filter(g => {
    if (Math.hypot(g.x - pc.x, g.y - pc.y) > 22) return true;
    ringCount++; burst(g.x, g.y, '#ffd54f', 5);
    return false;
  });
  loose = loose.filter(g => {
    g.vy += 0.3;
    g.x += g.vx; if (hitsSolid(g.x - 6, g.y - 6, 12, 12)) { g.x -= g.vx; g.vx *= -0.7; }
    g.y += g.vy; if (hitsSolid(g.x - 6, g.y - 6, 12, 12)) { g.y -= g.vy; g.vy *= -0.75; }
    if (g.life < 170 && Math.hypot(g.x - pc.x, g.y - pc.y) < 22) { ringCount++; return false; }
    return --g.life > 0;
  });

  // robôs patrulham e viram na beirada ou na parede
  const box = { x: p.x, y: p.y, w: PW, h: PH };
  enemies = enemies.filter(e => {
    const nx = e.x + e.vx;
    const frontX = e.vx > 0 ? nx + e.w + 1 : nx - 1;
    if (hitsSolid(nx, e.y, e.w, e.h) || !isSolid(tile(Math.floor(frontX / T), Math.floor((e.y + e.h + 1) / T)))) e.vx *= -1;
    else e.x = nx;
    if (!overlap(box, e)) return true;
    if (!p.onGround) { // girando no ar destrói o robô
      burst(e.x + e.w / 2, e.y + e.h / 2, '#90a4ae', 14);
      if (p.vy > 0) p.vy = -7;
      return false;
    }
    hurt();
    return true;
  });

  particles = particles.filter(q => { q.x += q.vx; q.y += q.vy; q.vy += 0.15; return --q.life > 0; });

  // câmera olha pra frente na direção da corrida
  const target = p.x + PW / 2 - VIEW_W / 2 + p.vx * 12;
  cam += (Math.max(0, Math.min(W * T - VIEW_W, target)) - cam) * 0.12;

  $('rings').textContent = ringCount;
  $('time').textContent = Math.floor(frame / 60);
  $('speed').textContent = Math.round(Math.abs(p.vx) * 20);
}

// ---------- desenho ----------
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#3fa9f5'); sky.addColorStop(1, '#c5ecff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 230 - cam * 0.15) % 1840 + 1840) % 1840 - 120, y = 40 + (i * 53) % 110;
    for (const [ox, oy, r] of [[0, 0, 18], [20, -8, 22], [42, 0, 16]]) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  const hills = (factor, base, amp, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 16) {
      const wx = x + cam * factor;
      ctx.lineTo(x, base + Math.sin(wx * 0.004) * amp + Math.sin(wx * 0.011) * amp * 0.5);
    }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.fill();
  };
  hills(0.2, 250, 40, '#8fb3e0');
  hills(0.45, 320, 30, '#5fae5a');
}

function drawTile(ch, c, r, x, y) {
  if (ch === '#') {
    ctx.fillStyle = (c + r) % 2 ? '#b8693a' : '#a35a2f'; ctx.fillRect(x, y, T, T);
    if (!isSolid(tile(c, r - 1))) {
      ctx.fillStyle = '#3cb043'; ctx.fillRect(x, y, T, 10);
      ctx.fillStyle = '#2a8a31';
      for (let i = 0; i < T; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y + 10); ctx.lineTo(x + i + 4, y + 15); ctx.lineTo(x + i + 8, y + 10); ctx.fill(); }
    }
  } else if (ch === '=') {
    ctx.fillStyle = '#8d8fa3'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#b9bccd'; ctx.fillRect(x, y, T, 6);
    ctx.fillStyle = '#5c5e70'; ctx.fillRect(x, y + T - 4, T, 4); ctx.fillRect(x + T - 2, y, 2, T);
  } else if (ch === '^') {
    ctx.fillStyle = '#cfd8dc'; ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 11, y + T); ctx.lineTo(x + i * 11 + 5.5, y + T / 2); ctx.lineTo(x + i * 11 + 11, y + T); ctx.fill(); ctx.stroke();
    }
  } else if (ch === 'S') {
    const squash = frame - (springAt[c] ?? -99) < 8 ? 8 : 0;
    ctx.fillStyle = '#455a64'; ctx.fillRect(x + 4, y + T - 6, T - 8, 6);
    ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 10 : T - 10), y + T - 6 - i * (14 - squash) / 4);
    ctx.stroke();
    ctx.fillStyle = '#e53935'; ctx.fillRect(x + 2, y + T - 26 + squash, T - 4, 7);
  } else if (ch === '>') {
    ctx.fillStyle = '#37474f'; ctx.fillRect(x, y + T - 8, T, 8);
    ctx.fillStyle = Math.floor(frame / 6) % 2 ? '#ffeb3b' : '#ffa000';
    for (const ox of [4, 16]) { ctx.beginPath(); ctx.moveTo(x + ox, y + T - 7); ctx.lineTo(x + ox + 8, y + T - 4); ctx.lineTo(x + ox, y + T - 1); ctx.fill(); }
  } else if (ch === 'F') {
    ctx.fillStyle = '#eceff1'; ctx.fillRect(x + 14, y - 3 * T, 4, 4 * T);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(x + 18 + i * 8, y - 3 * T + j * 7 + Math.sin(frame / 8 + i) * 2, 8, 7);
    }
  }
}

function drawRing(x, y) {
  ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y, 1.5 + 6.5 * Math.abs(Math.cos(frame * 0.08 + x)), 8, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawEnemy(e) {
  const x = e.x - cam, y = e.y;
  ctx.fillStyle = '#546e7a';
  ctx.beginPath(); ctx.arc(x + e.w / 2, y + 16, 13, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#78909c'; ctx.fillRect(x, y + 14, e.w, 4);
  ctx.fillStyle = '#ff1744';
  ctx.beginPath(); ctx.arc(x + e.w / 2 + Math.sign(e.vx) * 5, y + 9, 3.5, 0, Math.PI * 2); ctx.fill();
  for (const ox of [6, e.w - 6]) {
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(x + ox, y + 20, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
    const a = e.x / 4;
    ctx.beginPath(); ctx.moveTo(x + ox, y + 20); ctx.lineTo(x + ox + Math.cos(a) * 4, y + 20 + Math.sin(a) * 4); ctx.stroke();
  }
}

function drawPlayer() {
  const p = player;
  if (p.inv > 0 && frame % 8 < 4) return;
  const cx = p.x + PW / 2 - cam;
  if (Math.abs(p.vx) > 9) { // linhas de velocidade
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ly = p.y + 6 + i * 9, len = 14 + Math.random() * 14;
      ctx.beginPath(); ctx.moveTo(cx - p.facing * 14, ly); ctx.lineTo(cx - p.facing * (14 + len), ly); ctx.stroke();
    }
  }
  if (p.onGround) {
    drawAvatar(ctx, currentAvatar(), cx, p.y + PH - 16, p.facing, 0);
  } else { // bola girando
    ctx.save();
    ctx.translate(cx, p.y + PH / 2);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(80,160,255,.35)';
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.scale(0.8, 0.8);
    drawAvatar(ctx, currentAvatar(), 0, 4, p.facing, 0, false);
    ctx.restore();
  }
}

function draw() {
  drawBackground();
  const c0 = Math.floor(cam / T), c1 = Math.ceil((cam + VIEW_W) / T);
  for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
    const ch = tile(c, r);
    if (ch !== ' ' && c >= 0 && c < W) drawTile(ch, c, r, c * T - cam, r * T);
  }
  for (const g of rings) if (g.x > cam - T && g.x < cam + VIEW_W + T) drawRing(g.x - cam, g.y);
  for (const g of loose) if (g.life > 60 || frame % 6 < 3) drawRing(g.x - cam, g.y);
  for (const e of enemies) if (e.x > cam - T && e.x < cam + VIEW_W) drawEnemy(e);
  for (const q of particles) { ctx.fillStyle = q.color; ctx.globalAlpha = q.life / 30; ctx.fillRect(q.x - cam - 2, q.y - 2, 4, 4); }
  ctx.globalAlpha = 1;
  drawPlayer();
}

// passo fixo de 60 Hz: mesma física em monitores de 60, 120 ou 144 Hz
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP_MS) { if (state === 'playing') step(); acc -= STEP_MS; }
  draw();
  requestAnimationFrame(loop);
}

buildAvatarPicker($('chars'), reset);
reset();
requestAnimationFrame(loop);
