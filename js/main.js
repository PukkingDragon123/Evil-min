// ---------------------------------------------------------------------------
// Boot, main loop, input routing, and the top-level "app" state that ties the
// museum, the excavation board, the shop and all UI together.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const S = window.GameState;
  const D = window.GameData;
  const R = window.Render;
  const UI = window.UI;
  const Au = window.Audio2;
  const Dig = window.Dig;

  const VW = R.VW, VH = R.VH;

  // ---- scaling to fill the window (letterboxed, crisp) -------------------
  function resize() {
    const winW = window.innerWidth, winH = window.innerHeight;
    const scale = Math.min(winW / VW, winH / VH);
    canvas.style.width = Math.floor(VW * scale) + 'px';
    canvas.style.height = Math.floor(VH * scale) + 'px';
  }
  window.addEventListener('resize', resize);

  // =========================================================================
  // APP STATE
  // =========================================================================
  const app = {
    tab: 'museum',
    siteId: 'quarry',
    flagMode: false,
    editMode: false,
    placement: null,      // {id, cost, gems, moveIndex, cx, cy, valid}
    modal: null,          // 'collection' | 'sites' | 'intro' | 'offline'
    scrollY: 0, scrollMax: 0, scrollRegion: null,
    selectedItem: -1,
    offlineData: null,
    digCursor: null,
    digLayout: null,

    setTab: function (id) {
      this.tab = id;
      this.editMode = false;
      this.selectedItem = -1;
      if (id !== 'museum' && this.placement) this.cancelPlacement();
    },
    openModal: function (name) { this.modal = name; this.scrollY = 0; },
    closeModal: function () { this.modal = null; },
    beginPlacement: function (id, cost, gems) {
      const cell = S.findFreeCell(id) || { cx: 0, cy: 0 };
      this.placement = { id: id, cost: cost, gems: gems, moveIndex: -1, cx: cell.cx, cy: cell.cy, valid: true };
      this.setTab('museum');
      this.updateGhostValid();
    },
    startMove: function (index) {
      const it = S.get().museum[index];
      if (!it) return;
      this.placement = { id: it.id, cost: 0, gems: 0, moveIndex: index, cx: it.cx, cy: it.cy, valid: true };
      this.selectedItem = -1;
      this.editMode = true;
      UI.toast('Tap a new spot', C().cyan);
    },
    cancelPlacement: function () { this.placement = null; },
    updateGhostValid: function () {
      if (!this.placement) return;
      const fp = S.itemFootprint(this.placement.id);
      this.placement.valid = S.cellFree(this.placement.cx, this.placement.cy, fp.w, fp.h,
        this.placement.moveIndex >= 0 ? this.placement.moveIndex : undefined);
    },
    commitPlacement: function (cx, cy) {
      const p = this.placement;
      if (!p) return;
      const fp = S.itemFootprint(p.id);
      cx = Math.max(0, Math.min(S.MW - fp.w, cx));
      cy = Math.max(0, Math.min(S.MH - fp.h, cy));
      const ignore = p.moveIndex >= 0 ? p.moveIndex : undefined;
      if (!S.cellFree(cx, cy, fp.w, fp.h, ignore)) { Au.play('error'); UI.toast('Blocked - try elsewhere', C().salmon); return; }
      if (p.moveIndex >= 0) {
        S.moveItem(p.moveIndex, cx, cy);
        Au.play('place');
      } else {
        if (!S.spend(p.cost, p.gems)) { Au.play('error'); UI.toast('Cannot afford', C().salmon); this.placement = null; return; }
        S.placeItem(p.id, cx, cy);
        S.get().owned[p.id] = (S.get().owned[p.id] || 0) + 1;
        Au.play('place');
        S.addXp(6);
        UI.toast(UI.displayName(p.id) + ' placed!', C().lime);
      }
      this.placement = null;
      S.saveSoon();
    },
    sellItem: function (index) {
      const st = S.get();
      const it = st.museum[index];
      if (!it) return;
      const fos = D.fossilById(it.id);
      let refund = 0;
      if (fos) {
        refund = Math.floor(fos.value * 0.5);
        st.mounted[it.id] = Math.max(0, (st.mounted[it.id] || 1) - 1);
        st.stats.mounted = Math.max(0, st.stats.mounted - 1);
      } else {
        const cat = D.catalogById(it.id);
        if (cat) {
          const owned = (st.owned[it.id] || 1);
          refund = Math.floor(D.scaledCost(cat.cost, owned - 1) * 0.5);
          st.owned[it.id] = Math.max(0, owned - 1);
        }
      }
      S.removeItem(index);
      S.addCoins(refund);
      this.selectedItem = -1;
      UI.toast('Sold for ' + refund + ' coins', C().yellow);
      S.saveSoon();
    },
    regenSite: function () {
      const site = D.siteById(this.siteId);
      Dig.regenerate(site);
    },
    celebrate: function (fossilId) {
      const st = S.get();
      // find the just-placed exhibit
      let target = null;
      for (let i = st.museum.length - 1; i >= 0; i--) {
        if (st.museum[i].id === fossilId) { target = st.museum[i]; break; }
      }
      let px = VW / 2, py = VH / 2;
      if (target) {
        const fp = S.itemFootprint(fossilId);
        const p = window.Museum.cellToPx(target.cx + fp.w / 2, target.cy);
        px = p.x; py = p.y - 10;
      }
      spawnConfetti(px, py);
    },
  };

  function C() { return window.Assets.C; }

  // ---- confetti particles -------------------------------------------------
  let particles = [];
  const CONF_COLORS = ['#fbf236', '#99e550', '#5b6ee1', '#d95763', '#5fcde4', '#d77bba'];
  function spawnConfetti(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 70;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0, ttl: 900 + Math.random() * 700,
        col: CONF_COLORS[(Math.random() * CONF_COLORS.length) | 0],
        sz: 1 + (Math.random() * 2 | 0),
      });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vy += 120 * dt / 1000;
      if (p.life > p.ttl) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = 1 - p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
    ctx.globalAlpha = 1;
  }

  // =========================================================================
  // INPUT
  // =========================================================================
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * VW,
      y: (clientY - rect.top) / rect.height * VH,
    };
  }

  let pointerDown = false;
  let downPos = null;
  let downTime = 0;
  let moved = false;
  let longPressTimer = null;
  let longPressFired = false;
  let scrollDragging = false;
  let lastPointer = { x: 0, y: 0 };

  function onDown(x, y) {
    Au.resume();
    pointerDown = true;
    downPos = { x: x, y: y };
    lastPointer = { x: x, y: y };
    downTime = S.nowMs();
    moved = false;
    longPressFired = false;

    // scroll drag start (collection modal)
    if (app.modal === 'collection' && app.scrollRegion &&
        inRect(x, y, app.scrollRegion)) {
      scrollDragging = true;
    }

    // long-press to flag in dig
    if (app.tab === 'dig' && !app.modal) {
      const site = D.siteById(app.siteId);
      const L = app.digLayout;
      if (L) {
        const cell = R.screenToDigCell(site, L, x, y);
        if (cell) {
          longPressTimer = setTimeout(function () {
            longPressFired = true;
            const board = Dig.getBoard(site);
            const c = board.cells[cell.y * site.cols + cell.x];
            if (!c.revealed) {
              const on = Dig.toggleFlag(board, cell.x, cell.y);
              Au.play(on ? 'flag' : 'unflag');
            }
          }, 340);
        }
      }
    }
  }

  function onMove(x, y) {
    if (!pointerDown) {
      // hover: dig cursor + placement ghost follow (desktop)
      updateHover(x, y);
      return;
    }
    const dx = x - downPos.x, dy = y - downPos.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      moved = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
    if (scrollDragging) {
      app.scrollY = Math.max(0, Math.min(app.scrollMax, app.scrollY - (y - lastPointer.y)));
    }
    // dragging ghost in museum placement
    if (app.tab === 'museum' && app.placement && !app.modal) {
      const cell = R.screenToMuseumCell(x, y);
      if (cell) {
        const fp = S.itemFootprint(app.placement.id);
        app.placement.cx = Math.max(0, Math.min(S.MW - fp.w, cell.cx));
        app.placement.cy = Math.max(0, Math.min(S.MH - fp.h, cell.cy));
        app.updateGhostValid();
      }
    }
    lastPointer = { x: x, y: y };
    updateHover(x, y);
  }

  function updateHover(x, y) {
    if (app.tab === 'dig' && !app.modal) {
      const site = D.siteById(app.siteId);
      const L = app.digLayout;
      app.digCursor = L ? R.screenToDigCell(site, L, x, y) : null;
    } else {
      app.digCursor = null;
    }
    if (app.tab === 'museum' && app.placement && !app.modal) {
      const cell = R.screenToMuseumCell(x, y);
      if (cell) {
        const fp = S.itemFootprint(app.placement.id);
        app.placement.cx = Math.max(0, Math.min(S.MW - fp.w, cell.cx));
        app.placement.cy = Math.max(0, Math.min(S.MH - fp.h, cell.cy));
        app.updateGhostValid();
      }
    }
  }

  function onUp(x, y) {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    pointerDown = false;
    scrollDragging = false;
    if (longPressFired) return; // long-press already handled
    if (moved) return;          // was a drag, not a tap

    // 1) UI buttons first
    if (UI.handleTap(x, y)) return;
    // 2) modal open but tapped outside handled by backdrop button already
    if (app.modal) return;

    // 3) world interaction
    if (app.tab === 'dig') {
      handleDigTap(x, y);
    } else if (app.tab === 'museum') {
      handleMuseumTap(x, y);
    }
  }

  function handleDigTap(x, y) {
    const st = S.get();
    const site = D.siteById(app.siteId);
    const L = app.digLayout;
    if (!L) return;
    const cell = R.screenToDigCell(site, L, x, y);
    if (!cell) return;
    const board = Dig.getBoard(site);
    const c = board.cells[cell.y * site.cols + cell.x];

    if (app.flagMode) {
      if (!c.revealed) { const on = Dig.toggleFlag(board, cell.x, cell.y); Au.play(on ? 'flag' : 'unflag'); }
      return;
    }
    if (c.revealed || c.flagged) return;
    if (st.energy <= 0) { Au.play('error'); UI.toast('Out of energy - refill or wait', C().salmon); return; }

    S.useEnergy(1);
    st.stats.digs++;
    const res = Dig.reveal(board, site, cell.x, cell.y);
    Au.play('dig');

    if (res.hazard) {
      UI.triggerHazard();
      Au.play('hazard');
      UI.toast('Hazard! Careful where you dig.', C().salmon, window.Assets.dig.gas[0]);
      S.addXp(1);
    } else {
      if (res.revealedCount > 0) S.addXp(1);
      // process rewards
      for (let i = 0; i < res.rewards.length; i++) {
        announceReward(res.rewards[i].content);
      }
      if (res.rewards.length === 0) {
        Au.play('reveal');
      }
    }
    if (Dig.isCleared(board)) {
      UI.toast('Section cleared! Dig a new one.', C().lime, window.Assets.icons.pick);
      S.addXp(15);
      Au.play('levelup');
    }
    S.saveSoon();
  }

  function announceReward(content) {
    if (content.type === 'piece') {
      const f = D.fossilById(content.fossilId);
      Au.play('find');
      S.addXp(6);
      S.get().stats.found++;
      UI.toast('Found ' + f.name + ' ' + D.PIECE_NAMES[content.piece] + '!',
        D.RARITY[f.rarity].color, window.Assets.pieces[content.piece]);
      if (S.canAssemble(content.fossilId)) {
        UI.toast(f.name + ' ready to mount!', C().yellow, window.Assets.icons.bone);
      }
    } else if (content.type === 'ore') {
      const o = D.oreById(content.oreId);
      Au.play('ore');
      S.addXp(3);
      UI.toast('Mined ' + o.name, D.RARITY[o.rarity].color, window.Assets.ores[o.sprite]);
    } else if (content.type === 'coins') {
      Au.play('coin');
      UI.toast('+' + content.amount + ' coins', C().yellow, window.Assets.icons.coin);
    } else if (content.type === 'gem') {
      Au.play('ore');
      S.addXp(5);
      UI.toast('+' + content.amount + ' gem' + (content.amount > 1 ? 's' : '') + '!', C().cyan, window.Assets.icons.gem);
    }
  }

  function handleMuseumTap(x, y) {
    // placement commit
    if (app.placement) {
      const cell = R.screenToMuseumCell(x, y);
      if (cell) app.commitPlacement(cell.cx, cell.cy);
      else { app.cancelPlacement(); }
      return;
    }
    // edit selection
    if (app.editMode) {
      const cell = R.screenToMuseumCell(x, y);
      if (!cell) { app.selectedItem = -1; return; }
      const idx = R.museumItemAt(cell.cx, cell.cy);
      app.selectedItem = idx;
      if (idx >= 0) Au.play('click');
      return;
    }
    // idle tap: little info toast if tapping an exhibit
    const cell = R.screenToMuseumCell(x, y);
    if (cell) {
      const idx = R.museumItemAt(cell.cx, cell.cy);
      if (idx >= 0) {
        const it = S.get().museum[idx];
        const f = D.fossilById(it.id);
        if (f) {
          UI.toast(f.name + ' - ' + f.blurb, D.RARITY[f.rarity].color);
          Au.play('click');
        }
      }
    }
  }

  function inRect(x, y, r) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

  // ---- pointer + touch wiring --------------------------------------------
  canvas.addEventListener('mousedown', function (e) { const p = toLogical(e.clientX, e.clientY); onDown(p.x, p.y); });
  window.addEventListener('mousemove', function (e) { const p = toLogical(e.clientX, e.clientY); onMove(p.x, p.y); });
  window.addEventListener('mouseup', function (e) { const p = toLogical(e.clientX, e.clientY); onUp(p.x, p.y); });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    const p = toLogical(e.clientX, e.clientY);
    // right-click flags in dig
    if (app.tab === 'dig' && !app.modal) {
      const site = D.siteById(app.siteId);
      const L = app.digLayout;
      if (L) {
        const cell = R.screenToDigCell(site, L, p.x, p.y);
        if (cell) {
          const board = Dig.getBoard(site);
          if (!board.cells[cell.y * site.cols + cell.x].revealed) {
            const on = Dig.toggleFlag(board, cell.x, cell.y);
            Au.play(on ? 'flag' : 'unflag');
          }
        }
      }
    }
  });
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toLogical(t.clientX, t.clientY);
    onDown(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toLogical(t.clientX, t.clientY);
    onMove(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toLogical(t.clientX, t.clientY);
    onUp(p.x, p.y);
  }, { passive: false });

  // =========================================================================
  // MAIN LOOP
  // =========================================================================
  let last = 0;
  let levelWatch = 1;

  function frame(now) {
    if (!last) last = now;
    let dt = now - last;
    last = now;
    if (dt > 100) dt = 100; // clamp after tab-away

    // updates
    S.tickEnergy(dt);
    window.Museum.update(dt);
    updateParticles(dt);
    UI.tickToasts(dt);

    // level-up detection
    const lvl = S.get().level;
    if (lvl > levelWatch) {
      levelWatch = lvl;
      Au.play('levelup');
      UI.toast('Level up! Now level ' + lvl, C().gold, window.Assets.icons.gem);
      spawnConfetti(VW / 2, R.HUD_H + 20);
    }

    // ---- render ----
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#14121f';
    ctx.fillRect(0, 0, VW, VH);

    const so = UI.shakeOffset();
    ctx.save();
    ctx.translate(Math.round(so.x), Math.round(so.y));

    UI.reset(); // clear click registry each frame

    if (app.tab === 'museum') {
      R.drawMuseum(ctx, now, app.placement);
      drawParticles();
    } else if (app.tab === 'dig') {
      const site = D.siteById(app.siteId);
      const board = Dig.getBoard(site);
      app.digLayout = R.drawDig(ctx, now, site, board, app.digCursor);
    } else if (app.tab === 'shop') {
      UI.drawShop(ctx, now, app);
    }

    // HUD + tabs always
    UI.drawHUD(ctx, now, app);
    UI.drawTabs(ctx, now, app);

    // tab overlays
    if (!app.modal) {
      if (app.tab === 'museum') UI.drawMuseumOverlay(ctx, now, app);
      else if (app.tab === 'dig') {
        const site = D.siteById(app.siteId);
        const board = Dig.getBoard(site);
        UI.drawDigOverlay(ctx, now, app, board, site);
      }
    }

    // modals
    if (app.modal === 'collection') UI.drawCollection(ctx, now, app);
    else if (app.modal === 'sites') UI.drawSites(ctx, now, app);
    else if (app.modal === 'intro') UI.drawIntro(ctx, now, app);
    else if (app.modal === 'offline') UI.drawOffline(ctx, now, app);

    UI.drawToasts(ctx);
    UI.drawFlash(ctx);

    ctx.restore();

    requestAnimationFrame(frame);
  }

  // =========================================================================
  // BOOT
  // =========================================================================
  function boot() {
    window.Assets.build();
    const had = S.load();
    const st = S.get();
    Au.setMuted(!!st.muted);
    levelWatch = st.level;

    // pick a sensible starting site (first unlocked)
    app.siteId = 'quarry';
    for (let i = 0; i < D.SITES.length; i++) {
      if (st.sites[D.SITES[i].id]) { app.siteId = D.SITES[i].id; }
    }
    app.siteId = st.sites[app.siteId] ? app.siteId : 'quarry';

    if (!had || st.firstRun) {
      app.tab = 'museum';
      app.openModal('intro');
    } else {
      const off = S.claimOffline();
      if (off) { app.offlineData = off; app.openModal('offline'); }
      app.tab = 'museum';
    }

    resize();
    requestAnimationFrame(frame);

    // periodic save
    setInterval(function () { S.save(); }, 15000);
    window.addEventListener('beforeunload', function () { S.save(); });
    // save when tab hidden (mobile)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) S.save();
    });
  }

  boot();
})();
