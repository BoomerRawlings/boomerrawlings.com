/* Local visual entry only. Production must authenticate on the server before delivering protected assets. */
(() => {
  'use strict';
  const screen = document.getElementById('entry-screen');
  const form = document.getElementById('entry-form');
  const input = document.getElementById('entry-input');
  const copy = document.getElementById('entry-copy');
  const sequence = document.getElementById('entry-sequence');
  const workspace = document.getElementById('research-workspace');
  const feedback = document.getElementById('entry-feedback');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let phase = 'idle';
  let rawValue = '';
  let composing = false;
  let opened = false;
  let completion;

  const animate = (node, frames, options) => {
    const animation = node.animate(frames, {fill:'forwards', ...options});
    animations.add(animation);
    if (options.fill === 'none') animation.addEventListener('finish', () => animations.delete(animation), {once:true});
    return animation;
  };
  const wait = (duration) => new Promise(resolve => {
    const timeout = setTimeout(resolve, duration);
    completion.signal.addEventListener('abort', () => { clearTimeout(timeout); resolve(); }, {once:true});
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

  async function play() {
    phase = 'printing';
    completion = new AbortController();
    screen.dataset.phase = phase;
    input.readOnly = true;
    input.blur();
    feedback.textContent = 'Low Exposure Operator.';
    document.dispatchEvent(new Event('ead:open'));
    if (reducedMotion.matches) { finish(); return; }

    sequence.hidden = false;
    const field = input.getBoundingClientRect();
    const stage = sequence.getBoundingClientRect();
    const initial = sequence.querySelector('.entry-initial').getBoundingClientRect();
    const x = field.left + field.width / 2 - stage.width / 2;
    const y = field.top + field.height / 2 - initial.height / 2;
    animate(sequence, [{transform:`translate(${x}px, ${y}px)`}], {duration:1});
    await wait(240);
    if (opened) return;
    const prints = [];
    sequence.querySelectorAll('.entry-column').forEach((column, columnIndex) => {
      column.querySelectorAll('.entry-tail > span').forEach((letter, row) => {
        prints.push(animate(letter, [
          {opacity:0, transform:'translateY(-6px)'},
          {opacity:1, transform:'translateY(0)'}
        ], {duration:170, delay:row*125+columnIndex*35, easing:'cubic-bezier(.2,.7,.2,1)'}).finished);
      });
    });
    await Promise.all(prints);
    if (opened) return;
    phase = 'expanded'; screen.dataset.phase = phase;
    await wait(680);
    if (opened) return;
    await animate(copy, [{opacity:1}, {opacity:0}], {duration:340, easing:'ease-out'}).finished;
    await wait(160);
    if (opened) return;
    phase = 'collapsing'; screen.dataset.phase = phase;
    const collapses = [];
    sequence.querySelectorAll('.entry-column').forEach(column => {
      const letters = [...column.querySelectorAll('.entry-tail > span')];
      letters.forEach((letter,row) => {
        const lineHeight = letter.getBoundingClientRect().height;
        collapses.push(animate(letter, [
          {opacity:1,transform:'translateY(0)'},
          {opacity:0,transform:`translateY(${-lineHeight*(row+1)}px)`}
        ], {duration:390, delay:(letters.length-row-1)*28, easing:'cubic-bezier(.7,0,.3,1)'}).finished);
      });
    });
    await Promise.all(collapses);
    await wait(240);
    if (opened) return;
    phase = 'docking'; screen.dataset.phase = phase;
    workspace.hidden = false;
    document.body.classList.add('entry-docking');
    const targets = [...document.querySelectorAll('#leo-dock > span')];
    const flights = [...sequence.querySelectorAll('.entry-initial')].map((letter,index) => {
      const from = letter.getBoundingClientRect();
      const to = targets[index].getBoundingClientRect();
      const scale = to.height / from.height;
      const dx = to.left + to.width/2 - (from.left + from.width/2);
      const dy = to.top + to.height/2 - (from.top + from.height/2);
      return animate(letter, [
        {transform:'translate(0,0) scale(1)',color:'#e4f2ee'},
        {transform:`translate(${dx}px, ${dy}px) scale(${scale})`,color:'#c5e8df'}
      ], {duration:1000,easing:'cubic-bezier(.76,0,.18,1)'}).finished;
    });
    await Promise.all(flights);
    if (opened) return;
    document.body.classList.add('entry-revealing');
    await animate(workspace, [{opacity:0},{opacity:1}], {duration:500,easing:'ease-out'}).finished;
    finish();
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
      if (!reducedMotion.matches) animate(form,[{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:220,fill:'none'});
      return;
    }
    play().catch(() => { if (!opened) finish(); });
  });
  // Interrupted motion must never strand the reader behind an invisible entry screen.
  document.addEventListener('visibilitychange', () => { if (document.hidden && phase !== 'idle' && !opened) finish(); });
  addEventListener('resize', () => { if (phase !== 'idle' && !opened) finish(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && phase !== 'idle' && !opened) finish(); });
  if (matchMedia('(pointer:fine)').matches) input.focus({preventScroll:true});
})();
