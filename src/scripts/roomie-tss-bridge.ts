const API = '/0311/api';
const POLL_MS = 5_000;
const FRESH_MS = 15_000;
type SessionState = 'checking' | 'signed_out' | 'signing_in' | 'ready' | 'expired' | 'busy' | 'error';
const serverStates = new Set(['signed_out', 'signing_in', 'ready', 'expired', 'busy', 'error']);
const session = document.querySelector<HTMLElement>('[data-tss-session]');
const sessionStatus = document.querySelector<HTMLElement>('[data-tss-session-status]');
const jobStatus = document.querySelector<HTMLElement>('[data-tss-job-status]');
const loginButton = document.querySelector<HTMLButtonElement>('[data-tss-login]');
const logoutButton = document.querySelector<HTMLButtonElement>('[data-tss-logout]');
const inspectButton = document.querySelector<HTMLButtonElement>('[data-tss-inspect]');
const reviewButton = document.querySelector<HTMLButtonElement>('[data-tss-review]');
const warning = document.querySelector<HTMLElement>('[data-tss-warning]');
const warningMessage = document.querySelector<HTMLElement>('[data-tss-warning-message]');
const confirmButton = document.querySelector<HTMLButtonElement>('[data-tss-confirm]');
const cancelButton = document.querySelector<HTMLButtonElement>('[data-tss-cancel]');
const probeNote = document.querySelector<HTMLElement>('[data-tss-probe-note]');

// Capture only the server-rendered destinations. Later DOM edits cannot replace them.
const knownButtons = new Map<HTMLButtonElement, string>();
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tss-book]')) {
  const route = button.dataset.bookRoute;
  try {
    const url = new URL(route || '');
    if (!button.disabled && url.origin === 'https://tss.ucsd.edu' && url.pathname === '/fiori'
      && !url.username && !url.password && !url.search
      && /^#ZUSModule-display\?TileType=MYMOD&\/Detail\/EventPackage\/SM\/[1-9]\d*\/00000000\/0\/0\/0\/00000000-0000-0000-0000-000000000000\/[1-9]\d*\/\d{4}\/[1-9]\d*\/\?$/.test(url.hash)) {
      knownButtons.set(button, route!);
    } else button.disabled = true;
  } catch { button.disabled = true; }
}

