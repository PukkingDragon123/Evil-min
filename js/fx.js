// ---------------------------------------------------------------------------
// Juice: particles, floating text, expanding rings, screen shake + flash.
// A single shared layer used by the museum, the dig board and the inventory.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  let parts = [];
  let texts = [];
  let rings = [];
  let flights = []; // sprites arcing from A to B (fossil crate -> camp)
  let shakeT = 0, shakeMag = 0;
  let flashT = 0, flashDur = 0, flashCol = '#ffffff';

  const CONF = ['#fbf236', '#99e550', '#5b6ee1', '#d95763', '#5fcde4', '#d77bba', '#df7126'];

  function burst(x, y, color, count, opts) {
    opts = opts || {};
    count = count || 10;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.spMin || 12) + Math.random() * (opts.spMax || 60);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 10),
        g: opts.g == null ? 120 : opts.g, life: 0, ttl: (opts.ttl || 500) + Math.random() * 300,
        col: color || CONF[(Math.random() * CONF.length) | 0], sz: opts.sz || (1 + (Math.random() * 2 | 0)),
      });
    }
  }
  function confetti(x, y, count) {
    count = count || 40;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 80;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 140, life: 0, ttl: 900 + Math.random() * 800, col: CONF[(Math.random() * CONF.length) | 0], sz: 1 + (Math.random() * 2 | 0) });
    }
  }
  function dust(x, y, color, count) {
    count = count || 8;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 10 + Math.random() * 34;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, life: 0, ttl: 320 + Math.random() * 260, col: color || '#d9a066', sz: 1 + (Math.random() * 2 | 0) });
    }
  }
  function floatText(x, y, text, col, opts) {
    opts = opts || {};
    texts.push({ x: x, y: y, text: text, col: col || '#ffffff', life: 0, ttl: opts.ttl || 950, vy: opts.vy || 16, scale: opts.scale || 1, shadow: opts.shadow || '#222034' });
  }
  function ring(x, y, col, maxR) {
    rings.push({ x: x, y: y, r: 2, maxR: maxR || 16, life: 0, ttl: 380, col: col || '#ffffff' });
  }
  // Send a small sprite arcing from (x0,y0) to (x1,y1); dust puff on landing.
  function fly(x0, y0, x1, y1, img, ttl) {
    flights.push({ x0: x0, y0: y0, x1: x1, y1: y1, img: img, life: 0, ttl: ttl || 620 });
  }
  function shake(ms, mag) { shakeT = Math.max(shakeT, ms); shakeMag = Math.max(shakeMag, mag || 3); }
  function flash(ms, col) { flashT = ms; flashDur = ms; flashCol = col || '#ffffff'; }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += p.g * dt / 1000;
      if (p.life > p.ttl) parts.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life += dt; t.y -= t.vy * dt / 1000;
      if (t.life > t.ttl) texts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt; r.r = 2 + (r.maxR - 2) * (r.life / r.ttl);
      if (r.life > r.ttl) rings.splice(i, 1);
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.life += dt;
      if (f.life >= f.ttl) { dust(f.x1, f.y1, '#d9a066', 5); flights.splice(i, 1); }
    }
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;
  }

  function draw(ctx) {
    // rings
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]; const a = 1 - r.life / r.ttl;
      ctx.globalAlpha = Math.max(0, a) * 0.8;
      ctx.strokeStyle = r.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.r), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // particles
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; const a = 1 - p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
    ctx.globalAlpha = 1;
    // flights (arc with lift)
    for (let i = 0; i < flights.length; i++) {
      const f = flights[i]; const u = Math.min(1, f.life / f.ttl);
      const x = f.x0 + (f.x1 - f.x0) * u;
      const y = f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * 26;
      if (f.img) ctx.drawImage(f.img, Math.round(x - f.img.width / 2), Math.round(y - f.img.height / 2));
    }
    // floating text
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const a = t.life < 120 ? t.life / 120 : (t.life > t.ttl - 250 ? (t.ttl - t.life) / 250 : 1);
      ctx.globalAlpha = Math.max(0, a);
      window.Font.drawText(ctx, t.text, t.x, t.y, t.col, { align: 1, scale: t.scale, shadow: t.shadow });
      ctx.globalAlpha = 1;
    }
  }

  function drawFlash(ctx, w, h) {
    if (flashT > 0) {
      ctx.globalAlpha = (flashT / flashDur) * 0.45;
      ctx.fillStyle = flashCol; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    }
  }

  function shakeOffset() {
    if (shakeT <= 0) return { x: 0, y: 0 };
    const m = shakeMag * (shakeT / 260);
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }

  window.FX = {
    burst: burst, confetti: confetti, dust: dust, floatText: floatText, ring: ring, fly: fly,
    shake: shake, flash: flash, update: update, draw: draw, drawFlash: drawFlash, shakeOffset: shakeOffset,
  };
})();
