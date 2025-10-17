Love the vibe — it’s exactly the kind of “AI assistant for parts” that pays off quickly and can grow nicely.

Here’s how I’d shape it so you get value fast without locking into the wrong stack.

What You Already Have

.env has MOUSER_API_KEY and MOUSER_API_APPLICATION_NAME (no other code yet).
No need for pymouser. Direct HTTP calls are simpler and more flexible.
Recommendation

Start with a small Node.js TypeScript CLI (no web UI yet). Why:
Keeps Mouser API key off the client and out of the browser.
Easier to script batch jobs (e.g., “all 0805 thin-film resistors for these values”).
You can share core logic later with a web UI if you want one.
Stack

TypeScript + node:fetch (or undici) + dotenv + commander (CLI).
Optional AI: anthropic or openai later for clarifications; keep it off by default.
No mouser lib; call the API directly with fetch.
Two-Sided Problem → Two Layers

Discovery/Selection (Phase 1): Deterministic “rules + ranking” for common passives.
Exploration/Advisory (Phase 2): AI assists when specs are fuzzy or there are tradeoffs.
Phase 1 Scope (High ROI)

Batch-select 0805 thin-film resistors with preferences:
Inputs: list of values, package 0805, tech thin-film, brand pref “Yageo RG”, quantity (for pricing), “must be in stock”.
Output: Mouser numbers (and MPN), price at qty, stock, link.
Ranking heuristic:
In-stock > lifecycle active > brand/series preference (Yageo RG) > lowest price at requested qty > tolerance/power match.
Packaging default “Cut Tape” unless qty implies reel.
Preferences file:
~/.bom-helper/prefs.yml (e.g., resistor.brandOrder: [Yageo, Vishay], resistor.seriesPreferred: [RG]).
Caching:
Cache Mouser responses to .cache/mouser/ to avoid re-hitting the API.
CLI Sketch

parts resistors --values 10k,2k2,49.9k --package 0805 --tech thin-film --pref-series "RG" --pref-brand "Yageo" --qty 200 --in-stock-only
parts caps --value 100uF --voltage-min 16 --esr low --brand Panasonic --package 1206 --in-stock-only
prefs set resistor.prefBrand=Yageo resistor.prefSeries=RG
Mouser API Use (Direct HTTP)

Keyword search first, then filter locally:
POST https://api.mouser.com/api/v1/search/keyword?apiKey={key}
Body: {"SearchByKeywordRequest": {"keyword": "Yageo RG 0805 10k thin film", "records": 50}}
If part number is known (from AI or a previous run), confirm via part-number endpoint.
Filter fields you care about: Manufacturer, ManufacturerPartNumber, MouserPartNumber, Description, Availability, LifecycleStatus, Series, Tolerance, PowerRating, CaseSize, PriceBreaks, Packaging.
Guardrails:
Rate limiting → backoff and cache.
Normalize values (“2k2”, “2.2k”, “2200 ohm”).
AI Integration (Optional, Later)

Only when heuristic fails or ambiguity is high (saves tokens).
Provide an embedded API brief + function calls:
searchMouser(keyword, records=50), getPartDetails(mpn), rankCandidates(requirements, results).
Ask clarifying questions when constraints are missing: tolerance, power, packaging, series fallback.
Why Not a Web App First

Exposes secrets or forces a backend anyway; more plumbing now for little benefit.
CLI gives you speed and repeatability while we figure out the right UX. We can add a tiny API later and put a web UI on top.
Fastest First Win Options

Bash + curl prototype (resistors-only): minimal dependencies, quick validation.
Node/TS CLI skeleton with one command: “resistors” with value list and prefs.
Your call; both avoid any heavy AI until we want it.
Concrete Next Steps

Pick one:
A) Minimal curl script that returns best Mouser part per value for 0805 thin-film Yageo RG, in stock.
B) TS CLI scaffold with parts resistors command, .env support, caching, and ranking.
If B, I’ll scaffold:
apps/cli with commander, dotenv.
src/mouser.ts (HTTP client), src/rank.ts (heuristics), src/prefs.ts, src/normalize.ts, src/commands/resistors.ts.
.env uses your existing MOUSER_API_KEY and MOUSER_API_APPLICATION_NAME.
Want me to spin up Option A (bash) for immediate results, or Option B (TypeScript CLI) as a solid base?

Getting Started (CLI MVP)

- Prereqs: Node 18+.
- Add secrets to `.env` at repo root:
  - `MOUSER_API_KEY=...`
  - `MOUSER_API_APPLICATION_NAME=...`
  - `OPEN_ROUTER_API_KEY=...` (optional; not used yet)
- Install deps: `npm install`
- Try a dry run (no external calls): `npm run resistors -- --dry-run`
- Real search (uses Mouser API): `npm run resistors`
  - Include rows that already have MPNs (useful for testing on this BOM): `npm run resistors -- --dry-run --include-with-mpn`

What the CLI does now

- Parses `bom_example.csv` (or any KiCad-like BOM you pass).
- Finds 0805 resistors without MPNs and dedupes by value.
- Asks preferences (brand/series/tolerance/power, in-stock-only).
- If not `--dry-run` and a Mouser key is present, queries Mouser and ranks candidates.
- Prints best/alternates and writes `out/resistor_suggestions.json`.

Notes

- Susumu RG 0805 is the default bias. You can change brand/series on the prompt or via flags.
- LLM is stubbed for now; we’ll wire OpenRouter to ask clarifying questions only when needed.
- Stock checking for already-specified MPNs can be added next.

Web App (Fastify + Lit)

- Backend: `server/` Fastify API with OpenRouter tool-calling and Mouser tools.
  - `POST /api/run` — send `{ bomCsv?, messages: [{role, content}] }`; returns assistant messages.
  - Loads keys from `.env` (MOUSER_API_KEY, OPEN_ROUTER_API_KEY).
  - Dev: `cd server && npm install && npm run dev`
- Frontend: `web/` Lit + Vite single page.
  - `npm install && npm run dev` in `web/` (served on 5173).
  - Set `VITE_API_BASE` if your API runs elsewhere.
  - Upload a BOM CSV and chat; the agent calls Mouser via tools and proposes parts.

One‑Command Dev

- From repo root:
  - Install root deps: `npm install`
  - Install sub-app deps: `npm run setup`
  - Run both servers: `npm run dev`
    - Backend on `http://localhost:3000`
    - Frontend on `http://localhost:5173` (points to backend by default)
