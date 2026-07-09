// ---------------------------------------------------------------------------
// Persistent upgrade tree. Levels are stored on the save; each upgrade exposes
// a computed effect value consumed across the game (energy, storage, income...).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // Each upgrade: id, name, desc, icon key, max level, cost(level)->{coins,gems},
  // value(level)->effect number, fmt(level)->display string.
  const LIST = [
    {
      id: 'storage', name: 'Storage Grid', icon: 'grid', max: 4,
      desc: 'Expand your field storage grid so bigger fossils fit.',
      cost: function (l) { return { coins: 0, gems: 4 + l * 4 }; },
      value: function (l) { return 6 + l; },          // 6..10
      fmt: function (l) { const s = 6 + l; return s + 'x' + s; },
    },
    {
      id: 'energyMax', name: 'Field Crew', icon: 'pick', max: 6,
      desc: 'Raise maximum energy so you can dig for longer.',
      cost: function (l) { return { coins: 400 + l * 700, gems: 0 }; },
      value: function (l) { return 24 + l * 6; },     // 24..60
      fmt: function (l) { return (24 + l * 6) + ' max'; },
    },
    {
      id: 'energyRegen', name: 'Rested Crew', icon: 'clock', max: 5,
      desc: 'Energy regenerates faster while you are away.',
      cost: function (l) { return { coins: 600 + l * 900, gems: 0 }; },
      value: function (l) { return Math.round(8000 * Math.pow(0.82, l)); }, // ms per pip
      fmt: function (l) { return (8000 * Math.pow(0.82, l) / 1000).toFixed(1) + 's/pip'; },
    },
    {
      id: 'excavator', name: 'Excavation Team', icon: 'flag', max: 5,
      desc: 'Bigger, better fossil blocks and richer ore strikes.',
      cost: function (l) { return { coins: 800 + l * 1200, gems: 0 }; },
      value: function (l) { return 1 + l * 0.25; },   // reward multiplier
      fmt: function (l) { return 'x' + (1 + l * 0.25).toFixed(2) + ' loot'; },
    },
    {
      id: 'survey', name: 'Survey Kit', icon: 'lens', max: 5,
      desc: 'Chance to rescue a fossil your survey accidentally crushes.',
      cost: function (l) { return { coins: 500 + l * 800, gems: 0 }; },
      value: function (l) { return 0.15 + l * 0.17; },// rescue chance on survey-hit
      fmt: function (l) { return Math.round((0.15 + l * 0.17) * 100) + '% rescue'; },
    },
    {
      id: 'income', name: 'Marketing', icon: 'coin', max: 6,
      desc: 'Every exhibit and facility earns more per second.',
      cost: function (l) { return { coins: 1000 + l * 1600, gems: 0 }; },
      value: function (l) { return 1 + l * 0.2; },
      fmt: function (l) { return 'x' + (1 + l * 0.2).toFixed(1) + ' income'; },
    },
    {
      id: 'offline', name: 'Night Guard', icon: 'moon', max: 5,
      desc: 'Collect idle earnings for a longer time while away.',
      cost: function (l) { return { coins: 700 + l * 1000, gems: 0 }; },
      value: function (l) { return 8 + l * 4; },      // hours cap
      fmt: function (l) { return (8 + l * 4) + 'h cap'; },
    },
    {
      id: 'queue', name: 'Crate Truck', icon: 'crate', max: 4,
      desc: 'Hold more un-packed fossil blocks in the field queue.',
      cost: function (l) { return { coins: 0, gems: 3 + l * 3 }; },
      value: function (l) { return 4 + l * 2; },      // queue capacity
      fmt: function (l) { return (4 + l * 2) + ' slots'; },
    },
  ];

  function byId(id) { return LIST.find(function (u) { return u.id === id; }); }

  function level(id) {
    const st = window.GameState && window.GameState.get();
    return (st && st.upgrades && st.upgrades[id]) || 0;
  }
  function value(id) {
    const u = byId(id); if (!u) return 0;
    return u.value(level(id));
  }
  function costFor(id) {
    const u = byId(id); if (!u) return null;
    const l = level(id);
    if (l >= u.max) return null;
    return u.cost(l);
  }
  function buy(id) {
    const u = byId(id); if (!u) return false;
    const st = window.GameState.get();
    const l = level(id);
    if (l >= u.max) return false;
    const c = u.cost(l);
    if (!window.GameState.spend(c.coins, c.gems)) return false;
    st.upgrades[id] = l + 1;
    // clamp energy up if max grew
    if (id === 'energyMax') st.energy = Math.min(energyMax(), st.energy + 6);
    window.GameState.saveSoon();
    return true;
  }

  // convenience effect getters
  function energyMax() { return value('energyMax'); }
  function regenMs() { return value('energyRegen'); }
  function storageSize() { return value('storage'); }
  function incomeMult() { return value('income'); }
  function offlineHours() { return value('offline'); }
  function queueCap() { return value('queue'); }
  function excavateMult() { return value('excavator'); }
  function surveyPristine() { return value('survey'); }

  window.Upgrades = {
    LIST: LIST, byId: byId, level: level, value: value, costFor: costFor, buy: buy,
    energyMax: energyMax, regenMs: regenMs, storageSize: storageSize,
    incomeMult: incomeMult, offlineHours: offlineHours, queueCap: queueCap,
    excavateMult: excavateMult, surveyPristine: surveyPristine,
  };
})();
