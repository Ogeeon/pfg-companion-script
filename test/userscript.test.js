// Runs the userscript in jsdom on a minimal game page with stubbed GM storage and fetch, and checks what lands in storage.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const USERSCRIPT = fs.readFileSync(path.join(__dirname, '..', 'src', 'pfg-companion.user.js'), 'utf8');
const GAME_URL = 'https://s1-en.ogame.gameforge.com/game/index.php?page=ingame&component=overview';
const SETTINGS_URL = 'https://s1-en.ogame.gameforge.com/game/index.php?page=ingame&component=resourcesettings';
const SNAPSHOTS_KEY = 'pfg-companion:snapshots:v1';
const PLAYER_ID = 337527;

/** @param {{ menu?: boolean, body?: string }} [options] */
const gamePage = ({ menu = false, body = '' } = {}) => `<!DOCTYPE html><html><head>
<meta name="ogame-universe" content="s1-en.ogame.gameforge.com"/>
<meta name="ogame-player-id" content="${PLAYER_ID}"/>
<meta name="ogame-planet-id" content="4431812"/>
</head><body>${menu ? '<ul id="menuTable"></ul>' : ''}${body}</body></html>`;

// Shaped like a real accountInfo response (uuids and names from a live account).
const buff = (itemUuid, name) => ({ itemUuid, name, rarity: 'common', buffStart: 1792295400, buffEnd: 1792907400, effectStart: 1792295400, effectEnd: 1792907400 });
const ACCOUNT_INFO = {
  playerId: PLAYER_ID,
  planets: {
    4431812: {
      id: 4431812,
      buffs: [
        buff('422db99aac4ec594d483d8ef7faadc5d40d6f7d3', 'Silver Crystal Booster'),
        buff('de922af379061263a56d7204d1c395cefcfb7d75', 'Bronze Metal Booster'),
        buff('5560a1580a0330e8aadf05cb5bfe6bc3200406e2', 'Gold Deuterium Booster'),
        buff('c2bad58fcec374d709099d11d0549e59ea7e233e', 'Energy Booster Silver'),
        buff('39bc9d493f9742a31c60ead18f57db9b81717845', 'Expedition Computer Bronze'),
      ],
      resources: { metal: 5628786, crystal: 5118889, deuterium: 4902319, energy: 1716 },
    },
    4431813: {
      id: 4431813,
      buffs: [
        buff('3c9f85221807b8d593fa5276cdf7af9913c4a35d', 'Bronze Crystal Booster'),
        buff('d9fa5f359e80ff4f4c97545d07c66dbadab1d1be', 'Bronze Deuterium Booster'),
      ],
      resources: { metal: 3411, crystal: 14201, deuterium: 16278, energy: 21 },
    },
    5171549: { id: 5171549, buffs: [], resources: { metal: 2961, crystal: 4451, deuterium: 600, energy: 0 } },
  },
  newAjaxToken: 'secret',
};
const PLANET_IDS = Object.keys(ACCOUNT_INFO.planets);

let store;
let writes;
let fetches;
let debugLines;
let accountInfo;
let tab;

// sessionStorage of one browser tab, shared by the pages loaded in it; a new tab is a new game session.
function newTab() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

beforeEach(() => {
  tab = newTab();
  store = {};
  writes = 0;
  fetches = 0;
  debugLines = [];
  accountInfo = structuredClone(ACCOUNT_INFO);
});

function fakeResponse(url) {
  if (String(url).includes('action=accountInfo')) return structuredClone(accountInfo);
  return { data: { bonus: 1 } };
}

/**
 * Loads a page, runs the userscript on it and reports what happened during that load.
 * @param {string} html
 * @param {{ url?: string, script?: string, persistent?: boolean, setup?: (w: any) => void, afterLoad?: (w: any) => void }} [options]
 */
