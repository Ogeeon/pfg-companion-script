# PfG Companion

PfG Companion is a userscript for OGame and ProxyForGame. It reads an account snapshot only while the player has an OGame page open, stores the snapshot in the userscript manager, and makes it available to ProxyForGame when the site is opened.

## Behaviour

- Collects no more than once every five minutes per OGame account.
- Never changes the selected planet, opens a game page, or runs a background polling loop.
- Reads production factors only when the player has opened Resource Settings for that planet.
- Adds a `PfG Companion` entry to the OGame menu. Its battery indicator shows whether account, bodies, and production settings have been collected. The panel explains every missing part and shows the time of the last collection.
- Keeps snapshots in the userscript manager, separated by universe and player id. The script writes no account data to a ProxyForGame server.

## Site hand-off contract

On a ProxyForGame page, the script writes the latest snapshot to local storage under `pfg_companion_pending_export` and emits the `pfg-companion:sync` document event. The site should validate the JSON with its existing profile export parser before applying it.

The snapshot is compatible with the account-export format consumed by `profiles-core.js` and uses schema version 2. It adds an optional `pfgCompanion` block containing collection status and per-planet production factors.

## Local development

Install the script file at `src/pfg-companion.user.js` in Tampermonkey or Violentmonkey. The metadata also matches `http://pfg.wmp/*` and `http://localhost:8000/*` for local ProxyForGame development.

Run `npm run check` to syntax-check the userscript.
