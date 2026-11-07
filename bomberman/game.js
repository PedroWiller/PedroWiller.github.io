const COLS = 15, ROWS = 13, T = 40;
const EMPTY = 0, WALL = 1, BRICK = 2;
const BOMB_TIME = 2000, FIRE_TIME = 500, ENEMY_STEP = 450, MOVE_STEP = 140;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DROP_CHANCE = 0.3, MIN_STEP = 70;
const POWERUPS = {
  range: { icon: '🔥', color: '#ff7043', apply: p => p.range++ },
  bomb:  { icon: '💣', color: '#7e57c2', apply: p => p.maxBombs++ },
  speed: { icon: '⚡', color: '#29b6f6', apply: p => { p.step = Math.max(MIN_STEP, p.step - 20); } },
};
const POWERUP_TYPES = Object.keys(POWERUPS);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

let grid, player, bombs, fires, enemies, powerups, state, lastMove, lastEnemyStep, startedAt;

function reset() {
  grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid.push([]);
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      const safe = x + y <= 3; // canto inicial do jogador livre
      grid[y].push(border || pillar ? WALL : !safe && Math.random() < 0.45 ? BRICK : EMPTY);
    }
  }
  player = { x: 1, y: 1, dx: 0, dy: 1, range: 2, maxBombs: 1, step: MOVE_STEP };
  powerups = [];
  bombs = [];
  fires = [];
  enemies = [];
  for (const [x, y] of [[COLS - 2, ROWS - 2], [COLS - 2, 1], [1, ROWS - 2], [7, 5]]) {
    grid[y][x] = EMPTY;
    enemies.push({ x, y, phase: Math.random() * 6 });
  }
  state = 'playing';
  lastMove = lastEnemyStep = 0;
  startedAt = performance.now();
  $('overlay').hidden = true;
}

function finish(newState, text) {
  state = newState;
  $('overlay-title').textContent = text;
  $('overlay').hidden = false;
  $('restart').focus();
}

const blocked = (x, y) => grid[y][x] !== EMPTY || bombs.some(b => b.x === x && b.y === y);
const onFire = (x, y) => fires.some(f => f.x === x && f.y === y);

function explode(bomb, now) {
  bombs.splice(bombs.indexOf(bomb), 1);
  fires.push({ x: bomb.x, y: bomb.y, until: now + FIRE_TIME });
  for (const [dx, dy] of DIRS) {
    for (let i = 1; i <= bomb.range; i++) {
      const x = bomb.x + dx * i, y = bomb.y + dy * i;
      if (grid[y][x] === WALL) break;
      fires.push({ x, y, until: now + FIRE_TIME });
      if (grid[y][x] === BRICK) {
        grid[y][x] = EMPTY;
        if (Math.random() < DROP_CHANCE) {
          powerups.push({ x, y, type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)] });
        }
        break;
      }
      const chained = bombs.find(b => b.x === x && b.y === y);
      if (chained) explode(chained, now);
    }
  }
}

const keys = {};
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'r' || e.key === 'R') reset();
  if (e.key === ' ' && state === 'playing' && bombs.length < player.maxBombs &&
      !bombs.some(b => b.x === player.x && b.y === player.y)) {
    bombs.push({ x: player.x, y: player.y, at: performance.now() + BOMB_TIME, range: player.range });
  }
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
$('restart').addEventListener('click', reset);

function update(now) {
  if (state !== 'playing') return;

  if (now - lastMove > player.step) {
    let dx = 0, dy = 0;
    if (keys.arrowleft || keys.a) dx = -1;
    else if (keys.arrowright || keys.d) dx = 1;
    else if (keys.arrowup || keys.w) dy = -1;
    else if (keys.arrowdown || keys.s) dy = 1;
    if (dx || dy) {
      player.dx = dx; player.dy = dy;
      if (!blocked(player.x + dx, player.y + dy)) { player.x += dx; player.y += dy; lastMove = now; }
    }
  }

  const got = powerups.find(p => p.x === player.x && p.y === player.y);
  if (got) {
    POWERUPS[got.type].apply(player);
    powerups.splice(powerups.indexOf(got), 1);
  }

  for (const b of [...bombs]) if (now >= b.at && bombs.includes(b)) explode(b, now);
  fires = fires.filter(f => f.until > now);

  if (now - lastEnemyStep > ENEMY_STEP) {
    lastEnemyStep = now;
    for (const e of enemies) {
      const opts = DIRS.filter(([dx, dy]) => !blocked(e.x + dx, e.y + dy));
      if (opts.length) { const [dx, dy] = opts[Math.floor(Math.random() * opts.length)]; e.x += dx; e.y += dy; }
    }
  }
  enemies = enemies.filter(e => !onFire(e.x, e.y));

  $('range').textContent = player.range;
  $('bombs').textContent = player.maxBombs;
  $('speed').textContent = 1 + (MOVE_STEP - player.step) / 20;
  $('enemies').textContent = enemies.length;
  $('time').textContent = Math.floor((now - startedAt) / 1000);

  if (onFire(player.x, player.y) || enemies.some(e => e.x === player.x && e.y === player.y)) {
    finish('dead', '💥 Você morreu!');
  } else if (!enemies.length) {
    finish('won', `🏆 Vitória!\n${$('time').textContent}s`);
  }
}

