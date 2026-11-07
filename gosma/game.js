const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
// canvas em pé (mobile first): faixa do avatar + vida em cima, visão 3D embaixo
const W = 360, H = 400, TOP = 64, VH = H - TOP, FOV = 0.66; // FOV = metade do plano da câmera (~66°)
const MAP = [
  '1111111111111111',
  '1..............1',
  '1.22..2222..33.1',
  '1.2....2....3..1',
  '1.2.11.2.11.3.31',
  '1......2.......1',
  '1.333..2..222..1',
  '1...3.....2....1',
  '1...3..44.2.11.1',
  '1.1....4.......1',
  '1.1.44.4..333..1',
  '1.1..........3.1',
  '1.1111..22.3.3.1',
  '1......2.......1',
  '1..33..2...44..1',
  '1111111111111111',
];
const COLORS = { 1: [126, 87, 194], 2: [239, 108, 0], 3: [38, 166, 154], 4: [198, 40, 40] };
const R = 0.25; // raio de colisão

const cell = (x, y) => (MAP[Math.floor(y)] || '')[Math.floor(x)] ?? '1'; // fora do mapa = parede
const solid = (x, y) => cell(x, y) !== '.';

let p, slimes, level, score, over, last, cool, flash, hurt, bob, banner, mood, bubble, moodUntil, timer;
const keys = {}, zbuf = new Float32Array(W);
let best = 0;
try { best = Number(localStorage.getItem('gosma-best')) || 0; } catch {}

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() {
  $('score').textContent = score; $('level').textContent = level; $('best').textContent = best;
  $('left').textContent = slimes.filter(s => !s.dead).length;
}

function startLevel() {
  const free = [];
  MAP.forEach((r, y) => [...r].forEach((c, x) => { if (c === '.' && Math.hypot(x + .5 - p.x, y + .5 - p.y) > 5) free.push([x + .5, y + .5]); }));
  slimes = [];
  for (let i = 0; i < 3 + level * 2 && free.length; i++) {
    const [x, y] = free.splice(Math.random() * free.length | 0, 1)[0];
    slimes.push({ x, y, hp: 2, hurt: 0, dead: 0 });
  }
  banner = { text: `FASE ${level}`, until: performance.now() + 1500 };
  hud();
}

function reset() {
  level = 1; score = 0; over = false; cool = 0; flash = 0; hurt = 0; bob = 0;
  p = { x: 1.5, y: 1.5, a: 0, hp: 100 };
  clearTimeout(timer);
  setMood('idle');
  startLevel();
  $('overlay').hidden = true;
}

// anda com colisão eixo por eixo (desliza encostado na parede)
function tryMove(o, dx, dy) {
  if (!solid(o.x + dx + Math.sign(dx) * R, o.y)) o.x += dx;
  if (!solid(o.x, o.y + dy + Math.sign(dy) * R)) o.y += dy;
}

function sees(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 0.1);
  for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
  return true;
}

const angleTo = s => { let d = Math.atan2(s.y - p.y, s.x - p.x) - p.a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

function shoot() {
  cool = 0.35; flash = 0.08;
  let target = null, td = zbuf[W / 2]; // não atravessa parede
  for (const s of slimes) {
    if (s.dead) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < td && Math.abs(angleTo(s)) < Math.atan2(0.35, d)) { target = s; td = d; }
  }
  if (!target) return;
  target.hurt = 0.15;
  if (--target.hp <= 0) {
    target.dead = 0.001; score += 100;
    setMood('happy', 'TOMA!', 600);
    hud();
  }
}

function die() {
  over = true; setMood('sad', 'FUI...');
  if (score > best) { best = score; try { localStorage.setItem('gosma-best', best); } catch {} hud(); }
  timer = setTimeout(() => {
    $('overlay-title').textContent = `AS GOSMAS VENCERAM\n${score} PONTOS`;
    $('overlay').hidden = false; $('restart').focus();
  }, 1200);
}

