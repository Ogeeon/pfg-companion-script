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
    1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEA04H/Pt/ycAAAPlSURBVEjHvZbfbhtFFMZ/Z3bs3Y2DHSdNm4qihra0qFAEUhESj8Ib8AyIGyQehCsegjsuK9EKVCograCtSkrtNH/sxNk/cw4Xu16nidsiNWIkS7tzds43853vfGMB6J7/QPqLpqEsOO0R+RYPN+4JgAPod/QkkM35zRuvitXj7fXLBiAX37tuLwDZGxxD5m/GUIq8wE32x6fH2UvYcM7T0Phaql4zvPdz511UpzedgamG+cWNov8EVpbl3HkNilU8zsCcm580hHBK7FZozfmdc8Rxm3arTRQ5zKqCiwim1ghgulsRIYoiNARAEKmYKMuS3b0RZidr4gF8FNHp9ng6HBHCXgVgIFMwmxZWmiRVzKGq9bvgxJEkMefOrDIYDjCzSqBSydQncUx/eYVHT7fxS8uc//AmzntQUDWKLKfYPwQrCXlJMTlAywJBEBdhWtYiqHa/v/2Ezedjzq+uMhgMqvk65k1iHm5u0eot8emX3xCf/QgLhggojq37P7F56wfGj38hlAHND9EQ8PEicW+N/Wf3G9m7Vkxv/RN2Htzi2fYB/aUeRZ5jZpgFvNEmzydcvPExvSs3GW8bqKJm4CKy8Zjx4w12/7r7QtP7tAsmHA4fHVODEffW2Hv2AI1WwGJCPqHfXcFDiQg438L5CJ+AqSFWcS0OMAWrDMLmdrE071pkuFZMsnqBa198RSuNuPvdt5T5Hj5oQM1Qkyp5dKQnRHBOKrUddSR50aPkxLPgWinJmSskSwnSTgiTHfzkIKs3aLNF7kgCqUDt+IEQpFbZPOMJ+YTx5n3yUZuQHVKWJT5JWhSTQ0KZ4URxLkLVpvmahLPNy0x6c5zXtVMwI9t6wsb3XyMiFPsj4rbgO6kn14S/f77N+q8/0rv6OUEFrRfHCylJf43y4FKDYWb4uEPcXaPMxw2o823SlXfY/fM23e5bxOVz8iyDEBgMd5CFhQVbv3yNf3ZzJE3pX7pa9U/dO8V+RrY3wsqCprdrAxJxmAam0jEz8tGQbuLpRBm//3avOr9zmGr1VRRFvH/9BjsTIwSt6uEEU1ATnJuKTmtaDQ21izghBEWDUZQl3cWUNMr4owY6ft019T177hytVrsJaGNNlU2JzISjqpVa65iqomqUoWBrOHzp3frSW8y5mfedxnCvCqoqzrn/B2xeD70JuGsnKQDtOJ0PdozGN6FV0k63MsKmiw0NOlXI3EXZ4cFrE8fJQnNLR86B1eJaXFq2Cs9md9ORm9aOknnCt2YmXLk2HIx26HT7iMw+bnffjTxAtHDBReVAsanc7SSYHdOuAFZPHHvuLZ8FDDf9wxSvffb88R39F7X19gQWHU8JAAAAAElFTkSuQmCC',
    2: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEA05B/maVjAAAAP9SURBVEjHvZbbbhxFEIa/6u6dg+3seuM4ThARNkQJp0QgJTc8Cm/AMyBukHgQrngMEHdBIgIpoACJLCJCTHYdn9Zez850FRcze0i8MYhYlDSama7p+rvr/6t6pH35PQFud5fsTqxKztp8aLEzkA3gkQOku6gngWzONc9O8zV2Lj3eFJFbobtkMVbV85M5JfBpPjk5HMt6Eyn7d9zwcHB2OXtJNpwL9f3ER//BQghzx51vwptOwVTjfHK9/1dg1SwNM6ZRMWy6w3qb84PGGM8ouzXaZP/OOdI0IWkleO+whnARwbRZmkxXKyJ479EYAUGkzkRVVeztH2B2kpMAELxnsd1hq39AjPs1gIGMwWwqt3GQ2udQ1eZdcOLIspS1C6v0+j3MrBao1DINWZrSPb/Co60dwvJ5Lr9/CxcCKKgaZTEijgwfPLGMVMMhWlVoLNGywGLZiKBe/eHOY548G3B5dZVer1ePN75gkvL7k21anWVuf/I56cWbWDREQHFsP/gekZzOlXdqkLIkmtG/9w29H75msHV/InvXSumsf8juw+94unNEd7lDORphZphFgpEwGg1548YHdK7eYrBjoIqagfMUgwHeKxICzjkkSXDOo1ZS7G5x3H/0ghqMtHOJ/acPUb8ClhJHQ7rtFQJUiIALLVzwhAxMDbE61+LAOcFnTWobDpwb8zfbOgwtC1wrJVt9nesff0or99z78guq0T4hakTNUJM6uJ+piSaoOEG8YFKHFZGG8xpo2qXGz4Jr5WQXrpItZ0iSEYe7hOFR0XQPm05yMwGk2SECrn61ZiHSqGxe44mjIYMnDxgdJMTimKqqCFnWohweE6sCJ1rzoU0ZynQX4uqoNpH9tNs916KSHMwoth/z21efISKUhwekiRAW88BIM/788S7rP31L59pHRJWaGyBdyImFEQd7RJ1UG0486fIaVbE+4cyFhHzlCnubd2m3z5FWzxgVBcRIr7+LLCws2Ppb1/lrb4TkOd03ryHOjzNLeVhQHhV1cU+atqFVicYS08g4uWbG6KBPOwss+oJf7v9cM+Ecplp/5b3n7XdvsDs0YtSaaCeYgprg3FgL2vBkaGzS6YQYFY1GWVW0l3JyX/BrAzRrMsvvxbU1Wq1k4tBJa6plLjIVjqrWam18qoqqUcWS7X5/bkOW004x56a97yzMneZUVZxz/w/YvBp6FXCXZDkASZrPB3shja+SVskX23UjnFSxoVHHCpk7qTg++sfAabYwOaW9c2BCSDrrG/Hoj80az5pUNUXmnz/Wx3ldWOrM+X+zps3A0cEuIUkRmc5L2hsb0nntpgBv+Kq3iY3lbtPTcAxmL2hXAGsGXvLsxj9M6aUNEXn8N13OAQkvMVzMAAAAAElFTkSuQmCC',
    3: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAbCAYAAACN1PRVAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP4AxQCIekAK+gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+oKEA05LFUmr3AAAAQKSURBVEjHvZbPbhxFEMZ/1d27s3/sXW8Sx0kUKTaJEggk4hAuSLwIb8AzIC5InHkGTjwAN7ggbhwCQQJEwFJICPm3duys117vTHcVh5nddeKNQcRKSaOdrZ6ub+qrr6pHOmffdsCN3oJ9n2LBcZsPNbaGsgbcdUC719bDQDbnmmdHrVW2mO3fEZELobdggxTj85s5IvBRa3LYnYoyiYzBHTfaHR4fZy9hw7lQ/h566H9YCGGu3/kqvOkMTDXNL673/wksHizDAdOkGDbLsExzftCU0jGxW6JN83fOkWV16rU63jusKriIYFq9mszeVkTw3qMpAYJIyUSMkWeDHcwO1yQABO9pd7o82tghpUEJYCATMJvJbRKkXHOoavVfcOJoNDJWTi3T3+hjZqVApZRpaGQZvRMnufdoi7B0grPv3MCFAAqqRjHOSYXhQyAVkTjax1IkFTkiDvG+qolhqgwf3Obh0yFnl5fp9/vli1ZJBpOMuw83qXWXeO+jT8lOX8eSIQKKY3P9JuJa9C68hSYlpYRi9H/8hqxzhu7q1VltNPHk1resf/U5T7b26C11KfIcM8Ms4Yw6eV5w7tq7dC/dIKYaSQN59EQNjIdDit0hJh7zNVyzRWgvkFIEM0KzNbtaC5y69gHtlYsMBgM2R8IgZmyPjMXOSQJERMCFGi54QgNMDbGSa3EgTvBZbca/GM7ZVGUTExGcD4j3NJbPc+XDj6k1PT9/8RkxHxCSJtQMNSmD+wM9IYJzFaCXqW+i0rlDQARBcLUmjVOXaCw1kHqDNNomjPbG1fSw2WhzMruvVDfxTUfgBPBQU5X5pnzE8OE6+U6dNN4nxkhoNGoUo31SHONEcc6jWhFUBSxlXgK5CqkEkhdwDI0FlgrGm3/zx5efICIUuztkdSG0m4FcGzz46QdWf/mO7uX3SSpoFSBrNdEc0u4OSpm9YHgXQBPFcFD2noDGyOObX7P7aJ1OZ5EsPiUfjyEl+hvbSKvVstWLV3j8LEeaTXpvXEacnzBLsTumGI1x4qY+MLTIgarPqqGkKbG/+ReLmaftx9z+7deyEs5hqmUZvPe8efUa2yMjJS1pcoIpqAnOTYqlFX2GpkorTkhJ0WQUMdJZaNL0Y36vgJ7TzsGD5fTKCrVafbqg09FUjimRmXBUtVRrtaaqqBoxFWxubMwdyHLUKebcbPYdh7mjFlUV59zrAZv32fEq4K7eaAJQz5rzwV6g8VVolWa7Uw7CaRcbmnSikLmbxvt7/xo4a7Smp7R3DkwI9e7qWtq7f6fEs4qqqqH888f6hNfWQnfO95uBlBTv7WwT6hkis331ztqadM9dF+C8j/172ETuNuneGZi9oF0BrHK85N5NGj47s7Z1/9af/wCk7wOZWPnPJAAAAABJRU5ErkJggg=='
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
    const bodiesReady = planets.length > 0 && planets.every((planet) => planet && Number.isFinite(Number(planet.id)) && Number.isFinite(Number(planet.position)));
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
