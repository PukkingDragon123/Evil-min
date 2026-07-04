// ---------------------------------------------------------------------------
// Static game content: fossils, ores, hazards, dig sites, shop catalog.
// Balancing numbers all live here so the game is easy to tune.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // Rarity tiers -> display color + star count.
  const RARITY = {
    common:    { color: '#9badb7', name: 'Common',    stars: 1 },
    uncommon:  { color: '#6abe30', name: 'Uncommon',  stars: 2 },
    rare:      { color: '#5b6ee1', name: 'Rare',      stars: 3 },
    epic:      { color: '#76428a', name: 'Epic',      stars: 4 },
    legendary: { color: '#fbf236', name: 'Legendary', stars: 5 },
  };

  // Every fossil is dug up as 4 buried pieces (skull/body/legs/tail).
  // Assemble all 4 to mount the skeleton as a museum exhibit that earns
  // passive "wonder" (visitor income). `skel` maps to a sprite archetype.
  const FOSSILS = [
    { id: 'compy',    name: 'Compsognathus', skel: 'smallBiped',   rarity: 'common',    value: 40,   income: 1,  site: 'quarry',  blurb: 'A chicken-sized speedster. Every museum starts somewhere.' },
    { id: 'raptor',   name: 'Velociraptor',  skel: 'smallTheropod',rarity: 'uncommon',  value: 120,  income: 3,  site: 'quarry',  blurb: 'Clever girl. A crowd favorite for its wicked claws.' },
    { id: 'stego',    name: 'Stegosaurus',   skel: 'stego',        rarity: 'uncommon',  value: 160,  income: 4,  site: 'quarry',  blurb: 'Plated back and a spiked tail (a thagomizer!).' },
    { id: 'trike',    name: 'Triceratops',   skel: 'trike',        rarity: 'rare',      value: 320,  income: 8,  site: 'badlands',blurb: 'Three horns and a huge bony frill. A true showpiece.' },
    { id: 'anky',     name: 'Ankylosaurus',  skel: 'anky',         rarity: 'rare',      value: 300,  income: 7,  site: 'badlands',blurb: 'A living tank with a club-tail. Kids adore it.' },
    { id: 'ptero',    name: 'Pteranodon',    skel: 'flyer',        rarity: 'rare',      value: 360,  income: 9,  site: 'badlands',blurb: 'A soaring reptile suspended above the gallery.' },
    { id: 'bronto',   name: 'Brontosaurus',  skel: 'longneck',     rarity: 'epic',      value: 780,  income: 18, site: 'canyon',  blurb: 'Thunder lizard. Its neck nearly touches the skylight.' },
    { id: 'rex',      name: 'Tyrannosaurus', skel: 'bigTheropod',  rarity: 'legendary', value: 2000, income: 45, site: 'canyon',  blurb: 'The king. The centerpiece every curator dreams of.' },
  ];

  // Ores are single-tile finds; sell for coins or gems. No assembly.
  const ORES = [
    { id: 'copper', name: 'Copper Nugget', sprite: 'copper', rarity: 'common',   coins: 20,  gems: 0 },
    { id: 'amber',  name: 'Amber',         sprite: 'amber',  rarity: 'uncommon', coins: 55,  gems: 0, blurb: 'Sometimes an insect is trapped inside!' },
    { id: 'silver', name: 'Silver Vein',   sprite: 'silver', rarity: 'uncommon', coins: 70,  gems: 0 },
    { id: 'gold',   name: 'Gold Nugget',   sprite: 'gold',   rarity: 'rare',     coins: 180, gems: 1 },
    { id: 'prism',  name: 'Prism Crystal', sprite: 'prism',  rarity: 'epic',     coins: 300, gems: 3, blurb: 'A rare gem that fuels premium expansions.' },
  ];

  // Dig sites: each is a minesweeper board. Unlock by cost. `loot` is a
  // weighted table of what a "treasure" cell can contain. `hazardRate` /
  // `oreRate` tune the board. `piecePool` = which fossil pieces spawn here.
  const SITES = [
    {
      id: 'quarry', name: 'Old Quarry', cost: 0, unlocked: true,
      cols: 8, rows: 8, hazards: 8, energy: 12,
      desc: 'A gentle starter dig. Compys, raptors, stegos and copper.',
      loot: [
        { type: 'piece', pool: ['compy', 'raptor', 'stego'], weight: 42 },
        { type: 'ore', pool: ['copper', 'amber'], weight: 30 },
        { type: 'coins', min: 10, max: 30, weight: 20 },
        { type: 'gem', amount: 1, weight: 8 },
      ],
    },
    {
      id: 'badlands', name: 'Sunbaked Badlands', cost: 1200, unlocked: false,
      cols: 10, rows: 9, hazards: 14, energy: 16,
      desc: 'Cracked earth hiding trikes, ankys, pteranodons and silver.',
      loot: [
        { type: 'piece', pool: ['raptor', 'stego', 'trike', 'anky', 'ptero'], weight: 40 },
        { type: 'ore', pool: ['amber', 'silver', 'gold'], weight: 30 },
        { type: 'coins', min: 30, max: 70, weight: 20 },
        { type: 'gem', amount: 1, weight: 10 },
      ],
    },
    {
      id: 'canyon', name: 'Thunder Canyon', cost: 9000, unlocked: false,
      cols: 12, rows: 10, hazards: 22, energy: 20,
      desc: 'Deep strata guarding brontos, the mighty Rex, and prism crystals.',
      loot: [
        { type: 'piece', pool: ['trike', 'anky', 'ptero', 'bronto', 'rex'], weight: 38 },
        { type: 'ore', pool: ['gold', 'silver', 'prism'], weight: 30 },
        { type: 'coins', min: 60, max: 140, weight: 20 },
        { type: 'gem', amount: 2, weight: 12 },
      ],
    },
  ];

  // Shop catalog: things you place in the museum. Decorations add a small
  // flat "wonder" bonus; facilities boost visitor satisfaction & spending.
  // Footprint is in museum grid cells (w x h). anchor drawn bottom-center.
  const CATALOG = [
    { id: 'plant',    name: 'Fern Planter',   kind: 'deco',     cost: 60,   gems: 0, w: 1, h: 1, wonder: 2,  sprite: 'plant',    desc: 'A leafy touch of the Mesozoic.' },
    { id: 'bench',    name: 'Visitor Bench',  kind: 'deco',     cost: 90,   gems: 0, w: 1, h: 1, wonder: 1,  comfort: 3, sprite: 'bench', desc: 'Tired guests stay longer and spend more.' },
    { id: 'sign',     name: 'Info Placard',   kind: 'deco',     cost: 45,   gems: 0, w: 1, h: 1, wonder: 2,  sprite: 'sign',     desc: 'Educational! Nudges up the wonder rating.' },
    { id: 'statue',   name: 'Ammonite Statue',kind: 'deco',     cost: 260,  gems: 0, w: 1, h: 1, wonder: 8,  sprite: 'statue',   desc: 'A polished centerpiece guests photograph.' },
    { id: 'fountain', name: 'Fossil Fountain', kind: 'deco',    cost: 700,  gems: 1, w: 2, h: 2, wonder: 20, comfort: 6, sprite: 'fountain', anim: true, desc: 'A grand water feature. Big wonder boost.' },
    { id: 'giftShop', name: 'Gift Shop',      kind: 'facility', cost: 500,  gems: 0, w: 2, h: 2, income: 6,  sprite: 'giftShop', desc: 'Sells replica bones. Steady extra coins.' },
    { id: 'snackBar', name: 'Snack Bar',      kind: 'facility', cost: 850,  gems: 0, w: 2, h: 2, income: 10, comfort: 8, sprite: 'snackBar', desc: 'Fed visitors are happy visitors.' },
    { id: 'restroom', name: 'Restroom',       kind: 'facility', cost: 400,  gems: 0, w: 2, h: 2, comfort: 12, sprite: 'restroom', desc: 'A must-have. Keeps satisfaction high.' },
  ];

  // Energy regen: 1 pip per this many ms. Gems can refill instantly.
  const ENERGY_REGEN_MS = 9000;
  const ENERGY_MAX = 24;
  const ENERGY_REFILL_GEM_COST = 2;

  // Cost curve for buying multiple copies of the same catalog item.
  function scaledCost(base, owned) {
    return Math.round(base * Math.pow(1.18, owned));
  }

  function fossilById(id) { return FOSSILS.find(function (f) { return f.id === id; }); }
  function oreById(id) { return ORES.find(function (o) { return o.id === id; }); }
  function siteById(id) { return SITES.find(function (s) { return s.id === id; }); }
  function catalogById(id) { return CATALOG.find(function (c) { return c.id === id; }); }

  const PIECES = ['skull', 'body', 'legs', 'tail'];
  const PIECE_NAMES = { skull: 'Skull', body: 'Ribcage', legs: 'Legs', tail: 'Tail' };

  window.GameData = {
    RARITY: RARITY,
    FOSSILS: FOSSILS,
    ORES: ORES,
    SITES: SITES,
    CATALOG: CATALOG,
    PIECES: PIECES,
    PIECE_NAMES: PIECE_NAMES,
    ENERGY_REGEN_MS: ENERGY_REGEN_MS,
    ENERGY_MAX: ENERGY_MAX,
    ENERGY_REFILL_GEM_COST: ENERGY_REFILL_GEM_COST,
    scaledCost: scaledCost,
    fossilById: fossilById,
    oreById: oreById,
    siteById: siteById,
    catalogById: catalogById,
  };
})();
