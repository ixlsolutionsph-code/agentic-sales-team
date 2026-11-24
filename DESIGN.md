# Design: Spectrum look

The app follows Adobe's **Spectrum 2** design system (light theme). It replaces the
earlier "Artboard" lime-and-ink style and the blue tokens in `01-prd.md` §10.

Values come from Adobe's published `@adobe/spectrum-tokens` package (version 15.9.1,
Apache-2.0). They live as CSS variables at the top of `app/globals.css`.

## What we use

| Part | Value |
|---|---|
| Accent | `#3b63fb` (blue-900), hover `#274dea` (blue-1000) |
| Subtle accent | `#e5f0fe` (blue-200), `#f5f9ff` (blue-100) |
| Text | `#292929` (gray-800), subdued `#505050` (gray-700), muted `#717171` (gray-600) |
| Headings | `#131313` (gray-900), weight 800 |
| Backgrounds | page `#ffffff`, layer 1 `#f8f8f8` |
| Borders | `#e1e1e1` (gray-200); controls `#dadada` (gray-300), 2 px |
| Card washes | blue-200 `#e5f0fe`, seafoam-200 `#d3f6ea`, orange-200 `#ffeccf`, purple-200 `#f4ebfc` |
| Status | positive `#079355`, negative `#d73220`, notice `#d45b00` |
| Corners | small 4, medium 8, large 10, extra large 16 (cards), buttons are pills |
| Shadows | Spectrum "elevated" on the demo window and pop-ups, "emphasized" on small cards |
| Font | **Source Sans 3** (free, by Adobe), self-hosted in `public/fonts/` |
| Code font | JetBrains Mono |
| Icons | Lucide icon font subset (`public/fonts/lucide.woff2`) |

## Rules

- Main action: filled blue pill button. Everything else: outlined pill button.
- Labels and buttons use sentence case, never all capitals.
- Use the accent blue for actions, links, checks and highlights.
- Shadows only on raised things (the demo window, pop-ups, the featured plan).

## What we do not use

- No Adobe logo, name or red "A", and nothing that suggests Adobe made or endorses the app.
- No Adobe Clean font: it is licensed only for Adobe's own products.