async function runPage(html, { url = GAME_URL, script = USERSCRIPT, persistent = true, setup, afterLoad } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const w = dom.window;
  w.GM_getValue = (key, fallback) => (persistent && key in store ? structuredClone(store[key]) : fallback);
  w.GM_setValue = (key, value) => { writes++; if (persistent) store[key] = structuredClone(value); };
  w.GM_addValueChangeListener = () => {};
  w.GM_addStyle = () => {};
  w.structuredClone = structuredClone;
  w.console = { debug: (...args) => debugLines.push(args), log: console.log, error: console.error };
  w.fetch = async (requestUrl) => { fetches++; return { ok: true, json: async () => fakeResponse(requestUrl) }; };
  Object.defineProperty(w, 'sessionStorage', { value: tab, configurable: true });
  setup?.(w);
  const writesBefore = writes;
  const fetchesBefore = fetches;
  w.eval(script);
  // Let the collection promise chain settle.
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (afterLoad) {
    afterLoad(w);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const icon = w.document.getElementById('pfg-companion-icon');
  const result = {
    entry: Object.values(store[SNAPSHOTS_KEY] || {})[0],
    writes: writes - writesBefore,
    fetches: fetches - fetchesBefore,
    panelOpen: Boolean(w.document.getElementById('pfg-companion-panel')?.classList.contains('pfg-open')),
    panelText: w.document.getElementById('pfg-companion-panel')?.textContent ?? '',
    icon,
    iconTitle: icon?.getAttribute('title') ?? null,
  };
  w.close();
  return result;
}

test('stores resources and active items of every planet from accountInfo', async () => {
  const { entry, fetches: fetched } = await runPage(gamePage());
  assert.strictEqual(fetched, 2);
  assert.deepStrictEqual(Object.keys(entry.export.planets), PLANET_IDS);
  assert.strictEqual(entry.export.planets[4431813].resources.crystal, 14201);
  assert.strictEqual(entry.export.planets[4431812].buffs.length, 5, 'raw buffs are kept as the game sent them');
  assert.ok(!('newAjaxToken' in entry.export), 'the ajax token is stripped');
});

test('derives production boosters per planet, including bronze ones', async () => {
  const { entry } = await runPage(gamePage());
  const boosters = entry.export.pfgCompanion.productionBoosters;
  const summary = (planetId) => boosters[planetId].map(({ resource, tier }) => `${resource}:${tier}`);
  assert.deepStrictEqual(summary(4431812), ['crystal:silver', 'metal:bronze', 'deuterium:gold', 'energy:silver'], 'non-production items are left out');
  assert.deepStrictEqual(summary(4431813), ['crystal:bronze', 'deuterium:bronze']);
  assert.deepStrictEqual(boosters[5171549], []);
  assert.deepStrictEqual(boosters[4431812][0], {
    uuid: '422db99aac4ec594d483d8ef7faadc5d40d6f7d3',
    name: 'Silver Crystal Booster',
    resource: 'crystal',
    tier: 'silver',
    effectStart: 1792295400,
    effectEnd: 1792907400,
  });
});

test('fetches the account once per game session', async () => {
  await runPage(gamePage());
  accountInfo.planets[4431812].buffs = [];
  const sameSession = await runPage(gamePage());
  assert.strictEqual(sameSession.fetches, 0, 'no fetch on later page loads of the session');
  assert.strictEqual(sameSession.writes, 0);
  tab = newTab();
  const { entry: refreshed, fetches: fetched } = await runPage(gamePage());
  assert.strictEqual(fetched, 2, 'a new session fetches again');
  assert.deepStrictEqual(refreshed.export.pfgCompanion.productionBoosters[4431812], []);
});

test('does not retry a failed collection in the same session', async () => {
  const failing = { setup(w) { w.fetch = async () => { fetches++; return { ok: false, status: 500 }; }; } };
  const first = await runPage(gamePage(), failing);
  assert.strictEqual(first.fetches, 2);
  const second = await runPage(gamePage(), failing);
  assert.strictEqual(second.fetches, 0);
});

// Right after login the game answers speciesBonuses without data.
const speciesWithoutData = {
  setup(w) {
    const fetchWithData = w.fetch;
    w.fetch = async (url) => {
      if (!String(url).includes('action=speciesBonuses')) return fetchWithData(url);
      fetches++;
      return { ok: true, json: async () => ({ components: [] }) };
    };
  },
};

test('requests only speciesBonuses once more on the next page load when it came without data', async () => {
  const first = await runPage(gamePage(), speciesWithoutData);
  assert.strictEqual(first.fetches, 2);
  assert.strictEqual(first.entry.export.pfgCompanion.status.accountReady, false);
  const retried = await runPage(gamePage());
  assert.strictEqual(retried.fetches, 1, 'accountInfo is not requested again');
  assert.deepStrictEqual(retried.entry.export.speciesBonuses, { bonus: 1 });
  assert.strictEqual(retried.entry.export.pfgCompanion.status.accountReady, true);
  assert.strictEqual(retried.entry.collectedAt, first.entry.collectedAt, 'collectedAt stays the time of the accountInfo request');
  const later = await runPage(gamePage());
  assert.strictEqual(later.fetches, 0);
});

test('retries speciesBonuses only once per collection', async () => {
  await runPage(gamePage(), speciesWithoutData);
  const retried = await runPage(gamePage(), speciesWithoutData);
  assert.strictEqual(retried.fetches, 1);
  const later = await runPage(gamePage());
  assert.strictEqual(later.fetches, 0);
});

test('Refresh fetches the account again in the same session', async () => {
  await runPage(gamePage({ menu: true }));
  const { fetches: fetched } = await runPage(gamePage({ menu: true }), {
    afterLoad(w) {
      w.document.getElementById('pfg-companion-menu-btn').click();
      w.document.getElementById('pfg-refresh').click();
    },
  });
  assert.strictEqual(fetched, 2);
});

test('saving production factors does not fetch the account again', async () => {
  const first = await runPage(gamePage());
  const select = '<select name="productionFactor[1]"><option value="80" selected>80%</option></select>';
  const { entry, fetches: fetched, writes: written } = await runPage(gamePage({ body: select }), { url: SETTINGS_URL });
  assert.strictEqual(fetched, 0);
  assert.strictEqual(written, 1);
  assert.deepStrictEqual(entry.export.pfgCompanion.productionFactors[4431812], { 1: 80 });
  assert.strictEqual(entry.collectedAt, first.entry.collectedAt, 'collectedAt is not reset');
  assert.strictEqual(entry.export.pfgCompanion.productionBoosters[4431813].length, 2, 'boosters survive the update');
});

test('the panel shows the time of the last account request, not of the last change', async () => {
  await runPage(gamePage({ menu: true }));
  store[SNAPSHOTS_KEY][`en:1:${PLAYER_ID}`].collectedAt = '2020-01-02T12:00:00.000Z';
  const select = '<select name="productionFactor[1]"><option value="80" selected>80%</option></select>';
  const { panelText, entry } = await runPage(gamePage({ menu: true, body: select }), {
    url: SETTINGS_URL,
    afterLoad(w) { w.document.getElementById('pfg-companion-menu-btn').click(); },
  });
  assert.notStrictEqual(entry.export.exportedAt.slice(0, 4), '2020', 'saving production factors changed the snapshot');
  assert.match(panelText, /Last collection: [^\n]*2020/);
});

test('does not open the panel or log debug output by itself', async () => {
  const { panelOpen } = await runPage(gamePage({ menu: true }));
  assert.strictEqual(panelOpen, false);
  assert.deepStrictEqual(debugLines, []);
});

test('explains the battery level in the icon tooltip', async () => {
  const first = await runPage(gamePage({ menu: true }));
  assert.match(first.iconTitle, /^Account and planets are collected; .*missing for 3 planets\./);
  const entry = Object.values(store[SNAPSHOTS_KEY])[0];
  entry.export.pfgCompanion.productionFactors = Object.fromEntries(PLANET_IDS.map((id) => [id, { 1: 100 }]));
  const second = await runPage(gamePage({ menu: true }));
  assert.strictEqual(second.iconTitle, 'All profile data is collected.');
});

test('uses the game tooltip when OGame provides changeTooltip', async () => {
  const calls = [];
  const { icon, iconTitle } = await runPage(gamePage({ menu: true }), {
    persistent: false,
    setup(w) {
      w.unsafeWindow = w;
      // Mimics OGame: the title moves to data-tooltip-title once the tooltip is created.
      w.changeTooltip = (element, title) => {
        calls.push(title);
        element.removeAttribute('title');
        element.setAttribute('data-tooltip-title', title);
      };
    },
  });
  assert.ok(icon.classList.contains('tooltipRight'));
  assert.strictEqual(iconTitle, null);
  assert.deepStrictEqual(calls, ['Nothing collected yet.'], 'the tooltip is not re-created when the text does not change');
});

test('localizes the interface by the universe language and falls back to English', async () => {
  const ru = await runPage(gamePage({ menu: true }), { url: GAME_URL.replace('s1-en', 's1-ru'), persistent: false });
  assert.strictEqual(ru.iconTitle, 'Данные ещё не собраны.');
  const ba = await runPage(gamePage({ menu: true }), { url: GAME_URL.replace('s1-en', 's1-ba'), persistent: false });
  assert.strictEqual(ba.iconTitle, 'Još ništa nije prikupljeno.');
  const hu = await runPage(gamePage({ menu: true }), { url: GAME_URL.replace('s1-en', 's1-hu'), persistent: false });
  assert.strictEqual(hu.iconTitle, 'Nothing collected yet.');
});

test('every interface language has the same strings as English', async () => {
  let dictionaries;
  await runPage(gamePage(), {
    script: USERSCRIPT.replace('const LANGUAGE = interfaceLanguage();', 'const LANGUAGE = interfaceLanguage(); window.__I18N = I18N;'),
    persistent: false,
    setup(w) { Object.defineProperty(w, '__I18N', { set: (value) => { dictionaries = value; }, configurable: true }); },
  });
  assert.deepStrictEqual(Object.keys(dictionaries).sort(), ['bs', 'de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sk', 'tr']);
  for (const [language, strings] of Object.entries(dictionaries)) {
    assert.deepStrictEqual(Object.keys(strings).sort(), Object.keys(dictionaries.en).sort(), language);
  }
});

test('logs debug output when DEBUG is switched on', async () => {
  const withDebug = USERSCRIPT.replace('const DEBUG = false;', 'const DEBUG = true;');
  assert.notStrictEqual(withDebug, USERSCRIPT, 'DEBUG flag is present');
  await runPage(gamePage(), { script: withDebug, persistent: false });
  assert.ok(debugLines.length > 0);
  assert.ok(debugLines.every((args) => String(args[0]).startsWith('[PfG Companion] ')));
});
