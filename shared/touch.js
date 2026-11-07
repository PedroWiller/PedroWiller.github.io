// Controle na tela para celular/tablet: cada <button data-key="..."> de um .pad vira tecla.
// Dispara keydown/keyup sintéticos na janela, então os jogos não precisam saber que é toque.
// data-repeat: segurar repete a tecla (ex.: mover peça); sem ele, segurar = tecla pressionada.
(() => {
  const send = (type, key, repeat = false) => dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true }));
  for (const b of document.querySelectorAll('.pad [data-key]')) {
    let timer;
    const up = () => {
      if (!b.classList.contains('on')) return;
      b.classList.remove('on'); clearTimeout(timer); clearInterval(timer);
      send('keyup', b.dataset.key);
    };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId); // dedo que escorrega pra fora não deixa a tecla presa
      b.classList.add('on');
      send('keydown', b.dataset.key);
      if (b.dataset.repeat != null) timer = setTimeout(() => { timer = setInterval(() => send('keydown', b.dataset.key, true), 70); }, 220);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', e => e.preventDefault()); // toque longo não abre menu
  }
})();
