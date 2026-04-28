# PlanningLeads — CLAUDE.md

Read this first when working in this project.

## What This Is

**PlanningLeads** — standalone trade lead finder built on top of the PlanningData.ai API. Surfaces planning applications that mention trade-relevant materials (timber, slate, brick, glass, etc.) so contractors can identify upcoming work before it goes to tender.

**POC user:** Lewis Gauld, LRG Joinery, Arbroath. Confirmed £100–150/mo price point unprompted (Apr 2026).

**Live URL:** https://planningleads-poc.netlify.app  
**Data source:** `https://api.planningdata.ai/leads` — no separate backend, browser calls the API directly  
**Deploy:** Netlify CLI direct deploy (`netlify deploy --dir=. --prod --no-build --site=planningleads-poc`). GitHub Actions build hook is wired but unreliable — always deploy via CLI.

## Architecture

```
planningleads.nosync/
  index.html       — app shell: trade pills, council multi-select, date lookback tabs, results container
  app.js           — API calls, filtering, card rendering
  style.css        — brand styles
  netlify.toml     — SPA redirect rule
  .github/
    workflows/
      deploy.yml   — posts to Netlify build hook on push (unreliable — use CLI deploy instead)
```

Pure vanilla HTML/CSS/JS. No build step, no bundler, no framework.

## API

```
GET https://api.planningdata.ai/leads
  ?trade=joinery          — maps to keyword list in app.js TRADE_KEYWORDS
  &council=Angus,Dundee City,...
  &from=2026-01-01        — calculated from the "Submitted within" lookback selector
  &limit=100
```

**Response fields used by the frontend:**

| Field | Source |
|-------|--------|
| `reference`, `council`, `address`, `description` | applications table |
| `applicationType`, `dateReceived`, `status` | applications table |
| `applicantName`, `agentName`, `caseOfficer` | applications table |
| `lat`, `lon`, `portalUrl` | applications table |
| `category`, `categoryConfidence`, `enrichedAt` | enrichments table |
| `developmentScale`, `estimatedUnits`, `buildingType` | enrichments table |
| `materials`, `areasM2`, `emails`, `phones`, `architect` | document_intelligence table (aggregated) |

## Key Decisions

- **Scotland-only for POC** — council list is all 29 Scottish councils, defaulting to Lewis's area (Angus, Dundee City, Perth and Kinross, Aberdeenshire, Aberdeen)
- **No auth** — private URL is sufficient for POC demo
- **No backend** — browser hits `api.planningdata.ai` directly; CORS allowed via `LEADS_ORIGINS` in planningdata.ai `src/api/server.ts`
- **Netlify CLI deploy** — GitHub Actions fires a build hook but Netlify's GitHub App lacks SSH access to this repo, so the hook redeploys stale code. Always use `netlify deploy` CLI instead.

## Deploying

```bash
cd /Users/timholden/Desktop/Claude/planningleads.nosync
netlify deploy --dir=. --prod --no-build --site=planningleads-poc
```

## Conventions

- No build step — edit files directly, deploy immediately
- `escHtml()` on all user-facing data (XSS prevention)
- Card layout: label/value grid (`.detail-row`) with 100px label column
- Trade keywords maintained in sync between `app.js` (client filtering/display) and `src/api/server.ts` in planningdata.nosync (server-side SQL filtering)

## Related

| What | Where |
|------|-------|
| API endpoint (`GET /leads`) | `planningdata.nosync/src/api/server.ts` |
| DB query (`getLeads()`) | `planningdata.nosync/src/db/store.ts` |
| OCR pipeline (materials, areas, contacts) | `planningdata.nosync/src/document-intel/ocr.py` |
| Lewis call notes | `planningdata.nosync/research/2026-04-23-lewis-gauld-lrg-joinery/` |
