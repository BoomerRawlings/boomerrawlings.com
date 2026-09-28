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
    document.querySelectorAll('a[href="/BoomerKarma/"]').forEach(link => {
      link.setAttribute('href', '/BoomerKarma/?test=1');
    });
  }
  window.BoomerKarmaDelivery = {
    async send(kind, answers) {
      const entries = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.entries(answers) : [];
      const fingerprint = JSON.stringify(entries);
      if (!['report', 'appeal'].includes(kind) || !entries.length || entries.length > 20
        || entries.some(([label, value]) => !label.trim() || label.startsWith('_') || label.length > 80 || typeof value !== 'string')
        || !answers['Submitted message']?.trim() || fingerprint.length > 16000 || pending.has(kind)) {
        throw new Error('Invalid or duplicate submission');
      }
      // Keep a retry's reference stable. Answers stay only in memory, never browser storage.
      if (attempts.get(kind)?.fingerprint !== fingerprint) {
        const submitted = new Date();
        attempts.set(kind, {
          fingerprint,
          reference: `BK-${submitted.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
          time: new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'long',
          }).format(submitted),
        });
      }
      const {reference, time} = attempts.get(kind);
      const title = kind === 'report' ? 'Report request' : 'Points appeal';
      const {'Submitted message': message, ...details} = answers;
      pending.add(kind);
      try {
        const honey = document.querySelector('#karma-website')?.value || '';
        if (honey) throw new Error('Unable to send this submission');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'Accept':'application/json'},
          credentials: 'omit',
          // The delivery provider requires a web origin; never send URL paths or query strings.
          referrerPolicy: 'origin',
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            _subject: `${testMode ? '[TEST ONLY] ' : ''}BoomerKarma | ${title} | ${reference}`,
            _template: 'table',
            _captcha: 'false',
            _honey: honey,
            'Submission': testMode ? `TEST ONLY — ${title}. No visitor action.` : `Website submission — ${title}`,
            'Submitted message': message,
            'Submitted (Pacific time)': time,
            'Reference': reference,
            'Action needed': testMode ? 'None. This is a delivery test.' : kind === 'report'
              ? 'None. The report opens automatically after successful delivery.'
              : 'Review the requested points. The score stays unchanged unless you update it.',
            ...details,
          }),
        });
        if (!response.ok) throw new Error('Delivery unavailable');
        const outcome = await response.json();
        if (outcome.success !== true && outcome.success !== 'true') throw new Error(outcome.message || 'Delivery not accepted');
        attempts.delete(kind);
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
