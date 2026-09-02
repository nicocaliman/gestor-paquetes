# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The family that runs NC Caliman, an informal parcel/courier operation moving packages between Spain and Romania for the Romanian diaspora. Two operators, not a general public. They already know the business — the app exists for people at the counter, not for onboarding new users.

## Product Purpose

Replace the paper notebook ("libreta") they used to log incoming packages by hand. The app digitizes package intake (via OCR scan or manual entry), automatically prices each package by weight tier, and closes out accounts every weekend ("Cuentas Finde") with a printable delivery note (albarán) carrying a verification QR code.

## Positioning

Not a general logistics SaaS — a purpose-built internal tool for one specific informal courier operation's actual workflow (weigh, log, price, settle weekly, deliver). It replaces pen-and-paper plus mental arithmetic, not a competitor's software.

## Operating Context

- Weekend intake sessions: packages arrive, get weighed and logged (by OCR-scanning a handwritten note or manual form entry).
- Pricing is computed automatically from configurable weight-tier rate tables.
- At the end of the cycle, accounts are closed/archived and a delivery note (albarán) is generated with KPIs (total bultos, weight, money) and a verification QR, ready to print or export (CSV, email).
- A live map tracks the Spain↔Romania route (weather/satellite toggles, distance/time telemetry) since the business is physically moving goods along that corridor.
- A stats view tracks volume/weight/revenue metrics over time.
- Runs as an installable PWA (works offline) backed by Supabase.

## Capabilities and Constraints

- OCR scanner for package intake from handwritten notebook photos, with manual-entry fallback.
- Weight-tier rate configuration (standard shipments + special/bulky cargo) — the tier structure and pricing logic must be preserved; only the visual presentation changes.
- Dashboard KPIs: bulk count, total weight, total money, per liquidation cycle.
- Export paths: CSV, email, print (albarán with QR).
- Live route map (Romania↔Spain) with fullscreen mode, weather/satellite layers, city stops.
- Stats/metrics view.
- Supabase backend integration — must keep working as-is.
- PWA/offline support (manifest.json, service worker) — must keep working as-is.
- Single-file architecture today: vanilla HTML/CSS/JS (`index.html`, `src/css`, `src/services`), no framework, Node static server. Redesign should work within this stack, not introduce a framework migration.

## Brand Commitments

Company name "NC Caliman" (shown as "NC Caliman Gestor de Paquetes") is fixed and must remain.

## Evidence on Hand

- Existing rate/weight tier values and route data already encoded in the app — real, must be preserved exactly; do not invent new tiers or routes.
- Existing `icon.svg` and `manifest.json` (PWA identity).

## Product Principles

1. Digitizing paper beats decorating pixels — data entry speed always outranks visual flourish, since the app's whole reason to exist is being faster than the notebook it replaced.
2. The numbers are the product — weight, money, and status must stay legible and unambiguous before anything else.
3. This is a visual redesign, not a feature rebuild: preserve all existing functionality, data, integrations (Supabase, PWA/offline), and pricing logic exactly.
4. Built for two people who already know the business — no explanatory copy, no acquisition-style marketing tone, no hand-holding.
