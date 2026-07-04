// ---------------------------------------------------------------------------
// Persistent game state + save/load + offline income (v2).
// Adds: storage packing grid, fossil-block queue, per-species progress,
// per-site depth levels, and the upgrade tree.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;
  const U = window.Upgrades;
  const SAVE_KEY = 'dinodig.save.v2';

  const MW = 13, MH = 8; // museum grid dimensions (cells)

  function nowMs() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  function makeGrid(size) {
    return { size: size, cells: new Array(size * size).fill(null) };
  }

  function freshState() {
    return {
      coins: 150, gems: 3,
      energy: 24, energyTimer: 0,
      upgrades: {},                 // id -> level
      grid: makeGrid(6),            // packing storage grid
      queue: [],                    // pending fossil blocks to place
      speciesProgress: {},          // fossilId -> banked cells
      mounted: {},                  // fossilId -> mounted count
      museum: [],                   // placements {id,cx,cy}
      owned: {},                    // catalog id -> count (cost scaling)
      sites: { quarry: true },      // unlocked site ids
      depth: {},                    // siteId -> current depth (1-based)
      maxDepth: {},                 // siteId -> deepest reached
      boards: {},                   // siteId -> current board
      stats: { digs: 0, extracted: 0, cleared: 0, mounted: 0, visitorsPeak: 0, deepest: 1 },
      level: 1, xp: 0,
      lastSeen: nowMs(), muted: false, firstRun: true,
    };
  }

  let state = freshState();
  let saveTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { state = freshState(); return false; }
      const p = JSON.parse(raw);
      state = Object.assign(freshState(), p);
      state.upgrades = state.upgrades || {};
      state.grid = state.grid && state.grid.cells ? state.grid : makeGrid(6);
      state.queue = state.queue || [];
      state.speciesProgress = state.speciesProgress || {};
      state.mounted = state.mounted || {};
      state.museum = state.museum || [];
      state.owned = state.owned || {};
      state.sites = state.sites || { quarry: true };
      state.depth = state.depth || {};
      state.maxDepth = state.maxDepth || {};
      state.boards = state.boards || {};
      state.stats = Object.assign({ digs: 0, extracted: 0, cleared: 0, mounted: 0, visitorsPeak: 0, deepest: 1 }, state.stats || {});
      // make sure grid matches upgrade level
      const want = U.storageSize();
      if (state.grid.size < want) resizeGrid(want);
      return true;
    } catch (e) { state = freshState(); return false; }
  }

  function save() { state.lastSeen = nowMs(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function saveSoon() { if (saveTimer) return; saveTimer = setTimeout(function () { saveTimer = null; save(); }, 700); }
  function reset() { state = freshState(); state.firstRun = false; save(); }

  // --- resources -----------------------------------------------------------
  function addCoins(n) { state.coins = Math.max(0, Math.round(state.coins + n)); saveSoon(); }
  function addGems(n) { state.gems = Math.max(0, state.gems + n); saveSoon(); }
  function canAfford(c, g) { return state.coins >= (c || 0) && state.gems >= (g || 0); }
  function spend(c, g) { if (!canAfford(c, g)) return false; state.coins -= (c || 0); state.gems -= (g || 0); saveSoon(); return true; }

  // --- xp / level ----------------------------------------------------------
  function xpForLevel(l) { return 100 + (l - 1) * 90; }
  function addXp(n) {
    state.xp += n; let leveled = false;
    while (state.xp >= xpForLevel(state.level)) { state.xp -= xpForLevel(state.level); state.level++; leveled = true; }
    saveSoon(); return leveled;
  }

  // --- species progress / mounting ----------------------------------------
  function addSpecies(fossilId, n) {
    state.speciesProgress[fossilId] = (state.speciesProgress[fossilId] || 0) + (n || 1);
    saveSoon();
  }
  function speciesOf(fossilId) { return state.speciesProgress[fossilId] || 0; }
  function mountThreshold(fossilId) {
    const f = D.fossilById(fossilId); if (!f) return 999;
    return D.RARITY[f.rarity].mount;
  }
  function canMount(fossilId) { return speciesOf(fossilId) >= mountThreshold(fossilId); }
  function mount(fossilId) {
    if (!canMount(fossilId)) return false;
    state.speciesProgress[fossilId] -= mountThreshold(fossilId);
    state.mounted[fossilId] = (state.mounted[fossilId] || 0) + 1;
    state.stats.mounted++;
    saveSoon(); return true;
  }

  // --- storage grid --------------------------------------------------------
  function gridIdx(x, y) { return y * state.grid.size + x; }
  function resizeGrid(newSize) {
    const old = state.grid;
    const g = makeGrid(newSize);
    for (let y = 0; y < old.size && y < newSize; y++) {
      for (let x = 0; x < old.size && x < newSize; x++) {
        g.cells[y * newSize + x] = old.cells[y * old.size + x] || null;
      }
    }
    state.grid = g; saveSoon();
  }

  // --- queue ---------------------------------------------------------------
  function queueCap() { return U.queueCap(); }
  function pushBlock(block) {
    // returns false (and drops) if the queue is full
    if (state.queue.length >= queueCap()) return false;
    state.queue.push(block); saveSoon(); return true;
  }
  function removeQueue(i) { if (i >= 0 && i < state.queue.length) { state.queue.splice(i, 1); saveSoon(); } }

  // --- museum grid ---------------------------------------------------------
  function itemFootprint(id) {
    if (D.fossilById(id)) return { w: 2, h: 2 };
    const c = D.catalogById(id); return c ? { w: c.w, h: c.h } : { w: 1, h: 1 };
  }
  function cellFree(cx, cy, w, h, ignore) {
    if (cx < 0 || cy < 0 || cx + w > MW || cy + h > MH) return false;
    for (let i = 0; i < state.museum.length; i++) {
      if (i === ignore) continue;
      const it = state.museum[i]; const fp = itemFootprint(it.id);
      if (cx < it.cx + fp.w && cx + w > it.cx && cy < it.cy + fp.h && cy + h > it.cy) return false;
    }
    return true;
  }
  function placeItem(id, cx, cy) {
    const fp = itemFootprint(id);
    if (!cellFree(cx, cy, fp.w, fp.h)) return false;
    state.museum.push({ id: id, cx: cx, cy: cy }); saveSoon(); return true;
  }
  function findFreeCell(id) {
    const fp = itemFootprint(id);
    for (let cy = 0; cy <= MH - fp.h; cy++)
      for (let cx = 0; cx <= MW - fp.w; cx++)
        if (cellFree(cx, cy, fp.w, fp.h)) return { cx: cx, cy: cy };
    return null;
  }
  function moveItem(i, cx, cy) {
    const it = state.museum[i]; if (!it) return false;
    const fp = itemFootprint(it.id);
    if (!cellFree(cx, cy, fp.w, fp.h, i)) return false;
    it.cx = cx; it.cy = cy; saveSoon(); return true;
  }
  function removeItem(i) { const it = state.museum[i]; if (!it) return null; state.museum.splice(i, 1); saveSoon(); return it; }

  // --- derived stats -------------------------------------------------------
  function computeStats() {
    let wonder = 0, income = 0, comfort = 0, exhibits = 0, facilities = 0;
    for (let i = 0; i < state.museum.length; i++) {
      const it = state.museum[i];
      const fos = D.fossilById(it.id);
      if (fos) { wonder += fossilWonder(fos); income += fos.income; exhibits++; continue; }
      const cat = D.catalogById(it.id);
      if (cat) { wonder += cat.wonder || 0; income += cat.income || 0; comfort += cat.comfort || 0; if (cat.kind === 'facility') facilities++; }
    }
    income *= U.incomeMult();
    const demand = Math.max(1, exhibits * 3);
    const satisfaction = Math.max(0.35, Math.min(1.4, 0.62 + comfort / demand * 0.5));
    const visitors = Math.floor(Math.sqrt(wonder) * 1.7 * satisfaction);
    const cps = income * satisfaction;
    if (visitors > state.stats.visitorsPeak) state.stats.visitorsPeak = visitors;
    return { wonder: Math.round(wonder), cps: cps, satisfaction: satisfaction, visitors: visitors, exhibits: exhibits, facilities: facilities, comfort: comfort };
  }
  function fossilWonder(f) { return D.RARITY[f.rarity].cell * 0.9 / 8 + f.income; }

  // --- energy --------------------------------------------------------------
  function energyMax() { return U.energyMax(); }
  function tickEnergy(dt) {
    const max = energyMax();
    if (state.energy >= max) { state.energyTimer = 0; return; }
    state.energyTimer += dt;
    const ms = U.regenMs();
    while (state.energyTimer >= ms && state.energy < max) { state.energyTimer -= ms; state.energy++; saveSoon(); }
  }
  function useEnergy(n) { n = n || 1; if (state.energy < n) return false; state.energy -= n; saveSoon(); return true; }
  function refillEnergy() {
    if (!spend(0, D.ENERGY_REFILL_GEM_COST)) return false;
    state.energy = energyMax(); state.energyTimer = 0; saveSoon(); return true;
  }

  // --- offline income ------------------------------------------------------
  function claimOffline() {
    const now = nowMs();
    const away = Math.max(0, now - (state.lastSeen || now));
    if (away < 60000) { state.lastSeen = now; return null; }
    const st = computeStats();
    const cappedSec = Math.min(away / 1000, U.offlineHours() * 3600);
    const earned = Math.floor(st.cps * cappedSec * 0.5);
    const eGain = Math.floor(away / U.regenMs());
    state.energy = Math.min(energyMax(), state.energy + eGain);
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
    gridIdx: gridIdx, resizeGrid: resizeGrid,
    queueCap: queueCap, pushBlock: pushBlock, removeQueue: removeQueue,
    itemFootprint: itemFootprint, cellFree: cellFree, placeItem: placeItem,
    findFreeCell: findFreeCell, moveItem: moveItem, removeItem: removeItem,
    computeStats: computeStats,
    energyMax: energyMax, tickEnergy: tickEnergy, useEnergy: useEnergy, refillEnergy: refillEnergy,
    claimOffline: claimOffline,
  };
})();