function update(dt) {
  cool -= dt; flash -= dt; hurt -= dt;
  if (over) return;
  const turn = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const walk = (keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0);
  p.a += turn * 2.4 * dt;
  tryMove(p, Math.cos(p.a) * walk * 3 * dt, Math.sin(p.a) * walk * 3 * dt);
  bob += Math.abs(walk) * dt * 10;
  if (keys[' '] && cool <= 0) shoot(); // segurar = tiro automático (bom no toque)

  const speed = 1.1 + level * 0.15;
  for (const s of slimes) {
    s.hurt -= dt;
    if (s.dead) { s.dead += dt; continue; }
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d > 0.6 && d < 9 && sees(s, p)) tryMove(s, (p.x - s.x) / d * speed * dt, (p.y - s.y) / d * speed * dt);
    if (d < 0.7) {
      p.hp -= 25 * dt; hurt = 0.15;
      if (mood !== 'happy') setMood('meh', 'AI!', 300);
    }
  }
  slimes = slimes.filter(s => s.dead < 0.4); // animação de estouro e some
  if (p.hp <= 0) { p.hp = 0; return die(); }
  if (!slimes.length) { level++; score += 250; p.hp = Math.min(100, p.hp + 30); startLevel(); }
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') return reset();
  keys[k] = true;
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; }); // trocar de aba não deixa tecla presa
$('restart').addEventListener('click', reset);

// ---------- desenho ----------
function makeSlime(body, eye) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = body;
  g.beginPath(); g.moveTo(4, 64); g.quadraticCurveTo(0, 14, 32, 10); g.quadraticCurveTo(64, 14, 60, 64); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(20, 26, 6, 9, -0.4, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(32 + s * 11, 34, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = eye; g.beginPath(); g.arc(32 + s * 10, 35, 3.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32 + s * 19, 23); g.lineTo(32 + s * 5, 28); g.stroke(); // sobrancelha brava
  }
  g.fillStyle = '#1a1a1a'; g.fillRect(24, 48, 16, 4);
  return c;
}
const SLIME = makeSlime('#7cb342', '#c62828'), SLIME_HIT = makeSlime('#f1f8e9', '#c62828');

function drawWalls() {
  const dx = Math.cos(p.a), dy = Math.sin(p.a), px = -dy * FOV, py = dx * FOV;
  const horizon = TOP + VH / 2 + Math.sin(bob) * 3;
  for (let x = 0; x < W; x++) {
    const cam = 2 * x / W - 1, rx = dx + px * cam, ry = dy + py * cam;
    let mx = Math.floor(p.x), my = Math.floor(p.y);
    const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
    let sdx = (rx < 0 ? p.x - mx : mx + 1 - p.x) * ddx, sdy = (ry < 0 ? p.y - my : my + 1 - p.y) * ddy, side = 0;
    for (let i = 0; i < 64 && !solid(mx, my); i++) { // DDA: pula de borda em borda da grade
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
    }
    const dist = Math.max(0.05, side ? sdy - ddy : sdx - ddx);
    zbuf[x] = dist;
    const h = VH / dist, top = horizon - h / 2;
    const [r, g, b] = COLORS[cell(mx, my)] || COLORS[1];
    const k = (side ? 0.7 : 1) * Math.max(0.15, 1 - dist / 12); // lado escuro + névoa
    ctx.fillStyle = `rgb(${r * k | 0},${g * k | 0},${b * k | 0})`;
    ctx.fillRect(x, top, 1, h);
    // tijolos: 4 fileiras, juntas verticais desencontradas
    let u = side ? p.x + dist * rx : p.y + dist * ry; u -= Math.floor(u);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
    for (let row = 0; row < 4; row++) {
      ctx.fillRect(x, top + h * row / 4, 1, Math.max(1, h / 48));
      if ((u * 2 + (row % 2) * 0.5) % 1 < 0.04) ctx.fillRect(x, top + h * row / 4, 1, h / 4);
    }
  }
  return { dx, dy, px, py, horizon };
}

function drawSlimes({ dx, dy, px, py, horizon }, t) {
  const inv = 1 / (px * dy - dx * py);
  const list = slimes.map(s => ({ s, d: (s.x - p.x) ** 2 + (s.y - p.y) ** 2 })).sort((a, b) => b.d - a.d);
  for (const { s } of list) {
    const rx = s.x - p.x, ry = s.y - p.y;
    const tx = inv * (dy * rx - dx * ry), ty = inv * (-py * rx + px * ry); // ty = profundidade
    if (ty < 0.1) continue;
    const pop = s.dead ? 1 - s.dead / 0.4 : 1;
    const wob = 1 + Math.sin(t / 150 + s.x * 3) * 0.06;
    const size = VH / ty * 0.7 * pop, sw = size * wob, sh = size / wob;
    const cx = W / 2 * (1 + tx / ty), floor = horizon + VH / ty / 2;
    const img = s.hurt > 0 ? SLIME_HIT : SLIME;
    const x0 = Math.floor(cx - sw / 2), x1 = Math.ceil(cx + sw / 2);
    ctx.globalAlpha = Math.max(0.3, 1 - ty / 12);
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (zbuf[x] < ty) continue; // atrás da parede nesta coluna
      ctx.drawImage(img, (x - x0) / sw * 64, 0, 64 / sw, 64, x, floor - sh, 1, sh);
    }
    ctx.globalAlpha = 1;
  }
}

