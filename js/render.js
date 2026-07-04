// ---------------------------------------------------------------------------
// World rendering (v2): a richer museum gallery, biome-themed excavation
// boards, and the Block-Blast packing grid. Everything draws at integer
// logical pixels into a 480x270 buffer that main.js upscales crisply.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const A = window.Assets;
  const C = A.C;
  const S = window.GameState;
  const M = window.Museum;
  const D = window.GameData;
  const Inv = window.Inventory;

  const VW = 480, VH = 270;
  const HUD_H = 26, TAB_H = 26;
  const CONTENT = { x: 0, y: HUD_H, w: VW, h: VH - HUD_H - TAB_H };

  const NUMCOL = { 1: '#63b3ff', 2: '#7ee060', 3: '#ff6b6b', 4: '#a389ff', 5: '#ffb84d', 6: '#4fd6c0', 7: '#e0e0e0', 8: '#9badb7' };

  function blit(ctx, img, cx, cy, maxDim, forceScale) {
    if (!img) return;
    const scale = forceScale || Math.max(1, Math.floor(maxDim / Math.max(img.width, img.height)));
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  }
  function blitBottom(ctx, img, cx, byy, scale) {
    scale = scale || 1;
    ctx.drawImage(img, Math.round(cx - img.width * scale / 2), Math.round(byy - img.height * scale), img.width * scale, img.height * scale);
  }
  function vgrad(ctx, x, y, w, h, c0, c1) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function softGlow(ctx, cx, cy, r, col, alpha) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }

  // =========================================================================
  // MUSEUM
  // =========================================================================
  function drawMuseumBackground(ctx, t) {
    const fr = M.floorRect();
    // upper gallery wall with gradient
    vgrad(ctx, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h, '#3a3556', '#2b2740');

    // back wall band + wainscot behind the floor top
    const wallY = fr.y - 18;
    vgrad(ctx, fr.x - 8, wallY, fr.w + 16, 20, '#7a4a34', C.brown);
    ctx.fillStyle = C.ltbrown; ctx.fillRect(fr.x - 8, wallY, fr.w + 16, 2);
    ctx.fillStyle = C.maroon; ctx.fillRect(fr.x - 8, wallY + 17, fr.w + 16, 2);
    // pillars + framed windows showing sky
    for (let wx = fr.x + 6; wx < fr.x + fr.w - 16; wx += 52) {
      // window
      vgrad(ctx, wx, wallY + 3, 16, 12, '#8fd0ff', '#5b9bd6');
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(wx + 1, wallY + 4, 5, 10);
      ctx.fillStyle = C.brown; ctx.fillRect(wx + 7, wallY + 4, 1, 10); ctx.fillRect(wx, wallY + 9, 16, 1);
      ctx.fillStyle = C.ltbrown; ctx.fillRect(wx - 1, wallY + 2, 18, 1);
      // pillar
      ctx.fillStyle = '#5a3324'; ctx.fillRect(wx + 24, wallY, 4, 20);
      ctx.fillStyle = C.ltbrown; ctx.fillRect(wx + 24, wallY, 1, 20);
    }

    // marble floor checker
    for (let cy = 0; cy < S.MH; cy++) for (let cx = 0; cx < S.MW; cx++) {
      const p = M.cellToPx(cx, cy);
      ctx.fillStyle = (cx + cy) % 2 === 0 ? C.pale : '#c2d6fb';
      ctx.fillRect(p.x, p.y, M.CELL, M.CELL);
    }
    // subtle marble veins
    ctx.fillStyle = 'rgba(155,173,183,0.25)';
    const rr = A.rng(1234);
    for (let i = 0; i < 22; i++) ctx.fillRect(fr.x + (rr() * fr.w) | 0, fr.y + (rr() * fr.h) | 0, 2, 1);
    // grout
    ctx.fillStyle = 'rgba(120,140,160,0.35)';
    for (let cx = 0; cx <= S.MW; cx++) ctx.fillRect(fr.x + cx * M.CELL, fr.y, 1, fr.h);
    for (let cy = 0; cy <= S.MH; cy++) ctx.fillRect(fr.x, fr.y + cy * M.CELL, fr.w, 1);
    // top edge shade + gold frame
    ctx.fillStyle = 'rgba(34,32,52,0.2)'; ctx.fillRect(fr.x, fr.y, fr.w, 3);
    ctx.fillStyle = C.gold;
    ctx.fillRect(fr.x - 2, fr.y - 2, fr.w + 4, 2); ctx.fillRect(fr.x - 2, fr.y + fr.h, fr.w + 4, 2);
    ctx.fillRect(fr.x - 2, fr.y - 2, 2, fr.h + 4); ctx.fillRect(fr.x + fr.w, fr.y - 2, 2, fr.h + 4);

    // ceiling spotlights onto exhibits
    const st = S.get();
    for (let i = 0; i < st.museum.length; i++) {
      const it = st.museum[i];
      if (!D.fossilById(it.id)) continue;
      const fp = S.itemFootprint(it.id);
      const cx = M.originX + (it.cx + fp.w / 2) * M.CELL;
      const topY = fr.y;
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.moveTo(cx - 3, topY); ctx.lineTo(cx + 3, topY);
      ctx.lineTo(cx + 14, topY + (fp.h + 0.5) * M.CELL); ctx.lineTo(cx - 14, topY + (fp.h + 0.5) * M.CELL);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function itemSprite(id, t) {
    const fos = D.fossilById(id);
    if (fos) return A.exhibits[id];
    const cat = D.catalogById(id);
    if (!cat) return null;
    const obj = A.objects[cat.sprite];
    if (cat.anim && obj && obj.length) return obj[(t / 360 | 0) % obj.length];
    if (obj && obj.length) return obj[0];
    return obj;
  }

  function drawMuseumEntities(ctx, t, placement) {
    const st = S.get();
    const list = [];
    for (let i = 0; i < st.museum.length; i++) {
      const it = st.museum[i];
      const fp = S.itemFootprint(it.id);
      const feetY = M.originY + (it.cy + fp.h) * M.CELL;
      const cxpx = M.originX + (it.cx + fp.w / 2) * M.CELL;
      list.push({ y: feetY, kind: 'item', it: it, fp: fp, cx: cxpx });
    }
    const visitors = M.getVisitors();
    for (let i = 0; i < visitors.length; i++) list.push({ y: visitors[i].y, kind: 'vis', v: visitors[i] });
    list.sort(function (a, b) { return a.y - b.y; });

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.kind === 'item') {
        const fos = D.fossilById(e.it.id);
        const sprite = itemSprite(e.it.id, t);
        // rarity glow behind exhibits
        if (fos) {
          const rc = D.RARITY[fos.rarity];
          softGlow(ctx, e.cx, e.y - 18, 22, rc.glow, fos.rarity === 'legendary' ? 0.28 : (fos.rarity === 'epic' ? 0.2 : 0.13));
        }
        const sh = fos ? A.shadows.s26 : (e.fp.w >= 2 ? A.shadows.s26 : (e.fp.w >= 2 ? A.shadows.s16 : A.shadows.s10));
        ctx.drawImage(sh, Math.round(e.cx - sh.width / 2), Math.round(e.y - sh.height + 1));
        if (sprite) blitBottom(ctx, sprite, e.cx, e.y + 1, 1);
        if (fos && (fos.rarity === 'legendary' || fos.rarity === 'epic')) {
          const sp = A.dig.sparkle[(t / 250 | 0) % 2];
          blit(ctx, sp, e.cx + Math.sin(t / 420 + e.cx) * 9, e.y - 42 + Math.cos(t / 300) * 4, 5, 1);
        }
      } else {
        const v = e.v;
        const set = v.facing >= 0 ? A.visitors[v.variant].right : A.visitors[v.variant].left;
        const img = set[v.frame];
        const bob = Math.round(Math.sin(v.bob) * 0.5);
        ctx.drawImage(A.shadows.s10, Math.round(v.x - 5), Math.round(v.y - 2));
        ctx.drawImage(img, Math.round(v.x - img.width / 2), Math.round(v.y - img.height + bob));
      }
    }

    const pops = M.getPopups();
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i]; const a = 1 - p.life / 1200;
      ctx.globalAlpha = Math.max(0, a);
      Font.drawText(ctx, '+' + p.amount, p.x, p.y, C.yellow, { align: 1, shadow: C.maroon });
      ctx.globalAlpha = 1;
    }

    if (placement && placement.id) {
      const fp = S.itemFootprint(placement.id);
      const px = M.originX + placement.cx * M.CELL, py = M.originY + placement.cy * M.CELL;
      ctx.globalAlpha = 0.45; ctx.fillStyle = placement.valid ? '#99e550' : '#ac3232';
      ctx.fillRect(px, py, fp.w * M.CELL, fp.h * M.CELL); ctx.globalAlpha = 1;
      const sprite = itemSprite(placement.id, t);
      if (sprite) { ctx.globalAlpha = 0.85; blitBottom(ctx, sprite, px + fp.w * M.CELL / 2, py + fp.h * M.CELL + 1, 1); ctx.globalAlpha = 1; }
      ctx.strokeStyle = placement.valid ? '#ffffff' : '#ac3232'; ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, fp.w * M.CELL - 1, fp.h * M.CELL - 1);
    }
  }

  function drawMuseum(ctx, t, placement) {
    drawMuseumBackground(ctx, t);
    drawMuseumEntities(ctx, t, placement);
    // gentle vignette
    ctx.fillStyle = 'rgba(20,18,31,0.16)';
    ctx.fillRect(CONTENT.x, CONTENT.y, CONTENT.w, 3);
    ctx.fillRect(CONTENT.x, CONTENT.y + CONTENT.h - 3, CONTENT.w, 3);
  }

  function screenToMuseumCell(sx, sy) {
    const cx = Math.floor((sx - M.originX) / M.CELL), cy = Math.floor((sy - M.originY) / M.CELL);
    if (cx < 0 || cy < 0 || cx >= S.MW || cy >= S.MH) return null;
    return { cx: cx, cy: cy };
  }
  function museumItemAt(cx, cy) {
    const st = S.get();
    for (let i = st.museum.length - 1; i >= 0; i--) {
      const it = st.museum[i]; const fp = S.itemFootprint(it.id);
      if (cx >= it.cx && cx < it.cx + fp.w && cy >= it.cy && cy < it.cy + fp.h) return i;
    }
    return -1;
  }

  // =========================================================================
  // DIG (biome-themed inverted minesweeper)
  // =========================================================================
  function computeDigLayout(site, board) {
    const cols = board ? board.cols : site.cols, rows = board ? board.rows : site.rows;
    const availW = VW - 16, availH = CONTENT.h - 30;
    let ts = Math.floor(Math.min(availW / cols, availH / rows));
    ts = Math.max(13, Math.min(26, ts));
    const boardW = ts * cols, boardH = ts * rows;
    const bx = Math.round((VW - boardW) / 2);
    const by = Math.round(CONTENT.y + 30 + (availH - boardH) / 2);
    return { ts: ts, bx: bx, by: by, boardW: boardW, boardH: boardH, cols: cols, rows: rows };
  }

  function drawDigBackground(ctx, biome) {
    vgrad(ctx, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h, biome.sky[0], biome.sky[1]);
    // strata bands
    const bands = biome.soil;
    let y = CONTENT.y + 40;
    for (let i = 0; i < 6 && y < CONTENT.y + CONTENT.h; i++) {
      ctx.fillStyle = bands[i % bands.length];
      const h = 22 + (i % 2) * 10;
      ctx.globalAlpha = 0.5 - i * 0.03;
      ctx.fillRect(CONTENT.x, y, CONTENT.w, h);
      y += h; ctx.globalAlpha = 1;
    }
    // fossil silhouettes faint in the strata
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#000';
    const rr = A.rng(555);
    for (let i = 0; i < 5; i++) ctx.fillRect(CONTENT.x + (rr() * CONTENT.w) | 0, CONTENT.y + 60 + (rr() * (CONTENT.h - 70)) | 0, 12, 3);
    ctx.globalAlpha = 1;
  }

  function drawDigTile(ctx, cell, px, py, ts, biome, t, hover, mode) {
    if (!cell.revealed) {
      // raised soil mound
      ctx.fillStyle = hover ? shade(biome.tileHi, 1.08) : biome.tileHi;
      ctx.fillRect(px, py, ts, ts);
      ctx.fillStyle = biome.soil[1]; ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
      ctx.fillStyle = biome.tileHi; ctx.fillRect(px + 1, py + 1, ts - 2, 2); ctx.fillRect(px + 1, py + 1, 2, ts - 2);
      ctx.fillStyle = biome.edge; ctx.fillRect(px, py + ts - 2, ts, 2); ctx.fillRect(px + ts - 2, py, 2, ts);
      // texture + crack
      const r = A.rng(((px * 73856093) ^ (py * 19349663)) >>> 0);
      ctx.fillStyle = biome.soil[2];
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 3 + (r() * (ts - 6) | 0), py + 3 + (r() * (ts - 6) | 0), 1, 1);
      if (r() > 0.7) { ctx.fillStyle = biome.crack; ctx.globalAlpha = 0.5; ctx.fillRect(px + (ts >> 1), py + 3, 1, ts - 6); ctx.globalAlpha = 1; }
      if (cell.flagged) {
        blit(ctx, A.icons.flag, px + ts / 2, py + ts / 2, ts - 5);
        ctx.strokeStyle = biome.accent; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
        ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3); ctx.globalAlpha = 1;
      }
      if (hover && mode === 'excavate' && !cell.flagged) {
        // targeting reticle
        ctx.strokeStyle = biome.accent; ctx.lineWidth = 1;
        ctx.strokeRect(px + 2.5, py + 2.5, ts - 5, ts - 5);
      }
      return;
    }
    // revealed sunken pit
    ctx.fillStyle = biome.soil[2]; ctx.fillRect(px, py, ts, ts);
    ctx.fillStyle = biome.edge; ctx.fillRect(px, py, ts, 2); ctx.fillRect(px, py, 2, ts);
    ctx.fillStyle = shade(biome.soil[2], 1.15); ctx.fillRect(px, py + ts - 1, ts, 1); ctx.fillRect(px + ts - 1, py, 1, ts);

    if (cell.node && cell.extracted) {
      // crater where a treasure was pulled
      ctx.fillStyle = '#1a1016';
      ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
      ctx.fillStyle = biome.edge; ctx.fillRect(px + 3, py + 3, ts - 6, 1);
      // faint residue icon of what was here
      ctx.globalAlpha = 0.4;
      drawNodeIcon(ctx, cell.node, px + ts / 2, py + ts / 2, ts - 8, t);
      ctx.globalAlpha = 1;
      return;
    }
    if (cell.adj > 0) {
      Font.drawText(ctx, String(cell.adj), px + ts / 2, py + (ts - 7 * (ts >= 20 ? 2 : 1)) / 2,
        NUMCOL[cell.adj] || C.white, { align: 1, scale: ts >= 20 ? 2 : 1, shadow: '#000' });
    }
  }

  function drawNodeIcon(ctx, node, cx, cy, dim, t) {
    if (node.type === 'ore') {
      const ore = D.oreById(node.oreId);
      blit(ctx, A.ores[ore ? ore.sprite : 'copper'], cx, cy, dim);
    } else if (node.type === 'gem') {
      blit(ctx, A.icons.gem, cx, cy, dim);
    } else {
      // fossil: little skull
      blit(ctx, A.pieces.skull, cx, cy, dim);
    }
  }

  function drawDig(ctx, t, site, board, cursor, mode, anims) {
    const biome = D.BIOMES[site.biome] || D.BIOMES.temperate;
    drawDigBackground(ctx, biome);
    const L = computeDigLayout(site, board);
    const ts = L.ts;
    // pit frame
    ctx.fillStyle = biome.edge; ctx.fillRect(L.bx - 3, L.by - 3, L.boardW + 6, L.boardH + 6);
    ctx.fillStyle = biome.soil[2]; ctx.fillRect(L.bx - 2, L.by - 2, L.boardW + 4, L.boardH + 4);

    for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
      const cell = board.cells[y * L.cols + x];
      const px = L.bx + x * ts, py = L.by + y * ts;
      const hover = cursor && cursor.x === x && cursor.y === y;
      drawDigTile(ctx, cell, px, py, ts, biome, t, hover, mode);
    }

    // dig-team animations
    if (anims) {
      for (let i = 0; i < anims.length; i++) {
        const an = anims[i];
        const px = L.bx + an.x * ts + ts / 2, py = L.by + an.y * ts + ts / 2;
        const frame = A.dig.digger[(an.life / 120 | 0) % 2];
        blit(ctx, frame, px, py - 2, ts, 1);
      }
    }

    // cursor highlight
    if (cursor) {
      const px = L.bx + cursor.x * ts, py = L.by + cursor.y * ts;
      ctx.strokeStyle = mode === 'excavate' ? biome.accent : C.white;
      ctx.lineWidth = 1;
      const pulse = Math.sin(t / 150) * 0.5 + 0.5;
      ctx.globalAlpha = 0.4 + pulse * 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
      ctx.globalAlpha = 1;
    }
    return L;
  }

  function screenToDigCell(L, sx, sy) {
    const x = Math.floor((sx - L.bx) / L.ts), y = Math.floor((sy - L.by) / L.ts);
    if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return null;
    return { x: x, y: y };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, r * f | 0); g = Math.min(255, g * f | 0); b = Math.min(255, b * f | 0);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // =========================================================================
  // INVENTORY (Block-Blast packing grid)
  // =========================================================================
  function computeInvLayout() {
    const n = Inv.size();
    const maxGrid = Math.min(200, CONTENT.h - 16);
    let cs = Math.floor(Math.min((VW * 0.5) / n, maxGrid / n));
    cs = Math.max(16, Math.min(30, cs));
    const gw = cs * n;
    const gx = 16, gy = Math.round(CONTENT.y + (CONTENT.h - gw) / 2);
    return { cs: cs, n: n, gx: gx, gy: gy, gw: gw };
  }

  function drawPieceCells(ctx, cells, ox, oy, cs, rarity, alpha) {
    const rc = D.RARITY[rarity] || D.RARITY.common;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (let i = 0; i < cells.length; i++) {
      const x = ox + cells[i][0] * cs, y = oy + cells[i][1] * cs;
      ctx.fillStyle = rc.color; ctx.fillRect(x, y, cs, cs);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, cs, 2); ctx.fillRect(x, y, 2, cs);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + cs - 2, cs, 2); ctx.fillRect(x + cs - 2, y, 2, cs);
      // bone speck
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + cs / 2 - 1, y + cs / 2 - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function bounds(cells) {
    let mw = 0, mh = 0;
    for (let i = 0; i < cells.length; i++) { mw = Math.max(mw, cells[i][0] + 1); mh = Math.max(mh, cells[i][1] + 1); }
    return { w: mw, h: mh };
  }

  function drawInventory(ctx, t, app) {
    vgrad(ctx, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h, '#2b2f45', '#1f2233');
    const L = computeInvLayout();
    const st = S.get();

    // grid frame
    ctx.fillStyle = C.ink; ctx.fillRect(L.gx - 3, L.gy - 3, L.gw + 6, L.gw + 6);
    ctx.fillStyle = '#14121f'; ctx.fillRect(L.gx - 1, L.gy - 1, L.gw + 2, L.gw + 2);

    // predicted-clear highlight (rows/cols the ghost would complete)
    const ghost = app.invGhost;
    let clearMark = {};
    const active = st.queue[app.activePiece] || null;
    if (ghost && active && Inv.canPlace(active, ghost.gx, ghost.gy)) {
      clearMark = predictClears(active, ghost.gx, ghost.gy, L.n);
    }

    for (let y = 0; y < L.n; y++) for (let x = 0; x < L.n; x++) {
      const px = L.gx + x * L.cs, py = L.gy + y * L.cs;
      const cell = Inv.at(x, y);
      // slot
      ctx.fillStyle = (x + y) % 2 === 0 ? '#252838' : '#20222f';
      ctx.fillRect(px, py, L.cs - 1, L.cs - 1);
      if (clearMark[y * L.n + x]) { ctx.fillStyle = 'rgba(255,240,120,0.18)'; ctx.fillRect(px, py, L.cs - 1, L.cs - 1); }
      if (cell) drawPieceCells(ctx, [[0, 0]], px, py, L.cs, cell.rarity, 1);
    }

    // ghost preview of active piece
    if (ghost && active) {
      const ok = Inv.canPlace(active, ghost.gx, ghost.gy);
      const ox = L.gx + ghost.gx * L.cs, oy = L.gy + ghost.gy * L.cs;
      if (ok) drawPieceCells(ctx, active.cells, ox, oy, L.cs, active.rarity, 0.55);
      else {
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#ac3232';
        for (let i = 0; i < active.cells.length; i++) {
          const cx = ghost.gx + active.cells[i][0], cy = ghost.gy + active.cells[i][1];
          if (cx < L.n && cy < L.n) ctx.fillRect(L.gx + cx * L.cs, L.gy + cy * L.cs, L.cs - 1, L.cs - 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    app.invLayout = L;
    return L;
  }

  function predictClears(piece, gx, gy, n) {
    // simulate occupancy
    const occ = {};
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Inv.at(x, y)) occ[y * n + x] = true;
    for (let i = 0; i < piece.cells.length; i++) occ[(gy + piece.cells[i][1]) * n + (gx + piece.cells[i][0])] = true;
    const mark = {};
    for (let y = 0; y < n; y++) { let full = true; for (let x = 0; x < n; x++) if (!occ[y * n + x]) { full = false; break; } if (full) for (let x = 0; x < n; x++) mark[y * n + x] = true; }
    for (let x = 0; x < n; x++) { let full = true; for (let y = 0; y < n; y++) if (!occ[y * n + x]) { full = false; break; } if (full) for (let y = 0; y < n; y++) mark[y * n + x] = true; }
    return mark;
  }

  function screenToInvCell(L, sx, sy) {
    const x = Math.floor((sx - L.gx) / L.cs), y = Math.floor((sy - L.gy) / L.cs);
    if (x < 0 || y < 0 || x >= L.n || y >= L.n) return null;
    return { gx: x, gy: y };
  }

  window.Render = {
    VW: VW, VH: VH, HUD_H: HUD_H, TAB_H: TAB_H, CONTENT: CONTENT,
    drawMuseum: drawMuseum, drawDig: drawDig, drawInventory: drawInventory,
    computeDigLayout: computeDigLayout, computeInvLayout: computeInvLayout,
    screenToMuseumCell: screenToMuseumCell, screenToDigCell: screenToDigCell, screenToInvCell: screenToInvCell,
    museumItemAt: museumItemAt, drawPieceCells: drawPieceCells, bounds: bounds,
    blit: blit, blitBottom: blitBottom,
  };
})();
