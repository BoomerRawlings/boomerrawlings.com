(() => {
  const gate = document.querySelector('#gate');
  const form = document.querySelector('#entry-form');
  const input = document.querySelector('#answer');
  const button = document.querySelector('#entry-submit');
  const feedback = document.querySelector('#feedback');
  const retry = document.querySelector('#entry-retry');
  const reveal = document.querySelector('#gate-reveal');
  const wave = gate.querySelector('.gate-answer-wave path');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const characters = [];
  let busy = false, authenticated = false, shell, appStarted = false, waveFrame;
  const delay = ms => new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : ms));

  // The riddle moves only in response to input. Its text and the answer remain separate.
  for (const line of gate.querySelectorAll('.gate-riddle-line')) {
    const label = line.textContent; line.replaceChildren();
    const accessible = document.createElement('span'); accessible.className = 'gate-sr-only'; accessible.textContent = label; line.append(accessible);
    for (const character of label) {
      const span = document.createElement('span'); span.className = 'gate-riddle-letter'; span.textContent = character; span.setAttribute('aria-hidden', 'true');
      line.append(span); characters.push(span);
    }
  }
  function updateWave() {
    cancelAnimationFrame(waveFrame);
    waveFrame = requestAnimationFrame(() => {
      const length = input.value.length;
      const amplitude = reduced.matches || !length ? 0 : Math.min(3.2, .85 + length * .28);
      characters.forEach((span, index) => {
        const offset = Math.sin(index * .43 - length * .83) * amplitude;
        span.style.setProperty('--letter-y', `${offset.toFixed(2)}px`); span.style.setProperty('--letter-r', `${(offset * .17).toFixed(2)}deg`);
      });
      const bend = reduced.matches ? 0 : Math.sin(length * .9) * Math.min(10, length * 1.9);
      wave.setAttribute('d', `M0 10 C70 ${10 + bend} 120 ${10 - bend} 200 10 S330 ${10 + bend} 400 10`);
    });
  }
  input.addEventListener('input', () => { feedback.textContent = ''; input.removeAttribute('aria-invalid'); updateWave(); });
  reduced.addEventListener('change', updateWave);

  async function timedFetch(url, options = {}, timeout = 15000) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, signal: AbortSignal.timeout(timeout) });
  }
  function revealName(name) {
    reveal.replaceChildren();
    const mark = document.createElement('div'); mark.className = 'gate-reveal-name';
    // This name comes from the authenticated document, never from a public data bundle.
    const words = String(name || 'ASSC').match(/[A-Z][a-z]+|[A-Z]+(?![a-z])|[a-z]+/g) || ['ASSC'];
    const lines = words.length > 3 ? [words[0], words[1], words.slice(2).join(' ')] : words;
    let count = 0;
    for (const word of lines) {
      const line = document.createElement('span'); line.className = 'gate-reveal-line';
      for (const character of word) {
        const span = document.createElement('span'); span.className = 'gate-reveal-letter'; span.textContent = character === ' ' ? '\u00a0' : character;
        span.style.setProperty('--reveal-y', `${(Math.sin(count * .7) * 6).toFixed(2)}px`); span.style.setProperty('--reveal-r', `${(Math.cos(count * .6) * 2).toFixed(2)}deg`);
        line.append(span); count++;
      }
      mark.append(line);
    }
    const subtitle = document.createElement('p'); subtitle.className = 'gate-reveal-subtitle'; subtitle.textContent = 'Follow the thread. Keep the record.';
    const trace = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); trace.setAttribute('class', 'gate-reveal-thread'); trace.setAttribute('viewBox', '0 0 600 35');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M0 20 C100 -3 160 38 260 19 S430 2 600 16'); trace.append(path);
    reveal.append(mark, subtitle, trace);
  }
  async function stylesheet(href) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/ASSC/client/')) throw new Error('The room returned an unexpected stylesheet.');
    if ([...document.styleSheets].some(sheet => sheet.href === url.href)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url.href;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { link.remove(); reject(new Error('The room’s styling took too long to load.')); }, 15000);
      link.onload = () => { clearTimeout(timer); resolve(); };
      link.onerror = () => { clearTimeout(timer); link.remove(); reject(new Error('The room’s styling could not load.')); };
      document.head.append(link);
    });
  }
  async function loadWorkspace() {
    if (shell && appStarted) return;
    const response = await timedFetch('/ASSC/', { headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error('The room could not be opened.');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (!parsed.querySelector('#main') || !parsed.querySelector('#logout') || parsed.querySelector('#entry-form')) {
      authenticated = false; throw new Error('The session ended. Please enter your answer again.');
    }
    revealName(parsed.querySelector('meta[name="assc-name"]')?.content || 'ASSC'); document.body.classList.add('gate-revealed');
    await Promise.all([...parsed.querySelectorAll('link[rel="stylesheet"]')].map(link => stylesheet(link.getAttribute('href'))));
    shell?.remove(); shell = document.createElement('div'); shell.className = 'gate-workspace'; shell.inert = true;
    // Only the authenticated, same-origin authored shell is imported. Scripts load explicitly below.
    parsed.body.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
    for (const child of [...parsed.body.children]) shell.append(document.importNode(child, true));
    document.body.append(shell); document.title = parsed.title || 'ASSC';
    await import('/ASSC/client/app.js'); appStarted = true;
  }
  async function finishOpening() {
    document.body.classList.add('gate-opening'); retry.hidden = true;
    await loadWorkspace(); await delay(1350);
    const target = shell.querySelector('.wordmark')?.getBoundingClientRect(); const mark = reveal.getBoundingClientRect();
    if (target && mark.width) {
      reveal.style.setProperty('--gate-target-x', `${target.left + target.width / 2 - (mark.left + mark.width / 2)}px`);
      reveal.style.setProperty('--gate-target-y', `${target.top + target.height / 2 - (mark.top + mark.height / 2)}px`);
      reveal.style.setProperty('--gate-target-scale', String(Math.min(.28, target.width / mark.width)));
    }
    document.body.classList.add('gate-dissolving'); await delay(1100); shell.inert = false;
    const destination = shell.querySelector('#main'); shell.replaceWith(...shell.childNodes); gate.remove();
    document.querySelector('noscript')?.remove(); document.body.classList.remove('gate-body', 'gate-opening', 'gate-revealed', 'gate-dissolving');
    destination?.focus({ preventScroll: true }); window.dispatchEvent(new Event('resize'));
  }
  function recover(error) {
    document.body.classList.remove('gate-opening', 'gate-revealed', 'gate-dissolving');
    feedback.textContent = ['AbortError', 'TimeoutError'].includes(error.name) ? 'The room took too long to respond. Please try again.' : error.message || 'The room could not be reached. Please try again.';
    if (authenticated) { retry.hidden = false; retry.focus(); } else { retry.hidden = true; input.focus(); input.select(); }
  }
  async function enter(event) {
    event?.preventDefault(); if (busy) return;
    busy = true; button.disabled = true; retry.disabled = true; form.setAttribute('aria-busy', 'true'); feedback.textContent = '';
    try {
      if (!authenticated) {
        const response = await timedFetch('/ASSC/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: input.value }) });
        let result; try { result = await response.json(); } catch { result = {}; }
        if (!response.ok) {
          if (response.status === 401) input.setAttribute('aria-invalid', 'true');
          throw new Error(result.error || (response.status === 429 ? 'A few too many guesses. Please pause before trying again.' : 'That is not the answer. Try again.'));
        }
        authenticated = true; input.value = ''; updateWave();
      }
      await finishOpening();
    } catch (error) { recover(error); }
    finally { busy = false; button.disabled = false; retry.disabled = false; form.removeAttribute('aria-busy'); }
  }
  form.addEventListener('submit', enter);
  retry.addEventListener('click', () => { if (authenticated) location.replace('/ASSC/'); else enter(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