function drawGun(t) {
  const gx = W / 2 + Math.sin(bob) * 8, gy = H - 64 + Math.abs(Math.cos(bob)) * 6 + (cool > 0.25 ? 6 : 0); // coice
  const a = currentAvatar();
  if (flash > 0) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(gx, gy - 8, 16, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#455a64'; ctx.fillRect(gx - 12, gy, 24, 64);
  ctx.fillStyle = '#78909c'; ctx.fillRect(gx - 8, gy - 6, 16, 12);
  ctx.fillStyle = '#4fc3f7'; ctx.fillRect(gx - 4, gy + 14, 8, 20);
  ctx.fillStyle = a.skin; // mão com a pele do avatar
  ctx.beginPath(); ctx.roundRect(gx - 20, gy + 36, 40, 30, 10); ctx.fill();
  // mira
  ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 6, TOP + VH / 2, 4, 2); ctx.fillRect(W / 2 + 2, TOP + VH / 2, 4, 2);
  ctx.fillRect(W / 2, TOP + VH / 2 - 6, 2, 4); ctx.fillRect(W / 2, TOP + VH / 2 + 4, 2, 4);
}

function draw(t) {
  const dt = Math.min(0.1, (t - (last ?? t)) / 1000); last = t;
  update(dt);
  if (t > moodUntil) setMood('idle');

  ctx.save();
  ctx.beginPath(); ctx.rect(0, TOP, W, VH); ctx.clip();
  const sky = ctx.createLinearGradient(0, TOP, 0, TOP + VH / 2);
  sky.addColorStop(0, '#0b0b18'); sky.addColorStop(1, '#2a1f4f');
  ctx.fillStyle = sky; ctx.fillRect(0, TOP, W, VH / 2);
  const floor = ctx.createLinearGradient(0, TOP + VH / 2, 0, H);
  floor.addColorStop(0, '#1a1426'); floor.addColorStop(1, '#4a3b2a');
  ctx.fillStyle = floor; ctx.fillRect(0, TOP + VH / 2, W, VH / 2);
  const view = drawWalls();
  drawSlimes(view, t);
  if (!over) drawGun(t);
  if (hurt > 0 || over) { ctx.fillStyle = `rgba(200,0,0,${over ? 0.35 : 0.25})`; ctx.fillRect(0, TOP, W, VH); }
  if (banner && t < banner.until) {
    ctx.font = '20px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; ctx.fillText(banner.text, W / 2 + 3, TOP + 63);
    ctx.fillStyle = '#ffcc33'; ctx.fillText(banner.text, W / 2, TOP + 60);
  }
  ctx.restore();

  // faixa de cima: avatar + vida
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  const m = mood === 'idle' && p.hp < 35 ? 'worried' : mood;
  drawMood(ctx, currentAvatar(), 36, TOP - 6, 1.5, m, t);
  if (bubble) drawBubble(ctx, 110, 28, bubble);
  ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a99fd1'; ctx.fillText('VIDA', 196, 20);
  ctx.fillStyle = '#170f2e'; ctx.fillRect(196, 30, 150, 16);
  ctx.fillStyle = p.hp < 35 ? '#ef5350' : '#66bb6a'; ctx.fillRect(198, 32, 146 * p.hp / 100, 12);
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
reset();
requestAnimationFrame(draw);

// auto-checagem: colisão, visão e mira
console.assert(solid(0, 0) && !solid(1.5, 1.5) && solid(-1, 5) && solid(5, 99), 'mapa');
console.assert(sees({ x: 1.5, y: 1.5 }, { x: 5.5, y: 1.5 }) && !sees({ x: 2.5, y: 1.5 }, { x: 2.5, y: 3.5 }), 'visão');
console.assert(Math.abs(angleTo({ x: p.x + 1, y: p.y })) < 1e-9, 'mira reto');
