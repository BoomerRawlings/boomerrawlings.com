/* Visual entry and deferred loading for an unlisted public research page. */
(() => {
  'use strict';
  const screen = document.getElementById('entry-screen');
  const form = document.getElementById('entry-form');
  const input = document.getElementById('entry-input');
  const copy = document.getElementById('entry-copy');
  const sequence = document.getElementById('entry-sequence');
  const workspace = document.getElementById('research-workspace');
  const feedback = document.getElementById('entry-feedback');
  const retry = document.getElementById('entry-retry');
  const lion = document.getElementById('entry-lion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let phase = 'idle';
  let rawValue = '';
  let composing = false;
  let opened = false;
  let revealed = false;
  let completion, returnAnimation;
  let loaded = false;
  let cycle = 0;

  const animate = (node, frames, options) => {
    const animation = node.animate(frames, {fill:'forwards', ...options});
    animations.add(animation);
    if (options.fill === 'none') animation.addEventListener('finish', () => animations.delete(animation), {once:true});
    return animation;
  };
  const wait = (duration) => new Promise(resolve => {
    const signal = completion.signal;
    const done = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timeout = setTimeout(done, duration);
    signal.addEventListener('abort', done, {once:true});
  });
  const update = (raw = input.value) => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    rawValue = raw.toUpperCase();
    input.value = rawValue;
    if (start !== null && end !== null) input.setSelectionRange(start, end);
    form.classList.toggle('has-value', rawValue.length > 0);
    form.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
    feedback.textContent = '';
  };
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; update(); });
  input.addEventListener('input', () => { if (!composing && phase === 'idle') update(); });
  const insertText = (event, text) => {
    event.preventDefault();
    if (phase !== 'idle') return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const proposed = input.value.slice(0,start) + text + input.value.slice(end);
    update(proposed); // Preserve raw line breaks for comparison even if the one-line input cannot render them.
    input.setSelectionRange(start + text.length, start + text.length);
  };
  input.addEventListener('paste', event => insertText(event, event.clipboardData?.getData('text') ?? ''));
  input.addEventListener('drop', event => insertText(event, event.dataTransfer?.getData('text') ?? ''));
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && (composing || event.isComposing)) event.preventDefault(); });

  function finish() {
    if (opened) return;
    opened = true;
    phase = 'complete';
    completion?.abort();
    screen.dataset.phase = phase;
    screen.hidden = true;
    workspace.hidden = false;
    workspace.inert = false;
    document.body.classList.remove('entry-pending','entry-docking','entry-revealing');
    animations.forEach(animation => animation.cancel());
    animations.clear();
    document.getElementById('main').focus({preventScroll:true});
  }

  function revealWorkspace() {
    if (revealed || opened) return;
    revealed = true;
    document.body.classList.add('entry-revealing');
    document.dispatchEvent(new Event('ead:reveal'));
  }

  async function returnToEntry() {
    if (phase !== 'complete') return;
    phase = 'returning';
    cycle++;
    completion?.abort();
    completion = undefined;
    workspace.inert = true;
    document.dispatchEvent(new Event('ead:close'));
    document.body.classList.add('entry-returning');
    if (!reducedMotion.matches) {
      const dock = document.getElementById('leo-dock').getBoundingClientRect();
      const bounds = workspace.getBoundingClientRect();
      const origin = `${dock.left + dock.width/2 - bounds.left}px ${dock.top + dock.height/2 - bounds.top}px`;
      returnAnimation = animate(workspace,[
        {clipPath:`circle(150vmax at ${origin})`,opacity:1},
        {clipPath:`circle(0px at ${origin})`,opacity:.35}
      ],{duration:520,easing:'cubic-bezier(.65,0,.3,1)'});
      try { await returnAnimation.finished; } catch { /* A motion preference change completes the reset. */ }
    }
    animations.forEach(animation=>animation.cancel());
    animations.clear();
    returnAnimation = undefined;
    workspace.hidden = true;
    screen.hidden = false;
    delete screen.dataset.phase;
    sequence.hidden = true;
    lion.hidden = true;
    sequence.querySelectorAll('.entry-row').forEach(row=>{
      row.classList.remove('is-typing');
      row.querySelectorAll('.entry-tail > span').forEach(letter=>letter.classList.remove('is-printed'));
    });
    input.readOnly = false;
    retry.hidden = true;
    phase = 'idle';
    opened = false;
    revealed = false;
    composing = false;
    update('');
    document.body.classList.remove('entry-returning','entry-docking','entry-revealing');
    document.body.classList.add('entry-pending');
    document.dispatchEvent(new Event('ead:closed'));
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    input.focus({preventScroll:true});
  }

  async function play() {
    const activeCycle = cycle;
    const interrupted = () => opened || cycle !== activeCycle;
    phase = 'stacking';
    completion = new AbortController();
    screen.dataset.phase = phase;
    input.readOnly = true;
    input.blur();
    feedback.textContent = 'Low Exposure Operator.';
    if (reducedMotion.matches) { finish(); return; }

    sequence.hidden = false;
    const field = input.getBoundingClientRect();
    const stage = sequence.getBoundingClientRect();
    const initials = [...sequence.querySelectorAll('.entry-initial')];
    const rows = [...sequence.querySelectorAll('.entry-row')];
    const original = initials.map(letter => letter.getBoundingClientRect());
    const initial = original[0];
    const x = field.left + field.width / 2 - stage.width / 2;
    const fieldY = field.top + field.height / 2 - initial.height / 2;
    const y = Math.max(24, Math.min(fieldY, document.documentElement.clientHeight - stage.height - 24));
    animate(sequence, [{transform:`translate(${x}px, ${y}px)`}], {duration:0});
    // Reposition the initials quietly; only the text uses terminal-style steps.
    const stacks = initials.map((letter,index) => {
      const fromX = field.left + field.width/2 + (index-1.5)*initial.width - (original[index].left+x);
      const fromY = fieldY - (original[index].top+y);
      return animate(letter, [
        {transform:`translate(${fromX}px, ${fromY}px)`},
        {transform:'translate(0,0)'}
      ], {duration:220, delay:80, easing:'cubic-bezier(.2,.7,.3,1)', fill:'both'}).finished;
    });
    await Promise.all(stacks);
    if (interrupted()) return;
    phase = 'stacked'; screen.dataset.phase = phase;
    await wait(220);
    if (interrupted()) return;
    phase = 'printing'; screen.dataset.phase = phase;
    for (const row of rows) {
      row.classList.add('is-typing');
      for (const letter of row.querySelectorAll('.entry-tail > span')) {
        await wait(70);
        if (interrupted()) return;
        letter.classList.add('is-printed');
      }
      await wait(110);
      if (interrupted()) return;
      row.classList.remove('is-typing');
    }
    if (interrupted()) return;
    phase = 'expanded'; screen.dataset.phase = phase;
    await wait(950);
    if (interrupted()) return;
    animate(copy, [{opacity:0}], {duration:0});
    phase = 'collapsing'; screen.dataset.phase = phase;
    for (const row of [...rows].reverse()) {
      row.classList.add('is-typing');
      const letters = [...row.querySelectorAll('.entry-tail > span')];
      for (const letter of letters.reverse()) {
        await wait(30);
        if (interrupted()) return;
        letter.classList.remove('is-printed');
      }
      await wait(55);
      if (interrupted()) return;
      row.classList.remove('is-typing');
    }
    await wait(180);
    if (interrupted()) return;
    phase = 'regrouping'; screen.dataset.phase = phase;
    const grouped = initials.map((letter,index) => {
      const from = letter.getBoundingClientRect();
      return {
        x:field.left + field.width/2 + (index-1.5)*initial.width - from.left,
        y:y + stage.height/2 - initial.height/2 - from.top
      };
    });
    await Promise.all(initials.map((letter,index) => animate(letter, [
      {transform:'translate(0,0)'},
      {transform:`translate(${grouped[index].x}px, ${grouped[index].y}px)`}
    ], {duration:200,easing:'cubic-bezier(.2,.7,.3,1)'}).finished));
    await wait(140);
    if (interrupted()) return;
    phase = 'docking'; screen.dataset.phase = phase;
    workspace.hidden = false;
    document.body.classList.add('entry-docking');
    const targets = [...document.querySelectorAll('#leo-dock > span')];
    const flights = initials.map((letter,index) => {
      const from = letter.getBoundingClientRect();
      const to = targets[index].getBoundingClientRect();
      const scale = to.height / from.height;
      const dx = to.left + to.width/2 - (from.left + from.width/2);
      const dy = to.top + to.height/2 - (from.top + from.height/2);
      return animate(letter, [
        {transform:`translate(${grouped[index].x}px, ${grouped[index].y}px) scale(1)`},
        {transform:`translate(${grouped[index].x+dx}px, ${grouped[index].y+dy}px) scale(${scale})`}
      ], {duration:440,easing:'cubic-bezier(.65,0,.25,1)'}).finished;
    });
    await Promise.all(flights);
    if (interrupted()) return;
    const dock = document.getElementById('leo-dock').getBoundingClientRect();
    const destination = document.getElementById('oracle-lion').getBoundingClientRect();
    lion.hidden = false;
    const mark = lion.getBoundingClientRect();
    const originX = dock.left + dock.width + 12;
    const originY = dock.top + dock.height/2 - mark.height/2;
    const targetX = destination.left;
    const targetY = destination.top;
    phase = 'lion-travel'; screen.dataset.phase = phase;
    await animate(lion, [
      {transform:`translate(${originX}px, ${originY}px)`,opacity:0},
      {transform:`translate(${originX+18}px, ${originY}px)`,opacity:1,offset:.18},
      {transform:`translate(${targetX}px, ${targetY}px)`,opacity:1}
    ], {duration:650,easing:'cubic-bezier(.2,.65,.3,1)'}).finished;
    if (interrupted()) return;
    phase = 'lion-pulse'; screen.dataset.phase = phase;
    const pulse = animate(lion, [
      {transform:`translate(${targetX}px, ${targetY}px) scale(1)`,opacity:.56},
      {transform:`translate(${targetX}px, ${targetY}px) scale(1.08)`,opacity:.8,offset:.5},
      {transform:`translate(${targetX}px, ${targetY}px) scale(1)`,opacity:.56}
    ], {duration:680,easing:'ease-in-out'});
    await wait(340);
    if (interrupted()) return;
    revealWorkspace();
    await pulse.finished;
    if (interrupted()) return;
    await wait(100);
    finish();
  }

  async function begin() {
    const activeCycle = ++cycle;
    phase = 'loading'; screen.dataset.phase = phase;
    input.readOnly = true;
    feedback.textContent = 'Loading research…';
    try {
      if (!loaded) { await loadLEOWorkspace(); loaded = true; }
    } catch {
      phase = 'error'; screen.dataset.phase = phase;
      feedback.textContent = 'Could not load research. Reload to retry.';
      retry.hidden = false;
      retry.focus();
      return;
    }
    play().catch(() => { if (!opened && cycle === activeCycle) finish(); });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (phase !== 'idle' || composing) return;
    if (rawValue !== 'LEO' || input.value !== 'LEO') {
      form.classList.add('invalid');
      input.setAttribute('aria-invalid','true');
      feedback.textContent = 'Not recognized. Try again.';
      input.focus();
      input.select();
      if (!reducedMotion.matches) animate(form,[{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180,easing:'steps(1,end)',fill:'none'});
      return;
    }
    begin();
  });
  retry.addEventListener('click', () => location.reload());
  document.addEventListener('ead:close-request',returnToEntry);
  // Interrupted motion must never strand the reader behind an invisible entry screen.
  document.addEventListener('visibilitychange', () => { if (document.hidden && completion && !opened) finish(); });
  addEventListener('resize', () => { if (completion && !opened) finish(); });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    if (phase === 'returning') returnAnimation?.cancel();
    else if (completion && !opened) finish();
  });
  if (matchMedia('(pointer:fine)').matches) input.focus({preventScroll:true});
})();
