# Design

<!-- impeccable:design-schema 1 -->

## Direction: Cupón de Ruta

The interface reads as a carbon-copy waybill / ticket coupon, not a SaaS dashboard. Every package is a "coupon" moving through validated states (pendiente → tránsito → entregado), which maps directly onto the product's real mechanism: a paper notebook digitized into a ledger of trips.

## Platform

web (desktop + mobile, single responsive layout, PWA)

## Color

Restrained: one neutral surface system (navy) plus one brand accent (carbon-copy mauve) and three semantic status colors. No gradients, no glassmorphism, no ambient glow.

- `--bg-base` `#16223D` — page background (carrier navy)
- `--bg-surface-solid` `#1B2A4A` — cards, modals
- `--bg-elevated` `#22335C` — nested surfaces
- `--brand-primary` `#8B7FA0` — carbon-copy mauve, the one accent color
- `--text-primary` `#F7F4EC` — coupon-paper cream
- `--text-secondary` `#B9C0D4`
- Status: pending `#D4A64C` (ochre), transit `#7FA5CC` (steel blue), delivered `#5CA47F` (green), void `#D9695C` (red) — all rendered as bordered "stamp" badges (uppercase, tracked, 1.5px border), never glowing pills.

Light theme flips to a genuine coupon-paper palette: `#F7F4EC` base, `#1B2A4A` ink-navy text — not a re-tinted dark theme.

## Type

- `--font-family`: IBM Plex Sans — workhorse UI/body face (Operate mode: legibility over personality)
- `--font-heading`: Space Grotesk — headings and badges, restrained use
- `--font-mono`: Fira Code — all quantities (weight, money, distance, IDs), extended from its original limited use to reinforce the "manifest" character

## Layout

- Border radius: 3–10px (was 6–24px) — coupon/ticket corners, not app-blob radius.
- No `backdrop-filter` / glassmorphism anywhere; surfaces are flat and solid.
- No decorative gradients; every `linear-gradient`/`radial-gradient` used purely for chrome was flattened to a flat color. Functional gradients (print rule fade, OCR progress shimmer) were kept.
- Elevation via neutral shadows only (`--shadow-sm/md/lg`), no colored/glow shadows on chrome.
- Stat cards, buttons, badges carry color through a thin top accent or the icon itself — never a full-height "side-tab" border (flagged by the mechanical detector as a recognizable AI-UI tell and removed).

## Preserved from the incumbent system

- All product logic, Supabase integration, PWA/offline behavior, rate-tier values, and route data — unchanged.
- Existing component structure and JS — only presentation (CSS + a few dead/orphaned selectors) was touched.

## Known pre-existing issues (not part of this redesign, left for a separate pass)

- `server.js` uses CommonJS `require()` but `package.json` has `"type": "module"` — the local dev server cannot start as-is (`npm start`/`node server.js` throws). Preview here used `npx serve` instead.
- `renderMapWeatherBadges` is called in the live-map init path but is never defined anywhere in the codebase — throws at runtime, so the map weather badges never render.
- A duplicate/orphaned `[data-theme="light"] .cell-weight` rule pair (~line 1391) — two conflicting definitions, likely leftover from a prior partial edit.
