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
    { id: 'shelf',    name: 'Specimen Shelf', cat: 'decor',  kind: 'deco',     cost: 180,  gems: 0, w: 1, h: 1, shelf: true, base: 4, perCurio: 1, sprite: 'shelf', desc: 'Displays your curios. Wonder grows as you discover more specimens.' },
    { id: 'cabinet',  name: 'Curio Cabinet',  cat: 'decor',  kind: 'deco',     cost: 950,  gems: 1, w: 2, h: 1, shelf: true, base: 14, perCurio: 3, sprite: 'cabinet', desc: 'A grand cabinet. Big wonder scaled by your specimen collection.' },
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

  // Buyable museum floors (each is a full building level with its own grid).
  const FLOORS = [
    { name: 'Ground Floor', cost: 0, gems: 0 },
    { name: 'Upper Gallery', cost: 9000, gems: 2 },
    { name: 'Sky Atrium', cost: 60000, gems: 6 },
    { name: 'Fossil Vault', cost: 300000, gems: 18 },
  ];

  // Hireable staff. Cost scales with the number already hired.
  const STAFF = [
    { id: 'janitor', name: 'Janitor', icon: 'janitor', baseCost: 400, gems: 0, max: 6, desc: 'Roams the floor sweeping up litter before it upsets guests.' },
    { id: 'guide', name: 'Tour Guide', icon: 'guide', baseCost: 1100, gems: 0, max: 6, comfort: 12, desc: 'Leads tours - raises visitor satisfaction (+comfort).' },
    { id: 'curator', name: 'Curator', icon: 'curator', baseCost: 2600, gems: 0, max: 5, income: 0.1, desc: 'Curates exhibits for +10% museum income each.' },
  ];

  // VIP guests + litter tuning.
  const VIP_TIP = 60;          // bonus coins a VIP drops per tip
  const TRASH_CAP = 14;        // max litter on a floor
  const TRASH_PENALTY = 0.02;  // satisfaction lost per litter (before staff)

  // Quests. mode 'count' accumulates; 'reach' tracks a high-water value.
  const QUESTS = [
    { id: 'q_dig',      desc: 'Survey a tile at the dig site',        type: 'survey',   mode: 'count', target: 1,  reward: { coins: 60 } },
    { id: 'q_extract',  desc: 'Excavate 3 fossils',                   type: 'extract',  mode: 'count', target: 3,  reward: { coins: 140, xp: 12 } },
    { id: 'q_clear',    desc: 'Bank fossils by clearing a line',      type: 'clearLine',mode: 'count', target: 1,  reward: { coins: 160, gems: 1 } },
    { id: 'q_mount',    desc: 'Mount your first skeleton',            type: 'mount',    mode: 'count', target: 1,  reward: { coins: 320, xp: 30 } },
    { id: 'q_facility', desc: 'Build a facility in your museum',      type: 'facility', mode: 'count', target: 1,  reward: { coins: 240 } },
    { id: 'q_janitor',  desc: 'Hire a Janitor',                       type: 'hireJanitor', mode: 'count', target: 1, reward: { coins: 260 } },
    { id: 'q_trash',    desc: 'Clean up 5 pieces of litter',          type: 'trash',    mode: 'count', target: 5,  reward: { coins: 220, xp: 15 } },
    { id: 'q_vip',      desc: 'Welcome a VIP guest',                  type: 'vip',      mode: 'count', target: 1,  reward: { gems: 2 } },
    { id: 'q_depth',    desc: 'Dig down to depth 3',                  type: 'depth',    mode: 'reach', target: 3,  reward: { coins: 500, gems: 2 } },
    { id: 'q_site',     desc: 'Unlock a new excavation site',         type: 'unlockSite', mode: 'count', target: 1, reward: { coins: 400 } },
    { id: 'q_upgrade',  desc: 'Buy an upgrade',                       type: 'upgrade',  mode: 'count', target: 1,  reward: { coins: 300 } },
    { id: 'q_floor',    desc: 'Buy a new museum floor',               type: 'floor',    mode: 'count', target: 1,  reward: { gems: 3 } },
    { id: 'q_visitors', desc: 'Draw a crowd of 20 visitors',          type: 'visitors', mode: 'reach', target: 20, reward: { coins: 700 } },
    { id: 'q_mount5',   desc: 'Mount 5 skeletons in total',           type: 'mount',    mode: 'count', target: 5,  reward: { coins: 1200, gems: 3 } },
    { id: 'q_curator',  desc: 'Hire a Curator',                       type: 'hireCurator', mode: 'count', target: 1, reward: { coins: 800 } },
    { id: 'q_deep',     desc: 'Reach depth 8 anywhere',               type: 'depth',    mode: 'reach', target: 8,  reward: { coins: 2500, gems: 5 } },
    { id: 'q_curio',    desc: 'Dig up a specimen curio',              type: 'curio',    mode: 'count', target: 1,  reward: { coins: 120 } },
    { id: 'q_shelf',    desc: 'Build a Specimen Shelf',               type: 'shelf',    mode: 'count', target: 1,  reward: { coins: 200 } },
    { id: 'q_curio8',   desc: 'Discover 8 different specimens',       type: 'curioUnique', mode: 'reach', target: 8, reward: { coins: 900, gems: 2 } },
    { id: 'q_curio20',  desc: 'Discover 20 different specimens',      type: 'curioUnique', mode: 'reach', target: 20, reward: { coins: 4000, gems: 6 } },
  ];

  // Single-piece collectibles (no assembly) - dug up whole and shown on a
  // Specimen Shelf. `form` selects a procedural sprite shape.
  const CURIO_WONDER = { common: 3, uncommon: 6, rare: 10, epic: 16, legendary: 24 };
  const CURIOS = [
    // --- bugs / critters ---
    { id: 'trilobite', name: 'Trilobite',      cat: 'bug', form: 'segmented', rarity: 'common',   colors: ['#8f563b', '#663931', '#d9a066'] },
    { id: 'isopod',    name: 'Giant Isopod',   cat: 'bug', form: 'segmented', rarity: 'common',   colors: ['#9badb7', '#696a6a', '#cbdbfc'] },
    { id: 'ammonite',  name: 'Ammonite',       cat: 'bug', form: 'spiral',    rarity: 'common',   colors: ['#d9a066', '#8f563b', '#eec39a'] },
    { id: 'nautilus',  name: 'Nautilus',       cat: 'bug', form: 'spiral',    rarity: 'uncommon', colors: ['#cbdbfc', '#5b6ee1', '#ffffff'] },
    { id: 'dragonfly', name: 'Meganeura',      cat: 'bug', form: 'bug',       rarity: 'rare',     colors: ['#37946e', '#4b692f', '#5fcde4'] },
    { id: 'seascorp',  name: 'Sea Scorpion',   cat: 'bug', form: 'segmented', rarity: 'rare',     colors: ['#4b692f', '#323c39', '#99e550'] },
    { id: 'horseshoe', name: 'Horseshoe Crab', cat: 'bug', form: 'segmented', rarity: 'uncommon', colors: ['#663931', '#45283c', '#8f563b'] },
    { id: 'brachiopod',name: 'Brachiopod',     cat: 'bug', form: 'disc',      rarity: 'common',   colors: ['#d9a066', '#8f563b', '#eec39a'] },
    { id: 'crinoid',   name: 'Crinoid',        cat: 'bug', form: 'stick',     rarity: 'uncommon', colors: ['#cbdbfc', '#9badb7', '#ffffff'] },
    { id: 'belemnite', name: 'Belemnite',      cat: 'bug', form: 'stick',     rarity: 'common',   colors: ['#847e87', '#595652', '#9badb7'] },
    { id: 'amberbug',  name: 'Bug in Amber',   cat: 'bug', form: 'blob',      rarity: 'rare',     colors: ['#df7126', '#8f563b', '#fbf236'] },
    { id: 'spider',    name: 'Fossil Spider',  cat: 'bug', form: 'bug',       rarity: 'uncommon', colors: ['#45283c', '#222034', '#76428a'] },
    // --- plants ---
    { id: 'fern',      name: 'Fern Frond',     cat: 'plant', form: 'leaf',    rarity: 'common',   colors: ['#6abe30', '#4b692f', '#99e550'] },
    { id: 'ginkgo',    name: 'Ginkgo Leaf',    cat: 'plant', form: 'leaf',    rarity: 'uncommon', colors: ['#99e550', '#6abe30', '#fbf236'] },
    { id: 'horsetail', name: 'Horsetail',      cat: 'plant', form: 'stick',   rarity: 'common',   colors: ['#4b692f', '#323c39', '#6abe30'] },
    { id: 'seedfern',  name: 'Seed Fern',      cat: 'plant', form: 'leaf',    rarity: 'uncommon', colors: ['#8f974a', '#524b24', '#99e550'] },
    { id: 'lycopod',   name: 'Lycopod Bark',   cat: 'plant', form: 'disc',    rarity: 'rare',     colors: ['#8f563b', '#663931', '#d9a066'] },
    { id: 'cycadfrond',name: 'Cycad Frond',    cat: 'plant', form: 'leaf',    rarity: 'uncommon', colors: ['#37946e', '#4b692f', '#6abe30'] },
    { id: 'petwood',   name: 'Petrified Wood', cat: 'plant', form: 'stick',   rarity: 'rare',     colors: ['#d9a066', '#8f563b', '#df7126'] },
    { id: 'algae',     name: 'Stromatolite',   cat: 'plant', form: 'blob',    rarity: 'common',   colors: ['#524b24', '#323c39', '#8f974a'] },
    { id: 'pinecone',  name: 'Fossil Cone',    cat: 'plant', form: 'egg',     rarity: 'common',   colors: ['#663931', '#45283c', '#8f563b'] },
    { id: 'moss',      name: 'Ancient Moss',   cat: 'plant', form: 'blob',    rarity: 'uncommon', colors: ['#6abe30', '#37946e', '#99e550'] },
    // --- artifacts ---
    { id: 'pottery',   name: 'Pottery Shard',  cat: 'artifact', form: 'shard', rarity: 'common',  colors: ['#d9a066', '#8f563b', '#eec39a'] },
    { id: 'arrowhead', name: 'Arrowhead',      cat: 'artifact', form: 'point', rarity: 'common',  colors: ['#847e87', '#595652', '#cbdbfc'] },
    { id: 'amberbead', name: 'Amber Bead',     cat: 'artifact', form: 'egg',   rarity: 'uncommon',colors: ['#df7126', '#8a6f30', '#fbf236'] },
    { id: 'boneneedle',name: 'Bone Needle',    cat: 'artifact', form: 'point', rarity: 'uncommon',colors: ['#eec39a', '#d9a066', '#ffffff'] },
    { id: 'claypot',   name: 'Clay Vessel',    cat: 'artifact', form: 'egg',   rarity: 'rare',    colors: ['#ac3232', '#663931', '#df7126'] },
    { id: 'stoneaxe',  name: 'Stone Axe',      cat: 'artifact', form: 'point', rarity: 'rare',    colors: ['#696a6a', '#323c39', '#9badb7'] },
    { id: 'fossilegg', name: 'Fossil Egg',     cat: 'artifact', form: 'egg',   rarity: 'epic',    colors: ['#cbdbfc', '#8f563b', '#ffffff'] },
    { id: 'idol',      name: 'Jade Idol',      cat: 'artifact', form: 'shard', rarity: 'epic',    colors: ['#37946e', '#4b692f', '#5fcde4'] },
  ];

  const CURIO_BIOME = {
    temperate: { plant: 2, bug: 2, artifact: 1 }, desert: { artifact: 2, bug: 1 },
    ice: { bug: 2, artifact: 1 }, volcanic: { artifact: 2, plant: 1 },
    marine: { bug: 3, plant: 1 }, jungle: { plant: 3, bug: 1 }, deep: { artifact: 2, bug: 2, plant: 1 },
  };
  const CURIO_RATE = 0.13; // chance a treasure node is a curio

  function curioById(id) { return CURIOS.find(function (c) { return c.id === id; }); }
  function curioWonder(id) { const c = curioById(id); return c ? CURIO_WONDER[c.rarity] : 0; }

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
    FLOORS: FLOORS, STAFF: STAFF, QUESTS: QUESTS,
    CURIOS: CURIOS, CURIO_WONDER: CURIO_WONDER, CURIO_BIOME: CURIO_BIOME, CURIO_RATE: CURIO_RATE,
    curioById: curioById, curioWonder: curioWonder,
    VIP_TIP: VIP_TIP, TRASH_CAP: TRASH_CAP, TRASH_PENALTY: TRASH_PENALTY,
    ENERGY_REGEN_MS: ENERGY_REGEN_MS, ENERGY_REFILL_GEM_COST: ENERGY_REFILL_GEM_COST,
    scaledCost: scaledCost, weightedKey: weightedKey, shapeCells: shapeCells,
    fossilById: fossilById, oreById: oreById, siteById: siteById, catalogById: catalogById,
  };
})();
