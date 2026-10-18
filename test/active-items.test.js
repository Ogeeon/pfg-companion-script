// Runs the userscript in jsdom against trimmed overview pages and checks what lands in GM storage.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const USERSCRIPT = fs.readFileSync(path.join(__dirname, '..', 'src', 'pfg-companion.user.js'), 'utf8');
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const OVERVIEW = fixture('overview-boosters.html');
const OVERVIEW_BRONZE = fixture('overview-bronze-boosters.html');
const GAME_URL = 'https://s1-en.ogame.gameforge.com/game/index.php?page=ingame&component=overview';
const SNAPSHOTS_KEY = 'pfg-companion:snapshots:v1';
const PLAYER_ID = 337527;
const PLANET_IDS = ['4431812', '4431813'];

let store;
let writes;
let fetches;

beforeEach(() => {
  store = {};
  writes = 0;
  fetches = 0;
});

function fakeResponse(url) {
  if (String(url).includes('action=accountInfo')) {
    return { playerId: PLAYER_ID, planets: Object.fromEntries(PLANET_IDS.map((id) => [id, { id: Number(id), name: `P${id}` }])) };
  }
  return { data: { bonus: 1 } };
}

/** Loads a page, runs the userscript on it and returns the stored entry plus write/fetch counts for that load. */
async function runPage(html) {
  const dom = new JSDOM(html, { url: GAME_URL, runScripts: 'outside-only' });
  const w = dom.window;
  w.GM_getValue = (key, fallback) => (key in store ? structuredClone(store[key]) : fallback);
  w.GM_setValue = (key, value) => { writes++; store[key] = structuredClone(value); };
  w.GM_addValueChangeListener = () => {};
  w.GM_addStyle = () => {};
  w.structuredClone = structuredClone;
  w.console = { debug() {}, log: console.log, error: console.error };
  w.fetch = async (url) => { fetches++; return { ok: true, json: async () => fakeResponse(url) }; };
  const writesBefore = writes;
  const fetchesBefore = fetches;
  w.eval(USERSCRIPT);
  // Let the collection promise chain settle.
  await new Promise((resolve) => setTimeout(resolve, 50));
  w.close();
  return { entry: Object.values(store[SNAPSHOTS_KEY] || {})[0], writes: writes - writesBefore, fetches: fetches - fetchesBefore };
}

const activeItems = (entry, planetId) => entry.export.pfgCompanion.activeItems[planetId];
const removeItem = (html, uuid) => html.replace(new RegExp(`<div data-uuid="${uuid}"[\\s\\S]*?</a>\\s*</div>`), '');

test('stores active items of the current planet with booster info', async () => {
  const { entry, fetches: fetched } = await runPage(OVERVIEW);
  assert.strictEqual(fetched, 2);
  const stored = activeItems(entry, '4431812');
  assert.deepStrictEqual(stored.items.map((item) => [item.name, item.boost]), [
    ['Bronze Metal Booster', { resource: 'metal', tier: 'bronze' }],
    ['Silver Crystal Booster', { resource: 'crystal', tier: 'silver' }],
    ['Gold Deuterium Booster', { resource: 'deuterium', tier: 'gold' }],
    ['Energy Booster Silver', { resource: 'energy', tier: 'silver' }],
  ]);
  stored.items.forEach((item) => {
    assert.match(item.uuid, /^[0-9a-f]{40}$/);
    assert.strictEqual(item.totalDuration, 608400);
    assert.ok(Date.parse(item.expiresAt) > Date.now() + 600000 * 1000, 'about a week left');
  });
  assert.ok(!('4431813' in entry.export.pfgCompanion.activeItems), 'other planets are not touched');
});

test('recognises bronze boosters', async () => {
  const { entry } = await runPage(OVERVIEW_BRONZE);
  assert.deepStrictEqual(activeItems(entry, '4431813').items.map((item) => item.boost), [
    { resource: 'metal', tier: 'bronze' },
    { resource: 'crystal', tier: 'bronze' },
    { resource: 'deuterium', tier: 'bronze' },
  ]);
});

test('keeps items of each planet separately', async () => {
  await runPage(OVERVIEW);
  const { entry } = await runPage(OVERVIEW_BRONZE);
  assert.strictEqual(activeItems(entry, '4431812').items.length, 4);
  assert.strictEqual(activeItems(entry, '4431813').items.length, 3);
});

test('does not write when the items are unchanged', async () => {
  await runPage(OVERVIEW);
  const { writes: written, fetches: fetched } = await runPage(OVERVIEW);
  assert.strictEqual(fetched, 0, 'account fetch is throttled');
  assert.strictEqual(written, 0);
});

test('rewrites the list when an item is gone and keeps the collection throttle', async () => {
  const first = await runPage(OVERVIEW);
  const { entry, writes: written, fetches: fetched } = await runPage(removeItem(OVERVIEW, 'c2bad58fcec374d709099d11d0549e59ea7e233e'));
  assert.strictEqual(fetched, 0);
  assert.strictEqual(written, 1);
  assert.strictEqual(activeItems(entry, '4431812').items.length, 3);
  assert.strictEqual(entry.collectedAt, first.entry.collectedAt, 'collectedAt is not reset');
  assert.notStrictEqual(entry.export.exportedAt, first.entry.export.exportedAt);
});

test('stores an empty list when no items are active', async () => {
  await runPage(OVERVIEW);
  const empty = OVERVIEW.replace(/<ul class="active_items hidden">[\s\S]*?<\/ul>/, '<ul class="active_items hidden"><li></li></ul>');
  const { entry } = await runPage(empty);
  assert.deepStrictEqual(activeItems(entry, '4431812').items, []);
});

test('leaves stored items alone on a page without the item bar', async () => {
  await runPage(OVERVIEW);
  const { entry, writes: written } = await runPage(OVERVIEW.replace(/<buffBar[\s\S]*?<\/buffBar>/, ''));
  assert.strictEqual(written, 0);
  assert.strictEqual(activeItems(entry, '4431812').items.length, 4);
  assert.strictEqual(entry.export.playerId, PLAYER_ID);
  assert.ok(entry.export.speciesBonuses);
});
