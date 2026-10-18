# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file userscript (Tampermonkey/Violentmonkey) that collects an OGame account snapshot while the player browses the game and hands it to the ProxyForGame (PfG) site. All code lives in `src/pfg-companion.user.js` — no build step, no dependencies, no bundler.

## Commands

- `npm run check` — syntax-check the userscript (`node --check`).
- `npm test` — `node:test` suite in `test/`: runs the whole userscript in jsdom on a minimal game page with stubbed `GM_*` and `fetch` (the fake `accountInfo` mirrors a real response), then asserts on GM storage. Full saved game pages (`view-source*.html`, gitignored) contain session tokens and must not be committed. No linter.
- Manual testing: install `src/pfg-companion.user.js` in a userscript manager. Besides OGame and proxyforgame.com, the `@match` metadata covers `http://pfg.wmp/*` and `http://localhost:8000/*` for local PfG development.

## Architecture

The script runs in two modes, chosen by `ON_GAME` (hostname ends with `.ogame.gameforge.com`):

**Game mode** (OGame page):
1. `installGameUi()` adds a `PfG Companion` entry to `#menuTable` with a battery-level icon and a slide-out panel.
2. `collectAccount()` fetches `accountInfo` and `speciesBonuses` from OGame's `externaldataexport` component, throttled to once per `COLLECTION_INTERVAL_MS` (5 min) per account unless forced (panel "Refresh" button).
3. `buildExport()` strips bulky response keys, merges body details parsed from planet-list tooltips (coords, temperature, fields, diameter), and sets `schemaVersion: 2`, `universe`, `exportedAt`.
4. `saveProductionFactors()` reads production-percentage selects **only** when `component=resourcesettings` is open, for the current planet. It keeps the entry's `collectedAt`, so the account-fetch throttle is not reset.
5. `persistExport()` merges new production factors with previously stored ones, derives `pfgCompanion.productionBoosters` from `planets[id].buffs` via `productionBoosters()`, recomputes `pfgCompanion.status` via `collectionStatus()` (level 1 = account/bodies missing, 2 = some planets lack production factors, 3 = complete), and writes to GM storage.

**Site mode** (PfG page): `handOffToSite()` writes `{ version: 1, exports: [...] }` to `localStorage['pfg_companion_pending_export']` and dispatches the `pfg-companion:sync` document event; re-runs whenever GM storage changes (`GM_addValueChangeListener`).

### Storage and contracts

- GM storage key `pfg-companion:snapshots:v1` holds `{ "<lang>:<uniNumber>:<playerId>": { collectedAt, export, error? } }`. `activeEntry()` finds the entry for the current universe host/player/planet.
- The export must stay compatible with the account-export format parsed by PfG's `profiles-core.js` (schema version 2); companion-specific data goes only under the optional `pfgCompanion` block (`productionFactors`, `productionBoosters`, `status`). Changing these keys/event names breaks the site hand-off.
- The script never writes account data to a PfG server.

### Behavioural constraints (from README — keep these)

- Never change the selected planet, navigate/open game pages, or run background polling loops. Collection happens only on page load or on explicit Refresh.
- Production factors are read only from the Resource Settings page the player opened themselves.

## Conventions

- `PRODUCTION_ITEMS` maps production-booster item uuids to `{ resource, tier, percent? }`; each booster has one uuid per duration. Shop uuids come from the shop page's `itemNames`; bronze boosters are not in the shop, so their uuids come from a planet where they are active.
- `accountInfo` (requested with `X-Requested-With: XMLHttpRequest`; without it the game answers "An error has occured!") already contains per-planet `resources`, `production`, `buildings`, `ships`, `defenses` and `buffs` (active items with `itemUuid` and Unix-second `effectStart`/`effectEnd`) for all planets, so none of this is scraped from the page.
- `LEVEL_ICONS` holds base64 PNGs embedded from `assets/battery-level-{1,2,3}.png`; if the PNGs change, re-embed them into the script.
- Debug logging goes through `debug('...')`, which prints `console.debug('[PfG Companion] ...')` only when the `DEBUG` constant at the top of the script is `true` (the player flips it in the userscript manager's editor). Keep `DEBUG = false` in commits.
- The battery icon's tooltip (`levelTooltip()`) uses OGame's own tooltips: the icon has class `tooltipRight`, and `setIconTooltip()` calls the page's `changeTooltip()` via `unsafeWindow`, because OGame's `initTooltips()` has already run by the time the menu entry is added. It falls back to a plain `title`.
- The panel never opens on its own: only the menu entry opens it; after collection it is re-rendered only if already open.
- Commit messages are written in Russian.
- Source files use CRLF line endings.
