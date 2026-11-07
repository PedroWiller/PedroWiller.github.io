const $ = id => document.getElementById(id);
const canvas = $('stage'), ctx = canvas.getContext('2d');
const PRIZES = [1e3, 2e3, 3e3, 4e3, 5e3, 1e4, 2e4, 3e4, 4e4, 5e4, 1e5, 2e5, 3e5, 4e5, 5e5, 1e6];
const TIME = 30, LETTERS = 'ABCD', API = 'https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986';

// banco local por nível (LOCAL) fica em perguntas.js

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const makeQ = (text, right, ...wrong) => { const answers = shuffle([right, ...wrong]); return { text, answers, correct: answers.indexOf(right) }; };
const money = n => n >= 1e6 ? '1 MILHÃO' : n >= 1e3 ? n / 1e3 + ' MIL' : '0';
const msg = t => { $('msg').textContent = t; };

let tiers, q, level, helps, locked = true, timeLeft, timerId;
let mood = 'think', moodUntil = Infinity, bubbles = ['', '', ''], confetti = [];

const btns = [0, 1, 2, 3].map(i => {
  const b = document.createElement('button');
  b.className = 'ans';
  b.addEventListener('click', () => answer(i));
  $('answers').append(b);
  return b;
});

async function loadQuestions(online) {
  if (online) {
    try {
      const data = await (await fetch(API)).json();
      if (data.response_code !== 0) throw new Error('API ' + data.response_code);
      const d = decodeURIComponent, out = [[], [], []];
      for (const x of data.results) out[['easy', 'medium', 'hard'].indexOf(d(x.difficulty))]?.push(makeQ(d(x.question), d(x.correct_answer), ...x.incorrect_answers.map(d)));
      return out;
    } catch {
      msg('Não deu pra carregar a API — usando perguntas em português.');
    }
  }
  return LOCAL.map(t => shuffle(t.map(x => makeQ(...x))));
}

function setMood(m, ms = 0) {
  mood = m;
  moodUntil = ms ? performance.now() + ms : Infinity;
  if (m === 'happy') for (let i = 0; i < 80; i++) confetti.push({ x: Math.random() * 800, y: -Math.random() * 200, vy: 1 + Math.random() * 2, c: `hsl(${Math.random() * 360},90%,60%)` });
}

const parar = () => level ? PRIZES[level - 1] : 0;
const errar = () => level === PRIZES.length - 1 ? 0 : Math.floor(parar() / 2);
const canHelp = k => !locked && helps[k] > 0 && level < PRIZES.length - 1;

function updateHud() {
  $('num').textContent = `${level + 1}/16`;
  $('errar').textContent = money(errar());
  $('parar').textContent = money(parar());
  $('acertar').textContent = money(PRIZES[level]);
  $('skip').textContent = `⏭ Pular (${helps.skips})`;
  for (const k of ['skip', 'cards', 'univ', 'placas']) $(k).disabled = !canHelp(k === 'skip' ? 'skips' : k);
  $('stop').disabled = locked;
}

async function start(online) {
  $('play-local').disabled = $('play-online').disabled = true;
  msg('Carregando perguntas...');
  tiers = await loadQuestions(online);
  $('play-local').disabled = $('play-online').disabled = false;
  if (!$('msg').textContent.startsWith('Não')) msg('');
  level = 0;
  helps = { skips: 3, cards: 1, univ: 1, placas: 1 };
  $('menu').hidden = true; $('quiz').hidden = false;
  ask();
}

function ask() {
  const tier = level < 5 ? 0 : level < 10 ? 1 : 2;
  const src = [tiers[tier], ...tiers].find(t => t.length);
  if (!src) return end('Acabaram as perguntas!\nVocê leva ' + money(parar()), 'happy');
  q = src.pop();
  locked = false;
  bubbles = ['', '', ''];
  $('question').textContent = `${level + 1}. ${q.text}`;
  btns.forEach((b, i) => { b.textContent = `${LETTERS[i]}) ${q.answers[i]}`; b.className = 'ans'; b.disabled = false; });
  if (level === PRIZES.length - 1) msg('PERGUNTA DO MILHÃO! Sem ajudas — errar perde tudo.');
  setMood('think');
  updateHud();
  timeLeft = TIME; $('time').textContent = timeLeft;
  clearInterval(timerId);
  timerId = setInterval(() => {
    $('time').textContent = --timeLeft;
    if (timeLeft <= 0) { clearInterval(timerId); locked = true; updateHud(); reveal(-1); }
  }, 1000);
}

function answer(i) {
  if (locked || btns[i].disabled) return;
  locked = true; clearInterval(timerId); updateHud();
  btns[i].classList.add('sel');
  msg('Está certo disso?...');
  setMood('tense');
  setTimeout(() => reveal(i), 1800);
}

function reveal(i) {
  btns.forEach(b => b.classList.remove('sel'));
  btns[q.correct].classList.add('right');
  if (i === q.correct) {
    level++;
    if (level === PRIZES.length) return end('🏆 VOCÊ GANHOU\n1 MILHÃO!', 'happy');
    msg(`Certa resposta! Você já tem ${money(parar())}.`);
    setMood('happy');
    setTimeout(ask, 2200);
  } else {
    if (i >= 0) btns[i].classList.add('wrong');
    msg(i < 0 ? 'Tempo esgotado!' : 'Que pena... resposta errada!');
    setMood('sad');
    setTimeout(() => end(`${i < 0 ? 'TEMPO ESGOTADO' : 'ERROU!'}\nVocê leva ${money(errar())}`, 'sad'), 2200);
  }
}

function end(text, m) {
  clearInterval(timerId);
  locked = true;
  $('menu-title').textContent = text;
  $('menu').hidden = false; $('quiz').hidden = true;
  $('time').textContent = '-';
  setMood(m);
}

