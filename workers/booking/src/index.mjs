import { createBrowserController } from './browser.mjs';
import { SessionCore, QuotaCore, handleRequest, json } from './session.mjs';

export class BookingSession extends SessionCore {
  constructor(ctx, env) { super(ctx, env, { createBrowser: createBrowserController }); }
}
export class BookingQuota extends QuotaCore {}

export default {
  async fetch(request, env) {
    try { return await handleRequest(request, env); }
    catch { return json({ state: 'error', message: 'Booking service unavailable.', probeOnly: env.PROBE_ONLY !== 'false' }, 503); }
  },
};
