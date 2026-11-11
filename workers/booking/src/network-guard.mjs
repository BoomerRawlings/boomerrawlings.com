import { allowProbeRequest, authorizeNativeWrite } from './read-only.mjs';
import { Buffer } from 'node:buffer';

// A response header, not an editable iframe attribute: popup/form targets are
// denied by Chromium before a second target can send its first request. Frames
// and workers remain disabled until a real SSO probe establishes a safe need.
export const DOCUMENT_POLICY = "sandbox allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation; frame-src 'none'; worker-src 'none'; object-src 'none'; connect-src https:";

export async function installNetworkGuard(page, { getJob = () => null, onBlocked = () => {} } = {}) {
  await page.setBypassServiceWorker(true);
  await page.setCacheEnabled(false);
  const client = await page.createCDPSession();
  client.on('Fetch.requestPaused', async event => {
    const { requestId, request, resourceType } = event;
    try {
      if (event.responseErrorReason) {
        await client.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        return;
      }
      if (event.responseStatusCode !== undefined) {
        const redirect = [301, 302, 303, 307, 308].includes(event.responseStatusCode);
        const original = redirect ? null : await client.send('Fetch.getResponseBody', { requestId });
        if (original && original.body.length > 4 * 1024 * 1024) throw new Error('Document too large');
        await client.send('Fetch.fulfillRequest', {
          requestId, responseCode: event.responseStatusCode,
          ...(event.responseStatusText ? { responsePhrase: event.responseStatusText } : {}),
          responseHeaders: [...(event.responseHeaders || []).filter(header => !['content-length', 'content-encoding'].includes(header.name.toLowerCase())), { name: 'Content-Security-Policy', value: DOCUMENT_POLICY }],
          ...(original ? { body: original.base64Encoded ? original.body : Buffer.from(original.body).toString('base64') } : {}),
        });
        return;
      }
      const description = { url: request.url, method: request.method, headers: request.headers,
        body: request.postData, resourceType: resourceType.toLowerCase() };
      if (allowProbeRequest(description) || authorizeNativeWrite(description, getJob())) {
        await client.send('Fetch.continueRequest', { requestId, ...(resourceType === 'Document' ? { interceptResponse: true } : {}) });
      } else {
        const url = new URL(request.url);
        onBlocked({ hostname: url.hostname, pathname: url.pathname, method: request.method });
        await client.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
    } catch {
      // Unsupported response-header interception fails closed, never reloads a
      // document without the popup policy. No raw protocol errors are logged.
      await client.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    }
  });
  await client.send('Fetch.enable', { patterns: [
    { urlPattern: '*', requestStage: 'Request' },
    { urlPattern: '*', resourceType: 'Document', requestStage: 'Response' },
  ] });
  return client;
}
