import { renderSymbol, symbolDescriptions } from './symbols.js';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const status = document.querySelector('#status');
const instrument = document.querySelector('.instrument');
const destination = document.querySelector('.destination');
const list = document.querySelector('#world-list');
const selectors = document.querySelector('#orbital-selectors');
const motionButton = document.querySelector('#motion');
const logoutButton = document.querySelector('#logout');
const symbolStage = document.querySelector('#selected-symbol');
const symbolCaption = document.querySelector('#symbol-caption');
let worlds = [];
let selected = -1;
let paused = reduced.matches;
let loggingOut = false;
let catalogRequest = 0;

function applyMotion() {
  document.body.classList.toggle('motion-paused', paused);
  motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.hidden = reduced.matches;
}
applyMotion();
reduced.addEventListener('change', () => { paused = reduced.matches; applyMotion(); });
motionButton.addEventListener('click', () => { paused = !paused; applyMotion(); });

function selectWorld(index, animate = true) {
  if (!worlds[index] || selected === index) return;
  selected = index;
  const world = worlds[index];
  const number = String(index + 1).padStart(2, '0');
  const kind = renderSymbol(symbolStage, world.symbol);
  symbolStage.setAttribute('aria-label', symbolDescriptions[kind]);
  symbolCaption.textContent = world.kicker;
  document.querySelector('#destination-number').textContent = number;
  document.querySelector('#destination-kicker').textContent = world.kicker;
  document.querySelector('#destination-title').textContent = world.title;
  document.querySelector('#destination-description').textContent = world.description;
  document.querySelector('#coordinate').textContent = `FIG. ${number} / SELECTED`;
  const enter = document.querySelector('#enter-world');
  enter.href = world.href;
  enter.setAttribute('aria-label', `Enter ${world.title}`);
  enter.hidden = false;
  document.querySelector('#destination-note').hidden = false;
  for (const button of document.querySelectorAll('[data-world]')) button.setAttribute('aria-pressed', String(Number(button.dataset.world) === index));
  if (animate && !reduced.matches && !paused) {
    symbolStage.classList.remove('symbol-changing');
    void symbolStage.offsetWidth;
    symbolStage.classList.add('symbol-changing');
    destination.classList.remove('changing');
    void destination.offsetWidth;
    destination.classList.add('changing');
  }
}

function makeButton(world, index, orbital) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = orbital ? 'satellite' : 'world-button';
  button.dataset.world = String(index);
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `Explore ${world.title}`);
  const number = document.createElement('span');
  number.className = 'world-id';
  number.textContent = String(index + 1).padStart(2, '0');
  const label = document.createElement('span');
  label.className = orbital ? 'satellite-label' : 'world-label';
  label.textContent = world.title;
  button.append(number, label);
  if (orbital) {
    const angle = (index * 360 / worlds.length - 110) * Math.PI / 180;
    button.style.setProperty('--x', `${50 + 37 * Math.cos(angle)}%`);
    button.style.setProperty('--y', `${50 + 37 * Math.sin(angle)}%`);
  } else {
    const arrow = document.createElement('span'); arrow.className = 'world-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
  }
  button.addEventListener('click', () => selectWorld(index));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? worlds.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + worlds.length) % worlds.length;
    selectWorld(next);
    button.parentElement.querySelector(`[data-world="${next}"]`).focus();
  });
  return button;
}

function clearPrivateView() {
  catalogRequest++;
  worlds = []; selected = -1; list.replaceChildren(); selectors.replaceChildren();
  symbolStage.replaceChildren(); symbolStage.setAttribute('aria-label', 'Destination illustration'); symbolCaption.textContent = '';
  document.querySelector('#destination-title').textContent = 'Loading destinations';
  document.querySelector('#destination-description').textContent = '';
  document.querySelector('#destination-kicker').textContent = '';
  document.querySelector('#enter-world').removeAttribute('href');
  document.querySelector('#enter-world').hidden = true;
  document.querySelector('#destination-note').hidden = true;
}

async function loadWorlds() {
  const previousId = worlds[selected]?.id;
  clearPrivateView();
  const requestId = ++catalogRequest;
  try {
    const response = await fetch('/observatory/api/catalog', { credentials: 'same-origin', cache: 'no-store' });
    if (requestId !== catalogRequest || loggingOut) return;
    if (response.status === 401) { clearPrivateView(); location.replace('/observatory/'); return; }
    if (!response.ok) throw new Error('catalog');
    const data = await response.json();
    if (requestId !== catalogRequest || loggingOut) return;
    if (!Array.isArray(data.destinations) || !data.destinations.length) throw new Error('empty');
    worlds = data.destinations;
    list.replaceChildren(); selectors.replaceChildren(); selected = -1;
    worlds.forEach((world, index) => { list.append(makeButton(world, index, false)); selectors.append(makeButton(world, index, true)); });
    document.querySelector('#world-count').textContent = String(worlds.length).padStart(2, '0');
    selectWorld(Math.max(0, worlds.findIndex(world => world.id === previousId)), false); status.textContent = '';
  } catch {
    if (requestId === catalogRequest && !loggingOut) status.textContent = 'The signals are quiet. Reload to try again.';
  }
}

logoutButton.addEventListener('click', async () => {
  if (loggingOut) return;
  loggingOut = true; logoutButton.disabled = true;
  clearPrivateView();
  try {
    const response = await fetch('/observatory/api/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) throw new Error('logout');
    clearPrivateView(); location.replace('/observatory/');
  } catch {
    loggingOut = false; logoutButton.disabled = false;
    await loadWorlds();
    status.textContent = 'The door could not be closed. Please try again.';
  }
});
// Restored history entries must revalidate the session before showing the directory.
window.addEventListener('pagehide', clearPrivateView);
window.addEventListener('pageshow', (event) => { if (event.persisted) { clearPrivateView(); void loadWorlds(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !loggingOut) void loadWorlds(); });
await loadWorlds();
