// ---------------------------------------------------------------------------
// Tiny bitmap pixel font (3x5 base, variable width). All UI text is drawn
// through here so the whole game keeps a crisp pixel look with no web fonts.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // Each glyph: array of row strings, 'X' = pixel on. Height is always 5.
  const GLYPHS = {
    'A': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
    'B': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
    'C': ['.XX', 'X..', 'X..', 'X..', '.XX'],
    'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
    'E': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
    'F': ['XXX', 'X..', 'XX.', 'X..', 'X..'],
    'G': ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
    'H': ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
    'I': ['XXX', '.X.', '.X.', '.X.', 'XXX'],
    'J': ['..X', '..X', '..X', 'X.X', '.X.'],
    'K': ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
    'L': ['X..', 'X..', 'X..', 'X..', 'XXX'],
    'M': ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'],
    'N': ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
    'O': ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
    'P': ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
    'Q': ['.X..', 'X.X.', 'X.X.', 'X.X.', '.XX.'].map(function (r) { return r; }),
    'R': ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
    'S': ['.XX', 'X..', '.X.', '..X', 'XX.'],
    'T': ['XXX', '.X.', '.X.', '.X.', '.X.'],
    'U': ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
    'V': ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
    'W': ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'],
    'X': ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
    'Y': ['X.X', 'X.X', '.X.', '.X.', '.X.'],
    'Z': ['XXX', '..X', '.X.', 'X..', 'XXX'],
    '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
    '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
    '3': ['XXX', '..X', '.XX', '..X', 'XXX'],
    '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
    '5': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    '6': ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
    '7': ['XXX', '..X', '..X', '.X.', '.X.'],
    '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
    '9': ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
    '.': ['.', '.', '.', '.', 'X'],
    ',': ['..', '..', '..', '.X', 'X.'],
    ':': ['.', 'X', '.', 'X', '.'],
    ';': ['..', '.X', '..', '.X', 'X.'],
    '!': ['X', 'X', 'X', '.', 'X'],
    '?': ['XX.', '..X', '.X.', '...', '.X.'],
    '$': ['.X.', 'XXX', 'X..', '.XX', 'XX.'],
    '+': ['...', '.X.', 'XXX', '.X.', '...'],
    '-': ['...', '...', 'XXX', '...', '...'],
    '/': ['..X', '..X', '.X.', 'X..', 'X..'],
    '%': ['X.X', '..X', '.X.', 'X..', 'X.X'],
    "'": ['X', 'X', '.', '.', '.'],
    '"': ['X.X', 'X.X', '...', '...', '...'],
    '(': ['.X', 'X.', 'X.', 'X.', '.X'],
    ')': ['X.', '.X', '.X', '.X', 'X.'],
    '[': ['XX', 'X.', 'X.', 'X.', 'XX'],
    ']': ['XX', '.X', '.X', '.X', 'XX'],
    '<': ['..X', '.X.', 'X..', '.X.', '..X'],
    '>': ['X..', '.X.', '..X', '.X.', 'X..'],
    '=': ['...', 'XXX', '...', 'XXX', '...'],
    '*': ['X.X', '.X.', 'X.X', '...', '...'],
    '#': ['X.X', 'XXX', 'X.X', 'XXX', 'X.X'],
    '@': ['.XX.', 'X.XX', 'X.XX', 'X...', '.XX.'],
    '_': ['...', '...', '...', '...', 'XXX'],
    '~': ['....', '.X.X', 'X.X.', '....', '....'],
    'x': ['...', 'X.X', '.X.', 'X.X', '...'], // small multiply sign
    // Special icons usable inline in text:
    '♥': ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],   // heart
    '★': ['..X..', '.XXX.', 'XXXXX', '.XXX.', 'X...X'],   // star
    '↑': ['.X.', 'XXX', '.X.', '.X.', '.X.'],             // up arrow
    '→': ['...', '.X.', 'XXX', '.X.', '...'].map(function (r, i) {
      return ['..X..', '...X.', 'XXXXX', '...X.', '..X..'][i];
    }),
    '✓': ['...X', '...X', 'X.X.', 'X.X.', '.X..'],        // check
  };

  const SPACE_W = 2;
  const LINE_H = 7;

  function glyphW(ch) {
    const up = ch.toUpperCase();
    const g = GLYPHS[ch] || GLYPHS[up];
    if (!g) return SPACE_W;
    return g[0].length;
  }

  function textW(str, scale) {
    scale = scale || 1;
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ' ') { w += SPACE_W + 1; continue; }
      w += glyphW(ch) + 1;
    }
    if (w > 0) w -= 1;
    return w * scale;
  }

  // align: 0 = left, 1 = center, 2 = right
  function drawText(ctx, str, x, y, color, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const align = opts.align || 0;
    str = String(str);
    if (align === 1) x -= Math.floor(textW(str, scale) / 2);
    else if (align === 2) x -= textW(str, scale);
    x = Math.round(x); y = Math.round(y);
    if (opts.shadow) {
      drawRaw(ctx, str, x, y + scale, opts.shadow, scale);
    }
    drawRaw(ctx, str, x, y, color, scale);
    return textW(str, scale);
  }

  function drawRaw(ctx, str, x, y, color, scale) {
    ctx.fillStyle = color;
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ' ') { cx += (SPACE_W + 1) * scale; continue; }
      const g = GLYPHS[ch] || GLYPHS[ch.toUpperCase()];
      if (!g) { cx += (SPACE_W + 1) * scale; continue; }
      const gw = g[0].length;
      for (let ry = 0; ry < g.length; ry++) {
        const row = g[ry];
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] === 'X') {
            ctx.fillRect(cx + rx * scale, y + ry * scale, scale, scale);
          }
        }
      }
      cx += (gw + 1) * scale;
    }
  }

  // Word-wraps text to maxW px, returns number of lines drawn.
  function drawTextWrapped(ctx, str, x, y, maxW, color, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const words = String(str).split(' ');
    let line = '';
    let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (textW(test, scale) > maxW && line) {
        drawText(ctx, line, x, y + lines * LINE_H * scale, color, opts);
        lines++;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) {
      drawText(ctx, line, x, y + lines * LINE_H * scale, color, opts);
      lines++;
    }
    return lines;
  }

  window.Font = { drawText: drawText, textW: textW, drawTextWrapped: drawTextWrapped, LINE_H: LINE_H };
})();
