const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
// canvas em pé (mobile first): avatar em cima, notas caindo no meio, teclado embaixo
const W = 360, H = 540, TOP = 70, KY = 330, WW = 36, BW = 24, BH = 125, HIT = KY - 6, PX = 60; // PX = pixels por tempo
const WHITES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]; // Dó4 a Mi5
const BLACKS = [61, 63, 66, 68, 70, 73, 75];
const SOLFA = ['DÓ', 'DÓ#', 'RÉ', 'RÉ#', 'MI', 'FÁ', 'FÁ#', 'SOL', 'SOL#', 'LÁ', 'LÁ#', 'SI'];
const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, 'ç': 76, ';': 76 };
const BPS = 100 / 60; // andamento do "Ouvir"

// melodias de domínio público, "NOTA[:tempos]" (padrão 1 tempo)
const SONGS = [
  ['Brilha, Brilha Estrelinha', 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'],
  ['Parabéns pra Você', 'C4:.75 C4:.25 D4 C4 F4 E4:2 C4:.75 C4:.25 D4 C4 G4 F4:2 C4:.75 C4:.25 C5 A4 F4 E4 D4:2 A#4:.75 A#4:.25 A4 F4 G4 F4:2'],
  ['O Carneirinho de Maria', 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'],
  ['Ode à Alegria (Beethoven)', 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2'],
  ['Frère Jacques', 'F4 G4 A4 F4 F4 G4 A4 F4 A4 A#4 C5:2 A4 A#4 C5:2 C5:.5 D5:.5 C5:.5 A#4:.5 A4 F4 C5:.5 D5:.5 C5:.5 A#4:.5 A4 F4 F4 C4 F4:2 F4 C4 F4:2'],
  ['Jingle Bells', 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 G4 G4 F4 D4 C4:4'],
  ['Pour Elise (Beethoven)', 'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 G#4:.5 B4:.5 C5:1.5 E4:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 C5:.5 B4:.5 A4:2'],
];
const midi = n => { const [, l, s, o] = n.match(/^([A-G])(#?)(\d)$/); return 12 * (+o + 1) + 'C D EF G A B'.indexOf(l) + (s ? 1 : 0); };
function parse(text) {
  let beat = 0;
  return text.split(' ').map(tok => {
    const [n, d = '1'] = tok.split(':');
    const note = { m: midi(n), beat, dur: +d };
    beat += +d;
    return note;
  });
}

let song, notes, index, cursor, errors, streak, demo, done, mood, bubble, moodUntil, last;
const held = new Map(), lit = {}; // held: dedo/tecla → nota; lit: nota → quando foi tocada

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() {
  $('notes').textContent = notes.length ? `${index}/${notes.length}` : '-';
  $('errors').textContent = errors; $('streak').textContent = streak;
  $('listen').disabled = !notes.length;
  $('again').disabled = !notes.length;
}

function start() {
  notes = song < 0 ? [] : parse(SONGS[song][1]);
  index = 0; cursor = -4; errors = 0; streak = 0; demo = false; done = false;
  setMood('idle');
  hud();
}

// ---------- som: triângulo + harmônicos com ataque curto e queda longa, lembrando piano ----------
let ac;
function tone(m) {
  try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  if (ac.state === 'suspended') ac.resume(); // iOS só libera áudio depois de um toque
  const f = 440 * 2 ** ((m - 69) / 12), t0 = ac.currentTime, g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6);
  g.connect(ac.destination);
  for (const [type, mul, vol] of [['triangle', 1, 1], ['sine', 2, 0.3], ['sine', 3, 0.1]]) {
    const o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.frequency.value = f * mul; v.gain.value = vol;
    o.connect(v).connect(g); o.start(t0); o.stop(t0 + 1.7);
  }
}

function press(m) {
  tone(m);
  lit[m] = performance.now();
  if (!notes.length) return setMood('happy', SOLFA[m % 12], 400); // modo livre: avatar canta a nota
  if (demo || done) return;
  if (m === notes[index].m) {
    index++; streak++;
    if (index === notes.length) {
      done = true;
      setMood('happy', errors ? `${Math.round(100 * notes.length / (notes.length + errors))}%` : 'PERFEITO!');
    } else if (streak % 10 === 0) setMood('happy', `${streak}!`, 700);
    else setMood('happy', '', 250);
  } else {
    errors++; streak = 0;
    setMood('meh', 'OPS', 500);
  }
  hud();
}

// ---------- entrada ----------
function keyAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) * W / r.width, y = (clientY - r.top) * H / r.height;
  if (y < KY || x < 0 || x >= W) return null;
  if (y < KY + BH) for (const m of BLACKS) { const bx = blackX(m); if (x >= bx && x < bx + BW) return m; }
  return WHITES[Math.floor(x / WW)];
}
const blackX = m => WHITES.indexOf(m - 1) * WW + WW - BW / 2; // fica entre a branca de baixo e a de cima

canvas.addEventListener('pointerdown', e => {
  const m = keyAt(e.clientX, e.clientY);
  if (m == null) return;
  canvas.setPointerCapture(e.pointerId);
  held.set(e.pointerId, m); press(m);
});
canvas.addEventListener('pointermove', e => { // arrastar o dedo pelas teclas = glissando
  if (!held.has(e.pointerId)) return;
  const m = keyAt(e.clientX, e.clientY);
  if (m != null && m !== held.get(e.pointerId)) { held.set(e.pointerId, m); press(m); }
});
for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => held.delete(e.pointerId));
addEventListener('keydown', e => {
  const m = KEYMAP[e.key.toLowerCase()];
  if (m == null || e.repeat || e.target.tagName === 'SELECT') return;
  held.set(e.key.toLowerCase(), m); press(m);
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));

const select = $('song');
select.append(new Option('🎹 Tocar livre', -1), ...SONGS.map(([name], i) => new Option(name, i)));
select.addEventListener('change', () => {
  song = +select.value;
  try { localStorage.setItem('piano-song', song); } catch {}
  start(); select.blur();
});
$('listen').addEventListener('click', e => {
  start(); demo = true; cursor = -1;
  try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch {}
  setMood('happy', '♪', 0);
  e.currentTarget.blur();
});
$('again').addEventListener('click', e => { start(); e.currentTarget.blur(); });

// ---------- desenho ----------
function update(dt) {
  if (demo) { // toca sozinho no andamento
    cursor += dt * BPS;
    while (index < notes.length && notes[index].beat <= cursor) press(notes[index++].m);
    if (index >= notes.length && cursor > notes.at(-1).beat + 2) { start(); setMood('happy', 'SUA VEZ!', 1500); }
  } else if (notes.length) {
    const target = done ? notes.at(-1).beat + 3 : notes[index].beat; // espera a nota certa
    cursor += (target - cursor) * Math.min(1, dt * 8);
  }
  if (demo) $('notes').textContent = `${Math.min(index, notes.length)}/${notes.length}`;
}

const isLit = (m, now) => now - (lit[m] ?? -1e9) < 180 || [...held.values()].includes(m);
const laneX = m => BLACKS.includes(m) ? blackX(m) + BW / 2 : (WHITES.indexOf(m) + 0.5) * WW;
const hue = m => (m % 12) * 30;

function drawNotes(now) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, KY - TOP); ctx.clip();
  for (const w of WHITES) { ctx.fillStyle = WHITES.indexOf(w) % 2 ? '#1d1438' : '#211845'; ctx.fillRect(WHITES.indexOf(w) * WW, TOP, WW, KY - TOP); }
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(0, HIT, W, 2);
  ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = Math.max(0, index - 3); i < notes.length; i++) {
    const n = notes[i], bottom = HIT - (n.beat - cursor) * PX, h = Math.max(10, n.dur * PX - 4);
    if (bottom < TOP) break;
    const black = BLACKS.includes(n.m), w = black ? 20 : 30, x = laneX(n.m) - w / 2;
    const passed = i < index;
    ctx.globalAlpha = passed ? Math.max(0, 1 - (bottom - HIT) / 40) * 0.4 : 1; // tocada: desce e some
    ctx.fillStyle = `hsl(${hue(n.m)}, 70%, ${black ? 45 : 60}%)`;
    ctx.beginPath(); ctx.roundRect(x, bottom - h, w, h, 5); ctx.fill();
    if (i === index && !demo) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (h >= 16) { ctx.fillStyle = '#1a1033'; ctx.fillText(SOLFA[n.m % 12].replace('#', ''), x + w / 2, bottom - h / 2); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawKeys(now) {
  const next = !demo && !done && notes[index]?.m, pulse = 0.5 + 0.5 * Math.sin(now / 150);
  ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  WHITES.forEach((m, i) => {
    ctx.fillStyle = isLit(m, now) ? `hsl(${hue(m)}, 80%, 70%)` : '#f4f0ff';
    ctx.fillRect(i * WW + 1, KY, WW - 2, H - KY - 2);
    if (m === next) { ctx.fillStyle = `rgba(255,204,51,${0.35 + 0.4 * pulse})`; ctx.fillRect(i * WW + 1, KY + BH, WW - 2, H - KY - BH - 2); }
    ctx.fillStyle = '#5a47a3'; ctx.fillText(SOLFA[m % 12], i * WW + WW / 2, H - 18);
  });
  for (const m of BLACKS) {
    const x = blackX(m);
    ctx.fillStyle = isLit(m, now) ? `hsl(${hue(m)}, 70%, 45%)` : '#1a1a22';
    ctx.fillRect(x, KY, BW, BH);
    if (m === next) { ctx.fillStyle = `rgba(255,204,51,${0.45 + 0.4 * pulse})`; ctx.fillRect(x + 3, KY + BH - 30, BW - 6, 26); }
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x + 3, KY, 3, BH - 8);
  }
}

function draw(t) {
  const now = performance.now(), dt = Math.min(0.1, (t - (last ?? t)) / 1000); last = t;
  update(dt);
  if (now > moodUntil) setMood('idle');

  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  drawNotes(now);
  drawKeys(now);

  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  drawMood(ctx, currentAvatar(), 40, TOP - 8, 1.6, mood, t);
  if (bubble) drawBubble(ctx, 120, 30, bubble);
  else {
    ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center';
    const tip = !notes.length ? ['TOQUE QUALQUER', 'TECLA'] : demo ? ['OUÇA E', 'PRESTE ATENÇÃO'] : done ? ['MÚSICA COMPLETA!', '↺ PARA REPETIR'] : ['TOQUE A TECLA', 'QUE ESTÁ PISCANDO'];
    ctx.fillText(tip[0], 215, 28); ctx.fillText(tip[1], 215, 46);
  }
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
song = 0;
try { song = Number(localStorage.getItem('piano-song') ?? 0); } catch {}
if (!(song >= -1 && song < SONGS.length)) song = 0;
select.value = song;
start();
requestAnimationFrame(draw);

// auto-checagem: toda nota de toda música existe no teclado
console.assert(midi('C4') === 60 && midi('A4') === 69 && midi('D#5') === 75, 'nomes de nota');
for (const [name, text] of SONGS) console.assert(parse(text).every(n => WHITES.includes(n.m) || BLACKS.includes(n.m)), 'fora do teclado: ' + name);
console.assert(BLACKS.every(m => WHITES.includes(m - 1)), 'pretas entre brancas');
