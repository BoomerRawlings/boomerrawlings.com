const TSS_ORIGIN = 'https://tss.ucsd.edu';
const CHANNEL = 'bbb-tss-v1';
const PING_INTERVAL_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 20_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 120_000;

type Stage = 'loading' | 'checking' | 'review' | 'submitting' | 'submitted' | 'stopped' | 'error';
const stageMessages: Record<Stage, string> = {
  loading: 'Opening the selected course in TSS…',
  checking: 'Checking this course in TSS…',
  review: 'TSS needs your review. Open TSS to continue.',
  submitting: 'Sending the Book request in TSS…',
  submitted: 'Book request sent. Check TSS to confirm enrollment.',
  stopped: 'Booking stopped. Check TSS before trying again.',
  error: 'TSS could not complete this request. Check TSS before trying again.',
};
const terminalStages = new Set<Stage>(['submitted', 'stopped', 'error']);
const stageRanks: Record<Stage, number> = { loading: 0, checking: 1, review: 2, submitting: 3, submitted: 4, stopped: 4, error: 4 };

const connection = document.querySelector<HTMLElement>('[data-tss-connection]');
const connectionStatus = document.querySelector<HTMLElement>('[data-tss-connection-status]');
const jobStatus = document.querySelector<HTMLElement>('[data-tss-job-status]');
const setupButton = document.querySelector<HTMLButtonElement>('[data-tss-setup]');
const disconnectButton = document.querySelector<HTMLButtonElement>('[data-tss-disconnect]');
const focusButton = document.querySelector<HTMLButtonElement>('[data-tss-focus]');
const dialog = document.querySelector<HTMLDialogElement>('[data-tss-dialog]');
const bookmarklet = document.querySelector<HTMLAnchorElement>('[data-tss-bookmarklet]');
const copyButton = document.querySelector<HTMLButtonElement>('[data-tss-copy-code]');
const showCodeButton = document.querySelector<HTMLButtonElement>('[data-tss-show-code]');
const codeField = document.querySelector<HTMLElement>('[data-tss-code-field]');
const bookmarkCode = document.querySelector<HTMLTextAreaElement>('[data-tss-bookmark-code]');
const copyStatus = document.querySelector<HTMLElement>('[data-tss-copy-status]');

// Only the exact, server-rendered routes present at startup may be requested.
// Later DOM edits cannot replace a captured destination.
const knownButtons = new Map<HTMLButtonElement, string>();
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tss-book]')) {
  const route = button.dataset.bookRoute;
  if (!route || button.disabled) continue;
  try {
    const url = new URL(route);
    if (url.origin === TSS_ORIGIN && url.pathname === '/fiori'
      && /^#ZUSModule-display\?TileType=MYMOD&\/Detail\/EventPackage\/SM\/\d+\/00000000\/0\/0\/0\/00000000-0000-0000-0000-000000000000\/\d+\/\d{4}\/\d+\/\?$/.test(url.hash)) {
      knownButtons.set(button, route);
    } else button.disabled = true;
  } catch { button.disabled = true; }
}

const fragment = window.location.hash;
let nonce = /^#tss-connect=([a-f0-9]{32,64})$/i.exec(fragment)?.[1] || '';
if (fragment.startsWith('#tss-connect=')) {
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}
let peer: Window | null = nonce ? window.opener : null;
let connected = false;
let lastSeen = 0;
let currentRequestId: string | null = null;
let highestStageRank = -1;
let lastStage: Stage | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
let requestTimer: ReturnType<typeof setTimeout> | undefined;

const text = (element: HTMLElement | null, value: string) => {
  if (element) element.textContent = value;
};
const setBusy = (busy: boolean) => {
  knownButtons.forEach((_route, button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  });
};
const renderConnection = (message: string) => {
  if (connection) connection.dataset.state = connected ? 'connected' : 'disconnected';
  text(connectionStatus, message);
  if (setupButton) setupButton.hidden = connected;
  if (disconnectButton) disconnectButton.hidden = !connected;
  if (focusButton) focusButton.hidden = !connected;
};
const post = (payload: Record<string, unknown>) => {
  if (!peer || !nonce || peer.closed) return false;
  try {
    peer.postMessage({ channel: CHANNEL, nonce, ...payload }, TSS_ORIGIN);
    return true;
  } catch { return false; }
};
const disconnect = (message: string, notifyPeer = true) => {
  if (notifyPeer) post({ type: 'disconnect' });
  clearInterval(heartbeatTimer);
  clearTimeout(handshakeTimer);
  clearTimeout(requestTimer);
  heartbeatTimer = undefined;
  handshakeTimer = undefined;
  requestTimer = undefined;
  connected = false;
  nonce = '';
  peer = null;
  currentRequestId = null;
  highestStageRank = -1;
  lastStage = null;
  setBusy(false);
  renderConnection('TSS not connected');
  text(jobStatus, message);
};
const healthy = () => connected && peer !== null && !peer.closed && Date.now() - lastSeen < HEARTBEAT_TIMEOUT_MS;
const ping = () => {
  if (!healthy()) {
    disconnect(currentRequestId
      ? 'Connection lost before a final result. Check TSS before reconnecting or retrying.'
      : 'Connection lost. Run your Connect TSS bookmark again.');
    return;
  }
  if (!post({ type: 'ping' })) disconnect('TSS is unavailable. Run your Connect TSS bookmark again.');
};
const openSetup = () => {
  if (dialog && !dialog.open) dialog.showModal();
};