let state: SessionState = 'checking';
let csrf = '';
let probeOnly = true;
let lastStatusAt = 0;
let expiresAt = 0;
let revision = 0;
let mutating = false;
let reading = false;
let departed = false;
let uncertain = false;
let statusFailure = false;
let authenticationStatus = '';
let activeBookId: string | null = null;
let bookingStage = '';
let directReview = false;
let confirmationId = '';
const completedBookings = new Set<string>();
let loginPopup: Window | null = null;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let bookingTimer: ReturnType<typeof setTimeout> | undefined;
const controllers = new Set<AbortController>();
let activeFeedback: HTMLElement | null = null;
let submittedNoticeFeedback: HTMLElement | null = null;
const clearSubmittedNotice = () => {
  if (submittedNoticeFeedback) submittedNoticeFeedback.textContent = '';
  submittedNoticeFeedback = null;
};
const text = (element: HTMLElement | null, message: string) => {
  if (element) element.textContent = message;
  if (element === jobStatus && activeFeedback) activeFeedback.textContent = message;
};
const failureMessages: Record<string, string> = {
  authentication_unavailable: 'TSS could not confirm sign-in. No Book request was sent.',
  authentication_required: 'Your UCSD session needs sign-in again.',
  existing_registration: 'TSS still reports a registration for this section. Check My Courses before trying again.',
  pending_changes: 'TSS has an unfinished section change. Review it in My Courses.',
  booking_unavailable: 'TSS does not currently allow this section to be booked.',
  eligibility_unavailable: 'TSS reports an enrollment requirement that needs review.',
  course_group_unavailable: 'TSS requires a course-group choice before booking.',
  assessment_review: 'TSS requires an assessment choice before booking.',
  additional_choices: 'TSS requires additional choices before booking.',
  course_load_timeout: 'TSS did not load the selected course in time. No Book request was sent.',
  course_refresh_failed: 'TSS could not refresh the selected course. No Book request was sent.',
  request_check_failed: 'TSS could not complete its registration check. No final Book request was sent.',
  request_blocked: 'The booking request was blocked. Check TSS before trying again.',
  action_timeout: 'TSS did not return a result in time. Check My Courses before trying again.',
  submission_uncertain: 'The Book request has no confirmed result. Check My Courses before trying again.',
  booking_cancelled: 'Booking was cancelled.',
  booking_error: 'TSS rejected the booking. Review the result in My Courses.',
  session_expired: 'Your booking session expired. Check My Courses before trying again.',
  session_unavailable: 'Your booking session disconnected. Check My Courses before trying again.',
  previous_attempt: 'Review the previous attempt in My Courses before starting another.',
  route_mismatch: 'The selected course could not be verified. No Book request was sent.',
  context_mismatch: 'The selected section could not be verified. No Book request was sent.',
  native_context_unavailable: 'TSS did not finish opening the selected course.',
  details_loading: 'TSS has not finished loading the course details.',
  event_data_unavailable: 'TSS did not return complete section details.',
  ambiguous_package: 'TSS returned multiple section choices. Review the package in TSS.',
  section_mismatch: 'TSS returned different sections than the selected option.',
  duplicate_sections: 'TSS returned duplicate sections for this option.',
  unsupported_tss: 'The current TSS booking screen is unsupported.',
  payload_mismatch: 'The booking details could not be verified. No Book request was sent.',
  booking_context_changed: 'The booking details changed. Check TSS before trying again.',
  native_action_failed: 'TSS stopped during booking. Check My Courses before trying again.',
  warning_unavailable: 'TSS returned a warning that needs review before booking.',
  attempt_unavailable: 'The previous attempt could not be recovered. Check My Courses before trying again.',
};
const failureText = (reason: unknown, fallback: string) => typeof reason === 'string' && Object.hasOwn(failureMessages, reason) ? failureMessages[reason] : fallback;
const authenticationUnavailable = 'TSS could not confirm sign-in. Your sign-in stays open; checking again.';
function authenticationMessage(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const auth = value as { code?: unknown; authentication?: { page?: unknown; issue?: unknown } };
  const snapshot = auth.authentication;
  const pages = ['login_choice', 'credentials_ad', 'credentials_student', 'duo', 'ucsd_error', 'tss_loading', 'tss', 'other'];
  const page = typeof snapshot?.page === 'string' && pages.includes(snapshot.page) ? snapshot.page : '';
  const issue = page ? snapshot?.issue : undefined;
  if (page === 'ucsd_error' || issue === 'ucsd_login_exception') return 'UCSD sign-in returned an error. Check the sign-in tab.';
  if (issue === 'service_unavailable') return 'TSS is temporarily unavailable. Your sign-in stays open; checking again.';
  if ((typeof issue === 'string' && ['network_error', 'request_timeout', 'missing_csrf', 'unexpected_response'].includes(issue))
    || auth.code === 'authentication_unavailable') return authenticationUnavailable;
  if (page === 'tss_loading') return 'TSS is loading. Your sign-in stays open; checking again.';
  if (page === 'duo') return 'Complete Duo in the sign-in tab.';
  if (page === 'login_choice') return 'Choose your UCSD sign-in option in the sign-in tab.';
  return '';
}
const fresh = () => lastStatusAt > 0 && Date.now() - lastStatusAt < FRESH_MS;
const busy = () => mutating || Boolean(activeBookId) || state === 'busy';
const closeLogin = () => {
  try { loginPopup?.close(); } catch { /* A closed popup needs no cleanup. */ }
  loginPopup = null;
};
const render = () => {
  const messages: Record<SessionState, string> = {
    checking: 'Checking sign-in…', signed_out: 'Not signed in', signing_in: 'Complete UCSD sign-in',
    ready: probeOnly ? 'Login test — booking unavailable' : 'Signed in · ready to book',
    expired: 'Session expired · sign in again', busy: 'TSS is working…', error: 'TSS session unavailable',
  };
  if (session) session.dataset.state = state;
  text(sessionStatus, uncertain ? 'Booking result unknown · check TSS before trying again'
    : state === 'signing_in' && authenticationStatus ? authenticationStatus : messages[state]);
  if (probeNote) probeNote.hidden = !probeOnly;
  if (loginButton) {
    loginButton.disabled = busy() || state === 'ready' || uncertain || !csrf || !fresh() || departed;
    loginButton.textContent = state === 'ready' ? 'Signed in with UCSD'
      : state === 'signing_in' ? 'Continue UCSD sign-in' : 'Sign in with UCSD';
  }
  if (logoutButton) {
    logoutButton.hidden = !csrf || (!uncertain && ['checking', 'signed_out', 'expired'].includes(state));
    logoutButton.disabled = mutating || departed;
  }
  if (inspectButton) {
    inspectButton.hidden = !probeOnly || state !== 'ready';
    inspectButton.disabled = busy() || !fresh() || !csrf || uncertain || departed;
  }
  if (reviewButton) {
    reviewButton.hidden = bookingStage !== 'review' || !activeBookId || directReview;
    reviewButton.disabled = mutating || !csrf || !fresh() || departed;
  }
  if (warning) warning.hidden = bookingStage !== 'review' || !activeBookId || !directReview || !confirmationId;
  for (const button of [confirmButton, cancelButton]) if (button) {
    button.disabled = bookingStage !== 'review' || !activeBookId || !directReview || !confirmationId
      || mutating || !csrf || !fresh() || departed;
  }
  knownButtons.forEach((_route, button) => {
    button.disabled = probeOnly || busy() || uncertain || !csrf || !fresh() || departed
      || !['ready', 'signed_out', 'expired'].includes(state);
    button.setAttribute('aria-busy', String(Boolean(activeBookId)));
  });
};

