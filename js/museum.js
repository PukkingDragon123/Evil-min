// ---------------------------------------------------------------------------
// Museum simulation: passive income, wandering visitors (incl. VIPs who tip),
// litter that accumulates, and staff (janitors sweep it up, guides/curators
// stroll). Everything simulated on the currently-viewed floor.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const S = window.GameState;
  const D = window.GameData;

  const CELL = 26, originX = 71, originY = 30;
  function cellToPx(cx, cy) { return { x: originX + cx * CELL, y: originY + cy * CELL }; }
  function floorRect() { return { x: originX, y: originY, w: S.MW * CELL, h: S.MH * CELL }; }

  let visitors = [], staff = [], popups = [];
  let incomeAcc = 0, spawnCd = 0, trashTimer = 0, vipTipTimer = 0, lastFloor = -1;

  function fr() { return floorRect(); }
  function randInFloor() { const r = fr(); return { x: r.x + 8 + Math.random() * (r.w - 16), y: r.y + r.h * 0.35 + Math.random() * (r.h * 0.55) }; }

  function makeVisitor(isVip) {
    const r = fr();
    const v = {
      vip: !!isVip, variant: (Math.random() * window.Assets.visitors.length) | 0,
      x: r.x + Math.random() * r.w, y: r.y + r.h - 8 - Math.random() * (r.h * 0.5),
      tx: 0, ty: 0, spd: 10 + Math.random() * 8, frame: 0, ftime: 0, facing: 1, pause: 0, bob: Math.random() * 6.28,
    };
    pickTarget(v); return v;
  }
  function makeStaff(role) {
    const r = fr();
    return { role: role, x: r.x + Math.random() * r.w, y: r.y + r.h * 0.5 + Math.random() * (r.h * 0.4), tx: 0, ty: 0, spd: role === 'janitor' ? 22 : 14, frame: 0, ftime: 0, facing: 1, pause: 0, bob: Math.random() * 6.28, target: -1 };
  }

  function pickTarget(v) {
    const r = fr(); const m = S.curMuseum();
    const exhibits = m.filter(function (it) { return D.fossilById(it.id) || D.catalogById(it.id); });
    if (exhibits.length && Math.random() < 0.6) {
      const e = exhibits[(Math.random() * exhibits.length) | 0]; const fp = S.itemFootprint(e.id);
      const p = cellToPx(e.cx + fp.w / 2, e.cy + fp.h);
      v.tx = p.x + (Math.random() * 24 - 12); v.ty = p.y + 6 + Math.random() * 10;
    } else { const p = randInFloor(); v.tx = p.x; v.ty = p.y; }
    v.tx = Math.max(r.x + 4, Math.min(r.x + r.w - 4, v.tx));
    v.ty = Math.max(r.y + r.h * 0.25, Math.min(r.y + r.h - 4, v.ty));
  }

  function syncStaff() {
    // rebuild staff entity list to match hired counts on this floor
    const want = { janitor: S.get().staff.janitor || 0, guide: S.get().staff.guide || 0, curator: S.get().staff.curator || 0 };
    const have = { janitor: 0, guide: 0, curator: 0 };
    staff.forEach(function (s) { have[s.role]++; });
    ['janitor', 'guide', 'curator'].forEach(function (role) {
      while (have[role] < want[role]) { staff.push(makeStaff(role)); have[role]++; }
      while (have[role] > want[role]) { const i = staff.findIndex(function (s) { return s.role === role; }); if (i >= 0) staff.splice(i, 1); have[role]--; }
    });
  }

  function moveTo(e, dt) {
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 3) return true;
    const step = e.spd * dt / 1000;
    e.x += dx / d * step; e.y += dy / d * step; e.facing = dx >= 0 ? 1 : -1;
    e.ftime += dt; if (e.ftime > 170) { e.ftime = 0; e.frame ^= 1; }
    return false;
  }

  function update(dt) {
    const s = S.get();
    if (s.floor !== lastFloor) { lastFloor = s.floor; visitors = []; staff = []; popups = []; }
    const stats = S.computeStats();

    // passive income
    incomeAcc += stats.cps * dt / 1000;
    if (incomeAcc >= 1) {
      const gain = Math.floor(incomeAcc); incomeAcc -= gain; S.addCoins(gain);
      const m = S.curMuseum().filter(function (it) { return D.fossilById(it.id); });
      if (m.length && popups.length < 8) { const e = m[(Math.random() * m.length) | 0]; const fp = S.itemFootprint(e.id); const p = cellToPx(e.cx + fp.w / 2, e.cy); popups.push({ x: p.x, y: p.y - 4, life: 0, amount: gain, vip: false }); }
    }

    // VIP tips
    vipTipTimer += dt;
    if (vipTipTimer > 3200) {
      vipTipTimer = 0;
      for (let i = 0; i < visitors.length; i++) {
        if (visitors[i].vip) {
          const tip = D.VIP_TIP + Math.round(stats.wonder * 0.05);
          S.addCoins(tip);
          if (popups.length < 10) popups.push({ x: visitors[i].x, y: visitors[i].y - 12, life: 0, amount: tip, vip: true });
        }
      }
    }

    // visitor population
    const target = Math.min(26, stats.visitors);
    spawnCd -= dt;
    if (visitors.length < target && spawnCd <= 0) {
      const vipChance = Math.min(0.15, 0.02 + stats.wonder / 4000);
      const isVip = Math.random() < vipChance;
      visitors.push(makeVisitor(isVip));
      if (isVip) { s.stats.vipServed++; if (window.Quests) window.Quests.emit('vip'); if (window.FX) window.FX.ring(visitors[visitors.length - 1].x, visitors[visitors.length - 1].y - 8, window.Assets.C.gold, 14); }
      spawnCd = 420;
    } else if (visitors.length > target && spawnCd <= 0) { visitors.pop(); spawnCd = 620; }

    // move visitors
    for (let i = 0; i < visitors.length; i++) {
      const v = visitors[i]; v.bob += dt / 1000 * 6;
      if (v.pause > 0) { v.pause -= dt; v.frame = 0; continue; }
      if (moveTo(v, dt)) { v.pause = 700 + Math.random() * 1800; pickTarget(v); }
    }

    // trash accumulation (more visitors -> more litter)
    trashTimer += dt;
    const trashEvery = Math.max(1500, 9000 - stats.visitors * 250);
    if (trashTimer > trashEvery) {
      trashTimer = 0;
      if (visitors.length > 0 && S.curTrash().length < D.TRASH_CAP) {
        const p = randInFloor(); S.addTrash(Math.round(p.x), Math.round(p.y));
      }
    }

    // staff
    syncStaff();
    const trash = S.curTrash();
    for (let i = 0; i < staff.length; i++) {
      const e = staff[i]; e.bob += dt / 1000 * 6;
      if (e.role === 'janitor') {
        // find nearest trash
        if (e.target < 0 || e.target >= trash.length) { e.target = nearestTrash(e, trash); }
        if (e.target >= 0 && trash[e.target]) {
          e.tx = trash[e.target].x; e.ty = trash[e.target].y;
          if (moveTo(e, dt)) {
            // sweep it up
            const idx = e.target;
            if (window.FX) window.FX.dust(trash[idx].x, trash[idx].y, window.Assets.C.dkgray2, 5);
            S.removeTrash(idx);
            if (window.Quests) window.Quests.emit('trash');
            e.target = -1;
          }
        } else {
          if (e.pause > 0) { e.pause -= dt; } else if (moveTo(e, dt)) { e.pause = 500 + Math.random() * 1200; const p = randInFloor(); e.tx = p.x; e.ty = p.y; }
        }
      } else {
        if (e.pause > 0) { e.pause -= dt; e.frame = 0; } else if (moveTo(e, dt)) { e.pause = 800 + Math.random() * 1600; pickTarget(e); }
      }
    }

    // popups
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].life += dt; popups[i].y -= dt / 1000 * 14; if (popups[i].life > 1300) popups.splice(i, 1); }
  }

  function nearestTrash(e, trash) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < trash.length; i++) { const dx = trash[i].x - e.x, dy = trash[i].y - e.y; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  }

  window.Museum = {
    CELL: CELL, cellToPx: cellToPx, floorRect: floorRect, originX: originX, originY: originY,
    update: update, getVisitors: function () { return visitors; }, getStaff: function () { return staff; }, getPopups: function () { return popups; },
  };
})();
