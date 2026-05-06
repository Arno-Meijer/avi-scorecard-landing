# Migratie notes — Astro v4 (editorial)

Status: v4 design fully migrated to Astro on 2026-05-06. Build verified, all 6 routes render clean.

## Wat is gemigreerd

- **Design tokens** (`src/styles/global.css`) — cream bg `#FDFBF6`, soft-bg `#F6F1E6`, deeper navy `#0D1527`, Newsreader serif + Inter sans, editorial eyebrow style, uppercase tracked buttons, font-variation-settings.
- **Base layout** (`src/layouts/Base.astro`) — Newsreader + Inter from Google Fonts with optical-size axis. Meta tags, OG tags, canonical URL.
- **Nav** (`src/components/Nav.astro`) — 4 links (Advisory, Exit Readiness, Brief, Index), Book a call CTA, active state per page, cream-bg blur.
- **Footer** (`src/components/Footer.astro`) — 4-column grid, Services lists Advisory first then Exit Readiness, dark-bg with teal accent.
- **Homepage** (`src/pages/index.astro`) — editorial hero with email signup + scorecard preview viz, 4 hubs (Advisory/Exit Readiness/Brief/Index), Thesis with Roman numerals, Founder cards with photos + LinkedIn + tags, Final CTA with ✦ mark.
- **Advisory** (`src/pages/advisory/index.astro`) — NEW page. Hero "AI work that has to *pay off.*", 4 modules, 3 engagement formats (Sprint/Project featured/Fractional), 3 audiences, fit-call CTA.
- **Exit Readiness** (`src/pages/exit-readiness/index.astro`) — Editorial hero, 5 pillars as substantive rows with Roman numerals + buyer-quotes, 2-week how-it-works, 4 deliverables, scorecard CTA strip, final CTA.
- **Brief** (`src/pages/brief/index.astro`) — Hero with prominent email signup, 4 threads, 4 placeholder Recent Issues, dark final CTA with second signup form.
- **Value Index** (`src/pages/value-index/index.astro`) — Walkthrough-only positioning, 6 answers grid (amber accent), 3-step engagement, ground rules, mailto CTA with prefilled body.
- **Scorecard placeholder** (`src/pages/exit-readiness/scorecard.astro`) — Editorial placeholder, ready for v2 form migration.
- **API route** (`api/submit.js`) — unchanged, all forms post here. Pipedrive/n8n flow intact.
- **Privacy** (`public/privacy.html`) — unchanged static carry-over.
- **Vercel rewrites** (`vercel.json`) — legacy URLs redirect to new routes.

## Open punten (niet blocking)

### Content / copy
1. **Sample issue headlines op /brief** — fictieve placeholders. Vervangen met echte zodra eerste paar issues live zijn.
2. **Engagement format prijzen op /advisory** — bewust niet getoond. Toevoegen als Arno+Christan transparant willen zijn over startbedragen.
3. **Pillar buyer-quotes op /exit-readiness** — door me geschreven om de pillars te verlevendigen. Vervangen door echte quotes uit DD-werk of weghalen als ze niet authentiek klinken.
4. ~~**Founder LinkedIn URLs**~~ — Verified 2026-05-06: `linkedin.com/in/christan-doornhof/` en `linkedin.com/in/arnomeijer1/`.

### Technisch / backend
5. **n8n tagging** — backend config bij Christan voor `source=home-hero`, `source=brief-landing`, `source=brief-final-cta`. Site werkt zonder, leads landen alleen ongetagd in Pipedrive.
6. **Calendly upgrade** — alle CTA's gaan nu via mailto. Calendly link integreren als volume groeit.
7. ~~**Scorecard-v2 lift-and-shift**~~ — DONE 2026-05-06. Lifted into `src/pages/exit-readiness/scorecard.astro` with v4 design token overrides. vercel.json rewrite removed; Astro page now serves directly. Legacy `/scorecard.html` retained in `public/` to keep old `/exit-scorecard-form` and `/valuation-scorecard/start` URLs working.

## Hoe deze code naar GitHub krijgen

**Aanbevolen: nieuwe repo.** Maak een nieuwe GitHub repo (bijv. `aivaluefirm-com`), commit deze folder, push. In Vercel een nieuw project koppelen aan de nieuwe repo. Custom domain `aivaluefirm.com` verhuizen zodra je tevreden bent met de live preview op de Vercel preview URL.

**Alternatief: branch op huidige repo.** `git checkout -b astro-migration` op `avi-scorecard-landing`, alle huidige files vervangen door deze inhoud, PR openen voor review en merge.

Voorkeur is nieuwe repo: schone start, oude blijft als rollback beschikbaar.

## Build verificatie

```bash
npm install
npm run build       # 6 pages built
npm run preview     # serve dist/ locally
```

Output:
- `/index.html` — homepage
- `/advisory/index.html` — NEW
- `/exit-readiness/index.html`
- `/exit-readiness/scorecard/index.html`
- `/brief/index.html`
- `/value-index/index.html`
- `/privacy.html` — static carry-over

Last verified: 2026-05-06.
