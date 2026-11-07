// Avatares compartilhados entre os jogos. Expõe: AVATARS, drawAvatar, currentAvatar, buildAvatarPicker.
const AVATARS = [
  { name: 'Barbudo', skin: '#d9a07a', hair: 'bald', beard: '#3a312c', glasses: '#2a2a2a',
    shirt: '#1e1e22', pants: '#2b2b38', mouth: 'flat' },
  { name: 'Cacheada', skin: '#c98e66', hair: 'curly', hairColor: '#3b2618', glasses: '#e8c8c8',
    shirt: '#c9c3ec', pants: '#3949ab', mouth: 'smile' },
  { name: 'Ruiva', skin: '#f3d3b8', hair: 'long', hairColor: '#c8641e', shirt: '#1e1e22',
    emblem: '#f0a030', pants: '#2b2b38', mouth: 'flat' },
];
let chosen = 0;
try { chosen = Number(localStorage.getItem('avatar')) || 0; } catch {}
if (!AVATARS[chosen]) chosen = 0;

const currentAvatar = () => AVATARS[chosen];

// desenha em qualquer contexto (jogo ou miniatura), centrado em cx,cy; ocupa ~40px de altura, pés em cy+16
function drawAvatar(c, a, cx, cy, dx, dy, shadow = true) {
  const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const hy = cy - 5; // centro da cabeça

  if (shadow) {
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(cx, cy + 16, 12, 4, 0, 0, Math.PI * 2); c.fill();
  }

  // cabelo atrás
  if (a.hair === 'long') { c.fillStyle = a.hairColor; c.beginPath(); c.roundRect(cx - 14, hy - 8, 28, 26, 8); c.fill(); }
  if (a.hair === 'curly') for (const [ox, oy] of [[-12, 2], [12, 2], [-11, 8], [11, 8]]) dot(cx + ox, hy + oy, 5, a.hairColor);

  // pernas e corpo
  c.fillStyle = a.pants; c.fillRect(cx - 7, cy + 10, 5, 6); c.fillRect(cx + 2, cy + 10, 5, 6);
  c.fillStyle = a.shirt; c.beginPath(); c.roundRect(cx - 10, cy + 1, 20, 11, 4); c.fill();
  if (a.emblem) { c.strokeStyle = a.emblem; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy + 7, 3, 0, Math.PI * 2); c.stroke(); }
  if (a.hair === 'long') { c.fillStyle = a.hairColor; c.fillRect(cx - 14, hy + 4, 6, 16); c.fillRect(cx + 8, hy + 4, 6, 16); }

  // cabeça
  dot(cx, hy, 12, a.skin);
  if (a.beard) {
    c.fillStyle = a.beard;
    c.beginPath(); c.arc(cx, hy + 1, 12, 0.1 * Math.PI, 0.9 * Math.PI); c.fill();
    c.fillRect(cx - 5, hy + 5, 10, 2); // bigode
    for (const [ox, oy] of [[-3, 9], [4, 8], [0, 11], [-6, 7]]) dot(cx + ox, hy + oy, 1, '#9a9a9a'); // fios grisalhos
  }

  // cabelo em cima
  if (a.hair === 'bald') dot(cx - 4, hy - 7, 3, 'rgba(255,255,255,.3)');
  if (a.hair === 'long') {
    c.fillStyle = a.hairColor;
    c.beginPath(); c.arc(cx, hy, 12.5, 1.15 * Math.PI, 1.85 * Math.PI); c.fill();
    c.fillRect(cx - 13, hy - 6, 4, 14); c.fillRect(cx + 9, hy - 6, 4, 14);
  }
  if (a.hair === 'curly') for (const [ox, oy] of [[-8, -9], [0, -12], [8, -9], [-12, -3], [12, -3]]) dot(cx + ox, hy + oy, 6, a.hairColor);

  // olhos seguem a direção
  for (const s of [-1, 1]) dot(cx + s * 5 + dx * 1.5, hy + 1 + dy * 1.5, 1.8, '#1a1a1a');
  if (a.glasses) {
    c.strokeStyle = a.glasses; c.lineWidth = 1.5;
    c.strokeRect(cx - 9, hy - 2, 7, 6); c.strokeRect(cx + 2, hy - 2, 7, 6);
    c.beginPath(); c.moveTo(cx - 2, hy); c.lineTo(cx + 2, hy); c.stroke();
  }

  c.strokeStyle = '#8a3b3b'; c.lineWidth = 1.5; c.beginPath();
  if (a.mouth === 'smile') c.arc(cx, hy + 5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (a.mouth === 'sad') c.arc(cx, hy + 10, 3.5, 1.2 * Math.PI, 1.8 * Math.PI);
  else if (a.mouth === 'open') c.ellipse(cx, hy + 7, 2.5, 3, 0, 0, Math.PI * 2);
  else { c.moveTo(cx - 3, hy + 7); c.lineTo(cx + 3, hy + 7); }
  c.stroke();
}

// balão de fala com a ponta em x, y+18
function drawBubble(c, x, y, text) {
  c.font = '14px "Press Start 2P", monospace';
  const w = c.measureText(text).width + 18;
  c.fillStyle = '#fff';
  c.beginPath(); c.roundRect(x - w / 2, y - 18, w, 28, 8); c.fill();
  c.beginPath(); c.moveTo(x - 6, y + 10); c.lineTo(x, y + 18); c.lineTo(x + 6, y + 10); c.fill();
  c.fillStyle = '#1a1033'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y - 3);
}

// seletor de personagem: botões com miniatura dentro de `el`; chama onPick ao trocar
function buildAvatarPicker(el, onPick) {
  AVATARS.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = 'char';
    btn.setAttribute('aria-pressed', i === chosen);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 80;
    const c = cv.getContext('2d');
    c.scale(2, 2);
    drawAvatar(c, a, 20, 22, 0, 1);
    btn.append(cv, a.name);
    btn.addEventListener('click', () => {
      chosen = i;
      try { localStorage.setItem('avatar', i); } catch {}
      el.querySelectorAll('.char').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
      btn.blur(); // senão o Espaço "clica" no botão em vez de agir no jogo
      onPick();
    });
    el.append(btn);
  });
}

// avatar reagindo, pés em (x, ground), escala s. mood: 'idle' | 'happy' | 'sad' | 'worried' | 'meh'
function drawMood(c, a, x, ground, s, mood, t, look = 0) {
  let y = Math.sin(t / 400) * 1.5, dx = look, dy = 0, mouth = a.mouth;
  if (mood === 'happy') { y = -Math.abs(Math.sin(t / 130)) * 10; mouth = 'smile'; dy = -1; }
  if (mood === 'sad') { y = 2; mouth = 'sad'; dy = 1; dx = 0; }
  if (mood === 'worried') { x += Math.sin(t / 35) * 1.2; mouth = 'open'; }
  if (mood === 'meh') mouth = 'flat';
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath(); c.ellipse(x, ground, 12 * s, 3 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(x, ground + y * s); c.scale(s, s);
  drawAvatar(c, { ...a, mouth }, 0, -16, dx, dy, false);
  if (mood === 'sad') { c.fillStyle = '#64b5f6'; for (const k of [-1, 1]) c.fillRect(k * 5 - 1, -18 + (t / 40 + (k > 0 ? 6 : 0)) % 14, 1.6, 2.6); }
  c.restore();
}
