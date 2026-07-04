// ---------------------------------------------------------------------------
// Field storage: a Block-Blast style packing grid. Excavated fossil blocks are
// polyominoes you drop into the grid; completing a full row or column clears
// those cells and "banks" the fossils (coins + XP + species progress toward
// mounting a skeleton). Grid size grows via the Storage upgrade.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const S = window.GameState;
  const D = window.GameData;

  function grid() { return S.get().grid; }
  function size() { return grid().size; }
  function at(x, y) { const g = grid(); return g.cells[y * g.size + x]; }
  function setAt(x, y, v) { const g = grid(); g.cells[y * g.size + x] = v; }

  function inBounds(x, y) { const n = size(); return x >= 0 && y >= 0 && x < n && y < n; }

  // Can `block` (normalized cells) be placed with its origin at (gx,gy)?
  function canPlace(block, gx, gy) {
    const cells = block.cells;
    for (let i = 0; i < cells.length; i++) {
      const x = gx + cells[i][0], y = gy + cells[i][1];
      if (!inBounds(x, y) || at(x, y)) return false;
    }
    return true;
  }

  // Does the block fit anywhere at all?
  function hasAnyMove(block) {
    const n = size();
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (canPlace(block, x, y)) return true;
    return false;
  }

  // Place a block, then resolve full-row/col clears. Returns a rich summary
  // for the UI/FX layer.
  function place(block, gx, gy) {
    if (!canPlace(block, gx, gy)) return null;
    const placed = [];
    for (let i = 0; i < block.cells.length; i++) {
      const x = gx + block.cells[i][0], y = gy + block.cells[i][1];
      setAt(x, y, { id: block.fossilId, rarity: block.rarity });
      placed.push([x, y]);
    }
    const clear = resolveClears();
    S.saveSoon();
    return { placed: placed, cleared: clear.cells, lines: clear.lines, banked: clear.banked, coins: clear.coins, xp: clear.xp };
  }

  // Find and clear full rows and columns.
  function resolveClears() {
    const n = size();
    const fullRows = [], fullCols = [];
    for (let y = 0; y < n; y++) {
      let full = true;
      for (let x = 0; x < n; x++) if (!at(x, y)) { full = false; break; }
      if (full) fullRows.push(y);
    }
    for (let x = 0; x < n; x++) {
      let full = true;
      for (let y = 0; y < n; y++) if (!at(x, y)) { full = false; break; }
      if (full) fullCols.push(x);
    }
    const toClear = {};
    fullRows.forEach(function (y) { for (let x = 0; x < n; x++) toClear[y * n + x] = true; });
    fullCols.forEach(function (x) { for (let y = 0; y < n; y++) toClear[y * n + x] = true; });

    const cells = [], bankMap = {};
    let coins = 0, xp = 0;
    const lines = fullRows.length + fullCols.length;
    const combo = 1 + Math.max(0, lines - 1) * 0.5; // combo bonus
    for (const key in toClear) {
      const idx = +key; const x = idx % n, y = (idx / n) | 0;
      const cell = at(x, y);
      cells.push([x, y]);
      if (cell) {
        const rc = D.RARITY[cell.rarity] || D.RARITY.common;
        const val = Math.round(rc.cell * combo);
        coins += val; xp += 1;
        bankMap[cell.id] = (bankMap[cell.id] || 0) + 1;
      }
      setAt(x, y, null);
    }
    // apply banking
    const banked = [];
    for (const id in bankMap) {
      S.addSpecies(id, bankMap[id]);
      banked.push({ fossilId: id, count: bankMap[id] });
    }
    if (coins > 0) { S.addCoins(coins); S.addXp(xp); S.get().stats.cleared += cells.length; }
    return { cells: cells, lines: lines, banked: banked, coins: coins, xp: xp };
  }

  // Emergency "ship it": bank every occupied cell at reduced value and empty.
  function shipAll() {
    const n = size(); const bankMap = {}; let coins = 0, count = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = at(x, y);
      if (c) {
        const rc = D.RARITY[c.rarity] || D.RARITY.common;
        coins += Math.round(rc.cell * 0.6);
        bankMap[c.id] = (bankMap[c.id] || 0) + 1;
        count++; setAt(x, y, null);
      }
    }
    for (const id in bankMap) S.addSpecies(id, bankMap[id]);
    if (coins > 0) { S.addCoins(coins); S.addXp(Math.round(count / 2)); }
    S.saveSoon();
    return { coins: coins, count: count };
  }

  function occupied() {
    const g = grid(); let n = 0;
    for (let i = 0; i < g.cells.length; i++) if (g.cells[i]) n++;
    return n;
  }
  function isFull() { return occupied() >= size() * size(); }

  window.Inventory = {
    size: size, at: at, inBounds: inBounds,
    canPlace: canPlace, hasAnyMove: hasAnyMove, place: place,
    shipAll: shipAll, occupied: occupied, isFull: isFull,
  };
})();
