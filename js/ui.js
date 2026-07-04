// ---------------------------------------------------------------------------
// UI: HUD, tab bar, shop, fossil collection / assembly, dig header, site
// picker, modals, toasts. Immediate-mode: draw() rebuilds a click registry
// every frame; main.js routes taps through UI.handleTap().
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const A = window.Assets;
  const C = A.C;
  const S = window.GameState;
  const D = window.GameData;
  const R = window.Render;
  const Au = window.Audio2;

  const VW = R.VW, VH = R.VH, HUD_H = R.HUD_H, TAB_H = R.TAB_H;

  let buttons = [];       // {x,y,w,h,fn}
  let toasts = [];
  let flash = 0;          // screen-flash timer (hazard)
  let shake = 0;          // screen shake timer

  function reset() { buttons = []; }
  function push(x, y, w, h, fn) { buttons.push({ x: x, y: y, w: w, h: h, fn: fn }); }

  function handleTap(sx, sy) {
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (sx >= b.x && sy >= b.y && sx < b.x + b.w && sy < b.y + b.h) {
        if (b.fn) b.fn();
        return true;
      }
    }
    return false;
  }

  // --- toasts --------------------------------------------------------------
  function toast(msg, color, icon) {
    toasts.push({ msg: msg, color: color || C.white, icon: icon || null, life: 0, ttl: 2200 });
    if (toasts.length > 4) toasts.shift();
  }
  function tickToasts(dt) {
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].life += dt;
      if (toasts[i].life > toasts[i].ttl) toasts.splice(i, 1);
    }
    if (flash > 0) flash -= dt;
    if (shake > 0) shake -= dt;
  }
  function triggerHazard() { flash = 350; shake = 300; }
  function shakeOffset() {
    if (shake <= 0) return { x: 0, y: 0 };
    const m = shake / 300 * 3;
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }

  // --- primitives ----------------------------------------------------------
  function panel(ctx, x, y, w, h, fill, border) {
    ctx.fillStyle = border || C.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fill || '#2b2740';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, 1);
  }

  function button(ctx, x, y, w, h, label, opts, fn) {
    opts = opts || {};
    const enabled = opts.enabled !== false;
    let base = opts.color || C.steel;
    if (!enabled) base = C.dkgray2;
    if (opts.active) base = opts.activeColor || C.green;
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = base;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    // bevel
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    if (opts.icon) {
      R.blit(ctx, opts.icon, x + 10, y + h / 2, h - 6);
      Font.drawText(ctx, label, x + 18, y + (h - 5) / 2 + 0.5, enabled ? C.white : C.gray, { shadow: C.ink });
    } else if (label) {
      Font.drawText(ctx, label, x + w / 2, y + (h - 5) / 2 + 0.5, enabled ? C.white : C.gray,
        { align: 1, shadow: C.ink, scale: opts.scale || 1 });
    }
    if (enabled && fn) push(x, y, w, h, fn);
  }

  function costLabel(ctx, x, y, coins, gems, afford) {
    let cx = x;
    if (coins) {
      R.blit(ctx, A.icons.coin, cx + 4, y + 3, 8, 1);
      Font.drawText(ctx, String(coins), cx + 10, y + 1, afford ? C.yellow : C.salmon, { shadow: C.ink });
      cx += 12 + Font.textW(String(coins)) + 6;
    }
    if (gems) {
      R.blit(ctx, A.icons.gem, cx + 3, y + 3, 7, 1);
      Font.drawText(ctx, String(gems), cx + 9, y + 1, afford ? C.cyan : C.salmon, { shadow: C.ink });
    }
  }

  // =========================================================================
  // HUD
  // =========================================================================
  function drawHUD(ctx, t, app) {
    const st = S.get();
    const stats = S.computeStats();
    // background
    ctx.fillStyle = '#1b1930';
    ctx.fillRect(0, 0, VW, HUD_H);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, HUD_H - 1, VW, 1);
    // xp strip along the very top
    const need = S.xpForLevel(st.level);
    const xpFrac = Math.max(0, Math.min(1, st.xp / need));
    ctx.fillStyle = '#0c0b16';
    ctx.fillRect(0, 0, VW, 2);
    ctx.fillStyle = C.gold;
    ctx.fillRect(0, 0, Math.round(VW * xpFrac), 2);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(0, 0, Math.round(VW * xpFrac), 1);

    const y = 6;
    // coins
    R.blit(ctx, A.icons.coin, 12, y + 5, 12, 1);
    Font.drawText(ctx, fmt(st.coins), 22, y, C.yellow, { scale: 2, shadow: C.maroon });
    // gems
    let gx = 22 + Font.textW(fmt(st.coins), 2) + 18;
    R.blit(ctx, A.icons.gem, gx, y + 5, 12, 1);
    Font.drawText(ctx, String(st.gems), gx + 8, y, C.cyan, { scale: 2, shadow: C.navy });

    // energy (right-center)
    const eMax = D.ENERGY_MAX;
    const ex = 214, ew = 74;
    R.blit(ctx, A.icons.pick, ex - 2, y + 6, 14, 1);
    ctx.fillStyle = C.ink; ctx.fillRect(ex + 12, y + 2, ew, 8);
    ctx.fillStyle = '#0c0b16'; ctx.fillRect(ex + 13, y + 3, ew - 2, 6);
    const efrac = st.energy / eMax;
    ctx.fillStyle = st.energy > 0 ? C.lime : C.salmon;
    ctx.fillRect(ex + 13, y + 3, Math.round((ew - 2) * efrac), 6);
    // regen sliver
    if (st.energy < eMax) {
      const rf = st.energyTimer / D.ENERGY_REGEN_MS;
      ctx.fillStyle = C.dkgreen;
      ctx.fillRect(ex + 13 + Math.round((ew - 2) * efrac), y + 3, Math.max(1, Math.round((ew - 2) / eMax * rf)), 6);
    }
    Font.drawText(ctx, st.energy + '/' + eMax, ex + 12 + ew / 2, y + 3, C.white, { align: 1, shadow: C.ink });
    // refill button
    button(ctx, ex + 12 + ew + 4, y, 16, 12, '+', { color: C.purple, scale: 1 }, function () {
      if (st.energy >= eMax) { toast('Energy full', C.lime); return; }
      if (S.refillEnergy()) { Au.play('buy'); toast('Energy refilled!', C.lime); }
      else { Au.play('error'); toast('Need ' + D.ENERGY_REFILL_GEM_COST + ' gems', C.salmon); }
    });

    // right: level badge + mute
    const lvx = VW - 108;
    ctx.fillStyle = C.navy; ctx.fillRect(lvx, y - 1, 30, 14);
    ctx.fillStyle = C.blue; ctx.fillRect(lvx + 1, y, 28, 12);
    Font.drawText(ctx, 'LV', lvx + 4, y + 3, C.pale);
    Font.drawText(ctx, String(st.level), lvx + 16, y + 2, C.white, { scale: 1 });
    // visitors
    R.blit(ctx, A.icons.gem, 0, 0, 1, 1); // noop keep ref
    Font.drawText(ctx, '♥', VW - 70, y + 2, C.salmon);
    Font.drawText(ctx, String(stats.visitors), VW - 62, y + 2, C.white);
    // wonder
    Font.drawText(ctx, '★', VW - 44, y + 2, C.yellow);
    Font.drawText(ctx, String(stats.wonder), VW - 36, y + 2, C.white);

    // mute
    button(ctx, VW - 16, y - 1, 14, 14, Au.isMuted() ? 'x' : '=', { color: Au.isMuted() ? C.dkgray2 : C.teal }, function () {
      Au.setMuted(!Au.isMuted());
      S.get().muted = Au.isMuted();
      S.saveSoon();
      Au.play('click');
    });
  }

  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
    return String(n);
  }

  // =========================================================================
  // TAB BAR
  // =========================================================================
  const TABS = [
    { id: 'museum', label: 'MUSEUM', icon: 'tabMuseum' },
    { id: 'dig', label: 'DIG SITE', icon: 'pick' },
    { id: 'shop', label: 'SHOP', icon: 'tabShop' },
  ];

  function drawTabs(ctx, t, app) {
    const ty = VH - TAB_H;
    ctx.fillStyle = '#1b1930';
    ctx.fillRect(0, ty, VW, TAB_H);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, ty, VW, 1);
    const tw = VW / TABS.length;
    for (let i = 0; i < TABS.length; i++) {
      const x = i * tw;
      const active = app.tab === TABS[i].id;
      if (active) {
        ctx.fillStyle = C.steel;
        ctx.fillRect(x + 2, ty + 2, tw - 4, TAB_H - 2);
        ctx.fillStyle = C.cyan;
        ctx.fillRect(x + 2, ty + 2, tw - 4, 2);
      }
      const icon = A.icons[TABS[i].icon];
      R.blit(ctx, icon, x + tw / 2 - 22, ty + TAB_H / 2, 14, 1);
      Font.drawText(ctx, TABS[i].label, x + tw / 2 + 4, ty + TAB_H / 2 - 3, active ? C.white : C.ltgray,
        { align: 1, shadow: C.ink });
      (function (id) {
        push(x, ty, tw, TAB_H, function () {
          if (app.tab !== id) { Au.play('tab'); app.setTab(id); }
        });
      })(TABS[i].id);
    }
  }

  // =========================================================================
  // MUSEUM overlay (buttons: Fossils / Edit; edit popover)
  // =========================================================================
  function drawMuseumOverlay(ctx, t, app) {
    const stats = S.computeStats();
    // top-left status ribbon
    panel(ctx, 4, HUD_H + 4, 142, 26, 'rgba(27,25,48,0.85)');
    Font.drawText(ctx, 'DINO DIG MUSEUM', 10, HUD_H + 8, C.cyan, { shadow: C.ink });
    Font.drawText(ctx, 'Exhibits ' + stats.exhibits, 10, HUD_H + 17, C.pale);
    Font.drawText(ctx, '+' + stats.cps.toFixed(1) + '/s', 142, HUD_H + 17, C.yellow, { align: 2 });

    // right-side action buttons
    const bx = VW - 66, bw = 62;
    button(ctx, bx, HUD_H + 4, bw, 15, 'FOSSILS', { color: C.purple, icon: A.icons.bone }, function () {
      Au.play('click'); app.openModal('collection');
    });
    button(ctx, bx, HUD_H + 22, bw, 15, app.editMode ? 'DONE' : 'ARRANGE',
      { color: app.editMode ? C.green : C.steel }, function () {
        Au.play('click');
        app.editMode = !app.editMode;
        app.selectedItem = -1;
        if (app.editMode) toast('Tap an exhibit to move or sell', C.cyan);
      });

    // placement mode banner
    if (app.placement) {
      panel(ctx, VW / 2 - 90, VH - TAB_H - 22, 180, 18, 'rgba(27,25,48,0.92)');
      Font.drawText(ctx, 'Tap a spot to place. ', VW / 2 - 82, VH - TAB_H - 17, C.white);
      button(ctx, VW / 2 + 44, VH - TAB_H - 21, 44, 16, 'CANCEL', { color: C.red }, function () {
        Au.play('click'); app.cancelPlacement();
      });
    }

    // edit popover for selected item
    if (app.editMode && app.selectedItem >= 0) {
      const st = S.get();
      const it = st.museum[app.selectedItem];
      if (it) {
        const fp = S.itemFootprint(it.id);
        const px = M.px(it.cx, it.cy);
        let popX = px.x, popY = px.y - 26;
        if (popY < HUD_H + 2) popY = px.y + fp.h * window.Museum.CELL + 2;
        popX = Math.max(4, Math.min(VW - 100, popX));
        panel(ctx, popX, popY, 96, 22, '#1b1930');
        const nm = displayName(it.id);
        Font.drawText(ctx, nm, popX + 4, popY + 3, C.white);
        button(ctx, popX + 2, popY + 11, 44, 9, 'MOVE', { color: C.steel }, function () {
          Au.play('click');
          app.startMove(app.selectedItem);
        });
        button(ctx, popX + 48, popY + 11, 46, 9, 'SELL', { color: C.red }, function () {
          Au.play('coin');
          app.sellItem(app.selectedItem);
        });
      }
    }
  }

  const M = { px: function (cx, cy) { return window.Museum.cellToPx(cx, cy); } };

  function displayName(id) {
    const f = D.fossilById(id); if (f) return f.name;
    const c = D.catalogById(id); if (c) return c.name;
    return id;
  }

  // =========================================================================
  // DIG overlay (header + flag toggle + sites + new section)
  // =========================================================================
  function drawDigOverlay(ctx, t, app, board, site) {
    // header bar
    panel(ctx, 4, HUD_H + 3, VW - 8, 22, 'rgba(27,25,48,0.9)');
    Font.drawText(ctx, site.name.toUpperCase(), 10, HUD_H + 7, C.cyan, { shadow: C.ink });
    const remaining = window.Dig.remainingSafe(board);
    const flags = window.Dig.flagCount(board);
    Font.drawText(ctx, 'Buried ' + remaining, 10, HUD_H + 16, C.pale);
    R.blit(ctx, A.icons.flag, 66, HUD_H + 18, 8, 1);
    Font.drawText(ctx, flags + '/' + board.hazards, 74, HUD_H + 16, C.salmon);

    // sites button
    button(ctx, VW - 52, HUD_H + 5, 46, 8, 'SITES', { color: C.purple }, function () {
      Au.play('click'); app.openModal('sites');
    });
    // flag mode toggle
    button(ctx, VW - 104, HUD_H + 5, 48, 8, app.flagMode ? 'FLAG ON' : 'FLAG',
      { color: app.flagMode ? C.orange : C.steel, active: app.flagMode }, function () {
        Au.play('click'); app.flagMode = !app.flagMode;
      });
    // new section (only when cleared)
    if (window.Dig.isCleared(board)) {
      button(ctx, VW - 104, HUD_H + 15, 98, 9, 'DIG NEW SECTION', { color: C.green }, function () {
        Au.play('newarea');
        app.regenSite();
        toast('Fresh dirt to excavate!', C.lime);
      });
    } else {
      Font.drawText(ctx, app.flagMode ? 'Tap = flag' : 'Tap = dig  (hold = flag)', VW - 104, HUD_H + 16, C.gray);
    }

    // out-of-energy hint
    if (S.get().energy <= 0) {
      panel(ctx, VW / 2 - 80, VH - TAB_H - 24, 160, 20, 'rgba(90,37,48,0.95)');
      Font.drawText(ctx, 'Out of energy! Refill or wait.', VW / 2, VH - TAB_H - 18, C.white, { align: 1 });
    }
  }

  // =========================================================================
  // SHOP
  // =========================================================================
  function drawShop(ctx, t, app) {
    ctx.fillStyle = '#232038';
    ctx.fillRect(0, HUD_H, VW, R.CONTENT.h);
    Font.drawText(ctx, 'BUILD & DECORATE', VW / 2, HUD_H + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    Font.drawText(ctx, 'Tap an item, then place it in your museum', VW / 2, HUD_H + 22, C.pale, { align: 1 });

    const st = S.get();
    const cols = 3, cw = 150, ch = 56, gap = 6;
    const gridW = cols * cw + (cols - 1) * gap;
    const startX = (VW - gridW) / 2;
    const startY = HUD_H + 34;
    for (let i = 0; i < D.CATALOG.length; i++) {
      const item = D.CATALOG[i];
      const col = i % cols, row = (i / cols) | 0;
      const x = startX + col * (cw + gap);
      const y = startY + row * (ch + gap);
      const owned = st.owned[item.id] || 0;
      const cost = D.scaledCost(item.cost, owned);
      const afford = S.canAfford(cost, item.gems || 0);

      panel(ctx, x, y, cw, ch, afford ? '#2b2740' : '#241f30', item.kind === 'facility' ? C.teal : C.ink);
      // preview sprite
      const spr = itemPreview(item, t);
      if (spr) R.blit(ctx, spr, x + 24, y + 26, 40);
      // kind tag
      ctx.fillStyle = item.kind === 'facility' ? C.teal : C.purple;
      ctx.fillRect(x + 44, y + 4, item.kind === 'facility' ? 44 : 30, 8);
      Font.drawText(ctx, item.kind === 'facility' ? 'FACILITY' : 'DECOR', x + 46, y + 5, C.white);
      // name + desc
      Font.drawText(ctx, item.name, x + 44, y + 15, C.white, { shadow: C.ink });
      Font.drawTextWrapped(ctx, item.desc, x + 44, y + 24, cw - 50, C.ltgray);
      // benefit line
      let ben = [];
      if (item.wonder) ben.push('+' + item.wonder + ' wonder');
      if (item.income) ben.push('+' + item.income + '/s');
      if (item.comfort) ben.push('+' + item.comfort + ' comfort');
      Font.drawText(ctx, ben.join('  '), x + 44, y + ch - 16, C.lime);
      // cost + owned
      costLabel(ctx, x + 44, y + ch - 9, cost, item.gems || 0, afford);
      if (owned > 0) Font.drawText(ctx, 'x' + owned, x + cw - 4, y + 4, C.gold, { align: 2 });

      (function (item, cost) {
        push(x, y, cw, ch, function () {
          if (!S.canAfford(cost, item.gems || 0)) { Au.play('error'); toast('Not enough ' + (S.get().coins < cost ? 'coins' : 'gems'), C.salmon); return; }
          Au.play('click');
          app.beginPlacement(item.id, cost, item.gems || 0);
          toast('Placing ' + item.name + '...', C.cyan);
        });
      })(item, cost);
    }
  }

  function itemPreview(item, t) {
    if (item.anim && A.objects[item.sprite] && A.objects[item.sprite].length) {
      return A.objects[item.sprite][(t / 380 | 0) % A.objects[item.sprite].length];
    }
    const o = A.objects[item.sprite];
    if (o && o.length) return o[0];
    return o;
  }

  // =========================================================================
  // MODALS
  // =========================================================================
  function modalBackdrop(ctx, app) {
    ctx.fillStyle = 'rgba(12,11,22,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    // tapping backdrop closes (registered last-ish; inner buttons override)
    push(0, 0, VW, VH, function () { Au.play('click'); app.closeModal(); });
  }

  function drawCollection(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 420, h = 218, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'FOSSIL COLLECTION', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });

    // scroll viewport
    const vx = x + 6, vy = y + 22, vw = w - 12, vh = h - 28;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();

    const rowH = 34;
    let cy = vy - app.scrollY;
    const st = S.get();

    // fossils
    for (let i = 0; i < D.FOSSILS.length; i++) {
      const f = D.FOSSILS[i];
      drawFossilRow(ctx, f, vx, cy, vw, rowH, app);
      cy += rowH + 3;
    }
    // ores header
    Font.drawText(ctx, 'ORE & GEMS  (tap to sell)', vx + 4, cy + 2, C.gold, { shadow: C.ink });
    cy += 12;
    for (let i = 0; i < D.ORES.length; i++) {
      const o = D.ORES[i];
      drawOreRow(ctx, o, vx, cy, vw, app);
      cy += 20;
    }

    ctx.restore();
    // scrollbar
    const contentH = D.FOSSILS.length * (rowH + 3) + 12 + D.ORES.length * 20 + 6;
    app.scrollMax = Math.max(0, contentH - vh);
    if (app.scrollMax > 0) {
      const sbh = Math.max(16, vh * vh / contentH);
      const sby = vy + (app.scrollY / app.scrollMax) * (vh - sbh);
      ctx.fillStyle = C.dkgray2; ctx.fillRect(x + w - 5, vy, 3, vh);
      ctx.fillStyle = C.ltgray; ctx.fillRect(x + w - 5, sby, 3, sbh);
    }
    // register scroll region for main to drag
    app.scrollRegion = { x: vx, y: vy, w: vw, h: vh };
  }

  function drawFossilRow(ctx, f, x, y, w, h, app) {
    if (y + h < HUD_H || y > VH) return; // cull
    const st = S.get();
    const rc = D.RARITY[f.rarity];
    panel(ctx, x, y, w, h, '#2b2740', rc.color);
    // rarity stripe
    ctx.fillStyle = rc.color; ctx.fillRect(x, y, 3, h);
    // skeleton mini
    const skel = A.exhibits[f.id];
    R.blit(ctx, skel, x + 24, y + h / 2, h - 4, 1);
    // name + stars
    Font.drawText(ctx, f.name, x + 46, y + 4, C.white, { shadow: C.ink });
    let starsStr = '';
    for (let s = 0; s < rc.stars; s++) starsStr += '★';
    Font.drawText(ctx, starsStr, x + 46, y + 13, rc.color);
    Font.drawText(ctx, rc.name + '  +' + f.income + '/s', x + 46 + Font.textW(starsStr) + 6, y + 13, C.pale);
    // mounted count
    const mounted = st.mounted[f.id] || 0;
    const placed = countPlaced(f.id);
    Font.drawText(ctx, 'Mounted ' + (mounted + placed), x + 46, y + 22, C.lime);

    // piece progress (skull/body/legs/tail) — four labelled slots
    const boxW = 24, boxGap = 3, py0 = y + 3;
    const clusterW = 4 * boxW + 3 * boxGap;
    const px0 = x + w - clusterW - 6;
    const PLBL = ['SKL', 'RIB', 'LEG', 'TAL'];
    for (let p = 0; p < D.PIECES.length; p++) {
      const piece = D.PIECES[p];
      const have = S.pieceCount(f.id, piece);
      const bx = px0 + p * (boxW + boxGap);
      ctx.fillStyle = have > 0 ? C.dkgreen : C.ink;
      ctx.fillRect(bx, py0, boxW, 12);
      ctx.fillStyle = have > 0 ? C.green : '#0c0b16';
      ctx.fillRect(bx + 1, py0 + 1, boxW - 2, 10);
      R.blit(ctx, have > 0 ? A.pieces[piece] : A.piecesDark[piece], bx + boxW / 2 - 3, py0 + 6, 11, 1);
      if (have > 0) Font.drawText(ctx, 'x' + have, bx + boxW - 2, py0 + 1, C.yellow, { align: 2 });
      Font.drawText(ctx, PLBL[p], bx + boxW / 2, py0 + 13, have > 0 ? C.pale : C.gray, { align: 1 });
    }

    // mount button (spans the slot cluster, below the slots)
    const canM = S.canAssemble(f.id);
    button(ctx, px0, y + h - 10, clusterW, 9, canM ? 'MOUNT SKELETON!' : 'NEED ALL 4 PIECES',
      { color: canM ? C.green : C.dkgray2, enabled: canM }, function () {
        if (S.assemble(f.id)) {
          const cell = S.findFreeCell(f.id);
          if (cell) {
            S.placeItem(f.id, cell.cx, cell.cy);
            Au.play('complete');
            S.addXp(30 + rc.stars * 20);
            toast(f.name + ' mounted! ' + starsStr, rc.color);
            app.closeModal();
            app.setTab('museum');
            app.celebrate(f.id);
          } else {
            // no room — keep as unplaced mounted (rare)
            Au.play('complete');
            toast('Mounted (no floor space!)', C.orange);
          }
        }
      });
  }

  function countPlaced(id) {
    const st = S.get();
    let n = 0;
    for (let i = 0; i < st.museum.length; i++) if (st.museum[i].id === id) n++;
    return n;
  }

  function drawOreRow(ctx, o, x, y, w, app) {
    if (y + 18 < HUD_H || y > VH) return;
    const st = S.get();
    const count = st.ores[o.id] || 0;
    const rc = D.RARITY[o.rarity];
    panel(ctx, x, y, w, 18, count > 0 ? '#2b2740' : '#241f30', rc.color);
    R.blit(ctx, A.ores[o.sprite], x + 12, y + 9, 14, 1);
    Font.drawText(ctx, o.name, x + 24, y + 3, count > 0 ? C.white : C.gray);
    let val = o.coins + (o.gems ? '' : '') ;
    Font.drawText(ctx, 'x' + count, x + 24, y + 10, C.pale);
    Font.drawText(ctx, o.coins + 'c' + (o.gems ? '  +' + o.gems + ' gem' : ''), x + 90, y + 6, C.yellow);
    if (count > 0) {
      button(ctx, x + w - 92, y + 3, 42, 12, 'SELL', { color: C.orange }, function () {
        if (S.sellOre(o.id)) { Au.play('coin'); }
      });
      button(ctx, x + w - 48, y + 3, 44, 12, 'SELL ALL', { color: C.red }, function () {
        const r = S.sellAllOre(o.id);
        if (r.n > 0) { Au.play('buy'); toast('Sold ' + r.n + ' for ' + r.coins + 'c' + (r.gems ? ' +' + r.gems + ' gem' : ''), C.yellow); }
      });
    }
  }

  function drawSites(ctx, t, app) {
    modalBackdrop(ctx, app);
    const w = 380, h = 200, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'EXCAVATION SITES', x + w / 2, y + 6, C.cyan, { align: 1, scale: 2, shadow: C.ink });
    button(ctx, x + w - 16, y + 4, 12, 12, 'x', { color: C.red }, function () { Au.play('click'); app.closeModal(); });

    const st = S.get();
    let cy = y + 24;
    for (let i = 0; i < D.SITES.length; i++) {
      const site = D.SITES[i];
      const unlocked = !!st.sites[site.id];
      const rh = 52;
      panel(ctx, x + 8, cy, w - 16, rh, unlocked ? '#2b2740' : '#241f30', unlocked ? C.teal : C.dkgray2);
      Font.drawText(ctx, site.name, x + 16, cy + 5, unlocked ? C.white : C.ltgray, { scale: 1, shadow: C.ink });
      Font.drawTextWrapped(ctx, site.desc, x + 16, cy + 15, w - 120, unlocked ? C.pale : C.gray);
      Font.drawText(ctx, site.cols + 'x' + site.rows + ' grid   ' + site.hazards + ' hazards', x + 16, cy + rh - 9, C.gray);

      if (unlocked) {
        const active = app.siteId === site.id;
        button(ctx, x + w - 84, cy + 8, 68, 16, active ? 'DIGGING' : 'ENTER',
          { color: active ? C.green : C.steel, active: active }, function () {
            Au.play('tab'); app.siteId = site.id; app.closeModal(); app.setTab('dig');
          });
      } else {
        const afford = S.canAfford(site.cost, 0);
        button(ctx, x + w - 84, cy + 8, 68, 16, 'UNLOCK', { color: afford ? C.orange : C.dkgray2, enabled: afford }, function () {
          if (S.spend(site.cost, 0)) {
            st.sites[site.id] = true;
            S.saveSoon();
            Au.play('newarea');
            S.addXp(50);
            toast(site.name + ' unlocked!', C.lime);
          } else { Au.play('error'); toast('Need ' + site.cost + ' coins', C.salmon); }
        });
        costLabel(ctx, x + w - 84, cy + 28, site.cost, 0, afford);
      }
      cy += rh + 6;
    }
  }

  function drawIntro(ctx, t, app) {
    ctx.fillStyle = 'rgba(12,11,22,0.85)';
    ctx.fillRect(0, 0, VW, VH);
    const w = 340, h = 180, x = (VW - w) / 2, y = (VH - h) / 2;
    panel(ctx, x, y, w, h, '#232038', C.gold);
    Font.drawText(ctx, 'DINO DIG MUSEUM', x + w / 2, y + 12, C.cyan, { align: 1, scale: 2, shadow: C.maroon });
    // little rex mascot tucked in the bottom-left corner, clear of the text
    R.blit(ctx, A.skel.bigTheropod, x + 34, y + h - 30, 54, 1);
    const lines = [
      'Welcome, curator! Build the greatest',
      'dinosaur museum in the world.',
      '',
      '1. DIG at excavation sites - reveal tiles',
      '   minesweeper-style. Numbers warn of',
      '   nearby hazards. Flag them, avoid them!',
      '2. Collect 4 bone pieces to MOUNT a',
      '   skeleton exhibit in your museum.',
      '3. Exhibits draw visitors and earn coins',
      '   even while you are away.',
    ];
    for (let i = 0; i < lines.length; i++) {
      Font.drawText(ctx, lines[i], x + 16, y + 32 + i * 11, i < 3 ? C.white : C.pale);
    }
    button(ctx, x + w / 2 + 6, y + h - 24, 120, 16, 'START DIGGING!', { color: C.green }, function () {
      Au.play('newarea');
      S.get().firstRun = false;
      S.saveSoon();
      app.closeModal();
      app.setTab('dig');
    });
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
    button(ctx, x + w / 2 - 40, y + h - 24, 80, 16, 'COLLECT', { color: C.green }, function () {
      Au.play('coin'); app.closeModal();
    });
  }

  // =========================================================================
  // TOASTS + FLASH
  // =========================================================================
  function drawToasts(ctx) {
    const baseY = VH - TAB_H - 14;
    for (let i = 0; i < toasts.length; i++) {
      const to = toasts[toasts.length - 1 - i];
      const a = to.life < 200 ? to.life / 200 : (to.life > to.ttl - 300 ? (to.ttl - to.life) / 300 : 1);
      const y = baseY - i * 16;
      const w = Font.textW(to.msg) + 16 + (to.icon ? 10 : 0);
      ctx.globalAlpha = Math.max(0, a) * 0.92;
      ctx.fillStyle = '#12101c';
      ctx.fillRect(VW / 2 - w / 2, y - 2, w, 13);
      ctx.fillStyle = to.color;
      ctx.fillRect(VW / 2 - w / 2, y - 2, 2, 13);
      ctx.globalAlpha = Math.max(0, a);
      let tx = VW / 2 - w / 2 + 6;
      if (to.icon) { R.blit(ctx, to.icon, tx + 4, y + 4, 8); tx += 12; }
      Font.drawText(ctx, to.msg, tx, y + 1, to.color, { shadow: C.ink });
      ctx.globalAlpha = 1;
    }
  }

  function drawFlash(ctx) {
    if (flash > 0) {
      ctx.globalAlpha = (flash / 350) * 0.5;
      ctx.fillStyle = C.red;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
  }

  window.UI = {
    reset: reset, push: push, handleTap: handleTap,
    toast: toast, tickToasts: tickToasts,
    triggerHazard: triggerHazard, shakeOffset: shakeOffset,
    drawHUD: drawHUD, drawTabs: drawTabs,
    drawMuseumOverlay: drawMuseumOverlay,
    drawDigOverlay: drawDigOverlay,
    drawShop: drawShop,
    drawCollection: drawCollection,
    drawSites: drawSites,
    drawIntro: drawIntro,
    drawOffline: drawOffline,
    drawToasts: drawToasts, drawFlash: drawFlash,
    fmt: fmt, displayName: displayName,
  };
})();
