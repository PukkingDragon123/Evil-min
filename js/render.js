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
    const spotM = S.curMuseum();
    for (let i = 0; i < spotM.length; i++) {
      const it = spotM[i];
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
    const museum = S.curMuseum();
    const list = [];
    for (let i = 0; i < museum.length; i++) {
      const it = museum[i];
      const fp = S.itemFootprint(it.id);
      const feetY = M.originY + (it.cy + fp.h) * M.CELL;
      const cxpx = M.originX + (it.cx + fp.w / 2) * M.CELL;
      list.push({ y: feetY, kind: 'item', it: it, fp: fp, cx: cxpx });
    }
    const trash = S.curTrash();
    for (let i = 0; i < trash.length; i++) list.push({ y: trash[i].y, kind: 'trash', tr: trash[i], idx: i });
    const visitors = M.getVisitors();
    for (let i = 0; i < visitors.length; i++) list.push({ y: visitors[i].y, kind: 'vis', v: visitors[i] });
    const staff = M.getStaff();
    for (let i = 0; i < staff.length; i++) list.push({ y: staff[i].y, kind: 'staff', s: staff[i] });
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
        const big = fos || (e.fp.w >= 2 && e.fp.h >= 2);
        const wide = e.fp.w >= 2 || e.fp.h >= 2;
        const sh = big ? A.shadows.s26 : (wide ? A.shadows.s16 : A.shadows.s10);
        ctx.drawImage(sh, Math.round(e.cx - sh.width / 2), Math.round(e.y - sh.height + 1));
        if (sprite) blitBottom(ctx, sprite, e.cx, e.y + 1, 1);
        if (fos && (fos.rarity === 'legendary' || fos.rarity === 'epic')) {
          const sp = A.dig.sparkle[(t / 250 | 0) % 2];
          blit(ctx, sp, e.cx + Math.sin(t / 420 + e.cx) * 9, e.y - 42 + Math.cos(t / 300) * 4, 5, 1);
        }
      } else if (e.kind === 'trash') {
        const variant = (Math.abs(e.tr.x * 7 + e.tr.y * 13)) % A.trash.length;
        const img = A.trash[variant];
        ctx.drawImage(img, Math.round(e.tr.x - img.width / 2), Math.round(e.tr.y - img.height));
      } else if (e.kind === 'staff') {
        const s = e.s; const set = s.facing >= 0 ? A.staff[s.role].right : A.staff[s.role].left;
        const img = set[s.frame]; const bob = Math.round(Math.sin(s.bob) * 0.5);
        ctx.drawImage(A.shadows.s10, Math.round(s.x - 6), Math.round(s.y - 2));
        ctx.drawImage(img, Math.round(s.x - img.width / 2), Math.round(s.y - img.height + bob));
      } else {
        const v = e.v;
        const sheet = v.vip ? A.vip : A.visitors[v.variant];
        const set = v.facing >= 0 ? sheet.right : sheet.left;
        const img = set[v.frame];
        const bob = Math.round(Math.sin(v.bob) * 0.5);
        if (v.vip) softGlow(ctx, v.x, v.y - 7, 11, C.gold, 0.22);
        ctx.drawImage(A.shadows.s10, Math.round(v.x - 5), Math.round(v.y - 2));
        ctx.drawImage(img, Math.round(v.x - img.width / 2), Math.round(v.y - img.height + bob));
        if (v.vip) { const sp = A.dig.sparkle[(t / 220 | 0) % 2]; ctx.drawImage(sp, Math.round(v.x - 2), Math.round(v.y - img.height - 4)); }
      }
    }

    const pops = M.getPopups();
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i]; const a = 1 - p.life / 1300;
      ctx.globalAlpha = Math.max(0, a);
      Font.drawText(ctx, (p.vip ? 'VIP +' : '+') + p.amount, p.x, p.y, p.vip ? C.gold : C.yellow, { align: 1, shadow: C.maroon, scale: p.vip ? 1 : 1 });
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
    const m = S.curMuseum();
    for (let i = m.length - 1; i >= 0; i--) {
      const it = m[i]; const fp = S.itemFootprint(it.id);
      if (cx >= it.cx && cx < it.cx + fp.w && cy >= it.cy && cy < it.cy + fp.h) return i;
    }
    return -1;
  }

  // =========================================================================
  // DIG (biome-themed inverted minesweeper)
  // =========================================================================
  function computeDigLayout(site, board) {
    const cols = board ? board.cols : site.cols, rows = board ? board.rows : site.rows;
    const availW = VW - 16, availH = CONTENT.y + CONTENT.h - HORIZON - 10;
    let ts = Math.floor(Math.min(availW / cols, availH / rows));
    ts = Math.max(13, Math.min(26, ts));
    const boardW = ts * cols, boardH = ts * rows;
    const bx = Math.round((VW - boardW) / 2);
    const by = Math.round(HORIZON + 7 + (availH - boardH) / 2);
    return { ts: ts, bx: bx, by: by, boardW: boardW, boardH: boardH, cols: cols, rows: rows };
  }

  const HORIZON = CONTENT.y + 38;

  function drawDigBackground(ctx, biome, biomeKey, t) {
    // --- sky ---
    vgrad(ctx, CONTENT.x, CONTENT.y, CONTENT.w, HORIZON - CONTENT.y, biome.sky[0], biome.sky[1]);
    const name = biome.name;
    if (name === 'Desert' || name === 'Temperate' || name === 'Jungle') {
      // sun with glow
      softGlow(ctx, VW - 60, CONTENT.y + 12, 18, '#fff2a0', 0.35);
      ctx.fillStyle = C.yellow; pixDisc(ctx, VW - 60, CONTENT.y + 12, 6);
      ctx.fillStyle = '#fffab0'; pixDisc(ctx, VW - 62, CONTENT.y + 11, 3);
    } else if (name === 'Frozen') {
      // moon + aurora ribbons
      ctx.fillStyle = C.pale; pixDisc(ctx, VW - 64, CONTENT.y + 11, 5);
      ctx.fillStyle = biome.sky[0]; pixDisc(ctx, VW - 67, CONTENT.y + 10, 4);
      for (let band = 0; band < 2; band++) {
        ctx.globalAlpha = 0.16 - band * 0.05;
        ctx.fillStyle = band === 0 ? '#7ee0c0' : '#b090ff';
        for (let x = 0; x < VW; x += 4) {
          const wy = CONTENT.y + 6 + band * 5 + Math.sin(x * 0.03 + t / 900 + band) * 4;
          ctx.fillRect(x, wy, 4, 8);
        }
        ctx.globalAlpha = 1;
      }
    } else if (name === 'Volcanic') {
      softGlow(ctx, VW / 2, HORIZON, 60, '#df7126', 0.2);
      ctx.fillStyle = 'rgba(223,113,38,0.5)'; // smoldering sky specks
      for (let i = 0; i < 4; i++) ctx.fillRect(((t / (30 + i * 9)) + i * 130) % VW, CONTENT.y + 6 + (i * 7) % 22, 2, 2);
    } else if (name === 'Seabed') {
      // god rays + drifting bubbles
      ctx.globalAlpha = 0.14; ctx.fillStyle = '#bfeee6';
      for (let i = 0; i < 3; i++) {
        const rx = 60 + i * 150 + Math.sin(t / 1400 + i) * 12;
        ctx.beginPath(); ctx.moveTo(rx, CONTENT.y); ctx.lineTo(rx + 26, CONTENT.y);
        ctx.lineTo(rx + 46, HORIZON); ctx.lineTo(rx, HORIZON); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (name === 'Deep Strata') {
      // cave sparkles
      ctx.fillStyle = 'rgba(217,176,238,0.6)';
      const rr0 = A.rng(808);
      for (let i = 0; i < 8; i++) { const sx = rr0() * VW, sy = CONTENT.y + rr0() * 30; if (((t / 400) | 0) % 3 !== i % 3) ctx.fillRect(sx | 0, sy | 0, 1, 1); }
    }
    // drifting cloud layers (surface biomes only)
    if (name !== 'Seabed' && name !== 'Deep Strata') {
      for (let layer = 0; layer < 2; layer++) {
        ctx.globalAlpha = 0.12 + layer * 0.06;
        ctx.fillStyle = '#ffffff';
        const speed = 26 - layer * 12, size = 34 - layer * 10;
        for (let i = 0; i < 3; i++) {
          const cx = ((t / (1000 / speed) + i * 190 + layer * 90) % (VW + size * 2)) - size;
          const cy = CONTENT.y + 5 + layer * 9 + i * 3;
          ctx.fillRect(cx, cy + 2, size, 4); ctx.fillRect(cx + 5, cy, size - 12, 3);
        }
        ctx.globalAlpha = 1;
      }
    }

    // --- distant ridge + horizon props ---
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < VW; x += 3) {
      const rh = 5 + Math.round(Math.sin(x * 0.05) * 3 + Math.sin(x * 0.013) * 4);
      ctx.fillRect(x, HORIZON - rh, 3, rh);
    }
    const props = A.props[biomeKey] || [];
    const rr = A.rng(biomeKey.length * 977 + 5);
    for (let i = 0; i < 7; i++) {
      const pr = props[i % props.length]; if (!pr) break;
      const px = 10 + ((rr() * (VW - 40)) | 0);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(pr, px, HORIZON - pr.height + 2);
      ctx.globalAlpha = 1;
    }

    // --- ground below horizon: soil gradient + strata ---
    vgrad(ctx, CONTENT.x, HORIZON, CONTENT.w, CONTENT.y + CONTENT.h - HORIZON, biome.soil[1], shade(biome.soil[2], 0.7));
    let y = HORIZON + 26;
    for (let i = 0; i < 6 && y < CONTENT.y + CONTENT.h; i++) {
      ctx.fillStyle = biome.soil[i % biome.soil.length];
      const h = 20 + (i % 2) * 10;
      ctx.globalAlpha = 0.35 - i * 0.04;
      ctx.fillRect(CONTENT.x, y, CONTENT.w, h);
      y += h; ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(CONTENT.x, HORIZON, CONTENT.w, 2);
    // buried fossil silhouettes
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#000';
    const rr2 = A.rng(555);
    for (let i = 0; i < 6; i++) ctx.fillRect(CONTENT.x + (rr2() * CONTENT.w) | 0, HORIZON + 24 + (rr2() * (CONTENT.h - 70)) | 0, 12, 3);
    ctx.globalAlpha = 1;
  }

  function pixDisc(ctx, cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.5) ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }

  function drawDigTile(ctx, cell, px, py, ts, biome, t, hover) {
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
    } else if (node.type === 'curio') {
      blit(ctx, A.curios[node.curioId] || A.pieces.skull, cx, cy, dim);
    } else {
      // fossil: little skull
      blit(ctx, A.pieces.skull, cx, cy, dim);
    }
  }

  function drawDig(ctx, t, site, board, cursor, hold, anims) {
    const biome = D.BIOMES[site.biome] || D.BIOMES.temperate;
    drawDigBackground(ctx, biome, site.biome, t);
    const L = computeDigLayout(site, board);
    const ts = L.ts;

    // base camp on the surface, top-right (crates = your fossil storage)
    const camp = A.camp[(t / 420 | 0) % 2];
    const campX = VW - camp.width - 6, campY = HORIZON - camp.height + 4;
    ctx.drawImage(A.shadows.s32, campX + camp.width / 2 - 16, HORIZON - 2);
    ctx.drawImage(camp, campX, campY);
    L.campRect = { x: campX - 2, y: campY - 2, w: camp.width + 4, h: camp.height + 4 };
    // smoke wisps from the campfire
    if (((t / 300) | 0) % 2 === 0) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#cbdbfc';
      ctx.fillRect(campX + 31, campY + 14 - ((t / 160) % 8 | 0), 2, 2);
      ctx.globalAlpha = 1;
    }

    // pit frame with rope-and-stake border
    ctx.fillStyle = biome.edge; ctx.fillRect(L.bx - 3, L.by - 3, L.boardW + 6, L.boardH + 6);
    ctx.fillStyle = biome.soil[2]; ctx.fillRect(L.bx - 2, L.by - 2, L.boardW + 4, L.boardH + 4);
    ctx.fillStyle = C.gold;
    ctx.fillRect(L.bx - 3, L.by - 4, L.boardW + 6, 1);
    for (let sx = L.bx - 2; sx < L.bx + L.boardW; sx += 26) { ctx.fillStyle = C.brown; ctx.fillRect(sx, L.by - 6, 2, 4); }

    for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
      const cell = board.cells[y * L.cols + x];
      const px = L.bx + x * ts, py = L.by + y * ts;
      const hover = cursor && cursor.x === x && cursor.y === y;
      drawDigTile(ctx, cell, px, py, ts, biome, t, hover);
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
      ctx.strokeStyle = C.white; ctx.lineWidth = 1;
      const pulse = Math.sin(t / 150) * 0.5 + 0.5;
      ctx.globalAlpha = 0.4 + pulse * 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
      ctx.globalAlpha = 1;
    }

    // hold-to-dig charge ring
    if (hold) {
      const cx = L.bx + hold.x * ts + ts / 2, cy = L.by + hold.y * ts + ts / 2;
      const rad = ts * 0.42;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = biome.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hold.p); ctx.stroke();
      // little digger icon appears as it charges
      blit(ctx, A.dig.digger[(t / 120 | 0) % 2], cx, cy - 1, ts - 4, 1);
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

  // A single stony fossil-in-matrix cell. `edges` says which sides are the
  // outer edge of the block (so a multi-cell piece reads as one carved slab).
  function stoneCell(ctx, x, y, cs, rc, seed, edges) {
    const rng = A.rng(seed >>> 0);
    ctx.fillStyle = rc.color; ctx.fillRect(x, y, cs, cs);
    // rocky matrix mottling (dark) + grit (light)
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + (rng() * cs | 0), y + (rng() * cs | 0), 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + (rng() * cs | 0), y + (rng() * cs | 0), 1, 1);
    // an embedded bone fragment
    if (cs >= 8) {
      const bx = x + 2 + (rng() * (cs - 5) | 0), by = y + 2 + (rng() * (cs - 5) | 0);
      ctx.fillStyle = 'rgba(255,250,240,0.85)';
      ctx.fillRect(bx, by, 3, 1); ctx.fillRect(bx - 1, by - 1, 1, 1); ctx.fillRect(bx + 3, by - 1, 1, 1);
      ctx.fillRect(bx - 1, by + 1, 1, 1); ctx.fillRect(bx + 3, by + 1, 1, 1);
    } else {
      ctx.fillStyle = 'rgba(255,250,240,0.7)'; ctx.fillRect(x + (cs >> 1) - 1, y + (cs >> 1) - 1, 2, 2);
    }
    // inner seams (subtle) so touching cells still show separation
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    if (!edges.right) ctx.fillRect(x + cs - 1, y, 1, cs);
    if (!edges.bottom) ctx.fillRect(x, y + cs - 1, cs, 1);
    // outer bevel: light top/left, dark bottom/right
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    if (edges.top) ctx.fillRect(x, y, cs, 1);
    if (edges.left) ctx.fillRect(x, y, 1, cs);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    if (edges.bottom) ctx.fillRect(x, y + cs - 1, cs, 1);
    if (edges.right) ctx.fillRect(x + cs - 1, y, 1, cs);
  }

  function drawPieceCells(ctx, cells, ox, oy, cs, rarity, alpha, seed) {
    const rc = D.RARITY[rarity] || D.RARITY.common;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const occ = {}; for (let i = 0; i < cells.length; i++) occ[cells[i][0] + ',' + cells[i][1]] = true;
    const base = (seed || 1) * 2654435761;
    for (let i = 0; i < cells.length; i++) {
      const gx = cells[i][0], gy = cells[i][1];
      const x = ox + gx * cs, y = oy + gy * cs;
      stoneCell(ctx, x, y, cs, rc, (base ^ (gx * 73856093) ^ (gy * 19349663)) >>> 0, {
        top: !occ[gx + ',' + (gy - 1)], left: !occ[(gx - 1) + ',' + gy],
        bottom: !occ[gx + ',' + (gy + 1)], right: !occ[(gx + 1) + ',' + gy],
      });
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

    const sameId = function (x, y, id) { const c = Inv.at(x, y); return c && c.id === id; };
    for (let y = 0; y < L.n; y++) for (let x = 0; x < L.n; x++) {
      const px = L.gx + x * L.cs, py = L.gy + y * L.cs;
      const cell = Inv.at(x, y);
      // empty slot
      ctx.fillStyle = (x + y) % 2 === 0 ? '#252838' : '#20222f';
      ctx.fillRect(px, py, L.cs - 1, L.cs - 1);
      if (clearMark[y * L.n + x]) { ctx.fillStyle = 'rgba(255,240,120,0.18)'; ctx.fillRect(px, py, L.cs - 1, L.cs - 1); }
      if (cell) {
        const rc = D.RARITY[cell.rarity] || D.RARITY.common;
        stoneCell(ctx, px, py, L.cs, rc, ((x * 73856093) ^ (y * 19349663)) >>> 0, {
          top: !sameId(x, y - 1, cell.id), left: !sameId(x - 1, y, cell.id),
          bottom: !sameId(x, y + 1, cell.id), right: !sameId(x + 1, y, cell.id),
        });
      }
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
