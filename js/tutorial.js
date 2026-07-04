// ---------------------------------------------------------------------------
// Interactive tutorial narrated by "Doc", the Jurassic-guy mascot. Each step
// shows a speech bubble and highlights a UI target; it advances automatically
// when the player performs the action (or via the Next button). Non-blocking.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // highlight: a key resolved to a screen rect by the renderer (or null).
  // advance: the emit() event type that completes the step (or null = manual).
  const STEPS = [
    { text: "Howdy, curator! I'm Doc. Let's dig up your first fossil - tap the DIG SITE tab down below!", highlight: 'tabDig', advance: 'tabDig' },
    { text: "The numbers show how many treasures are buried nearby. Tap a tile to SURVEY it for clues.", highlight: 'board', advance: 'survey' },
    { text: "Once you've sniffed one out, flip to EXCAVATE mode and send a dig team to pull it out clean!", highlight: 'digMode', advance: 'extract' },
    { text: "That fossil block went to your STORAGE. Tap the STORAGE tab to go pack it.", highlight: 'tabStorage', advance: 'tabStorage' },
    { text: "Drop the block into the grid. Fill a whole row or column and it clears - banking the fossil!", highlight: 'board', advance: 'clearLine' },
    { text: "Bank enough of one dino, then open MUSEUM and hit FOSSILS to MOUNT its skeleton.", highlight: 'tabMuseum', advance: 'mount' },
    { text: "Exhibits pull in crowds and coins - even while you're away! Keep an eye on litter, hire staff, and check your QUESTS. Happy digging!", highlight: 'quests', advance: null },
  ];

  function state() { return window.GameState.get().tutorial; }
  function active() { const t = state(); return t && !t.done && t.step < STEPS.length; }
  function current() { return active() ? STEPS[state().step] : null; }
  function stepIndex() { return state().step; }
  function total() { return STEPS.length; }

  function advanceTo(n) {
    const t = state();
    t.step = n;
    if (t.step >= STEPS.length) { t.step = STEPS.length; t.done = true; }
    window.GameState.saveSoon();
  }
  function next() { if (active()) advanceTo(state().step + 1); }
  function skip() { const t = state(); t.done = true; window.GameState.saveSoon(); }
  function begin() { const t = state(); t.step = 0; t.done = false; window.GameState.saveSoon(); }

  function emit(type) {
    const c = current();
    if (c && c.advance === type) next();
  }

  window.Tutorial = { STEPS: STEPS, active: active, current: current, stepIndex: stepIndex, total: total, next: next, skip: skip, begin: begin, emit: emit };
})();
