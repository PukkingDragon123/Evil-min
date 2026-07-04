// ---------------------------------------------------------------------------
// Excavation board (v2) - an INVERTED minesweeper. The hidden "mines" are the
// treasures: fossil nodes, ore veins and gem geodes. Numbers on surveyed tiles
// count adjacent BURIED TREASURES. Deduce where they are, then send a dig team
// to EXCAVATE them for a pristine find; careless SURVEYING onto a node yields a
// damaged one. Clear every node to unlock DIG DEEPER (the next depth level).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;
  const S = window.GameState;

  function rnd() { return Math.random(); }
  function ri(n) { return (Math.random() * n) | 0; }

  function depthOf(site) { return S.get().depth[site.id] || 1; }

  function boardDims(site, depth) {
    const grow = Math.min(3, Math.floor((depth - 1) / 2));
    return {
      cols: Math.min(15, site.cols + grow),
      rows: Math.min(13, site.rows + grow),
      nodes: site.nodes + (depth - 1) * 2,
    };
  }

  function makeBoard(site, depth) {
    const dim = boardDims(site, depth);
    const cells = [];
    for (let i = 0; i < dim.cols * dim.rows; i++) {
      cells.push({ revealed: false, flagged: false, node: null, extracted: false, adj: 0 });
    }
    return {
      siteId: site.id, depth: depth, cols: dim.cols, rows: dim.rows,
      nodeTotal: dim.nodes, nodesLeft: dim.nodes,
      cells: cells, generated: false, surveys: 0, misfires: 0,
    };
  }

  function getBoard(site) {
    const st = S.get();
    const depth = depthOf(site);
    let b = st.boards[site.id];
    if (!b || b.depth !== depth || !b.cells) { b = makeBoard(site, depth); st.boards[site.id] = b; }
    return b;
  }

  function idx(b, x, y) { return y * b.cols + x; }
  function inBounds(b, x, y) { return x >= 0 && y >= 0 && x < b.cols && y < b.rows; }
  function neighbors(b, x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (inBounds(b, x + dx, y + dy)) out.push([x + dx, y + dy]);
    }
    return out;
  }

  function pickSpecies(site, depth) {
    let id = D.weightedKey(site.species);
    // deeper digs bias toward rarer species
    const p = Math.min(0.7, (depth - 1) * 0.1);
    if (rnd() < p) {
      const id2 = D.weightedKey(site.species);
      const r1 = D.RARITY_ORDER.indexOf(D.fossilById(id).rarity);
      const r2 = D.RARITY_ORDER.indexOf(D.fossilById(id2).rarity);
      if (r2 > r1) id = id2;
    }
    return id;
  }

  function makeFossilNode(site, depth) {
    const fid = pickSpecies(site, depth);
    const f = D.fossilById(fid);
    const pool = D.RARITY_SHAPES[f.rarity];
    const shape = pool[ri(pool.length)];
    const cells = D.shapeCells(shape).map(function (c) { return [c[0], c[1]]; });
    return { type: 'fossil', fossilId: fid, rarity: f.rarity, shape: shape, cells: cells };
  }

  function pickCurio(site) {
    const weights = D.CURIO_BIOME[site.biome] || { bug: 1, plant: 1, artifact: 1 };
    const cat = D.weightedKey(weights);
    const pool = D.CURIOS.filter(function (c) { return c.cat === cat; });
    if (!pool.length) return D.CURIOS[0].id;
    return pool[ri(pool.length)].id;
  }

  function makeNode(site, depth) {
    if (rnd() < (site.gemRate || 0.1)) {
      return { type: 'gem', amount: 1 + ri(1 + Math.floor(depth / 3)) };
    }
    if (rnd() < D.CURIO_RATE) {
      return { type: 'curio', curioId: pickCurio(site) };
    }
    if (rnd() < 0.34) {
      return { type: 'ore', oreId: D.weightedKey(site.ores) };
    }
    return makeFossilNode(site, depth);
  }

  function generate(b, site, safeX, safeY) {
    const forbidden = {};
    forbidden[idx(b, safeX, safeY)] = true;
    neighbors(b, safeX, safeY).forEach(function (n) { forbidden[idx(b, n[0], n[1])] = true; });

    const total = b.cols * b.rows;
    let placed = 0, guard = 0;
    while (placed < b.nodeTotal && guard < 20000) {
      guard++;
      const c = ri(total);
      if (forbidden[c] || b.cells[c].node) continue;
      b.cells[c].node = makeNode(site, b.depth);
      placed++;
    }
    b.nodeTotal = placed; b.nodesLeft = placed;
    // adjacency = count of neighbor nodes
    for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
      const cell = b.cells[idx(b, x, y)];
      if (cell.node) continue;
      let n = 0;
      neighbors(b, x, y).forEach(function (nb) { if (b.cells[idx(b, nb[0], nb[1])].node) n++; });
      cell.adj = n;
    }
    b.generated = true;
  }

  // SURVEY: reveal a hidden tile (cheap, informative). Cascades on 0.
  // Hitting a node = careless find (damaged unless the Survey Kit saves it).
  function survey(b, site, x, y) {
    const res = { revealed: [], hit: null, cascade: 0 };
    if (!inBounds(b, x, y)) return res;
    if (!b.generated) generate(b, site, x, y);
    const start = b.cells[idx(b, x, y)];
    if (start.revealed || start.extracted) return res;

    if (start.node) {
      // careless extraction
      const pristine = Math.random() < window.Upgrades.surveyPristine();
      start.revealed = true; start.extracted = true;
      b.nodesLeft--; b.surveys++;
      res.hit = { node: start.node, pristine: pristine, x: x, y: y };
      S.saveSoon();
      return res;
    }

    // flood fill through empty tiles (never through nodes)
    const stack = [[x, y]]; const seen = {}; seen[idx(b, x, y)] = true;
    while (stack.length) {
      const cur = stack.pop();
      const cx = cur[0], cy = cur[1];
      const cell = b.cells[idx(b, cx, cy)];
      if (cell.revealed || cell.node || cell.extracted) continue;
      cell.revealed = true; cell.flagged = false;
      res.revealed.push([cx, cy]); res.cascade++;
      if (cell.adj === 0) {
        neighbors(b, cx, cy).forEach(function (nb) {
          const ni = idx(b, nb[0], nb[1]);
          if (!seen[ni] && !b.cells[ni].node && !b.cells[ni].revealed) { seen[ni] = true; stack.push([nb[0], nb[1]]); }
        });
      }
    }
    b.surveys++;
    S.saveSoon();
    return res;
  }

  // EXCAVATE: send a dig team to a specific tile (costs more). Pristine on a
  // real node; a miss just reveals the number (a wasted dig).
  function excavate(b, site, x, y) {
    const res = { extracted: null, miss: false };
    if (!inBounds(b, x, y)) return res;
    if (!b.generated) generate(b, site, x, y);
    const cell = b.cells[idx(b, x, y)];
    if (cell.revealed || cell.extracted) return res;

    if (cell.node) {
      cell.revealed = true; cell.extracted = true; cell.flagged = false;
      b.nodesLeft--;
      res.extracted = { node: cell.node, pristine: true, x: x, y: y };
      S.saveSoon();
      return res;
    }
    // miss: reveal as number
    cell.revealed = true; cell.flagged = false; b.misfires++;
    res.miss = true; res.adj = cell.adj;
    S.saveSoon();
    return res;
  }

  function toggleFlag(b, x, y) {
    if (!inBounds(b, x, y)) return false;
    const c = b.cells[idx(b, x, y)];
    if (c.revealed || c.extracted) return false;
    c.flagged = !c.flagged; S.saveSoon(); return c.flagged;
  }

  function nodesLeft(b) { return b.generated ? b.nodesLeft : b.nodeTotal; }
  function isCleared(b) { return b.generated && b.nodesLeft <= 0; }
  function flagCount(b) {
    let n = 0; for (let i = 0; i < b.cells.length; i++) if (b.cells[i].flagged && !b.cells[i].revealed) n++;
    return n;
  }

  function descend(site) {
    const st = S.get();
    const d = (st.depth[site.id] || 1) + 1;
    st.depth[site.id] = d;
    st.maxDepth[site.id] = Math.max(st.maxDepth[site.id] || 1, d);
    st.stats.deepest = Math.max(st.stats.deepest || 1, d);
    st.boards[site.id] = makeBoard(site, d);
    S.saveSoon();
    return d;
  }
  function resetToTop(site) {
    const st = S.get();
    st.depth[site.id] = 1;
    st.boards[site.id] = makeBoard(site, 1);
    S.saveSoon();
  }
  function regenerate(site) {
    const st = S.get();
    st.boards[site.id] = makeBoard(site, depthOf(site));
    S.saveSoon();
    return st.boards[site.id];
  }

  window.Dig = {
    getBoard: getBoard, survey: survey, excavate: excavate, toggleFlag: toggleFlag,
    nodesLeft: nodesLeft, isCleared: isCleared, flagCount: flagCount,
    descend: descend, resetToTop: resetToTop, regenerate: regenerate, depthOf: depthOf,
    inBounds: inBounds, idx: idx,
  };
})();
