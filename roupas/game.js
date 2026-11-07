const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 400, SCALE = 6.2, CX = 180, CY = 250; // avatar grande no centro (coordenadas do drawAvatar ×6.2)
const COLORS = ['#f06292', '#e53935', '#ff9800', '#fdd835', '#66bb6a', '#42a5f5', '#7e57c2', '#212121', '#fafafa'];
const CATS = [
  ['top', '👕', 'BLUSA', [['camiseta', 'Camiseta'], ['listrada', 'Listrada'], ['regata', 'Regata'], ['coracao', 'Coração'], ['jaqueta', 'Jaqueta'], ['vestido', 'Vestido']]],
  ['bottom', '👖', 'BAIXO', [['calca', 'Calça'], ['saia', 'Saia'], ['short', 'Short']]],
  ['shoes', '👟', 'SAPATO', [['tenis', 'Tênis'], ['bota', 'Bota'], ['sandalia', 'Sandália'], ['sapatilha', 'Sapatilha']]],
  ['head', '👑', 'CABEÇA', [['nada', 'Nada'], ['laco', 'Laço'], ['coroa', 'Coroa'], ['bone', 'Boné'], ['chapeu', 'Chapéu'], ['gorro', 'Gorro'], ['tiara', 'Flores']]],
  ['extra', '🕶', 'EXTRA', [['nada', 'Nada'], ['oculos', 'Óculos'], ['colar', 'Colar'], ['cachecol', 'Cachecol'], ['bolsa', 'Bolsa']]],
];
const NO_COLOR = ['nada', 'coroa']; // coroa é sempre dourada
const THEMES = [
  { name: 'PRAIA', icon: '🏖', sky: '#4fc3f7', floor: '#ffe082',
    good: { top: ['regata', 'camiseta'], bottom: ['short', 'saia'], shoes: ['sandalia'], head: ['chapeu', 'bone'], extra: ['oculos'] } },
  { name: 'INVERNO', icon: '❄', sky: '#78909c', floor: '#eceff1',
    good: { top: ['jaqueta'], bottom: ['calca'], shoes: ['bota'], head: ['gorro'], extra: ['cachecol'] } },
  { name: 'FESTA', icon: '🎉', sky: '#4a148c', floor: '#880e4f',
    good: { top: ['vestido', 'coracao'], bottom: ['saia'], shoes: ['sapatilha'], head: ['coroa', 'tiara', 'laco'], extra: ['colar', 'bolsa'] } },
  { name: 'ESPORTE', icon: '⚽', sky: '#81d4fa', floor: '#66bb6a',
    good: { top: ['camiseta', 'regata'], bottom: ['short'], shoes: ['tenis'], head: ['bone', 'nada'], extra: ['nada'] } },
  { name: 'ESCOLA', icon: '📚', sky: '#a1887f', floor: '#6d4c41',
    good: { top: ['camiseta', 'listrada', 'jaqueta'], bottom: ['calca', 'saia'], shoes: ['tenis', 'sapatilha'], head: ['nada', 'laco'], extra: ['bolsa', 'nada'] } },
];
const CAT_NAME = { top: 'BLUSA', bottom: 'PARTE DE BAIXO', shoes: 'SAPATO', head: 'CABEÇA', extra: 'ACESSÓRIO' };

let look = { top: { id: 'camiseta', color: COLORS[5] }, bottom: { id: 'calca', color: COLORS[7] }, shoes: { id: 'tenis', color: COLORS[1] },
  head: { id: 'nada', color: COLORS[0] }, extra: { id: 'nada', color: COLORS[0] } };
let cat = 'top', theme, result, mood = 'idle', bubble = '', moodUntil = 0, stars = 0, looks = 0;
try {
  const saved = JSON.parse(localStorage.getItem('roupas-look'));
  if (saved && CATS.every(([k, , , items]) => items.some(([id]) => id === saved[k]?.id))) look = saved;
  [stars, looks] = JSON.parse(localStorage.getItem('roupas-score')) || [0, 0];
} catch {}

