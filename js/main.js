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
    tab: 'museum', siteId: 'quarry', digMode: 'survey',
    editMode: false, placement: null, selectedItem: -1,
    modal: null, scrollY: 0, scrollMax: 0, scrollRegion: null,
    shopCat: 'nature', activePiece: 0,
    invGhost: null, invLayout: null, digCursor: null, digLayout: null,
    digAnims: [], offlineData: null,

    setTab: function (id) { this.tab = id; this.editMode = false; this.selectedItem = -1; if (id !== 'museum' && this.placement) this.cancelPlacement(); if (id === 'storage') this.activePiece = Math.min(this.activePiece, Math.max(0, S.get().queue.length - 1)); },
    openModal: function (n) { this.modal = n; this.scrollY = 0; },
    closeModal: function () { this.modal = null; },
    beginPlacement: function (id, cost, gems) { const c = S.findFreeCell(id) || { cx: 0, cy: 0 }; this.placement = { id: id, cost: cost, gems: gems, moveIndex: -1, cx: c.cx, cy: c.cy, valid: true }; this.setTab('museum'); this.updateGhostValid(); },
    startMove: function (i) { const it = S.get().museum[i]; if (!it) return; this.placement = { id: it.id, cost: 0, gems: 0, moveIndex: i, cx: it.cx, cy: it.cy, valid: true }; this.selectedItem = -1; this.editMode = true; UI.toast('Tap a new spot', C().cyan); },
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
      }
      this.placement = null; S.saveSoon();
    },
    sellItem: function (i) {
      const st = S.get(); const it = st.museum[i]; if (!it) return;
      const fos = D.fossilById(it.id); let refund = 0;
      if (fos) { refund = Math.round(D.RARITY[fos.rarity].cell * 3); st.mounted[it.id] = Math.max(0, (st.mounted[it.id] || 1) - 1); st.stats.mounted = Math.max(0, st.stats.mounted - 1); }
      else { const cat = D.catalogById(it.id); if (cat) { const owned = st.owned[it.id] || 1; refund = Math.floor(D.scaledCost(cat.cost, owned - 1) * 0.5); st.owned[it.id] = Math.max(0, owned - 1); } }
      S.removeItem(i); S.addCoins(refund); this.selectedItem = -1; UI.toast('Sold for ' + refund + ' coins', C().yellow); S.saveSoon();
    },
    celebrate: function (fossilId) {
      const st = S.get(); let target = null;
      for (let i = st.museum.length - 1; i >= 0; i--) if (st.museum[i].id === fossilId) { target = st.museum[i]; break; }
      let px = VW / 2, py = VH / 2;
      if (target) { const fp = S.itemFootprint(fossilId); const p = window.Museum.cellToPx(target.cx + fp.w / 2, target.cy); px = p.x; py = p.y - 10; }
      FX.confetti(px, py, 44); FX.ring(px, py, D.RARITY[D.fossilById(fossilId).rarity].glow, 28);
    },
  };

  // =========================================================================
  // INPUT
  // =========================================================================
  function toLogical(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / r.width * VW, y: (cy - r.top) / r.height * VH }; }
  let pointerDown = false, downPos = null, moved = false, longPressTimer = null, longPressFired = false, scrollDragging = false, lastPointer = { x: 0, y: 0 };

  function onDown(x, y) {
    Au.resume(); pointerDown = true; downPos = { x: x, y: y }; lastPointer = { x: x, y: y }; moved = false; longPressFired = false;
    if (app.modal && app.scrollRegion && inRect(x, y, app.scrollRegion)) scrollDragging = true;
    // long-press to flag on the dig board
    if (app.tab === 'dig' && !app.modal && app.digLayout) {
      const cell = R.screenToDigCell(app.digLayout, x, y);
      if (cell) {
        longPressTimer = setTimeout(function () {
          longPressFired = true;
          const site = D.siteById(app.siteId); const b = Dig.getBoard(site);
          if (!b.cells[cell.y * b.cols + cell.x].revealed) { const on = Dig.toggleFlag(b, cell.x, cell.y); Au.play(on ? 'flag' : 'unflag'); }
        }, 320);
      }
    }
  }
  function onMove(x, y) {
    if (!pointerDown) { updateHover(x, y); return; }
    if (Math.abs(x - downPos.x) > 3 || Math.abs(y - downPos.y) > 3) { moved = true; if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }
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
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    pointerDown = false; scrollDragging = false;
    if (longPressFired || moved) return;
    if (UI.handleTap(x, y)) return;
    if (app.modal) return;
    if (app.tab === 'dig') handleDigTap(x, y);
    else if (app.tab === 'storage') handleStorageTap(x, y);
    else if (app.tab === 'museum') handleMuseumTap(x, y);
  }
  function inRect(x, y, r) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

  // --- dig -----------------------------------------------------------------
  function handleDigTap(x, y) {
    const st = S.get(); const site = D.siteById(app.siteId); const L = app.digLayout; if (!L) return;
    const cell = R.screenToDigCell(L, x, y); if (!cell) return;
    const b = Dig.getBoard(site);
    const c = b.cells[cell.y * b.cols + cell.x];
    if (c.revealed || c.extracted) return;
    const wx = L.bx + cell.x * L.ts + L.ts / 2, wy = L.by + cell.y * L.ts + L.ts / 2;
    const biome = D.BIOMES[site.biome];

    if (app.digMode === 'survey') {
      if (c.flagged) { UI.toast('Flagged - use EXCAVATE to dig it', C().pale); return; }
      if (st.energy < 1) { Au.play('error'); UI.toast('Out of energy', C().salmon); return; }
      S.useEnergy(1); st.stats.digs++;
      const res = Dig.survey(b, site, cell.x, cell.y);
      Au.play('dig'); FX.dust(wx, wy, biome.dust, 6);
      if (res.hit) { extract(res.hit.node, res.hit.pristine, wx, wy, cell); }
      else { Au.play('reveal'); if (res.cascade > 2) FX.dust(wx, wy, biome.dust, 4); }
    } else { // excavate
      if (st.energy < 2) { Au.play('error'); UI.toast('Need 2 energy to send a team', C().salmon); return; }
      S.useEnergy(2); st.stats.digs++;
      pushDigAnim(cell.x, cell.y);
      const res = Dig.excavate(b, site, cell.x, cell.y);
      if (res.extracted) { Au.play('find'); FX.shake(220, 3); extract(res.extracted.node, true, wx, wy, cell); }
      else { Au.play('error'); FX.dust(wx, wy, biome.dust, 4); UI.toast('Nothing there... (a wasted dig)', C().gray); }
    }
    if (Dig.isCleared(b)) { UI.toast('Level cleared! Dig DEEPER for rarer finds.', C().lime, window.Assets.icons.pick); S.addXp(20); Au.play('levelup'); FX.confetti(VW / 2, R.CONTENT.y + 60, 26); }
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
        Au.play(pristine ? 'find' : 'ore'); FX.floatText(wx, wy - 6, f.name, rc.color, { scale: 1 });
        FX.burst(wx, wy, rc.glow, 10); S.addXp(pristine ? 6 : 3);
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
    const cell = R.screenToMuseumCell(x, y); if (!cell) { app.selectedItem = -1; return; }
    if (app.editMode) { app.selectedItem = R.museumItemAt(cell.cx, cell.cy); if (app.selectedItem >= 0) Au.play('click'); return; }
    const idx = R.museumItemAt(cell.cx, cell.cy);
    if (idx >= 0) { const it = S.get().museum[idx]; const f = D.fossilById(it.id); if (f) { UI.toast(f.name + ' - ' + f.blurb, D.RARITY[f.rarity].color); Au.play('click'); } }
  }

  // pointer wiring
  canvas.addEventListener('mousedown', function (e) { const p = toLogical(e.clientX, e.clientY); onDown(p.x, p.y); });
  window.addEventListener('mousemove', function (e) { const p = toLogical(e.clientX, e.clientY); onMove(p.x, p.y); });
  window.addEventListener('mouseup', function (e) { const p = toLogical(e.clientX, e.clientY); onUp(p.x, p.y); });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault(); const p = toLogical(e.clientX, e.clientY);
    if (app.tab === 'dig' && !app.modal && app.digLayout) {
      const cell = R.screenToDigCell(app.digLayout, p.x, p.y);
      if (cell) { const site = D.siteById(app.siteId); const b = Dig.getBoard(site); if (!b.cells[cell.y * b.cols + cell.x].revealed) { const on = Dig.toggleFlag(b, cell.x, cell.y); Au.play(on ? 'flag' : 'unflag'); } }
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

  // =========================================================================
  // MAIN LOOP
  // =========================================================================
  let last = 0, levelWatch = 1;
  function frame(now) {
    if (!last) last = now; let dt = now - last; last = now; if (dt > 100) dt = 100;

    S.tickEnergy(dt); window.Museum.update(dt); FX.update(dt); UI.tickToasts(dt);
    for (let i = app.digAnims.length - 1; i >= 0; i--) { app.digAnims[i].life += dt; if (app.digAnims[i].life > app.digAnims[i].ttl) app.digAnims.splice(i, 1); }

    const lvl = S.get().level;
    if (lvl > levelWatch) { levelWatch = lvl; Au.play('levelup'); UI.toast('Level up! Now level ' + lvl, C().gold, window.Assets.icons.gem); FX.confetti(VW / 2, R.HUD_H + 20, 30); }

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#14121f'; ctx.fillRect(0, 0, VW, VH);
    const so = FX.shakeOffset();
    ctx.save(); ctx.translate(Math.round(so.x), Math.round(so.y));
    UI.reset();

    if (app.tab === 'museum') { R.drawMuseum(ctx, now, app.placement); FX.draw(ctx); }
    else if (app.tab === 'dig') {
      const site = D.siteById(app.siteId); const b = Dig.getBoard(site);
      if (!app.modal) spawnAmbient(dt, site);
      app.digLayout = R.drawDig(ctx, now, site, b, app.digCursor, app.digMode, app.digAnims);
      FX.draw(ctx);
    } else if (app.tab === 'storage') { R.drawInventory(ctx, now, app); FX.draw(ctx); }
    else if (app.tab === 'shop') UI.drawShop(ctx, now, app);

    UI.drawHUD(ctx, now, app); UI.drawTabs(ctx, now, app);
    if (!app.modal) {
      if (app.tab === 'museum') UI.drawMuseumOverlay(ctx, now, app);
      else if (app.tab === 'dig') { const site = D.siteById(app.siteId); UI.drawDigOverlay(ctx, now, app, Dig.getBoard(site), site); }
      else if (app.tab === 'storage') UI.drawStorageOverlay(ctx, now, app);
    }
    if (app.modal === 'collection') UI.drawCollection(ctx, now, app);
    else if (app.modal === 'sites') UI.drawSites(ctx, now, app);
    else if (app.modal === 'upgrades') UI.drawUpgrades(ctx, now, app);
    else if (app.modal === 'intro') UI.drawIntro(ctx, now, app);
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

    if (!had || st.firstRun) { app.tab = 'museum'; app.openModal('intro'); }
    else { const off = S.claimOffline(); if (off) { app.offlineData = off; app.openModal('offline'); } app.tab = 'museum'; }

    resize();
    requestAnimationFrame(frame);
    setInterval(function () { S.save(); }, 15000);
    window.addEventListener('beforeunload', function () { S.save(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) S.save(); });
  }
  boot();
})();
