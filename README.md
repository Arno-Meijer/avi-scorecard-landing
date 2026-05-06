# AI Value Firm — site (Astro)

Masterbrand site voor AI Value Firm. Drie hubs onder de paraplu:

- `/exit-readiness` — service-pagina + Scorecard funnel
- `/brief` — AI Value Brief newsletter signup
- `/value-index` — AI Value Index benchmark database

## Run lokaal

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # build naar ./dist
npm run preview  # preview de build
```

## Deploy

Vercel detecteert Astro automatisch.
- Build command: `npm run build`
- Output dir: `dist`
- API route: `/api/submit` blijft ongewijzigd (Vercel native serverless function in `/api`)

Env vars die Vercel nodig heeft (zoals in de huidige site):
- `TURNSTILE_SECRET_KEY`
- `N8N_WEBHOOK_SECRET`

## Structuur

```
avf-site/
├── api/
│   └── submit.js              # 1-op-1 overgenomen uit huidige repo (Turnstile + n8n + Sheets)
├── public/
│   ├── images/                # Arno, Christan, og-image
│   └── privacy.html           # huidige privacy page, ongewijzigd
├── src/
│   ├── components/
│   │   ├── Nav.astro          # gedeelde top nav
│   │   └── Footer.astro       # gedeelde footer
│   ├── layouts/
│   │   └── Base.astro         # SEO + nav + footer wrapper
│   ├── pages/
│   │   ├── index.astro        # AVF homepage (3 hub cards)
│   │   ├── exit-readiness/
│   │   │   ├── index.astro    # service uitleg
│   │   │   └── scorecard.astro# placeholder — v2 scorecard migreert hier
│   │   ├── brief/
│   │   │   └── index.astro    # newsletter signup
│   │   └── value-index/
│   │       └── index.astro    # AVI hub met sample entries
│   └── styles/
│       └── global.css         # design tokens overgenomen uit index-v2.html
├── astro.config.mjs
├── vercel.json                # legacy rewrites zodat oude URLs werken
└── package.json
```

## Migratie status

Zie `MIGRATION-NOTES.md` voor de fasering en de nog openstaande punten.
