const $ = id => document.getElementById(id);
const canvas = $('stage');
let ctx = canvas.getContext('2d'); // let: os ícones da despensa trocam o ctx temporariamente
const W = canvas.width, H = canvas.height;

// cada camada desenha a partir da base (y) para cima e devolve a altura usada
const rr = (x, y, w, h, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
const ING = {
  paoB:   { name: 'Pão base', h: 12, draw: (x, y, w) => rr(x, y - 12, w, 12, [2, 2, 8, 8], '#d9913f') },
  carne:  { name: 'Carne',    h: 13, draw: (x, y, w) => { rr(x - 2, y - 13, w + 4, 13, 6, '#6b3a1f'); rr(x + 4, y - 10, w - 8, 2, 1, '#8d5532'); } },
  queijo: { name: 'Queijo',   h: 5,  draw: (x, y, w) => { rr(x - 4, y - 5, w + 8, 5, 1, '#ffcc33'); ctx.beginPath(); ctx.moveTo(x + w * .6, y); ctx.lineTo(x + w * .7, y + 7); ctx.lineTo(x + w * .8, y); ctx.fill(); } },
  alface: { name: 'Alface',   h: 7,  draw: (x, y, w) => { ctx.fillStyle = '#5cb85c'; for (let i = 0; i <= w; i += 10) { ctx.beginPath(); ctx.arc(x + i, y - 3, 6, 0, Math.PI * 2); ctx.fill(); } } },
  tomate: { name: 'Tomate',   h: 7,  draw: (x, y, w) => { rr(x, y - 7, w * .48, 7, 3, '#e53935'); rr(x + w * .52, y - 7, w * .48, 7, 3, '#e53935'); } },
  bacon:  { name: 'Bacon',    h: 6,  draw: (x, y, w) => { rr(x - 3, y - 6, w + 6, 6, 2, '#b5443b'); rr(x, y - 4, w, 2, 1, '#f0b8a8'); } },
  ovo:    { name: 'Ovo',      h: 8,  draw: (x, y, w) => { rr(x + 2, y - 8, w - 4, 8, 4, '#fdfdf5'); ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(x + w / 2, y - 5, 4, Math.PI, 0); ctx.fill(); } },
  cebola: { name: 'Cebola',   h: 5,  draw: (x, y, w) => { ctx.strokeStyle = '#c792d8'; ctx.lineWidth = 3; for (const o of [.25, .5, .75]) { ctx.beginPath(); ctx.ellipse(x + w * o, y - 2.5, w * .14, 2, 0, 0, Math.PI * 2); ctx.stroke(); } } },
  paoT:   { name: 'Pão topo', h: 22, draw: (x, y, w) => {
    ctx.fillStyle = '#e8a04b'; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2 + 2, 22, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff3d6'; for (const [ox, oy] of [[.3, 12], [.5, 17], [.7, 12], [.4, 7], [.6, 7]]) ctx.fillRect(x + w * ox, y - oy, 3, 2);
  } },
};
const KEYS = Object.keys(ING), FILLINGS = KEYS.filter(k => !k.startsWith('pao'));

function drawStack(items, cx, y, w) {
  ctx.save(); ctx.translate(cx - w / 2, 0);
  for (const k of items) { ING[k].draw(0, y, w); y -= ING[k].h; }
  ctx.restore();
}

const pick = a => a[Math.random() * a.length | 0];
function makeOrder(level) {
  const n = Math.min(2 + Math.floor(level / 3), 7);
  return ['paoB', ...Array.from({ length: n }, () => pick(FILLINGS)), 'paoT'];
}
const same = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);
// autoteste rápido
console.assert(same(['a', 'b'], ['a', 'b']) && !same(['a'], ['a', 'b']) && !same(['a', 'b'], ['b', 'a']), 'same()');
for (let l = 0; l < 30; l++) { const o = makeOrder(l); console.assert(o[0] === 'paoB' && o.at(-1) === 'paoT' && o.length <= 9, 'makeOrder', o); }

let best = 0;
try { best = Number(localStorage.getItem('lanches-best')) || 0; } catch {}
$('best').textContent = best;

let playing = false, coins, served, lives, stack, cust, pops = [], last = 0;

function newCustomer() {
  const base = pick(AVATARS);
  const max = Math.max(9, 22 - served * 0.7);
  cust = { look: { ...base, shirt: `hsl(${Math.random() * 360 | 0} 55% 55%)` }, order: makeOrder(served), patience: max, max, x: -60 };
  stack = [];
}

function pop(text, col) { pops.push({ text, col, y: 150, life: 1 }); }
function hud() {
  $('coins').textContent = coins; $('served').textContent = served;
  $('lives').textContent = '❤'.repeat(lives) + '♡'.repeat(3 - lives);
}

function start() {
  coins = 0; served = 0; lives = 3; pops = [];
  newCustomer(); hud();
  $('overlay').hidden = true; playing = true;
}

