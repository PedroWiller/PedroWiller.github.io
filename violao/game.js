const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const W = 360, H = 470, TOP = 100, NUT = 160, FRET = 52, FRETS = 5;
const sx = s => 60 + s * 48;                  // corda 0 = Mi grave (esquerda), 5 = Mi agudo
const fy = f => NUT + (f - .5) * FRET;        // centro da casa f

// ---------- teoria ----------
const OPEN = [40, 45, 50, 55, 59, 64];        // MIDI das cordas soltas: E A D G B E
const NOMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
const CIFRA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nota = (s, f) => (OPEN[s] + f) % 12;
const nomeNota = n => `${NOMES[n]} (${CIFRA[n]})`;

// casas por corda (-1 = não toca) e dedos (0 = solta)
const CHORDS = {
  C:  { frets: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0], nome: 'Dó maior' },
  D:  { frets: [-1, -1, 0, 2, 3, 2], dedos: [0, 0, 0, 1, 3, 2], nome: 'Ré maior' },
  E:  { frets: [0, 2, 2, 1, 0, 0], dedos: [0, 2, 3, 1, 0, 0], nome: 'Mi maior' },
  F:  { frets: [1, 3, 3, 2, 1, 1], dedos: [1, 3, 4, 2, 1, 1], nome: 'Fá maior', pestana: 1 },
  G:  { frets: [3, 2, 0, 0, 0, 3], dedos: [2, 1, 0, 0, 0, 3], nome: 'Sol maior' },
  A:  { frets: [-1, 0, 2, 2, 2, 0], dedos: [0, 0, 1, 2, 3, 0], nome: 'Lá maior' },
  Am: { frets: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0], nome: 'Lá menor' },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], dedos: [0, 0, 0, 2, 3, 1], nome: 'Ré menor' },
  Em: { frets: [0, 2, 2, 0, 0, 0], dedos: [0, 2, 3, 0, 0, 0], nome: 'Mi menor' },
  A7: { frets: [-1, 0, 2, 0, 2, 0], dedos: [0, 0, 2, 0, 3, 0], nome: 'Lá com sétima' },
  B7: { frets: [-1, 2, 1, 2, 0, 2], dedos: [0, 2, 1, 3, 0, 4], nome: 'Si com sétima' },
  C7: { frets: [-1, 3, 2, 3, 1, 0], dedos: [0, 3, 2, 4, 1, 0], nome: 'Dó com sétima' },
  D7: { frets: [-1, -1, 0, 2, 1, 2], dedos: [0, 0, 0, 2, 1, 3], nome: 'Ré com sétima' },
  E7: { frets: [0, 2, 0, 1, 0, 0], dedos: [0, 2, 0, 1, 0, 0], nome: 'Mi com sétima' },
  G7: { frets: [3, 2, 0, 0, 0, 1], dedos: [3, 2, 0, 0, 0, 1], nome: 'Sol com sétima' },
};

