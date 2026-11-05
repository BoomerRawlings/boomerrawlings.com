const form = document.querySelector('#entry-form');
const message = document.querySelector('#entry-message');
const input = document.querySelector('#password');
const button = form.querySelector('button');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  button.disabled = true;
  input.setAttribute('aria-invalid', 'false');
  message.textContent = 'Opening the door…';
  try {
    const response = await fetch('/observatory/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ password: input.value }),
    });
    if (response.ok) { input.value = ''; location.replace('/observatory/'); return; }
    message.textContent = response.status === 429 ? 'A moment of quiet. Please wait before trying again.'
      : response.status === 503 ? 'The Observatory is being prepared. Please return soon.'
      : 'That password didn’t open the door. Try again.';
    input.setAttribute('aria-invalid', 'true'); input.focus(); input.select();
  } catch { message.textContent = 'The connection slipped. Please try again.'; }
  finally { button.disabled = false; }
});
