/* Select a build path; the implementation renderer owns the step content. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = new Map();
  let plans = [], activeId = null, expanded = false, loading = false, rendered = false;
  let reveal, guide, status, layoutTimer, fade, pendingRequest = null, providedData = null;
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, {detail}));
  function notifyLayout() {
    send('ead:plan-layout', {id: activeId, expanded});
  }
  function setExpanded(open) {
    if (!open && guide.contains(document.activeElement)) controls.get(activeId)?.focus();
    expanded = open;
    reveal.classList.toggle('is-expanded', open);
    reveal.inert = !open;
    reveal.setAttribute('aria-hidden', String(!open));
    controls.forEach((control, id) => {
      const selected = id === activeId && open;
      control.classList.toggle('is-selected', selected);
      control.setAttribute('aria-pressed', String(selected));
      control.setAttribute('aria-expanded', String(selected));
    });
    clearTimeout(layoutTimer);
    requestAnimationFrame(notifyLayout);
    layoutTimer = setTimeout(notifyLayout, reduced.matches ? 0 : 380);
  }
  function select(id, forceOpen) {
    const plan = plans.find(item => item.id === id);
    if (!plan) return;
    const wasOpen = expanded;
    const changed = activeId !== id;
    const open = typeof forceOpen === 'boolean' ? forceOpen : changed || !expanded;
    activeId = id;
    setExpanded(open);
    send('ead:plan-select', {
      id: plan.id, title: plan.title, description: plan.description,
      status: plan.status, steps: plan.steps, expanded: open
    });
    status.textContent = open
      ? `${plan.title} opened. ${plan.status === 'guide' ? 'Build guide.' : 'Outline; scope to define.'}`
      : `${plan.title} collapsed.`;
    fade?.cancel();
    if (open && wasOpen && changed && !reduced.matches && guide.animate) {
      fade = guide.animate([{opacity: .55}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
    }
  }
  function render(data, mount) {
    plans = data.plans;
    mount.classList.add('plan-launcher');
    mount.replaceChildren();
    const heading = make('div', undefined, 'plan-launcher-heading');
    const title = make('h2', data.title);
    title.id = 'implementation-plans-title';
    heading.append(make('p', 'BUILD PATHS', 'plan-eyebrow'), title, make('p', data.description, 'plan-launcher-description'));
    const group = make('div', undefined, 'plan-options');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', title.id);
    plans.forEach(plan => {
      const control = make('button', undefined, 'plan-choice');
      control.type = 'button';
      control.id = `plan-${plan.id}`;
      control.dataset.plan = plan.id;
      control.setAttribute('aria-controls', 'implementation-guide');
      control.setAttribute('aria-pressed', 'false');
      control.setAttribute('aria-expanded', 'false');
      const dot = make('span', undefined, 'plan-choice-dot');
      dot.setAttribute('aria-hidden', 'true');
      const text = make('span', undefined, 'plan-choice-text');
      text.append(make('span', plan.title, 'plan-choice-title'));
      text.append(make('span', plan.status === 'guide' ? 'Build guide' : 'Outline · scope to define', 'plan-choice-status'));
      const arrow = make('span', '⌄', 'plan-choice-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      control.append(dot, text, arrow);
      control.addEventListener('click', () => select(plan.id));
      controls.set(plan.id, control);
      group.append(control);
    });
    group.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const buttons = [...controls.values()];
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
    });
    status = make('p', '', 'sr-only');
    status.id = 'implementation-plan-status';
    status.setAttribute('role', 'status');
    mount.append(heading, group, status);

    reveal = make('div', undefined, 'plan-reveal');
    reveal.id = 'implementation-plan-reveal';
    const inner = make('div', undefined, 'plan-reveal-inner');
    guide.parentNode.insertBefore(reveal, guide);
    inner.append(guide); reveal.append(inner);
    guide.hidden = false;
    reveal.addEventListener('transitionend', event => {
      if (event.target === reveal && event.propertyName === 'grid-template-rows') notifyLayout();
    });
    setExpanded(false);
    rendered = true;
    send('ead:plans-ready', {plans: plans.map(({id, title, status}) => ({id, title, status}))});
    if (pendingRequest) {
      select(pendingRequest.id, pendingRequest.expanded ?? true);
      pendingRequest = null;
    }
  }
  function init() {
    const mount = $('implementation-plans');
    guide = $('implementation-guide');
    if (rendered || loading || !providedData || !mount || !guide) return;
    loading = true;
    try {
      const data = providedData;
      if (!Array.isArray(data.plans) || data.plans.length === 0 ||
          new Set(data.plans.map(plan => plan.id)).size !== data.plans.length ||
          data.plans.some(plan => !plan.id || !plan.title || !['guide', 'outline'].includes(plan.status) ||
            !(plan.steps === null || Array.isArray(plan.steps)))) throw new Error('Invalid plan data');
      render(data, mount);
    } catch {
      const error = make('p', 'Plan selection is unavailable. The shared guide remains below.', 'plan-load-error');
      mount.replaceChildren(error);
      guide.hidden = false;
    } finally {
      loading = false;
    }
  }
  document.addEventListener('ead:plan-request', event => {
    const request = typeof event.detail === 'string' ? {id: event.detail} : event.detail;
    if (!request?.id) return;
    if (rendered) select(request.id, request.expanded ?? true);
    else { pendingRequest = request; init(); }
  });
  document.addEventListener('ead:plans-data', event => { providedData = event.detail; init(); });
  document.addEventListener('ead:view', event => {
    if (event.detail === 'implementation' && rendered) requestAnimationFrame(notifyLayout);
  });
  reduced.addEventListener('change', () => {
    fade?.cancel(); clearTimeout(layoutTimer);
    if (rendered) requestAnimationFrame(notifyLayout);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
