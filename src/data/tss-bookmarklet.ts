import { installTssBookingHelper } from '../scripts/tss-booking-helper.mjs';

// Self-contained: no remote script injection, credentials, or student data.
// Runs only when the user activates the saved bookmark on the official TSS site.
export const tssBookmarkletUrl = `javascript:${encodeURIComponent(`void (${installTssBookingHelper.toString()})(${JSON.stringify({
  tssOrigin: 'https://tss.ucsd.edu',
  appOrigin: 'https://boomerrawlings.com',
  appPath: '/0311/',
})})`)}`;