window.addEventListener('message', (event: MessageEvent) => {
  if (!nonce || !peer || event.origin !== TSS_ORIGIN || event.source !== peer || event.source !== window.opener) return;
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.channel !== CHANNEL || data.nonce !== nonce) return;

  if (data.type === 'hello') {
    lastSeen = Date.now();
    if (!post({ type: 'ack' })) { disconnect('Connection failed. Run your Connect TSS bookmark again.', false); return; }
    if (!connected) {
      clearTimeout(handshakeTimer);
      connected = true;
      renderConnection('TSS connected');
      text(jobStatus, 'Choose a course and click Book.');
      dialog?.close();
      heartbeatTimer = setInterval(ping, PING_INTERVAL_MS);
      ping();
    }
    return;
  }
  if (!connected) return;
  if (data.type === 'pong') { lastSeen = Date.now(); return; }
  if (data.type === 'ping') { lastSeen = Date.now(); post({ type: 'pong' }); return; }
  if (data.type === 'disconnect') {
    disconnect(currentRequestId
      ? 'TSS disconnected before a final result. Check TSS before trying again.'
      : 'TSS disconnected. Run your Connect TSS bookmark again.', false);
    return;
  }
  if (data.type !== 'status' || !currentRequestId || data.requestId !== currentRequestId
    || typeof data.status !== 'string' || !Object.hasOwn(stageMessages, data.status)) return;

  const stage = data.status as Stage;
  if (stage === lastStage || (stage !== 'review' && stageRanks[stage] < highestStageRank)) return;
  lastStage = stage;
  highestStageRank = Math.max(highestStageRank, stageRanks[stage]);
  lastSeen = Date.now();
  // Never inject remote HTML or expose server/student context in this page.
  text(jobStatus, stageMessages[stage]);
  if (terminalStages.has(stage)) {
    clearTimeout(requestTimer);
    requestTimer = undefined;
    currentRequestId = null;
    highestStageRank = -1;
    lastStage = null;
    setBusy(false);
  }
});

knownButtons.forEach((route, button) => button.addEventListener('click', event => {
  if (!event.isTrusted || currentRequestId || button.disabled) return;
  if (!healthy()) {
    if (connected) disconnect('Connection expired. Reconnect TSS before booking.');
    openSetup();
    return;
  }
  const requestId = crypto.randomUUID();
  currentRequestId = requestId;
  highestStageRank = -1;
  lastStage = null;
  setBusy(true);
  text(jobStatus, stageMessages.loading);
  if (!post({ type: 'book', requestId, route })) {
    disconnect('The request could not be sent. Reconnect TSS.');
    return;
  }
  requestTimer = setTimeout(() => {
    if (currentRequestId === requestId) disconnect('No final result received. Check TSS before reconnecting or retrying.');
  }, REQUEST_TIMEOUT_MS);
}));

setupButton?.addEventListener('click', openSetup);
disconnectButton?.addEventListener('click', () => disconnect(currentRequestId
  ? 'Disconnected. A request may already have reached TSS; check there before retrying.'
  : 'Disconnected. Run your Connect TSS bookmark to reconnect.'));
focusButton?.addEventListener('click', event => {
  if (!event.isTrusted || !peer || peer.closed) return;
  try { peer.focus(); } catch { /* The user can switch to the connected tab manually. */ }
});
bookmarklet?.addEventListener('click', event => {
  event.preventDefault();
  text(copyStatus, 'Drag Connect TSS to your bookmarks bar, then run it from your TSS tab.');
});
const revealCode = () => {
  if (codeField) codeField.hidden = false;
  bookmarkCode?.focus();
  bookmarkCode?.select();
};
showCodeButton?.addEventListener('click', revealCode);
copyButton?.addEventListener('click', async () => {
  if (!bookmarkCode) return;
  try {
    await navigator.clipboard.writeText(bookmarkCode.value);
    text(copyStatus, 'Copied. Paste into the URL field of a bookmark named Connect TSS.');
  } catch {
    revealCode();
    text(copyStatus, 'Copy the selected code into a bookmark’s URL field.');
  }
});

if (nonce && peer) {
  renderConnection('Connecting to TSS…');
  handshakeTimer = setTimeout(() => disconnect('No TSS connection received. Run your Connect TSS bookmark again.', false), HANDSHAKE_TIMEOUT_MS);
} else {
  const missingOpener = Boolean(nonce && !peer);
  nonce = '';
  peer = null;
  renderConnection('TSS not connected');
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (missingOpener) text(jobStatus, 'This browser did not preserve the TSS connection. Keep TSS open and run your Connect TSS bookmark again. If this persists, the connection is unavailable in this browser.');
  else if (navigation?.type === 'reload') text(jobStatus, 'Page reloaded. Run your Connect TSS bookmark again to reconnect.');
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && connected) ping();
});
window.addEventListener('pagehide', () => disconnect('Page closed or reloaded. Reconnect TSS to continue.'));
window.addEventListener('pageshow', event => {
  if (event.persisted) disconnect('Page restored. Run your Connect TSS bookmark again to reconnect.', false);
});