// cantigas populares (domínio público); [X] marca onde troca para o acorde X
const SONGS = [
  { nome: 'Atirei o pau no gato', letra: [
    '[C]Atirei o pau no [G]gato-to',
    'mas o gato-to não mor[C]reu-reu-reu',
    'Dona Chica-ca ad[F]mirou-se-se',
    'do ber[C]rô, do berrô que o [G]gato [C]deu, miau!',
  ] },
  { nome: 'Ciranda, cirandinha', letra: [
    '[C]Ciranda, cirandinha, vamos todos ci[G]randar',
    'Vamos dar a meia volta, volta e meia vamos [C]dar',
    'O anel que tu me destes era vidro e se que[G]brou',
    'O amor que tu me tinhas era pouco e se aca[C]bou',
  ] },
  { nome: 'Marcha soldado', letra: [
    '[C]Marcha soldado, cabeça de pa[G]pel',
    'Se não marchar direito vai preso pro quar[C]tel',
    'O quartel pegou fogo, a polícia deu si[G]nal',
    'Acode, acode, acode a bandeira nacio[C]nal',
  ] },
  { nome: 'Peixe vivo', letra: [
    '[D]Como pode um peixe vivo vi[A]ver fora da água [D]fria?',
    'Como pode um peixe vivo vi[A]ver fora da água [D]fria?',
    'Como pode[D7]rei vi[G]ver, como pode[A]rei vi[D]ver',
    'sem a tua, sem a [A]tua, sem a tua compa[D]nhia?',
  ] },
  { nome: 'O cravo brigou com a rosa', letra: [
    '[G]O cravo brigou com a [D]rosa, debaixo de uma sa[G]cada',
    'O cravo saiu fe[D]rido e a rosa despeda[G]çada',
    'O cravo ficou do[D]ente, a rosa foi visi[G]tar',
    'O cravo teve um des[D]maio e a rosa pôs-se a cho[G]rar',
  ] },
  { nome: 'Escravos de Jó', letra: [
    '[Am]Escravos de Jó jogavam ca[E]xangá',
    'Tira, põe, deixa ficar',
    'Guerreiros com guerreiros fazem zigue zigue [Am]zá',
    'Guerreiros com guerreiros fazem zigue [E]zigue [Am]zá',
  ] },
];
// "[C]texto [G]mais" -> linhas de trechos { c, t, i } (i = índice do acorde na música)
function parse(letra) {
  let i = 0;
  return letra.map(l => l.split(/(?=\[)/).map(p => {
    const m = p.match(/^\[(\w+)\](.*)$/);
    return m ? { c: m[1], t: m[2] || ' ', i: i++ } : { c: null, t: p };
  }));
}

// ---------- som: corda dedilhada (Karplus-Strong), sem arquivos ----------
let ac;
const cache = {};
function audio() {
  ac ??= new AudioContext();
  if (ac.state === 'suspended') ac.resume(); // celular só libera áudio depois de um toque
  return ac;
}
function corda(midi) {
  if (cache[midi]) return cache[midi];
  const sr = ac.sampleRate, buf = ac.createBuffer(1, sr * 2.5, sr), d = buf.getChannelData(0);
  const N = Math.round(sr / (440 * 2 ** ((midi - 69) / 12)));
  for (let i = 0; i < d.length; i++) d[i] = i < N ? Math.random() * 2 - 1 : .996 * .5 * (d[i - N] + d[i - N + 1]);
  return cache[midi] = buf;
}
function tocar(midi, quando = 0, vol = .35) {
  audio();
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = corda(midi); g.gain.value = vol;
  s.connect(g).connect(ac.destination); s.start(ac.currentTime + quando);
}
function batida(c, vol = .3) {
  CHORDS[c].frets.forEach((f, s) => f >= 0 && tocar(OPEN[s] + f, s * .025, vol));
}

// ---------- estado ----------
let modo = 'guia', chord = 'C', toque = null, mood = 'idle', moodUntil = Infinity, bubble = '';
let song = 0, trechos = [], passo = 0, timer = null, beat = 0;
let q = null, score = 0, streak = 0, best = 0;
try { best = Number(localStorage.getItem('violao-best')) || 0; } catch {}

function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }
function hud() { $('score').textContent = score; $('streak').textContent = streak; $('best').textContent = best; }

function setModo(m) {
  modo = m; parar(); toque = null; setMood('idle');
  $('abas').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === m));
  for (const k of ['guia', 'musicas', 'desafio']) $('p-' + k).hidden = k !== m;
  if (m === 'musicas') abrirMusica(song);
  if (m === 'desafio') pergunta();
  if (m === 'guia') escolher(chord, false);
}
$('abas').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setModo(b.dataset.modo); b.blur(); } });