// ---------- desenho ----------
function circle(cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloor(px, py, x, y) {
  ctx.fillStyle = (x + y) % 2 ? '#3f8f3a' : '#47a042';
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; // sombra das paredes acima
  if (grid[y - 1][x] !== EMPTY) ctx.fillRect(px, py, T, 8);
}

function drawWall(px, py) {
  ctx.fillStyle = '#6b6f80'; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = '#9599ab'; ctx.fillRect(px, py, T, 5); ctx.fillRect(px, py, 5, T);
  ctx.fillStyle = '#44475a'; ctx.fillRect(px, py + T - 5, T, 5); ctx.fillRect(px + T - 5, py, 5, T);
  ctx.fillStyle = '#7d8193'; ctx.fillRect(px + 12, py + 12, T - 24, T - 24);
}

function drawBrick(px, py) {
  ctx.fillStyle = '#7a3b1e'; ctx.fillRect(px, py, T, T);
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, T, T); ctx.clip();
  ctx.fillStyle = '#c8653a';
  const h = T / 4;
  for (let r = 0; r < 4; r++) {
    for (let c = r % 2 ? -T / 4 : 0; c < T; c += T / 2) ctx.fillRect(px + c + 1, py + r * h + 1, T / 2 - 2, h - 2);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(px, py, T, 3);
}

function drawBomb(b, now) {
  const cx = b.x * T + T / 2, cy = b.y * T + T / 2 + 3;
  const left = (b.at - now) / BOMB_TIME;
  const r = 13 + Math.sin(now / (40 + left * 80)) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 12, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  circle(cx, cy, r, left < 0.3 && Math.floor(now / 80) % 2 ? '#c62828' : '#1c1c28');
  circle(cx - 4, cy - 5, 4, 'rgba(255,255,255,.35)');
  ctx.strokeStyle = '#d7b98e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + 5, cy - r + 2); ctx.quadraticCurveTo(cx + 10, cy - r - 6, cx + 6, cy - r - 9); ctx.stroke();
  circle(cx + 6, cy - r - 10, 3 + Math.random() * 2, Math.random() < 0.5 ? '#ffeb3b' : '#ff7043');
}

function drawFire(f, now) {
  const px = f.x * T, py = f.y * T;
  const k = (f.until - now) / FIRE_TIME; // 1 → 0
  const pad = 4 + (1 - k) * 8;
  ctx.fillStyle = '#ff5722'; ctx.fillRect(px + pad / 2, py + pad / 2, T - pad, T - pad);
  ctx.fillStyle = '#ffb300'; ctx.fillRect(px + pad, py + pad, T - pad * 2, T - pad * 2);
  ctx.fillStyle = '#fff59d'; ctx.fillRect(px + pad + 5, py + pad + 5, Math.max(T - pad * 2 - 10, 0), Math.max(T - pad * 2 - 10, 0));
}

function drawPowerup(p, now) {
  const { icon, color } = POWERUPS[p.type];
  const px = p.x * T, py = p.y * T + Math.sin(now / 180 + p.x) * 2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(px + 5, py + 5, T - 10, T - 10, 7); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(now / 120) * 0.4})`; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '18px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, px + T / 2, py + T / 2 + 1);
}

function drawEyes(cx, cy, dx, dy, white, pupil) {
  for (const s of [-1, 1]) {
    circle(cx + s * 6, cy, 5, white);
    circle(cx + s * 6 + dx * 2, cy + dy * 2, 2.5, pupil);
  }
}

function drawPlayer(now) {
  const cx = player.x * T + T / 2, cy = player.y * T + T / 2;
  const bob = Math.sin(now / 150) * 1.5;
  drawAvatar(ctx, currentAvatar(), cx, cy + bob, player.dx, player.dy);
}

function drawEnemy(e, now) {
  const cx = e.x * T + T / 2, cy = e.y * T + T / 2 + Math.sin(now / 200 + e.phase) * 3;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(cx, e.y * T + T - 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  circle(cx, cy - 2, 14, '#e53935');
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.moveTo(cx - 6, cy + 10); ctx.lineTo(cx, cy + 17); ctx.lineTo(cx + 6, cy + 10); ctx.fill();
  circle(cx - 5, cy - 9, 4, 'rgba(255,255,255,.35)');
  drawEyes(cx, cy - 2, Math.sign(player.x - e.x), Math.sign(player.y - e.y), '#fff', '#111');
}

function draw(now) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const px = x * T, py = y * T;
    if (grid[y][x] === WALL) drawWall(px, py);
    else if (grid[y][x] === BRICK) drawBrick(px, py);
    else drawFloor(px, py, x, y);
  }
  for (const p of powerups) drawPowerup(p, now);
  for (const f of fires) drawFire(f, now);
  for (const b of bombs) drawBomb(b, now);
  for (const e of enemies) drawEnemy(e, now);
  if (state !== 'dead') drawPlayer(now);
}

function loop(now) {
  update(now);
  draw(now);
  requestAnimationFrame(loop);
}

buildAvatarPicker($('chars'), reset);
reset();
requestAnimationFrame(loop);
