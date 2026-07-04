// ---------------------------------------------------------------------------
// UI (v2): HUD, 4-tab bar, dig/storage/museum overlays, category shop,
// collection (species progress), sites, upgrades, modals and toasts.
// Immediate-mode: draw() rebuilds a click registry; main routes via handleTap.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const A = window.Assets, C = A.C, S = window.GameState, D = window.GameData;
  const R = window.Render, Au = window.Audio2, U = window.Upgrades, Inv = window.Inventory, FX = window.FX;
  const VW = R.VW, VH = R.VH, HUD_H = R.HUD_H, TAB_H = R.TAB_H;

  let buttons = [];
  let toasts = [];

  function reset() { buttons = []; }
  function push(x, y, w, h, fn) { buttons.push({ x: x, y: y, w: w, h: h, fn: fn }); }
  function handleTap(sx, sy) {
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (sx >= b.x && sy >= b.y && sx < b.x + b.w && sy < b.y + b.h) { if (b.fn) b.fn(); return true; }
    }
    return false;
  }

  function toast(msg, color, icon) { toasts.push({ msg: msg, color: color || C.white, icon: icon || null, life: 0, ttl: 2200 }); if (toasts.length > 5) toasts.shift(); }
  function tickToasts(dt) { for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].life += dt; if (toasts[i].life > toasts[i].ttl) toasts.splice(i, 1); } }

  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
    return String(n);
  }
  function displayName(id) { const f = D.fossilById(id); if (f) return f.name; const c = D.catalogById(id); return c ? c.name : id; }

  // --- primitives ----------------------------------------------------------
  function panel(ctx, x, y, w, h, fill, border) {
    ctx.fillStyle = border || C.ink; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fill || '#2b2740'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y, w, 1);
  }
  function button(ctx, x, y, w, h, label, opts, fn) {
    opts = opts || {};
    const enabled = opts.enabled !== false;
    let base = opts.color || C.steel;
    if (!enabled) base = C.dkgray2;
    if (opts.active) base = opts.activeColor || C.green;
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = base; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    if (opts.icon) {
      R.blit(ctx, opts.icon, x + 9, y + h / 2, h - 6);
      Font.drawText(ctx, label, x + 17, y + (h - 5) / 2 + 0.5, enabled ? C.white : C.gray, { shadow: C.ink });
    } else if (label) {
      Font.drawText(ctx, label, x + w / 2, y + (h - 5 * (opts.scale || 1)) / 2 + 0.5, enabled ? C.white : C.gray, { align: 1, shadow: C.ink, scale: opts.scale || 1 });
    }
    if (enabled && fn) push(x, y, w, h, fn);
  }
  function costLabel(ctx, x, y, coins, gems, afford) {
    let cx = x;
    if (coins) { R.blit(ctx, A.icons.coin, cx + 4, y + 3, 8, 1); Font.drawText(ctx, fmt(coins), cx + 10, y + 1, afford ? C.yellow : C.salmon, { shadow: C.ink }); cx += 12 + Font.textW(fmt(coins)) + 6; }
    if (gems) { R.blit(ctx, A.icons.gem, cx + 3, y + 3, 7, 1); Font.drawText(ctx, String(gems), cx + 9, y + 1, afford ? C.cyan : C.salmon, { shadow: C.ink }); }
  }
  function stars(rc) { let s = ''; for (let i = 0; i < rc.stars; i++) s += '★'; return s; }
  function progressBar(ctx, x, y, w, h, frac, col, bg) {
    ctx.fillStyle = bg || '#0c0b16'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1);
  }

  // =========================================================================
  // HUD
  // =========================================================================
  function drawHUD(ctx, t, app) {
    const st = S.get(); const stats = S.computeStats();
    ctx.fillStyle = '#1b1930'; ctx.fillRect(0, 0, VW, HUD_H);
    ctx.fillStyle = C.ink; ctx.fillRect(0, HUD_H - 1, VW, 1);
    // xp strip
    const need = S.xpForLevel(st.level); const xpFrac = Math.max(0, Math.min(1, st.xp / need));
    ctx.fillStyle = '#0c0b16'; ctx.fillRect(0, 0, VW, 2);
    ctx.fillStyle = C.gold; ctx.fillRect(0, 0, Math.round(VW * xpFrac), 2);
    ctx.fillStyle = C.yellow; ctx.fillRect(0, 0, Math.round(VW * xpFrac), 1);

    const y = 6;
    R.blit(ctx, A.icons.coin, 12, y + 5, 12, 1);
    Font.drawText(ctx, fmt(st.coins), 22, y, C.yellow, { scale: 2, shadow: C.maroon });
    let gx = 22 + Font.textW(fmt(st.coins), 2) + 16;
    R.blit(ctx, A.icons.gem, gx, y + 5, 12, 1);
    Font.drawText(ctx, String(st.gems), gx + 8, y, C.cyan, { scale: 2, shadow: C.navy });

    // energy
    const eMax = S.energyMax(); const ex = 206, ew = 66;
    R.blit(ctx, A.icons.pick, ex - 2, y + 6, 14, 1);
    ctx.fillStyle = C.ink; ctx.fillRect(ex + 12, y + 2, ew, 8);
    ctx.fillStyle = '#0c0b16'; ctx.fillRect(ex + 13, y + 3, ew - 2, 6);
    const efrac = st.energy / eMax;
    ctx.fillStyle = st.energy > 0 ? C.lime : C.salmon; ctx.fillRect(ex + 13, y + 3, Math.round((ew - 2) * efrac), 6);
    Font.drawText(ctx, st.energy + '/' + eMax, ex + 12 + ew / 2, y + 3, C.white, { align: 1, shadow: C.ink });
    button(ctx, ex + 12 + ew + 3, y, 14, 12, '+', { color: C.purple }, function () {
      if (st.energy >= eMax) { toast('Energy full', C.lime); return; }
      if (S.refillEnergy()) { Au.play('buy'); toast('Energy refilled!', C.lime); } else { Au.play('error'); toast('Need ' + D.ENERGY_REFILL_GEM_COST + ' gems', C.salmon); }
    });

    // level badge
    const lvx = VW - 120;
    ctx.fillStyle = C.navy; ctx.fillRect(lvx, y - 1, 28, 14);
    ctx.fillStyle = C.blue; ctx.fillRect(lvx + 1, y, 26, 12);
    Font.drawText(ctx, 'LV', lvx + 3, y + 3, C.pale); Font.drawText(ctx, String(st.level), lvx + 15, y + 3, C.white);
    // visitors
    Font.drawText(ctx, '♥', VW - 88, y + 2, C.salmon); Font.drawText(ctx, String(stats.visitors), VW - 80, y + 2, C.white);

    // quests + gear (upgrades) + mute
    button(ctx, VW - 52, y - 1, 15, 14, 'Q', { color: C.gold }, function () { Au.play('click'); app.openModal('quests'); });
    if (window.Quests) { const nx = window.Quests.next(); if (nx) { ctx.fillStyle = C.salmon; ctx.fillRect(VW - 40, y - 2, 4, 4); } }
    button(ctx, VW - 35, y - 1, 15, 14, '*', { color: C.teal }, function () { Au.play('click'); app.openModal('upgrades'); });
    button(ctx, VW - 18, y - 1, 15, 14, Au.isMuted() ? 'x' : '=', { color: Au.isMuted() ? C.dkgray2 : C.teal }, function () {
      Au.setMuted(!Au.isMuted()); S.get().muted = Au.isMuted(); S.saveSoon(); Au.play('click');
    });
  }

  // =========================================================================
  // TAB BAR
  // =========================================================================
  const TABS = [
    { id: 'dig', label: 'DIG', icon: 'pick' },
    { id: 'storage', label: 'STORAGE', icon: 'grid' },
    { id: 'museum', label: 'MUSEUM', icon: 'tabMuseum' },
    { id: 'shop', label: 'SHOP', icon: 'tabShop' },
  ];
  function drawTabs(ctx, t, app) {
    const ty = VH - TAB_H;
    ctx.fillStyle = '#1b1930'; ctx.fillRect(0, ty, VW, TAB_H);
    ctx.fillStyle = C.ink; ctx.fillRect(0, ty, VW, 1);
    const tw = VW / TABS.length;
    for (let i = 0; i < TABS.length; i++) {
      const x = i * tw, active = app.tab === TABS[i].id;
      if (active) { ctx.fillStyle = C.steel; ctx.fillRect(x + 2, ty + 2, tw - 4, TAB_H - 2); ctx.fillStyle = C.cyan; ctx.fillRect(x + 2, ty + 2, tw - 4, 2); }
      const iconX = x + tw / 2 - 26;
      if (TABS[i].icon === 'grid') { drawGridIcon(ctx, iconX - 4, ty + TAB_H / 2 - 5, active); }
      else R.blit(ctx, A.icons[TABS[i].icon], iconX, ty + TAB_H / 2, 14, 1);
      Font.drawText(ctx, TABS[i].label, x + tw / 2 + 6, ty + TAB_H / 2 - 3, active ? C.white : C.ltgray, { align: 1, shadow: C.ink });
      // storage badge
      if (TABS[i].id === 'storage') {
        const q = S.get().queue.length;
        if (q > 0) { ctx.fillStyle = C.red; ctx.fillRect(x + tw - 18, ty + 4, 12, 9); Font.drawText(ctx, String(q), x + tw - 12, ty + 5, C.white, { align: 1 }); }
      }
      (function (id) { push(x, ty, tw, TAB_H, function () { if (app.tab !== id) { Au.play('tab'); app.setTab(id); } }); })(TABS[i].id);
    }
  }
  function drawGridIcon(ctx, x, y, active) {
    ctx.fillStyle = active ? C.cream : C.ltgray;
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) ctx.fillRect(x + gx * 4, y + gy * 4, 3, 3);
  }

  // =========================================================================
  // MUSEUM overlay
  // =========================================================================
  function emit(type, val) { if (window.Quests) window.Quests.emit(type, val); if (window.Tutorial) window.Tutorial.emit(type); }

  function drawMuseumOverlay(ctx, t, app) {
    const st = S.get(); const stats = S.computeStats();
    panel(ctx, 4, HUD_H + 4, 148, 24, 'rgba(27,25,48,0.85)');
    Font.drawText(ctx, 'DINO DIG MUSEUM', 10, HUD_H + 7, C.cyan, { shadow: C.ink });
    Font.drawText(ctx, 'Exhibits ' + stats.exhibits + '  ★' + fmt(stats.wonder), 10, HUD_H + 16, C.pale);
    Font.drawText(ctx, '+' + stats.cps.toFixed(1) + '/s', 148, HUD_H + 16, C.yellow, { align: 2 });
    if (stats.trash > 0) Font.drawText(ctx, 'Litter ' + stats.trash, 92, HUD_H + 7, C.salmon);

    // floor selector strip
    const fy = HUD_H + 30;
    panel(ctx, 4, fy, 148, 24, 'rgba(27,25,48,0.85)');
    const unlocked = []; for (let i = 0; i < st.floors.length; i++) if (st.floors[i].unlocked) unlocked.push(i);
    const pos = unlocked.indexOf(st.floor);
    button(ctx, 6, fy + 2, 12, 10, '<', { color: C.steel, enabled: pos > 0 }, function () { S.setFloor(unlocked[pos - 1]); Au.play('tab'); });
    button(ctx, 138, fy + 2, 12, 10, '>', { color: C.steel, enabled: pos < unlocked.length - 1 }, function () { S.setFloor(unlocked[pos + 1]); Au.play('tab'); });
    Font.drawText(ctx, D.FLOORS[st.floor].name, 78, fy + 3, C.white, { align: 1, shadow: C.ink });
    const firstLocked = st.floors.findIndex(function (f) { return !f.unlocked; });
    if (firstLocked >= 0) {
      const fl = D.FLOORS[firstLocked]; const afford = S.canAfford(fl.cost, fl.gems);
      button(ctx, 20, fy + 13, 108, 9, 'BUY ' + fl.name, { color: afford ? C.orange : C.dkgray2, enabled: afford }, function () {
        if (S.buyFloor(firstLocked)) { Au.play('buy'); emit('floor'); FX.confetti(78, fy, 20); toast(fl.name + ' unlocked!', C.lime); S.setFloor(firstLocked); }
        else { Au.play('error'); toast('Need ' + fmt(fl.cost) + 'c' + (fl.gems ? ' +' + fl.gems + ' gems' : ''), C.salmon); }
      });
    } else {
      Font.drawText(ctx, 'Floor ' + (pos + 1) + ' of ' + unlocked.length, 78, fy + 14, C.gray, { align: 1 });
    }

    const bx = VW - 66;
    button(ctx, bx, HUD_H + 4, 62, 14, 'FOSSILS', { color: C.purple, icon: A.icons.bone }, function () { Au.play('click'); app.openModal('collection'); });
    button(ctx, bx, HUD_H + 21, 62, 14, 'STAFF', { color: C.teal, icon: A.icons.pick }, function () { Au.play('click'); app.openModal('staff'); });
    button(ctx, bx, HUD_H + 38, 62, 14, app.editMode ? 'DONE' : 'ARRANGE', { color: app.editMode ? C.green : C.steel }, function () { Au.play('click'); app.editMode = !app.editMode; app.selectedItem = -1; if (app.editMode) toast('Tap an exhibit to move or sell', C.cyan); });

    if (app.placement) {
      panel(ctx, VW / 2 - 92, VH - TAB_H - 22, 184, 18, 'rgba(27,25,48,0.92)');
      Font.drawText(ctx, 'Tap a spot to place.', VW / 2 - 84, VH - TAB_H - 17, C.white);
      button(ctx, VW / 2 + 46, VH - TAB_H - 21, 44, 16, 'CANCEL', { color: C.red }, function () { Au.play('click'); app.cancelPlacement(); });
    }

    if (app.editMode && app.selectedItem >= 0) {
      const it = S.curMuseum()[app.selectedItem];
      if (it) {
        const fp = S.itemFootprint(it.id); const px = window.Museum.cellToPx(it.cx, it.cy);
        let popX = Math.max(4, Math.min(VW - 100, px.x)); let popY = px.y - 26;
        if (popY < HUD_H + 2) popY = px.y + fp.h * window.Museum.CELL + 2;
        panel(ctx, popX, popY, 96, 22, '#1b1930');
        Font.drawText(ctx, displayName(it.id), popX + 4, popY + 3, C.white);
        button(ctx, popX + 2, popY + 11, 44, 9, 'MOVE', { color: C.steel }, function () { Au.play('click'); app.startMove(app.selectedItem); });
        button(ctx, popX + 48, popY + 11, 46, 9, 'SELL', { color: C.red }, function () { Au.play('coin'); app.sellItem(app.selectedItem); });
      }
    }
  }

  // =========================================================================
  // DIG overlay
  // =========================================================================
  function drawDigOverlay(ctx, t, app, board, site) {
    panel(ctx, 4, HUD_H + 3, VW - 8, 22, 'rgba(27,25,48,0.9)');
    const biome = D.BIOMES[site.biome];
    Font.drawText(ctx, site.name.toUpperCase(), 10, HUD_H + 6, C.cyan, { shadow: C.ink });
    const depth = window.Dig.depthOf(site);
    ctx.fillStyle = biome.accent; ctx.fillRect(10, HUD_H + 15, 3, 7);
    Font.drawText(ctx, 'DEPTH ' + depth + '  ' + biome.name, 16, HUD_H + 16, C.pale);
    const left = window.Dig.nodesLeft(board);
    Font.drawText(ctx, 'Treasures left: ' + left, 130, HUD_H + 6, C.yellow);
    R.blit(ctx, A.icons.flag, 130, HUD_H + 18, 8, 1);
    Font.drawText(ctx, String(window.Dig.flagCount(board)), 138, HUD_H + 16, C.salmon);

    // mode toggle
    button(ctx, VW - 154, HUD_H + 5, 66, 8, app.digMode === 'survey' ? 'SURVEY' : 'EXCAVATE',
      { color: app.digMode === 'survey' ? C.steel : C.orange, active: app.digMode === 'excavate' }, function () {
        Au.play('click'); app.digMode = app.digMode === 'survey' ? 'excavate' : 'survey';
      });
    button(ctx, VW - 52, HUD_H + 5, 46, 8, 'SITES', { color: C.purple }, function () { Au.play('click'); app.openModal('sites'); });

    if (window.Dig.isCleared(board)) {
      button(ctx, VW - 154, HUD_H + 15, 148, 9, 'DIG DEEPER >>', { color: C.green }, function () {
        const d = window.Dig.descend(site); Au.play('newarea'); emit('depth', d); FX.confetti(VW / 2, HUD_H + 40, 30); toast('Descending to depth ' + d + '!', C.lime);
      });
    } else {
      Font.drawText(ctx, app.digMode === 'survey' ? 'Tap: survey (reveals clues)' : 'Tap: send dig team (hold=flag)', VW - 154, HUD_H + 16, C.gray);
    }

    if (S.get().energy <= 0) {
      panel(ctx, VW / 2 - 82, VH - TAB_H - 22, 164, 18, 'rgba(90,37,48,0.95)');
      Font.drawText(ctx, 'Out of energy! Refill or wait.', VW / 2, VH - TAB_H - 17, C.white, { align: 1 });
    }
  }

  // =========================================================================
  // STORAGE overlay
  // =========================================================================
  function drawStorageOverlay(ctx, t, app) {
    const st = S.get();
    const px = 232, pw = VW - px - 8;
    panel(ctx, px, HUD_H + 4, pw, 100, 'rgba(27,25,48,0.92)', C.gold);
    Font.drawText(ctx, 'FIELD STORAGE', px + pw / 2, HUD_H + 8, C.cyan, { align: 1, shadow: C.ink });
    Font.drawText(ctx, 'Fit blocks in; clear full', px + 6, HUD_H + 18, C.pale);
    Font.drawText(ctx, 'rows/columns to bank them.', px + 6, HUD_H + 26, C.pale);

    const active = st.queue[app.activePiece];
    const ay = HUD_H + 36;
    if (active) {
      const f = D.fossilById(active.fossilId); const rc = D.RARITY[active.rarity];
      Font.drawText(ctx, 'NEXT BLOCK:', px + 6, ay, C.gold);
      // preview
      const b = R.bounds(active.cells); const cs = 8;
      const pxo = px + 8, pyo = ay + 10;
      panel(ctx, pxo - 2, pyo - 2, b.w * cs + 4, b.h * cs + 4, '#14121f', rc.color);
      R.drawPieceCells(ctx, active.cells, pxo, pyo, cs, active.rarity, 1);
      Font.drawText(ctx, f ? f.name : '?', pxo + b.w * cs + 8, ay + 10, rc.color, { shadow: C.ink });
      Font.drawText(ctx, stars(rc) + (active.pristine ? '' : ' (chipped)'), pxo + b.w * cs + 8, ay + 20, active.pristine ? rc.color : C.gray);
      Font.drawText(ctx, active.cells.length + ' cells', pxo + b.w * cs + 8, ay + 30, C.pale);
    } else {
      Font.drawText(ctx, 'Queue empty - go dig!', px + pw / 2, ay + 14, C.gray, { align: 1 });
    }
    // buttons
    const by = HUD_H + 76;
    button(ctx, px + 4, by, (pw - 12) / 2, 12, 'SKIP', { color: C.steel, enabled: st.queue.length > 1 }, function () {
      app.activePiece = (app.activePiece + 1) % Math.max(1, st.queue.length); Au.play('click');
    });
    button(ctx, px + 8 + (pw - 12) / 2, by, (pw - 12) / 2, 12, 'DISCARD', { color: C.red, enabled: !!active }, function () {
      S.removeQueue(app.activePiece); if (app.activePiece >= st.queue.length) app.activePiece = Math.max(0, st.queue.length - 1); Au.play('unflag'); toast('Block discarded', C.gray);
    });
    button(ctx, px + 4, by + 14, pw - 8, 12, 'SHIP ALL (60%)', { color: C.orange, enabled: Inv.occupied() > 0 }, function () {
      const r = Inv.shipAll(); if (r.count > 0) { Au.play('buy'); FX.floatText(120, VH / 2, '+' + r.coins, C.yellow, { scale: 2 }); toast('Shipped ' + r.count + ' cells for ' + r.coins + 'c', C.yellow); }
    });

    // queue strip along the bottom
    const qy = VH - TAB_H - 20;
    Font.drawText(ctx, 'QUEUE ' + st.queue.length + '/' + S.queueCap(), 232, qy - 8, C.gold);
    for (let i = 0; i < st.queue.length && i < 8; i++) {
      const q = st.queue[i]; const rc = D.RARITY[q.rarity];
      const qx = 232 + i * 30;
      const on = i === app.activePiece;
      panel(ctx, qx, qy, 26, 18, on ? '#3a3556' : '#1b1930', on ? C.cyan : rc.color);
      R.drawPieceCells(ctx, q.cells, qx + 3, qy + 3, 3, q.rarity, 1);
      (function (idx) { push(qx, qy, 26, 18, function () { app.activePiece = idx; Au.play('click'); }); })(i);
    }
    // occupancy + stuck warning
    const occ = Inv.occupied(), tot = Inv.size() * Inv.size();
    Font.drawText(ctx, 'Grid ' + occ + '/' + tot, 8, VH - TAB_H - 10, C.pale);
    if (active && !Inv.hasAnyMove(active)) {
      Font.drawText(ctx, 'No room! Clear a line or SHIP ALL.', 8, VH - TAB_H - 20, C.salmon);
    }
  }

  // =========================================================================
  // SHOP (category tabs)
  // =========================================================================
  const SHOP_CATS = [{ id: 'nature', label: 'NATURE' }, { id: 'decor', label: 'DECOR' }, { id: 'facility', label: 'FACILITIES' }];
  function drawShop(ctx, t, app) {
    ctx.fillStyle = '#232038'; ctx.fillRect(0, HUD_H, VW, R.CONTENT.h);
    Font.drawText(ctx, 'BUILD & DECORATE', VW / 2, HUD_H + 5, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    // category tabs
    const cw = 120, cx0 = (VW - cw * SHOP_CATS.length) / 2;
    for (let i = 0; i < SHOP_CATS.length; i++) {
      const x = cx0 + i * cw; const on = app.shopCat === SHOP_CATS[i].id;
      button(ctx, x + 2, HUD_H + 18, cw - 4, 12, SHOP_CATS[i].label, { color: on ? C.teal : C.dkgray2, active: on }, function () { app.shopCat = SHOP_CATS[i].id; Au.play('tab'); });
    }

    const items = D.CATALOG.filter(function (c) { return c.cat === app.shopCat; });
    const st = S.get();
    const cols = 3, cwid = 150, ch = 52, gap = 6;
    const gridW = cols * cwid + (cols - 1) * gap;
    const startX = (VW - gridW) / 2, startY = HUD_H + 34;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const col = i % cols, row = (i / cols) | 0;
      const x = startX + col * (cwid + gap), y = startY + row * (ch + gap);
      const owned = st.owned[item.id] || 0, cost = D.scaledCost(item.cost, owned);
      const afford = S.canAfford(cost, item.gems || 0);
      panel(ctx, x, y, cwid, ch, afford ? '#2b2740' : '#241f30', item.kind === 'facility' ? C.teal : C.ink);
      const spr = itemPreview(item, t); if (spr) R.blit(ctx, spr, x + 22, y + 26, 38);
      Font.drawText(ctx, item.name, x + 44, y + 4, C.white, { shadow: C.ink });
      Font.drawTextWrapped(ctx, item.desc, x + 44, y + 13, cwid - 48, C.ltgray);
      let ben = [];
      if (item.wonder) ben.push('+' + item.wonder + '★'); if (item.income) ben.push('+' + item.income + '/s'); if (item.comfort) ben.push('+' + item.comfort + '♥');
      Font.drawText(ctx, ben.join(' '), x + 44, y + ch - 17, C.lime);
      costLabel(ctx, x + 44, y + ch - 9, cost, item.gems || 0, afford);
      if (owned > 0) Font.drawText(ctx, 'x' + owned, x + cwid - 4, y + 4, C.gold, { align: 2 });
      (function (item, cost) {
        push(x, y, cwid, ch, function () {
          if (!S.canAfford(cost, item.gems || 0)) { Au.play('error'); toast('Not enough ' + (S.get().coins < cost ? 'coins' : 'gems'), C.salmon); return; }
          Au.play('click'); app.beginPlacement(item.id, cost, item.gems || 0); toast('Placing ' + item.name + '...', C.cyan);
        });
      })(item, cost);
    }
  }
  function itemPreview(item, t) {
    const o = A.objects[item.sprite];
    if (item.anim && o && o.length) return o[(t / 360 | 0) % o.length];
    if (o && o.length) return o[0];
    return o;
  }

  // =========================================================================
  // MODALS
  // =========================================================================
  function modalBackdrop(ctx, app) { ctx.fillStyle = 'rgba(12,11,22,0.74)'; ctx.fillRect(0, 0, VW, VH); push(0, 0, VW, VH, function () { Au.play('click'); app.closeModal(); }); }
  function scrollClip(ctx, app, x, y, w, h, contentH) {
    app.scrollMax = Math.max(0, contentH - h);
    if (app.scrollMax > 0) {
      const sbh = Math.max(16, h * h / contentH), sby = y + (app.scrollY / app.scrollMax) * (h - sbh);
      ctx.fillStyle = C.dkgray2; ctx.fillRect(x + w + 1, y, 3, h);
      ctx.fillStyle = C.ltgray; ctx.fillRect(x + w + 1, sby, 3, sbh);
    }
    app.scrollRegion = { x: x, y: y, w: w + 6, h: h };
  }

  function drawCollection(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 430, h = 220, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'FOSSIL COLLECTION', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });
    const vx = x + 6, vy = y + 22, vw = w - 14, vh = h - 28;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    const rowH = 30; let cy = vy - app.scrollY;
    for (let i = 0; i < D.FOSSILS.length; i++) { drawFossilRow(ctx, D.FOSSILS[i], vx, cy, vw, rowH, app); cy += rowH + 3; }
    ctx.restore();
    scrollClip(ctx, app, vx, vy, vw, vh, D.FOSSILS.length * (rowH + 3));
  }
  function drawFossilRow(ctx, f, x, y, w, h, app) {
    if (y + h < HUD_H || y > VH) return;
    const st = S.get(); const rc = D.RARITY[f.rarity];
    panel(ctx, x, y, w, h, '#2b2740', rc.color);
    ctx.fillStyle = rc.color; ctx.fillRect(x, y, 3, h);
    R.blit(ctx, A.exhibits[f.id], x + 22, y + h / 2, h - 2, 1);
    Font.drawText(ctx, f.name, x + 44, y + 3, C.white, { shadow: C.ink });
    Font.drawText(ctx, stars(rc), x + 44, y + 12, rc.color);
    Font.drawText(ctx, f.period + '  +' + f.income + '/s', x + 44 + Font.textW(stars(rc)) + 6, y + 12, C.pale);
    Font.drawText(ctx, 'On display: ' + countPlaced(f.id), x + 44, y + 21, C.lime);

    // progress toward next mount
    const prog = S.speciesOf(f.id), need = S.mountThreshold(f.id);
    const barX = x + w - 176, barW = 110;
    Font.drawText(ctx, 'FOSSIL', barX, y + 3, C.gold);
    progressBar(ctx, barX, y + 11, barW, 8, prog / need, rc.color);
    Font.drawText(ctx, prog + '/' + need, barX + barW / 2, y + 12, C.white, { align: 1 });

    const canM = S.canMount(f.id);
    button(ctx, x + w - 60, y + 6, 56, h - 12, canM ? 'MOUNT!' : 'DIG MORE', { color: canM ? C.green : C.dkgray2, enabled: canM }, function () {
      if (S.mount(f.id)) {
        emit('mount');
        const cell = S.findFreeCell(f.id);
        if (cell) { S.placeItem(f.id, cell.cx, cell.cy); Au.play('complete'); S.addXp(30 + rc.stars * 20); toast(f.name + ' mounted! ' + stars(rc), rc.color); app.closeModal(); app.setTab('museum'); app.celebrate(f.id); }
        else { Au.play('complete'); toast('Mounted (no floor space!)', C.orange); }
      }
    });
  }
  function countPlaced(id) { const st = S.get(); let n = 0; for (let fi = 0; fi < st.floors.length; fi++) { const m = st.floors[fi].museum; for (let i = 0; i < m.length; i++) if (m[i].id === id) n++; } return n; }

  function drawSites(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 400, h = 224, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'EXCAVATION SITES', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });
    const vx = x + 6, vy = y + 22, vw = w - 14, vh = h - 28;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    const st = S.get(); const rowH = 48; let cy = vy - app.scrollY;
    for (let i = 0; i < D.SITES.length; i++) { drawSiteRow(ctx, D.SITES[i], vx, cy, vw, rowH, app); cy += rowH + 4; }
    ctx.restore();
    scrollClip(ctx, app, vx, vy, vw, vh, D.SITES.length * (rowH + 4));
  }
  function drawSiteRow(ctx, site, x, y, w, h, app) {
    if (y + h < HUD_H || y > VH) return;
    const st = S.get(); const unlocked = !!st.sites[site.id]; const biome = D.BIOMES[site.biome];
    panel(ctx, x, y, w, h, unlocked ? '#2b2740' : '#241f30', unlocked ? biome.accent : C.dkgray2);
    ctx.fillStyle = biome.soil[1]; ctx.fillRect(x, y, 4, h);
    Font.drawText(ctx, site.name, x + 10, y + 4, unlocked ? C.white : C.ltgray, { shadow: C.ink });
    Font.drawText(ctx, biome.name + ' - ' + site.period, x + 10, y + 13, biome.accent);
    Font.drawTextWrapped(ctx, site.desc, x + 10, y + 22, w - 110, unlocked ? C.pale : C.gray);
    if (unlocked) {
      const d = st.depth[site.id] || 1, md = st.maxDepth[site.id] || 1;
      Font.drawText(ctx, 'Depth ' + d + '  (best ' + md + ')', x + 10, y + h - 9, C.gold);
      const active = app.siteId === site.id;
      button(ctx, x + w - 78, y + 8, 70, 15, active ? 'DIGGING' : 'ENTER', { color: active ? C.green : C.steel, active: active }, function () { Au.play('tab'); app.siteId = site.id; app.closeModal(); app.setTab('dig'); });
      button(ctx, x + w - 78, y + 26, 70, 13, 'RESET TO TOP', { color: C.dkgray2, enabled: d > 1 }, function () { window.Dig.resetToTop(site); Au.play('click'); toast('Back to depth 1', C.pale); });
    } else {
      const afford = S.canAfford(site.cost, 0);
      button(ctx, x + w - 78, y + 10, 70, 16, 'UNLOCK', { color: afford ? C.orange : C.dkgray2, enabled: afford }, function () {
        if (S.spend(site.cost, 0)) { st.sites[site.id] = true; S.saveSoon(); Au.play('newarea'); emit('unlockSite'); S.addXp(60); toast(site.name + ' unlocked!', C.lime); } else { Au.play('error'); toast('Need ' + fmt(site.cost) + ' coins', C.salmon); }
      });
      costLabel(ctx, x + w - 78, y + 30, site.cost, 0, afford);
    }
  }

  function drawUpgrades(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 420, h = 224, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'UPGRADES', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });
    const vx = x + 6, vy = y + 22, vw = w - 14, vh = h - 28;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    const rowH = 34; let cy = vy - app.scrollY;
    for (let i = 0; i < U.LIST.length; i++) { drawUpgradeRow(ctx, U.LIST[i], vx, cy, vw, rowH, app); cy += rowH + 3; }
    ctx.restore();
    scrollClip(ctx, app, vx, vy, vw, vh, U.LIST.length * (rowH + 3));
  }
  function drawUpgradeRow(ctx, u, x, y, w, h, app) {
    if (y + h < HUD_H || y > VH) return;
    const lvl = U.level(u.id); const maxed = lvl >= u.max;
    panel(ctx, x, y, w, h, '#2b2740', maxed ? C.gold : C.teal);
    Font.drawText(ctx, u.name, x + 6, y + 4, C.white, { shadow: C.ink });
    Font.drawTextWrapped(ctx, u.desc, x + 6, y + 13, w - 150, C.ltgray);
    // level pips
    for (let i = 0; i < u.max; i++) { ctx.fillStyle = i < lvl ? C.lime : '#0c0b16'; ctx.fillRect(x + 6 + i * 8, y + h - 8, 6, 4); }
    Font.drawText(ctx, u.fmt(lvl), x + 6 + u.max * 8 + 6, y + h - 9, C.gold);
    const cost = U.costFor(u.id);
    if (maxed) { Font.drawText(ctx, 'MAX', x + w - 40, y + h / 2 - 3, C.gold, { align: 1 }); }
    else {
      const afford = S.canAfford(cost.coins, cost.gems);
      button(ctx, x + w - 76, y + 6, 70, 14, 'UPGRADE', { color: afford ? C.green : C.dkgray2, enabled: afford }, function () {
        if (U.buy(u.id)) { Au.play('buy'); emit('upgrade'); FX.confetti(x + w - 40, y + h / 2, 16); toast(u.name + ' -> ' + u.fmt(U.level(u.id)), C.lime); if (u.id === 'storage') S.resizeGrid(U.storageSize()); }
        else { Au.play('error'); toast('Cannot afford', C.salmon); }
      });
      costLabel(ctx, x + w - 76, y + 22, cost.coins, cost.gems, afford);
    }
  }

  function drawStaff(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 380, h = 200, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'STAFF', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });
    Font.drawText(ctx, 'Hire helpers to keep guests happy.', x + w / 2, y + 20, C.pale, { align: 1 });
    const st = S.get();
    let cy = y + 32; const rh = 48;
    for (let i = 0; i < D.STAFF.length; i++) {
      const s = D.STAFF[i]; const owned = st.staff[s.id] || 0; const maxed = owned >= s.max;
      const cost = S.staffCost(s.id); const afford = S.canAfford(cost, s.gems || 0);
      panel(ctx, x + 8, cy, w - 16, rh, '#2b2740', C.teal);
      // little staff sprite
      const set = A.staff[s.id]; if (set) R.blit(ctx, set.right[0], x + 22, cy + rh / 2, rh - 8, 1);
      Font.drawText(ctx, s.name, x + 40, cy + 5, C.white, { shadow: C.ink });
      Font.drawTextWrapped(ctx, s.desc, x + 40, cy + 14, w - 150, C.ltgray);
      Font.drawText(ctx, 'Hired ' + owned + '/' + s.max, x + 40, cy + rh - 9, C.lime);
      if (maxed) Font.drawText(ctx, 'MAX', x + w - 40, cy + rh / 2 - 3, C.gold, { align: 1 });
      else {
        button(ctx, x + w - 80, cy + 8, 70, 15, 'HIRE', { color: afford ? C.green : C.dkgray2, enabled: afford }, function () {
          if (S.hireStaff(s.id)) { Au.play('buy'); emit('hire' + s.id.charAt(0).toUpperCase() + s.id.slice(1)); FX.confetti(x + w - 45, cy + rh / 2, 14); toast('Hired a ' + s.name + '!', C.lime); }
          else { Au.play('error'); toast('Cannot afford', C.salmon); }
        });
        costLabel(ctx, x + w - 80, cy + 26, cost, s.gems || 0, afford);
      }
      cy += rh + 4;
    }
  }

  function drawQuests(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 400, h = 220, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    const done = window.Quests.doneCount(), total = D.QUESTS.length;
    Font.drawText(ctx, 'QUESTS', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    Font.drawText(ctx, done + '/' + total + ' complete', x + w / 2, y + 18, C.gold, { align: 1 });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });
    const vx = x + 6, vy = y + 26, vw = w - 14, vh = h - 32;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    const rows = window.Quests.list(); const rh = 26; let cy = vy - app.scrollY;
    for (let i = 0; i < rows.length; i++) { drawQuestRow(ctx, rows[i], vx, cy, vw, rh); cy += rh + 3; }
    ctx.restore();
    scrollClip(ctx, app, vx, vy, vw, vh, rows.length * (rh + 3));
  }
  function drawQuestRow(ctx, q, x, y, w, h) {
    if (y + h < HUD_H || y > VH) return;
    panel(ctx, x, y, w, h, q.done ? '#243024' : '#2b2740', q.done ? C.green : C.gold);
    ctx.fillStyle = q.done ? C.green : C.gold; ctx.fillRect(x, y, 3, h);
    Font.drawText(ctx, q.def.desc, x + 8, y + 4, q.done ? C.lime : C.white, { shadow: C.ink });
    if (q.done) { Font.drawText(ctx, 'DONE', x + w - 8, y + 4, C.lime, { align: 2 }); }
    else {
      progressBar(ctx, x + 8, y + 14, w - 120, 7, q.progress / q.def.target, C.gold);
      Font.drawText(ctx, q.progress + '/' + q.def.target, x + 8 + (w - 120) / 2, y + 14, C.white, { align: 1 });
    }
    // reward
    const r = q.def.reward; let rs = [];
    if (r.coins) rs.push(r.coins + 'c'); if (r.gems) rs.push(r.gems + '♦'); if (r.xp) rs.push(r.xp + 'xp');
    Font.drawText(ctx, rs.join(' '), x + w - 8, y + 15, q.done ? C.gray : C.yellow, { align: 2 });
  }

  // Interactive tutorial: mascot + speech bubble + highlight + Next/Skip.
  function highlightRect(key) {
    const tw = VW / 4;
    if (key === 'tabDig') return { x: 0, y: VH - TAB_H, w: tw, h: TAB_H };
    if (key === 'tabStorage') return { x: tw, y: VH - TAB_H, w: tw, h: TAB_H };
    if (key === 'tabMuseum') return { x: tw * 2, y: VH - TAB_H, w: tw, h: TAB_H };
    if (key === 'tabShop') return { x: tw * 3, y: VH - TAB_H, w: tw, h: TAB_H };
    if (key === 'digMode') return { x: VW - 154, y: HUD_H + 4, w: 66, h: 10 };
    if (key === 'quests') return { x: VW - 52, y: 5, w: 15, h: 14 };
    return null;
  }
  function drawTutorial(ctx, t, app) {
    const Tut = window.Tutorial; if (!Tut || !Tut.active()) return;
    const step = Tut.current(); if (!step) return;
    // highlight
    const hr = highlightRect(step.highlight);
    if (hr) {
      const pulse = Math.sin(t / 220) * 0.5 + 0.5;
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.strokeRect(hr.x + 1, hr.y + 1, hr.w - 2, hr.h - 2); ctx.globalAlpha = 1;
    }
    // mascot bottom-left
    const mframe = A.mascot[(t / 500 | 0) % 2];
    const mx = 30, my = VH - TAB_H - 6;
    ctx.drawImage(A.shadows.s16, Math.round(mx - 8), Math.round(my - 3));
    ctx.drawImage(mframe, Math.round(mx - mframe.width / 2), Math.round(my - mframe.height));
    // speech bubble
    const bx = mx + 20, by = HUD_H + 60, bw = VW - bx - 12, bh = 66;
    panel(ctx, bx, by, bw, bh, '#fbf6e8', C.gold);
    Font.drawText(ctx, 'DOC says:', bx + 6, by + 5, C.orange);
    Font.drawTextWrapped(ctx, step.text, bx + 6, by + 15, bw - 12, C.ink);
    // little pointer tail toward mascot
    ctx.fillStyle = '#fbf6e8'; ctx.fillRect(bx - 3, by + bh - 14, 4, 6);
    Font.drawText(ctx, 'Step ' + (Tut.stepIndex() + 1) + '/' + Tut.total(), bx + 6, by + bh - 10, C.gray);
    button(ctx, bx + bw - 84, by + bh - 13, 40, 11, 'NEXT', { color: C.steel }, function () { Au.play('click'); Tut.next(); });
    button(ctx, bx + bw - 42, by + bh - 13, 38, 11, 'SKIP', { color: C.dkgray2 }, function () { Au.play('click'); Tut.skip(); });
  }

  function drawIntro(ctx, t, app) {
    ctx.fillStyle = 'rgba(12,11,22,0.9)'; ctx.fillRect(0, 0, VW, VH);
    push(0, 0, VW, VH, function () {}); // swallow taps so HUD/tabs behind stay blocked
    const w = 384, h = 210, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'DINO DIG MUSEUM', x + w / 2, y + 10, C.cyan, { align: 1, scale: 2, shadow: C.maroon });
    R.blit(ctx, A.skel.spino, x + 40, y + h - 30, 60, 1);
    const lines = [
      'Curator! Build the greatest dino museum on Earth.',
      '',
      'DIG: numbers show how many TREASURES hide next',
      '  door. SURVEY tiles for clues, then switch to',
      '  EXCAVATE (or hold) to send a dig team.',
      'STORAGE: excavated fossils are shaped blocks -',
      '  pack them in and clear rows/columns to bank them.',
      'MOUNT: banked fossils fill a species bar; mount the',
      '  skeleton to draw crowds and earn coins - even idle!',
      'Dig DEEPER for rarer finds. Spend gems on UPGRADES.',
    ];
    for (let i = 0; i < lines.length; i++) Font.drawText(ctx, lines[i], x + 14, y + 30 + i * 11, i === 0 ? C.white : C.pale);
    button(ctx, x + w / 2 + 10, y + h - 24, 130, 16, 'START DIGGING!', { color: C.green }, function () { Au.play('newarea'); S.get().firstRun = false; S.saveSoon(); app.closeModal(); app.setTab('dig'); });
  }

  function drawOffline(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 240, h = 120, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'WELCOME BACK!', x + w / 2, y + 10, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    const o = app.offlineData;
    Font.drawText(ctx, 'Your museum earned while away:', x + w / 2, y + 34, C.pale, { align: 1 });
    R.blit(ctx, A.icons.coin, x + w / 2 - 34, y + 54, 16, 1);
    Font.drawText(ctx, '+' + fmt(o ? o.coins : 0), x + w / 2 - 20, y + 48, C.yellow, { scale: 2, shadow: C.maroon });
    Font.drawText(ctx, '(' + (o ? o.hours.toFixed(1) : '0') + 'h at half rate)', x + w / 2, y + 70, C.gray, { align: 1 });
    button(ctx, x + w / 2 - 40, y + h - 24, 80, 16, 'COLLECT', { color: C.green }, function () { Au.play('coin'); app.closeModal(); });
  }

  function drawToasts(ctx) {
    const baseY = VH - TAB_H - 14;
    for (let i = 0; i < toasts.length; i++) {
      const to = toasts[toasts.length - 1 - i];
      const a = to.life < 200 ? to.life / 200 : (to.life > to.ttl - 300 ? (to.ttl - to.life) / 300 : 1);
      const y = baseY - i * 15;
      const w = Font.textW(to.msg) + 16 + (to.icon ? 10 : 0);
      ctx.globalAlpha = Math.max(0, a) * 0.92; ctx.fillStyle = '#12101c'; ctx.fillRect(VW / 2 - w / 2, y - 2, w, 13);
      ctx.fillStyle = to.color; ctx.fillRect(VW / 2 - w / 2, y - 2, 2, 13);
      ctx.globalAlpha = Math.max(0, a);
      let tx = VW / 2 - w / 2 + 6; if (to.icon) { R.blit(ctx, to.icon, tx + 4, y + 4, 8); tx += 12; }
      Font.drawText(ctx, to.msg, tx, y + 1, to.color, { shadow: C.ink });
      ctx.globalAlpha = 1;
    }
  }

  window.UI = {
    reset: reset, push: push, handleTap: handleTap, toast: toast, tickToasts: tickToasts,
    drawHUD: drawHUD, drawTabs: drawTabs, drawMuseumOverlay: drawMuseumOverlay,
    drawDigOverlay: drawDigOverlay, drawStorageOverlay: drawStorageOverlay, drawShop: drawShop,
    drawCollection: drawCollection, drawSites: drawSites, drawUpgrades: drawUpgrades,
    drawStaff: drawStaff, drawQuests: drawQuests, drawTutorial: drawTutorial,
    drawIntro: drawIntro, drawOffline: drawOffline, drawToasts: drawToasts,
    fmt: fmt, displayName: displayName,
  };
})();
