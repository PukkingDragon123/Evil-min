// ---------------------------------------------------------------------------
// Palette, sprite builder and all pixel art (procedural + hand-authored).
// Palette is DawnBringer 32 — the whole game sticks to it for a coherent look.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const C = {
    black: '#000000', ink: '#222034', maroon: '#45283c', brown: '#663931',
    ltbrown: '#8f563b', orange: '#df7126', tan: '#d9a066', cream: '#eec39a',
    yellow: '#fbf236', lime: '#99e550', green: '#6abe30', teal: '#37946e',
    dkgreen: '#4b692f', olive: '#524b24', dkteal: '#323c39', navy: '#3f3f74',
    steel: '#306082', blue: '#5b6ee1', ltblue: '#639bff', cyan: '#5fcde4',
    pale: '#cbdbfc', white: '#ffffff', ltgray: '#9badb7', gray: '#847e87',
    dkgray: '#696a6a', dkgray2: '#595652', purple: '#76428a', red: '#ac3232',
    salmon: '#d95763', pink: '#d77bba', moss: '#8f974a', gold: '#8a6f30',
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Small imperative pixel painter for procedural sprites.
  function painter(w, h) {
    const c = mk(w, h);
    const g = c.getContext('2d');
    const p = {
      canvas: c, g: g, w: w, h: h,
      px: function (x, y, col) {
        g.fillStyle = col;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      },
      rect: function (x, y, rw, rh, col) {
        g.fillStyle = col;
        g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
      },
      line: function (x0, y0, x1, y1, col, thick) {
        x0 = Math.round(x0); y0 = Math.round(y0);
        x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        for (;;) {
          p.px(x0, y0, col);
          if (thick) p.px(x0, y0 + 1, col);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
        }
      },
      disc: function (cx, cy, r, col) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r + r * 0.5) p.px(cx + dx, cy + dy, col);
          }
        }
      },
      ring: function (cx, cy, r, col) {
        for (let a = 0; a < 64; a++) {
          const t = a / 64 * Math.PI * 2;
          p.px(cx + Math.round(Math.cos(t) * r), cy + Math.round(Math.sin(t) * r), col);
        }
      },
      curve: function (pts, col, thick) {
        // polyline through points, sampled
        for (let i = 0; i < pts.length - 1; i++) {
          p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, thick);
        }
      },
    };
    return p;
  }

  // Build canvas from ASCII rows + char palette. '.' and ' ' = transparent.
  function sprite(rows, pal) {
    const h = rows.length;
    let w = 0;
    for (let i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    const p = painter(w, h);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col) p.px(x, y, col);
      }
    }
    return p.canvas;
  }

  function flipped(src) {
    const c = mk(src.width, src.height);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  // -------------------------------------------------------------------------
  // Tiles (16x16, procedural)
  // -------------------------------------------------------------------------
  function tileGrass(seed, flowers) {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, C.green);
    const r = mulberry32(seed);
    for (let i = 0; i < 14; i++) p.px(r() * 16, r() * 16, C.lime);
    for (let i = 0; i < 9; i++) p.px(r() * 16, r() * 16, C.dkgreen);
    for (let i = 0; i < 3; i++) {
      const x = (r() * 14) | 0, y = (r() * 13) | 0;
      p.px(x, y + 1, C.dkgreen); p.px(x, y, C.lime); // grass blade
    }
    if (flowers) {
      const x = 3 + ((r() * 10) | 0), y = 3 + ((r() * 10) | 0);
      p.px(x, y, C.yellow); p.px(x + 1, y, C.white);
      p.px(x, y + 1, C.white); p.px(x + 1, y + 1, C.yellow);
    }
    return p.canvas;
  }

  function tilePath(seed) {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, C.tan);
    const r = mulberry32(seed);
    for (let i = 0; i < 7; i++) p.px(r() * 16, r() * 16, C.cream);
    for (let i = 0; i < 6; i++) {
      const x = (r() * 15) | 0, y = (r() * 15) | 0;
      p.px(x, y, C.ltbrown);
      if (r() > 0.5) p.px(x + 1, y, C.ltbrown);
    }
    return p.canvas;
  }

  function tileFloor(alt) {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, alt ? '#bcd0f7' : C.pale);
    p.rect(0, 15, 16, 1, C.ltgray);
    p.rect(15, 0, 1, 16, C.ltgray);
    p.px(3, 4, C.white); p.px(11, 9, C.white);
    if (alt) { p.px(6, 12, C.white); }
    return p.canvas;
  }

  function tileWall() {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, C.brown);
    p.rect(0, 0, 16, 2, C.ltbrown);
    for (let y = 5; y < 16; y += 5) p.rect(0, y, 16, 1, C.maroon);
    p.px(4, 3, C.ltbrown); p.px(11, 8, C.maroon);
    p.rect(0, 15, 16, 1, C.maroon);
    return p.canvas;
  }

  function tileWallWindow() {
    const c = tileWall();
    const p = { canvas: c, g: c.getContext('2d') };
    const g = p.g;
    g.fillStyle = C.steel; g.fillRect(4, 4, 8, 8);
    g.fillStyle = C.cyan; g.fillRect(5, 5, 6, 6);
    g.fillStyle = C.white; g.fillRect(6, 6, 2, 2);
    g.fillStyle = C.brown; g.fillRect(4, 8, 8, 1);
    return c;
  }

  function tileDirtHidden(seed) {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, C.ltbrown);
    const r = mulberry32(seed);
    for (let i = 0; i < 6; i++) {
      const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0);
      p.px(x, y, C.brown); p.px(x + 1, y, C.brown);
    }
    for (let i = 0; i < 3; i++) p.px(1 + r() * 14, 1 + r() * 14, C.tan);
    // bevel (classic raised minesweeper tile)
    p.rect(0, 0, 16, 1, '#a5714b'); p.rect(0, 0, 1, 16, '#a5714b');
    p.rect(0, 15, 16, 1, C.brown); p.rect(15, 0, 1, 16, C.brown);
    p.px(15, 0, C.ltbrown); p.px(0, 15, C.ltbrown);
    return p.canvas;
  }

  function tileDirtRevealed() {
    const p = painter(16, 16);
    p.rect(0, 0, 16, 16, C.tan);
    p.rect(0, 0, 16, 1, C.ltbrown); p.rect(0, 0, 1, 16, C.ltbrown);
    p.rect(0, 15, 16, 1, C.cream); p.rect(15, 0, 1, 16, C.cream);
    p.px(5, 6, '#c9945c'); p.px(10, 11, '#c9945c'); p.px(12, 4, '#c9945c');
    return p.canvas;
  }

  // -------------------------------------------------------------------------
  // Small hand-authored sprites
  // -------------------------------------------------------------------------
  const ICON_PAL = {
    O: C.gold, Y: C.yellow, D: C.orange, W: C.white, K: C.ink,
    B: C.ltblue, U: C.steel, Q: C.cyan, G: C.gray, L: C.ltgray,
    H: C.ltbrown, N: C.brown, R: C.red, P: C.pale, S: C.dkgray2,
  };

  const coinRows = [
    '..OOOO..',
    '.OYYYYO.',
    'OYWYYYDO',
    'OYWYYYDO',
    'OYYYYYDO',
    'OYYYYDDO',
    '.ODDDDO.',
    '..OOOO..',
  ];

  const gemRows = [
    '.UUUUUU.',
    'UQWWQQBU',
    'UQWQQBBU',
    '.UQQBBU.',
    '.UQBBBU.',
    '..UBBU..',
    '...UU...',
  ];

  const pickRows = [
    '..GGGGG..',
    '.GG...GG.',
    'GG..H..GG',
    'G...HH..G',
    '....HHN..',
    '.....HHN.',
    '......HHN',
    '.......HN',
  ];

  const flagRows = [
    '.KRRRR..',
    '.KRRRRR.',
    '.KRRRR..',
    '.KRR....',
    '.K......',
    '.K......',
    '.K......',
    'KKK.....',
  ];

  const lockRows = [
    '..LLLL..',
    '.LL..LL.',
    '.LL..LL.',
    'GGGGGGGG',
    'GGGKGGGG',
    'GGGKGGGG',
    'GGGGGGGG',
    '.GGGGGG.',
  ];

  const boneRows = [
    'WW......WW',
    'WWW....WWW',
    '.WWWWWWWW.',
    'WWW....WWW',
    'WW......WW',
  ];

  const skullRows = [
    '..WWWWWWW..',
    '.WWWWWWWWW.',
    'WWWWWWWWWWW',
    'WWKKWWWWWWW',
    'WWKKWWWWWW.',
    'WWWWWWWWW..',
    'WWWWWWWW...',
    'W.W.W......',
  ];

  const ribsRows = [
    'WWWWWWWWWWW',
    '.W.W.W.W.W.',
    '.W.W.W.W.W.',
    '.W.W.W.W.W.',
    '..W.W.W.W..',
    '...........',
  ];

  const tailRows = [
    'WW.........',
    'WWWW.......',
    '.WWWWWW....',
    '...WWWWWW..',
    '......WWWW.',
    '.........WW',
  ];

  const nuggetRows = [
    '...LLLL...',
    '..LLLLLD..',
    '.LSLLLLDD.',
    '.LSLLLLLD.',
    'LLLLLLLDDD',
    '.LLLLDDDD.',
    '..LDDDDD..',
  ];

  const amberRows = [
    '..LLLLL...',
    '.LSLLLLD..',
    'LLSLLLLLD.',
    'LLLLKLLLD.',
    'LLLLLLLDD.',
    '.LLLLLDDD.',
    '..LLDDDD..',
  ];

  const prismRows = [
    '....SDS....',
    '...SLLLD...',
    '..SLLLLLD..',
    '.SLLLLLLLD.',
    'SLLLLLLLLLD',
    '.DLLLLLLLD.',
    '..DLLLLLD..',
    '...DLLLD...',
    '....DLD....',
  ];

  function oreSprite(rows, light, dark, shine, extra) {
    const pal = { L: light, D: dark, S: shine, K: extra || C.ink };
    return sprite(rows, pal);
  }

  const boulderRows = [
    '....LLLLL.....',
    '..LLLLLGGG....',
    '.LLLGGGGGGG...',
    '.LGGGGGGGGGS..',
    'LLGGGGGGGGSS..',
    'LLGGGGGGGSSS..',
    '.LGGGGGSSSS...',
    '..GGSSSSSS....',
    '...SSSSSS.....',
  ];

  const gasRows1 = [
    '...PPPP.....',
    '..PPPPPP.P..',
    '.PPLLPPPPPP.',
    '.PPLPPPPPP..',
    '..PPPPPPLP..',
    '...PPPPLLP..',
    '....PPPPP...',
  ];
  const gasRows2 = [
    '.....PPPP...',
    '..P.PPPPPP..',
    '.PPPPPPLLPP.',
    '..PPPPPPLPP.',
    '..PLPPPPPP..',
    '..PLLPPPP...',
    '...PPPPP....',
  ];

  const plantRows = [
    '..F..FF.F...',
    '.FFF.FF.FF..',
    '..FFFFFFF...',
    '.FF.FFF.FF..',
    'F...FFF...F.',
    '....DDD.....',
    '....DD......',
    '..RRRRRR....',
    '..RPPPPR....',
    '..RPPPPR....',
    '...PPPP.....',
  ];

  const benchRows = [
    '.TTTTTTTTTTTT.',
    'TTTTTTTTTTTTTT',
    'DDDDDDDDDDDDDD',
    '.KK........KK.',
    '.KK........KK.',
  ];

  const signRows = [
    'NTTTTTTTTTTN',
    'NTCCCCCCCCTN',
    'NTCCCCCCCCTN',
    'NTCCCCCCCCTN',
    'NTTTTTTTTTTN',
    '.....NN.....',
    '.....NN.....',
    '.....NN.....',
  ];

  // Visitor base (8x12), palette-swapped per variant. E = eye.
  const visitorA = [
    '..HHHH..',
    '.HHHHHH.',
    '.HSSSSS.',
    '..SSES..',
    '..TTTT..',
    '.STTTTS.',
    '.STTTTS.',
    '..TTTT..',
    '..PPPP..',
    '..P..P..',
    '..P..P..',
    '.KK..KK.',
  ];
  const visitorB = [
    '..HHHH..',
    '.HHHHHH.',
    '.HSSSSS.',
    '..SSES..',
    '..TTTT..',
    '.STTTTS.',
    '.STTTTS.',
    '..TTTT..',
    '..PPPP..',
    '...PP...',
    '...PP...',
    '..KKK...',
  ];

  const VIS_HAIR = [C.brown, C.yellow, C.ink, C.red, C.gray, C.pink, C.orange, C.dkteal];
  const VIS_SHIRT = [C.blue, C.red, C.green, C.orange, C.pink, C.teal, C.purple, C.cyan];
  const VIS_PANTS = [C.navy, C.brown, C.dkgray2, C.steel];
  const VIS_SKIN = ['#eec39a', '#d9a066', '#8f563b', '#f4d6b0'];

  function visitorSprite(rows, hair, shirt, pants, skin) {
    return sprite(rows, { H: hair, T: shirt, P: pants, S: skin, K: C.ink, E: C.ink });
  }

  // -------------------------------------------------------------------------
  // Dinosaur skeletons (procedural painters). Bone: white + pale shading.
  // All face LEFT by default.
  // -------------------------------------------------------------------------
  const BW = C.white, BS = C.pale, BD = C.ltgray;

  function ribs(p, x0, y0, count, len, step) {
    for (let i = 0; i < count; i++) {
      const x = x0 + i * (step || 2);
      const l = len - (i % 2);
      const col = (i % 2) ? BS : BW;
      for (let d = 0; d < l; d++) p.px(x, y0 + d, col);
      p.px(x + 1, y0 + len - 1, col); // inward hook
    }
  }

  function vertebrae(p, pts, col) {
    for (let i = 0; i < pts.length; i += 2) p.px(pts[i][0], pts[i][1] - 1, col);
  }

  function spinePts(x0, y0, x1, y1, bend) {
    // sample a soft quadratic from (x0,y0) to (x1,y1); bend = mid offset
    const pts = [];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + bend;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      pts.push([Math.round(x), Math.round(y)]);
    }
    return pts;
  }

  function drawSpine(p, pts, col) {
    for (let i = 0; i < pts.length; i++) {
      p.px(pts[i][0], pts[i][1], col);
      p.px(pts[i][0], pts[i][1] + 1, col);
    }
  }

  function skelTheropod(big) {
    const p = painter(32, 26);
    const oy = big ? 0 : 2;
    // far leg (behind, darker)
    p.line(24, 11 + oy, 23, 15 + oy, BD);
    p.line(23, 15 + oy, 25, 19 + oy, BD);
    p.rect(24, 20 + oy, 4, 1, BD);
    // skull
    p.rect(2, 2 + oy, 7, 3, BW);            // cranium
    p.rect(0, 4 + oy, 8, 3, BW);            // snout
    p.px(6, 3 + oy, C.ink);                 // eye socket
    p.px(5, 3 + oy, BD);
    p.px(0, 7 + oy, BW); p.px(2, 7 + oy, BW); p.px(4, 7 + oy, BW); // teeth
    p.line(1, 9 + oy, 7, 8 + oy, BS);       // lower jaw
    p.px(0, 8 + oy, BS);
    // neck
    p.line(8, 5 + oy, 11, 7 + oy, BW, true);
    // spine
    const sp = spinePts(11, 7 + oy, 24, 8 + oy, -2);
    drawSpine(p, sp, BW);
    vertebrae(p, sp, BS);
    // ribs
    ribs(p, 12, 9 + oy, 5, 4);
    // pelvis
    p.rect(22, 7 + oy, 3, 3, BW);
    // tail
    const tl = spinePts(25, 8 + oy, 31, 14 + oy, -1);
    drawSpine(p, tl, BW);
    vertebrae(p, tl, BS);
    // near leg
    p.line(23, 10 + oy, 21, 14 + oy, BW, true);
    p.line(21, 15 + oy, 23, 19 + oy, BW);
    p.rect(21, 20 + oy, 4, 1, BW);
    p.px(20, 20 + oy, BW);
    // tiny arms
    p.line(13, 9 + oy, 12, 11 + oy, BS);
    p.px(11, 12 + oy, BS);
    return p.canvas;
  }

  function skelSmallBiped() {
    const p = painter(28, 20);
    // far leg
    p.line(18, 9, 17, 12, BD);
    p.line(17, 12, 19, 15, BD);
    p.rect(18, 16, 3, 1, BD);
    // skull (small, pointy)
    p.rect(2, 3, 5, 2, BW);
    p.rect(0, 4, 4, 2, BW);
    p.px(5, 4, C.ink);
    p.px(1, 6, BS); p.px(3, 6, BS); // teeth hint
    // neck: s-curve
    p.curve([[6, 5], [8, 4], [9, 6], [10, 7]], BW);
    // spine
    const sp = spinePts(10, 7, 18, 8, -1);
    drawSpine(p, sp, BW);
    vertebrae(p, sp, BS);
    ribs(p, 11, 9, 4, 3);
    // pelvis
    p.rect(17, 7, 2, 2, BW);
    // long whip tail, tip curls up
    const tl = spinePts(19, 8, 27, 11, 2);
    drawSpine(p, tl, BW);
    p.px(27, 10, BW); p.px(27, 9, BS);
    // near leg
    p.line(18, 9, 16, 12, BW, true);
    p.line(16, 13, 18, 15, BW);
    p.rect(16, 16, 4, 1, BW);
    // arm
    p.line(12, 9, 11, 10, BS);
    return p.canvas;
  }

  function skelLongneck() {
    const p = painter(34, 30);
    // far legs
    p.line(13, 20, 13, 25, BD); p.rect(12, 26, 3, 1, BD);
    p.line(23, 20, 23, 25, BD); p.rect(22, 26, 3, 1, BD);
    // skull small, high left
    p.rect(1, 1, 4, 2, BW);
    p.rect(0, 2, 3, 2, BW);
    p.px(3, 2, C.ink);
    // neck: long arc down to body
    p.curve([[4, 3], [6, 4], [8, 7], [9, 11], [10, 15], [11, 17]], BW, true);
    // spine over body
    const sp = spinePts(11, 17, 24, 17, -3);
    drawSpine(p, sp, BW);
    vertebrae(p, sp, BS);
    ribs(p, 13, 18, 6, 5);
    // pelvis
    p.rect(22, 15, 3, 3, BW);
    // tail long
    const tl = spinePts(25, 17, 33, 23, 0);
    drawSpine(p, tl, BW);
    vertebrae(p, tl, BS);
    p.px(33, 22, BW);
    // near legs (columns)
    p.line(12, 19, 12, 25, BW, false); p.line(11, 19, 11, 25, BW); p.rect(10, 26, 4, 1, BW);
    p.line(22, 19, 22, 25, BW); p.line(21, 19, 21, 25, BW); p.rect(20, 26, 4, 1, BW);
    return p.canvas;
  }

  function skelStego() {
    const p = painter(32, 24);
    // far legs
    p.line(11, 16, 11, 20, BD); p.rect(10, 21, 3, 1, BD);
    p.line(22, 15, 22, 20, BD); p.rect(21, 21, 3, 1, BD);
    // skull tiny, low
    p.rect(1, 14, 4, 2, BW);
    p.px(4, 14, C.ink);
    p.px(0, 15, BW);
    // neck up to arched back
    p.curve([[4, 14], [6, 12], [8, 11]], BW);
    // arched spine
    const sp = spinePts(8, 11, 24, 13, -5);
    drawSpine(p, sp, BW);
    // plates along the arch (alternating heights)
    for (let i = 1; i < sp.length - 2; i += 3) {
      const pt = sp[i];
      const hgt = (i % 2 === 1) ? 3 : 2;
      for (let d = 1; d <= hgt; d++) {
        p.px(pt[0], pt[1] - d, d === hgt ? BS : BW);
        if (d < hgt) p.px(pt[0] + 1, pt[1] - d, BS);
      }
    }
    ribs(p, 11, 13, 5, 4);
    // pelvis
    p.rect(22, 12, 3, 3, BW);
    // tail with spikes
    const tl = spinePts(25, 13, 31, 17, 0);
    drawSpine(p, tl, BW);
    p.px(29, 14, BS); p.px(30, 13, BS); // spikes
    p.px(30, 15, BS); p.px(31, 14, BS);
    // near legs
    p.line(10, 15, 10, 20, BW, false); p.line(9, 15, 9, 20, BW); p.rect(8, 21, 4, 1, BW);
    p.line(21, 15, 21, 20, BW); p.line(20, 15, 20, 20, BW); p.rect(19, 21, 4, 1, BW);
    return p.canvas;
  }

  function skelTrike() {
    const p = painter(32, 22);
    // far legs
    p.line(15, 14, 15, 18, BD); p.rect(14, 19, 3, 1, BD);
    p.line(24, 14, 24, 18, BD); p.rect(23, 19, 3, 1, BD);
    // frill (disc with inner ring)
    p.disc(9, 8, 4, BW);
    p.disc(9, 8, 2, BD);
    p.px(9, 8, C.ink);
    // snout + beak
    p.rect(2, 9, 5, 3, BW);
    p.px(1, 11, BW); p.px(0, 12, BS);
    // horns
    p.line(4, 8, 1, 5, BW); p.line(6, 8, 3, 4, BW);
    p.px(2, 10, BS); // nose horn
    // spine
    const sp = spinePts(13, 9, 25, 11, -2);
    drawSpine(p, sp, BW);
    vertebrae(p, sp, BS);
    ribs(p, 14, 11, 5, 4);
    // pelvis
    p.rect(23, 10, 3, 3, BW);
    // short tail
    p.curve([[26, 11], [29, 13], [30, 15]], BW);
    // near legs
    p.line(14, 13, 14, 18, BW); p.line(13, 13, 13, 18, BW); p.rect(12, 19, 4, 1, BW);
    p.line(23, 13, 23, 18, BW); p.line(22, 13, 22, 18, BW); p.rect(21, 19, 4, 1, BW);
    return p.canvas;
  }

  function skelAnky() {
    const p = painter(32, 18);
    // far legs
    p.line(12, 11, 12, 14, BD); p.rect(11, 15, 3, 1, BD);
    p.line(21, 11, 21, 14, BD); p.rect(20, 15, 3, 1, BD);
    // skull small wide
    p.rect(1, 7, 5, 3, BW);
    p.px(5, 7, C.ink);
    p.px(0, 8, BW);
    p.px(1, 6, BS); p.px(4, 6, BS); // head horns
    // low wide spine
    const sp = spinePts(6, 8, 24, 9, -2);
    drawSpine(p, sp, BW);
    // armor studs above spine
    for (let i = 2; i < sp.length - 2; i += 3) {
      p.px(sp[i][0], sp[i][1] - 2, (i % 2) ? BS : BW);
    }
    ribs(p, 9, 10, 6, 3);
    // pelvis
    p.rect(22, 8, 3, 2, BW);
    // tail + club
    const tl = spinePts(25, 9, 29, 11, 0);
    drawSpine(p, tl, BW);
    p.disc(30, 11, 2, BW);
    p.px(30, 11, BD);
    // near legs (short)
    p.line(11, 10, 11, 14, BW); p.line(10, 10, 10, 14, BW); p.rect(9, 15, 4, 1, BW);
    p.line(20, 10, 20, 14, BW); p.line(19, 10, 19, 14, BW); p.rect(18, 15, 4, 1, BW);
    return p.canvas;
  }

  function skelFlyer() {
    const p = painter(28, 18);
    // wings: finger rays from shoulders, spread up/outward
    // left wing
    p.line(12, 9, 2, 2, BW);
    p.line(12, 9, 3, 6, BS);
    p.line(12, 9, 5, 10, BW);
    p.curve([[2, 2], [3, 6], [5, 10]], BD); // membrane edge
    // right wing
    p.line(15, 9, 25, 2, BW);
    p.line(15, 9, 24, 6, BS);
    p.line(15, 9, 22, 10, BW);
    p.curve([[25, 2], [24, 6], [22, 10]], BD);
    // body
    p.rect(12, 8, 4, 3, BW);
    p.px(12, 11, BS); p.px(15, 11, BS);
    // skull with beak (pointing down-left)
    p.rect(11, 5, 4, 3, BW);
    p.px(12, 6, C.ink);
    p.line(9, 8, 11, 7, BW); // beak
    // tail feathers fan
    p.line(14, 11, 13, 15, BS);
    p.line(14, 11, 15, 15, BS);
    p.line(14, 11, 14, 16, BW);
    // dangling legs
    p.line(13, 11, 12, 13, BD);
    p.line(15, 11, 16, 13, BD);
    return p.canvas;
  }

  // -------------------------------------------------------------------------
  // Exhibit composite: pedestal + skeleton + velvet rope. 36x44, anchor bottom.
  // -------------------------------------------------------------------------
  function exhibitSprite(skel, rarityColor, flyer) {
    const W = 36, H = 46;
    const p = painter(W, H);
    const g = p.g;
    const baseY = 34;
    if (flyer) {
      // display pole behind
      p.rect(17, 8, 2, baseY - 8, C.brown);
      p.rect(17, 8, 1, baseY - 8, C.ltbrown);
    }
    // pedestal
    p.rect(2, baseY, 32, 3, C.cream);       // top face
    p.rect(2, baseY + 3, 32, 6, C.tan);     // front face
    p.rect(2, baseY + 3, 32, 1, rarityColor);
    p.rect(2, baseY + 8, 32, 1, C.ltbrown);
    p.rect(2, baseY, 1, 9, C.cream); p.rect(33, baseY, 1, 9, C.ltbrown);
    // placard
    p.rect(15, baseY + 4, 7, 4, C.brown);
    p.rect(16, baseY + 5, 5, 1, C.cream);
    p.rect(16, baseY + 7, 4, 1, C.cream);
    // skeleton, feet on pedestal top
    const sx = Math.round((W - skel.width) / 2);
    const sy = flyer ? 8 : baseY - skel.height + 2;
    g.imageSmoothingEnabled = false;
    g.drawImage(skel, sx, sy);
    // velvet rope: two gold posts + sagging red rope
    const py = baseY + 1;
    p.rect(1, py, 2, 8, C.gold); p.px(1, py - 1, C.yellow); p.px(2, py - 1, C.yellow);
    p.rect(33, py, 2, 8, C.gold); p.px(33, py - 1, C.yellow); p.px(34, py - 1, C.yellow);
    const rope = spinePts(3, py + 1, 33, py + 1, 4);
    for (let i = 0; i < rope.length; i++) p.px(rope[i][0], rope[i][1], C.red);
    return p.canvas;
  }

  // -------------------------------------------------------------------------
  // Facilities (procedural stalls/buildings)
  // -------------------------------------------------------------------------
  function stall(awnA, awnB, signCol, item) {
    const p = painter(30, 30);
    // back wall
    p.rect(4, 9, 22, 12, C.ltbrown);
    p.rect(4, 9, 22, 1, C.brown);
    p.rect(5, 12, 20, 1, C.brown); // shelf
    p.rect(5, 16, 20, 1, C.brown);
    // goods on shelves
    p.rect(7, 10, 2, 2, signCol); p.rect(12, 10, 2, 2, C.yellow);
    p.rect(17, 10, 2, 2, C.cyan); p.rect(22, 10, 2, 2, C.pink);
    p.rect(8, 14, 2, 2, C.lime); p.rect(14, 14, 2, 2, signCol);
    p.rect(20, 14, 2, 2, C.orange);
    // posts
    p.rect(3, 9, 2, 15, C.brown); p.rect(25, 9, 2, 15, C.brown);
    p.rect(3, 9, 1, 15, C.ltbrown); p.rect(25, 9, 1, 15, C.ltbrown);
    // awning (striped, scalloped)
    for (let x = 1; x < 29; x++) {
      const stripe = ((x / 4) | 0) % 2 === 0 ? awnA : awnB;
      p.rect(x, 3, 1, 5, stripe);
      if (x % 4 !== 0) p.px(x, 8, stripe); // scallop bumps
    }
    p.rect(1, 3, 28, 1, awnB === C.white ? awnA : awnB);
    // counter
    p.rect(3, 22, 24, 2, C.cream);
    p.rect(3, 24, 24, 4, C.tan);
    p.rect(3, 27, 24, 1, C.ltbrown);
    // item on counter
    if (item === 'bone') {
      p.rect(8, 20, 4, 1, C.white); p.px(7, 19, C.white); p.px(7, 21, C.white);
      p.px(12, 19, C.white); p.px(12, 21, C.white);
    } else if (item === 'cup') {
      p.rect(9, 18, 3, 4, C.red); p.rect(9, 18, 3, 1, C.white); p.px(10, 16, C.ltgray);
    }
    p.rect(18, 19, 3, 3, signCol); p.px(19, 18, signCol);
    return p.canvas;
  }

  function restroom() {
    const p = painter(26, 28);
    // building
    p.rect(2, 6, 22, 20, C.ltblue);
    p.rect(2, 6, 22, 1, C.pale);
    p.rect(2, 25, 22, 1, C.steel);
    p.rect(2, 6, 1, 20, C.pale); p.rect(23, 6, 1, 20, C.steel);
    // roof
    p.rect(0, 3, 26, 4, C.steel);
    p.rect(0, 3, 26, 1, C.pale);
    // door
    p.rect(15, 13, 7, 13, C.steel);
    p.rect(16, 14, 5, 12, C.navy);
    p.px(20, 20, C.cream); // handle
    // sign
    p.rect(4, 10, 9, 7, C.white);
    p.rect(4, 10, 9, 1, C.ltgray);
    Font.drawText(p.g, 'WC', 6, 12, C.steel);
    return p.canvas;
  }

  function entranceArch() {
    const p = painter(24, 26);
    // pillars
    p.rect(0, 8, 5, 18, C.cream);
    p.rect(0, 8, 1, 18, C.white); p.rect(4, 8, 1, 18, C.tan);
    p.rect(19, 8, 5, 18, C.cream);
    p.rect(19, 8, 1, 18, C.white); p.rect(23, 8, 1, 18, C.tan);
    p.rect(0, 24, 5, 2, C.tan); p.rect(19, 24, 5, 2, C.tan);
    // banner
    p.rect(0, 2, 24, 7, C.red);
    p.rect(0, 2, 24, 1, C.salmon);
    p.rect(0, 8, 24, 1, C.maroon);
    // bone emblem on the banner
    p.rect(9, 5, 6, 1, C.white);
    p.px(8, 4, C.white); p.px(8, 6, C.white);
    p.px(15, 4, C.white); p.px(15, 6, C.white);
    return p.canvas;
  }

  function fountainFrames() {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const p = painter(28, 22);
      // basin
      p.rect(2, 14, 24, 6, C.gray);
      p.rect(2, 14, 24, 1, C.ltgray);
      p.rect(2, 19, 24, 1, C.dkgray2);
      p.rect(4, 15, 20, 3, C.cyan);
      // water shimmer
      const r = mulberry32(77 + f * 13);
      for (let i = 0; i < 5; i++) p.px(5 + r() * 18, 15 + r() * 2, C.white);
      // column
      p.rect(12, 6, 4, 9, C.ltgray);
      p.rect(12, 6, 1, 9, C.white); p.rect(15, 6, 1, 9, C.gray);
      p.rect(11, 5, 6, 2, C.gray);
      // spout water
      const off = f === 0 ? 0 : 1;
      p.px(13, 3 + off, C.cyan); p.px(14, 2 + off, C.white);
      p.px(10, 7 + off, C.cyan); p.px(17, 8 - off, C.cyan);
      p.px(9, 11 + off, C.pale); p.px(18, 12 - off, C.pale);
      frames.push(p.canvas);
    }
    return frames;
  }

  function bannerFrames() {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const p = painter(12, 18);
      p.rect(2, 0, 2, 18, C.brown);
      p.rect(2, 0, 1, 18, C.ltbrown);
      p.px(2, 0, C.yellow); p.px(3, 0, C.yellow);
      // pennant
      const wave = f === 0 ? 0 : 1;
      for (let y = 0; y < 6; y++) {
        const len = 8 - Math.abs(y - 2 - wave);
        p.rect(4, 2 + y, Math.max(2, len), 1, y % 2 === 0 ? C.teal : C.cyan);
      }
      frames.push(p.canvas);
    }
    return frames;
  }

  function statueSprite() {
    const p = painter(18, 20);
    // plinth
    p.rect(2, 15, 14, 4, C.gray);
    p.rect(2, 15, 14, 1, C.ltgray);
    p.rect(2, 18, 14, 1, C.dkgray2);
    // ammonite spiral
    p.disc(9, 8, 6, C.ltgray);
    p.ring(9, 8, 6, C.dkgray2);
    p.ring(9, 8, 4, C.gray);
    p.ring(9, 8, 2, C.dkgray2);
    p.px(9, 8, C.dkgray2);
    p.px(6, 5, C.white); p.px(7, 4, C.white); // shine
    return p.canvas;
  }

  function sparkleFrames() {
    const a = painter(5, 5);
    a.px(2, 0, C.white); a.px(2, 4, C.white); a.px(0, 2, C.white); a.px(4, 2, C.white);
    a.px(2, 2, C.yellow);
    const b = painter(5, 5);
    b.px(1, 1, C.yellow); b.px(3, 1, C.yellow); b.px(1, 3, C.yellow); b.px(3, 3, C.yellow);
    b.px(2, 2, C.white);
    return [a.canvas, b.canvas];
  }

  function shadowSprite(w) {
    const h = Math.max(3, (w / 4) | 0);
    const p = painter(w, h);
    p.g.globalAlpha = 0.25;
    // pixel ellipse
    const cx = w / 2 - 0.5, cy = h / 2 - 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / (w / 2), ny = (y - cy) / (h / 2);
        if (nx * nx + ny * ny <= 1) p.px(x, y, C.ink);
      }
    }
    return p.canvas;
  }

  function emoteBubble() {
    const p = painter(11, 11);
    p.rect(1, 0, 9, 8, C.white);
    p.rect(0, 1, 11, 6, C.white);
    p.px(4, 8, C.white); p.px(4, 9, C.white);
    return p.canvas;
  }

  const tabMuseumRows = [
    '....X....',
    '..XXXXX..',
    '.XXXXXXX.',
    '.X.X.X.X.',
    '.X.X.X.X.',
    '.X.X.X.X.',
    '.XXXXXXX.',
    'XXXXXXXXX',
  ];
  const tabShopRows = [
    '.XXXXXX.',
    'XXXXXXXX',
    '.XXXXXX.',
    'XXXXXXXX',
    '.XXXXXX.',
  ];

  // -------------------------------------------------------------------------
  // Build everything
  // -------------------------------------------------------------------------
  const Assets = { C: C, mk: mk, painter: painter, sprite: sprite, flipped: flipped, rng: mulberry32 };

  Assets.build = function () {
    const A = Assets;
    A.tiles = {
      grass: [tileGrass(11), tileGrass(23), tileGrass(37, true), tileGrass(53)],
      path: [tilePath(5), tilePath(19)],
      floorA: tileFloor(false),
      floorB: tileFloor(true),
      wall: tileWall(),
      wallWindow: tileWallWindow(),
      dirtHidden: [tileDirtHidden(7), tileDirtHidden(29), tileDirtHidden(43)],
      dirtRevealed: tileDirtRevealed(),
    };

    A.icons = {
      coin: sprite(coinRows, ICON_PAL),
      gem: sprite(gemRows, ICON_PAL),
      pick: sprite(pickRows, ICON_PAL),
      flag: sprite(flagRows, ICON_PAL),
      lock: sprite(lockRows, ICON_PAL),
      bone: sprite(boneRows, { W: C.white }),
      boneShade: sprite(boneRows, { W: C.ltgray }),
      tabMuseum: sprite(tabMuseumRows, { X: C.cream }),
      tabShop: sprite(tabShopRows, { X: C.cream }),
    };

    A.pieces = {
      skull: sprite(skullRows, { W: C.white, K: C.ink }),
      body: sprite(ribsRows, { W: C.white }),
      legs: sprite(boneRows, { W: C.white }),
      tail: sprite(tailRows, { W: C.white }),
    };
    A.piecesDark = {
      skull: sprite(skullRows, { W: '#4a4560', K: C.ink }),
      body: sprite(ribsRows, { W: '#4a4560' }),
      legs: sprite(boneRows, { W: '#4a4560' }),
      tail: sprite(tailRows, { W: '#4a4560' }),
    };

    A.ores = {
      amber: oreSprite(amberRows, C.orange, C.ltbrown, C.yellow),
      copper: oreSprite(nuggetRows, '#c77b58', C.ltbrown, C.cream),
      silver: oreSprite(nuggetRows, C.pale, C.ltgray, C.white),
      gold: oreSprite(nuggetRows, C.yellow, C.orange, C.white),
      prism: oreSprite(prismRows, C.cyan, C.steel, C.white),
    };

    A.dig = {
      boulder: sprite(boulderRows, { L: C.ltgray, G: C.gray, S: C.dkgray2 }),
      gas: [sprite(gasRows1, { P: C.purple, L: C.pink }), sprite(gasRows2, { P: C.purple, L: C.pink })],
      sparkle: sparkleFrames(),
    };

    // skeletons by archetype
    A.skel = {
      bigTheropod: skelTheropod(true),
      smallTheropod: skelTheropod(false),
      smallBiped: skelSmallBiped(),
      longneck: skelLongneck(),
      stego: skelStego(),
      trike: skelTrike(),
      anky: skelAnky(),
      flyer: skelFlyer(),
    };

    // visitors: variants x 2 frames, facing right; flipped for left
    A.visitors = [];
    for (let i = 0; i < 8; i++) {
      const hair = VIS_HAIR[i % VIS_HAIR.length];
      const shirt = VIS_SHIRT[(i * 3 + 1) % VIS_SHIRT.length];
      const pants = VIS_PANTS[(i * 2 + 1) % VIS_PANTS.length];
      const skin = VIS_SKIN[(i * 5 + 2) % VIS_SKIN.length];
      const fa = visitorSprite(visitorA, hair, shirt, pants, skin);
      const fb = visitorSprite(visitorB, hair, shirt, pants, skin);
      A.visitors.push({
        right: [fa, fb],
        left: [flipped(fa), flipped(fb)],
      });
    }

    // Mounted-skeleton exhibits (pedestal + skeleton + rope), one per fossil.
    A.exhibits = {};
    if (window.GameData) {
      const fossils = window.GameData.FOSSILS;
      for (let i = 0; i < fossils.length; i++) {
        const f = fossils[i];
        const skel = A.skel[f.skel] || A.skel.smallBiped;
        const col = (window.GameData.RARITY[f.rarity] || {}).color || C.ltgray;
        A.exhibits[f.id] = exhibitSprite(skel, col, f.skel === 'flyer');
      }
    }

    A.objects = {
      plant: sprite(plantRows, { F: C.green, D: C.dkgreen, R: C.ltbrown, P: C.orange }),
      bench: sprite(benchRows, { T: C.tan, D: C.ltbrown, B: C.ltbrown, K: C.brown }),
      statue: statueSprite(),
      fountain: fountainFrames(),
      banner: bannerFrames(),
      giftShop: stall(C.red, C.white, C.salmon, 'bone'),
      snackBar: stall(C.yellow, C.teal, C.red, 'cup'),
      restroom: restroom(),
      entrance: entranceArch(),
      sign: sprite(signRows, { N: C.brown, T: C.tan, C: C.cream }),
    };

    A.shadows = {
      s10: shadowSprite(10),
      s16: shadowSprite(16),
      s26: shadowSprite(26),
      s32: shadowSprite(32),
    };

    A.bubble = emoteBubble();
  };

  window.Assets = Assets;
})();
