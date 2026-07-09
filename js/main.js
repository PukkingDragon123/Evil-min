// ---------------------------------------------------------------------------
// Boot, main loop, input routing, and the top-level "app" state (v2).
// Wires the inverted-minesweeper dig, the Block-Blast storage grid, the
// museum, the shop, upgrades and all FX together.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const S = window.GameState, D = window.GameData, R = window.Render, UI = window.UI;
  const Au = window.Audio2, Dig = window.Dig, Inv = window.Inventory, U = window.Upgrades, FX = window.FX;
  const VW = R.VW, VH = R.VH;
  function C() { return window.Assets.C; }
  function emit(type, val) { if (window.Quests) window.Quests.emit(type, val); if (window.Tutorial) window.Tutorial.emit(type); }

  function resize() {
    const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);

  // =========================================================================
  // APP STATE
  // =========================================================================
  const app = {
    screen: 'menu', menuView: 'main', offlineShown: false,
    tab: 'museum', siteId: 'quarry',
    editMode: false, placement: null, selectedItem: -1,
    modal: null, scrollY: 0, scrollMax: 0, scrollRegion: null,
    shopCat: 'nature', activePiece: 0, collTab: 'fossils',
    invGhost: null, invLayout: null, digCursor: null, digLayout: null,
    hold: null, digAnims: [], offlineData: null,
    streak: 0, expSelected: null,

    openMenu: function () { this.screen = 'menu'; this.menuView = 'main'; this.hold = null; this.modal = null; },
    enterGame: function () {
      this.menuView = 'main'; this.screen = 'game'; const st = S.get();
      if (st.firstRun) { st.firstRun = false; window.Tutorial.begin(); this.tab = 'museum'; S.saveSoon(); }
      if (this.offlineData && !this.offlineShown) { this.offlineShown = true; this.openModal('offline'); }
    },
    newGame: function () {
      S.reset(); window.Tutorial.begin();
      this.menuView = 'main'; this.screen = 'game'; this.tab = 'museum'; this.siteId = 'quarry';
      this.activePiece = 0; this.selectedItem = -1; this.editMode = false; this.placement = null;
      this.offlineData = null; this.offlineShown = true;
    },
    setTab: function (id) { this.tab = id; this.editMode = false; this.selectedItem = -1; if (id !== 'museum' && this.placement) this.cancelPlacement(); if (id === 'storage') this.activePiece = Math.min(this.activePiece, Math.max(0, S.get().queue.length - 1)); emit('tab' + id.charAt(0).toUpperCase() + id.slice(1)); },
    openModal: function (n) { this.modal = n; this.scrollY = 0; },
    closeModal: function () { this.modal = null; },
    beginPlacement: function (id, cost, gems) { const c = S.findFreeCell(id) || { cx: 0, cy: 0 }; this.placement = { id: id, cost: cost, gems: gems, moveIndex: -1, cx: c.cx, cy: c.cy, valid: true }; this.setTab('museum'); this.updateGhostValid(); },
    startMove: function (i) { const it = S.curMuseum()[i]; if (!it) return; this.placement = { id: it.id, cost: 0, gems: 0, moveIndex: i, cx: it.cx, cy: it.cy, valid: true }; this.selectedItem = -1; this.editMode = true; UI.toast('Tap a new spot', C().cyan); },
    cancelPlacement: function () { this.placement = null; },
    updateGhostValid: function () { if (!this.placement) return; const fp = S.itemFootprint(this.placement.id); this.placement.valid = S.cellFree(this.placement.cx, this.placement.cy, fp.w, fp.h, this.placement.moveIndex >= 0 ? this.placement.moveIndex : undefined); },
    commitPlacement: function (cx, cy) {
      const p = this.placement; if (!p) return;
      const fp = S.itemFootprint(p.id);
      cx = Math.max(0, Math.min(S.MW - fp.w, cx)); cy = Math.max(0, Math.min(S.MH - fp.h, cy));
      const ignore = p.moveIndex >= 0 ? p.moveIndex : undefined;
      if (!S.cellFree(cx, cy, fp.w, fp.h, ignore)) { Au.play('error'); UI.toast('Blocked - try elsewhere', C().salmon); return; }
      if (p.moveIndex >= 0) { S.moveItem(p.moveIndex, cx, cy); Au.play('place'); }
      else {
        if (!S.spend(p.cost, p.gems)) { Au.play('error'); UI.toast('Cannot afford', C().salmon); this.placement = null; return; }
        S.placeItem(p.id, cx, cy); S.get().owned[p.id] = (S.get().owned[p.id] || 0) + 1; Au.play('place'); S.addXp(6); UI.toast(UI.displayName(p.id) + ' placed!', C().lime);
        const cat = D.catalogById(p.id); if (cat) { emit(cat.kind === 'facility' ? 'facility' : 'deco'); if (cat.shelf) emit('shelf'); }
      }
      this.placement = null; S.saveSoon();
    },
    sellItem: function (i) {
      const st = S.get(); const it = S.curMuseum()[i]; if (!it) return;
      const fos = D.fossilById(it.id); let refund = 0;
      if (fos) { refund = Math.round(D.RARITY[fos.rarity].cell * 3); st.mounted[it.id] = Math.max(0, (st.mounted[it.id] || 1) - 1); st.stats.mounted = Math.max(0, st.stats.mounted - 1); }
      else { const cat = D.catalogById(it.id); if (cat) { const owned = st.owned[it.id] || 1; refund = Math.floor(D.scaledCost(cat.cost, owned - 1) * 0.5); st.owned[it.id] = Math.max(0, owned - 1); } }
      S.removeItem(i); S.addCoins(refund); this.selectedItem = -1; UI.toast('Sold for ' + refund + ' coins', C().yellow); S.saveSoon();
    },
    celebrate: function (fossilId) {
      const m = S.curMuseum(); let target = null;
      for (let i = m.length - 1; i >= 0; i--) if (m[i].id === fossilId) { target = m[i]; break; }
      let px = VW / 2, py = VH / 2;
      if (target) { const fp = S.itemFootprint(fossilId); const p = window.Museum.cellToPx(target.cx + fp.w / 2, target.cy); px = p.x; py = p.y - 10; }
      FX.confetti(px, py, 44); FX.ring(px, py, D.RARITY[D.fossilById(fossilId).rarity].glow, 28);
    },
  };

  // =========================================================================
  // INPUT
  // =========================================================================
  function toLogical(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / r.width * VW, y: (cy - r.top) / r.height * VH }; }
  let pointerDown = false, downPos = null, moved = false, scrollDragging = false, lastPointer = { x: 0, y: 0 };
  const HOLD_MS = 340; // hold this long on a dig tile to send a dig team

  function onDown(x, y) {
    Au.resume(); pointerDown = true; downPos = { x: x, y: y }; lastPointer = { x: x, y: y }; moved = false;
    app.hold = null;
    if (app.modal && app.scrollRegion && inRect(x, y, app.scrollRegion)) scrollDragging = true;
    // press-and-hold a dig tile to send an excavation team
    if (app.screen === 'game' && app.tab === 'dig' && !app.modal && app.digLayout) {
      const cell = R.screenToDigCell(app.digLayout, x, y);
      if (cell) {
        const b = Dig.getBoard(D.siteById(app.siteId));
        const c = b.cells[cell.y * b.cols + cell.x];
        if (!c.revealed && !c.extracted) app.hold = { x: cell.x, y: cell.y, elapsed: 0, done: false };
      }
    }
  }
  function onMove(x, y) {
    if (!pointerDown) { updateHover(x, y); return; }
    if (Math.abs(x - downPos.x) > 3 || Math.abs(y - downPos.y) > 3) { moved = true; app.hold = null; }
    if (scrollDragging) app.scrollY = Math.max(0, Math.min(app.scrollMax, app.scrollY - (y - lastPointer.y)));
    lastPointer = { x: x, y: y };
    updateHover(x, y);
  }
  function updateHover(x, y) {
    app.digCursor = null; app.invGhost = null;
    if (app.modal) return;
    if (app.tab === 'dig' && app.digLayout) app.digCursor = R.screenToDigCell(app.digLayout, x, y);
    else if (app.tab === 'storage' && app.invLayout) app.invGhost = R.screenToInvCell(app.invLayout, x, y);
    else if (app.tab === 'museum' && app.placement) { const cell = R.screenToMuseumCell(x, y); if (cell) { const fp = S.itemFootprint(app.placement.id); app.placement.cx = Math.max(0, Math.min(S.MW - fp.w, cell.cx)); app.placement.cy = Math.max(0, Math.min(S.MH - fp.h, cell.cy)); app.updateGhostValid(); } }
  }
  function onUp(x, y) {
    pointerDown = false; scrollDragging = false;
    const held = app.hold; app.hold = null;
    if (moved) return;
    if (held && held.done) return;      // the hold already sent a dig team
    if (UI.handleTap(x, y)) return;
    if (app.modal || app.screen !== 'game') return;
    if (app.tab === 'dig') { if (held) handleDigSurvey(held.x, held.y); }  // quick tap = survey
    else if (app.tab === 'storage') handleStorageTap(x, y);
    else if (app.tab === 'museum') handleMuseumTap(x, y);
  }
  function inRect(x, y, r) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

  // --- dig -----------------------------------------------------------------
  function cellWorld(L, cx, cy) { return { x: L.bx + cx * L.ts + L.ts / 2, y: L.by + cy * L.ts + L.ts / 2 }; }

  // quick tap = survey (reveal clues). Surveying ONTO a fossil crushes it!
  function handleDigSurvey(cx, cy) {
    const st = S.get(); const site = D.siteById(app.siteId); const L = app.digLayout; if (!L) return;
    const b = Dig.getBoard(site); const c = b.cells[cy * b.cols + cx];
    if (!c || c.revealed || c.extracted) return;
    if (st.energy < 1) { Au.play('error'); UI.toast('Out of energy - refill or wait', C().salmon); return; }
    const w = cellWorld(L, cx, cy); const biome = D.BIOMES[site.biome];
    S.useEnergy(1); st.stats.digs++; emit('survey');
    const res = Dig.survey(b, site, cx, cy);
    Au.play('dig'); FX.dust(w.x, w.y, biome.dust, 6);
    if (res.hit) {
      const node = res.hit.node;
      if (node.type === 'fossil' && !res.hit.pristine) {
        crushFossil(node, w.x, w.y);
      } else if (node.type === 'fossil') {
        // Survey Kit rescued it (still chipped)
        app.streak = 0;
        UI.toast('Survey Kit saved it from the shovel!', C().cyan);
        extract(node, false, w.x, w.y, { x: cx, y: cy });
      } else {
        app.streak = 0;
        extract(node, res.hit.pristine, w.x, w.y, { x: cx, y: cy });
      }
    } else {
      Au.play('reveal'); if (res.cascade > 2) FX.dust(w.x, w.y, biome.dust, 4);
      bumpStreak(w.x, w.y);
    }
    afterDig(b);
  }

  // careless survey straight onto a fossil: it shatters, and repairs cost coins
  function crushFossil(node, wx, wy) {
    const f = D.fossilById(node.fossilId); const rc = D.RARITY[f.rarity];
    const penalty = Math.min(S.get().coins, D.RARITY[f.rarity].cell * 2);
    S.addCoins(-penalty);
    S.get().stats.crushed = (S.get().stats.crushed || 0) + 1;
    app.streak = 0;
    Au.play('hazard'); FX.shake(280, 4); FX.flash(180, '#ac3232');
    FX.burst(wx, wy, '#ffffff', 12, { spMin: 20, spMax: 70 });
    FX.burst(wx, wy, rc.color, 8);
    FX.floatText(wx, wy - 8, 'CRUSHED! -' + penalty + 'c', C().salmon, { scale: 1 });
    UI.toast('Crushed the ' + f.name + '! (-' + penalty + 'c) HOLD to dig instead!', C().salmon, window.Assets.pieces.skull);
  }

  // consecutive clean surveys build a streak; every 5 pays out
  function bumpStreak(wx, wy) {
    app.streak++;
    if (app.streak > 0 && app.streak % 5 === 0) {
      const depth = Dig.depthOf(D.siteById(app.siteId));
      const bonus = 8 + depth * 6;
      S.addCoins(bonus);
      const st = S.get();
      if (st.energy < S.energyMax()) st.energy++;
      Au.play('coin');
      FX.floatText(wx, wy - 10, 'STREAK x' + app.streak + '  +' + bonus + 'c +1 energy', C().yellow);
    }
  }

  // press-and-hold (or right-click) = send a dig team to excavate
  function handleDigExcavate(cx, cy) {
    const st = S.get(); const site = D.siteById(app.siteId); const L = app.digLayout; if (!L) return;
    const b = Dig.getBoard(site); const c = b.cells[cy * b.cols + cx];
    if (!c || c.revealed || c.extracted) return;
    if (st.energy < 2) { Au.play('error'); UI.toast('Need 2 energy to send a dig team', C().salmon); return; }
    const w = cellWorld(L, cx, cy); const biome = D.BIOMES[site.biome];
    S.useEnergy(2); st.stats.digs++; pushDigAnim(cx, cy);
    const res = Dig.excavate(b, site, cx, cy);
    if (res.extracted) { Au.play('find'); FX.shake(220, 3); extract(res.extracted.node, true, w.x, w.y, { x: cx, y: cy }); }
    else { Au.play('error'); FX.dust(w.x, w.y, biome.dust, 4); UI.toast('Nothing there... (a wasted dig)', C().gray); }
    afterDig(b);
  }

  function afterDig(b) {
    if (Dig.isCleared(b) && !b.rewarded) { b.rewarded = true; UI.toast('Level cleared! Dig DEEPER for rarer finds.', C().lime, window.Assets.icons.pick); S.addXp(20); Au.play('levelup'); FX.confetti(VW / 2, R.CONTENT.y + 60, 26); }
    S.saveSoon();
  }
  function pushDigAnim(x, y) { app.digAnims.push({ x: x, y: y, life: 0, ttl: 520 }); }

  function extract(node, pristine, wx, wy, cell) {
    const mult = U.excavateMult();
    FX.ring(wx, wy, C().yellow, 16);
    if (node.type === 'fossil') {
      const f = D.fossilById(node.fossilId); const rc = D.RARITY[f.rarity];
      let cells = node.cells.map(function (cc) { return [cc[0], cc[1]]; });
      if (!pristine && cells.length > 1) cells = cells.slice(0, cells.length - 1);
      const block = { fossilId: node.fossilId, rarity: node.rarity, shape: node.shape, cells: cells, pristine: pristine };
      const ok = S.pushBlock(block);
      st_extracted();
      if (ok) {
        emit('extract');
        Au.play(pristine ? 'find' : 'ore'); FX.floatText(wx, wy - 6, f.name, rc.color, { scale: 1 });
        FX.burst(wx, wy, rc.glow, 10); S.addXp(pristine ? 6 : 3);
        // haul the find back to camp storage
        if (app.digLayout && app.digLayout.campRect) {
          const cr = app.digLayout.campRect;
          FX.fly(wx, wy, cr.x + cr.w - 10, cr.y + cr.h - 8, window.Assets.icons.bone, 640);
        }
        UI.toast(pristine ? 'Excavated ' + f.name + '!' : 'Chipped a ' + f.name, rc.color, window.Assets.pieces.skull);
      } else {
        Au.play('error'); UI.toast('Queue full! Block lost - upgrade Crate Truck', C().salmon);
      }
    } else if (node.type === 'ore') {
      const ore = D.oreById(node.oreId);
      const coins = Math.round(ore.coins * mult * (pristine ? 1 : 0.5));
      const gems = pristine ? (ore.gems || 0) : 0;
      S.addCoins(coins); if (gems) S.addGems(gems);
      Au.play('ore'); FX.floatText(wx, wy - 6, '+' + coins + 'c' + (gems ? ' +' + gems + '♦' : ''), C().yellow);
      UI.toast('Mined ' + ore.name, D.RARITY[ore.rarity].color, window.Assets.ores[ore.sprite]);
    } else if (node.type === 'gem') {
      const amt = Math.max(1, Math.floor(node.amount * (pristine ? 1 : 0.5)));
      S.addGems(amt); Au.play('ore'); FX.floatText(wx, wy - 6, '+' + amt + ' gem', C().cyan); S.addXp(4);
      UI.toast('+' + amt + ' gem' + (amt > 1 ? 's' : '') + '!', C().cyan, window.Assets.icons.gem);
    } else if (node.type === 'curio') {
      const cu = D.curioById(node.curioId); const rc = D.RARITY[cu.rarity];
      const first = S.addCurio(node.curioId);
      st_extracted(); Au.play('find'); S.addXp(first ? 8 : 2);
      FX.floatText(wx, wy - 6, cu.name, rc.color); FX.burst(wx, wy, rc.glow, 8);
      emit('curio'); emit('curioUnique', S.uniqueCurios());
      UI.toast((first ? 'NEW specimen: ' : 'Found ') + cu.name + (first ? '!' : ' (dupe)'), rc.color, window.Assets.curios[node.curioId]);
    }
  }
  function st_extracted() { S.get().stats.extracted++; }

  // --- storage -------------------------------------------------------------
  function handleStorageTap(x, y) {
    const st = S.get(); const L = app.invLayout; if (!L) return;
    const cell = R.screenToInvCell(L, x, y); if (!cell) return;
    const active = st.queue[app.activePiece];
    if (!active) { UI.toast('No blocks to place - go dig!', C().gray); return; }
    if (!Inv.canPlace(active, cell.gx, cell.gy)) { Au.play('error'); UI.toast("Doesn't fit there", C().salmon); return; }
    // detect species crossing mount threshold
    const beforeMount = {};
    (active.banked || []); // noop
    const res = Inv.place(active, cell.gx, cell.gy);
    st.queue.splice(app.activePiece, 1);
    if (app.activePiece >= st.queue.length) app.activePiece = Math.max(0, st.queue.length - 1);
    emit('place');
    if (res && res.lines > 0) emit('clearLine', 1);
    // FX
    const gxpx = L.gx + cell.gx * L.cs, gypx = L.gy + cell.gy * L.cs;
    if (res && res.lines > 0) {
      Au.play('complete'); FX.confetti(L.gx + L.gw / 2, L.gy + L.gw / 2, 30 + res.lines * 8); FX.shake(200, 3);
      FX.floatText(L.gx + L.gw / 2, L.gy + L.gw / 2, '+' + res.coins + 'c', C().yellow, { scale: 2 });
      let msg = res.lines + (res.lines > 1 ? ' lines!' : ' line!');
      UI.toast('Cleared ' + msg + ' Banked ' + res.coins + 'c', C().lime, window.Assets.icons.coin);
      // report species that became mountable
      (res.banked || []).forEach(function (bk) {
        if (S.canMount(bk.fossilId) && S.speciesOf(bk.fossilId) - bk.count < S.mountThreshold(bk.fossilId)) {
          const f = D.fossilById(bk.fossilId);
          UI.toast(f.name + ' ready to MOUNT!', D.RARITY[f.rarity].color, window.Assets.icons.bone);
        }
      });
    } else {
      Au.play('place'); FX.dust(gxpx + L.cs / 2, gypx + L.cs / 2, C().dust || '#d9a066', 4);
    }
    S.saveSoon();
  }

  // --- museum --------------------------------------------------------------
  function handleMuseumTap(x, y) {
    if (app.placement) { const cell = R.screenToMuseumCell(x, y); if (cell) app.commitPlacement(cell.cx, cell.cy); else app.cancelPlacement(); return; }
    // tap litter to clean it up
    if (!app.editMode) {
      const trash = S.curTrash();
      for (let i = 0; i < trash.length; i++) {
        const dx = trash[i].x - x, dy = trash[i].y - y;
        if (dx * dx + dy * dy < 90) { const tx = trash[i].x, ty = trash[i].y; S.removeTrash(i); S.addCoins(5); S.addXp(1); emit('trash'); Au.play('flag'); FX.dust(tx, ty, C().dkgray2, 5); FX.floatText(tx, ty - 4, '+5', C().yellow); return; }
      }
    }
    const cell = R.screenToMuseumCell(x, y); if (!cell) { app.selectedItem = -1; return; }
    if (app.editMode) { app.selectedItem = R.museumItemAt(cell.cx, cell.cy); if (app.selectedItem >= 0) Au.play('click'); return; }
    const idx = R.museumItemAt(cell.cx, cell.cy);
    if (idx >= 0) { const it = S.curMuseum()[idx]; const f = D.fossilById(it.id); if (f) { UI.toast(f.name + ' - ' + f.blurb, D.RARITY[f.rarity].color); Au.play('click'); } }
  }

  // pointer wiring
  canvas.addEventListener('mousedown', function (e) { if (e.button !== 0) return; const p = toLogical(e.clientX, e.clientY); onDown(p.x, p.y); });
  window.addEventListener('mousemove', function (e) { const p = toLogical(e.clientX, e.clientY); onMove(p.x, p.y); });
  window.addEventListener('mouseup', function (e) { if (e.button !== 0) return; const p = toLogical(e.clientX, e.clientY); onUp(p.x, p.y); });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault(); const p = toLogical(e.clientX, e.clientY);
    // right-click = quick "send a dig team" (excavate) on desktop
    if (app.screen === 'game' && app.tab === 'dig' && !app.modal && app.digLayout) {
      const cell = R.screenToDigCell(app.digLayout, p.x, p.y);
      if (cell) { app.hold = null; handleDigExcavate(cell.x, cell.y); }
    }
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); const t = e.changedTouches[0]; const p = toLogical(t.clientX, t.clientY); onDown(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); const t = e.changedTouches[0]; const p = toLogical(t.clientX, t.clientY); onMove(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchend', function (e) { e.preventDefault(); const t = e.changedTouches[0]; const p = toLogical(t.clientX, t.clientY); onUp(p.x, p.y); }, { passive: false });

  // =========================================================================
  // AMBIENT particles per biome (dig tab)
  // =========================================================================
  let ambientAcc = 0;
  function spawnAmbient(dt, site) {
    ambientAcc += dt; if (ambientAcc < 160) return; ambientAcc = 0;
    const biome = D.BIOMES[site.biome]; const x = R.CONTENT.x + Math.random() * R.CONTENT.w; const yTop = R.CONTENT.y + 4;
    if (biome.ambient === 'snow') FX.burst(x, yTop, '#eaf6ff', 1, { spMin: 2, spMax: 6, g: 8, up: -8, ttl: 2200, sz: 1 });
    else if (biome.ambient === 'ember') FX.burst(x, R.CONTENT.y + R.CONTENT.h - 4, '#df7126', 1, { spMin: 4, spMax: 10, g: -6, up: 18, ttl: 1400, sz: 1 });
    else if (biome.ambient === 'bubble') FX.burst(x, R.CONTENT.y + R.CONTENT.h - 4, '#bfeee6', 1, { spMin: 3, spMax: 8, g: -14, up: 20, ttl: 1600, sz: 1 });
    else if (biome.ambient === 'spore') FX.burst(x, yTop + Math.random() * 40, '#c8e070', 1, { spMin: 2, spMax: 5, g: 4, up: 0, ttl: 2400, sz: 1 });
    else FX.burst(x, yTop + Math.random() * 30, biome.dust, 1, { spMin: 2, spMax: 6, g: 6, up: 0, ttl: 1800, sz: 1 });
  }

  // museum ambient dust motes for a bit more atmosphere
  let mAmbient = 0;
  function spawnMuseumAmbient(dt) {
    mAmbient += dt; if (mAmbient < 300) return; mAmbient = 0;
    const x = R.CONTENT.x + Math.random() * R.CONTENT.w;
    FX.burst(x, R.CONTENT.y + 6 + Math.random() * 30, '#fff6d0', 1, { spMin: 1, spMax: 4, g: 3, up: -2, ttl: 2600, sz: 1 });
  }

  // =========================================================================
  // MAIN LOOP
  // =========================================================================
  let last = 0, levelWatch = 1, visitorEmit = 0;
  function frame(now) {
    if (!last) last = now; let dt = now - last; last = now; if (dt > 100) dt = 100;

    FX.update(dt); UI.tickToasts(dt);
    ctx.imageSmoothingEnabled = false;

    // --- title / menu screen ---
    if (app.screen === 'menu') {
      UI.reset();
      UI.drawMenu(ctx, now, app);
      UI.drawToasts(ctx);
      requestAnimationFrame(frame);
      return;
    }
    // --- expedition map (idle sim keeps running underneath) ---
    if (app.screen === 'expedition') {
      S.tickEnergy(dt); window.Museum.update(dt);
      UI.reset();
      UI.drawExpedition(ctx, now, app);
      FX.draw(ctx);
      UI.drawToasts(ctx);
      requestAnimationFrame(frame);
      return;
    }

    S.tickEnergy(dt); window.Museum.update(dt);
    for (let i = app.digAnims.length - 1; i >= 0; i--) { app.digAnims[i].life += dt; if (app.digAnims[i].life > app.digAnims[i].ttl) app.digAnims.splice(i, 1); }

    visitorEmit += dt;
    if (visitorEmit > 1000) { visitorEmit = 0; emit('visitors', S.computeStats().visitors); }

    // press-and-hold on a dig tile charges up, then sends a dig team
    if (pointerDown && app.hold && !app.hold.done && app.tab === 'dig' && !app.modal) {
      app.hold.elapsed += dt;
      if (app.hold.elapsed >= HOLD_MS) { app.hold.done = true; handleDigExcavate(app.hold.x, app.hold.y); }
    }

    const lvl = S.get().level;
    if (lvl > levelWatch) { levelWatch = lvl; Au.play('levelup'); UI.toast('Level up! Now level ' + lvl, C().gold, window.Assets.icons.gem); FX.confetti(VW / 2, R.HUD_H + 20, 30); }

    ctx.fillStyle = '#14121f'; ctx.fillRect(0, 0, VW, VH);
    const so = FX.shakeOffset();
    ctx.save(); ctx.translate(Math.round(so.x), Math.round(so.y));
    UI.reset();

    if (app.tab === 'museum') { if (!app.modal) spawnMuseumAmbient(dt); R.drawMuseum(ctx, now, app.placement); FX.draw(ctx); }
    else if (app.tab === 'dig') {
      const site = D.siteById(app.siteId); const b = Dig.getBoard(site);
      if (!app.modal) spawnAmbient(dt, site);
      const holdInfo = (app.hold && !app.hold.done && pointerDown) ? { x: app.hold.x, y: app.hold.y, p: Math.min(1, app.hold.elapsed / HOLD_MS) } : null;
      app.digLayout = R.drawDig(ctx, now, site, b, app.digCursor, holdInfo, app.digAnims);
      FX.draw(ctx);
    } else if (app.tab === 'storage') { R.drawInventory(ctx, now, app); FX.draw(ctx); }
    else if (app.tab === 'shop') UI.drawShop(ctx, now, app);

    UI.drawHUD(ctx, now, app); UI.drawTabs(ctx, now, app);
    if (!app.modal) {
      if (app.tab === 'museum') UI.drawMuseumOverlay(ctx, now, app);
      else if (app.tab === 'dig') { const site = D.siteById(app.siteId); UI.drawDigOverlay(ctx, now, app, Dig.getBoard(site), site); }
      else if (app.tab === 'storage') UI.drawStorageOverlay(ctx, now, app);
    }
    // interactive tutorial rides on top of the tabs (only when no modal is up)
    if (!app.modal) UI.drawTutorial(ctx, now, app);

    if (app.modal === 'collection') UI.drawCollection(ctx, now, app);
    else if (app.modal === 'upgrades') UI.drawUpgrades(ctx, now, app);
    else if (app.modal === 'staff') UI.drawStaff(ctx, now, app);
    else if (app.modal === 'quests') UI.drawQuests(ctx, now, app);
    else if (app.modal === 'offline') UI.drawOffline(ctx, now, app);

    UI.drawToasts(ctx);
    FX.drawFlash(ctx, VW, VH);
    ctx.restore();
    requestAnimationFrame(frame);
  }

  // =========================================================================
  // BOOT
  // =========================================================================
  function boot() {
    window.Assets.build();
    const had = S.load(); const st = S.get();
    Au.setMuted(!!st.muted); levelWatch = st.level;
    // pick starting site (deepest-unlocked-ish -> first unlocked)
    app.siteId = 'quarry';
    for (let i = 0; i < D.SITES.length; i++) if (st.sites[D.SITES[i].id]) app.siteId = D.SITES[i].id;
    if (!st.sites[app.siteId]) app.siteId = 'quarry';

    // always open on the title screen; PLAY/CONTINUE enters the game
    app.screen = 'menu'; app.menuView = 'main'; app.tab = 'museum';
    if (had && !st.firstRun) { const off = S.claimOffline(); if (off) app.offlineData = off; }

    resize();
    requestAnimationFrame(frame);
    setInterval(function () { S.save(); }, 15000);
    window.addEventListener('beforeunload', function () { S.save(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) S.save(); });
  }
  boot();
})();
