// ==UserScript==
// @name         PfG Companion
// @namespace    https://proxyforgame.com/
// @version      0.1.0
// @description  Collect OGame account data while you play and make it available to ProxyForGame.
// @match        https://*.ogame.gameforge.com/game/index.php*
// @match        https://proxyforgame.com/*
// @match        https://www.proxyforgame.com/*
// @match        http://pfg.wmp/*
// @match        http://localhost:8000/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Set to true to print collection details to the browser console.
  const DEBUG = false;

  const SNAPSHOTS_KEY = 'pfg-companion:snapshots:v1';
  const PENDING_EXPORT_KEY = 'pfg_companion_pending_export';
  const COLLECTION_INTERVAL_MS = 5 * 60 * 1000;
  const EVENT_NAME = 'pfg-companion:sync';
  const GAME_COMPONENT = new URLSearchParams(location.search).get('component');
  const ON_GAME = location.hostname.endsWith('.ogame.gameforge.com');
  let CURRENT_PLAYER_ID = null;
  const LEVEL_ICONS = {
    1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEBcuDHp6LYgAAAG7SURBVEjHvVZLTgJBEH3VM8oghgghojFqXLjRrYnxFh7BtQdy7RG8hTFx7cZo/EQBIQGi8pvuLhfzA6YFxGEqmU+qa/rNe13VXQTfdvcPWEkXSZtlL+H5/o4AgPKbh3uFnH5USo5GseFLMvh4wpgPJt0+3p4eiGKM+B80fvkZhoY7cCG631/JacaGC4AQtveMBc1htm0b/cLyp2cdgWmtzHpb1kxgUkqjXysN9nSMwIQwT6qUSkhdD80GgI1yCYu0Sq0+tGYLNiKKmAV2enZuDL66vEC11jCObZRLE8eGy8lOg1kAmoqMYYm0mw1ge2tq4GDQn2tsBKzf7cwUWK+8gpnhOA56vV7o39newsf7S6zIpZTYGSMxs4zM3ioPA/21yFNJkNub63Cf5qPjk1TA0ilqISJmaaV+qnU2EUwIkR6Y1jpRwKkzcYJsxbKTBQAsZ7JmMK1jbOfOymwuz6Dg6CaAGFppL0+1OVH7velbXMZZCU9pSwiAyWu+VteK7OGxvzUFt9FjPa4rD/VvDJAnceezhVy+AKIo+KvdorDTK65vMhjQ7LdZ42A8VpUEgH3HL+/Cb5ia9SoBwA8BNLj4d4SodgAAAABJRU5ErkJggg==',
    2: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEBctN+Bcl28AAAGkSURBVEjHvVbNTsJAEP5mWwXEECFGJUaNBy96NTG+hY/g2Qfy7CP4FsbEsxejURMVhASICBZ2dzx02wJdfgKlk/Qnu9P59vs6szsEYwdHx6xkH0mb467g7emRAIAK5ZPDYl6/KCWHvdjyJVnGeMKcAZN9Dx+vz0QxRrwAjTGLYWj0e32I7m87Oc3YcgEQwvWfMac5zHVd67hwTHjWEZjWyq6348wEJqW0jmulwb6OEZgQ9qBKqYTU9dFcANjZ3sQy7ataG/hnSzYiipgFdnF5ZXW+vbmeOFep1q1zoWLmn7lpMAtAU5ExLJFWow7s7S4UpNfzZgPzup2FV/z9+R4rcikl9kdILEXGcUWeSoI83N+F+zSfnp2nApZOUQsRMUsr9VOts4lgQoj0wLTWiQJOjcQJshWr2RwAYDWTs4NpHWM7d1bm8gUGBUc3AcTQSvt5qu2J6v1N3+Iy2bXwlHaEAJj85mt9o8Q+HpsGJbgNH+txXXmgf2OAfIk7P03kC0UQRc7tVpPCTq+0VWYwoNm0WaNgPFKVBIDNwJh3YRqmRq1CAPAP6punHgPbUS0AAAAASUVORK5CYII=',
    3: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEBcsM/4qYjcAAAGDSURBVEjH3VZLTgJBEH1VM/IRQ4QYlZVx4Ua3JsZbeATXHsi1R/AWxsS1G6PRhVGDCRARRKarXMwPmAYMDr2wkvmkuqbfvNdV3UWIbGdvX00wRN7m+St4urslAKBq42C3VpEHY4LxKLV8SRafzhiLwILhAM+P90QZRvoHGlN+RiEYfg/B/c9ufpqp5QLA7IfPTNAC5vu+1c9eNL1KCiZi7Hp73q/AgiCw+sUINNQxBWO2T2qMyUndEM0HgO2tDSzTXt6aI2u2ZCOilFlsJ6dn1uDLi/OFx0bLyXfBLF4mJzImpdBpvbsDG/R77sBcyugkQW6ur5J9Wg+Pjp2AuSlq5pTZv0yQmWDM7A5MRHIFnDuT5siWC6UyAKBQLNvBRDJsF87KcqWqoPjoJoAUYiTMU7En6uBr/hZXLK0mp7THDCiFzdfael1DPI0alPg2fqxnddWR/k0BCiXufbRRqdZAlAZ3O21KOr36ZkOhgGjUZk2C6URVEgCNHFPeOWqYWs1XAoAf+zia+YGUmpsAAAAASUVORK5CYII=',
  };

  // Planet production boosters by item uuid (one uuid per duration). Bronze ones are not sold in the shop,
  // so their uuids were taken from the item bar of a planet where they were active.
  const PRODUCTION_ITEMS = {
    'de922af379061263a56d7204d1c395cefcfb7d75': { resource: 'metal', tier: 'bronze' }, // Bronze Metal Booster
    'ba85cc2b8a5d986bbfba6954e2164ef71af95d4a': { resource: 'metal', tier: 'silver' }, // Silver Metal Booster
    '742743b3b0ae1f0b8a1e01921042810b58f12f39': { resource: 'metal', tier: 'silver' }, // Silver Metal Booster
    '6f44dcd2bd84875527abba69158b4e976c308bbc': { resource: 'metal', tier: 'silver' }, // Silver Metal Booster
    '05294270032e5dc968672425ab5611998c409166': { resource: 'metal', tier: 'gold' }, // Gold Metal Booster
    '6fecb993169fe918d9c63cd37a2e541cc067664e': { resource: 'metal', tier: 'gold' }, // Gold Metal Booster
    '21c1a65ca6aecf54ffafb94c01d0c60d821b325d': { resource: 'metal', tier: 'gold' }, // Gold Metal Booster
    'a83cfdc15b8dba27c82962d57e50d8101d263cfb': { resource: 'metal', tier: 'platinum' }, // Platinum Metal Booster
    'c690f492cffe5f9f2952337e8eed307a8a62d6cf': { resource: 'metal', tier: 'platinum' }, // Platinum Metal Booster
    'ca7f903a65467b70411e513b0920d66c417aa3a2': { resource: 'metal', tier: 'platinum' }, // Platinum Metal Booster
    '3c9f85221807b8d593fa5276cdf7af9913c4a35d': { resource: 'crystal', tier: 'bronze' }, // Bronze Crystal Booster
    '422db99aac4ec594d483d8ef7faadc5d40d6f7d3': { resource: 'crystal', tier: 'silver' }, // Silver Crystal Booster
    '5b69663e3ba09a1fe77cf72c5094e246cfe954d6': { resource: 'crystal', tier: 'silver' }, // Silver Crystal Booster
    '04d8afd5936976e32ce894b765ea8bd168aa07ef': { resource: 'crystal', tier: 'silver' }, // Silver Crystal Booster
    '118d34e685b5d1472267696d1010a393a59aed03': { resource: 'crystal', tier: 'gold' }, // Gold Crystal Booster
    '36fb611e71d42014f5ebd0aa5a52bc0c81a0c1cb': { resource: 'crystal', tier: 'gold' }, // Gold Crystal Booster
    'd45f00e8b909f5293a83df4f369737ea7d69c684': { resource: 'crystal', tier: 'gold' }, // Gold Crystal Booster
    '35d96e441c21ef112a84c618934d9d0f026998fd': { resource: 'crystal', tier: 'platinum' }, // Platinum Crystal Booster
    '6bf45fcba8a6a68158273d04a924452eca75cf39': { resource: 'crystal', tier: 'platinum' }, // Platinum Crystal Booster
    '7c2edf40c5cd54ad11c6439398b83020c0a7a6be': { resource: 'crystal', tier: 'platinum' }, // Platinum Crystal Booster
    'd9fa5f359e80ff4f4c97545d07c66dbadab1d1be': { resource: 'deuterium', tier: 'bronze' }, // Bronze Deuterium Booster
    'e4b78acddfa6fd0234bcb814b676271898b0dbb3': { resource: 'deuterium', tier: 'silver' }, // Silver Deuterium Booster
    '26416a3cdb94613844b1d3ca78b9057fd6ae9b15': { resource: 'deuterium', tier: 'silver' }, // Silver Deuterium Booster
    '6f0952a919fd2ab9c009e9ccd83c1745f98f758f': { resource: 'deuterium', tier: 'silver' }, // Silver Deuterium Booster
    '5560a1580a0330e8aadf05cb5bfe6bc3200406e2': { resource: 'deuterium', tier: 'gold' }, // Gold Deuterium Booster
    '300493ddc756869578cb2888a3a1bc0c3c66765f': { resource: 'deuterium', tier: 'gold' }, // Gold Deuterium Booster
    'dc5896bed3311434224d511fa7ced6fdbe41b4e8': { resource: 'deuterium', tier: 'gold' }, // Gold Deuterium Booster
    '4b51d903560edd102467b110586000bd64fdb954': { resource: 'deuterium', tier: 'platinum' }, // Platinum Deuterium Booster
    '620f779dbffa1011aded69b091239727910a3d03': { resource: 'deuterium', tier: 'platinum' }, // Platinum Deuterium Booster
    '831c3ea8d868eb3601536f4d5e768842988a1ba9': { resource: 'deuterium', tier: 'platinum' }, // Platinum Deuterium Booster
    'c2bad58fcec374d709099d11d0549e59ea7e233e': { resource: 'energy', tier: 'silver' }, // Energy Booster Silver
    'bedd248aaf288c27e9351cfacfa6be03f1dbb898': { resource: 'energy', tier: 'silver' }, // Energy Booster Silver
    'e05aa5b9e3df5be3857b43da8403eafbf5ad3b96': { resource: 'energy', tier: 'silver' }, // Energy Booster Silver
    '55b52cbfb148ec80cd4e5b0580f7bed01149d643': { resource: 'energy', tier: 'gold' }, // Energy Booster Gold
    '4fa9a2273ee446284d5177fd9d60a22de01e932b': { resource: 'energy', tier: 'gold' }, // Energy Booster Gold
    '5ad783dcfce3655ef97b36197425718a0dad6b66': { resource: 'energy', tier: 'gold' }, // Energy Booster Gold
    '77c36199102e074dca46f5f26ef57ce824d044dd': { resource: 'energy', tier: 'platinum' }, // Energy Booster Platinum
    'dfe86378f8c3d7f3ee0790ea64603bc44e83ca47': { resource: 'energy', tier: 'platinum' }, // Energy Booster Platinum
    'c39aa972a971e94b1d9b4d7a8f734b3d8be12534': { resource: 'energy', tier: 'platinum' }, // Energy Booster Platinum
    '302b246f44585109ca5b3ed94178707d7d4c32c0': { resource: 'all', tier: 'bronze', percent: 15 }, // Resource Booster (15%) Bronze
    '828c11637d6177cf7369dddeffa63521d9f05c8c': { resource: 'all', tier: 'bronze', percent: 15 }, // Resource Booster (15%) Bronze
    'bfc5896632e0d809947dac4d8ced39ad7974f686': { resource: 'all', tier: 'bronze', percent: 20 }, // Resource Booster (20%) Bronze
    'beff9da8ce9ed2a03f73fb412347ef02adf4e9f4': { resource: 'all', tier: 'bronze', percent: 20 }, // Resource Booster (20%) Bronze
    'f76a859138dab12d181590ff46bb11d0be5b79bd': { resource: 'all', tier: 'bronze', percent: 25 }, // Resource Booster (25%) Bronze
    '4fa71c28e076fd5a5f1fdba2d83b9537e7557295': { resource: 'all', tier: 'bronze', percent: 25 }, // Resource Booster (25%) Bronze
    'be06b5c24ec29aadfe9e348ec022e698a5367dd0': { resource: 'all', tier: 'bronze', percent: 30 }, // Resource Booster (30%) Bronze
    '98fb2c053a8bd8608e9a307fe6f94e9b87754504': { resource: 'all', tier: 'bronze', percent: 30 }, // Resource Booster (30%) Bronze
    '370a7d4f976480fa054ef23068c442fc6e476301': { resource: 'all', tier: 'bronze', percent: 40 }, // Resource Booster (40%) Bronze
    '8cc0f382c3e6bb0751b42b8e9b9a0d3648313f25': { resource: 'all', tier: 'bronze', percent: 40 }, // Resource Booster (40%) Bronze
  };

  /** @param {string} message @param {...any} details */
  function debug(message, ...details) {
    if (DEBUG) console.debug(`[PfG Companion] ${message}`, ...details);
  }

  /** @returns {Record<string, any>} */
  function snapshots() {
    const saved = GM_getValue(SNAPSHOTS_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  /** @param {Record<string, any>} value */
  function saveSnapshots(value) {
    GM_setValue(SNAPSHOTS_KEY, value);
  }

  /** @returns {{number: number, language: string, host: string}|null} */
  function universe() {
    const match = location.hostname.match(/^s(\d+)-([a-z]{2,3})\.ogame\.gameforge\.com$/i);
    if (!match) return null;
    return { number: Number.parseInt(match[1], 10), language: match[2].toLowerCase(), host: location.hostname };
  }

  /** @param {number|string} playerId @param {{number: number, language: string}} uni */
  function accountKey(playerId, uni) {
    return `${uni.language}:${uni.number}:${playerId}`;
  }

  function currentPagePlayerId() {
    return document.querySelector('meta[name="ogame-player-id"]')?.content || null;
  }

  function activeEntry() {
    const uni = universe();
    const planetId = currentPlanetId();
    const pid = currentPagePlayerId();
    return Object.values(snapshots()).find((entry) => {
      if (!entry?.export || entry.export.universe?.host !== uni?.host) return false;
      if (pid && String(entry.export.playerId) !== String(pid)) return false;
      return !planetId || Boolean(entry.export.planets?.[planetId]);
    }) || null;
  }

  /** @param {any} response */
  function stripResponse(response) {
    if (!response || typeof response !== 'object') return response;
    const result = Array.isArray(response) ? response.slice() : { ...response };
    ['components', 'newAjaxToken', 'spaceObjects', 'static', 'speciesInformation'].forEach((key) => delete result[key]);
    return result;
  }

  /** @param {any} value */
  function stripDetails(value) {
    if (Array.isArray(value)) return value.map(stripDetails);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (key !== 'details') result[key] = stripDetails(entry);
    });
    return result;
  }

  /** @param {string} url */
  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
    return response.json();
  }

  /** @param {string} tooltip */
  function tooltipBody(tooltip) {
    const element = document.createElement('div');
    element.innerHTML = tooltip;
    return element.textContent || '';
  }

  /** @param {string} tooltip */
  function parseBodyTooltip(tooltip) {
    const text = tooltipBody(tooltip);
    const coords = text.match(/\[(\d+):(\d+):(\d+)\]/);
    const title = text.split('\n').find((line) => line.includes('[')) || '';
    const name = title.replace(/\s*\[\d+:\d+:\d+\].*$/, '').trim();
    const temperatures = [...text.matchAll(/(-?\d+)\s*°C/g)].map((match) => Number.parseInt(match[1], 10));
    const fields = text.match(/\((\d+)\s*\/\s*(\d+)\)/);
    const diameter = text.match(/([\d.,]+)\s*km/i);
    return {
      name,
      galaxy: coords ? Number.parseInt(coords[1], 10) : null,
      system: coords ? Number.parseInt(coords[2], 10) : null,
      position: coords ? Number.parseInt(coords[3], 10) : null,
      temperature: temperatures.length >= 2 ? { min: temperatures[0], max: temperatures[1] } : null,
      fields: fields ? { used: Number.parseInt(fields[1], 10), total: Number.parseInt(fields[2], 10) } : null,
      diameter: diameter ? Number.parseInt(diameter[1].replace(/[.,]/g, ''), 10) : null,
    };
  }

  function bodyDetailsFromMenu() {
    const planets = {};
    const moons = {};
    document.querySelectorAll('#planetList .smallplanet').forEach((node) => {
      const planetId = (node.id || '').match(/^planet-(\d+)$/)?.[1];
      const planetLink = node.querySelector('a.planetlink');
      if (planetId && planetLink) planets[planetId] = parseBodyTooltip(planetLink.getAttribute('data-tooltip-title') || '');
      const moonLink = node.querySelector('a.moonlink');
      const moonId = (moonLink?.getAttribute('href') || '').match(/[?&]cp=(\d+)/)?.[1];
      if (moonId && moonLink) moons[moonId] = { ...parseBodyTooltip(moonLink.getAttribute('data-tooltip-title') || ''), siblingId: Number(planetId) };
    });
    return { planets, moons };
  }

  /** @param {Record<string, any>} target @param {Record<string, any>} details */
  function mergeBodyDetails(target, details) {
    Object.entries(details).forEach(([id, extra]) => {
      if (!target[id] || !extra) return;
      if (extra.name) target[id].name = extra.name;
      ['galaxy', 'system', 'position', 'diameter'].forEach((key) => {
        if (extra[key] !== null) target[id][key] = extra[key];
      });
      if (extra.fields) target[id].fields = extra.fields;
      if (extra.temperature) target[id].temperature = extra.temperature;
      if (extra.siblingId) target[id].siblingId = extra.siblingId;
    });
  }

  /** @param {any} accountInfo @param {any} speciesBonuses @param {{number: number, language: string, host: string}} uni */
  function buildExport(accountInfo, speciesBonuses, uni) {
    const result = stripResponse(accountInfo);
    debug('buildExport: accountInfo keys=', result && typeof result === 'object' ? Object.keys(result).join(',') : 'invalid', 'playerId=', result?.playerId, 'planets=', result?.planets && typeof result.planets === 'object' ? Object.keys(result.planets).length : 0, 'speciesBonusesFetched=', !!speciesBonuses);
    const details = bodyDetailsFromMenu();
    if (result.planets && typeof result.planets === 'object') mergeBodyDetails(result.planets, details.planets);
    if (result.moons && typeof result.moons === 'object') mergeBodyDetails(result.moons, details.moons);
    const bonusResponse = stripResponse(speciesBonuses);
    if (bonusResponse?.data) result.speciesBonuses = stripDetails(bonusResponse.data);
    else debug('buildExport: speciesBonuses response has no data, keys=', bonusResponse && typeof bonusResponse === 'object' ? Object.keys(bonusResponse).join(',') : typeof bonusResponse);
    result.schemaVersion = 2;
    result.universe = uni;
    result.exportedAt = new Date().toISOString();
    return result;
  }

  /** @param {any} exportData */
  function collectionStatus(exportData) {
    if (!exportData || typeof exportData !== 'object') return { level: 1, accountReady: false, bodiesReady: false, missingProduction: [] };
    // Planets are keyed by id (the same key activeEntry() and production factors use), so rely on the key, not on planet.id.
    const planets = exportData.planets && typeof exportData.planets === 'object' ? Object.entries(exportData.planets).filter(([, planet]) => planet && typeof planet === 'object') : [];
    const factors = exportData.pfgCompanion?.productionFactors || {};
    const missingProduction = planets.filter(([id]) => !(id in factors))
      .map(([id, planet]) => ({ id, name: String(planet.name || ''), coords: [planet.galaxy, planet.system, planet.position].every(Number.isFinite) ? `${planet.galaxy}:${planet.system}:${planet.position}` : '' }));
    const accountReady = Number.isFinite(Number(exportData.playerId)) && !!exportData.speciesBonuses;
    const bodiesReady = planets.length > 0 && planets.every(([id]) => /^\d+$/.test(id));
    const level = !accountReady || !bodiesReady ? 1 : missingProduction.length ? 2 : 3;
    return { level, accountReady, bodiesReady, missingProduction };
  }

  /** @param {any} exportData @param {string} [collectedAt] time of the last account fetch, which drives the collection throttle */
  function persistExport(exportData, collectedAt = exportData?.exportedAt) {
    const uni = universe();
    debug('persistExport: playerId=', exportData?.playerId, 'playerIdValid=', Number.isFinite(Number(exportData?.playerId)), 'universe=', uni ? `${uni.language}:${uni.number}` : null, 'hasPlanets=', !!(exportData?.planets && typeof exportData.planets === 'object'));
    if (!uni || !Number.isFinite(Number(exportData.playerId))) return;
    const all = snapshots();
    const existing = all[accountKey(exportData.playerId, uni)]?.export || {};
    const productionFactors = { ...(existing.pfgCompanion?.productionFactors || {}), ...(exportData.pfgCompanion?.productionFactors || {}) };
    const activeItems = { ...(existing.pfgCompanion?.activeItems || {}), ...(exportData.pfgCompanion?.activeItems || {}) };
    const next = { ...exportData, pfgCompanion: { productionFactors, activeItems } };
    // A partial response must not erase data collected earlier.
    if (!next.speciesBonuses && existing.speciesBonuses) next.speciesBonuses = existing.speciesBonuses;
    const hasPlanets = (value) => value && typeof value === 'object' && Object.keys(value).length > 0;
    if (!hasPlanets(next.planets) && hasPlanets(existing.planets)) next.planets = existing.planets;
    next.pfgCompanion.status = collectionStatus(next);
    all[accountKey(next.playerId, uni)] = { collectedAt, export: next };
    saveSnapshots(all);
    return next;
  }

  async function collectAccount(force = false) {
    const uni = universe();
    if (!uni) {
      debug('collectAccount: universe not detected, aborting');
      return null;
    }
    debug('collectAccount: start, force=', force);
    const existing = activeEntry();
    if (existing) {
      debug('collectAccount: existing entry found, collectedAt=', existing.collectedAt, 'msSinceLastCollection=', Date.now() - Date.parse(existing.collectedAt));
      if (!force && Date.now() - Date.parse(existing.collectedAt) < COLLECTION_INTERVAL_MS) {
        debug('collectAccount: skipped, last collection within interval');
        return existing.export;
      }
    } else {
      debug('collectAccount: no existing snapshot entry, collecting fresh');
    }
    const base = '/game/index.php?page=componentOnly&component=externaldataexport';
    debug('collectAccount: fetching accountInfo and speciesBonuses');
    const [accountInfo, speciesBonuses] = await Promise.all([
      fetchJson(`${base}&action=accountInfo&asJson=1`),
      fetchJson(`${base}&action=speciesBonuses&asJson=1`),
    ]);
    debug('collectAccount: fetch resolved, accountInfo keys=', accountInfo && typeof accountInfo === 'object' ? Object.keys(accountInfo).join(',') : 'invalid', 'playerId=', accountInfo?.playerId, 'planets=', accountInfo?.planets && typeof accountInfo.planets === 'object' ? Object.keys(accountInfo.planets).length : 0, 'speciesBonuses=', !!speciesBonuses);
    const saved = persistExport(buildExport(accountInfo, speciesBonuses, uni));
    debug('collectAccount: persistExport finished, saved=', saved ? 'yes' : 'no');
    if (saved?.playerId) CURRENT_PLAYER_ID = String(saved.playerId);
    return saved;
  }

  function currentPlanetId() {
    const query = new URLSearchParams(location.search).get('cp');
    if (query && /^\d+$/.test(query)) return query;
    const selected = document.querySelector('#planetList .smallplanet.selected, #planetList .smallplanet.active');
    const fromList = (selected?.id || '').match(/^planet-(\d+)$/)?.[1];
    if (fromList) return fromList;
    const fromMeta = document.querySelector('meta[name="ogame-planet-id"]')?.content;
    return fromMeta && /^\d+$/.test(fromMeta) ? fromMeta : null;
  }

  function readProductionFactors() {
    if (String(GAME_COMPONENT || '').toLowerCase() !== 'resourcesettings') {
      debug('readProductionFactors: current component is not resourcesettings, skipping production factor lookup');
      return null;
    }
    const planetId = currentPlanetId();
    if (!planetId) return null;
    const factors = {};
    const desired = [1, 2, 3, 4, 12, 212, 217];
    const availableSelects = [...document.querySelectorAll('select[name^="productionFactor["]'), ...document.querySelectorAll('[data-ipi-hint*="Resourcesetting"] select')];
    debug('production factor selects found:', availableSelects.map((select) => `${select.name || select.closest('[data-ipi-hint]')?.getAttribute('data-ipi-hint') || '?'}=${select.value}`));
    desired.forEach((techId) => {
      const select =
        document.querySelector(`select[name="productionFactor[${techId}]"]`) ||
        document.querySelector(`[data-ipi-hint="ipiResourcesetting${techId}"] select`);
      if (!select) {
        debug('no selector for production factor', techId);
        return;
      }
      const value = Number.parseInt(select.value, 10);
      if (Number.isFinite(value)) factors[techId] = value;
      else debug('non-numeric value for production factor', techId, select.value);
    });
    return Object.keys(factors).length ? { planetId, factors } : null;
  }

  // Items active on the current planet, from the buff bar OGame renders in the page header.
  function readActiveItems() {
    const bar = document.getElementById('buffBar');
    const planetId = currentPlanetId();
    if (!bar || !planetId) {
      debug('readActiveItems: buff bar or planet id not found, skipping');
      return null;
    }
    const now = Date.now();
    const items = [...bar.querySelectorAll('.active_items [data-uuid]')].map((node) => {
      const uuid = node.getAttribute('data-uuid') || '';
      const durationNode = node.querySelector('.js_duration');
      const remaining = Number.parseInt(durationNode?.textContent || '', 10);
      const total = Number.parseInt(durationNode?.getAttribute('data-total-duration') || '', 10);
      return {
        uuid,
        name: node.querySelector('img')?.getAttribute('alt') || '',
        boost: PRODUCTION_ITEMS[uuid] || null,
        totalDuration: Number.isFinite(total) ? total : null,
        expiresAt: Number.isFinite(remaining) ? new Date(now + remaining * 1000).toISOString() : null,
      };
    }).filter((item) => /^[0-9a-f]{40}$/i.test(item.uuid));
    return { planetId, items };
  }

  function saveProductionFactors() {
    debug('saveProductionFactors: component=', GAME_COMPONENT, 'planetId=', currentPlanetId());
    const production = readProductionFactors();
    if (!production) debug('saveProductionFactors: no production factors available for current component/planet');
    else debug('saveProductionFactors: read', production);
    const active = readActiveItems();
    if (active) debug('saveProductionFactors: active items', active);
    if (!production && !active) return;
    const uni = universe();
    if (!uni) return;
    const entry = activeEntry();
    if (!entry?.export) return;
    const storedItems = active ? entry.export.pfgCompanion?.activeItems?.[active.planetId]?.items : null;
    const sameItems = (list) => Array.isArray(list) && list.map((item) => item.uuid).join() === active.items.map((item) => item.uuid).join();
    if (!production && sameItems(storedItems)) {
      debug('saveProductionFactors: active items unchanged, nothing to save');
      return;
    }
    const next = structuredClone(entry.export);
    next.exportedAt = new Date().toISOString();
    next.pfgCompanion ??= {};
    next.pfgCompanion.productionFactors ??= {};
    next.pfgCompanion.activeItems ??= {};
    if (production) next.pfgCompanion.productionFactors[production.planetId] = production.factors;
    // An empty list is stored too, so expired or removed items do not linger.
    if (active) next.pfgCompanion.activeItems[active.planetId] = { collectedAt: next.exportedAt, items: active.items };
    const saved = persistExport(next, entry.collectedAt);
    if (saved) debug('planet data saved', saved.pfgCompanion.productionFactors, saved.pfgCompanion.activeItems, 'status', saved.pfgCompanion.status);
  }

  /** @param {unknown} error */
  function recordError(error) {
    debug('recordError:', error);
    const entry = activeEntry();
    if (!entry?.export) return;
    const uni = universe();
    if (!uni) return;
    const all = snapshots();
    all[accountKey(entry.export.playerId, uni)] = {
      ...entry,
      error: { at: new Date().toISOString(), message: error instanceof Error ? error.message : 'Collection failed' },
    };
    saveSnapshots(all);
  }

  function panelText(exportData, status) {
    if (status.level === 3) return 'All profile data is collected.';
    if (status.level === 2) return '';
    if (!exportData) return 'Navigate to any OGame page to start collection of data.';
    const missing = [];
    if (!status.accountReady) missing.push('account data (player id or species bonuses)');
    if (!status.bodiesReady) missing.push('planet list');
    return `Missing: ${missing.join(', ')}. Press Refresh to collect again.`;
  }

  function addGameStyles() {
    GM_addStyle(`
      #pfg-companion-panel { position:fixed; inset:0 auto 0 0; z-index:100000; width:280px; padding:16px; box-sizing:border-box; color:#dcecff; background:#101926; border-right:1px solid #52769f; box-shadow:4px 0 24px #0009; font:12px Arial,sans-serif; transform:translateX(-100%); transition:transform .18s ease; overflow:auto; }
      #pfg-companion-panel.pfg-open { transform:translateX(0); }
      #pfg-companion-panel h2 { margin:0 0 12px; font-size:16px; color:#9bd1ff; }
      #pfg-companion-panel button { float:right; color:#cbdced; background:transparent; border:0; cursor:pointer; font-size:18px; }
      .pfg-battery { display:inline-flex; width:20px; height:11px; border:1px solid #98b5d0; border-radius:2px; padding:1px; vertical-align:middle; box-sizing:border-box; }
      .pfg-battery::after { content:''; width:2px; height:5px; align-self:center; margin-left:2px; background:#98b5d0; }
      .pfg-battery > span { display:block; height:100%; background:#70b7e8; }
      .pfg-battery > span { width:28%; } .pfg-battery[data-level="1"] > span { width:28% !important; } .pfg-battery[data-level="2"] > span { width:60% !important; } .pfg-battery[data-level="3"] > span { width:100% !important; }
      #pfg-companion-panel ul { padding-left:18px; line-height:1.5; } #pfg-companion-panel .pfg-muted { color:#91a6bb; }
      #pfg-companion-panel .pfg-actions { display:flex; gap:8px; margin-top:12px; } #pfg-companion-panel .pfg-actions button { float:none; background:#1a2a40; border:1px solid #52769f; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; color:#dcecff; }
      #pfg-companion-menu { cursor:pointer; }
      #pfg-companion-menu .menu_icon { display:inline-block; vertical-align:middle; margin-right:4px; }
      #pfg-companion-icon { display:inline-block; width:27px; height:27px; margin-left:4px; border:0; background:transparent; box-sizing:border-box; text-decoration:none; line-height:0; }
      #pfg-companion-icon:hover { background:transparent; }
      #pfg-companion-icon .pfg-level-icon { display:block; width:27px; height:27px; }
    `);
  }

  /** @param {any} exportData */
  function showPanel(exportData, collectionError = null) {
    const panel = document.getElementById('pfg-companion-panel');
    if (!panel) return;
    const status = collectionStatus(exportData);
    debug('showPanel: status', status);
    const collectedAt = exportData?.exportedAt ? new Date(exportData.exportedAt).toLocaleString() : 'Not collected yet';
    const missing = status.missingProduction?.length
      ? `<p>Missing production percentage data for the following planets:</p><ul>${status.missingProduction.map((planet) => `<li>${escapeHtml(planet.name || planet.id)} [${escapeHtml(planet.coords || '')}]</li>`).join('')}</ul>`
      : '';
    const error = collectionError ? `<p class="pfg-muted">Last error: ${escapeHtml(collectionError.message)} (${escapeHtml(new Date(collectionError.at).toLocaleString())})</p>` : '';
    panel.innerHTML = `<button type="button" aria-label="Close">×</button><h2>ProxyForGame companion</h2><p>${escapeHtml(panelText(exportData, status))}</p><p class="pfg-muted">Last collection: ${escapeHtml(collectedAt)}</p>${missing}${error}<div class="pfg-actions"><button type="button" id="pfg-refresh">Refresh</button><button type="button" id="pfg-clear">Clear data</button></div>`;
    panel.querySelector('button[aria-label="Close"]')?.addEventListener('click', () => panel.classList.remove('pfg-open'));
    panel.querySelector('#pfg-refresh')?.addEventListener('click', () => {
      debug('refresh clicked, forcing collection');
      void collectAccount(true).then(() => {
        debug('refresh flow: collection succeeded, saving production factors and refreshing UI');
        saveProductionFactors();
        refreshGameUi();
        const current = activeEntry();
        showPanel(current?.export, current?.error || null);
      }).catch((err) => {
        debug('refresh flow: collection failed:', err);
        recordError(err);
        refreshGameUi();
        const current = activeEntry();
        showPanel(current?.export, current?.error || null);
      });
    });
    panel.querySelector('#pfg-clear')?.addEventListener('click', () => {
      const uni = universe();
      const entry = activeEntry();
      const all = snapshots();
      if (entry?.export?.playerId && uni) {
        delete all[accountKey(entry.export.playerId, uni)];
      } else {
        Object.keys(all).forEach((key) => delete all[key]);
      }
      saveSnapshots(all);
      refreshGameUi();
      showPanel(activeEntry()?.export || null, null);
    });
    panel.classList.add('pfg-open');
  }

  /** @param {string} value */
  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
  }

  function installGameUi() {
    addGameStyles();
    const panel = document.createElement('aside');
    panel.id = 'pfg-companion-panel';
    document.body.append(panel);
    const menu = document.getElementById('menuTable');
    if (!menu || document.getElementById('pfg-companion-menu')) return;
    const entry = document.createElement('li');
    entry.id = 'pfg-companion-menu';
    const status = collectionStatus(activeEntry()?.export);
    entry.innerHTML = `
      <span class="menu_icon">
        <a id="pfg-companion-icon" href="#" target="_self" style="display:block;line-height:0;text-decoration:none;">
          <img class="pfg-level-icon" src="${LEVEL_ICONS[status.level] || LEVEL_ICONS[1]}" alt="PfG Companion status" width="27" height="27">
        </a>
      </span>
      <a class="menubutton" href="#" id="pfg-companion-menu-btn"><span class="textlabel">PfG Companion</span></a>
    `;
    const openPanel = (event) => {
      event.preventDefault();
      const panel = document.getElementById('pfg-companion-panel');
      if (panel?.classList.contains('pfg-open')) {
        panel.classList.remove('pfg-open');
        return;
      }
      const current = activeEntry();
      showPanel(current?.export, current?.error || null);
    };
    entry.querySelector('#pfg-companion-icon')?.addEventListener('click', openPanel);
    entry.querySelector('#pfg-companion-menu-btn')?.addEventListener('click', openPanel);
    menu.append(entry);
    refreshGameUi();
  }

  function refreshGameUi() {
    const status = collectionStatus(activeEntry()?.export);
    const iconSrc = LEVEL_ICONS[status.level] || LEVEL_ICONS[1];
    document.querySelectorAll('#pfg-companion-menu .pfg-level-icon').forEach((icon) => icon.setAttribute('src', iconSrc));
  }

  function handOffToSite() {
    const all = snapshots();
    const exports = Object.values(all).map((entry) => entry?.export).filter(Boolean);
    if (!exports.length) return;
    const payload = { version: 1, exports };
    localStorage.setItem(PENDING_EXPORT_KEY, JSON.stringify(payload));
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  }

  if (ON_GAME) {
    debug('game component:', GAME_COMPONENT, 'url:', location.href);
    installGameUi();
    // The panel opens only on click; if the player opened it while collection was running, show fresh data.
    const updateOpenPanel = () => {
      if (!document.getElementById('pfg-companion-panel')?.classList.contains('pfg-open')) return;
      const current = activeEntry();
      showPanel(current?.export, current?.error || null);
    };
    void collectAccount().then(() => {
      debug('collection flow: collectAccount resolved, saving production factors and refreshing UI');
      saveProductionFactors();
      refreshGameUi();
      updateOpenPanel();
    }).catch((error) => {
      debug('collection flow: collectAccount FAILED:', error);
      recordError(error);
      refreshGameUi();
      updateOpenPanel();
    });
  } else {
    handOffToSite();
    GM_addValueChangeListener(SNAPSHOTS_KEY, () => handOffToSite());
  }
}());
