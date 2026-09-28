(() => {
  // Public form address, not a credential. Delivery is restricted to the verified owner inbox.
  const endpoint = 'https://formsubmit.co/ajax/f82adb0b9ed6790297a1321a5e73fba0';
  const pending = new Set();
  const attempts = new Map();
  const testMode = !['boomerrawlings.com', 'www.boomerrawlings.com'].includes(location.hostname)
    || new URLSearchParams(location.search).get('test') === '1';
  if (testMode) {
    const notice = document.createElement('p');
    notice.className = 'parody-strip';
    notice.textContent = 'TEST MODE — emails are marked TEST ONLY. This is not a visitor submission.';
    document.querySelector('main')?.prepend(notice);
    document.querySelectorAll('a[href="/BoomerKarma/"], a[href="/BoomerKarma/Kemberton/"]').forEach(link => {
      link.setAttribute('href', `${link.getAttribute('href')}?test=1`);
    });
  }
  window.BoomerKarmaDelivery = {
    async send(kind, answers, {attachment} = {}) {
      const entries = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.entries(answers) : [];
      const fingerprint = JSON.stringify(entries) + (attachment ? `|${attachment.size}|${attachment.lastModified}` : '');
      if (!['report', 'appeal', 'cat-report', 'bureau-petition'].includes(kind) || !entries.length || entries.length > 20
        || entries.some(([label, value]) => !label.trim() || label.startsWith('_') || label.length > 80 || typeof value !== 'string')
        || !answers['Submitted message']?.trim() || fingerprint.length > 16000 || pending.has(kind)) {
        throw new Error('Invalid or duplicate submission');
      }
      if ((kind === 'cat-report' && !(attachment instanceof Blob))
        || (attachment && (kind !== 'cat-report' || attachment.type !== 'image/jpeg' || attachment.size < 1 || attachment.size > 2000000))) {
        throw new Error('A verified cat portrait is required');
      }
      const division = kind === 'cat-report' || (kind === 'bureau-petition' && /feline/i.test(answers.Division || '')) ? 'feline' : 'human';
      const action = kind === 'appeal' ? 'appeal' : kind === 'bureau-petition' ? 'petition' : 'request';
      // Keep a retry's reference and bureau notes stable. Answers stay only in memory.
      if (attempts.get(kind)?.fingerprint !== fingerprint) {
        const submitted = new Date();
        attempts.set(kind, {
          fingerprint,
          reference: `BK-${submitted.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
          time: new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'long',
          }).format(submitted),
          bureauNotes: window.BoomerKarmaBureau?.describe(division) || '',
          sequence: (window.BoomerKarmaBureau?.snapshot(division)?.counts?.[`${action}s`] || 0) + 1,
        });
      }
      const {reference, time, bureauNotes, sequence} = attempts.get(kind);
      const title = kind === 'cat-report' ? 'Kemberton score request' : kind === 'report' ? 'Report request' : kind === 'bureau-petition' ? 'Bureau paperwork petition' : 'Points appeal';
      const {'Submitted message': message, ...details} = answers;
      pending.add(kind);
      try {
        const honey = document.querySelector('#karma-website')?.value || '';
        if (honey) throw new Error('Unable to send this submission');
        const fields = {
            _subject: `${testMode ? '[TEST ONLY] ' : ''}BoomerKarma | ${title} | ${reference}`,
            _template: 'table',
            _captcha: 'false',
            _honey: honey,
            'Submission': testMode ? `TEST ONLY — ${title}. No visitor action.` : `Website submission — ${title}`,
            'Submitted message': message,
            'Submitted (Pacific time)': time,
            'Reference': reference,
            'Action needed': testMode ? 'None. This is a delivery test.' : kind === 'bureau-petition'
              ? 'Read the visitor’s paperwork petition. No score or policy changes happen automatically.' : kind !== 'appeal'
              ? 'None. The report opens automatically after successful delivery.'
              : 'Review the requested points. The score stays unchanged unless you update it.',
            ...details,
            ...(bureauNotes ? {'Bureau context': `${division === 'feline' ? 'Feline' : 'Human'} ${action} #${sequence} on this browser.\n${bureauNotes}`} : {}),
        };
        let body = JSON.stringify(fields);
        const headers = {'Accept': 'application/json'};
        const receiptUrl = `https://formsubmit.co/?boomerkarma_receipt=${reference}`;
        if (attachment) {
          body = new FormData();
          Object.entries(fields).forEach(([name, value]) => body.append(name, value));
          body.append('attachment', attachment, `${reference}-kemberton.jpg`);
          // The AJAX endpoint silently omits files. Native multipart delivery
          // redirects to _next only after accepting the request. Keep that
          // receipt on the provider's CORS-enabled origin so fetch can follow it.
          body.append('_next', receiptUrl);
        } else {
          headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(attachment ? endpoint.replace('/ajax/', '/') : endpoint, {
          method: 'POST', headers, body,
          credentials: 'omit',
          // The delivery provider requires a web origin; never send URL paths or query strings.
          referrerPolicy: 'origin',
          signal: AbortSignal.timeout(attachment ? 45000 : 25000),
        });
        if (!response.ok) throw new Error('Delivery unavailable');
        if (attachment) {
          if (!response.redirected || response.url !== receiptUrl) throw new Error('Portrait delivery not confirmed');
        } else {
          const outcome = await response.json();
          if (outcome.success !== true && outcome.success !== 'true') throw new Error(outcome.message || 'Delivery not accepted');
        }
        attempts.delete(kind);
        // Optional comedy must never turn confirmed delivery into a failed send.
        try { window.BoomerKarmaBureau?.record(action, division); } catch { /* Keep report release independent. */ }
        return true;
      } catch (error) {
        console.warn('BoomerKarma delivery:', error.message);
        throw error;
      } finally {
        pending.delete(kind);
      }
    },
  };
})();
