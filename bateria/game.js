const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- som: tudo sintetizado com Web Audio, sem arquivos ----------
let ac, noise, openHat;
function audio() {
  if (!ac) {
    ac = new AudioContext();
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume(); // celular só libera áudio depois de um toque
  return ac;
}
function env(vol, dur, t) {
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  g.connect(ac.destination);
  return g;
}
function tone(type, f0, f1, vol, dur) {
  const t = ac.currentTime, o = ac.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * .8);
  o.connect(env(vol, dur, t)); o.start(t); o.stop(t + dur);
}
function hiss(filter, freq, vol, dur) {
  const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter();
  s.buffer = noise; f.type = filter; f.frequency.value = freq;
  s.connect(f).connect(env(vol, dur, t)); s.start(t); s.stop(t + dur);
  return s;
}
const choke = () => { try { openHat?.stop(); } catch {} openHat = null; }; // chimbal fechado corta o aberto

const PADS = [
  { name: 'PRATO', key: 'q', cor: '#c9a227', som: 'TSHH!', play: () => { hiss('highpass', 5000, .6, 1.6); tone('square', 420, 380, .03, 1); } },
  { name: 'CHIMBAL ABERTO', key: 'w', cor: '#b58b1f', som: 'TSSS!', play: () => { choke(); openHat = hiss('highpass', 7000, .5, .5); } },
  { name: 'CONDUÇÃO', key: 'e', cor: '#a07c1c', som: 'PING!', play: () => { hiss('bandpass', 9000, .4, .9); tone('sine', 5200, 5000, .08, .9); } },
  { name: 'TOM 1', key: 'a', cor: '#1e88e5', som: 'TUM!', play: () => tone('sine', 260, 150, 1, .35) },
  { name: 'TOM 2', key: 's', cor: '#1565c0', som: 'TOM!', play: () => tone('sine', 190, 110, 1, .4) },
  { name: 'SURDO', key: 'd', cor: '#0d47a1', som: 'BUM!', play: () => tone('sine', 130, 70, 1, .55) },
  { name: 'CHIMBAL', key: 'z', cor: '#8d6e1a', som: 'TS!', play: () => { choke(); hiss('highpass', 8000, .5, .06); } },
  { name: 'CAIXA', key: 'x', cor: '#c62828', som: 'TÁ!', play: () => { hiss('highpass', 1200, .7, .22); tone('triangle', 220, 160, .5, .12); } },
  { name: 'BUMBO', key: 'c', cor: '#6a1b9a', som: 'PUM!', play: () => tone('sine', 150, 42, 1.2, .45) },
];

// ---------- toque ----------
let hits = 0, lastHit = -1e9, bubble = '', bubbleX = 0, kicks = [];
const shakeAt = PADS.map(() => -1e9);

function hit(i) {
  audio(); PADS[i].play();
  const now = performance.now();
  hits++; lastHit = shakeAt[i] = now; bubble = PADS[i].som; bubbleX = 90 + (i % 3) * 90;
  $('hits').textContent = hits;
  // BPM pela média dos intervalos das últimas batidas de bumbo/caixa (o pulso da música)
  if (i === 7 || i === 8) {
    kicks = [...kicks.filter(t => now - t < 4000), now].slice(-6);
    if (kicks.length >= 3) $('bpm').textContent = Math.round(60000 * (kicks.length - 1) / (now - kicks[0]));
  }
  const b = buttons[i];
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  clearTimeout(b.t); b.t = setTimeout(() => b.classList.remove('on'), 100);
}

const buttons = PADS.map((p, i) => {
  const b = document.createElement('button');
  b.style.setProperty('--pad', p.cor);
  b.innerHTML = `<kbd>${p.key.toUpperCase()}</kbd>`;
  b.append(p.name);
  // pointerdown (e não click) pra tocar na hora e aceitar vários dedos ao mesmo tempo
  b.addEventListener('pointerdown', e => { e.preventDefault(); hit(i); });
  b.addEventListener('keydown', e => { if (e.key === 'Enter') hit(i); }); // acessível pelo Tab
  $('pads').append(b);
  return b;
});
$('pads').addEventListener('contextmenu', e => e.preventDefault()); // toque longo não abre menu

addEventListener('keydown', e => {
  if (e.repeat) return;
  const i = e.key === ' ' ? 8 : PADS.findIndex(p => p.key === e.key.toLowerCase());
  if (i >= 0) { e.preventDefault(); hit(i); }
});

// ---------- desenho: avatar tocando atrás da bateria ----------
function drum(x, y, rx, ry, cor, i, t) {
  const s = Math.max(0, 1 - (t - shakeAt[i]) / 200) * 3;
  y += Math.sin(t / 15) * s;
  ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x, y - 2, rx - 3, ry - 3, 0, 0, Math.PI * 2); ctx.fill();
}
function cymbal(x, y, r, i, t) {
  const a = Math.sin(t / 30) * Math.max(0, 1 - (t - shakeAt[i]) / 500) * .25;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.ellipse(0, 0, r, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#777'; ctx.fillRect(x - 1, y, 2, H - y - 10);
}

function draw(t) {
  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, H - 30, W, 30);
  const playing = t - lastHit < 400;
  drawMood(ctx, currentAvatar(), W / 2, 112, 2, playing ? 'happy' : 'idle', t);
  cymbal(60, 50, 34, 0, t); cymbal(300, 56, 30, 2, t); cymbal(84, 92, 22, 1, t); cymbal(84, 98, 22, 6, t);
  drum(140, 100, 22, 8, '#1e88e5', 3, t); drum(220, 100, 24, 9, '#1565c0', 4, t);
  drum(268, 128, 28, 10, '#0d47a1', 5, t); drum(118, 128, 24, 8, '#c62828', 7, t);
  // bumbo: de frente, na frente do avatar
  const k = Math.max(0, 1 - (t - shakeAt[8]) / 150) * 4;
  ctx.fillStyle = '#6a1b9a'; ctx.beginPath(); ctx.arc(W / 2, 128, 34 + k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f0ff'; ctx.beginPath(); ctx.arc(W / 2, 128, 27 + k, 0, Math.PI * 2); ctx.fill();
  ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#6a1b9a'; ctx.textAlign = 'center';
  ctx.fillText('ROCK', W / 2, 131);
  if (t - lastHit < 350) drawBubble(ctx, bubbleX, 26, bubble);
  else if (!hits) drawBubble(ctx, W / 2, 26, 'Bora tocar?');
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
requestAnimationFrame(draw);

console.assert(PADS.length === 9 && new Set(PADS.map(p => p.key)).size === 9, 'uma tecla por pad');
