// ==UserScript==
// @name         PfG Companion
// @namespace    https://proxyforgame.com/
// @version      0.2.0
// @description  Collect OGame account data while you play and make it available to ProxyForGame.
// @updateURL    https://proxyforgame.com/companion/pfg-companion.meta.js
// @downloadURL  https://proxyforgame.com/companion/pfg-companion.user.js
// @match        https://*.ogame.gameforge.com/game/index.php*
// @match        https://proxyforgame.com/*
// @match        https://www.proxyforgame.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Set to true to print collection details to the browser console.
  const DEBUG = false;

  const SNAPSHOTS_KEY = 'pfg-companion:snapshots:v1';
  const PENDING_EXPORT_KEY = 'pfg_companion_pending_export';
  const SESSION_COLLECTED_KEY = 'pfg-companion:collected';
  const SESSION_SPECIES_RETRY_KEY = 'pfg-companion:species-retry';
  const EXPORT_URL = '/game/index.php?page=componentOnly&component=externaldataexport';
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

  // Interface strings for the languages ProxyForGame is available in. English is the fallback.
  // A value is either a string with {placeholders} or a function of the params (for plural forms).
  const I18N = {
    en: {
      done: 'All profile data is collected.',
      start: "Navigate to any OGame page or hit 'Refresh' to start collection of data.",
      missing: 'Missing: {items}. Press Refresh to collect again.',
      missingTip: 'Missing {items}. Open the panel and press Refresh.',
      partial: ({ count }) => `Account and planets are collected; production percentages are missing for ${count} planet${count === 1 ? '' : 's'}. Open Resource Settings on each of them.`,
      nothing: 'Nothing collected yet.',
      account: 'account data',
      accountPanel: 'account data (player id or species bonuses)',
      planets: 'planet list',
      lastCollection: 'Last collection: {date}',
      never: 'Not collected yet',
      missingProduction: 'Missing production percentage data for the following planets:',
      lastError: 'Last error: {message} ({date})',
      refresh: 'Refresh',
      clear: 'Clear data',
      copy: 'Copy',
      saveFile: 'Save to file',
      minified: 'Minified (current universe only)',
      copied: 'Copied',
      close: 'Close',
      iconAlt: 'PfG Companion status',
    },
    ru: {
      done: 'Все данные профиля собраны.',
      start: 'Откройте любую страницу OGame или нажмите «Обновить», чтобы начать сбор данных.',
      missing: 'Не хватает: {items}. Нажмите «Обновить», чтобы собрать данные снова.',
      missingTip: 'Не хватает: {items}. Откройте панель и нажмите «Обновить».',
      partial: 'Аккаунт и планеты собраны, но нет процентов производства (планет: {count}). Откройте «Настройки сырья» на каждой из них.',
      nothing: 'Данные ещё не собраны.',
      account: 'данных аккаунта',
      accountPanel: 'данных аккаунта (ID игрока или бонусов расы)',
      planets: 'списка планет',
      lastCollection: 'Последний сбор: {date}',
      never: 'Ещё не собрано',
      missingProduction: 'Нет данных о процентах производства для следующих планет:',
      lastError: 'Последняя ошибка: {message} ({date})',
      refresh: 'Обновить',
      clear: 'Очистить данные',
      copy: 'Скопировать',
      saveFile: 'Сохранить в файл',
      minified: 'Минимизированный (только текущая вселенная)',
      copied: 'Скопировано',
      close: 'Закрыть',
      iconAlt: 'Статус PfG Companion',
    },
    de: {
      done: 'Alle Profildaten sind erfasst.',
      start: 'Öffne eine beliebige OGame-Seite oder klicke auf „Aktualisieren“, um die Datenerfassung zu starten.',
      missing: 'Es fehlen: {items}. Klicke auf „Aktualisieren“, um erneut zu erfassen.',
      missingTip: 'Es fehlen: {items}. Öffne das Panel und klicke auf „Aktualisieren“.',
      partial: 'Account und Planeten sind erfasst, aber die Produktionsprozente fehlen (Planeten: {count}). Öffne auf jedem davon die Rohstoffeinstellungen.',
      nothing: 'Noch nichts erfasst.',
      account: 'Accountdaten',
      accountPanel: 'Accountdaten (Spieler-ID oder Spezies-Boni)',
      planets: 'Planetenliste',
      lastCollection: 'Letzte Erfassung: {date}',
      never: 'Noch nicht erfasst',
      missingProduction: 'Für die folgenden Planeten fehlen die Produktionsprozente:',
      lastError: 'Letzter Fehler: {message} ({date})',
      refresh: 'Aktualisieren',
      clear: 'Daten löschen',
      copy: 'Kopieren',
      saveFile: 'In Datei speichern',
      minified: 'Minimiert (nur aktuelles Universum)',
      copied: 'Kopiert',
      close: 'Schließen',
      iconAlt: 'Status von PfG Companion',
    },
    pl: {
      done: 'Wszystkie dane profilu zostały zebrane.',
      start: 'Otwórz dowolną stronę OGame lub kliknij „Odśwież”, aby rozpocząć zbieranie danych.',
      missing: 'Brakuje: {items}. Kliknij „Odśwież”, aby zebrać dane ponownie.',
      missingTip: 'Brakuje: {items}. Otwórz panel i kliknij „Odśwież”.',
      partial: 'Konto i planety zostały zebrane, ale brakuje procentów produkcji (planet: {count}). Otwórz „Ustawienia surowców” na każdej z nich.',
      nothing: 'Nie zebrano jeszcze żadnych danych.',
      account: 'danych konta',
      accountPanel: 'danych konta (ID gracza lub bonusów rasy)',
      planets: 'listy planet',
      lastCollection: 'Ostatnie zbieranie: {date}',
      never: 'Jeszcze nie zebrano',
      missingProduction: 'Brak procentów produkcji dla następujących planet:',
      lastError: 'Ostatni błąd: {message} ({date})',
      refresh: 'Odśwież',
      clear: 'Wyczyść dane',
      copy: 'Kopiuj',
      saveFile: 'Zapisz do pliku',
      minified: 'Zminimalizowany (tylko bieżące uniwersum)',
      copied: 'Skopiowano',
      close: 'Zamknij',
      iconAlt: 'Status PfG Companion',
    },
    es: {
      done: 'Se han recopilado todos los datos del perfil.',
      start: 'Abre cualquier página de OGame o pulsa «Actualizar» para empezar a recopilar datos.',
      missing: 'Faltan: {items}. Pulsa «Actualizar» para recopilar de nuevo.',
      missingTip: 'Faltan: {items}. Abre el panel y pulsa «Actualizar».',
      partial: 'La cuenta y los planetas están recopilados, pero faltan los porcentajes de producción (planetas: {count}). Abre «Ajustes de recursos» en cada uno de ellos.',
      nothing: 'Aún no se ha recopilado nada.',
      account: 'datos de la cuenta',
      accountPanel: 'datos de la cuenta (ID del jugador o bonificaciones de especie)',
      planets: 'lista de planetas',
      lastCollection: 'Última recopilación: {date}',
      never: 'Aún no recopilado',
      missingProduction: 'Faltan los porcentajes de producción de los siguientes planetas:',
      lastError: 'Último error: {message} ({date})',
      refresh: 'Actualizar',
      clear: 'Borrar datos',
      copy: 'Copiar',
      saveFile: 'Guardar en archivo',
      minified: 'Minimizado (solo el universo actual)',
      copied: 'Copiado',
      close: 'Cerrar',
      iconAlt: 'Estado de PfG Companion',
    },
    fr: {
      done: 'Toutes les données du profil sont collectées.',
      start: 'Ouvrez une page OGame ou cliquez sur « Actualiser » pour lancer la collecte des données.',
      missing: 'Manquant : {items}. Cliquez sur « Actualiser » pour collecter à nouveau.',
      missingTip: 'Manquant : {items}. Ouvrez le panneau et cliquez sur « Actualiser ».',
      partial: "Le compte et les planètes sont collectés, mais les pourcentages de production manquent (planètes : {count}). Ouvrez les « Paramètres des ressources » sur chacune d'elles.",
      nothing: 'Rien n’a encore été collecté.',
      account: 'des données du compte',
      accountPanel: 'des données du compte (ID du joueur ou bonus d’espèce)',
      planets: 'de la liste des planètes',
      lastCollection: 'Dernière collecte : {date}',
      never: 'Pas encore collecté',
      missingProduction: 'Pourcentages de production manquants pour les planètes suivantes :',
      lastError: 'Dernière erreur : {message} ({date})',
      refresh: 'Actualiser',
      clear: 'Effacer les données',
      copy: 'Copier',
      saveFile: 'Enregistrer dans un fichier',
      minified: 'Minifié (univers actuel uniquement)',
      copied: 'Copié',
      close: 'Fermer',
      iconAlt: 'État de PfG Companion',
    },
    it: {
      done: 'Tutti i dati del profilo sono stati raccolti.',
      start: 'Apri una qualsiasi pagina di OGame o premi «Aggiorna» per avviare la raccolta dei dati.',
      missing: 'Mancano: {items}. Premi «Aggiorna» per raccogliere di nuovo.',
      missingTip: 'Mancano: {items}. Apri il pannello e premi «Aggiorna».',
      partial: "Account e pianeti sono stati raccolti, ma mancano le percentuali di produzione (pianeti: {count}). Apri le «Impostazioni risorse» su ciascuno di essi.",
      nothing: 'Non è ancora stato raccolto nulla.',
      account: 'dati dell’account',
      accountPanel: 'dati dell’account (ID giocatore o bonus della specie)',
      planets: 'elenco dei pianeti',
      lastCollection: 'Ultima raccolta: {date}',
      never: 'Non ancora raccolto',
      missingProduction: 'Mancano le percentuali di produzione per i seguenti pianeti:',
      lastError: 'Ultimo errore: {message} ({date})',
      refresh: 'Aggiorna',
      clear: 'Cancella dati',
      copy: 'Copia',
      saveFile: 'Salva su file',
      minified: 'Minimizzato (solo universo corrente)',
      copied: 'Copiato',
      close: 'Chiudi',
      iconAlt: 'Stato di PfG Companion',
    },
    nl: {
      done: 'Alle profielgegevens zijn verzameld.',
      start: 'Open een willekeurige OGame-pagina of klik op “Vernieuwen” om het verzamelen van gegevens te starten.',
      missing: 'Ontbreekt: {items}. Klik op “Vernieuwen” om opnieuw te verzamelen.',
      missingTip: 'Ontbreekt: {items}. Open het paneel en klik op “Vernieuwen”.',
      partial: 'Account en planeten zijn verzameld, maar de productiepercentages ontbreken (planeten: {count}). Open de grondstofinstellingen op elk van deze planeten.',
      nothing: 'Er is nog niets verzameld.',
      account: 'accountgegevens',
      accountPanel: 'accountgegevens (speler-ID of soortbonussen)',
      planets: 'planetenlijst',
      lastCollection: 'Laatst verzameld: {date}',
      never: 'Nog niet verzameld',
      missingProduction: 'Productiepercentages ontbreken voor de volgende planeten:',
      lastError: 'Laatste fout: {message} ({date})',
      refresh: 'Vernieuwen',
      clear: 'Gegevens wissen',
      copy: 'Kopiëren',
      saveFile: 'Opslaan in bestand',
      minified: 'Geminimaliseerd (alleen huidig universum)',
      copied: 'Gekopieerd',
      close: 'Sluiten',
      iconAlt: 'Status van PfG Companion',
    },
    sk: {
      done: 'Všetky údaje profilu sú zhromaždené.',
      start: 'Otvorte ľubovoľnú stránku OGame alebo kliknite na „Obnoviť“, čím spustíte zber údajov.',
      missing: 'Chýba: {items}. Kliknutím na „Obnoviť“ spustíte zber znova.',
      missingTip: 'Chýba: {items}. Otvorte panel a kliknite na „Obnoviť“.',
      partial: 'Účet a planéty sú zhromaždené, ale chýbajú percentá produkcie (planét: {count}). Otvorte „Nastavenia surovín“ na každej z nich.',
      nothing: 'Zatiaľ nebolo nič zhromaždené.',
      account: 'údaje účtu',
      accountPanel: 'údaje účtu (ID hráča alebo bonusy druhu)',
      planets: 'zoznam planét',
      lastCollection: 'Posledný zber: {date}',
      never: 'Zatiaľ nezhromaždené',
      missingProduction: 'Chýbajú percentá produkcie pre tieto planéty:',
      lastError: 'Posledná chyba: {message} ({date})',
      refresh: 'Obnoviť',
      clear: 'Vymazať údaje',
      copy: 'Kopírovať',
      saveFile: 'Uložiť do súboru',
      minified: 'Minimalizované (iba aktuálny vesmír)',
      copied: 'Skopírované',
      close: 'Zavrieť',
      iconAlt: 'Stav PfG Companion',
    },
    tr: {
      done: 'Tüm profil verileri toplandı.',
      start: 'Herhangi bir OGame sayfasını açın veya veri toplamayı başlatmak için “Yenile”ye basın.',
      missing: 'Eksik: {items}. Yeniden toplamak için “Yenile”ye basın.',
      missingTip: 'Eksik: {items}. Paneli açın ve “Yenile”ye basın.',
      partial: 'Hesap ve gezegenler toplandı, ancak üretim yüzdeleri eksik (gezegen sayısı: {count}). Bunların her birinde “Kaynak ayarları”nı açın.',
      nothing: 'Henüz hiçbir şey toplanmadı.',
      account: 'hesap verileri',
      accountPanel: 'hesap verileri (oyuncu kimliği veya tür bonusları)',
      planets: 'gezegen listesi',
      lastCollection: 'Son toplama: {date}',
      never: 'Henüz toplanmadı',
      missingProduction: 'Aşağıdaki gezegenler için üretim yüzdeleri eksik:',
      lastError: 'Son hata: {message} ({date})',
      refresh: 'Yenile',
      clear: 'Verileri temizle',
      copy: 'Kopyala',
      saveFile: 'Dosyaya kaydet',
      minified: 'Küçültülmüş (yalnızca geçerli evren)',
      copied: 'Kopyalandı',
      close: 'Kapat',
      iconAlt: 'PfG Companion durumu',
    },
    pt: {
      done: 'Todos os dados do perfil foram recolhidos.',
      start: 'Abra qualquer página do OGame ou clique em «Atualizar» para iniciar a recolha de dados.',
      missing: 'Em falta: {items}. Clique em «Atualizar» para recolher novamente.',
      missingTip: 'Em falta: {items}. Abra o painel e clique em «Atualizar».',
      partial: 'A conta e os planetas foram recolhidos, mas faltam as percentagens de produção (planetas: {count}). Abra as «Configurações de recursos» em cada um deles.',
      nothing: 'Ainda não foi recolhido nada.',
      account: 'dados da conta',
      accountPanel: 'dados da conta (ID do jogador ou bónus de espécie)',
      planets: 'lista de planetas',
      lastCollection: 'Última recolha: {date}',
      never: 'Ainda não recolhido',
      missingProduction: 'Faltam as percentagens de produção dos seguintes planetas:',
      lastError: 'Último erro: {message} ({date})',
      refresh: 'Atualizar',
      clear: 'Limpar dados',
      copy: 'Copiar',
      saveFile: 'Salvar em arquivo',
      minified: 'Minimizado (apenas o universo atual)',
      copied: 'Copiado',
      close: 'Fechar',
      iconAlt: 'Estado do PfG Companion',
    },
    bs: {
      done: 'Svi podaci profila su prikupljeni.',
      start: 'Otvorite bilo koju stranicu OGame ili kliknite „Osvježi“ da započnete prikupljanje podataka.',
      missing: 'Nedostaje: {items}. Kliknite „Osvježi“ da ponovo prikupite podatke.',
      missingTip: 'Nedostaje: {items}. Otvorite panel i kliknite „Osvježi“.',
      partial: 'Račun i planete su prikupljeni, ali nedostaju postoci proizvodnje (planeta: {count}). Otvorite „Postavke resursa“ na svakoj od njih.',
      nothing: 'Još ništa nije prikupljeno.',
      account: 'podaci računa',
      accountPanel: 'podaci računa (ID igrača ili bonusi vrste)',
      planets: 'lista planeta',
      lastCollection: 'Posljednje prikupljanje: {date}',
      never: 'Još nije prikupljeno',
      missingProduction: 'Nedostaju postoci proizvodnje za sljedeće planete:',
      lastError: 'Posljednja greška: {message} ({date})',
      refresh: 'Osvježi',
      clear: 'Obriši podatke',
      copy: 'Kopiraj',
      saveFile: 'Spremi u datoteku',
      minified: 'Minimizirano (samo trenutni univerzum)',
      copied: 'Kopirano',
      close: 'Zatvori',
      iconAlt: 'Status PfG Companion',
    },
  };
  // OGame language codes (the `sN-xx` host part) that map to a PfG interface language; others fall back to the browser language.
  const HOST_LANGUAGES = { us: 'en', gb: 'en', br: 'pt', ba: 'bs', mx: 'es', ar: 'es' };

  function interfaceLanguage() {
    const fromHost = location.hostname.match(/^s\d+-([a-z]{2,3})\./i)?.[1].toLowerCase();
    const candidates = [fromHost && (HOST_LANGUAGES[fromHost] || fromHost), (navigator.language || '').slice(0, 2).toLowerCase()];
    return candidates.find((code) => code && Object.hasOwn(I18N, code)) || 'en';
  }
  const LANGUAGE = interfaceLanguage();

  /** @param {string} key @param {Record<string, string|number>} [params] */
  function t(key, params = {}) {
    const value = I18N[LANGUAGE][key] ?? I18N.en[key];
    if (typeof value === 'function') return value(params);
    return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
  }

  /** @param {string[]} items */
  function formatList(items) {
    return new Intl.ListFormat(LANGUAGE, { style: 'long', type: 'conjunction' }).format(items);
  }

  /** @param {string|number|Date} value */
  function formatDate(value) {
    return new Date(value).toLocaleString(LANGUAGE);
  }

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

  // OGame tool rules: every accountInfo request marks the player active and refreshes the highscore of all planets,
  // so the account is fetched once per game session (the browser tab's sessionStorage) and then only by Refresh.
  function collectedThisSession() {
    try {
      return sessionStorage.getItem(SESSION_COLLECTED_KEY) === String(currentPagePlayerId());
    } catch {
      return Boolean(activeEntry());
    }
  }

  function markCollectedThisSession() {
    try {
      sessionStorage.setItem(SESSION_COLLECTED_KEY, String(currentPagePlayerId()));
    } catch {
      // Without sessionStorage collectedThisSession() falls back to the stored entry.
    }
  }

  // On the first page after login the game answers speciesBonuses without data, so only speciesBonuses is requested
  // once more, on the next page the player loads; accountInfo is not repeated.
  function speciesRetryPending() {
    try {
      return sessionStorage.getItem(SESSION_SPECIES_RETRY_KEY) === String(currentPagePlayerId());
    } catch {
      return false;
    }
  }

  /** @param {boolean} pending */
  function setSpeciesRetry(pending) {
    try {
      if (pending) sessionStorage.setItem(SESSION_SPECIES_RETRY_KEY, String(currentPagePlayerId()));
      else sessionStorage.removeItem(SESSION_SPECIES_RETRY_KEY);
    } catch {
      // Without sessionStorage there is no retry; the panel's Refresh still works.
    }
  }

  function activeEntry() {
    const uni = universe();
    const planetId = currentPlanetId();
    const pid = currentPagePlayerId();
    return Object.values(snapshots()).find((entry) => {
      if (!entry?.export || entry.export.universe?.host !== uni?.host) return false;
      if (pid && String(entry.export.playerId) !== String(pid)) return false;
      return !planetId || Boolean(entry.export.planets?.[planetId] || entry.export.moons?.[planetId]);
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

  // accountInfo lists the items active on every planet (planets[id].buffs); keep the known production boosters
  // under pfgCompanion, since the planets themselves belong to the account-export format.
  /** @param {any} planets */
  function productionBoosters(planets) {
    const result = {};
    if (!planets || typeof planets !== 'object') return result;
    Object.entries(planets).forEach(([planetId, planet]) => {
      const buffs = Array.isArray(planet?.buffs) ? planet.buffs : [];
      result[planetId] = buffs.filter((buff) => PRODUCTION_ITEMS[buff?.itemUuid]).map((buff) => ({
        uuid: buff.itemUuid,
        name: String(buff.name || ''),
        ...PRODUCTION_ITEMS[buff.itemUuid],
        effectStart: Number.isFinite(buff.effectStart) ? buff.effectStart : null,
        effectEnd: Number.isFinite(buff.effectEnd) ? buff.effectEnd : null,
      }));
    });
    return result;
  }

  /** @param {any} exportData @param {string} [collectedAt] time of the last account fetch, which drives the collection throttle */
  function persistExport(exportData, collectedAt = exportData?.exportedAt) {
    const uni = universe();
    debug('persistExport: playerId=', exportData?.playerId, 'playerIdValid=', Number.isFinite(Number(exportData?.playerId)), 'universe=', uni ? `${uni.language}:${uni.number}` : null, 'hasPlanets=', !!(exportData?.planets && typeof exportData.planets === 'object'));
    if (!uni || !Number.isFinite(Number(exportData.playerId))) return;
    const all = snapshots();
    const existing = all[accountKey(exportData.playerId, uni)]?.export || {};
    const productionFactors = { ...(existing.pfgCompanion?.productionFactors || {}), ...(exportData.pfgCompanion?.productionFactors || {}) };
    const next = { ...exportData, pfgCompanion: { productionFactors } };
    // A partial response must not erase data collected earlier.
    if (!next.speciesBonuses && existing.speciesBonuses) next.speciesBonuses = existing.speciesBonuses;
    const hasPlanets = (value) => value && typeof value === 'object' && Object.keys(value).length > 0;
    if (!hasPlanets(next.planets) && hasPlanets(existing.planets)) next.planets = existing.planets;
    next.pfgCompanion.productionBoosters = productionBoosters(next.planets);
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
    if (!force && collectedThisSession()) {
      if (speciesRetryPending()) return retrySpeciesBonuses();
      debug('collectAccount: skipped, already collected in this session');
      return activeEntry()?.export || null;
    }
    // Marked before the request, so a failed collection is not retried on every page load either.
    markCollectedThisSession();
    debug('collectAccount: fetching accountInfo and speciesBonuses');
    const [accountInfo, speciesBonuses] = await Promise.all([
      fetchJson(`${EXPORT_URL}&action=accountInfo&asJson=1`),
      fetchJson(`${EXPORT_URL}&action=speciesBonuses&asJson=1`),
    ]);
    setSpeciesRetry(!speciesBonuses?.data);
    debug('collectAccount: fetch resolved, accountInfo keys=', accountInfo && typeof accountInfo === 'object' ? Object.keys(accountInfo).join(',') : 'invalid', 'playerId=', accountInfo?.playerId, 'planets=', accountInfo?.planets && typeof accountInfo.planets === 'object' ? Object.keys(accountInfo.planets).length : 0, 'speciesBonuses=', !!speciesBonuses);
    const saved = persistExport(buildExport(accountInfo, speciesBonuses, uni));
    debug('collectAccount: persistExport finished, saved=', saved ? 'yes' : 'no');
    if (saved?.playerId) CURRENT_PLAYER_ID = String(saved.playerId);
    return saved;
  }

  async function retrySpeciesBonuses() {
    // Cleared before the request: one retry per collection, whatever the answer.
    setSpeciesRetry(false);
    const entry = activeEntry();
    if (!entry?.export) return null;
    debug('retrySpeciesBonuses: fetching speciesBonuses only');
    const response = await fetchJson(`${EXPORT_URL}&action=speciesBonuses&asJson=1`);
    if (!response?.data) {
      debug('retrySpeciesBonuses: still no data');
      return entry.export;
    }
    const next = structuredClone(entry.export);
    next.speciesBonuses = stripDetails(response.data);
    next.exportedAt = new Date().toISOString();
    return persistExport(next, entry.collectedAt);
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

  function saveProductionFactors() {
    debug('saveProductionFactors: component=', GAME_COMPONENT, 'planetId=', currentPlanetId());
    const production = readProductionFactors();
    if (!production) {
      debug('saveProductionFactors: no production factors available for current component/planet');
      return;
    }
    debug('saveProductionFactors: read', production);
    const uni = universe();
    if (!uni) return;
    const entry = activeEntry();
    if (!entry?.export) return;
    const next = structuredClone(entry.export);
    next.exportedAt = new Date().toISOString();
    next.pfgCompanion ??= {};
    next.pfgCompanion.productionFactors ??= {};
    next.pfgCompanion.productionFactors[production.planetId] = production.factors;
    const saved = persistExport(next, entry.collectedAt);
    if (saved) debug('production factors saved', saved.pfgCompanion.productionFactors, 'status', saved.pfgCompanion.status);
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
    if (status.level === 3) return t('done');
    if (status.level === 2) return '';
    if (!exportData) return t('start');
    const missing = [];
    if (!status.accountReady) missing.push(t('accountPanel'));
    if (!status.bodiesReady) missing.push(t('planets'));
    return t('missing', { items: formatList(missing) });
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
      #pfg-companion-panel .pfg-minified { display:block; margin-top:16px; padding-top:12px; border-top:1px solid #52769f; cursor:pointer; } #pfg-companion-panel .pfg-minified input { vertical-align:middle; margin:0 6px 0 0; }
      #pfg-companion-panel .pfg-actions button:disabled { opacity:.5; cursor:default; }
      #pfg-companion-menu { cursor:pointer; }
      #pfg-companion-menu .menu_icon { display:inline-block; vertical-align:middle; margin-right:4px; }
      #pfg-companion-icon { display:inline-block; width:27px; height:27px; margin-left:4px; border:0; background:transparent; box-sizing:border-box; text-decoration:none; line-height:0; }
      #pfg-companion-icon:hover { background:transparent; }
      #pfg-companion-icon .pfg-level-icon { display:block; width:27px; height:27px; }
    `);
  }

  // Whether the panel exports the trimmed current-universe document (for AI chats) or everything the script has stored.
  let exportMinified = true;

  /**
   * The document for AI chats: the contract is in the ProxyForGame docs (ogame-api-import.md).
   * @param {any} exportData
   */
  function trimmedExport(exportData) {
    const result = { ...exportData };
    for (const group of ['planets', 'moons']) {
      if (!result[group] || typeof result[group] !== 'object') continue;
      result[group] = Object.fromEntries(Object.entries(result[group]).map(([id, body]) => {
        const { resources, defenses, baseProduction, ...kept } = body || {};
        return [id, kept];
      }));
    }
    result.speciesBonuses = onlyTotalBonus(result.speciesBonuses);
    return result;
  }

  // speciesBonuses is category -> bonus name -> { totalBonus, spaceObjectBonus, technologyBonus, ... }:
  // descend to the objects that carry totalBonus and keep only that.
  function onlyTotalBonus(node) {
    if (!node || typeof node !== 'object') return node;
    if ('totalBonus' in node) return { totalBonus: node.totalBonus };
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, onlyTotalBonus(child)]));
  }

  function hasExportData() {
    return exportMinified ? Boolean(activeEntry()?.export) : Object.keys(snapshots()).length > 0;
  }

  /** @returns {{ text: string, name: string } | null} */
  function exportFile() {
    if (!hasExportData()) return null;
    if (!exportMinified) return { text: JSON.stringify(snapshots(), null, 2), name: 'pfg-companion-all.json' };
    const data = activeEntry().export;
    const uni = data.universe;
    return { text: JSON.stringify(trimmedExport(data)), name: `pfg-companion-${uni?.language}-${uni?.number}-${data.playerId}.json` };
  }

  /** @param {string} text */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      debug('clipboard API failed, falling back to execCommand:', err);
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0;';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Copy failed');
  }

  /** @param {string} text @param {string} name */
  function saveTextFile(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** @param {{ collectedAt?: string, export?: any, error?: { at: string, message: string } } | null} entry */
  function showPanel(entry) {
    const panel = document.getElementById('pfg-companion-panel');
    if (!panel) return;
    const exportData = entry?.export || null;
    const collectionError = entry?.error || null;
    const status = collectionStatus(exportData);
    debug('showPanel: status', status);
    // The time of the last accountInfo request, not of the last change: saving production factors does not request anything.
    const collectedAt = entry?.collectedAt ? formatDate(entry.collectedAt) : t('never');
    const missing = status.missingProduction?.length
      ? `<p>${escapeHtml(t('missingProduction'))}</p><ul>${status.missingProduction.map((planet) => `<li>${escapeHtml(planet.name || planet.id)} [${escapeHtml(planet.coords || '')}]</li>`).join('')}</ul>`
      : '';
    const error = collectionError ? `<p class="pfg-muted">${escapeHtml(t('lastError', { message: collectionError.message, date: formatDate(collectionError.at) }))}</p>` : '';
    panel.innerHTML = `<button type="button" aria-label="${escapeHtml(t('close'))}">×</button><h2>ProxyForGame companion</h2><p>${escapeHtml(panelText(exportData, status))}</p><p class="pfg-muted">${escapeHtml(t('lastCollection', { date: collectedAt }))}</p>${missing}${error}<div class="pfg-actions"><button type="button" id="pfg-refresh">${escapeHtml(t('refresh'))}</button><button type="button" id="pfg-clear">${escapeHtml(t('clear'))}</button></div>`
      + `<label class="pfg-minified"><input type="checkbox" id="pfg-minified"${exportMinified ? ' checked' : ''}>${escapeHtml(t('minified'))}</label>`
      + `<div class="pfg-actions"><button type="button" id="pfg-copy"${hasExportData() ? '' : ' disabled'}>${escapeHtml(t('copy'))}</button><button type="button" id="pfg-save"${hasExportData() ? '' : ' disabled'}>${escapeHtml(t('saveFile'))}</button></div>`;
    panel.querySelector('button:not([id])')?.addEventListener('click', () => panel.classList.remove('pfg-open'));
    panel.querySelector('#pfg-refresh')?.addEventListener('click', () => {
      debug('refresh clicked, forcing collection');
      void collectAccount(true).then(() => {
        debug('refresh flow: collection succeeded, saving production factors and refreshing UI');
        saveProductionFactors();
        refreshGameUi();
        const current = activeEntry();
        showPanel(current);
      }).catch((err) => {
        debug('refresh flow: collection failed:', err);
        recordError(err);
        refreshGameUi();
        const current = activeEntry();
        showPanel(current);
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
      showPanel(activeEntry());
    });
    panel.querySelector('#pfg-minified')?.addEventListener('change', (event) => {
      exportMinified = event.target.checked;
      showPanel(activeEntry());
    });
    panel.querySelector('#pfg-copy')?.addEventListener('click', (event) => {
      const file = exportFile();
      if (!file) return;
      const button = event.currentTarget;
      void copyText(file.text).then(() => {
        button.textContent = t('copied');
        setTimeout(() => { button.textContent = t('copy'); }, 1500);
      }).catch((err) => debug('copy failed:', err));
    });
    panel.querySelector('#pfg-save')?.addEventListener('click', () => {
      const file = exportFile();
      if (file) saveTextFile(file.text, file.name);
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
        <a id="pfg-companion-icon" class="tooltipRight js_hideTipOnMobile" href="#" target="_self" style="display:block;line-height:0;text-decoration:none;">
          <img class="pfg-level-icon" src="${LEVEL_ICONS[status.level] || LEVEL_ICONS[1]}" alt="${escapeHtml(t('iconAlt'))}" width="27" height="27">
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
      showPanel(current);
    };
    entry.querySelector('#pfg-companion-icon')?.addEventListener('click', openPanel);
    entry.querySelector('#pfg-companion-menu-btn')?.addEventListener('click', openPanel);
    menu.append(entry);
    refreshGameUi();
  }

  /** @param {any} exportData @param {ReturnType<typeof collectionStatus>} status */
  function levelTooltip(exportData, status) {
    if (status.level === 3) return t('done');
    if (status.level === 2) return t('partial', { count: status.missingProduction.length });
    if (!exportData) return t('nothing');
    const missing = [];
    if (!status.accountReady) missing.push(t('account'));
    if (!status.bodiesReady) missing.push(t('planets'));
    return t('missingTip', { items: formatList(missing) });
  }

  function refreshGameUi() {
    const exportData = activeEntry()?.export;
    const status = collectionStatus(exportData);
    const iconSrc = LEVEL_ICONS[status.level] || LEVEL_ICONS[1];
    document.querySelectorAll('#pfg-companion-menu .pfg-level-icon').forEach((icon) => icon.setAttribute('src', iconSrc));
    setIconTooltip(levelTooltip(exportData, status));
  }

  // OGame turns `title` into its own tooltip only during its initial pass over the page, which has already
  // run when the menu entry is added, so the game's changeTooltip() is called directly. Falls back to a plain title.
  /** @param {string} text */
  function setIconTooltip(text) {
    const icon = document.getElementById('pfg-companion-icon');
    if (!icon || icon.getAttribute('data-tooltip-title') === text) return;
    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (typeof page.changeTooltip === 'function') {
      try {
        page.changeTooltip(icon, text);
        return;
      } catch (error) {
        debug('setIconTooltip: changeTooltip failed, using a plain title:', error);
      }
    }
    icon.setAttribute('title', text);
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
      showPanel(current);
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
