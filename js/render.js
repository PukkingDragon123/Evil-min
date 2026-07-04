// ---------------------------------------------------------------------------
// World rendering: the museum gallery and the excavation (minesweeper) board.
// Everything draws at integer logical pixels into a 480x270 buffer that main.js
// upscales with nearest-neighbor, so the whole game stays crisp pixel art.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const A = window.Assets;
  const C = A.C;
  const S = window.GameState;
  const M = window.Museum;
  const D = window.GameData;

  const VW = 480, VH = 270;
  const HUD_H = 26, TAB_H = 26;
  const CONTENT = { x: 0, y: HUD_H, w: VW, h: VH - HUD_H - TAB_H };

  const NUMCOL = {
    1: '#5b6ee1', 2: '#6abe30', 3: '#ac3232', 4: '#3f3f74',
    5: '#8f563b', 6: '#37946e', 7: '#222034', 8: '#696a6a',
  };

  function blit(ctx, img, cx, cy, maxDim, forceScale) {
    if (!img) return;
    let scale = forceScale || Math.max(1, Math.floor(maxDim / Math.max(img.width, img.height)));
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  }

  function blitBottom(ctx, img, cx, byy, scale) {
    scale = scale || 1;
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(byy - h), w, h);
  }

  // =========================================================================
  // MUSEUM
  // =========================================================================
  function museumFloorRect() { return M.floorRect(); }

  function drawMuseumBackground(ctx, t) {
    const fr = M.floorRect();
    // gallery wall (upper) — soft vertical gradient via two bands
    ctx.fillStyle = '#2b2740';
    ctx.fillRect(CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    ctx.fillStyle = '#33304d';
    ctx.fillRect(CONTENT.x, CONTENT.y, CONTENT.w, 22);

    // back wall band directly behind the floor top
    const wallY = fr.y - 16;
    ctx.fillStyle = C.brown;
    ctx.fillRect(fr.x - 6, wallY, fr.w + 12, 18);
    ctx.fillStyle = C.ltbrown;
    ctx.fillRect(fr.x - 6, wallY, fr.w + 12, 2);
    ctx.fillStyle = C.maroon;
    ctx.fillRect(fr.x - 6, wallY + 15, fr.w + 12, 2);
    // framed windows along the back wall
    for (let wx = fr.x + 8; wx < fr.x + fr.w - 14; wx += 46) {
      ctx.fillStyle = C.steel; ctx.fillRect(wx, wallY + 3, 14, 10);
      ctx.fillStyle = C.cyan; ctx.fillRect(wx + 1, wallY + 4, 12, 8);
      ctx.fillStyle = C.pale; ctx.fillRect(wx + 1, wallY + 4, 5, 8);
      ctx.fillStyle = C.brown; ctx.fillRect(wx + 6, wallY + 4, 1, 8);
      ctx.fillStyle = C.brown; ctx.fillRect(wx, wallY + 8, 14, 1);
    }

    // marble floor checker (procedural, crisp)
    for (let cy = 0; cy < S.MH; cy++) {
      for (let cx = 0; cx < S.MW; cx++) {
        const p = M.cellToPx(cx, cy);
        const alt = (cx + cy) % 2 === 0;
        ctx.fillStyle = alt ? C.pale : '#bcd0f7';
        ctx.fillRect(p.x, p.y, M.CELL, M.CELL);
      }
    }
    // grout lines
    ctx.fillStyle = 'rgba(155,173,183,0.5)';
    for (let cx = 0; cx <= S.MW; cx++) {
      ctx.fillRect(fr.x + cx * M.CELL, fr.y, 1, fr.h);
    }
    for (let cy = 0; cy <= S.MH; cy++) {
      ctx.fillRect(fr.x, fr.y + cy * M.CELL, fr.w, 1);
    }
    // floor edge shading
    ctx.fillStyle = 'rgba(34,32,52,0.18)';
    ctx.fillRect(fr.x, fr.y, fr.w, 3);
    // outer frame
    ctx.fillStyle = C.gold;
    ctx.fillRect(fr.x - 2, fr.y - 2, fr.w + 4, 2);
    ctx.fillRect(fr.x - 2, fr.y + fr.h, fr.w + 4, 2);
    ctx.fillRect(fr.x - 2, fr.y - 2, 2, fr.h + 4);
    ctx.fillRect(fr.x + fr.w, fr.y - 2, 2, fr.h + 4);
  }

  function itemSprite(id, t) {
    const fos = D.fossilById(id);
    if (fos) return A.exhibits[id];
    const cat = D.catalogById(id);
    if (!cat) return null;
    if (cat.anim && A.objects[cat.sprite] && A.objects[cat.sprite].length) {
      return A.objects[cat.sprite][(t / 380 | 0) % A.objects[cat.sprite].length];
    }
    const obj = A.objects[cat.sprite];
    if (obj && obj.length) return obj[0];
    return obj;
  }

  // Build a depth-sorted draw list of exhibits + visitors, then paint.
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
    for (let i = 0; i < visitors.length; i++) {
      list.push({ y: visitors[i].y, kind: 'vis', v: visitors[i] });
    }
    list.sort(function (a, b) { return a.y - b.y; });

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.kind === 'item') {
        const fos = D.fossilById(e.it.id);
        const sprite = itemSprite(e.it.id, t);
        // shadow
        const shW = fos ? 26 : (e.fp.w >= 2 ? 24 : 14);
        const sh = shW >= 26 ? A.shadows.s26 : (shW >= 24 ? A.shadows.s26 : (shW >= 16 ? A.shadows.s16 : A.shadows.s10));
        ctx.drawImage(sh, Math.round(e.cx - sh.width / 2), Math.round(e.y - sh.height + 1));
        if (sprite) blitBottom(ctx, sprite, e.cx, e.y + 1, 1);
        // legendary shimmer
        if (fos && fos.rarity === 'legendary') {
          const sp = A.dig.sparkle[(t / 250 | 0) % 2];
          blit(ctx, sp, e.cx + Math.sin(t / 400) * 8, e.y - 40 + Math.cos(t / 300) * 4, 5, 1);
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

    // coin popups
    const pops = M.getPopups();
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i];
      const a = 1 - p.life / 1200;
      ctx.globalAlpha = Math.max(0, a);
      Font.drawText(ctx, '+' + p.amount, p.x, p.y, C.yellow, { align: 1, shadow: C.maroon });
      ctx.globalAlpha = 1;
    }

    // placement ghost
    if (placement && placement.id) {
      const fp = S.itemFootprint(placement.id);
      const px = M.originX + placement.cx * M.CELL;
      const py = M.originY + placement.cy * M.CELL;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = placement.valid ? '#99e550' : '#ac3232';
      ctx.fillRect(px, py, fp.w * M.CELL, fp.h * M.CELL);
      ctx.globalAlpha = 1;
      const sprite = itemSprite(placement.id, t);
      if (sprite) {
        ctx.globalAlpha = 0.85;
        blitBottom(ctx, sprite, px + fp.w * M.CELL / 2, py + fp.h * M.CELL + 1, 1);
        ctx.globalAlpha = 1;
      }
      // grid outline
      ctx.strokeStyle = placement.valid ? '#ffffff' : '#ac3232';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, fp.w * M.CELL - 1, fp.h * M.CELL - 1);
    }
  }

  function drawMuseum(ctx, t, placement) {
    drawMuseumBackground(ctx, t);
    drawMuseumEntities(ctx, t, placement);
    // vignette
    ctx.fillStyle = 'rgba(20,18,31,0.10)';
    ctx.fillRect(CONTENT.x, CONTENT.y, CONTENT.w, 4);
  }

  function screenToMuseumCell(sx, sy) {
    const cx = Math.floor((sx - M.originX) / M.CELL);
    const cy = Math.floor((sy - M.originY) / M.CELL);
    if (cx < 0 || cy < 0 || cx >= S.MW || cy >= S.MH) return null;
    return { cx: cx, cy: cy };
  }

  // Return index of museum item occupying a cell, or -1.
  function museumItemAt(cx, cy) {
    const st = S.get();
    for (let i = st.museum.length - 1; i >= 0; i--) {
      const it = st.museum[i];
      const fp = S.itemFootprint(it.id);
      if (cx >= it.cx && cx < it.cx + fp.w && cy >= it.cy && cy < it.cy + fp.h) return i;
    }
    return -1;
  }

  // =========================================================================
  // DIG (minesweeper)
  // =========================================================================
  function computeDigLayout(site) {
    const availW = VW - 20;
    const availH = CONTENT.h - 30; // leave header room
    let ts = Math.floor(Math.min(availW / site.cols, availH / site.rows));
    ts = Math.max(13, Math.min(28, ts));
    const boardW = ts * site.cols;
    const boardH = ts * site.rows;
    const bx = Math.round((VW - boardW) / 2);
    const by = Math.round(CONTENT.y + 30 + (availH - boardH) / 2);
    return { ts: ts, bx: bx, by: by, boardW: boardW, boardH: boardH };
  }

  function drawDigTileHidden(ctx, px, py, ts, seed, hover) {
    // raised dirt mound
    ctx.fillStyle = hover ? '#a0714f' : C.ltbrown;
    ctx.fillRect(px, py, ts, ts);
    // bevel: light top/left, dark bottom/right
    ctx.fillStyle = hover ? '#c08a63' : '#a5714b';
    ctx.fillRect(px, py, ts, 2);
    ctx.fillRect(px, py, 2, ts);
    ctx.fillStyle = C.brown;
    ctx.fillRect(px, py + ts - 2, ts, 2);
    ctx.fillRect(px + ts - 2, py, 2, ts);
    // texture specks (deterministic per tile)
    const r = A.rng(seed * 2654435761 >>> 0);
    ctx.fillStyle = C.brown;
    for (let i = 0; i < 3; i++) {
      const dx = 3 + (r() * (ts - 6)) | 0;
      const dy = 3 + (r() * (ts - 6)) | 0;
      ctx.fillRect(px + dx, py + dy, 1, 1);
    }
    ctx.fillStyle = C.tan;
    ctx.fillRect(px + 3 + (r() * (ts - 6) | 0), py + 3 + (r() * (ts - 6) | 0), 1, 1);
  }

  function drawDigTileOpen(ctx, px, py, ts) {
    // sunken pit
    ctx.fillStyle = C.tan;
    ctx.fillRect(px, py, ts, ts);
    ctx.fillStyle = '#c9945c';
    ctx.fillRect(px, py, ts, 2);
    ctx.fillRect(px, py, 2, ts);
    ctx.fillStyle = C.cream;
    ctx.fillRect(px, py + ts - 1, ts, 1);
    ctx.fillRect(px + ts - 1, py, 1, ts);
  }

  function drawDig(ctx, t, site, board, cursor) {
    const L = computeDigLayout(site);
    const ts = L.ts;
    // pit backdrop
    ctx.fillStyle = C.maroon;
    ctx.fillRect(L.bx - 3, L.by - 3, L.boardW + 6, L.boardH + 6);
    ctx.fillStyle = C.brown;
    ctx.fillRect(L.bx - 2, L.by - 2, L.boardW + 4, L.boardH + 4);

    for (let y = 0; y < site.rows; y++) {
      for (let x = 0; x < site.cols; x++) {
        const cell = board.cells[y * site.cols + x];
        const px = L.bx + x * ts;
        const py = L.by + y * ts;
        const hover = cursor && cursor.x === x && cursor.y === y;

        if (!cell.revealed) {
          drawDigTileHidden(ctx, px, py, ts, (y * site.cols + x) + 1, hover);
          if (cell.flagged) {
            blit(ctx, A.icons.flag, px + ts / 2, py + ts / 2, ts - 6);
          }
          continue;
        }

        // revealed
        if (cell.hazard) {
          // hazard pit — red glow + gas/boulder
          ctx.fillStyle = '#5a2530';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#7a2f3a';
          ctx.fillRect(px, py, ts, 2);
          const useGas = (x + y) % 2 === 0;
          if (useGas) {
            const g = A.dig.gas[(t / 300 | 0) % 2];
            blit(ctx, g, px + ts / 2, py + ts / 2, ts - 2);
          } else {
            blit(ctx, A.dig.boulder, px + ts / 2, py + ts / 2, ts - 2);
          }
          continue;
        }

        drawDigTileOpen(ctx, px, py, ts);

        if (cell.content) {
          drawContent(ctx, cell.content, px, py, ts, t);
        } else if (cell.adj > 0) {
          Font.drawText(ctx, String(cell.adj), px + ts / 2, py + (ts - 7) / 2,
            NUMCOL[cell.adj] || C.ink, { align: 1, scale: (ts >= 20 ? 2 : 1) });
        }
      }
    }

    // cursor highlight ring
    if (cursor) {
      const px = L.bx + cursor.x * ts;
      const py = L.by + cursor.y * ts;
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1;
      const pulse = (Math.sin(t / 150) * 0.5 + 0.5);
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
      ctx.globalAlpha = 1;
    }
    return L;
  }

  function drawContent(ctx, content, px, py, ts, t) {
    const cx = px + ts / 2, cy = py + ts / 2;
    // soft glow behind loot
    let glow = null;
    if (content.type === 'piece') {
      const fos = D.fossilById(content.fossilId);
      glow = fos ? (D.RARITY[fos.rarity].color) : C.white;
    } else if (content.type === 'ore') {
      const ore = D.oreById(content.oreId);
      glow = ore ? D.RARITY[ore.rarity].color : C.tan;
    } else if (content.type === 'gem') { glow = C.cyan; }
    else { glow = C.yellow; }
    ctx.globalAlpha = 0.28 + 0.12 * (Math.sin(t / 300) * 0.5 + 0.5);
    ctx.fillStyle = glow;
    ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
    ctx.globalAlpha = 1;

    let img = null;
    if (content.type === 'piece') {
      img = A.pieces[content.piece] || A.pieces.body;
    } else if (content.type === 'ore') {
      const ore = D.oreById(content.oreId);
      img = A.ores[ore ? ore.sprite : 'copper'];
    } else if (content.type === 'gem') {
      img = A.icons.gem;
    } else {
      img = A.icons.coin;
    }
    blit(ctx, img, cx, cy, ts - 4);
    // tiny sparkle for rare loot
    if (content.type === 'gem' || content.type === 'piece') {
      const sp = A.dig.sparkle[(t / 220 | 0) % 2];
      ctx.drawImage(sp, Math.round(px + ts - 6), Math.round(py + 1));
    }
    if (content.type === 'coins') {
      // nothing extra
    }
  }

  function screenToDigCell(site, L, sx, sy) {
    const x = Math.floor((sx - L.bx) / L.ts);
    const y = Math.floor((sy - L.by) / L.ts);
    if (x < 0 || y < 0 || x >= site.cols || y >= site.rows) return null;
    return { x: x, y: y };
  }

  window.Render = {
    VW: VW, VH: VH, HUD_H: HUD_H, TAB_H: TAB_H, CONTENT: CONTENT,
    drawMuseum: drawMuseum,
    drawDig: drawDig,
    computeDigLayout: computeDigLayout,
    screenToMuseumCell: screenToMuseumCell,
    screenToDigCell: screenToDigCell,
    museumItemAt: museumItemAt,
    blit: blit, blitBottom: blitBottom,
  };
})();