// quantas categorias combinam com o tema (vestido cobre a parte de baixo, então ela vale junto)
function rate(lk, th) {
  const ok = k => k === 'bottom' && lk.top.id === 'vestido' ? th.good.top.includes('vestido') : th.good[k].includes(lk[k].id);
  const miss = CATS.map(([k]) => k).filter(k => !ok(k));
  const hits = 5 - miss.length;
  return { hits, stars: hits >= 4 ? 3 : hits >= 2 ? 2 : 1, miss };
}

// ---------- roupas desenhadas por cima do avatar, nas coordenadas do drawAvatar (centro 0,0; pés em y=16) ----------
function shape(c, color, pts) { c.fillStyle = color; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
function dot(c, x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
const contrast = col => col === '#fafafa' || col === '#fdd835' ? '#212121' : '#fafafa';

function dress(c, a, lk, mouth) {
  const top = lk.top, bot = lk.bottom, vestido = top.id === 'vestido';
  drawAvatar(c, {
    ...a, mouth,
    shirt: top.id === 'jaqueta' ? '#fafafa' : top.color,
    pants: vestido || bot.id === 'saia' ? a.skin : bot.color, // saia/vestido: pernas de fora
  }, 0, 0, 0, 0.3, false);

  if (!vestido) {
    if (bot.id === 'saia') { shape(c, bot.color, [[-10, 9], [10, 9], [13, 14.5], [-13, 14.5]]); c.fillStyle = 'rgba(0,0,0,.15)'; for (const x of [-5, 0, 5]) c.fillRect(x, 10, .6, 4); }
    if (bot.id === 'short') { c.fillStyle = a.skin; c.fillRect(-7, 13, 5, 3); c.fillRect(2, 13, 5, 3); }
  }
  const tc = top.color;
  if (top.id === 'listrada') { c.fillStyle = contrast(tc); for (const y of [3.5, 6.5, 9.5]) c.fillRect(-9.5, y, 19, 1.2); }
  if (top.id === 'regata') { c.fillStyle = a.skin; c.fillRect(-10, 1, 3.5, 3); c.fillRect(6.5, 1, 3.5, 3); }
  if (top.id === 'coracao') { dot(c, -1.3, 5.5, 1.6, contrast(tc)); dot(c, 1.3, 5.5, 1.6, contrast(tc)); shape(c, contrast(tc), [[-2.8, 6], [2.8, 6], [0, 9]]); }
  if (top.id === 'jaqueta') { c.fillStyle = tc; c.beginPath(); c.roundRect(-10, 1, 7, 11, 3); c.roundRect(3, 1, 7, 11, 3); c.fill(); }
  if (vestido) { shape(c, tc, [[-10, 8], [10, 8], [14, 15], [-14, 15]]); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-10, 8, 20, 1); }

  const sc = lk.shoes.color;
  for (const x of [-8, 1]) {
    c.fillStyle = sc; c.beginPath();
    if (lk.shoes.id === 'tenis') { c.roundRect(x, 14, 7, 3, 1.5); c.fill(); c.fillStyle = '#fafafa'; c.fillRect(x, 16.2, 7, .8); }
    if (lk.shoes.id === 'bota') { c.roundRect(x + .5, 11, 6, 6, 1); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + .5, 11, 6, 1.2); }
    if (lk.shoes.id === 'sandalia') { c.fillRect(x + 1, 14.5, 5, .8); c.fillRect(x + .5, 16, 6, 1); }
    if (lk.shoes.id === 'sapatilha') { c.roundRect(x + .5, 14.5, 6, 2.5, 1.2); c.fill(); dot(c, x + 3.5, 15, .7, '#fafafa'); }
  }

  const ec = lk.extra.color;
  if (lk.extra.id === 'colar') for (let i = -4; i <= 4; i++) dot(c, i * 1.3, 2 + (16 - i * i) / 12, .8, i % 2 ? '#fafafa' : ec);
  if (lk.extra.id === 'cachecol') { c.fillStyle = ec; c.beginPath(); c.roundRect(-9, -.5, 18, 3.2, 1.5); c.roundRect(3, 1, 3.2, 8, 1); c.fill(); c.fillStyle = contrast(ec); c.fillRect(3, 6, 3.2, .8); }
  if (lk.extra.id === 'bolsa') {
    c.strokeStyle = '#4e342e'; c.lineWidth = .8; c.beginPath(); c.moveTo(-8, 1.5); c.lineTo(10, 8); c.stroke();
    c.fillStyle = ec; c.beginPath(); c.roundRect(8, 7, 7, 6, 1.5); c.fill(); dot(c, 11.5, 9, .7, '#ffca28');
  }
  if (lk.extra.id === 'oculos') {
    c.fillStyle = 'rgba(20,20,30,.9)'; c.strokeStyle = ec; c.lineWidth = 1;
    c.beginPath(); c.roundRect(-9.5, -7, 8, 5.5, 2); c.roundRect(1.5, -7, 8, 5.5, 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1.5, -5.5); c.lineTo(1.5, -5.5); c.stroke();
  }

  const hc = lk.head.color;
  if (lk.head.id === 'laco') { shape(c, hc, [[7, -15], [2, -19], [2, -11]]); shape(c, hc, [[7, -15], [12, -19], [12, -11]]); dot(c, 7, -15, 1.6, contrast(hc)); }
  if (lk.head.id === 'coroa') {
    shape(c, '#ffca28', [[-8, -15], [-8, -23], [-4, -19], [0, -25], [4, -19], [8, -23], [8, -15]]);
    dot(c, 0, -18, 1.3, '#e53935'); dot(c, -5, -17, 1, '#42a5f5'); dot(c, 5, -17, 1, '#66bb6a');
  }
  if (lk.head.id === 'bone') {
    c.fillStyle = hc; c.beginPath(); c.arc(0, -6, 12.8, Math.PI, 2 * Math.PI); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, -6.3, 14, 2, 0, 0, Math.PI * 2); c.fill();
    dot(c, 0, -18.5, 1.2, contrast(hc));
  }
  if (lk.head.id === 'chapeu') {
    c.fillStyle = hc; c.beginPath(); c.ellipse(0, -13, 20, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.roundRect(-9, -23, 18, 11, 4); c.fill();
    c.fillStyle = contrast(hc); c.fillRect(-9, -16, 18, 2.5);
  }
  if (lk.head.id === 'gorro') {
    c.fillStyle = hc; c.beginPath(); c.arc(0, -7, 13, Math.PI, 2 * Math.PI); c.fill();
    c.fillStyle = contrast(hc); c.globalAlpha = .4; c.beginPath(); c.roundRect(-13.5, -9.5, 27, 4, 2); c.fill(); c.globalAlpha = 1;
    dot(c, 0, -20.5, 3.5, '#fafafa');
  }
  if (lk.head.id === 'tiara') for (const ang of [-1, -.5, 0, .5, 1]) {
    const x = Math.sin(ang) * 12, y = -5 - Math.cos(ang) * 12;
    for (let k = 0; k < 4; k++) dot(c, x + Math.cos(k * Math.PI / 2) * 1.4, y + Math.sin(k * Math.PI / 2) * 1.4, 1.2, hc);
    dot(c, x, y, .9, '#fdd835');
  }
}

