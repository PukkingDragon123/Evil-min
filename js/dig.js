// ---------------------------------------------------------------------------
// Excavation board — minesweeper-style. A site is a grid of buried dirt tiles.
// Reveal a tile (costs energy); numbers show how many adjacent tiles hide a
// HAZARD (gas pocket / unstable boulder). Empty tiles cascade open. Tiles can
// hide loot: fossil pieces, ore, coins, or gems. Flag suspected hazards.
// Boards persist per-site so a dig can be paused and resumed.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;
  const S = window.GameState;

  function rnd() { return Math.random(); }

  function makeBoard(site) {
    const cells = [];
    for (let i = 0; i < site.cols * site.rows; i++) {
      cells.push({ revealed: false, flagged: false, hazard: false, content: null, adj: 0, exploded: false });
    }
    return {
      siteId: site.id, cols: site.cols, rows: site.rows,
      hazards: site.hazards, cells: cells,
      generated: false, safeLeft: 0, foundCount: 0, hits: 0,
    };
  }

  function getBoard(site) {
    const st = S.get();
    if (!st.boards[site.id]) st.boards[site.id] = makeBoard(site);
    const b = st.boards[site.id];
    // migrate/repair if dimensions changed
    if (b.cols !== site.cols || b.rows !== site.rows || !b.cells) {
      st.boards[site.id] = makeBoard(site);
      return st.boards[site.id];
    }
    return b;
  }

  function idx(b, x, y) { return y * b.cols + x; }
  function inBounds(b, x, y) { return x >= 0 && y >= 0 && x < b.cols && y < b.rows; }

  function neighbors(b, x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (inBounds(b, x + dx, y + dy)) out.push([x + dx, y + dy]);
      }
    }
    return out;
  }

  function weightedPick(table) {
    let total = 0;
    for (let i = 0; i < table.length; i++) total += table[i].weight;
    let r = rnd() * total;
    for (let i = 0; i < table.length; i++) {
      r -= table[i].weight;
      if (r <= 0) return table[i];
    }
    return table[table.length - 1];
  }

  function rollLoot(site) {
    const entry = weightedPick(site.loot);
    if (entry.type === 'piece') {
      const fossilId = entry.pool[(rnd() * entry.pool.length) | 0];
      const piece = D.PIECES[(rnd() * D.PIECES.length) | 0];
      return { type: 'piece', fossilId: fossilId, piece: piece };
    }
    if (entry.type === 'ore') {
      const oreId = entry.pool[(rnd() * entry.pool.length) | 0];
      return { type: 'ore', oreId: oreId };
    }
    if (entry.type === 'coins') {
      const amt = entry.min + ((rnd() * (entry.max - entry.min + 1)) | 0);
      return { type: 'coins', amount: amt };
    }
    if (entry.type === 'gem') {
      return { type: 'gem', amount: entry.amount || 1 };
    }
    return { type: 'coins', amount: 10 };
  }

  // Generate hazards + loot AFTER the first reveal, keeping the first cell and
  // its neighbors hazard-free (classic minesweeper "safe first click").
  function generate(b, site, safeX, safeY) {
    const forbidden = {};
    forbidden[idx(b, safeX, safeY)] = true;
    const nb = neighbors(b, safeX, safeY);
    for (let i = 0; i < nb.length; i++) forbidden[idx(b, nb[i][0], nb[i][1])] = true;

    let placed = 0;
    const total = b.cols * b.rows;
    let guard = 0;
    while (placed < b.hazards && guard < 10000) {
      guard++;
      const c = (rnd() * total) | 0;
      if (forbidden[c] || b.cells[c].hazard) continue;
      b.cells[c].hazard = true;
      placed++;
    }

    // adjacency counts
    for (let y = 0; y < b.rows; y++) {
      for (let x = 0; x < b.cols; x++) {
        const cell = b.cells[idx(b, x, y)];
        if (cell.hazard) continue;
        let n = 0;
        const ns = neighbors(b, x, y);
        for (let i = 0; i < ns.length; i++) {
          if (b.cells[idx(b, ns[i][0], ns[i][1])].hazard) n++;
        }
        cell.adj = n;
      }
    }

    // loot on ~24% of safe cells
    const safeCells = [];
    for (let i = 0; i < total; i++) if (!b.cells[i].hazard) safeCells.push(i);
    b.safeLeft = safeCells.length;
    const lootCount = Math.max(4, Math.round(safeCells.length * 0.24));
    // shuffle safeCells
    for (let i = safeCells.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = safeCells[i]; safeCells[i] = safeCells[j]; safeCells[j] = t;
    }
    for (let i = 0; i < lootCount && i < safeCells.length; i++) {
      // don't put loot directly on the guaranteed first cell (feels bad to skip)
      if (safeCells[i] === idx(b, safeX, safeY)) continue;
      b.cells[safeCells[i]].content = rollLoot(site);
    }
    b.generated = true;
  }

  // Reveal a single cell, cascading through empty (adj==0, no content) tiles.
  // Returns { rewards:[], hazard:bool, revealedCount } for the caller/UI.
  function reveal(b, site, x, y) {
    const result = { rewards: [], hazard: false, revealedCount: 0, exploded: null };
    if (!inBounds(b, x, y)) return result;
    if (!b.generated) generate(b, site, x, y);

    const start = b.cells[idx(b, x, y)];
    if (start.revealed || start.flagged) return result;

    if (start.hazard) {
      start.revealed = true;
      start.exploded = true;
      b.hits++;
      result.hazard = true;
      result.exploded = { x: x, y: y };
      S.saveSoon();
      return result;
    }

    // BFS/flood fill
    const stack = [[x, y]];
    const seen = {};
    seen[idx(b, x, y)] = true;
    while (stack.length) {
      const cur = stack.pop();
      const cx = cur[0], cy = cur[1];
      const cell = b.cells[idx(b, cx, cy)];
      if (cell.revealed || cell.flagged || cell.hazard) continue;
      cell.revealed = true;
      b.safeLeft--;
      result.revealedCount++;
      if (cell.content) {
        result.rewards.push({ x: cx, y: cy, content: cell.content });
      }
      // cascade only through truly empty tiles (no number, no content)
      if (cell.adj === 0 && !cell.content) {
        const ns = neighbors(b, cx, cy);
        for (let i = 0; i < ns.length; i++) {
          const ni = idx(b, ns[i][0], ns[i][1]);
          if (!seen[ni] && !b.cells[ni].revealed && !b.cells[ni].hazard) {
            seen[ni] = true;
            stack.push([ns[i][0], ns[i][1]]);
          }
        }
      }
    }
    // apply rewards to state
    for (let i = 0; i < result.rewards.length; i++) {
      applyReward(result.rewards[i].content);
      b.foundCount++;
    }
    S.saveSoon();
    return result;
  }

  function applyReward(content) {
    if (content.type === 'piece') {
      S.addPiece(content.fossilId, content.piece);
    } else if (content.type === 'ore') {
      S.addOre(content.oreId, 1);
    } else if (content.type === 'coins') {
      S.addCoins(content.amount);
    } else if (content.type === 'gem') {
      S.addGems(content.amount);
    }
  }

  function toggleFlag(b, x, y) {
    if (!inBounds(b, x, y)) return false;
    const cell = b.cells[idx(b, x, y)];
    if (cell.revealed) return false;
    cell.flagged = !cell.flagged;
    S.saveSoon();
    return cell.flagged;
  }

  // How many safe (non-hazard) cells remain hidden.
  function remainingSafe(b) {
    if (!b.generated) return b.cols * b.rows - b.hazards;
    let n = 0;
    for (let i = 0; i < b.cells.length; i++) {
      if (!b.cells[i].hazard && !b.cells[i].revealed) n++;
    }
    return n;
  }

  function isCleared(b) {
    return b.generated && remainingSafe(b) === 0;
  }

  // Fresh section: regenerate the board (used when cleared or player resets).
  function regenerate(site) {
    const st = S.get();
    st.boards[site.id] = makeBoard(site);
    S.saveSoon();
    return st.boards[site.id];
  }

  // Count flags placed (for UI hazard counter).
  function flagCount(b) {
    let n = 0;
    for (let i = 0; i < b.cells.length; i++) if (b.cells[i].flagged && !b.cells[i].revealed) n++;
    return n;
  }

  window.Dig = {
    getBoard: getBoard,
    reveal: reveal,
    toggleFlag: toggleFlag,
    remainingSafe: remainingSafe,
    isCleared: isCleared,
    regenerate: regenerate,
    flagCount: flagCount,
    inBounds: inBounds,
    idx: idx,
  };
})();