class ApiError extends Error {
  constructor(public status: number, public reason?: string) { super('The session request failed.'); }
}
async function request(path: string, body?: Record<string, unknown>, timeout = 20_000) {
  const controller = new AbortController();
  controllers.add(controller);
  const deadline = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API}/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json', 'X-BBB-CSRF': csrf } : { Accept: 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
    });
    if (!response.ok) {
      let reason;
      try {
        if (response.headers.get('content-type')?.includes('application/json')) {
          const error = await response.json();
          const candidate = error?.booking?.reason ?? error?.reason;
          if (typeof candidate === 'string' && Object.hasOwn(failureMessages, candidate)) reason = candidate;
        }
      } catch { /* Never expose a raw error body. */ }
      throw new ApiError(response.status, reason);
    }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError(502);
    const value = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(502);
    return value as Record<string, unknown>;
  } finally {
    clearTimeout(deadline);
    controllers.delete(controller);
  }
}
function liveView(value: unknown): string {
  if (typeof value !== 'string' || value.length > 12_000) throw new ApiError(502);
  const url = new URL(value);
  if (url.origin !== 'https://live.browser.run' || url.username || url.password
    || url.pathname !== '/ui/view' || url.searchParams.get('mode') !== 'tab') throw new ApiError(502);
  return url.href;
}
function lockResult(message = 'No confirmed result received. Check TSS before starting another booking.') {
  uncertain = true;
  activeBookId = null;
  bookingStage = '';
  confirmationId = ''; directReview = false; text(warningMessage, '');
  clearTimeout(bookingTimer);
  text(jobStatus, message);
}
function bookingResult(value: Record<string, unknown>) {
  if (!activeBookId || value.requestId !== activeBookId) return false;
  const ranks: Record<string, number> = { loading: 1, checking: 2, review: 3, submitting: 4, submitted: 5, stopped: 5, error: 5 };
  if (typeof value.stage !== 'string' || !ranks[value.stage]) return false;
  if (ranks[value.stage] < (ranks[bookingStage] || 0)) return true;
  if (value.stage !== 'review') { confirmationId = ''; directReview = false; text(warningMessage, ''); }
  if (value.stage !== bookingStage) {
    clearTimeout(bookingTimer);
    if (['loading', 'checking', 'submitting'].includes(value.stage)) bookingTimer = setTimeout(() => { lockResult(); render(); }, 130_000);
    bookingStage = value.stage;
  }
  switch (value.stage) {
    case 'loading':
    case 'checking': text(jobStatus, 'Checking the selected course in TSS…'); break;
    case 'submitting': text(jobStatus, 'Sending the Book request…'); break;
    case 'review':
      directReview = value.mode === 'direct';
      confirmationId = '';
      if (directReview && typeof value.reviewMessage === 'string' && value.reviewMessage.trim()
        && value.reviewMessage.length <= 4000 && typeof value.confirmationId === 'string'
        && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.confirmationId)) {
        confirmationId = value.confirmationId;
        text(warningMessage, value.reviewMessage);
        text(jobStatus, 'TSS returned a warning. Review it before confirming booking.');
      } else if (directReview) {
        text(warningMessage, '');
        text(jobStatus, 'The TSS warning could not be loaded. Booking has not been confirmed.');
      } else text(jobStatus, 'TSS needs your review before it can continue.');
      break;
    case 'submitted':
      completedBookings.add(activeBookId);
      activeBookId = null; bookingStage = ''; closeLogin();
      // A warning returned with SaveChanges is informational: submission already
      // happened. Render plain text without reopening confirmation or retrying.
      const notice = value.mode === 'direct' && typeof value.noticeMessage === 'string' && value.noticeMessage.trim()
        && value.noticeMessage.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.noticeMessage)
        ? ` TSS says: ${value.noticeMessage}` : '';
      text(jobStatus, `Book request sent.${notice} Check TSS to confirm enrollment.`);
      submittedNoticeFeedback = notice ? activeFeedback : null;
      break;
    case 'stopped':
      completedBookings.add(activeBookId);
      activeBookId = null; bookingStage = ''; closeLogin();
      text(jobStatus, failureText(value.reason, 'Booking stopped. Review TSS before trying again.'));
      break;
    case 'error': lockResult(failureText(value.reason, 'No confirmed result received. Check TSS before starting another booking.')); break;
    default: return false;
  }
  return true;
}
function acceptStatus(value: Record<string, unknown>) {
  if (typeof value.state !== 'string' || !serverStates.has(value.state)
    || typeof value.csrf !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(value.csrf)
    || typeof value.probeOnly !== 'boolean') throw new ApiError(502);
  const expiry = value.expiresAt == null ? 0 : typeof value.expiresAt === 'number'
    ? value.expiresAt : typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
  if (!Number.isFinite(expiry) || expiry < 0) throw new ApiError(502);
  const previousState = state;
  state = value.state as SessionState;
  authenticationStatus = authenticationMessage(value.authDiagnostics);
  csrf = value.csrf;
  probeOnly = value.probeOnly;
  lastStatusAt = Date.now();
  expiresAt = expiry;
  if (expiry && expiry <= Date.now() && !['signed_out', 'expired'].includes(state)) state = 'expired';
  if (statusFailure && !uncertain) text(jobStatus, '');
  statusFailure = false;
  if (previousState === 'signing_in' && state === 'ready' && !uncertain) {
    text(jobStatus, probeOnly ? 'Signed in. Select Check session to verify access.' : 'Signed in. Choose a course below.');
  }
  if (value.booking && typeof value.booking === 'object' && !Array.isArray(value.booking)) {
    const booking = value.booking as Record<string, unknown>;
    // Restoring server-owned status is read-only. Reloading cannot hide an
    // unfinished or uncertain booking, and never starts another Book request.
    if (!activeBookId && !uncertain && typeof booking.requestId === 'string'
      && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(booking.requestId)
      && !completedBookings.has(booking.requestId)) activeBookId = booking.requestId;
    if (activeBookId && !bookingResult(booking)) lockResult();
  }
  if (activeBookId && ['signed_out', 'expired', 'error'].includes(state)) lockResult();
  if (state === 'ready' && !activeBookId) closeLogin();
  clearTimeout(expiryTimer);
  if (expiry > Date.now()) expiryTimer = setTimeout(() => {
    state = 'expired'; lastStatusAt = 0; csrf = '';
    if (activeBookId) lockResult();
    else text(jobStatus, 'Sign in again before booking.');
    render();
    void refreshStatus();
  }, Math.min(expiry - Date.now(), 2_147_483_647));
  render();
}
function schedulePoll() {
  clearTimeout(pollTimer);
  if (!departed && document.visibilityState === 'visible') pollTimer = setTimeout(() => { void refreshStatus(); }, POLL_MS);
}
async function refreshStatus() {
  if (departed || document.visibilityState !== 'visible') return;
  if (reading || mutating) { schedulePoll(); return; }
  const observedRevision = revision;
  reading = true;
  try {
    const value = await request('status');
    if (observedRevision === revision && !departed) acceptStatus(value);
  } catch {
    if (observedRevision === revision && !departed) {
      state = 'error'; lastStatusAt = 0; csrf = '';
      if (activeBookId) lockResult();
      else {
        statusFailure = true;
        text(jobStatus, 'Sign-in service unavailable. You can still use the direct TSS links.');
      }
      render();
    }
  } finally { reading = false; schedulePoll(); }
}
function requireFresh() {
  if (expiresAt && Date.now() >= expiresAt && !['signed_out', 'expired'].includes(state)) {
    state = 'expired'; lastStatusAt = 0;
    render();
  }
  if (fresh() && csrf && !departed) return true;
  text(jobStatus, 'Refreshing your session. Please try again when the status updates.');
  void refreshStatus();
  return false;
}
async function signIn() {
  if (busy() || uncertain || !requireFresh()) return;
  if (state === 'signing_in' && loginPopup && !loginPopup.closed) { loginPopup.focus(); return; }
  const popup = window.open('about:blank', '_blank');
  if (!popup) { text(jobStatus, 'Allow the sign-in popup, then select Sign in with UCSD again.'); return; }
  try { popup.opener = null; } catch { popup.close(); return; }
  loginPopup = popup;
  mutating = true; revision++; render();
  text(jobStatus, 'Opening your private UCSD sign-in…');
  try {
    const value = await request('login', { requestId: crypto.randomUUID() }, 60_000);
    if (departed) return;
    popup.location.replace(liveView(value.loginUrl));
    state = 'signing_in';
    authenticationStatus = '';
    text(jobStatus, 'Complete UCSD sign-in in the window that opened. Then choose a course here.');
  } catch {
    closeLogin(); state = 'error';
    text(jobStatus, 'Sign-in could not be opened. Try again when the session status updates.');
  } finally { mutating = false; render(); void refreshStatus(); }
}
async function signOut() {
  if (mutating || !csrf || departed) return;
  mutating = true; revision++; render();
  const hadUncertainResult = uncertain || Boolean(activeBookId);
  try {
    const value = await request('logout', { requestId: crypto.randomUUID() });
    if (value.state !== 'signed_out') throw new ApiError(502);
    closeLogin(); state = 'signed_out'; csrf = ''; expiresAt = 0;
    activeBookId = null; uncertain = false; bookingStage = ''; clearTimeout(bookingTimer);
    clearSubmittedNotice();
    text(jobStatus, hadUncertainResult ? 'Signed out. Check TSS before repeating any uncertain booking.' : 'Signed out.');
  } catch { text(jobStatus, 'Sign-out could not be confirmed. Please try again.'); }
  finally { mutating = false; render(); void refreshStatus(); }
}
async function inspectSession() {
  if (busy() || uncertain || state !== 'ready' || !probeOnly || !requireFresh()) return;
  const route = knownButtons.values().next().value;
  if (!route) return;
  mutating = true; revision++; render();
  text(jobStatus, 'Checking your TSS session…');
  try {
    const value = await request('inspect', { requestId: crypto.randomUUID(), route }, 60_000);
    text(jobStatus, value.state === 'ready' && value.loaded === true && value.csrfReady === true
      ? 'Session verified. No booking request was sent.'
      : 'The booking session is not verified yet. No booking request was sent.');
  } catch { text(jobStatus, 'The session could not be verified. No booking request was sent.'); }
  finally { mutating = false; render(); void refreshStatus(); }
}
async function book(route: string) {
  if (busy() || uncertain || probeOnly || !requireFresh()) return;
  if (state !== 'ready') { await signIn(); return; }
  clearSubmittedNotice();
  activeBookId = crypto.randomUUID(); bookingStage = ''; mutating = true; revision++; render();
  text(jobStatus, 'Checking the selected course in TSS…');
  try {
    const value = await request('book', { requestId: activeBookId, route }, 120_000);
    const result = value.booking && typeof value.booking === 'object' ? value.booking as Record<string, unknown> : value;
    if (!bookingResult(result)) lockResult();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && error.reason === 'authentication_unavailable') {
      activeBookId = null; bookingStage = ''; state = 'signing_in';
      authenticationStatus = authenticationUnavailable;
      text(jobStatus, failureMessages.authentication_unavailable);
    } else if (error instanceof ApiError && [401, 403].includes(error.status)) {
      activeBookId = null; state = 'expired'; csrf = ''; lastStatusAt = 0;
      text(jobStatus, 'Booking was not authorized. Sign in again before trying.');
    } else lockResult(failureText(error instanceof ApiError ? error.reason : undefined, 'No confirmed result received. Check TSS before starting another booking.'));
  } finally { mutating = false; render(); void refreshStatus(); }
}
async function reviewBooking() {
  if (!activeBookId || bookingStage !== 'review' || directReview || mutating || !requireFresh()) return;
  const popup = window.open('about:blank', '_blank');
  if (!popup) { text(jobStatus, 'Allow the popup, then select Review in TSS again.'); return; }
  try { popup.opener = null; } catch { popup.close(); return; }
  closeLogin(); loginPopup = popup;
  mutating = true; revision++; render();
  try {
    const value = await request('login', { requestId: crypto.randomUUID() }, 60_000);
    if (!departed) popup.location.replace(liveView(value.loginUrl));
  } catch {
    closeLogin(); text(jobStatus, 'TSS review could not be opened. Check session status before continuing.');
  } finally { mutating = false; render(); void refreshStatus(); }
}