// ---------- interface ----------
function save() {
  try { localStorage.setItem('roupas-look', JSON.stringify(look)); localStorage.setItem('roupas-score', JSON.stringify([stars, looks])); } catch {}
}
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('stars').textContent = stars; $('looks').textContent = looks; }

function newTheme() {
  const others = THEMES.filter(t => t !== theme);
  theme = others[Math.random() * others.length | 0];
  result = null;
  setMood('idle', `${theme.icon} ${theme.name}?`, 1500);
}

function thumb(lk) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 72;
  const c = cv.getContext('2d');
  c.translate(36, 42); c.scale(1.6, 1.6);
  dress(c, currentAvatar(), lk, 'smile');
  return cv;
}

function buildTabs() {
  $('tabs').replaceChildren(...CATS.map(([k, icon, label]) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${icon}</b>${label}`;
    b.setAttribute('aria-pressed', k === cat);
    b.addEventListener('click', () => { cat = k; buildTabs(); buildItems(); });
    return b;
  }));
}

function buildItems() {
  const items = CATS.find(([k]) => k === cat)[3];
  $('items').replaceChildren(...items.map(([id, name]) => {
    const b = document.createElement('button');
    b.setAttribute('aria-pressed', look[cat].id === id);
    b.append(thumb({ ...look, [cat]: { ...look[cat], id } }), name); // miniatura já vestindo a peça
    b.addEventListener('click', () => { look[cat] = { ...look[cat], id }; changed(); });
    return b;
  }));
  const colors = $('colors');
  colors.hidden = NO_COLOR.includes(look[cat].id);
  colors.replaceChildren(...COLORS.map(col => {
    const b = document.createElement('button');
    b.style.background = col;
    b.setAttribute('aria-label', 'Cor ' + col);
    b.setAttribute('aria-pressed', look[cat].color === col);
    b.addEventListener('click', () => { look[cat] = { ...look[cat], color: col }; changed(); });
    return b;
  }));
}

function changed() {
  result = null;
  setMood('happy', '', 350);
  save(); buildItems();
}

$('show').addEventListener('click', e => {
  result = rate(look, theme);
  stars += result.stars; looks++;
  save(); hud();
  setMood(result.stars === 3 ? 'happy' : result.stars === 2 ? 'idle' : 'meh', ['', 'HMM...', 'GOSTEI!', 'ARRASEI!'][result.stars]);
  e.currentTarget.blur();
});
$('theme').addEventListener('click', e => { newTheme(); e.currentTarget.blur(); });

// ---------- desenho ----------
function draw(t) {
  const now = performance.now();
  if (now > moodUntil) setMood(result ? mood : 'idle', result ? bubble : '');

  ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = theme.floor; ctx.fillRect(0, 300, W, H - 300);
  ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = .35;
  for (let i = 0; i < 4; i++) ctx.fillText(theme.icon, 30 + i * 100 + (i % 2) * 20, 140 + (i % 2) * 60); // fundo do tema
  ctx.globalAlpha = 1;

  // faixa do tema
  ctx.fillStyle = 'rgba(23,15,46,.85)'; ctx.fillRect(0, 0, W, 44);
  ctx.font = '11px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33';
  ctx.fillText(`TEMA: ${theme.name}`, W / 2, 16);
  ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#f4f0ff';
  ctx.fillText(result ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) + (result.miss.length ? '  TROQUE: ' + CAT_NAME[result.miss[0]] : '  PERFEITO!') : 'MONTE UM LOOK QUE COMBINE', W / 2, 33);

  // passarela: sombra + avatar pulando/girando conforme o humor
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(CX, CY + 17 * SCALE, 15 * SCALE, 3 * SCALE, 0, 0, Math.PI * 2); ctx.fill();
  let y = Math.sin(t / 500) * 2, rot = 0, mouth = 'smile';
  if (mood === 'happy') { y = -Math.abs(Math.sin(t / 140)) * 14; rot = result?.stars === 3 ? Math.sin(t / 200) * .08 : 0; }
  if (mood === 'meh') mouth = 'flat';
  ctx.save(); ctx.translate(CX, CY + y); ctx.rotate(rot); ctx.scale(SCALE, SCALE);
  dress(ctx, currentAvatar(), look, mouth);
  ctx.restore();
  if (bubble) drawBubble(ctx, CX, 74, bubble);
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), buildItems); // trocar de avatar atualiza as miniaturas
newTheme();
buildTabs(); buildItems(); hud();
requestAnimationFrame(draw);

// auto-checagem das estrelas
const praia = THEMES[0];
console.assert(rate({ top: { id: 'regata' }, bottom: { id: 'short' }, shoes: { id: 'sandalia' }, head: { id: 'chapeu' }, extra: { id: 'oculos' } }, praia).stars === 3, '3 estrelas');
console.assert(rate({ top: { id: 'jaqueta' }, bottom: { id: 'calca' }, shoes: { id: 'bota' }, head: { id: 'gorro' }, extra: { id: 'cachecol' } }, praia).stars === 1, '1 estrela');
console.assert(rate({ top: { id: 'vestido' }, bottom: { id: 'calca' }, shoes: { id: 'sapatilha' }, head: { id: 'coroa' }, extra: { id: 'colar' } }, THEMES[2]).hits === 5, 'vestido cobre a parte de baixo');
console.assert(CATS.every(([k]) => THEMES.every(th => th.good[k].every(id => CATS.find(([c]) => c === k)[3].some(([i]) => i === id)))), 'temas só usam peças que existem');
