# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Coleção de mini-jogos de navegador em HTML/CSS/JS puro: sem build, sem dependências, sem package.json, sem framework de testes. Toda a UI e os comentários são em português (pt-BR).

## Rodar

- Abrir `index.html` direto no navegador, ou servir a pasta: `python3 -m http.server` e acessar `http://localhost:8000`.
- Checar sintaxe de um jogo: `node --check <jogo>/game.js`.
- Não existe suíte de testes. Lógica não trivial ganha `console.assert` no fim do próprio `game.js` (ver `velha/game.js`), ou um script avulso rodado com `node`.

## Mobile first

Pensar sempre primeiro em celular e tablet no navegador: todo jogo precisa ser jogável só com toque (botões ou toque no canvas, nunca só teclado), caber na tela de um celular em pé e ter alvos de toque de pelo menos ~48px. Teclado é o extra. Testar mentalmente em 360px de largura.

## Arquitetura

- `index.html`: menu principal (tela de "APERTE START" com cidade em chamas desenhada em canvas). Cada jogo novo precisa de um `<li><a href="pasta/index.html">NOME<small>SUBTÍTULO</small></a></li>` no `#menu`.
- Cada jogo fica em sua pasta (`bomberman/`, `turbo/`, `quiz/`, `lanches/`, `velha/`, `blocos/`) com `index.html` + `game.js`. Os scripts são carregados como `<script>` clássicos (sem módulos), compartilhando o escopo global, nesta ordem:
  1. `../shared/avatars.js`: globais `AVATARS`, `drawAvatar(ctx, avatar, cx, cy, dx, dy, shadow)`, `currentAvatar()`, `buildAvatarPicker(el, onPick)`, `drawBubble(ctx, x, y, texto)`. O avatar escolhido fica salvo em `localStorage['avatar']`. Expressões vêm de `{ ...avatar, mouth: 'smile' | 'sad' | 'open' | 'flat' }`; `dx`/`dy` (-1..1) direcionam o olhar.
  2. `game.js` do jogo.
  3. `../shared/touch.js` (só em jogos que dependem de teclado): transforma cada `<button data-key="...">` dentro de um `.pad` em keydown/keyup sintéticos na janela; `data-repeat` faz repetir enquanto segura. O `.pad` só aparece em telas de toque (`@media (pointer: coarse)`), que também escondem a legenda de teclas do `.controls`.
  4. `../shared/retro.js`: **precisa vir depois do jogo**. Ele cria, para cada `<canvas>` com largura ≥ 300, uma cópia sobreposta com filtro retrô (ATARI/NES/SNES/PS1...) e põe um botão fixo para trocar de filtro (`localStorage['retro']`). Canvas menores (miniaturas de avatar) são ignorados.
- `shared/style.css`: tema compartilhado (variáveis em `:root`, `.hud`/`.stat`, `.board`, `.overlay` com `#overlay-title` + `#restart`, `.chars` para o seletor de avatar, `.controls` com `<kbd>`). Estilos específicos de um jogo ficam em `<style>` no `index.html` dele.
- Padrão dos jogos: `const $ = id => document.getElementById(id)`, canvas de resolução fixa escalado por CSS (cliques convertidos via `getBoundingClientRect`), loop com `requestAnimationFrame`, `reset()` + overlay de fim de jogo, e os avatares reagindo ao estado (pulando/sorrindo, chorando, nervosos com balão de fala).
- `quiz/` busca perguntas na Open Trivia DB (`opentdb.com`, em inglês, sem chave; limite de 1 requisição a cada 5s por IP, por isso só um fetch de 50 perguntas agrupadas por dificuldade). Se a API falhar, usa o banco local `LOCAL` em pt-BR.
- Toda leitura/escrita de `localStorage` fica dentro de `try/catch`.