async function resolveWarning(action: 'confirm' | 'cancel') {
  if (!activeBookId || bookingStage !== 'review' || !directReview || !confirmationId || mutating || !requireFresh()) return;
  const bookingRequestId = activeBookId;
  const token = confirmationId;
  mutating = true; revision++; render();
  try {
    const value = await request(action, { requestId: crypto.randomUUID(), bookingRequestId, confirmationId: token });
    const result = value.booking && typeof value.booking === 'object' ? value.booking as Record<string, unknown> : value;
    if (!bookingResult(result)) lockResult();
  } catch {
    lockResult(action === 'confirm' ? 'Confirmation has no verified result. Check My Courses before trying again.'
      : 'Cancellation could not be confirmed. Check session status before continuing.');
  } finally { mutating = false; render(); void refreshStatus(); }
}

loginButton?.addEventListener('click', event => { if (event.isTrusted && !loginButton.disabled) void signIn(); });
logoutButton?.addEventListener('click', event => { if (event.isTrusted && !logoutButton.disabled) void signOut(); });
inspectButton?.addEventListener('click', event => { if (event.isTrusted && !inspectButton.disabled) void inspectSession(); });
reviewButton?.addEventListener('click', event => { if (event.isTrusted && !reviewButton.disabled) void reviewBooking(); });
confirmButton?.addEventListener('click', event => { if (event.isTrusted && !confirmButton.disabled) void resolveWarning('confirm'); });
cancelButton?.addEventListener('click', event => { if (event.isTrusted && !cancelButton.disabled) void resolveWarning('cancel'); });
knownButtons.forEach((route, button) => button.addEventListener('click', event => {
  if (event.isTrusted && !button.disabled) {
    activeFeedback = button.closest('.course-row, .booking-option')?.querySelector<HTMLElement>('[data-tss-feedback]') || null;
    void book(route);
  }
}));
document.addEventListener('visibilitychange', () => {
  clearTimeout(pollTimer);
  if (document.visibilityState === 'visible') void refreshStatus();
});
window.addEventListener('pagehide', () => {
  departed = true; revision++;
  clearTimeout(pollTimer); clearTimeout(expiryTimer); clearTimeout(bookingTimer);
  if (activeBookId) lockResult();
  for (const controller of controllers) controller.abort();
  closeLogin();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  departed = false; state = 'checking'; csrf = ''; lastStatusAt = 0; render();
  void refreshStatus();
});
render();
void refreshStatus();
