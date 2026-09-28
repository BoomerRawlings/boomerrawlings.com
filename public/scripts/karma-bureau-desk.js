(() => {
  'use strict';
  const root = document.querySelector('[data-bureau-root]');
  if (!root || root.dataset.bureauReady) return;
  root.dataset.bureauReady = 'true';
  const division = root.dataset.division === 'feline' ? 'feline' : 'human';
  const score = Number(root.dataset.score);
  const $ = id => root.querySelector(`#bureau-${id}`);
  const engine = () => window.BoomerKarmaBureau;
  const empty = {counts: {requests: 0, checks: 0, appeals: 0, simulations: 0, petitions: 0}, tier: 0, flags: [], storageAvailable: false};
  const snapshot = () => engine()?.snapshot(division) || empty;
  const tiers = ['Routine oversight', 'Additional oversight', 'Committee involvement', 'A task force exists', 'Entire wing of the bureau'];
  const actionFindings = {
    library: 'Literary proximity reviewed. Additional shelves do not produce compound osmosis. The original library moment remains the original library moment.',
    wind: 'Wind direction remains outside the bureau’s jurisdiction. A favorable forecast cannot be redeemed at the points counter.',
    gooddeed: 'Good deed referred to the Department of Nice Things That Can Just Be Nice Things. They do not operate a rewards program.',
    spreadsheet: 'Spreadsheet detected. An additional column labeled “be normal” has been recommended. Its values are deliberately nonnumeric.',
    posture: 'Sofa posture is already comfortably represented. Further reclining changes the angle of the cat, not the value of the file.',
    bowtie: 'Accessory stacking denied under Kemberton v. The Second Bow Tie. The bureau admires the ambition and worries about the neck.',
    sweater: 'Knitwear portfolio accepted as a concept. Several pictures of one sweater do not constitute several sweaters.',
    biting: 'A proposed reduction in biting has been forwarded to the teeth. The teeth have declined to commit to a timeline.',
  };
  const effortFindings = {
    casual: 'Effort multiplier: 1.0. Suspiciously reasonable. Multiplying zero forecast points by one has produced a robust result.',
    committed: 'Effort multiplier: pending. Color coding improves the presentation of the strategy without improving its exchange rate.',
    extreme: 'Consultant review complete. Their invoice may be real; their ability to influence Boomer remains speculative.',
  };
  const motiveFindings = {
    connection: 'Connection objective noted. The bureau recommends enjoying the connection before establishing quarterly performance indicators.',
    curiosity: 'Academic exemption denied. Saying “for research” does not make a points strategy peer reviewed.',
    maximum: 'Optimization objective declared. The maximum score is not published, largely because the bureau has never agreed that there is one.',
  };
  function render() {
    const state = snapshot();
    root.querySelectorAll('[data-bureau-count]').forEach(node => {
      node.textContent = String(state.counts[node.dataset.bureauCount] || 0);
    });
    $('tier').textContent = tiers[Math.max(0, Math.min(4, state.tier || 0))];
    if (state.title) $('title').textContent = state.title;
    if (state.notice) $('notice').textContent = state.notice;
    $('pattern').textContent = state.flags?.length
      ? `Procedural observations: ${state.flags.join(' · ')}`
      : 'Pattern analysis: insufficient overthinking. This is not a challenge.';
    $('normal-ruling').textContent = state.tier >= 3
      ? 'The bureau has convened a committee to determine whether the committee is making this a bigger deal. So far, yes.'
      : 'Opening this department is entirely normal. Counting how often you open it would be weird. We have a different department for that.';
    $('storage').hidden = state.storageAvailable !== false;
    $('storage').textContent = 'Browser storage is unavailable. The bureau can remember this visit only, an unexpectedly merciful retention policy.';
  }
  render();
  engine()?.subscribe(render);

  $('simulator').addEventListener('submit', event => {
    event.preventDefault();
    const action = $('action').value;
    const effort = $('effort').value;
    const motive = $('motive').value;
    if (!actionFindings[action] || !effortFindings[effort] || !motiveFindings[motive]) return;
    engine()?.record('simulation', division);
    engine()?.inspect(motive === 'maximum' ? 'maximize optimize min max score' : action === 'spreadsheet' ? 'points spreadsheet strategy' : '', 0, division);
    const runs = snapshot().counts.simulations || 1;
    const verdicts = [
      'The model has confidently projected the score you already have.',
      'Independent recalculation has independently produced the same number.',
      'The bureau notices you are checking whether the joke has a loophole.',
      'Your forecast now requires a forecast of why you keep forecasting.',
      'A senior analyst has been assigned. The analyst is Boomer wearing a different imaginary hat.',
    ];
    $('projected-score').textContent = '+0';
    $('model-verdict').textContent = verdicts[Math.min(verdicts.length - 1, runs - 1)];
    const reasons = [actionFindings[action], effortFindings[effort], motiveFindings[motive],
      runs >= 3 ? `Simulation ${runs}: the diminishing returns department reports that returns began at zero and have impressively remained there.`
        : 'Final adjustment: +0. Simulations describe a possible future; only Boomer can enter an actual point in the ledger.'];
    $('model-reasons').replaceChildren(...reasons.map(text => {
      const item = document.createElement('li'); item.textContent = text; return item;
    }));
    $('forecast').hidden = false;
    render();
  });

  const reviews = [
    ['The Department of Review', 'We reviewed the process and determined that it is a process. You may request a review of that determination.'],
    ['The Review Review Committee', 'The original review was reviewed. Its greatest weakness was insufficient reviewers. We have addressed this by adding a committee.'],
    ['The Independent Review Review Review Panel', 'We are independent of the first committee in the sense that our heading is different. All correspondence still goes to Boomer.'],
    ['The Office of Procedural Recursion', 'A review of this review would require establishing which review “this review” refers to. Please hold that thought while we form a glossary.'],
    ['Boomer, but in a swivel chair', 'You have reached the highest available authority. He has rotated 360 degrees and arrived at the same position. Further departments would be a furniture expense.'],
  ];
  let reviewDepth = 0;
  function renderReview() {
    $('review-level').textContent = `Review depth ${reviewDepth} of 4`;
    $('review-title').textContent = reviews[reviewDepth][0];
    $('review-copy').textContent = reviews[reviewDepth][1];
    $('review-deeper').hidden = reviewDepth === 4;
    $('review-start').hidden = reviewDepth === 0;
    if (reviewDepth === 4) $('review-start').focus();
  }
  $('review-deeper').addEventListener('click', () => { reviewDepth = Math.min(4, reviewDepth + 1); renderReview(); });
  $('review-start').addEventListener('click', () => { reviewDepth = 0; renderReview(); $('review-deeper').focus(); });

  const dialog = $('petition-dialog');
  const form = $('petition-form');
  const send = $('petition-send');
  let sending = false;
  let cachedPetition = null;
  const words = () => $('petition-message').value.trim().split(/\s+/).filter(Boolean).length;
  const countWords = () => { $('petition-word-count').textContent = `${words()} / 12 minimum words`; };
  function error(message, target) {
    $('petition-error').textContent = message;
    $('petition-error').hidden = false;
    target?.focus();
  }
  $('petition-message').addEventListener('input', countWords);
  $('petition-open').addEventListener('click', () => {
    $('petition-error').hidden = true;
    dialog.showModal();
    $('petition-reason').focus();
  });
  $('petition-close').addEventListener('click', () => { if (!sending) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (sending) event.preventDefault(); });
  dialog.addEventListener('close', () => $('petition-open').focus());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    const reason = $('petition-reason').value;
    const message = $('petition-message').value.trim();
    if (!reason) return error('Select the matter that requires additional paperwork.', $('petition-reason'));
    if (words() < 12) return error('The committee requires at least 12 words. Please expand your exquisitely reasonable concern.', $('petition-message'));
    if (message.length > 1200) return error('The bureau can process up to 1,200 characters of concern.', $('petition-message'));
    if (!$('petition-declaration').checked) return error('Please certify your understanding of this paperwork about paperwork.', $('petition-declaration'));
    if (!$('petition-acceptance').checked) return error('Please acknowledge what successful delivery means.', $('petition-acceptance'));
    const fingerprint = JSON.stringify([reason, message, reviewDepth]);
    if (cachedPetition?.fingerprint !== fingerprint) {
      engine()?.inspect(`${reason} ${message}`, 0, division);
      const state = snapshot();
      cachedPetition = {fingerprint, answers: {
        'Submitted message': message,
        'Division': division === 'feline' ? 'Feline division' : 'Human division',
        'Procedural concern': reason,
        'Reviewing authority': reviews[reviewDepth][0],
        'Review depth': `${reviewDepth} of 4`,
        'Current score (unchanged)': String(score),
        'Browser bureau status': state.title || tiers[state.tier || 0],
        'Browser activity at first send': Object.entries(state.counts).map(([name, count]) => `${name}: ${count}`).join('; '),
        'Paperwork declaration': 'Confirmed',
        'Delivery is not a ruling': 'Acknowledged',
      }};
    }
    sending = true;
    $('petition-error').hidden = true;
    send.textContent = 'Delivering your procedural concern…';
    const controls = [...form.querySelectorAll('input, select, textarea, button'), $('petition-close')];
    controls.forEach(control => { control.disabled = true; });
    try {
      const delivered = await window.BoomerKarmaDelivery?.send('bureau-petition', cachedPetition.answers);
      if (delivered !== true) throw new Error('Delivery not confirmed');
      form.reset();
      cachedPetition = null;
      countWords();
      dialog.close();
      $('petition-status').textContent = 'Petition delivered to Boomer. The score remains serenely unchanged. Your paperwork is now about paperwork that has actually been sent.';
      render();
    } catch (_) {
      error('Delivery was not confirmed. Your answers are still here. Try Send again; no further form is required.');
    } finally {
      sending = false;
      controls.forEach(control => { control.disabled = false; });
      send.textContent = 'Send formal petition to Boomer';
      if (dialog.open) send.focus();
    }
  });
  $('reset').addEventListener('click', () => {
    engine()?.reset();
    render();
    $('forecast').hidden = true;
    $('reset-status').textContent = 'Bureau history cleared. Your actual score and issued reports are unchanged. The filing cabinet is pretending this never happened.';
  });
})();