function add(k) {
  if (!playing || stack.length >= 10) return;
  stack.push(k);
}

function serve() {
  if (!playing || !stack.length) return;
  if (same(stack, cust.order)) {
    const gain = cust.order.length * 5 + Math.ceil(cust.patience);
    coins += gain; served++;
    pop(`+${gain} 🪙`, '#66bb6a');
    newCustomer();
  } else {
    cust.patience -= 4; stack = [];
    pop('Pedido errado!', '#ff7043');
  }
  hud();
}

function trash() { if (playing && stack.length) { stack = []; pop('Lixo', '#a99fd1'); } }

function loseCustomer() {
  lives--; pop('Cliente foi embora!', '#ff7043'); hud();
  if (lives > 0) return newCustomer();
  playing = false;
  if (coins > best) { best = coins; try { localStorage.setItem('lanches-best', best); } catch {} $('best').textContent = best; }
  $('title').textContent = `Fim do expediente!\n${served} lanches · ${coins} moedas`;
  $('start').textContent = 'Jogar de novo';
  $('overlay').hidden = false;
}

function draw(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;

  // parede e balcão
  ctx.fillStyle = '#2b1d14'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3a2819'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, 220);
  ctx.fillStyle = '#8d5a2b'; ctx.fillRect(0, 250, W, 14);
  ctx.fillStyle = '#5d3a1a'; ctx.fillRect(0, 264, W, H - 264);

  if (cust) {
    if (playing) {
      cust.x += (150 - cust.x) * Math.min(1, dt * 6);
      cust.patience -= dt;
      if (cust.patience <= 0) loseCustomer();
    }
    const k = Math.max(0, cust.patience / cust.max);
    const mood = k > .5 ? 'smile' : k > .25 ? 'flat' : 'sad';
    ctx.save(); ctx.translate(cust.x, 205); ctx.scale(2.4, 2.4);
    drawAvatar(ctx, { ...cust.look, mouth: mood }, 0, 0, 1, 0);
    ctx.restore();

    // balão com o pedido
    rr(20, 14, 260, 150, 14, '#fff8e8');
    ctx.beginPath(); ctx.moveTo(130, 164); ctx.lineTo(150, 164); ctx.lineTo(140, 180); ctx.fill();
    drawStack(cust.order, 150, 150, 90);
    ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#5d3a1a'; ctx.textAlign = 'left';
    cust.order.slice().reverse().forEach((o, i) => ctx.fillText(ING[o].name, 210 - 0, 32 + i * 14));

    // paciência
    rr(20, 300, 260, 14, 7, '#170f2e');
    rr(20, 300, 260 * k, 14, 7, k > .5 ? '#66bb6a' : k > .25 ? '#ffcc33' : '#e53935');
  }

  // prato com o lanche em montagem
  ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.ellipse(480, 252, 90, 14, 0, 0, Math.PI * 2); ctx.fill();
  if (stack) drawStack(stack, 480, 248, 110);

  // cozinheiro
  ctx.save(); ctx.translate(700, 205); ctx.scale(2.4, 2.4);
  drawAvatar(ctx, currentAvatar(), 0, 0, -1, 0);
  rr(-8, -26, 16, 10, 3, '#fff'); rr(-10, -20, 20, 5, 2, '#fff'); // chapéu de chef
  ctx.restore();

  ctx.textAlign = 'center'; ctx.font = '14px "Press Start 2P", monospace';
  pops = pops.filter(p => {
    p.y -= dt * 40; p.life -= dt * .8;
    ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.fillText(p.text, 480, p.y);
    ctx.globalAlpha = 1;
    return p.life > 0;
  });

  requestAnimationFrame(draw);
}

// despensa: um botão por ingrediente, tecla = posição
KEYS.forEach((k, i) => {
  const b = document.createElement('button');
  const icon = document.createElement('canvas');
  icon.width = 56; icon.height = 40;
  const main = ctx;
  ctx = icon.getContext('2d');
  ING[k].draw(10, k === 'paoT' ? 34 : 26, 36); // pão topo cresce pra cima a partir da base
  ctx = main;
  b.title = ING[k].name;
  b.append(icon);
  b.insertAdjacentHTML('beforeend', `<span>${ING[k].name}</span><small>${i + 1}</small>`);
  b.addEventListener('click', () => { add(k); b.blur(); });
  $('pantry').append(b);
});
$('serve').addEventListener('click', e => { serve(); e.currentTarget.blur(); });
$('trash').addEventListener('click', e => { trash(); e.currentTarget.blur(); });
$('start').addEventListener('click', start);
addEventListener('keydown', e => {
  const n = Number(e.key);
  if (n >= 1 && n <= KEYS.length) add(KEYS[n - 1]);
  else if (e.key === 'Enter') { e.preventDefault(); playing ? serve() : start(); }
  else if (e.key === 'Backspace') { e.preventDefault(); trash(); }
});

buildAvatarPicker($('chars'), () => {});
requestAnimationFrame(draw);
