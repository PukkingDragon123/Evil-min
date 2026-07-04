// ---------------------------------------------------------------------------
// Static game content: fossils, ore, biomes/sites (with depth), polyomino
// shapes for the packing inventory, and the build catalog. All balancing
// numbers live here.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const RARITY = {
    common:    { color: '#9badb7', glow: '#cbdbfc', name: 'Common',    stars: 1, mount: 6,  cell: 8 },
    uncommon:  { color: '#6abe30', glow: '#99e550', name: 'Uncommon',  stars: 2, mount: 9,  cell: 16 },
    rare:      { color: '#5b6ee1', glow: '#639bff', name: 'Rare',      stars: 3, mount: 12, cell: 34 },
    epic:      { color: '#b869d6', glow: '#d77bba', name: 'Epic',      stars: 4, mount: 16, cell: 70 },
    legendary: { color: '#ffd23f', glow: '#fbf236', name: 'Legendary', stars: 5, mount: 22, cell: 150 },
  };

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  // Polyomino shapes (cell offset lists, normalized to top-left origin).
  const SHAPES = {
    P1:  [[0, 0]],
    I2:  [[0, 0], [1, 0]],
    I3:  [[0, 0], [1, 0], [2, 0]],
    V3:  [[0, 0], [0, 1], [1, 1]],
    O4:  [[0, 0], [1, 0], [0, 1], [1, 1]],
    T4:  [[0, 0], [1, 0], [2, 0], [1, 1]],
    L4:  [[0, 0], [0, 1], [0, 2], [1, 2]],
    J4:  [[1, 0], [1, 1], [1, 2], [0, 2]],
    S4:  [[1, 0], [2, 0], [0, 1], [1, 1]],
    I4:  [[0, 0], [1, 0], [2, 0], [3, 0]],
    P5:  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    T5:  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
    X5:  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    L5:  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    Z5:  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
    O6:  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  };

  // Shape pool per rarity (rarer = bigger, harder to pack, worth more).
  const RARITY_SHAPES = {
    common:    ['P1', 'I2', 'V3', 'I3'],
    uncommon:  ['I2', 'V3', 'I3', 'O4', 'L4'],
    rare:      ['O4', 'T4', 'L4', 'J4', 'S4'],
    epic:      ['I4', 'T4', 'L4', 'P5', 'T5'],
    legendary: ['P5', 'T5', 'X5', 'L5', 'Z5', 'O6'],
  };

  // Fossils (dinosaurs). skel -> sprite archetype; period is flavor.
  const FOSSILS = [
    { id: 'compy',  name: 'Compsognathus', skel: 'smallBiped',   rarity: 'common',   period: 'Jurassic',   income: 1,  blurb: 'A chicken-sized speedster. Every museum starts somewhere.' },
    { id: 'raptor', name: 'Velociraptor',  skel: 'smallTheropod',rarity: 'uncommon', period: 'Cretaceous', income: 3,  blurb: 'Clever girl. A crowd favorite for its wicked claws.' },
    { id: 'stego',  name: 'Stegosaurus',   skel: 'stego',        rarity: 'uncommon', period: 'Jurassic',   income: 4,  blurb: 'Plated back and a spiked tail (a thagomizer!).' },
    { id: 'dilo',   name: 'Dilophosaurus', skel: 'crested',      rarity: 'uncommon', period: 'Jurassic',   income: 5,  blurb: 'Twin head crests and a surprising frill.' },
    { id: 'plesio', name: 'Plesiosaurus',  skel: 'plesio',       rarity: 'rare',     period: 'Jurassic',   income: 7,  blurb: 'A long-necked marine reptile with four paddles.' },
    { id: 'trike',  name: 'Triceratops',   skel: 'trike',        rarity: 'rare',     period: 'Cretaceous', income: 9,  blurb: 'Three horns and a huge bony frill. A true showpiece.' },
    { id: 'anky',   name: 'Ankylosaurus',  skel: 'anky',         rarity: 'rare',     period: 'Cretaceous', income: 8,  blurb: 'A living tank with a club-tail. Kids adore it.' },
    { id: 'para',   name: 'Parasaurolophus', skel: 'crested',    rarity: 'rare',     period: 'Cretaceous', income: 8,  blurb: 'Its hollow crest trumpeted across the herds.' },
    { id: 'pachy',  name: 'Pachycephalosaurus', skel: 'dome',    rarity: 'rare',     period: 'Cretaceous', income: 9,  blurb: 'A ten-inch-thick bony dome for headbutting.' },
    { id: 'ptero',  name: 'Pteranodon',    skel: 'flyer',        rarity: 'rare',     period: 'Cretaceous', income: 10, blurb: 'A soaring reptile suspended above the gallery.' },
    { id: 'allo',   name: 'Allosaurus',    skel: 'allo',         rarity: 'epic',     period: 'Jurassic',   income: 16, blurb: 'The lion of the Jurassic. A fearsome hunter.' },
    { id: 'therizino', name: 'Therizinosaurus', skel: 'claw',    rarity: 'epic',     period: 'Cretaceous', income: 18, blurb: 'Metre-long scythe claws - but a gentle herbivore.' },
    { id: 'bronto', name: 'Brontosaurus',  skel: 'longneck',     rarity: 'epic',     period: 'Jurassic',   income: 20, blurb: 'Thunder lizard. Its neck nearly touches the skylight.' },
    { id: 'diplo',  name: 'Diplodocus',    skel: 'diplo',        rarity: 'epic',     period: 'Jurassic',   income: 22, blurb: 'One of the longest animals ever to walk the Earth.' },
    { id: 'mosa',   name: 'Mosasaurus',    skel: 'mosa',         rarity: 'epic',     period: 'Cretaceous', income: 24, blurb: 'A colossal sea monster with jaws like a crocodile.' },
    { id: 'spino',  name: 'Spinosaurus',   skel: 'spino',        rarity: 'legendary',period: 'Cretaceous', income: 40, blurb: 'A sail-backed river giant, larger even than the Rex.' },
    { id: 'quetz',  name: 'Quetzalcoatlus',skel: 'bigPtero',     rarity: 'legendary',period: 'Cretaceous', income: 42, blurb: 'A pterosaur as tall as a giraffe, with a 10m wingspan.' },
    { id: 'rex',    name: 'Tyrannosaurus', skel: 'bigTheropod',  rarity: 'legendary',period: 'Cretaceous', income: 50, blurb: 'The king. The centerpiece every curator dreams of.' },
  ];

  const ORES = [
    { id: 'copper', name: 'Copper Nugget', sprite: 'copper', rarity: 'common',   coins: 25,  gems: 0 },
    { id: 'amber',  name: 'Amber',         sprite: 'amber',  rarity: 'uncommon', coins: 60,  gems: 0, blurb: 'Sometimes an insect is trapped inside!' },
    { id: 'silver', name: 'Silver Vein',   sprite: 'silver', rarity: 'uncommon', coins: 80,  gems: 0 },
    { id: 'gold',   name: 'Gold Nugget',   sprite: 'gold',   rarity: 'rare',     coins: 200, gems: 1 },
    { id: 'prism',  name: 'Prism Crystal', sprite: 'prism',  rarity: 'epic',     coins: 340, gems: 3, blurb: 'A rare gem that fuels premium expansions.' },
  ];

  // Biome palettes shared by dig-generation flavor + rendering.
  const BIOMES = {
    temperate: {
      name: 'Temperate', sky: ['#3a4a6b', '#26314d'], soil: ['#a5714b', '#8f563b', '#663931'],
      tileHi: '#c08a5e', tileLo: '#7a4a34', edge: '#4a2c22', crack: '#5a3324',
      accent: '#6abe30', dust: '#d9a066', ambient: 'dust', node: '#eec39a',
    },
    desert: {
      name: 'Desert', sky: ['#c98a4b', '#7a4a2a'], soil: ['#e0a860', '#c98a4b', '#8f5a2b'],
      tileHi: '#f0c078', tileLo: '#a86a34', edge: '#6b3f1c', crack: '#8a5424',
      accent: '#fbf236', dust: '#f0c078', ambient: 'dust', node: '#fce0a0',
    },
    ice: {
      name: 'Frozen', sky: ['#5a7a9e', '#33506e'], soil: ['#b8d4e8', '#8fb0cc', '#5f7e9c'],
      tileHi: '#dcefff', tileLo: '#6f92b0', edge: '#3f5c78', crack: '#7fa0bc',
      accent: '#5fcde4', dust: '#eaf6ff', ambient: 'snow', node: '#eaf6ff',
    },
    volcanic: {
      name: 'Volcanic', sky: ['#5a2224', '#2a1418'], soil: ['#6a5450', '#4a3a38', '#2c2426'],
      tileHi: '#8a6a62', tileLo: '#3a2e2c', edge: '#1a1416', crack: '#df7126',
      accent: '#df7126', dust: '#8a6a62', ambient: 'ember', node: '#ffb060',
    },
    marine: {
      name: 'Seabed', sky: ['#1f5a6e', '#0f3444'], soil: ['#4a8a8e', '#37746e', '#245450'],
      tileHi: '#6fb0aa', tileLo: '#2e5e58', edge: '#173e3c', crack: '#5fcde4',
      accent: '#5fcde4', dust: '#a0d8d0', ambient: 'bubble', node: '#bfeee6',
    },
    jungle: {
      name: 'Jungle', sky: ['#2a4a2e', '#16301c'], soil: ['#7a6a3a', '#5f5228', '#3f3a1c'],
      tileHi: '#9a8a4a', tileLo: '#4a4020', edge: '#2a2812', crack: '#6abe30',
      accent: '#6abe30', dust: '#8f974a', ambient: 'spore', node: '#d9d066',
    },
    deep: {
      name: 'Deep Strata', sky: ['#2a2440', '#161228'], soil: ['#5a4e6a', '#443a52', '#2c2438'],
      tileHi: '#7a6e8a', tileLo: '#3a3048', edge: '#1c1628', crack: '#b869d6',
      accent: '#b869d6', dust: '#7a6e8a', ambient: 'dust', node: '#d9b0ee',
    },
  };

  // Sites. Every site descends through infinite depth levels; difficulty and
  // loot rarity scale with depth. `species` weights which fossils appear.
  const SITES = [
    {
      id: 'quarry', name: 'Old Quarry', biome: 'temperate', period: 'Jurassic',
      cost: 0, unlocked: true, cols: 8, rows: 8, nodes: 10,
      desc: 'A gentle starter dig. Compys, raptors, stegos and copper.',
      species: { compy: 5, raptor: 3, stego: 2, dilo: 1 },
      ores: { copper: 5, amber: 2 }, gemRate: 0.08,
    },
    {
      id: 'badlands', name: 'Sunbaked Badlands', biome: 'desert', period: 'Cretaceous',
      cost: 1500, unlocked: false, cols: 9, rows: 9, nodes: 14,
      desc: 'Cracked desert hiding trikes, ankys, parasaurs and silver.',
      species: { raptor: 3, trike: 3, anky: 3, para: 2, ptero: 1 },
      ores: { amber: 3, silver: 3, gold: 1 }, gemRate: 0.1,
    },
    {
      id: 'tundra', name: 'Frozen Tundra', biome: 'ice', period: 'Ice Age',
      cost: 6000, unlocked: false, cols: 10, rows: 9, nodes: 16,
      desc: 'Permafrost preserving ankys, plesiosaurs and silver veins.',
      species: { anky: 3, plesio: 3, para: 2, pachy: 2 },
      ores: { silver: 4, gold: 2, prism: 1 }, gemRate: 0.12,
    },
    {
      id: 'volcanic', name: 'Volcanic Ashlands', biome: 'volcanic', period: 'Jurassic',
      cost: 18000, unlocked: false, cols: 10, rows: 10, nodes: 18,
      desc: 'Ash-buried allosaurs, dilophosaurs and spinosaur bones.',
      species: { dilo: 3, allo: 3, stego: 2, spino: 1 },
      ores: { gold: 3, prism: 2, silver: 2 }, gemRate: 0.14,
    },
    {
      id: 'coast', name: 'Sunken Coast', biome: 'marine', period: 'Jurassic',
      cost: 45000, unlocked: false, cols: 11, rows: 10, nodes: 20,
      desc: 'A drowned seabed of mosasaurs, plesiosaurs and pteranodons.',
      species: { plesio: 3, ptero: 3, mosa: 2, diplo: 2, spino: 1 },
      ores: { silver: 3, gold: 3, prism: 2 }, gemRate: 0.16,
    },
    {
      id: 'jungle', name: 'Amber Jungle', biome: 'jungle', period: 'Cretaceous',
      cost: 120000, unlocked: false, cols: 11, rows: 10, nodes: 22,
      desc: 'Overgrown ruins with therizinos, quetzals and endless amber.',
      species: { para: 3, pachy: 3, therizino: 2, quetz: 1 },
      ores: { amber: 5, gold: 3, prism: 3 }, gemRate: 0.18,
    },
    {
      id: 'canyon', name: 'Thunder Canyon', biome: 'deep', period: 'Cretaceous',
      cost: 350000, unlocked: false, cols: 12, rows: 11, nodes: 24,
      desc: 'The deepest strata, guarding brontos, diplos and the mighty Rex.',
      species: { pachy: 2, allo: 2, bronto: 2, diplo: 2, quetz: 1, rex: 1 },
      ores: { gold: 4, prism: 4 }, gemRate: 0.2,
    },
  ];

  // Build catalog with shop categories.
  const CATALOG = [
    // --- nature / small decor ---
    { id: 'plant',    name: 'Fern Planter',   cat: 'nature', kind: 'deco',     cost: 60,   gems: 0, w: 1, h: 1, wonder: 2,  sprite: 'plant',    desc: 'A leafy touch of the Mesozoic.' },
    { id: 'palm',     name: 'Cycad Palm',     cat: 'nature', kind: 'deco',     cost: 140,  gems: 0, w: 1, h: 1, wonder: 4,  sprite: 'palm',     desc: 'A prehistoric palm, tall and proud.' },
    { id: 'topiary',  name: 'Dino Topiary',   cat: 'nature', kind: 'deco',     cost: 320,  gems: 0, w: 1, h: 1, wonder: 9,  sprite: 'topiary',  desc: 'A hedge trimmed into a little sauropod.' },
    { id: 'lamp',     name: 'Gas Lamp',       cat: 'nature', kind: 'deco',     cost: 110,  gems: 0, w: 1, h: 1, wonder: 3,  comfort: 1, sprite: 'lamp', anim: true, desc: 'A warm glow for the evening crowd.' },
    // --- decor / prestige ---
    { id: 'sign',     name: 'Info Placard',   cat: 'decor',  kind: 'deco',     cost: 45,   gems: 0, w: 1, h: 1, wonder: 2,  sprite: 'sign',     desc: 'Educational! Nudges up the wonder rating.' },
    { id: 'case',     name: 'Display Case',   cat: 'decor',  kind: 'deco',     cost: 210,  gems: 0, w: 1, h: 1, wonder: 7,  sprite: 'case',     desc: 'A glass case of curious small fossils.' },
    { id: 'statue',   name: 'Ammonite Statue',cat: 'decor',  kind: 'deco',     cost: 260,  gems: 0, w: 1, h: 1, wonder: 8,  sprite: 'statue',   desc: 'A polished centerpiece guests photograph.' },
    { id: 'carpet',   name: 'Red Carpet',     cat: 'decor',  kind: 'deco',     cost: 90,   gems: 0, w: 2, h: 1, wonder: 5,  comfort: 2, sprite: 'carpet', desc: 'Roll it out for the VIP experience.' },
    { id: 'fountain', name: 'Fossil Fountain', cat: 'decor', kind: 'deco',     cost: 900,  gems: 1, w: 2, h: 2, wonder: 22, comfort: 6, sprite: 'fountain', anim: true, desc: 'A grand water feature. Big wonder boost.' },
    { id: 'archway',  name: 'Bone Archway',   cat: 'decor',  kind: 'deco',     cost: 1400, gems: 2, w: 2, h: 2, wonder: 30, sprite: 'archway',  desc: 'A dramatic arch of giant rib bones.' },
    // --- facilities ---
    { id: 'giftShop', name: 'Gift Shop',      cat: 'facility', kind: 'facility', cost: 600,  gems: 0, w: 2, h: 2, income: 8,  sprite: 'giftShop', desc: 'Sells replica bones. Steady extra coins.' },
    { id: 'snackBar', name: 'Snack Bar',      cat: 'facility', kind: 'facility', cost: 950,  gems: 0, w: 2, h: 2, income: 12, comfort: 8, sprite: 'snackBar', desc: 'Fed visitors are happy visitors.' },
    { id: 'restroom', name: 'Restroom',       cat: 'facility', kind: 'facility', cost: 450,  gems: 0, w: 2, h: 2, comfort: 14, sprite: 'restroom', desc: 'A must-have. Keeps satisfaction high.' },
    { id: 'cafe',     name: 'Fossil Cafe',    cat: 'facility', kind: 'facility', cost: 2200, gems: 1, w: 2, h: 2, income: 24, comfort: 14, sprite: 'cafe', desc: 'A sit-down cafe. Premium coin generator.' },
    { id: 'theater',  name: 'Cinema Dome',    cat: 'facility', kind: 'facility', cost: 5000, gems: 2, w: 2, h: 2, income: 40, comfort: 10, wonder: 12, sprite: 'theater', desc: 'A dino documentary dome. Big earner.' },
    { id: 'kiosk',    name: 'Ticket Kiosk',   cat: 'facility', kind: 'facility', cost: 800,  gems: 0, w: 1, h: 1, income: 6,  sprite: 'kiosk',    desc: 'A compact 1x1 coin booth.' },
  ];

  const ENERGY_REGEN_MS = 8000;
  const ENERGY_REFILL_GEM_COST = 2;

  function scaledCost(base, owned) { return Math.round(base * Math.pow(1.16, owned)); }

  function weightedKey(obj) {
    let total = 0; for (const k in obj) total += obj[k];
    let r = Math.random() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  }

  function fossilById(id) { return FOSSILS.find(function (f) { return f.id === id; }); }
  function oreById(id) { return ORES.find(function (o) { return o.id === id; }); }
  function siteById(id) { return SITES.find(function (s) { return s.id === id; }); }
  function catalogById(id) { return CATALOG.find(function (c) { return c.id === id; }); }
  function shapeCells(name) { return SHAPES[name] || SHAPES.P1; }

  window.GameData = {
    RARITY: RARITY, RARITY_ORDER: RARITY_ORDER,
    SHAPES: SHAPES, RARITY_SHAPES: RARITY_SHAPES,
    FOSSILS: FOSSILS, ORES: ORES, SITES: SITES, CATALOG: CATALOG, BIOMES: BIOMES,
    ENERGY_REGEN_MS: ENERGY_REGEN_MS, ENERGY_REFILL_GEM_COST: ENERGY_REFILL_GEM_COST,
    scaledCost: scaledCost, weightedKey: weightedKey, shapeCells: shapeCells,
    fossilById: fossilById, oreById: oreById, siteById: siteById, catalogById: catalogById,
  };
})();
