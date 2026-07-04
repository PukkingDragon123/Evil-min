// ---------------------------------------------------------------------------
// Persistent game state + save/load (localStorage) + offline income.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;
  const SAVE_KEY = 'dinodig.save.v1';

  const MW = 13, MH = 8; // museum grid dimensions (cells)

  function freshState() {
    const s = {
      coins: 120,
      gems: 2,
      energy: D.ENERGY_MAX,
      energyTimer: 0,
      // fossil pieces collected: { fossilId: {skull:n, body:n, legs:n, tail:n} }
      pieces: {},
      // mounted skeletons -> counts by fossil id
      mounted: {},
      // ore inventory counts
      ores: {},
      // owned catalog item counts (for cost scaling)
      owned: {},
      // museum placements: [{id, cx, cy}] where id is fossil (exhibit) or catalog item
      museum: [],
      // unlocked site ids
      sites: { quarry: true },
      // per-site persistent boards so a dig can be resumed
      boards: {},
      // stats
      stats: { digs: 0, found: 0, visitorsPeak: 0, mounted: 0 },
      // progression
      level: 1,
      xp: 0,
      lastSeen: nowMs(),
      muted: false,
      firstRun: true,
    };
    return s;
  }

  function nowMs() {
    // Date.now is fine in the browser runtime; guarded for safety.
    return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
  }

  let state = freshState();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { state = freshState(); return false; }
      const parsed = JSON.parse(raw);
      state = Object.assign(freshState(), parsed);
      // ensure nested objects exist
      state.pieces = state.pieces || {};
      state.mounted = state.mounted || {};
      state.ores = state.ores || {};
      state.owned = state.owned || {};
      state.museum = state.museum || [];
      state.sites = state.sites || { quarry: true };
      state.boards = state.boards || {};
      state.stats = Object.assign({ digs: 0, found: 0, visitorsPeak: 0, mounted: 0 }, state.stats || {});
      return true;
    } catch (e) {
      state = freshState();
      return false;
    }
  }

  let saveTimer = null;
  function save() {
    state.lastSeen = nowMs();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 800);
  }

  function reset() {
    state = freshState();
    state.firstRun = false;
    save();
  }

  // --- resources -----------------------------------------------------------
  function addCoins(n) { state.coins = Math.max(0, Math.round(state.coins + n)); saveSoon(); }
  function addGems(n) { state.gems = Math.max(0, state.gems + n); saveSoon(); }
  function canAfford(coins, gems) {
    return state.coins >= (coins || 0) && state.gems >= (gems || 0);
  }
  function spend(coins, gems) {
    if (!canAfford(coins, gems)) return false;
    state.coins -= (coins || 0);
    state.gems -= (gems || 0);
    saveSoon();
    return true;
  }

  // --- xp / level ----------------------------------------------------------
  function xpForLevel(lvl) { return 100 + (lvl - 1) * 80; }
  function addXp(n) {
    state.xp += n;
    let leveled = false;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level++;
      leveled = true;
    }
    saveSoon();
    return leveled;
  }

  // --- pieces / fossils ----------------------------------------------------
  function addPiece(fossilId, piece) {
    if (!state.pieces[fossilId]) state.pieces[fossilId] = { skull: 0, body: 0, legs: 0, tail: 0 };
    state.pieces[fossilId][piece] = (state.pieces[fossilId][piece] || 0) + 1;
    saveSoon();
  }
  function pieceCount(fossilId, piece) {
    return (state.pieces[fossilId] && state.pieces[fossilId][piece]) || 0;
  }
  function canAssemble(fossilId) {
    const p = state.pieces[fossilId];
    if (!p) return false;
    return p.skull > 0 && p.body > 0 && p.legs > 0 && p.tail > 0;
  }
  function assemble(fossilId) {
    if (!canAssemble(fossilId)) return false;
    const p = state.pieces[fossilId];
    p.skull--; p.body--; p.legs--; p.tail--;
    state.mounted[fossilId] = (state.mounted[fossilId] || 0) + 1;
    state.stats.mounted++;
    saveSoon();
    return true;
  }

  // --- ores ----------------------------------------------------------------
  function addOre(oreId, n) { state.ores[oreId] = (state.ores[oreId] || 0) + (n || 1); saveSoon(); }
  function sellOre(oreId) {
    const ore = D.oreById(oreId);
    if (!ore || (state.ores[oreId] || 0) <= 0) return false;
    state.ores[oreId]--;
    addCoins(ore.coins);
    if (ore.gems) addGems(ore.gems);
    return true;
  }
  function sellAllOre(oreId) {
    let n = state.ores[oreId] || 0;
    let coins = 0, gems = 0;
    const ore = D.oreById(oreId);
    if (!ore) return { coins: 0, gems: 0 };
    state.ores[oreId] = 0;
    coins = ore.coins * n; gems = (ore.gems || 0) * n;
    addCoins(coins); if (gems) addGems(gems);
    return { coins: coins, gems: gems, n: n };
  }

  // --- museum grid ---------------------------------------------------------
  function itemFootprint(id) {
    // exhibit (fossil) = 2x2; else catalog footprint
    if (D.fossilById(id)) return { w: 2, h: 2 };
    const c = D.catalogById(id);
    return c ? { w: c.w, h: c.h } : { w: 1, h: 1 };
  }

  function cellFree(cx, cy, w, h, ignoreIndex) {
    if (cx < 0 || cy < 0 || cx + w > MW || cy + h > MH) return false;
    for (let i = 0; i < state.museum.length; i++) {
      if (i === ignoreIndex) continue;
      const it = state.museum[i];
      const fp = itemFootprint(it.id);
      if (cx < it.cx + fp.w && cx + w > it.cx && cy < it.cy + fp.h && cy + h > it.cy) {
        return false;
      }
    }
    return true;
  }

  function placeItem(id, cx, cy) {
    const fp = itemFootprint(id);
    if (!cellFree(cx, cy, fp.w, fp.h)) return false;
    state.museum.push({ id: id, cx: cx, cy: cy });
    saveSoon();
    return true;
  }

  function findFreeCell(id) {
    const fp = itemFootprint(id);
    for (let cy = 0; cy <= MH - fp.h; cy++) {
      for (let cx = 0; cx <= MW - fp.w; cx++) {
        if (cellFree(cx, cy, fp.w, fp.h)) return { cx: cx, cy: cy };
      }
    }
    return null;
  }

  function moveItem(index, cx, cy) {
    const it = state.museum[index];
    if (!it) return false;
    const fp = itemFootprint(it.id);
    if (!cellFree(cx, cy, fp.w, fp.h, index)) return false;
    it.cx = cx; it.cy = cy;
    saveSoon();
    return true;
  }

  function removeItem(index) {
    const it = state.museum[index];
    if (!it) return null;
    state.museum.splice(index, 1);
    saveSoon();
    return it;
  }

  // --- derived: wonder, income, satisfaction -------------------------------
  function computeStats() {
    let wonder = 0, income = 0, comfort = 0, exhibits = 0, facilities = 0;
    // mounted skeletons on display
    for (let i = 0; i < state.museum.length; i++) {
      const it = state.museum[i];
      const fos = D.fossilById(it.id);
      if (fos) {
        wonder += fos.value / 8;
        income += fos.income;
        exhibits++;
        continue;
      }
      const cat = D.catalogById(it.id);
      if (cat) {
        wonder += cat.wonder || 0;
        income += cat.income || 0;
        comfort += cat.comfort || 0;
        if (cat.kind === 'facility') facilities++;
      }
    }
    // satisfaction 0..1 from comfort vs number of exhibits (crowd draw)
    const demand = Math.max(1, exhibits * 3);
    const satisfaction = Math.max(0.35, Math.min(1.35, 0.6 + comfort / demand * 0.5));
    // visitors scale with wonder, capped, boosted by satisfaction
    const visitors = Math.floor(Math.sqrt(wonder) * 1.6 * satisfaction);
    // coins per second: exhibit income * satisfaction + facilities
    const cps = income * satisfaction;
    if (visitors > state.stats.visitorsPeak) state.stats.visitorsPeak = visitors;
    return {
      wonder: Math.round(wonder),
      cps: cps,
      satisfaction: satisfaction,
      visitors: visitors,
      exhibits: exhibits,
      facilities: facilities,
      comfort: comfort,
    };
  }

  // --- energy --------------------------------------------------------------
  function tickEnergy(dt) {
    if (state.energy >= D.ENERGY_MAX) { state.energyTimer = 0; return; }
    state.energyTimer += dt;
    while (state.energyTimer >= D.ENERGY_REGEN_MS && state.energy < D.ENERGY_MAX) {
      state.energyTimer -= D.ENERGY_REGEN_MS;
      state.energy++;
      saveSoon();
    }
  }
  function useEnergy(n) {
    n = n || 1;
    if (state.energy < n) return false;
    state.energy -= n;
    saveSoon();
    return true;
  }
  function refillEnergy() {
    if (!spend(0, D.ENERGY_REFILL_GEM_COST)) return false;
    state.energy = D.ENERGY_MAX;
    state.energyTimer = 0;
    saveSoon();
    return true;
  }

  // --- offline income ------------------------------------------------------
  // On load, grant a fraction of idle income for time away (capped).
  function claimOffline() {
    const now = nowMs();
    const away = Math.max(0, now - (state.lastSeen || now));
    if (away < 60000) return null; // ignore < 1 min
    const st = computeStats();
    const cappedSec = Math.min(away / 1000, 60 * 60 * 8); // cap 8h
    const earned = Math.floor(st.cps * cappedSec * 0.5); // 50% idle rate
    // also regen energy for time away
    const eGain = Math.floor(away / D.ENERGY_REGEN_MS);
    state.energy = Math.min(D.ENERGY_MAX, state.energy + eGain);
    if (earned > 0) addCoins(earned);
    state.lastSeen = now;
    save();
    if (earned <= 0) return null;
    return { coins: earned, hours: (cappedSec / 3600) };
  }

  window.GameState = {
    MW: MW, MH: MH,
    get: function () { return state; },
    load: load, save: save, saveSoon: saveSoon, reset: reset,
    nowMs: nowMs,
    addCoins: addCoins, addGems: addGems, canAfford: canAfford, spend: spend,
    addXp: addXp, xpForLevel: xpForLevel,
    addPiece: addPiece, pieceCount: pieceCount, canAssemble: canAssemble, assemble: assemble,
    addOre: addOre, sellOre: sellOre, sellAllOre: sellAllOre,
    itemFootprint: itemFootprint, cellFree: cellFree, placeItem: placeItem,
    findFreeCell: findFreeCell, moveItem: moveItem, removeItem: removeItem,
    computeStats: computeStats,
    tickEnergy: tickEnergy, useEnergy: useEnergy, refillEnergy: refillEnergy,
    claimOffline: claimOffline,
  };
})();
