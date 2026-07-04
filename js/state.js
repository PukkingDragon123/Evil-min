// ---------------------------------------------------------------------------
// Persistent game state + save/load + offline income (v3).
// Adds: multiple buyable floors, staff, litter/trash, quests, VIP tracking,
// and an interactive-tutorial step. Migrates v2 saves forward.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;
  const U = window.Upgrades;
  const KEY = 'dinodig.save.v3';
  const KEY_V2 = 'dinodig.save.v2';

  const MW = 13, MH = 8;

  function nowMs() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }
  function makeGrid(size) { return { size: size, cells: new Array(size * size).fill(null) }; }
  function makeFloors() {
    return D.FLOORS.map(function (f, i) { return { unlocked: i === 0, museum: [], trash: [] }; });
  }

  function freshState() {
    return {
      coins: 150, gems: 3, energy: 24, energyTimer: 0,
      upgrades: {}, grid: makeGrid(6), queue: [], speciesProgress: {}, mounted: {},
      curios: {},
      owned: {}, sites: { quarry: true }, depth: {}, maxDepth: {}, boards: {},
      floors: makeFloors(), floor: 0,
      staff: { janitor: 0, guide: 0, curator: 0 },
      quests: { progress: {}, done: {} },
      tutorial: { step: 0, done: false },
      stats: { digs: 0, extracted: 0, cleared: 0, mounted: 0, visitorsPeak: 0, deepest: 1, trashCleaned: 0, vipServed: 0 },
      level: 1, xp: 0, lastSeen: nowMs(), muted: false, firstRun: true,
    };
  }

  let state = freshState();
  let saveTimer = null;

  function migrateV2(v2) {
    const s = freshState();
    ['coins', 'gems', 'energy', 'energyTimer', 'upgrades', 'grid', 'queue', 'speciesProgress', 'mounted',
      'owned', 'sites', 'depth', 'maxDepth', 'boards', 'level', 'xp', 'muted'].forEach(function (k) {
      if (v2[k] != null) s[k] = v2[k];
    });
    if (Array.isArray(v2.museum)) s.floors[0].museum = v2.museum;
    if (v2.stats) s.stats = Object.assign(s.stats, v2.stats);
    s.firstRun = false; // they've already played
    s.tutorial = { step: 0, done: true }; // returning players skip the tutorial
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        state = Object.assign(freshState(), p);
      } else {
        const v2 = localStorage.getItem(KEY_V2);
        if (v2) { state = migrateV2(JSON.parse(v2)); }
        else { state = freshState(); return false; }
      }
      // repair nested
      state.upgrades = state.upgrades || {};
      state.grid = state.grid && state.grid.cells ? state.grid : makeGrid(6);
      state.queue = state.queue || [];
      state.speciesProgress = state.speciesProgress || {};
      state.mounted = state.mounted || {};
      state.curios = state.curios || {};
      state.owned = state.owned || {};
      state.sites = state.sites || { quarry: true };
      state.depth = state.depth || {}; state.maxDepth = state.maxDepth || {}; state.boards = state.boards || {};
      if (!Array.isArray(state.floors) || !state.floors.length) state.floors = makeFloors();
      // ensure floor count matches data (in case FLOORS grew)
      while (state.floors.length < D.FLOORS.length) state.floors.push({ unlocked: false, museum: [], trash: [] });
      state.floors = state.floors.map(function (f) {
        if (!f || typeof f !== 'object') f = { unlocked: false, museum: [], trash: [] };
        f.museum = Array.isArray(f.museum) ? f.museum : []; f.trash = Array.isArray(f.trash) ? f.trash : [];
        return f;
      });
      if (typeof state.floor !== 'number' || !Number.isInteger(state.floor) || state.floor < 0 || state.floor >= state.floors.length) state.floor = 0;
      state.staff = Object.assign({ janitor: 0, guide: 0, curator: 0 }, state.staff || {});
      state.quests = state.quests || { progress: {}, done: {} };
      state.quests.progress = state.quests.progress || {}; state.quests.done = state.quests.done || {};
      state.tutorial = state.tutorial || { step: 0, done: false };
      state.stats = Object.assign({ digs: 0, extracted: 0, cleared: 0, mounted: 0, visitorsPeak: 0, deepest: 1, trashCleaned: 0, vipServed: 0 }, state.stats || {});
      const want = U.storageSize();
      if (state.grid.size < want) resizeGrid(want);
      return true;
    } catch (e) { state = freshState(); return false; }
  }

  function save() { state.lastSeen = nowMs(); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function saveSoon() { if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; save(); }, 700); }
  function reset() { state = freshState(); state.firstRun = false; save(); }

  // resources
  function addCoins(n) { state.coins = Math.max(0, Math.round(state.coins + n)); saveSoon(); }
  function addGems(n) { state.gems = Math.max(0, state.gems + n); saveSoon(); }
  function canAfford(c, g) { return state.coins >= (c || 0) && state.gems >= (g || 0); }
  function spend(c, g) { if (!canAfford(c, g)) return false; state.coins -= (c || 0); state.gems -= (g || 0); saveSoon(); return true; }

  // xp/level
  function xpForLevel(l) { return 100 + (l - 1) * 90; }
  function addXp(n) { state.xp += n; let up = false; while (state.xp >= xpForLevel(state.level)) { state.xp -= xpForLevel(state.level); state.level++; up = true; } saveSoon(); return up; }

  // species / mounting
  function addSpecies(id, n) { state.speciesProgress[id] = (state.speciesProgress[id] || 0) + (n || 1); saveSoon(); }
  function speciesOf(id) { return state.speciesProgress[id] || 0; }
  function mountThreshold(id) { const f = D.fossilById(id); return f ? D.RARITY[f.rarity].mount : 999; }
  function canMount(id) { return speciesOf(id) >= mountThreshold(id); }
  function mount(id) { if (!canMount(id)) return false; state.speciesProgress[id] -= mountThreshold(id); state.mounted[id] = (state.mounted[id] || 0) + 1; state.stats.mounted++; saveSoon(); return true; }

  // curios (single-piece collectibles)
  function addCurio(id) { const first = !state.curios[id]; state.curios[id] = (state.curios[id] || 0) + 1; saveSoon(); return first; }
  function curioCount(id) { return state.curios[id] || 0; }
  function uniqueCurios() { let n = 0; for (const k in state.curios) if (state.curios[k] > 0) n++; return n; }

  // grid
  function gridIdx(x, y) { return y * state.grid.size + x; }
  function resizeGrid(n) { const old = state.grid; const g = makeGrid(n); for (let y = 0; y < old.size && y < n; y++) for (let x = 0; x < old.size && x < n; x++) g.cells[y * n + x] = old.cells[y * old.size + x] || null; state.grid = g; saveSoon(); }

  // queue
  function queueCap() { return U.queueCap(); }
  function pushBlock(b) { if (state.queue.length >= queueCap()) return false; state.queue.push(b); saveSoon(); return true; }
  function removeQueue(i) { if (i >= 0 && i < state.queue.length) { state.queue.splice(i, 1); saveSoon(); } }

  // ---- floors / museum ----
  function curFloor() { return state.floors[state.floor]; }
  function curMuseum() { return curFloor().museum; }
  function curTrash() { return curFloor().trash; }
  function floorUnlocked(i) { return !!(state.floors[i] && state.floors[i].unlocked); }
  function buyFloor(i) {
    const f = D.FLOORS[i]; if (!f || floorUnlocked(i)) return false;
    if (!spend(f.cost, f.gems)) return false;
    state.floors[i].unlocked = true; saveSoon(); return true;
  }
  function setFloor(i) { if (floorUnlocked(i)) { state.floor = i; saveSoon(); } }

  function itemFootprint(id) { if (D.fossilById(id)) return { w: 2, h: 2 }; const c = D.catalogById(id); return c ? { w: c.w, h: c.h } : { w: 1, h: 1 }; }
  function cellFree(cx, cy, w, h, ignore) {
    if (cx < 0 || cy < 0 || cx + w > MW || cy + h > MH) return false;
    const m = curMuseum();
    for (let i = 0; i < m.length; i++) { if (i === ignore) continue; const it = m[i]; const fp = itemFootprint(it.id); if (cx < it.cx + fp.w && cx + w > it.cx && cy < it.cy + fp.h && cy + h > it.cy) return false; }
    return true;
  }
  function placeItem(id, cx, cy) { const fp = itemFootprint(id); if (!cellFree(cx, cy, fp.w, fp.h)) return false; curMuseum().push({ id: id, cx: cx, cy: cy }); saveSoon(); return true; }
  function findFreeCell(id) { const fp = itemFootprint(id); for (let cy = 0; cy <= MH - fp.h; cy++) for (let cx = 0; cx <= MW - fp.w; cx++) if (cellFree(cx, cy, fp.w, fp.h)) return { cx: cx, cy: cy }; return null; }
  function moveItem(i, cx, cy) { const m = curMuseum(); const it = m[i]; if (!it) return false; const fp = itemFootprint(it.id); if (!cellFree(cx, cy, fp.w, fp.h, i)) return false; it.cx = cx; it.cy = cy; saveSoon(); return true; }
  function removeItem(i) { const m = curMuseum(); const it = m[i]; if (!it) return null; m.splice(i, 1); saveSoon(); return it; }

  // ---- staff ----
  function staffCost(id) { const s = D.STAFF.find(function (x) { return x.id === id; }); return s ? D.scaledCost(s.baseCost, state.staff[id] || 0) : 0; }
  function hireStaff(id) {
    const s = D.STAFF.find(function (x) { return x.id === id; }); if (!s) return false;
    if ((state.staff[id] || 0) >= s.max) return false;
    if (!spend(staffCost(id), s.gems || 0)) return false;
    state.staff[id] = (state.staff[id] || 0) + 1; saveSoon(); return true;
  }

  // ---- trash ----
  function addTrash(x, y) { const t = curTrash(); if (t.length >= D.TRASH_CAP) return false; t.push({ x: x, y: y }); saveSoon(); return true; }
  function removeTrash(i) { const t = curTrash(); if (i >= 0 && i < t.length) { t.splice(i, 1); state.stats.trashCleaned++; saveSoon(); return true; } return false; }
  function totalTrash() { let n = 0; for (let i = 0; i < state.floors.length; i++) if (state.floors[i].unlocked) n += state.floors[i].trash.length; return n; }

  // ---- derived stats (across all unlocked floors) ----
  function computeStats() {
    let wonder = 0, income = 0, comfort = 0, exhibits = 0, facilities = 0;
    const uc = uniqueCurios();
    for (let fi = 0; fi < state.floors.length; fi++) {
      if (!state.floors[fi].unlocked) continue;
      const m = state.floors[fi].museum;
      for (let i = 0; i < m.length; i++) {
        const it = m[i]; const fos = D.fossilById(it.id);
        if (fos) { wonder += fossilWonder(fos); income += fos.income; exhibits++; continue; }
        const cat = D.catalogById(it.id);
        if (cat) {
          if (cat.shelf) wonder += (cat.base || 0) + uc * (cat.perCurio || 0);
          else wonder += cat.wonder || 0;
          income += cat.income || 0; comfort += cat.comfort || 0; if (cat.kind === 'facility') facilities++;
        }
      }
    }
    comfort += (state.staff.guide || 0) * 12;
    income *= U.incomeMult() * (1 + (state.staff.curator || 0) * 0.1);
    const demand = Math.max(1, exhibits * 3);
    let satisfaction = Math.max(0.35, Math.min(1.4, 0.62 + comfort / demand * 0.5));
    // litter drags satisfaction down
    const trashPen = Math.min(0.5, totalTrash() * D.TRASH_PENALTY);
    satisfaction *= (1 - trashPen);
    const visitors = Math.floor(Math.sqrt(wonder) * 1.7 * satisfaction);
    const cps = income * satisfaction;
    if (visitors > state.stats.visitorsPeak) state.stats.visitorsPeak = visitors;
    return { wonder: Math.round(wonder), cps: cps, satisfaction: satisfaction, visitors: visitors, exhibits: exhibits, facilities: facilities, comfort: comfort, trash: totalTrash(), trashPen: trashPen };
  }
  function fossilWonder(f) { return D.RARITY[f.rarity].cell * 0.9 / 8 + f.income; }

  // energy
  function energyMax() { return U.energyMax(); }
  function tickEnergy(dt) { const max = energyMax(); if (state.energy >= max) { state.energyTimer = 0; return; } state.energyTimer += dt; const ms = U.regenMs(); while (state.energyTimer >= ms && state.energy < max) { state.energyTimer -= ms; state.energy++; saveSoon(); } }
  function useEnergy(n) { n = n || 1; if (state.energy < n) return false; state.energy -= n; saveSoon(); return true; }
  function refillEnergy() { if (!spend(0, D.ENERGY_REFILL_GEM_COST)) return false; state.energy = energyMax(); state.energyTimer = 0; saveSoon(); return true; }

  // offline
  function claimOffline() {
    const now = nowMs(); const away = Math.max(0, now - (state.lastSeen || now));
    if (away < 60000) { state.lastSeen = now; return null; }
    const st = computeStats();
    const cappedSec = Math.min(away / 1000, U.offlineHours() * 3600);
    const earned = Math.floor(st.cps * cappedSec * 0.5);
    state.energy = Math.min(energyMax(), state.energy + Math.floor(away / U.regenMs()));
    if (earned > 0) addCoins(earned);
    state.lastSeen = now; save();
    if (earned <= 0) return null;
    return { coins: earned, hours: cappedSec / 3600 };
  }

  window.GameState = {
    MW: MW, MH: MH,
    get: function () { return state; },
    load: load, save: save, saveSoon: saveSoon, reset: reset, nowMs: nowMs,
    addCoins: addCoins, addGems: addGems, canAfford: canAfford, spend: spend,
    addXp: addXp, xpForLevel: xpForLevel,
    addSpecies: addSpecies, speciesOf: speciesOf, mountThreshold: mountThreshold, canMount: canMount, mount: mount,
    addCurio: addCurio, curioCount: curioCount, uniqueCurios: uniqueCurios,
    gridIdx: gridIdx, resizeGrid: resizeGrid,
    queueCap: queueCap, pushBlock: pushBlock, removeQueue: removeQueue,
    curFloor: curFloor, curMuseum: curMuseum, curTrash: curTrash, floorUnlocked: floorUnlocked, buyFloor: buyFloor, setFloor: setFloor,
    itemFootprint: itemFootprint, cellFree: cellFree, placeItem: placeItem, findFreeCell: findFreeCell, moveItem: moveItem, removeItem: removeItem,
    staffCost: staffCost, hireStaff: hireStaff,
    addTrash: addTrash, removeTrash: removeTrash, totalTrash: totalTrash,
    computeStats: computeStats,
    energyMax: energyMax, tickEnergy: tickEnergy, useEnergy: useEnergy, refillEnergy: refillEnergy,
    claimOffline: claimOffline,
  };
})();