// ---------- guia de acordes ----------
for (const c in CHORDS) {
  const b = document.createElement('button');
  b.textContent = c; b.dataset.c = c;
  b.addEventListener('click', () => { escolher(c); b.blur(); });
  $('acordes').append(b);
}
function escolher(c, som = true) {
  chord = c; toque = null;
  $('acordes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === c));
  setMood('happy', CHORDS[c].nome, 1200);
  if (som) batida(c);
}
$('ouvir').addEventListener('click', e => { batida(chord); setMood('happy', CHORDS[chord].nome, 1200); e.currentTarget.blur(); });

// ---------- músicas ----------
SONGS.forEach((s, i) => $('musica').add(new Option(s.nome, i)));
$('musica').addEventListener('change', e => abrirMusica(+e.target.value));

function abrirMusica(i) {
  parar(); song = i; passo = 0;
  const linhas = parse(SONGS[i].letra);
  trechos = linhas.flat().filter(t => t.c);
  $('letra').innerHTML = '';
  for (const l of linhas) {
    const p = document.createElement('p');
    for (const t of l) {
      const span = document.createElement('span');
      span.className = 'seg'; span.textContent = t.t;
      if (t.c) {
        const b = document.createElement('b'); b.textContent = t.c; span.prepend(b);
        span.dataset.i = t.i;
        span.addEventListener('click', () => irPara(t.i, true));
      }
      p.append(span);
    }
    $('letra').append(p);
  }
  irPara(0, false);
}
function irPara(i, som) {
  passo = (i + trechos.length) % trechos.length;
  chord = trechos[passo].c;
  $('letra').querySelectorAll('.seg').forEach(s => s.classList.toggle('atual', +s.dataset.i === passo && s.dataset.i !== undefined));
  $('letra').querySelector('.atual')?.scrollIntoView({ block: 'nearest' });
  if (som) batida(chord);
}
function parar() { clearInterval(timer); timer = null; $('play').textContent = '▶ Tocar junto'; }
function play() {
  if (timer) return parar();
  audio(); beat = 0; $('play').textContent = '⏸ Pausar';
  const tick = () => {
    if (beat && beat % 4 === 0) irPara(passo + 1, false);
    batida(chord, beat % 4 ? .15 : .3); // 1ª batida do compasso mais forte
    beat++;
  };
  tick(); timer = setInterval(tick, 700); // ~86 BPM
}
$('play').addEventListener('click', e => { play(); e.currentTarget.blur(); });
$('ant').addEventListener('click', e => { irPara(passo - 1, true); e.currentTarget.blur(); });
$('prox').addEventListener('click', e => { irPara(passo + 1, true); e.currentTarget.blur(); });

// ---------- desafio ----------
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function pergunta() {
  const pick = a => a[Math.random() * a.length | 0];
  if (Math.random() < .5) {
    const c = pick(Object.keys(CHORDS));
    q = { tipo: 'acorde', c, certo: c, ops: shuffle([c, ...shuffle(Object.keys(CHORDS).filter(x => x !== c)).slice(0, 3)]) };
    $('pergunta').textContent = 'Que acorde é esse?';
  } else {
    const s = Math.random() * 6 | 0, f = Math.random() * FRETS | 0, n = nota(s, f);
    const outras = shuffle([...Array(12).keys()].filter(x => x !== n)).slice(0, 3);
    q = { tipo: 'nota', s, f, certo: nomeNota(n), ops: shuffle([n, ...outras]).map(nomeNota) };
    $('pergunta').textContent = f ? `Que nota é a casa ${f} dessa corda?` : 'Que nota é essa corda solta?';
  }
  q.respondida = false;
  $('opcoes').innerHTML = '';
  for (const o of q.ops) {
    const b = document.createElement('button');
    b.textContent = o;
    b.addEventListener('click', () => responder(b, o));
    $('opcoes').append(b);
  }
  setMood('idle');
  ouvirPergunta();
}
function ouvirPergunta() { if (q.tipo === 'acorde') batida(q.c); else tocar(OPEN[q.s] + q.f); }
function responder(b, o) {
  if (q.respondida) return;
  q.respondida = true; b.blur();
  const ok = o === q.certo;
  if (ok) { score++; streak++; if (streak > best) { best = streak; try { localStorage.setItem('violao-best', best); } catch {} } }
  else streak = 0;
  hud();
  $('opcoes').querySelectorAll('button').forEach(x => x.textContent === q.certo ? x.classList.add('certo') : x === b && x.classList.add('errado'));
  setMood(ok ? 'happy' : 'sad', ok ? (streak >= 5 ? `${streak} SEGUIDOS!` : 'ISSO!') : `ERA ${q.certo.split(' ')[0]}`, 1400);
  setTimeout(() => modo === 'desafio' && pergunta(), ok ? 1000 : 1800);
}
$('repetir').addEventListener('click', e => { ouvirPergunta(); e.currentTarget.blur(); });

// ---------- toque no braço ----------
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  const s = Math.round((x - 60) / 48), f = y < NUT ? 0 : Math.ceil((y - NUT) / FRET);
  if (y < TOP || s < 0 || s > 5 || f > FRETS) return;
  if (modo === 'guia') { // explorar notas em qualquer casa
    tocar(OPEN[s] + f); toque = { s, f, at: performance.now() };
    setMood('happy', nomeNota(nota(s, f)), 1200);
  } else if (modo === 'musicas') batida(chord);
  else ouvirPergunta();
});
addEventListener('keydown', e => {
  if (modo !== 'musicas') return;
  if (e.key === 'ArrowRight') irPara(passo + 1, true);
  if (e.key === 'ArrowLeft') irPara(passo - 1, true);
  if (e.key === ' ') { e.preventDefault(); play(); }
});

