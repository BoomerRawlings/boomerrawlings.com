(() => {
  // A browser-local comedy ledger, not a score, identity check, or analytics service.
  // Call record only after an action completes. inspect never retains its inputs.
  const actionFields = {request: 'requests', check: 'checks', appeal: 'appeals', simulation: 'simulations', petition: 'petitions'};
  const divisions = ['human', 'feline'];
  const signalNames = ['Optimization language', 'Point farming', 'Loophole scouting', 'Overachiever declaration', 'Ambitious adjustment'];
  const maxCount = 9999;
  const maxHistory = 40;
  const testMode = !['boomerrawlings.com', 'www.boomerrawlings.com'].includes(location.hostname)
    || new URLSearchParams(location.search).get('test') === '1';
  const key = `boomerkarma-bureau-v1${testMode ? '-test' : ''}`;
  const listeners = new Set();
  let storage;
  let storageAvailable = true;
  const emptyCounts = () => ({requests: 0, checks: 0, appeals: 0, simulations: 0, petitions: 0});
  const emptyState = () => ({version: 1, human: {counts: emptyCounts(), flags: []}, feline: {counts: emptyCounts(), flags: []}, history: []});
  let state = emptyState();

  function divisionName(division) {
    return ['cat', 'kem', 'kemberton', 'feline', 'feline division'].includes(String(division).toLowerCase()) ? 'feline' : 'human';
  }

  function decode(raw) {
    const clean = emptyState();
    try {
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 1) return clean;
      for (const division of divisions) {
        for (const field of Object.values(actionFields)) {
          const value = saved[division]?.counts?.[field];
          clean[division].counts[field] = Number.isFinite(value) ? Math.min(maxCount, Math.max(0, Math.floor(value))) : 0;
        }
        clean[division].flags = signalNames.filter(flag => Array.isArray(saved[division]?.flags) && saved[division].flags.includes(flag));
      }
      if (Array.isArray(saved.history)) {
        clean.history = saved.history.filter(event => event && Object.hasOwn(actionFields, event.action)
          && divisions.includes(event.division) && typeof event.at === 'string'
          && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at)
          && Number.isFinite(Date.parse(event.at)))
          .slice(-maxHistory).map(({action, division, at}) => ({action, division, at}));
      }
    } catch { /* Malformed or old storage starts a clean local file. */ }
    return clean;
  }

  function refresh() {
    if (!storageAvailable) return;
    try { state = decode(storage.getItem(key)); }
    catch { storageAvailable = false; }
  }

  try {
    storage = window.localStorage;
    if (!storage) storageAvailable = false;
    else refresh();
  } catch { storageAvailable = false; }

  function notify() {
    // Subscribers re-read their chosen division; a failed UI callback must not
    // turn a successfully delivered application into a failed submission.
    for (const callback of listeners) {
      try { callback(); } catch { /* The remaining subscribers still update. */ }
    }
  }

  function persist() {
    if (storageAvailable) {
      try { storage.setItem(key, JSON.stringify(state)); }
      catch { storageAvailable = false; }
    }
    notify();
  }

  const titles = {
    human: ['Routine vibes processing', 'Enhanced clipboard attention', 'Optimization desk referral', 'Committee-level overthinking', 'Supreme committee of additional committees'],
    feline: ['Ordinary whisker jurisdiction', 'Additional pawwork requested', 'Treat-yield analysis desk', 'Interdepartmental sofa inquiry', 'Supreme court of cat-related paperwork'],
  };
  const notices = {
    human: [
      'The bureau is currently prepared to be normal about this. Please do not make that difficult.',
      'Your enthusiasm has earned a second clipboard. The second clipboard contains the same information, but diagonally.',
      'The Department of Trying Quite Hard has noticed a pattern. Unfortunately, noticing patterns is also its entire job.',
      'A committee has been formed to determine whether the previous committee was sufficiently unnecessary. Your score remains unimpressed.',
      'Your file now has a file. That file has retained counsel. The counsel is another clipboard. No additional points have been authorized.',
    ],
    feline: [
      'The applicant may continue ordinary sofa operations while his human handles the paperwork.',
      'The bureau has requested an additional pawprint. A pawprint is not legally binding, but neither is most of this.',
      'Possible treat optimization has been referred to the Bowl. The Bowl is empty and has issued a strongly worded silence.',
      'The Sofa, Bow Tie, and Knitwear departments are now in a meeting. Biting has declined to attend on advice of biting.',
      'The applicant has been promoted to a case of national couch significance. His representative has been promoted to more forms.',
    ],
  };

  function snapshot(division = 'human') {
    refresh();
    const name = divisionName(division);
    const {counts, flags: savedFlags} = state[name];
    const flags = [...savedFlags];
    if (counts.requests >= 2) flags.push('Repeat report requests');
    if (counts.checks >= 3) flags.push('Frequent score checks');
    if (counts.appeals >= 2) flags.push('Appeal spiral');
    if (counts.simulations >= 3) flags.push('Simulation enthusiasm');
    if (counts.petitions >= 2) flags.push('Petition proliferation');
    if (divisions.every(value => Object.values(state[value].counts).some(count => count > 0))) flags.push('Household portfolio activity');
    // Only successful local activity and named language signals affect the joke.
    // No timestamp, answer content, real score, or inferred identity affects tiers.
    const pressure = counts.requests * 2 + counts.checks + counts.appeals * 3
      + counts.simulations + counts.petitions * 3 + savedFlags.length * 3;
    const tier = pressure >= 42 ? 4 : pressure >= 22 ? 3 : pressure >= 10 ? 2 : pressure >= 4 || savedFlags.length ? 1 : 0;
    return {
      counts: {...counts}, tier, title: titles[name][tier], notice: notices[name][tier], flags,
      history: state.history.filter(event => event.division === name).map(event => ({...event})),
      storageAvailable,
    };
  }

  function record(action, division = 'human') {
    if (!Object.hasOwn(actionFields, action)) throw new TypeError('Unknown bureau action');
    refresh();
    const name = divisionName(division);
    const field = actionFields[action];
    state[name].counts[field] = Math.min(maxCount, state[name].counts[field] + 1);
    state.history.push({action, division: name, at: new Date().toISOString()});
    state.history = state.history.slice(-maxHistory);
    persist();
    return snapshot(name);
  }

  function inspect(text, points = 0, division = 'human') {
    refresh();
    const name = divisionName(division);
    const input = typeof text === 'string' ? text.slice(0, 16000).normalize('NFKC').replace(/[‐‑–—]/g, '-').toLowerCase() : '';
    const found = [];
    const scoreWords = '\\b(?:score|points?|karma|vibes?)\\b';
    const optimizationWords = '\\b(?:maximi[sz](?:e|es|ed|ing|ation)|boost(?:ing)?|increase|improve|optimi[sz](?:e|es|ed|ing|ation))\\b';
    if (/\bmin[\s-]*max(?:ing|ed|er)?\b/.test(input)
      || new RegExp(`${optimizationWords}.{0,45}${scoreWords}|${scoreWords}.{0,45}${optimizationWords}`).test(input)) found.push('Optimization language');
    if (/\b(?:farm(?:ing)?|grind(?:ing)?|harvest(?:ing)?)\b.{0,30}\b(?:points?|score|karma)\b|\b(?:points?|score|karma)\b.{0,30}\b(?:farm(?:ing)?|grind(?:ing)?|harvest(?:ing)?)\b/.test(input)) found.push('Point farming');
    if (/\bloopholes?\b|\bgame\s+the\s+(?:system|bureau|score)\b|\bexploit(?:ing)?\b.{0,30}\b(?:score|points?|system)\b/.test(input)) found.push('Loophole scouting');
    if (/\bover[\s-]?achiev(?:er|ers|ing)\b/.test(input)) found.push('Overachiever declaration');
    if (typeof points === 'number' && Number.isFinite(points) && points >= 10) found.push('Ambitious adjustment');
    const flags = signalNames.filter(flag => state[name].flags.includes(flag) || found.includes(flag));
    if (flags.length !== state[name].flags.length) {
      state[name].flags = flags;
      persist();
    }
    return snapshot(name);
  }

  function requirements(division = 'human') {
    const name = divisionName(division);
    const {tier} = snapshot(name);
    if (!tier) return [];
    const feline = name === 'feline';
    const notApplicable = 'Not applicable; I am here for the vibes.';
    const reason = {
      id: `${name}-schedule-r`,
      title: feline ? 'Schedule P: representative enthusiasm disclosure' : 'Schedule R: reason for needing another reason',
      prompt: feline ? 'Who is driving this application?' : 'What do you expect an additional inspection to accomplish?',
      options: feline
        ? ['The cat expressly requested more administration.', 'I am projecting ambition onto a sleeping animal.', 'He walked across the keyboard and retained me as counsel.', notApplicable]
        : ['Reassurance, but in an official-looking font.', 'I believed the number might get shy and change.', 'I am conducting a longitudinal study of one number.', notApplicable],
      attestation: feline ? 'I understand that the cat receives the same score whether or not he respects my work.' : 'I understand that requesting documentation of my score does not itself raise my score.',
    };
    const optimization = {
      id: `${name}-exhibit-o`,
      title: feline ? 'Exhibit O: treats-to-paperwork exchange declaration' : 'Exhibit O: suspiciously efficient vibes disclosure',
      prompt: feline ? 'Which alleged growth strategy should the Bowl review?' : 'Please classify your entirely theoretical optimization strategy.',
      options: feline
        ? ['Diversify from bow ties into seasonal knitwear.', 'Reduce biting by reporting it less enthusiastically.', 'Turn the entire sofa into a tax-advantaged nap.', notApplicable]
        : ['Be charming at a sustainable compound rate.', 'Farm library osmosis until the shelves notice.', 'Discover the points exchange rate and immediately regret it.', notApplicable],
      attestation: 'I acknowledge that this disclosure is paperwork, not a promise of points, and that all selections are equally admissible.',
    };
    const committee = {
      id: `${name}-form-c`,
      title: feline ? 'Form C: interdepartmental cat jurisdiction' : 'Form C: committee participation waiver',
      prompt: feline ? 'Which department is best placed to misunderstand this case?' : 'Select the office best qualified to refer this somewhere else.',
      options: feline
        ? ['The Sofa: extensive firsthand knowledge, no vocabulary.', 'Knitwear: supportive but prone to pilling.', 'Biting: a clear conflict of interest.', notApplicable]
        : ['The Department of Explanations Requiring Explanations.', 'The Office of Could This Have Been a Text.', 'The Committee for Reducing Committees, subcommittee four.', notApplicable],
      attestation: 'I consent to the entirely fictional committee reaching the same conclusion with considerably more stationery.',
    };
    const recursion = {
      id: `${name}-appendix-omega`,
      title: 'Appendix Ω: paperwork recursion containment',
      prompt: 'This form has requested a form. Please appoint a responsible adult or equivalent household object.',
      options: ['Myself, regrettably.', feline ? 'The cat, despite a demonstrated conflict of interest.' : 'An imaginary version of me with fewer tabs open.', 'A load-bearing clipboard.', notApplicable],
      attestation: 'I understand that this is the last additional supplement for this request. The bureaucracy has a three-supplement limit and needs to lie down.',
    };
    return tier === 1 ? [reason] : tier === 2 ? [reason, optimization] : [reason, optimization, tier === 4 ? recursion : committee];
  }

  function describe(division = 'human') {
    const name = divisionName(division);
    const value = snapshot(name);
    const count = value.counts;
    return [
      `${name === 'feline' ? 'Feline' : 'Human'} division — ${value.title} (level ${value.tier + 1}/5).`,
      `Prior local activity: ${count.requests} reports, ${count.checks} score checks, ${count.appeals} appeals, ${count.simulations} simulations, ${count.petitions} petitions.`,
      `Playful flags: ${value.flags.length ? value.flags.join('; ') : 'none'}.`,
      `Browser-local comedy only; ${value.storageAvailable ? 'this browser remembers counts and named flags' : 'storage unavailable; counts last only on this page'}. No score change or identity verification.`,
    ].join('\n');
  }

  function reset() {
    state = emptyState();
    try { storage?.removeItem(key); }
    catch { storageAvailable = false; }
    notify();
  }

  window.addEventListener('storage', event => {
    if (!storageAvailable || (event.key !== key && event.key !== null) || (event.storageArea && event.storageArea !== storage)) return;
    state = event.key === null ? emptyState() : decode(event.newValue);
    notify();
  });

  window.BoomerKarmaBureau = Object.freeze({
    snapshot, record, inspect, requirements, describe, reset,
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('A bureau subscriber must be a function');
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  });
})();
