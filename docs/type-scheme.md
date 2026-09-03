# Hayward Stoveworks — fonts

Use these three faces only. Do not add others.

| Role | Font | Fallback |
|---|---|---|
| **Show** | Calistoga | Cooper Black, Georgia, serif |
| **Story** | Source Serif 4 | Libre Baskerville, Times New Roman, serif |
| **Shop** | Source Sans 3 | Segoe UI, system-ui, sans-serif |

```
https://fonts.googleapis.com/css2?family=Calistoga&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap
```

```css
:root {
  --font-display: "Calistoga", "Cooper Black", "Georgia", serif;
  --font-serif: "Source Serif 4", "Libre Baskerville", "Times New Roman", serif;
  --font-sans: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
}
```

**Calistoga** — hero words, short display lines. Never body, nav, buttons, or forms. No italics.

**Source Serif 4** — page titles and all reading copy.

**Source Sans 3** — nav, buttons, labels, prices, forms, captions. Labels uppercase, tracking `0.2em`, weight 600.

| Style | Face | Size | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Hero | Calistoga | 3.5–5rem | 400 | 0 | 0.9 |
| Page title | Source Serif 4 | 2–2.5rem | 600 | 0 | 1.15 |
| Lede | Source Serif 4 | 1.125–1.25rem | 400 | 0 | 1.55 |
| Body | Source Serif 4 | 1–1.0625rem | 400 | 0 | 1.6 |
| Label | Source Sans 3 | 0.75rem | 600 | 0.2em | 1.3 |
| Button / UI | Source Sans 3 | 0.875–1rem | 600 | 0 | 1.3 |
| Caption | Source Sans 3 | 0.875rem | 400 | 0 | 1.4 |
