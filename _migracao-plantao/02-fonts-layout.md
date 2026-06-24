# 02 · `app/layout.tsx` — troca das fontes

Único arquivo além do CSS. Trocar o `<link>` do Google Fonts no `<head>`.
Nada mais no `layout.tsx` muda (o script de tema, metadata, etc. ficam iguais).

## Antes

```tsx
<link
  href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

## Depois

```tsx
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

## Notas
- **Instrument Serif** só tem peso 400 (regular + itálico) — é display, usada grande nos títulos
  e números. Os `font-weight:600/700` que o CSS aplica em `.page-head h1`, `.kpi .val`, etc.
  continuam válidos (caem no 400 sem quebrar layout); se quiser, pode remover o `font-weight`
  desses seletores, mas não é necessário.
- **Hanken Grotesk** traz o peso **800** (nomes em bold forte do Plantão) — por isso incluído no
  range `400;500;600;700;800`.
- **Geist Mono** substitui JetBrains Mono nos CNJ/datas/dados (`.mono`, `.cnj`, `.money`, etc.).
- Os `preconnect` para `fonts.googleapis.com` / `fonts.gstatic.com` já estão no `<head>` —
  mantê-los.
