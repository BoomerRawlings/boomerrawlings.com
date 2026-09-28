(() => {
  const dialog = document.querySelector('#application-dialog');
  if (!dialog) return;

  const form = dialog.querySelector('#application-form');
  const steps = Array.from(form.querySelectorAll('.application-step'));
  const next = form.querySelector('#application-next');
  const back = form.querySelector('#application-back');
  const error = form.querySelector('#application-error');
  const sendStatus = form.querySelector('#application-send-status');
  const statement = form.querySelector('#application-justification');
  const notarization = form.querySelector('#application-notarization');
  const finalPanel = form.querySelector('#application-final-attestation');
  const finalCheck = form.querySelector('#application-final-check');
  const storageKey = 'boomerkarma-report-issued-v1';
  const nextLabels = [
    'Continue to bureau selection',
    'Continue to statement of purpose',
    'Continue to the fine print',
    'Continue to library verification',
    'Continue to vibe notarization',
    'Continue to administrative redundancy',
    'Review my paperwork',
    'Proceed to final authorization',
    'Request permission to receive permission',
  ];
  let current = 0;
  let finalRevealed = false;
  let opener = null;
  let sending = false;
  let issued = false;

  const wordCount = () => statement.value.trim().split(/\s+/u).filter(Boolean).length;

  function clearError() {
    error.hidden = true;
    error.textContent = '';
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function showError(message, field) {
    error.textContent = message;
    error.hidden = false;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  function updateReview() {
    form.querySelector('#review-capacity').textContent = form.elements.namedItem('capacity').value;
    form.querySelector('#review-purpose').textContent = form.elements.namedItem('purpose').value;
    form.querySelector('#review-justification').textContent = statement.value.trim();
  }

  function showStep(index, moveFocus = true) {
    current = index;
    steps.forEach((step, position) => {
      step.hidden = position !== current;
      step.disabled = position !== current;
    });
    finalCheck.disabled = !finalRevealed;
    clearError();
    if (current === 7) updateReview();
    back.hidden = current === 0;
    next.textContent = current === 8 && finalRevealed ? 'Send paperwork & release my report' : nextLabels[current];
    dialog.querySelector('#application-progress').value = current + 1;
    dialog.querySelector('#application-progress-label').textContent = `Step ${current + 1} of ${steps.length} · ${steps[current].dataset.title}`;
    if (moveFocus) {
      dialog.scrollTop = 0;
      steps[current].querySelector('legend').focus();
    }
  }

  function validateStep() {
    clearError();
    const controls = Array.from(steps[current].querySelectorAll('input, select, textarea'));
    const invalid = controls.find((field) => !field.disabled && !field.checkValidity());
    if (invalid) {
      const message = invalid.type === 'checkbox'
        ? 'The bureau requires every declaration on this page to be checked before proceeding.'
        : 'Please complete the indicated field before sending the form to its next desk.';
      showError(message, invalid);
      return false;
    }
    if (current === 2 && wordCount() < 12) {
      showError(`The bureau requests at least 12 words. You have ${wordCount()}. Filler is administratively acceptable.`, statement);
      return false;
    }
    if (current === 4) {
      const selected = controls.filter((field) => field.checked).map((field) => field.value);
      const books = ['atlas', 'novel', 'dictionary'];
      if (selected.length !== books.length || !books.every((book) => selected.includes(book))) {
        showError('Select just the three books: the library atlas, the very long novel, and the unnecessarily large dictionary.', controls[0]);
        return false;
      }
    }
    if (current === 5 && notarization.value.trim().toLowerCase() !== 'this is all vibes') {
      showError('The notary needs exactly “this is all vibes” — no punctuation required.', notarization);
      return false;
    }
    return true;
  }

  function revealReport() {
    const report = document.querySelector('#report');
    const gate = document.querySelector('#report-gate');
    if (report) report.hidden = false;
    if (gate) gate.hidden = true;
  }

  function focusReport() {
    const heading = document.querySelector('#report-heading');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function completedPaperwork() {
    const checkboxes = Array.from(form.querySelectorAll('input[type="checkbox"]'));
    const answer = (field) => {
      // Earlier steps are hidden, so normalize line breaks without relying on layout.
      const label = field.closest('label').cloneNode(true);
      label.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(' '));
      const declaration = label.textContent.trim().replace(/\s+/gu, ' ');
      return `${field.checked ? 'Yes' : 'No'} — ${declaration}`;
    };
    return {
      'Submitted message': statement.value,
      'Purpose': form.elements.namedItem('purpose').value,
      'Capacity': form.elements.namedItem('capacity').value,
      'Current score': `${document.querySelector('#karma-score').textContent.trim()} points`,
      'Bureaus selected': checkboxes.filter((field) => field.name === 'bureau' && field.checked).map((field) => field.value).join(', '),
      'Library selections': checkboxes.filter((field) => field.name === 'library').map(answer).join('\n'),
      'Notarized phrase': notarization.value,
      'Declarations': checkboxes.filter((field) => field.name !== 'bureau' && field.name !== 'library').map(answer).join('\n'),
    };
  }

  try {
    if (sessionStorage.getItem(storageKey) === 'true') revealReport();
  } catch {
    // Storage is optional; a successful send can still reveal the report.
  }

  document.querySelectorAll('[data-request-report]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      opener = button;
      issued = false;
      dialog.showModal();
      showStep(current);
    });
  });

  dialog.querySelector('#application-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (issued) focusReport();
    else if (opener?.isConnected) opener.focus();
  });

  back.addEventListener('click', () => {
    if (!sending && current > 0) showStep(current - 1);
  });

  form.addEventListener('input', () => {
    clearError();
    form.querySelector('#application-word-count').textContent = `${wordCount()} / 12 words minimum`;
    // Editing any earlier answer requires a fresh review acknowledgment.
    if (current < 7) form.elements.namedItem('reviewed').checked = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!validateStep()) return;
    if (current < steps.length - 1) {
      showStep(current + 1);
      return;
    }
    if (!finalRevealed) {
      finalRevealed = true;
      finalPanel.hidden = false;
      finalCheck.disabled = false;
      next.textContent = 'Send paperwork & release my report';
      finalCheck.focus();
      return;
    }
    sending = true;
    next.disabled = true;
    back.disabled = true;
    form.setAttribute('aria-busy', 'true');
    sendStatus.textContent = 'Sending your paperwork…';
    sendStatus.hidden = false;
    try {
      if (!window.BoomerKarmaDelivery?.send) throw new Error('Delivery unavailable');
      const delivered = await window.BoomerKarmaDelivery.send('report', completedPaperwork());
      if (delivered !== true) throw new Error('Delivery not confirmed');
      issued = true;
      revealReport();
      try {
        sessionStorage.setItem(storageKey, 'true');
      } catch {
        // The report remains available even if this browser blocks storage.
      }
      dialog.close();
      focusReport();
      form.reset();
      form.querySelectorAll('.application-review dd').forEach((entry) => {
        if (entry.id?.startsWith('review-')) entry.textContent = '';
      });
      sending = false;
      next.disabled = false;
      back.disabled = false;
      form.removeAttribute('aria-busy');
      finalRevealed = false;
      finalPanel.hidden = true;
      sendStatus.hidden = true;
      sendStatus.textContent = '';
      form.querySelector('#application-word-count').textContent = '0 / 12 words minimum';
      showStep(0, false);
    } catch {
      sending = false;
      next.disabled = false;
      back.disabled = false;
      form.removeAttribute('aria-busy');
      sendStatus.hidden = true;
      showError('Your paperwork could not be sent. Your answers are still here. Please try Send paperwork again.');
      next.focus();
    }
  });
})();
