/** Progressive enhancement: native summaries still own keyboard activation. */
export function enhanceDisclosures(root: HTMLElement, onChange: () => void) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  type State = {
    details: HTMLDetailsElement;
    summary: HTMLElement;
    content: HTMLElement;
    desired: boolean;
    motion?: { start: number; height: number; reveal: number; duration: number };
  };
  const states = new Map<HTMLDetailsElement, State>();
  let frame = 0;

  const publish = (state: State) => {
    state.details.dataset.disclosureOpen = String(state.desired);
    state.summary.setAttribute('aria-expanded', String(state.desired));
  };
  const finish = (state: State) => {
    state.motion = undefined;
    state.details.open = state.desired;
    state.details.style.removeProperty('height');
    state.details.style.removeProperty('overflow');
    state.content.style.removeProperty('opacity');
    state.content.style.removeProperty('transform');
    state.content.removeAttribute('inert');
    delete state.details.dataset.disclosureAnimating;
    publish(state);
  };
  const collapsedHeight = (state: State) => {
    const css = getComputedStyle(state.details);
    return state.summary.getBoundingClientRect().height
      + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom)
      + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
  };
  const render = (now: number) => {
    frame = 0;
    // Children first: each parent's natural height includes this frame's child height.
    for (const state of [...states.values()].reverse()) {
      const motion = state.motion;
      if (!motion) continue;
      if (reducedMotion.matches || !state.details.getClientRects().length) {
        finish(state);
        continue;
      }
      const progress = Math.min(1, Math.max(0, (now - motion.start) / motion.duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      state.details.style.height = '';
      const target = state.desired ? state.details.getBoundingClientRect().height : collapsedHeight(state);
      state.details.style.height = `${motion.height + (target - motion.height) * eased}px`;
      const reveal = motion.reveal + ((state.desired ? 1 : 0) - motion.reveal) * eased;
      state.content.style.opacity = String(.5 + reveal * .5);
      state.content.style.transform = `translateY(${(1 - reveal) * -6}px)`;
      if (progress === 1) finish(state);
    }
    if ([...states.values()].some(state => state.motion)) frame = requestAnimationFrame(render);
  };
  const setOpen = (details: HTMLDetailsElement, open: boolean) => {
    const state = states.get(details);
    if (!state) { details.open = open; return; }
    if (state.desired === open) return;
    const height = details.getBoundingClientRect().height;
    const reveal = state.motion ? (parseFloat(state.content.style.opacity) - .5) * 2 : Number(details.open);
    state.desired = open;
    publish(state);
    // Do not strand keyboard focus in content that is about to disappear.
    if (!open && state.content.contains(document.activeElement)) state.summary.focus({ preventScroll: true });
    if (reducedMotion.matches || !details.getClientRects().length) {
      finish(state);
    } else {
      details.open = true; // Keep content rendered until the closing slide completes.
      state.content.toggleAttribute('inert', !open);
      details.dataset.disclosureAnimating = '';
      details.style.height = `${height}px`;
      details.style.overflow = 'hidden';
      state.content.style.opacity = String(.5 + reveal * .5);
      state.content.style.transform = `translateY(${(1 - reveal) * -6}px)`;
      state.motion = { start: performance.now(), height, reveal, duration: open ? 320 : 260 };
      if (!frame) frame = requestAnimationFrame(render);
    }
    onChange();
  };

  root.querySelectorAll<HTMLDetailsElement>('details').forEach(details => {
    const summary = details.firstElementChild;
    const content = summary?.nextElementSibling;
    // Only enhance the known summary + content pattern; other details stay native.
    if (!(summary instanceof HTMLElement) || summary.tagName !== 'SUMMARY' || !(content instanceof HTMLElement) || content.nextElementSibling) return;
    const state: State = { details, summary, content, desired: details.open };
    states.set(details, state);
    details.dataset.disclosureEnhanced = '';
    publish(state);
    summary.addEventListener('click', event => {
      // Nested summaries and real controls must never toggle an ancestor.
      if (event.defaultPrevented || !(event.target instanceof Element)
        || event.target.closest('summary') !== summary
        || event.target.closest('a, button, input, select, textarea')) return;
      event.preventDefault();
      setOpen(details, !state.desired);
    });
    details.addEventListener('toggle', () => {
      // Ignore our temporary native open state during collapse and queued toggles.
      if (state.motion && details.open) return;
      if (details.open !== state.desired) {
        state.desired = details.open;
        finish(state);
        onChange();
      }
    });
  });
  const finishWithin = (container: HTMLElement) => {
    for (const state of [...states.values()].reverse()) {
      if (state.motion && container.contains(state.details)) finish(state);
    }
  };
  const motionChanged = () => { if (reducedMotion.matches) finishWithin(root); };
  // addListener is the fallback for older Safari.
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', motionChanged);
  else reducedMotion.addListener(motionChanged);
  return { setOpen, finishWithin, isOpen: (details: HTMLDetailsElement) => states.get(details)?.desired ?? details.open };
}