const openIdx = () => [0, 1, 2, 3].filter(i => !btns[i].disabled);

$('skip').addEventListener('click', () => {
  if (!canHelp('skips')) return;
  helps.skips--;
  msg('Pulou! Próxima pergunta...');
  ask();
});

$('cards').addEventListener('click', () => {
  if (!canHelp('cards')) return;
  helps.cards--;
  const n = Math.random() * 4 | 0; // Rei = 0, Ás = 1, 2, 3
  shuffle(openIdx().filter(i => i !== q.correct)).slice(0, n).forEach(i => { btns[i].disabled = true; });
  msg(n ? `A carta eliminou ${n} resposta${n > 1 ? 's' : ''} errada${n > 1 ? 's' : ''}!` : 'Deu Rei! Nenhuma resposta eliminada.');
  setMood(n >= 2 ? 'happy' : 'sad', 1500);
  updateHud();
});

$('univ').addEventListener('click', () => {
  if (!canHelp('univ')) return;
  helps.univ--;
  const open = openIdx(), p = 0.85 - Math.min(level, 14) * 0.03;
  bubbles = bubbles.map(() => LETTERS[Math.random() < p ? q.correct : open[Math.random() * open.length | 0]]);
  msg('Os universitários deram seus palpites!');
  updateHud();
});

$('placas').addEventListener('click', () => {
  if (!canHelp('placas')) return;
  helps.placas--;
  const open = openIdx(), w = open.map(i => Math.random() * 25 + (i === q.correct ? 55 - level * 3 : 0));
  const sum = w.reduce((a, b) => a + b);
  open.forEach((i, k) => { btns[i].textContent += `  — ${Math.round(w[k] / sum * 100)}%`; });
  msg('A plateia levantou as placas!');
  setMood('think');
  updateHud();
});

$('stop').addEventListener('click', () => {
  if (locked) return;
  end(`VOCÊ PAROU!\nLeva ${money(parar())}`, 'happy');
});

$('play-local').addEventListener('click', () => start(false));
$('play-online').addEventListener('click', () => start(true));
addEventListener('keydown', e => {
  const i = '1234'.indexOf(e.key) + 1 || 'abcd'.indexOf(e.key.toLowerCase()) + 1;
  if (i && e.key.length === 1) answer(i - 1);
});

// ---------- palco com os 3 avatares ----------
const bubble = (x, y, text) => drawBubble(ctx, x, y, text);

function draw(t) {
  if (t > moodUntil) setMood('think');
  const g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, '#0b0b18'); g.addColorStop(1, '#2a1650');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 220);

  const nervous = mood === 'tense' || (mood === 'think' && !locked && timeLeft <= 10);
  AVATARS.forEach((a, i) => {
    const gx = 200 + i * 200, ground = 200;
    // holofote
    const sg = ctx.createLinearGradient(0, 0, 0, ground);
    sg.addColorStop(0, 'rgba(255,230,150,0)'); sg.addColorStop(1, mood === 'sad' ? 'rgba(120,140,255,.18)' : 'rgba(255,230,150,.22)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(gx - 15, 0); ctx.lineTo(gx + 15, 0); ctx.lineTo(gx + 70, ground); ctx.lineTo(gx - 70, ground); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(gx, ground, 34, 8, 0, 0, Math.PI * 2); ctx.fill();

    let x = gx, y = Math.sin(t / 400 + i) * 2, dx = Math.sin(t / 900 + i * 2), dy = -1, mouth = a.mouth;
    if (mood === 'happy') { y = -Math.abs(Math.sin(t / 150 + i)) * 22; dy = 0; mouth = 'smile'; }
    if (mood === 'sad') { x += Math.sin(t / 90 + i) * 3; y = 4; dx = 0; dy = 1; mouth = 'sad'; }
    if (nervous) { x += Math.sin(t / 25 + i) * 1.5; mouth = 'open'; }

    ctx.save(); ctx.translate(x, ground + y); ctx.scale(2.6, 2.6);
    drawAvatar(ctx, { ...a, mouth }, 0, -16, dx, dy, false);
    ctx.restore();

    const eyeY = ground + y - 52, headTop = ground + y - 90;
    if (mood === 'sad') for (const s of [-1, 1]) {
      ctx.fillStyle = '#64b5f6';
      ctx.fillRect(x + s * 13 - 2, eyeY + (t / 12 + i * 20 + (s > 0 ? 15 : 0)) % 40, 4, 6);
    }
    if (nervous) { ctx.fillStyle = '#90caf9'; ctx.beginPath(); ctx.ellipse(x + 30, headTop + 20 + (t / 30 + i * 9) % 20, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); }

    if (bubbles[i]) bubble(x, headTop - 14, bubbles[i]);
    else if (mood === 'happy') bubble(x, headTop - 14, ['UHUU!', 'ISSO!', 'ÊÊÊ!'][i]);
    else if (mood === 'sad') bubble(x, headTop - 14, ['AFF', 'NÃO!', 'POXA'][i]);
    else if (nervous) bubble(x, headTop - 14, '!!');
    else if ((t / 1000 + i * 1.3) % 4 < 1.2) bubble(x, headTop - 14, '?');
  });

  confetti = confetti.filter(c => {
    c.y += c.vy; c.x += Math.sin((t + c.y) / 200);
    ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, 5, 8);
    return c.y < 230;
  });
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// auto-checagem do banco: 4 respostas diferentes e nenhuma pergunta repetida
console.assert(LOCAL.flat().every(q => q.length === 5 && new Set(q.slice(1)).size === 4), 'pergunta com respostas inválidas');
console.assert(new Set(LOCAL.flat().map(q => q[0])).size === LOCAL.flat().length, 'pergunta repetida');
