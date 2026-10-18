# PfG Companion

PfG Companion is a userscript for OGame and ProxyForGame. It reads an account snapshot only while the player has an OGame page open, stores the snapshot in the userscript manager, and makes it available to ProxyForGame when the site is opened.

## Behaviour

- Requests the account from OGame (`accountInfo` and `speciesBonuses`) once per game session — on the first game page load in a browser tab — and afterwards only when the player presses "Refresh" in the panel. Every such request marks the player active and refreshes the highscore, so the script does not repeat it on its own, not even after a failed attempt.
- Never changes the selected planet, opens a game page, or runs a background polling loop.
- Reads production factors only when the player has opened Resource Settings for that planet.
- Adds a `PfG Companion` entry to the OGame menu. Its battery indicator shows whether account, bodies, and production settings have been collected. The panel explains every missing part and shows the time of the last collection.
- Keeps snapshots in the userscript manager, separated by universe and player id. The script writes no account data to a ProxyForGame server.

## Stored data

The userscript manager keeps a single value, `pfg-companion:snapshots:v1`: an object with one entry per account, keyed `<lang>:<uniNumber>:<playerId>` (for example `ru:135:123456`). Each entry is `{ collectedAt, export, error? }`:

- `collectedAt` — ISO time of the last `accountInfo` fetch. Saving production factors does not change it.

The tab's `sessionStorage` on the game page holds `pfg-companion:collected` — the id of the player whose account was already requested in this tab.
- `export` — the snapshot described below.
- `error` — `{ at, message }` of the last failed collection; it is dropped by the next successful save.

The snapshot is OGame's `accountInfo` response without the bulky `components`, `newAjaxToken`, `spaceObjects`, `static` and `speciesInformation` keys, plus:

- name, coordinates, temperature, fields and diameter of planets and moons, read from the planet list tooltips;
- `speciesBonuses` — the `data` of OGame's `speciesBonuses` response without `details`;
- `schemaVersion: 2`, `universe: { number, language, host }` and `exportedAt` (ISO time of the last change);
- the `pfgCompanion` block (see below).

If a later response lacks `speciesBonuses` or planets, the previously stored ones are kept. The panel's "Clear data" button removes the entry of the current account (all entries if the current account has none).

## Site hand-off contract

On a ProxyForGame page, the script writes all stored snapshots to local storage under `pfg_companion_pending_export` as `{ version: 1, exports: [snapshot, ...] }` and emits the `pfg-companion:sync` document event with the same object in `detail`. It repeats this whenever the stored snapshots change. The site should validate the JSON with its existing profile export parser before applying it.

The snapshot is compatible with the account-export format consumed by `profiles-core.js` and uses schema version 2. Planet resources, production and active items (`planets[id].resources`, `production`, `buffs`) come as part of OGame's `accountInfo`. The snapshot adds an optional `pfgCompanion` block:

- `productionFactors[planetId] = { [techId]: percent }` — production percentages from Resource Settings for metal mine (1), crystal mine (2), deuterium synthesizer (3), solar plant (4), fusion reactor (12), solar satellites (212) and crawlers (217). Factors of different planets accumulate across visits.
- `productionBoosters[planetId] = [{ uuid, name, resource, tier, percent?, effectStart, effectEnd }]` — production boosters derived from `buffs`, where `resource` is `metal`, `crystal`, `deuterium`, `energy` or `all` and the times are Unix seconds. The site should ignore boosters whose `effectEnd` has passed.
- `status = { level, accountReady, bodiesReady, missingProduction: [{ id, name, coords }] }` — collection completeness: level 1 means account or bodies are missing, 2 means some planets lack production factors, 3 means complete.

## Installation

Open https://proxyforgame.com/companion/pfg-companion.user.js with Tampermonkey or Violentmonkey installed. The userscript manager checks `pfg-companion.meta.js` next to it for a newer `@version` and updates the script from there.

## Releasing

1. Raise `@version` in `src/pfg-companion.user.js` — userscript managers update only when it grows.
2. Commit and push.
3. Run `npm run deploy`: it builds `dist/` (`npm run build`: the script and its metadata block) and copies both files over SSH (host alias `vdsina`) to `/var/www/pfg-companion/` on the site's host, served as `/companion/` with `Cache-Control: no-cache`. The directory is outside the site checkout, so site deploys do not touch it.

## Local development

Install the script file at `src/pfg-companion.user.js` in Tampermonkey or Violentmonkey.

Run `npm run check` to syntax-check the userscript and `npm test` (after `npm install`) to run the jsdom tests.
