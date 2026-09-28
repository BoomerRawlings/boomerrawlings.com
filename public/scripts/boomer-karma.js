const dialog = document.querySelector('#appeal-dialog');
const opener = document.querySelector('#open-appeal');
const form = document.querySelector('#appeal-form');
const result = document.querySelector('#appeal-result');
const receipt = document.querySelector('#appeal-receipt');
const copyStatus = document.querySelector('#copy-status');
const checkButton = document.querySelector('#check-score');
const checkStatus = document.querySelector('#check-status');

opener.hidden = false;
checkButton.hidden = false;
opener.addEventListener('click', () => dialog.showModal());
document.querySelector('#close-appeal').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => opener.focus());

let appealSending = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (appealSending) return;
  const statement = document.querySelector('#appeal-statement');
  if (!statement.value.trim()) {
    statement.setCustomValidity('The bureau requires at least a few words.');
    statement.reportValidity();
    return;
  }
  statement.setCustomValidity('');
  if (!form.reportValidity()) return;
  const points = document.querySelector('#appeal-points').valueAsNumber;
  receipt.value = [
    'BOOMER KARMA — FORM BK-02',
    'Petition for reconsideration',
    '',
    `Current score: ${document.querySelector('#karma-score').textContent} points`,
    `Points requested: +${points}`,
    `Grounds: ${document.querySelector('#appeal-reason').value}`,
    '',
    'Supporting evidence:',
    statement.value.trim(),
    '',
    'I acknowledge that the appeals committee is also Boomer.',
    'Awaiting the bureau’s deeply subjective ruling.',
  ].join('\n');
  const sendButton = form.querySelector('button[type="submit"]');
  const sendStatus = document.querySelector('#appeal-send-status');
  appealSending = true;
  sendButton.disabled = true;
  sendStatus.textContent = 'Sending your appeal to Boomer…';
  form.setAttribute('aria-busy', 'true');
  try {
    await window.BoomerKarmaDelivery.send('appeal', receipt.value);
    form.hidden = true;
    result.hidden = false;
    copyStatus.textContent = '';
    document.querySelector('#receipt-heading').focus();
  } catch {
    sendStatus.textContent = 'Your appeal could not be sent. Your statement is still here. Please try again.';
  } finally {
    appealSending = false;
    sendButton.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
document.querySelector('#appeal-statement').addEventListener('input', (event) => event.target.setCustomValidity(''));
document.querySelector('#edit-appeal').addEventListener('click', () => {
  result.hidden = true;
  form.hidden = false;
  document.querySelector('#appeal-send-status').textContent = '';
  document.querySelector('#appeal-statement').focus();
});
document.querySelector('#copy-appeal').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(receipt.value);
    copyStatus.textContent = 'Copied for your records. Your appeal has already been sent to Boomer.';
  } catch {
    receipt.focus();
    receipt.select();
    copyStatus.textContent = 'Select and copy the appeal above for your records.';
  }
});
const shareButton = document.querySelector('#share-appeal');
if (navigator.share) {
  shareButton.hidden = false;
  shareButton.addEventListener('click', async () => {
    try {
      await navigator.share({title: 'Boomer Karma appeal', text: receipt.value});
    } catch (error) {
      if (error.name !== 'AbortError') copyStatus.textContent = 'Sharing is unavailable. Use Copy appeal instead.';
    }
  });
}
checkButton.addEventListener('click', async () => {
  checkButton.disabled = true;
  checkStatus.textContent = 'Consulting all three bureaus…';
  try {
    const response = await fetch(`/BoomerKarma/?check=${Date.now()}`, {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Report unavailable');
    const fresh = new DOMParser().parseFromString(await response.text(), 'text/html');
    const freshScore = fresh.querySelector('#karma-score')?.textContent;
    const freshReport = fresh.querySelector('#report');
    if (!freshScore || !freshReport) throw new Error('Invalid report');
    // Reload all authored values together, preserving same-tab report access.
    const changed = ['#karma-score', '.ledger', '.gauge-center span', '.report-date'].some(selector =>
      freshReport.querySelector(selector)?.innerHTML !== document.querySelector('#report').querySelector(selector)?.innerHTML);
    if (changed) { window.location.replace(response.url); return; }
    checkStatus.textContent = `Still ${freshScore} points. All three bureaus agree. Suspicious.`;
  } catch {
    checkStatus.textContent = 'The bureaus are unreachable. Your last published report is still shown. Try again.';
  } finally {
    checkButton.disabled = false;
  }
});
