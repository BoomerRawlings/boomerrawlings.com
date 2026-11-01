const SVG_NS = 'http://www.w3.org/2000/svg';
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};
const button = (className, label, action) => {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
};
const normalize = value => String(value ?? '').normalize('NFKD').toLocaleLowerCase();
const safeURL = value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
let mountCount = 0;

/** A paired chronology: an event beside the record that puts it on the timeline. */
export function mountTimeline(host, corpus = {}, callbacks = {}) {
  const events = Array.isArray(corpus.events) ? corpus.events : [];
  const sources = new Map((corpus.sources || []).map(source => [source.id, source]));
  const ids = new Set(events.map(event => event.id));
  const uid = `assc-tl-${++mountCount}`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 720px)');
  const root = element('section', 'assc-timeline');
  root.setAttribute('aria-label', 'Research timeline');
  const heading = element('div', 'assc-tl-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p', 'assc-tl-eyebrow', 'A CHRONOLOGY OF THE RECORD'));
  headingCopy.append(element('h2', 'assc-tl-title', 'Events leave traces.'));
  headingCopy.append(element('p', 'assc-tl-intro', 'Open a moment to follow the event into its source. Trace the links between moments.'));
  heading.append(headingCopy);
  root.append(heading);

  const toolbar = element('div', 'assc-tl-toolbar');
  const searchLabel = element('label', 'assc-tl-search');
  searchLabel.append(element('span', 'assc-tl-sr-only', 'Search timeline'));
  const search = element('input');
  search.type = 'search';
  search.placeholder = 'Find a date, name, or event';
  search.autocomplete = 'off';
  searchLabel.append(search);
  const count = element('span', 'assc-tl-count');
  count.setAttribute('aria-live', 'polite');
  const expand = button('assc-tl-control', 'Open all', () => setAll(true));
  const collapse = button('assc-tl-control', 'Close all', () => setAll(false));
  const tools = element('div', 'assc-tl-tools');
  tools.append(expand, collapse);
  toolbar.append(searchLabel, count, tools);
  root.append(toolbar);

  const context = element('div', 'assc-tl-context');
  const status = element('p', 'assc-tl-status', 'Hover or focus a card to trace it. Select its heading to keep the connection.');
  status.setAttribute('aria-live', 'polite');
  const clear = button('assc-tl-control', 'Release trace', () => { pinned = null; setActive(null, true); });
  clear.hidden = true;
  context.append(status, clear);
  root.append(context);

  const board = element('div', 'assc-tl-board');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('assc-tl-wires');
  svg.setAttribute('aria-hidden', 'true');
  board.append(svg);
  root.append(board);
  const empty = element('p', 'assc-tl-empty', events.length ? 'No moments match this search.' : 'The chronology is ready for the first sourced event.');
  empty.hidden = events.length > 0;
  board.append(empty);
  const legend = element('div', 'assc-tl-legend');
  legend.append(element('span', 'assc-tl-legend-pair', 'Event → source record'), element('span', 'assc-tl-legend-related', 'Linked moment'));
  root.append(legend);
  host.append(root);

  const rows = new Map();
  let active = null, pinned = null, frame = 0, motionUntil = 0, destroyed = false;
  const relatedIds = event => (event.related || []).map(item => typeof item === 'object' ? item.id : item).filter(id => ids.has(id) && id !== event.id);

  function focusPairs(origin) {
    if (!origin) return [...rows.values()].map(row => [row.event.id, row.event.id]);
    if (origin.side === 'record') return events.filter(event => event.id === origin.id || relatedIds(event).includes(origin.id)).map(event => [event.id, origin.id]);
    const event = rows.get(origin.id)?.event;
    return event ? [event.id, ...relatedIds(event)].map(id => [event.id, id]) : [];
  }

  function svgNode(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function draw() {
    svg.replaceChildren();
    if (destroyed || narrow.matches || !root.isConnected) return;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    focusPairs(active).forEach(([from, to]) => {
      const left = rows.get(from), right = rows.get(to);
      if (!left || !right || !left.open || !right.open || left.wrapper.hidden || right.wrapper.hidden) return;
      const a = left.eventHeading.getBoundingClientRect(), b = right.recordHeading.getBoundingClientRect();
      const x1 = a.right - rect.left, y1 = a.top + a.height / 2 - rect.top;
      const x2 = b.left - rect.left, y2 = b.top + b.height / 2 - rect.top;
      const mid = (x1 + x2) / 2;
      const related = from !== to;
      const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      const path = svgNode('path', {d, class: `assc-tl-wire${related ? ' is-related' : ''}${active ? ' is-active' : ''}`});
      svg.append(path);
      svg.append(svgNode('circle', {cx: x1, cy: y1, r: active ? 3 : 2, class: 'assc-tl-port'}));
      svg.append(svgNode('circle', {cx: x2, cy: y2, r: active ? 3 : 2, class: 'assc-tl-port'}));
      if (related) svg.append(svgNode('path', {d: `M ${x2 - 7} ${y2 - 4} L ${x2 - 1} ${y2} L ${x2 - 7} ${y2 + 4}`, class: 'assc-tl-arrow'}));
      if (active && !reduced.matches && performance.now() >= motionUntil && typeof path.animate === 'function') {
        const length = path.getTotalLength();
        const pulse = Math.min(30, length / 4);
        const tracer = svgNode('path', {d, class: 'assc-tl-tracer', 'stroke-dasharray': `${pulse} ${length + pulse * 2}`});
        svg.append(tracer);
        const animation = tracer.animate([
          {strokeDashoffset: active.side === 'record' ? -length : pulse},
          {strokeDashoffset: active.side === 'record' ? pulse : -length},
        ], {duration: 650, easing: 'cubic-bezier(.22,1,.36,1)'});
        animation.onfinish = () => tracer.remove();
      }
    });
  }

  function schedule(animateLayout = false) {
    if (destroyed) return;
    if (animateLayout && !reduced.matches) motionUntil = performance.now() + 450;
    if (frame) return;
    const tick = () => {
      frame = 0;
      draw();
      if (!destroyed && performance.now() < motionUntil) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function setActive(origin, announce = false) {
    active = pinned || origin;
    const pairs = focusPairs(active);
    const leftIds = new Set(active ? pairs.map(pair => pair[0]) : []);
    const rightIds = new Set(active ? pairs.map(pair => pair[1]) : []);
    for (const row of rows.values()) {
      row.eventCard.classList.toggle('is-connected', leftIds.has(row.event.id));
      row.recordCard.classList.toggle('is-connected', rightIds.has(row.event.id));
      for (const [side, card, cardButton] of [['event', row.eventCard, row.eventHeading], ['record', row.recordCard, row.recordHeading]]) {
        const isPinned = pinned?.id === row.event.id && pinned.side === side;
        card.classList.toggle('is-pinned', isPinned);
        cardButton.setAttribute('aria-pressed', String(isPinned));
      }
    }
    clear.hidden = !pinned;
    root.classList.toggle('has-trace', Boolean(active));
    const selected = active ? rows.get(active.id)?.event : null;
    if (selected) {
      const extra = pairs.length - 1;
      status.textContent = `${pinned ? 'Following' : 'Previewing'}: ${selected.title}${extra > 0 ? ` · ${extra} linked ${extra === 1 ? 'moment' : 'moments'}` : ''}`;
    } else if (announce) status.textContent = 'Trace released. Hover or focus a card to follow another moment.';
    else status.textContent = 'Hover or focus a card to trace it. Select its heading to keep the connection.';
    schedule();
  }

  function pin(id, side) {
    pinned = pinned?.id === id && pinned.side === side ? null : {id, side};
    setActive(pinned, true);
  }

  function bindCard(card, id, side) {
    card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setActive({id, side}); });
    card.addEventListener('pointerleave', () => {
      const focused = document.activeElement?.closest('.assc-tl-card');
      setActive(focused && root.contains(focused) ? {id: focused.dataset.event, side: focused.dataset.side} : null);
    });
    card.addEventListener('focusin', () => setActive({id, side}));
    card.addEventListener('focusout', event => {
      if (card.contains(event.relatedTarget)) return;
      const next = event.relatedTarget?.closest?.('.assc-tl-card');
      setActive(next && root.contains(next) ? {id: next.dataset.event, side: next.dataset.side} : null);
    });
  }

  function setOpen(row, open) {
    row.open = open;
    row.wrapper.classList.toggle('is-open', open);
    row.toggle.setAttribute('aria-expanded', String(open));
    row.reveal.inert = !open;
    row.reveal.setAttribute('aria-hidden', String(!open));
    row.toggleVerb.textContent = open ? 'Close record' : 'Open record';
    schedule(true);
  }

  function setAll(open) {
    for (const row of rows.values()) if (!row.wrapper.hidden) setOpen(row, open);
    if (!open) { pinned = null; setActive(null); }
  }

  function jump(id) {
    const row = rows.get(id);
    if (!row) return;
    if (row.wrapper.hidden) { search.value = ''; filter(); }
    setOpen(row, true);
    pinned = {id, side: 'event'};
    setActive(pinned, true);
    row.toggle.focus({preventScroll: true});
    row.wrapper.scrollIntoView({block: 'center', behavior: reduced.matches ? 'auto' : 'smooth'});
  }

  function sourceLink(id) {
    const source = sources.get(id);
    const label = source?.title || id;
    if (typeof callbacks.onSource === 'function') return button('assc-tl-source-link', label, () => callbacks.onSource(id));
    const url = safeURL(source?.url);
    if (!url) return element('span', 'assc-tl-source-label', label);
    const link = element('a', 'assc-tl-source-link', label);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  }

  events.forEach((event, index) => {
    const wrapper = element('article', 'assc-tl-event');
    const toggle = button('assc-tl-toggle', null, () => setOpen(rows.get(event.id), !rows.get(event.id).open));
    const date = element('time', 'assc-tl-date', event.date || 'Date to establish');
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(event.date))) date.dateTime = event.date;
    const toggleText = element('span', 'assc-tl-toggle-title', event.title || 'Untitled event');
    const toggleVerb = element('span', 'assc-tl-toggle-verb', 'Open record');
    const toggleIcon = element('span', 'assc-tl-toggle-icon', '+');
    toggleIcon.setAttribute('aria-hidden', 'true');
    toggle.append(date, toggleText, toggleVerb, toggleIcon);
    toggle.id = `${uid}-event-${index}`;
    const eventTitle = element('h3', 'assc-tl-event-title');
    eventTitle.append(toggle);
    wrapper.append(eventTitle);
    const reveal = element('div', 'assc-tl-reveal');
    reveal.id = `${uid}-record-${index}`;
    reveal.setAttribute('role', 'region');
    reveal.setAttribute('aria-labelledby', toggle.id);
    toggle.setAttribute('aria-controls', reveal.id);
    const revealInner = element('div', 'assc-tl-reveal-inner');
    const pair = element('div', 'assc-tl-pair');
    const eventCard = element('div', 'assc-tl-card assc-tl-event-card');
    eventCard.dataset.event = event.id;
    eventCard.dataset.side = 'event';
    eventCard.append(element('p', 'assc-tl-card-kicker', 'THE MOMENT'));
    const eventHeading = button('assc-tl-card-heading', event.title || 'Event', () => pin(event.id, 'event'));
    eventHeading.setAttribute('aria-label', `Trace event: ${event.title}`);
    eventHeading.setAttribute('aria-pressed', 'false');
    const eventHeadingShell = element('h4'); eventHeadingShell.append(eventHeading);
    eventCard.append(eventHeadingShell, element('p', 'assc-tl-summary', event.summary || 'The source record accompanies this event.'));
    const related = relatedIds(event);
    if (related.length) {
      const links = element('div', 'assc-tl-relations');
      links.append(element('span', 'assc-tl-mini-label', 'FOLLOW THE THREAD'));
      related.forEach(id => links.append(button('assc-tl-relation-link', events.find(item => item.id === id)?.title || id, () => jump(id))));
      eventCard.append(links);
    }
    const recordCard = element('div', 'assc-tl-card assc-tl-record-card');
    recordCard.dataset.event = event.id;
    recordCard.dataset.side = 'record';
    recordCard.append(element('p', 'assc-tl-card-kicker', 'THE RECORD'));
    const artifact = event.artifact || {};
    const recordHeading = button('assc-tl-card-heading', artifact.title || 'Source record', () => pin(event.id, 'record'));
    recordHeading.setAttribute('aria-label', `Trace record: ${artifact.title || event.title}`);
    recordHeading.setAttribute('aria-pressed', 'false');
    const recordHeadingShell = element('h4'); recordHeadingShell.append(recordHeading);
    recordCard.append(recordHeadingShell);
    if (artifact.text) recordCard.append(element('div', 'assc-tl-artifact', artifact.text));
    const resources = element('div', 'assc-tl-resources');
    (event.sourceIds || []).forEach(id => resources.append(sourceLink(id)));
    const url = safeURL(artifact.url);
    if (url) {
      const link = element('a', 'assc-tl-source-link', 'Open original ↗');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      resources.append(link);
    }
    if (typeof callbacks.onTranscript === 'function') {
      (event.transcriptRefs || []).forEach(ref => {
        const id = ref.id || ref.transcriptId;
        if (!id) return;
        const turn = ref.turn ?? ref.turnIndex;
        resources.append(button('assc-tl-source-link', ref.label || `Read transcript${turn != null ? ` · turn ${turn}` : ''}`, () => callbacks.onTranscript(id, turn)));
      });
    }
    if (resources.childElementCount) recordCard.append(resources);
    pair.append(eventCard, recordCard);
    revealInner.append(pair); reveal.append(revealInner); wrapper.append(reveal);
    board.append(wrapper);
    const row = {event, wrapper, toggle, toggleVerb, reveal, eventCard, recordCard, eventHeading, recordHeading, open: false};
    rows.set(event.id, row);
    bindCard(eventCard, event.id, 'event'); bindCard(recordCard, event.id, 'record');
    setOpen(row, index === 0);
  });

  function filter() {
    const query = normalize(search.value).trim();
    let visible = 0;
    for (const row of rows.values()) {
      const event = row.event;
      const haystack = normalize([event.date, event.title, event.summary, event.artifact?.title, event.artifact?.text].join(' '));
      row.wrapper.hidden = query ? !haystack.includes(query) : false;
      if (!row.wrapper.hidden) visible++;
    }
    if (pinned && rows.get(pinned.id)?.wrapper.hidden) { pinned = null; setActive(null); }
    count.textContent = `${visible}${query ? ` of ${events.length}` : ''} ${visible === 1 ? 'moment' : 'moments'}`;
    empty.hidden = visible > 0;
    expand.disabled = collapse.disabled = !visible;
    schedule();
  }
  search.addEventListener('input', filter);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pinned) { event.preventDefault(); pinned = null; setActive(null, true); }
  });
  const observer = new ResizeObserver(() => schedule());
  observer.observe(board);
  for (const row of rows.values()) observer.observe(row.reveal);
  const onMediaChange = () => { motionUntil = 0; schedule(); };
  reduced.addEventListener('change', onMediaChange);
  narrow.addEventListener('change', onMediaChange);
  filter();
  return {
    focusEvent: jump,
    resize: () => schedule(),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener('change', onMediaChange);
      narrow.removeEventListener('change', onMediaChange);
      root.remove();
    },
  };
}
