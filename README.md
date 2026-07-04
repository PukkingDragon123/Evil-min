# 🦖 Dino Dig Museum

A polished, pixel-art **idle / tycoon** game in the spirit of *Let's Build a Zoo* —
but you build a **dinosaur museum**. Head out to excavation sites and dig up fossils
and rare ore with **Minesweeper-style** gameplay, assemble complete skeletons, and
mount them as exhibits that draw crowds and earn coins even while you're away.

**Zero dependencies. No build step. No external assets.** Everything — art, sound,
and code — is generated procedurally in a single self-contained bundle of plain
HTML5 Canvas + JavaScript. Just open `index.html`.

## How to play

Open `index.html` in any modern browser (desktop or mobile). Progress saves
automatically to `localStorage`.

### The loop

1. **DIG** — Pick an excavation site and reveal buried dirt tiles. Numbers show how
   many of the neighboring tiles hide a **hazard** (gas pocket 💨 or unstable
   boulder 🪨), exactly like Minesweeper. Empty tiles cascade open.
   - **Tap** to dig (each dig costs 1 energy; energy regenerates over time or
     refills with gems).
   - **Hold** a tile (or toggle **FLAG** mode, or right-click on desktop) to flag a
     suspected hazard.
   - Tiles can hide **fossil bone pieces**, **ore & gems**, or **coins**.
2. **COLLECT** — Every dinosaur needs four bone pieces: **skull, ribcage, legs,
   tail**. Gather all four in the **FOSSILS** collection to **mount** the skeleton.
3. **BUILD** — Mounted skeletons become exhibits on your museum floor. Add
   decorations and facilities (gift shop, snack bar, restroom, fountain…) from the
   **SHOP** to raise your *wonder* rating and keep visitors happy.
4. **EARN** — Exhibits and facilities generate coins passively, scaled by visitor
   satisfaction. You even collect a share of the income you missed while away.

### Content

- **8 dinosaurs** across 5 rarity tiers — from the Common *Compsognathus* to the
  Legendary *Tyrannosaurus rex*, each with a hand-built procedural skeleton
  (theropods, long-necks, Stegosaurus plates, Triceratops frill, Ankylosaurus club,
  a suspended Pteranodon, and more).
- **3 excavation sites** with increasing size, hazard density, and rarer loot.
- **5 ore/gem types** to mine and sell.
- **8 buildable items** (decor + facilities) with a scaling cost curve.
- Levels & XP, energy economy, offline earnings, procedural chiptune music and SFX,
  visitors that stroll between exhibits, confetti, screen shake, and more.

## Tech

- Rendered at a crisp `480×270` logical resolution, upscaled with nearest-neighbor
  to fill the window (letterboxed), so it stays sharp pixel art at any size.
- Art palette: **DawnBringer 32**. All sprites (tiles, skeletons, visitors,
  facilities, icons, UI) are drawn procedurally at load time — no image files.
- Audio is fully synthesized with the Web Audio API — no sound files.

### File layout

| File | Responsibility |
|------|----------------|
| `js/font.js`    | Bitmap pixel font & text drawing |
| `js/sprites.js` | Palette + all procedural pixel art |
| `js/audio.js`   | Procedural SFX + looping music bed |
| `js/data.js`    | Game content & balance (fossils, ore, sites, shop) |
| `js/state.js`   | Save/load, resources, inventory, museum grid, offline income |
| `js/dig.js`     | Minesweeper excavation board logic |
| `js/museum.js`  | Visitor simulation + passive income |
| `js/render.js`  | Museum & dig-board rendering |
| `js/ui.js`      | HUD, tabs, shop, collection, modals, toasts |
| `js/main.js`    | Boot, main loop, input routing |