// ---------- desenho ----------
function braco(t) {
  ctx.fillStyle = '#5d3a1a'; ctx.fillRect(sx(0) - 24, NUT, sx(5) - sx(0) + 48, FRET * FRETS + 10);
  ctx.fillStyle = '#4a2c12';
  for (const f of [3, 5]) { ctx.beginPath(); ctx.arc(W / 2, fy(f), 7, 0, Math.PI * 2); ctx.fill(); } // marcações do braço
  ctx.fillStyle = '#f4f0ff'; ctx.fillRect(sx(0) - 24, NUT - 6, sx(5) - sx(0) + 48, 6); // pestana do violão
  ctx.fillStyle = '#9e9e9e';
  for (let f = 1; f <= FRETS; f++) ctx.fillRect(sx(0) - 24, NUT + f * FRET - 1, sx(5) - sx(0) + 48, 3);
  ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let s = 0; s < 6; s++) {
    // corda que acabou de ser tocada vibra
    const vib = toque?.s === s ? Math.sin(t / 12) * Math.max(0, 1 - (t - toque.at) / 500) * 2 : 0;
    ctx.fillStyle = s < 3 ? '#d4a017' : '#e0e0e0';
    ctx.fillRect(sx(s) - (3 - s / 2.5) / 2 + vib, NUT - 6, 3 - s / 2.5, FRET * FRETS + 16);
    ctx.fillStyle = '#a99fd1'; ctx.fillText(CIFRA[OPEN[s] % 12], sx(s), H - 14);
  }
  for (let f = 1; f <= FRETS; f++) { ctx.fillStyle = '#a99fd1'; ctx.fillText(f, 22, fy(f)); }
}
function bola(s, f, txt, cor) {
  const y = f ? fy(f) : NUT - 22;
  ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(sx(s), y, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1033'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText(txt, sx(s) + 1, y + 1);
}
function desenhaAcorde(c) {
  const ch = CHORDS[c];
  if (ch.pestana) { ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.roundRect(sx(0) - 15, fy(ch.pestana) - 13, sx(5) - sx(0) + 30, 26, 13); ctx.fill(); }
  ch.frets.forEach((f, s) => {
    ctx.font = '12px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (f < 0) { ctx.fillStyle = '#ef5350'; ctx.fillText('X', sx(s), NUT - 22); }
    else if (f === 0) { ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx(s), NUT - 22, 8, 0, Math.PI * 2); ctx.stroke(); }
    else bola(s, f, ch.dedos[s], '#ffcc33');
  });
}

function draw(t) {
  if (t > moodUntil) setMood('idle');
  ctx.fillStyle = '#170f2e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#241a45'; ctx.fillRect(0, 0, W, TOP);
  braco(t);

  let nome = chord;
  if (modo === 'desafio' && q) {
    nome = '?';
    if (q.tipo === 'acorde') desenhaAcorde(q.c);
    else bola(q.s, q.f, '?', '#29b6f6');
  } else desenhaAcorde(chord);
  if (modo === 'guia' && toque && t - toque.at < 1200) bola(toque.s, toque.f, NOMES[nota(toque.s, toque.f)][0], '#29b6f6');

  ctx.font = '28px "Press Start 2P", monospace'; ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(nome, W - 14, 84);
  const m = mood === 'idle' && timer ? 'happy' : mood; // tocando junto: avatar balança
  drawMood(ctx, currentAvatar(), 50, TOP - 10, 2, m, t);
  if (bubble) drawBubble(ctx, 205, 30, bubble);
  requestAnimationFrame(draw);
}

buildAvatarPicker($('chars'), () => {});
hud();
setModo('guia');
setMood('idle', 'Vamos tocar?', 2000);
requestAnimationFrame(draw);

// auto-checagem
console.assert(nomeNota(nota(0, 0)) === 'Mi (E)' && nomeNota(nota(1, 3)) === 'Dó (C)' && nomeNota(nota(3, 2)) === 'Lá (A)', 'notas');
for (const c in CHORDS) console.assert(CHORDS[c].frets.length === 6 && CHORDS[c].dedos.length === 6, c);
// toda música só usa acordes que existem no guia
for (const s of SONGS) for (const t of parse(s.letra).flat()) console.assert(!t.c || CHORDS[t.c], `${s.nome}: ${t.c}`);
// notas tocadas pelo acorde batem com o nome: C = Dó, Mi, Sol
console.assert(new Set(CHORDS.C.frets.map((f, s) => f >= 0 && nota(s, f)).filter(n => n !== false)).size === 3, 'C tem 3 notas');
