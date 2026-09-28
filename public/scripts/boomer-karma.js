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
const appealSupplements = document.querySelector('#appeal-supplements');
let appealRequirements = '';
function reviewAppeal(statement, points) {
  const bureau = window.BoomerKarmaBureau;
  if (!bureau || !appealSupplements) return false;
  bureau.inspect(statement, points, 'human');
  const requirements = bureau.requirements('human');
  const key = requirements.map(item => item.id).join('|');
  if (key === appealRequirements) return false;
  const previous = new Map([...appealSupplements.querySelectorAll('select, input')].map(field => [field.name, field.type === 'checkbox' ? field.checked : field.value]));
  appealRequirements = key;
  appealSupplements.replaceChildren();
  for (const requirement of requirements) {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'bureau-supplement';
    const legend = document.createElement('legend'); legend.textContent = requirement.title;
    const label = document.createElement('label'); label.textContent = requirement.prompt;
    const select = document.createElement('select'); select.name = `appeal-${requirement.id}`; select.required = true;
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select an administratively defensible answer'; select.append(placeholder);
    requirement.options.forEach(text => { const option = document.createElement('option'); option.textContent = text; select.append(option); });
    if (previous.has(select.name)) select.value = previous.get(select.name);
    label.append(select);
    const declaration = document.createElement('label'); declaration.className = 'choice';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = `${select.name}-confirmed`; checkbox.required = true; checkbox.checked = previous.get(checkbox.name) === true;
    const wording = document.createElement('span'); wording.textContent = requirement.attestation;
    declaration.append(checkbox, wording); fieldset.append(legend, label, declaration); appealSupplements.append(fieldset);
  }
  appealSupplements.hidden = !requirements.length;
  const status = document.querySelector('#appeal-supplement-status');
  if (status) status.textContent = requirements.length ? 'The Department of Ambition has appended a few entirely proportionate questions. Complete them, then send again.' : '';
  if (requirements.length) appealSupplements.querySelector('select')?.focus();
  return requirements.length > 0;
}
function appealPaperwork() {
  if (!appealSupplements || appealSupplements.hidden) return 'No additional supplements required.';
  return [...appealSupplements.querySelectorAll('fieldset')].map(section => `${section.querySelector('legend').textContent}\nAnswer: ${section.querySelector('select').value}\n${section.querySelector('input').checked ? 'Yes' : 'No'} — ${section.querySelector('.choice span').textContent}`).join('\n\n');
}
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
  if (reviewAppeal(statement.value, points)) return;
  if (!form.reportValidity()) return;
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
    '',
    'Additional paperwork:',
    appealPaperwork(),
  ].join('\n');
  const sendButton = form.querySelector('button[type="submit"]');
  const sendStatus = document.querySelector('#appeal-send-status');
  appealSending = true;
  sendButton.disabled = true;
  sendStatus.textContent = 'Sending your appeal to Boomer…';
  form.setAttribute('aria-busy', 'true');
  try {
    if (!window.BoomerKarmaDelivery?.send) throw new Error('Delivery unavailable');
    const acknowledgment = form.querySelector('input[type="checkbox"]');
    const acknowledgmentText = acknowledgment.closest('label').innerText.trim().replace(/\s+/gu, ' ');
    const delivered = await window.BoomerKarmaDelivery.send('appeal', {
      'Submitted message': statement.value,
      'Points requested': `+${points}`,
      'Current score': `${document.querySelector('#karma-score').textContent.trim()} points`,
      'Reason': document.querySelector('#appeal-reason').value,
      'Acknowledgment': `${acknowledgment.checked ? 'Yes' : 'No'} — ${acknowledgmentText}`,
      'Additional paperwork': appealPaperwork(),
    });
    if (delivered !== true) throw new Error('Delivery not confirmed');
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
    const refreshQuery = new URLSearchParams({check: String(Date.now())});
    if (new URLSearchParams(location.search).get('test') === '1') refreshQuery.set('test', '1');
    const response = await fetch(`/BoomerKarma/?${refreshQuery}`, {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Report unavailable');
    const fresh = new DOMParser().parseFromString(await response.text(), 'text/html');
    const freshScore = fresh.querySelector('#karma-score')?.textContent;
    const freshReport = fresh.querySelector('#report');
    if (!freshScore || !freshReport) throw new Error('Invalid report');
    // Reload all authored values together, preserving same-tab report access.
    const changed = ['#karma-score', '.ledger', '.gauge-center span', '.report-date'].some(selector =>
      freshReport.querySelector(selector)?.innerHTML !== document.querySelector('#report').querySelector(selector)?.innerHTML);
    window.BoomerKarmaBureau?.record('check', 'human');
    if (changed) { window.location.replace(response.url); return; }
    const checks = window.BoomerKarmaBureau?.snapshot('human')?.counts?.checks || 1;
    const remarks = [
      'All three bureaus agree. Suspicious.',
      'We have checked whether checking helped. It did not.',
      'Your refresh finger has been referred to the Department of Repetitive Inquiries.',
      'A second clipboard has been assigned to your first clipboard.',
      'The bureau has opened an inquiry into your inquiries. The number remains unmoved.',
      'You are now the chair of the Committee to Check Whether the Committee Checked.',
    ];
    checkStatus.textContent = `Check ${checks}: still ${freshScore} points. ${remarks[Math.min(checks - 1, remarks.length - 1)]}`;
  } catch {
    checkStatus.textContent = 'The bureaus are unreachable. Your last published report is still shown. Try again.';
  } finally {
    checkButton.disabled = false;
  }
});
