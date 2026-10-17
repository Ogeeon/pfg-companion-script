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
    console.debug('[PfG Companion] buildExport: accountInfo keys=', result && typeof result === 'object' ? Object.keys(result).join(',') : 'invalid', 'playerId=', result?.playerId, 'planets=', result?.planets && typeof result.planets === 'object' ? Object.keys(result.planets).length : 0, 'speciesBonusesFetched=', !!speciesBonuses);
    const details = bodyDetailsFromMenu();
    if (result.planets && typeof result.planets === 'object') mergeBodyDetails(result.planets, details.planets);
    if (result.moons && typeof result.moons === 'object') mergeBodyDetails(result.moons, details.moons);
    const bonusResponse = stripResponse(speciesBonuses);
    if (bonusResponse?.data) result.speciesBonuses = stripDetails(bonusResponse.data);
    result.schemaVersion = 2;
    result.universe = uni;
    result.exportedAt = new Date().toISOString();
    return result;
  }

  /** @param {any} exportData */
  function collectionStatus(exportData) {
    const planets = exportData.planets && typeof exportData.planets === 'object' ? Object.values(exportData.planets) : [];
    const factors = exportData.pfgCompanion?.productionFactors || {};
    const missingProduction = planets.filter((planet) => planet && planet.id != null && !(String(planet.id) in factors))
      .map((planet) => ({ id: String(planet.id), name: String(planet.name || ''), coords: [planet.galaxy, planet.system, planet.position].every(Number.isFinite) ? `${planet.galaxy}:${planet.system}:${planet.position}` : '' }));
    const accountReady = Number.isFinite(Number(exportData.playerId)) && !!exportData.speciesBonuses;
    const bodiesReady = planets.length > 0 && planets.every((planet) => planet && Number.isFinite(Number(planet.id)));
    const level = !accountReady || !bodiesReady ? 1 : missingProduction.length ? 2 : 3;
    return { level, accountReady, bodiesReady, missingProduction };
  }

  /** @param {any} exportData */
  function persistExport(exportData) {
    const uni = universe();
    console.debug('[PfG Companion] persistExport: playerId=', exportData?.playerId, 'playerIdValid=', Number.isFinite(Number(exportData?.playerId)), 'universe=', uni ? `${uni.language}:${uni.number}` : null, 'hasPlanets=', !!(exportData?.planets && typeof exportData.planets === 'object'));
    if (!uni || !Number.isFinite(Number(exportData.playerId))) return;
    const all = snapshots();
    const existing = all[accountKey(exportData.playerId, uni)]?.export || {};
    const productionFactors = { ...(existing.pfgCompanion?.productionFactors || {}), ...(exportData.pfgCompanion?.productionFactors || {}) };
    const next = { ...exportData, pfgCompanion: { productionFactors } };
    next.pfgCompanion.status = collectionStatus(next);
    all[accountKey(next.playerId, uni)] = { collectedAt: next.exportedAt, export: next };
    saveSnapshots(all);
    return next;
  }

  async function collectAccount(force = false) {
    const uni = universe();
    if (!uni) {
      console.debug('[PfG Companion] collectAccount: universe not detected, aborting');
      return null;
    }
    console.debug('[PfG Companion] collectAccount: start, force=', force);
    const existing = activeEntry();
    if (existing) {
      console.debug('[PfG Companion] collectAccount: existing entry found, collectedAt=', existing.collectedAt, 'msSinceLastCollection=', Date.now() - Date.parse(existing.collectedAt));
      if (!force && Date.now() - Date.parse(existing.collectedAt) < COLLECTION_INTERVAL_MS) {
        console.debug('[PfG Companion] collectAccount: skipped, last collection within interval');
        return existing.export;
      }
    } else {
      console.debug('[PfG Companion] collectAccount: no existing snapshot entry, collecting fresh');
    }
    const base = '/game/index.php?page=componentOnly&component=externaldataexport';
    console.debug('[PfG Companion] collectAccount: fetching accountInfo and speciesBonuses');
    const [accountInfo, speciesBonuses] = await Promise.all([
      fetchJson(`${base}&action=accountInfo&asJson=1`),
      fetchJson(`${base}&action=speciesBonuses&asJson=1`),
    ]);
    console.debug('[PfG Companion] collectAccount: fetch resolved, accountInfo keys=', accountInfo && typeof accountInfo === 'object' ? Object.keys(accountInfo).join(',') : 'invalid', 'playerId=', accountInfo?.playerId, 'planets=', accountInfo?.planets && typeof accountInfo.planets === 'object' ? Object.keys(accountInfo.planets).length : 0, 'speciesBonuses=', !!speciesBonuses);
    const saved = persistExport(buildExport(accountInfo, speciesBonuses, uni));
    console.debug('[PfG Companion] collectAccount: persistExport finished, saved=', saved ? 'yes' : 'no');
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
      console.debug('[PfG Companion] readProductionFactors: current component is not resourcesettings, skipping production factor lookup');
      return null;
    }
    const planetId = currentPlanetId();
    if (!planetId) return null;
    const factors = {};
    const desired = [1, 2, 3, 4, 12, 212, 217];
    const availableSelects = [...document.querySelectorAll('select[name^="productionFactor["]'), ...document.querySelectorAll('[data-ipi-hint*="Resourcesetting"] select')];
    console.debug('[PfG Companion] production factor selects found:', availableSelects.map((select) => `${select.name || select.closest('[data-ipi-hint]')?.getAttribute('data-ipi-hint') || '?'}=${select.value}`));
    desired.forEach((techId) => {
      const select =
        document.querySelector(`select[name="productionFactor[${techId}]"]`) ||
        document.querySelector(`[data-ipi-hint="ipiResourcesetting${techId}"] select`);
      if (!select) {
        console.debug('[PfG Companion] no selector for production factor', techId);
        return;
      }
      const value = Number.parseInt(select.value, 10);
      if (Number.isFinite(value)) factors[techId] = value;
      else console.debug('[PfG Companion] non-numeric value for production factor', techId, select.value);
    });
    return Object.keys(factors).length ? { planetId, factors } : null;
  }

  function saveProductionFactors() {
    console.debug('[PfG Companion] saveProductionFactors: component=', GAME_COMPONENT, 'planetId=', currentPlanetId());
    const production = readProductionFactors();
    if (!production) {
      console.debug('[PfG Companion] saveProductionFactors: no production factors available for current component/planet');
      return;
    }
    console.debug('[PfG Companion] saveProductionFactors: read', production);
    const uni = universe();
    if (!uni) return;
    const entry = activeEntry();
    if (!entry?.export) return;
    const next = structuredClone(entry.export);
    next.exportedAt = new Date().toISOString();
    next.pfgCompanion ??= { productionFactors: {} };
    next.pfgCompanion.productionFactors ??= {};
    next.pfgCompanion.productionFactors[production.planetId] = production.factors;
    const saved = persistExport(next);
    if (saved) console.debug('[PfG Companion] production factors saved', saved.pfgCompanion.productionFactors, 'status', saved.pfgCompanion.status);
  }

  /** @param {unknown} error */
  function recordError(error) {
    console.debug('[PfG Companion] recordError:', error);
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

  function panelText(status) {
    if (status.level === 3) return 'All profile data is collected.';
    if (status.level === 2) return '';
    return 'Navigate to any OGame page to start collection of data.';
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
    const status = exportData?.pfgCompanion?.status || { level: 1, missingProduction: [] };
    const collectedAt = exportData?.exportedAt ? new Date(exportData.exportedAt).toLocaleString() : 'Not collected yet';
    const factors = exportData?.pfgCompanion?.productionFactors && typeof exportData.pfgCompanion.productionFactors === 'object' ? exportData.pfgCompanion.productionFactors : {};
    const factorText = Object.entries(factors).map(([planetId, values]) => {
      const planetName = exportData?.planets?.[planetId]?.name || planetId;
      const valuesText = Object.entries(values || {}).map(([techId, value]) => `${techId}: ${value}%`).join(', ');
      return `${escapeHtml(String(planetName))}: ${escapeHtml(valuesText || 'none')}`;
    }).join('<br>');
    const missing = status.missingProduction?.length
      ? `<p>Missing production percentage data for the following planets:</p><ul>${status.missingProduction.map((planet) => `<li>${escapeHtml(planet.name || planet.id)} [${escapeHtml(planet.coords || '')}]</li>`).join('')}</ul>`
      : '';
    const factorsInfo = Object.keys(factors).length
      ? `<p class="pfg-muted">Stored production factors:<br>${factorText}</p>`
      : `<p class="pfg-muted">No production factors stored yet.</p>`;
    const error = collectionError ? `<p class="pfg-muted">Last error: ${escapeHtml(collectionError.message)} (${escapeHtml(new Date(collectionError.at).toLocaleString())})</p>` : '';
    panel.innerHTML = `<button type="button" aria-label="Close">×</button><h2>ProxyForGame companion</h2><p>${panelText(status)}</p><p class="pfg-muted">Last collection: ${escapeHtml(collectedAt)}</p>${factorsInfo}${missing}${error}<div class="pfg-actions"><button type="button" id="pfg-refresh">Refresh</button><button type="button" id="pfg-clear">Clear data</button></div>`;
    panel.querySelector('button[aria-label="Close"]')?.addEventListener('click', () => panel.classList.remove('pfg-open'));
    panel.querySelector('#pfg-refresh')?.addEventListener('click', () => {
      console.debug('[PfG Companion] refresh clicked, forcing collection');
      void collectAccount(true).then(() => {
        console.debug('[PfG Companion] refresh flow: collection succeeded, saving production factors and refreshing UI');
        saveProductionFactors();
        refreshGameUi();
        const current = activeEntry();
        showPanel(current?.export, current?.error || null);
      }).catch((err) => {
        console.debug('[PfG Companion] refresh flow: collection failed:', err);
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
    const status = activeEntry()?.export?.pfgCompanion?.status || { level: 1 };
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
    const status = activeEntry()?.export?.pfgCompanion?.status || { level: 1 };
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
    console.debug('[PfG Companion] game component:', GAME_COMPONENT, 'url:', location.href);
    installGameUi();
    void collectAccount().then(() => {
      console.debug('[PfG Companion] collection flow: collectAccount resolved, saving production factors and refreshing UI');
      saveProductionFactors();
      refreshGameUi();
      const current = activeEntry();
      showPanel(current?.export, current?.error || null);
    }).catch((error) => {
      console.debug('[PfG Companion] collection flow: collectAccount FAILED:', error);
      recordError(error);
      refreshGameUi();
      const current = activeEntry();
      showPanel(current?.export, current?.error || null);
    });
  } else {
    handOffToSite();
    GM_addValueChangeListener(SNAPSHOTS_KEY, () => handOffToSite());
  }
}());
