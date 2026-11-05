const form = document.querySelector('#entry-form');
const message = document.querySelector('#entry-message');
const input = document.querySelector('#password');
const button = form.querySelector('button');
const arrival = document.querySelector('#arrival-screen');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let pending = false;
let requestGeneration = 0;
let arrivalTimer;

function clearArrival() {
  document.documentElement.classList.remove('arriving');
  window.clearTimeout(arrivalTimer);
}
if (reduced.matches) clearArrival();
else if (document.documentElement.classList.contains('arriving')) arrivalTimer = window.setTimeout(clearArrival, 700);
arrival.addEventListener('animationend', clearArrival);
reduced.addEventListener('change', () => { if (reduced.matches) clearArrival(); });
window.addEventListener('pagehide', () => {
  clearArrival(); requestGeneration++; pending = false; button.disabled = false; input.value = ''; message.textContent = '';
});
window.addEventListener('pageshow', event => { if (event.persisted) clearArrival(); });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || !form.reportValidity()) return;
  pending = true; button.disabled = true;
  const generation = ++requestGeneration;
  input.setAttribute('aria-invalid', 'false');
  message.textContent = 'Opening the index…';
  try {
    const response = await fetch('/observatory/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ password: input.value }),
    });
    if (generation !== requestGeneration) return;
    if (response.ok) { input.value = ''; location.replace('/observatory/'); return; }
    message.textContent = response.status === 429 ? 'Too many attempts. Please wait before trying again.'
      : response.status === 503 ? 'The index is temporarily unavailable. Please try again shortly.'
      : "That isn't the answer. Try again.";
    input.setAttribute('aria-invalid', 'true'); input.focus(); input.select();
  } catch {
    if (generation === requestGeneration) message.textContent = 'Could not connect. Please try again.';
  } finally {
    if (generation === requestGeneration) { pending = false; button.disabled = false; }
  }
});
