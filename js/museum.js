// ---------------------------------------------------------------------------
// Museum simulation: passive coin income + wandering pixel-art visitors that
// stroll between exhibits. Purely cosmetic movement, but tied to the real
// "visitors" stat so a busy museum actually looks busy.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const S = window.GameState;

  // Museum floor pixel geometry (world space). Grid cells are 26px so the
  // whole 13x8 floor is visible in the 480x270 viewport without panning.
  const CELL = 26;
  const originX = 71;
  const originY = 30;

  function cellToPx(cx, cy) {
    return { x: originX + cx * CELL, y: originY + cy * CELL };
  }
  function floorRect() {
    return {
      x: originX, y: originY,
      w: S.MW * CELL, h: S.MH * CELL,
    };
  }

  const visitors = [];
  let incomeAcc = 0;      // fractional coins waiting to be banked
  let popupAcc = [];      // floating "+N" coin popups (world space)
  let spawnCooldown = 0;

  function makeVisitor() {
    const fr = floorRect();
    const variant = (Math.random() * window.Assets.visitors.length) | 0;
    const v = {
      variant: variant,
      x: fr.x + Math.random() * fr.w,
      y: fr.y + fr.h - 8 - Math.random() * (fr.h * 0.5),
      tx: 0, ty: 0,
      spd: 10 + Math.random() * 8,
      frame: 0, ftime: 0,
      facing: 1,
      pause: 0,
      bob: Math.random() * Math.PI * 2,
    };
    pickTarget(v);
    return v;
  }

  function pickTarget(v) {
    const fr = floorRect();
    const st = S.get();
    // 55% chance to walk toward an exhibit, else random stroll
    const exhibits = st.museum.filter(function (m) { return window.GameData.fossilById(m.id) || window.GameData.catalogById(m.id); });
    if (exhibits.length && Math.random() < 0.6) {
      const e = exhibits[(Math.random() * exhibits.length) | 0];
      const fp = S.itemFootprint(e.id);
      const p = cellToPx(e.cx + fp.w / 2, e.cy + fp.h);
      v.tx = p.x + (Math.random() * 24 - 12);
      v.ty = p.y + 6 + Math.random() * 10;
    } else {
      v.tx = fr.x + 8 + Math.random() * (fr.w - 16);
      v.ty = fr.y + fr.h * 0.4 + Math.random() * (fr.h * 0.55);
    }
    v.tx = Math.max(fr.x + 4, Math.min(fr.x + fr.w - 4, v.tx));
    v.ty = Math.max(fr.y + fr.h * 0.25, Math.min(fr.y + fr.h - 4, v.ty));
  }

  function update(dt) {
    const st = S.get();
    const stats = S.computeStats();

    // --- passive income ---
    incomeAcc += stats.cps * dt / 1000;
    if (incomeAcc >= 1) {
      const gain = Math.floor(incomeAcc);
      incomeAcc -= gain;
      S.addCoins(gain);
      // spawn a coin popup near a random exhibit
      const exhibits = st.museum.filter(function (m) { return window.GameData.fossilById(m.id); });
      if (exhibits.length && popupAcc.length < 8) {
        const e = exhibits[(Math.random() * exhibits.length) | 0];
        const fp = S.itemFootprint(e.id);
        const p = cellToPx(e.cx + fp.w / 2, e.cy);
        popupAcc.push({ x: p.x, y: p.y - 4, life: 0, amount: gain });
      }
    }

    // --- visitor population management ---
    const target = Math.min(24, stats.visitors);
    spawnCooldown -= dt;
    if (visitors.length < target && spawnCooldown <= 0) {
      visitors.push(makeVisitor());
      spawnCooldown = 400;
    } else if (visitors.length > target && spawnCooldown <= 0) {
      visitors.pop();
      spawnCooldown = 600;
    }

    // --- move visitors ---
    for (let i = 0; i < visitors.length; i++) {
      const v = visitors[i];
      v.bob += dt / 1000 * 6;
      if (v.pause > 0) {
        v.pause -= dt;
        v.frame = 0;
        continue;
      }
      const dx = v.tx - v.x, dy = v.ty - v.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        // arrived — admire for a moment, then pick a new target
        v.pause = 700 + Math.random() * 1800;
        pickTarget(v);
        continue;
      }
      const step = v.spd * dt / 1000;
      v.x += dx / dist * step;
      v.y += dy / dist * step;
      v.facing = dx >= 0 ? 1 : -1;
      v.ftime += dt;
      if (v.ftime > 180) { v.ftime = 0; v.frame ^= 1; }
    }

    // --- popups ---
    for (let i = popupAcc.length - 1; i >= 0; i--) {
      popupAcc[i].life += dt;
      popupAcc[i].y -= dt / 1000 * 14;
      if (popupAcc[i].life > 1200) popupAcc.splice(i, 1);
    }
  }

  function getVisitors() { return visitors; }
  function getPopups() { return popupAcc; }

  window.Museum = {
    CELL: CELL,
    cellToPx: cellToPx,
    floorRect: floorRect,
    update: update,
    getVisitors: getVisitors,
    getPopups: getPopups,
    originX: originX,
    originY: originY,
  };
})();
