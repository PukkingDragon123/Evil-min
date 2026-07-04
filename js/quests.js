// ---------------------------------------------------------------------------
// Quest system. Objectives progress via gameplay events; completing one grants
// coins/gems/XP. emit(type, value) is the single entry point called by main.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const D = window.GameData;

  function st() { return window.GameState.get(); }
  function prog(id) { return st().quests.progress[id] || 0; }
  function isDone(id) { return !!st().quests.done[id]; }

  function grant(reward) {
    const S = window.GameState;
    if (reward.coins) S.addCoins(reward.coins);
    if (reward.gems) S.addGems(reward.gems);
    if (reward.xp) S.addXp(reward.xp);
  }

  function complete(q) {
    const s = st();
    s.quests.done[q.id] = true;
    grant(q.reward);
    window.GameState.saveSoon();
    const C = window.Assets.C;
    const parts = [];
    if (q.reward.coins) parts.push(q.reward.coins + 'c');
    if (q.reward.gems) parts.push(q.reward.gems + ' gem' + (q.reward.gems > 1 ? 's' : ''));
    if (q.reward.xp) parts.push(q.reward.xp + ' xp');
    if (window.UI) window.UI.toast('Quest done: ' + q.desc + '  (+' + parts.join(' +') + ')', C.gold, window.Assets.icons.gem);
    if (window.Audio2) window.Audio2.play('levelup');
    if (window.FX) window.FX.confetti(window.Render.VW / 2, window.Render.HUD_H + 24, 28);
  }

  // Single dispatch: count-mode adds `value` (default 1); reach-mode takes max.
  function emit(type, value) {
    const s = st();
    for (let i = 0; i < D.QUESTS.length; i++) {
      const q = D.QUESTS[i];
      if (q.type !== type || isDone(q.id)) continue;
      if (q.mode === 'reach') {
        s.quests.progress[q.id] = Math.max(prog(q.id), value || 0);
      } else {
        s.quests.progress[q.id] = prog(q.id) + (value == null ? 1 : value);
      }
      if (prog(q.id) >= q.target) complete(q);
    }
  }

  // For UI: incomplete first (in definition order), then completed.
  function list() {
    const active = [], done = [];
    for (let i = 0; i < D.QUESTS.length; i++) {
      const q = D.QUESTS[i];
      const entry = { def: q, progress: Math.min(prog(q.id), q.target), done: isDone(q.id) };
      (entry.done ? done : active).push(entry);
    }
    return active.concat(done);
  }
  function activeCount() { let n = 0; for (let i = 0; i < D.QUESTS.length; i++) if (!isDone(D.QUESTS[i].id)) n++; return n; }
  function doneCount() { let n = 0; for (let i = 0; i < D.QUESTS.length; i++) if (isDone(D.QUESTS[i].id)) n++; return n; }
  // The next unfinished quest (for a compact HUD hint).
  function next() { for (let i = 0; i < D.QUESTS.length; i++) if (!isDone(D.QUESTS[i].id)) return { def: D.QUESTS[i], progress: Math.min(prog(D.QUESTS[i].id), D.QUESTS[i].target) }; return null; }

  window.Quests = { emit: emit, list: list, activeCount: activeCount, doneCount: doneCount, next: next, prog: prog, isDone: isDone };
})();
