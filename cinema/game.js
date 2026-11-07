const $ = id => document.getElementById(id);
const canvas = $('plateia'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// links watch?v=, youtu.be/, shorts/, embed/, live/; texto solto é busca
function videoId(s) {
  const m = s.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

let mood = 'meh', moodUntil = Infinity, bubble = 'Cadê o filme?';
function setMood(m, text = '', ms = 0) { mood = m; bubble = text; moodUntil = ms ? performance.now() + ms : Infinity; }

function projetar(id) {
  const tela = $('tela'), sala = $('sala');
  sala.classList.remove('aberta');
  // fecha a cortina, troca o filme e abre de novo
  setTimeout(() => {
    tela.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.title = 'Vídeo do YouTube';
    tela.append(f);
    sala.classList.add('aberta');
    document.body.classList.add('escuro');
    setMood('happy', 'Oba! Começou!', 2500);
  }, sala.classList.contains('aberta') ? 900 : 0);
  try { localStorage.setItem('cinema-video', id); } catch {}
}

// busca sem chave via Piped (front-end aberto do YouTube com CORS liberado).
// shortcut: depende de uma instância pública que pode cair; se acontecer, trocar a URL ou usar a YouTube Data API com chave
const PIPED = 'https://api.piped.private.coffee';
const lista = $('resultados');
const tempo = s => `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;

async function buscar(q) {
  lista.hidden = false;
  lista.innerHTML = '<p>Procurando...</p>';
  setMood('worried', 'Procurando...');
  try {
    const r = await fetch(`${PIPED}/search?q=${encodeURIComponent(q)}&filter=videos`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(r.status);
    const itens = (await r.json()).items.filter(v => v.type === 'stream' && videoId(v.url));
    lista.innerHTML = '';
    if (!itens.length) { lista.innerHTML = '<p>Nada encontrado.</p>'; return setMood('sad', 'Nada...', 2000); }
    for (const v of itens) {
      const id = videoId(v.url), li = document.createElement('li'), b = document.createElement('button');
      const img = new Image(); img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; img.alt = ''; img.loading = 'lazy';
      const txt = document.createElement('span'), info = document.createElement('small');
      txt.textContent = v.title;
      info.textContent = [v.uploaderName, v.duration > 0 && tempo(v.duration)].filter(Boolean).join(' · ');
      txt.append(info); b.append(img, txt);
      b.addEventListener('click', () => { lista.hidden = true; projetar(id); });
      li.append(b); lista.append(li);
    }
    setMood('happy', `${itens.length} vídeos!`, 1500);
  } catch {
    // sem a busca, ainda dá pra procurar no próprio YouTube e colar o link
    lista.innerHTML = '';
    const p = document.createElement('p'), a = document.createElement('a');
    a.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'procure no YouTube';
    p.append('A busca não respondeu. Tente de novo ou ', a, ' e cole o link aqui.');
    lista.append(p);
    setMood('sad', 'Busca fora do ar', 2500);
  }
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('url').value.trim();
  if (!q) return;
  $('url').blur();
  const id = videoId(q);
  if (id) { lista.hidden = true; projetar(id); } else buscar(q);
});
$('luz').addEventListener('click', () => document.body.classList.toggle('escuro'));
addEventListener('keydown', e => {
  if (e.target.tagName !== 'INPUT' && e.key.toLowerCase() === 'l') document.body.classList.toggle('escuro');
});
try { const last = localStorage.getItem('cinema-video'); if (last) $('url').value = `https://youtu.be/${last}`; } catch {}

// plateia: duas fileiras de poltronas, seu avatar no meio da frente
const ROW = [[90, 'a'], [230, 'b'], [320, 'eu'], [410, 'c'], [550, 'a']];
buildAvatarPicker($('chars'), () => {});

function draw(t) {
  if (performance.now() > moodUntil) setMood(document.querySelector('.tela iframe') ? 'idle' : 'meh');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a0606'; ctx.fillRect(0, 0, W, H);
  const me = currentAvatar();
  ROW.forEach(([x, k], i) => {
    const a = k === 'eu' ? me : AVATARS[(AVATARS.indexOf(me) + i + 1) % AVATARS.length];
    // vista de frente (de costas não daria pra ver as reações); os outros só imitam seu humor, sem o susto
    drawMood(ctx, a, x, 96, 1.4, k === 'eu' ? mood : mood === 'worried' ? 'meh' : mood, t + i * 300);
  });
  // encostos das poltronas na frente das pernas
  for (let x = 20; x < W; x += 70) {
    ctx.fillStyle = '#7a1212'; ctx.beginPath(); ctx.roundRect(x, 80, 60, 30, 8); ctx.fill();
    ctx.fillStyle = '#9e1c1c'; ctx.fillRect(x + 6, 84, 48, 4);
  }
  if (bubble) drawBubble(ctx, 320, 26, bubble);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

console.assert(videoId('/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
console.assert(videoId('musica de gato') === null);
console.assert(videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s') === 'dQw4w9WgXcQ');
console.assert(videoId('https://youtu.be/dQw4w9WgXcQ?si=abc') === 'dQw4w9WgXcQ');
console.assert(videoId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
console.assert(videoId('https://m.youtube.com/watch?feature=x&v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
console.assert(videoId('olá mundo') === null);
