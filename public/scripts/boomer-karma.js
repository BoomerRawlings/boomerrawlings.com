const refreshButton = document.querySelector('#refresh-report');
const refreshMessage = document.querySelector('#refresh-message');

refreshButton?.addEventListener('click', () => {
  if (refreshMessage) {
    refreshMessage.textContent = 'Report pulled. Still pushing twenty. The bureau declines to explain the math.';
  }
});
