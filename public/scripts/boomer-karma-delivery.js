(() => {
  // Public form address, not a credential. Delivery is restricted to the verified owner inbox.
  const endpoint = 'https://formsubmit.co/ajax/f82adb0b9ed6790297a1321a5e73fba0';
  const pending = new Set();
  window.BoomerKarmaDelivery = {
    async send(kind, paperwork) {
      if (!['report', 'appeal'].includes(kind) || typeof paperwork !== 'string'
        || !paperwork.trim() || paperwork.length > 12000 || pending.has(kind)) {
        throw new Error('Invalid or duplicate submission');
      }
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
            _subject: `BoomerKarma — ${kind === 'report' ? 'new report request' : 'new appeal'}`,
            _template: 'table',
            _captcha: 'false',
            _honey: honey,
            request_type: kind,
            paperwork,
          }),
        });
        if (!response.ok) throw new Error('Delivery unavailable');
        const outcome = await response.json();
        if (outcome.success !== true && outcome.success !== 'true') throw new Error(outcome.message || 'Delivery not accepted');
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
