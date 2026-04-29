# Mobile-first em `index.html`

## Objetivo

Tornar `index.html` usável em telas pequenas (≤768px) sem quebrar o layout desktop existente. `mobile.html` permanece intocado.

## Escopo

Apenas `index.html`. Mudanças são CSS responsivo (Tailwind), markup HTML adicional (bottom nav e containers de cards) e ajustes nas funções `render*` para popular tanto `<tbody>` quanto containers de cards.

### Não-objetivos

- Não alterar `mobile.html`.
- Não mudar lógica de validação, API mock, autenticação, tema ou dados.
- Não extrair componentes / não modularizar JS.
- Não unificar com `mobile.html`.

## Breakpoint

`md:` do Tailwind (≥768px) é o divisor:
- Classes base = mobile.
- Classes `md:` / `lg:` = desktop.

## Mudanças por área

### 1. Sidebar → escondida no mobile
- `<nav>` da sidebar recebe `hidden md:block`.
- Largura fixa `w-64` permanece atrás do `md:`.

### 2. Bottom tabs (mobile)
- Novo `<nav class="fixed bottom-0 inset-x-0 md:hidden glass border-t border-slate-700/50 z-40">` com 6 botões (Catraca, Alunos, Pagamentos, Auditoria, Logs, Offline).
- Cada botão: ícone (text-lg) + label (text-[10px]), `data-page="..."` igual à sidebar.
- O listener atual `document.querySelectorAll('.nav-btn')` já cobre os botões novos se eles tiverem a classe `nav-btn`. Os botões da bottom nav recebem `nav-btn` e classes utilitárias adicionais (`flex-col`, `flex-1`, `py-2`).
- Item ativo deve refletir tanto na sidebar quanto na bottom nav. O handler atual marca apenas o `btn` clicado; ajustar para marcar todos os `.nav-btn[data-page="X"]`.
- `<main>` recebe `pb-20 md:pb-0` para não ficar coberto pela bottom bar.

### 3. Header compacto
- Subtítulo "Painel administrativo": `hidden md:block`.
- Pill "API Online": já tem `hidden md:flex` — manter. No mobile, exibir versão minimal: dot colorido + toggle (sem texto), em `flex md:hidden`. Mesma `<input id="apiToggle">` não pode duplicar — solução: criar um segundo toggle `apiToggleMobile` e sincronizar via listener (ou mover toggle para fora e mostrar sempre).
  - **Decisão**: mover o toggle para um container compacto único visível em ambos breakpoints; o que muda é só a exibição do texto "API Online"/"API Offline" (`hidden md:inline`). Mantém um único `apiToggle`.
- Botão "Sair": no mobile vira item de dropdown ancorado no avatar `AD`. Implementação simples: avatar com `onclick` que toggla um `<div>` absoluto com link "Sair". No desktop o "Sair" continua visível inline (`hidden md:inline-block`) e o dropdown também funciona — sem prejuízo.
- Padding header: `px-4 py-3 md:px-6`.

### 4. Tabelas → cards no mobile
Cada uma das 6 tabelas (`alunosTable`, `pagamentosTable`, `auditoriaTable`, `logsTable`, `cacheTable`, `filaTable`) recebe:
- O `<table>` (ou wrapper `overflow-x-auto`) ganha `hidden md:block`.
- Um `<div id="<nome>Cards" class="md:hidden divide-y divide-slate-700/50"></div>` irmão.

As funções `renderAlunos`, `renderPagamentos`, `renderAuditoria`, `renderLogs`, `renderOffline` passam a montar uma string de cards e atribuir a `<nome>Cards.innerHTML`, em paralelo ao `<tbody>` atual.

Padrão de card (Alunos como exemplo):
```html
<div class="p-4 hover:bg-slate-800/30">
  <div class="flex items-start gap-3">
    <div class="avatar-9x9">AB</div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <div class="font-medium text-white truncate">{nome}</div>
        <span class="badge {status}">{status}</span>
      </div>
      <div class="text-xs text-slate-500 mt-0.5">{cpf} · {plano}</div>
      <div class="text-xs text-slate-400 mt-1">Vence: {validade}</div>
      <div class="flex gap-2 mt-3">
        <button>Bloquear/Desbloquear</button>
        <button>Excluir</button>
      </div>
    </div>
  </div>
</div>
```

Variantes análogas para Pagamentos, Auditoria, Logs, Cache, Fila — campos principais visíveis, sem ações quando a tabela original não tinha.

### 5. Forms e grids
- Botão "Cadastrar" e "Registrar Pagamento": `w-full md:w-auto`.
- Catraca: `#catracaDisplay` com `p-6 md:p-10`; `#catracaIcon` com `text-5xl md:text-7xl`; `#catracaMsg` com `text-xl md:text-2xl`.
- Page headers (h2 "Cadastro de Alunos" etc.): `text-xl md:text-2xl`.
- `<main>` padding: `p-4 md:p-6`.

### 6. Login
- Card interno: `p-6 md:p-8`.
- Sem outras mudanças.

### 7. Toast
- `bottom-20 right-4 md:bottom-6 md:right-6` para evitar sobreposição com a bottom nav.

## Como verificar

Manualmente no navegador (Chrome devtools, viewport 375×812 — iPhone padrão):
1. Login: card cabe na tela, sem scroll horizontal.
2. Após login: header compacto, sidebar invisível, bottom nav visível com 6 itens.
3. Trocar de seção via bottom nav funciona, item ativo destaca.
4. Validar acesso na Catraca: display visível sem zoom-out.
5. Ir em Alunos: lista renderiza como cards verticais, ações Bloquear/Excluir clicáveis.
6. Cadastrar aluno: form em coluna única, botão largura total.
7. Toggle API offline: dot muda de cor; gerar evento e verificar Auditoria/Logs/Offline em formato card.
8. Tema light: cards e bottom nav respeitam as overrides existentes (validar contraste).
9. Em ≥768px (desktop): layout original inalterado — sidebar visível, tabelas em formato tabela, header completo.
