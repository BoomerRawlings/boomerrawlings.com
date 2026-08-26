const SOUND_KEY = 'pip-sound';
const TRANSITION_KEY = 'pip-transition';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let pipAudioContext;

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private browsing; Pip still works for this page.
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may be unavailable in private browsing; navigation still works.
  }
}

function playPipSound(departing = false) {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;

  try {
    pipAudioContext ??= new AudioContextClass();
  } catch {
    return;
  }

  const context = pipAudioContext;
  const frequencies = departing ? [470, 580] : [390, 470, 430];

  try {
    void context.resume().then(() => {
      const now = context.currentTime;
      frequencies.forEach((frequency, index) => {
        const start = now + index * 0.075;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.035, start + 0.06);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.018, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.07);
      });
    }).catch(() => {
      // Audio is optional; the written tour remains complete.
    });
  } catch {
    // Audio is optional; the written tour remains complete.
  }
}

function animatePip(guide) {
  guide.classList.remove('is-speaking');
  void guide.offsetWidth;
  guide.classList.add('is-speaking');
  window.setTimeout(() => guide.classList.remove('is-speaking'), 760);
}

function animatePipDeparture(guide) {
  guide.classList.remove('is-speaking', 'is-arriving');
  void guide.offsetWidth;
  guide.classList.add('is-departing');
  writeStorage(window.sessionStorage, TRANSITION_KEY, 'pending');
}

function animatePipArrival(guide) {
  guide.classList.remove('is-departing');
  void guide.offsetWidth;
  guide.classList.add('is-arriving');
  window.setTimeout(() => guide.classList.remove('is-arriving'), 460);
}

document.querySelectorAll('[data-pip-guide]').forEach((guide) => {
  if (guide.dataset.pipEnhanced === 'true') return;
  guide.dataset.pipEnhanced = 'true';

  const message = guide.querySelector('[data-pip-message]');
  const form = guide.querySelector('[data-pip-form]');
  const progress = guide.querySelector('[data-pip-progress]');
  const current = guide.querySelector('[data-pip-current]');
  const progressLabel = guide.querySelector('[data-pip-progress-label]');
  const backButton = guide.querySelector('[data-pip-back]');
  const nextLabel = guide.querySelector('[data-pip-next-label]');
  const nextArrow = guide.querySelector('[data-pip-arrow]');
  const soundToggle = guide.querySelector('[data-pip-sound]');
  const curator = guide.querySelector('.portfolio-curator');
  const submitButton = form?.querySelector('button[type="submit"]');
  const destination = form?.action;
  const destinationLabel = form?.dataset.pipDestination;
  const isTerminal = form?.dataset.pipTerminal === 'true';

  let steps = [];
  try {
    const parsed = JSON.parse(guide.dataset.pipSteps ?? '[]');
    if (Array.isArray(parsed)) steps = parsed.filter((step) => typeof step === 'string');
  } catch {
    steps = [];
  }

  if (!message || !form || !progress || !current || !progressLabel || !backButton || !nextLabel || !nextArrow || !soundToggle || !submitButton || !destination || (!isTerminal && !destinationLabel) || steps.length === 0) return;

  removeStorage(window.sessionStorage, `pip-step:${window.location.pathname}`);
  let step = 0;
  let soundEnabled = true;

  const updateSoundToggle = () => {
    soundToggle.textContent = soundEnabled ? 'Sound on' : 'Sound off';
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    soundToggle.setAttribute('aria-label', soundEnabled ? 'Turn Pip’s sound off' : 'Turn Pip’s sound on');
  };

  const syncSoundPreference = () => {
    soundEnabled = readStorage(window.localStorage, SOUND_KEY) !== 'off';
    updateSoundToggle();
  };

  const updateStep = () => {
    const atLastStep = step === steps.length - 1;
    message.textContent = steps[step];
    current.textContent = String(step + 1).padStart(2, '0');
    progressLabel.textContent = `Step ${step + 1} of ${steps.length}`;
    backButton.hidden = step === 0;
    submitButton.disabled = isTerminal && atLastStep;
    nextArrow.hidden = isTerminal && atLastStep;

    if (isTerminal && atLastStep) {
      nextLabel.textContent = 'Tour complete';
      submitButton.setAttribute('aria-label', 'Pip’s guided tour is complete');
    } else if (atLastStep) {
      nextLabel.textContent = `Next: ${destinationLabel}`;
      submitButton.setAttribute('aria-label', `Continue to ${destinationLabel}`);
    } else {
      nextLabel.textContent = 'Next';
      submitButton.setAttribute('aria-label', `Show Pip’s next note, step ${step + 2} of ${steps.length}`);
    }
  };

  progress.hidden = false;
  soundToggle.hidden = false;
  syncSoundPreference();
  updateStep();

  if (!reducedMotionQuery.matches && readStorage(window.sessionStorage, TRANSITION_KEY) === 'pending') {
    removeStorage(window.sessionStorage, TRANSITION_KEY);
    animatePipArrival(guide);
  }

  window.addEventListener('pageshow', (event) => {
    syncSoundPreference();
    delete form.dataset.pipNavigating;
    delete guide.dataset.pipNavigating;
    guide.classList.remove('is-departing');
    step = 0;
    updateStep();

    if (event.persisted) {
      removeStorage(window.sessionStorage, TRANSITION_KEY);
      if (!reducedMotionQuery.matches) animatePipArrival(guide);
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === SOUND_KEY) syncSoundPreference();
  });

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    writeStorage(window.localStorage, SOUND_KEY, soundEnabled ? 'on' : 'off');
    updateSoundToggle();
    if (soundEnabled) {
      animatePip(guide);
      playPipSound();
    }
  });

  backButton.addEventListener('click', () => {
    if (step === 0) return;
    step -= 1;
    updateStep();
    animatePip(guide);
    if (soundEnabled) playPipSound();
  });

  if (curator) {
    let expressionTimer;

    curator.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      window.clearTimeout(expressionTimer);
      curator.classList.remove('is-smile-leaving');
      void curator.offsetWidth;
      curator.classList.add('is-smiling');
    });

    curator.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      window.clearTimeout(expressionTimer);
      curator.classList.remove('is-smiling');
      void curator.offsetWidth;
      curator.classList.add('is-smile-leaving');
      expressionTimer = window.setTimeout(() => curator.classList.remove('is-smile-leaving'), 240);
    });
  }

  form.addEventListener('submit', (event) => {
    if (step < steps.length - 1) {
      event.preventDefault();
      step += 1;
      updateStep();
      animatePip(guide);
      if (soundEnabled) playPipSound();
      return;
    }

    if (isTerminal) {
      event.preventDefault();
      return;
    }

    if (form.dataset.pipNavigating === 'true') {
      event.preventDefault();
      return;
    }

    form.dataset.pipNavigating = 'true';
    event.preventDefault();
    const useFallbackMotion = !reducedMotionQuery.matches;
    if (useFallbackMotion) animatePipDeparture(guide);
    else animatePip(guide);
    const navigationDelay = useFallbackMotion ? 300 : soundEnabled ? 190 : 0;
    try {
      if (soundEnabled) playPipSound(true);
    } finally {
      window.setTimeout(() => window.location.assign(destination), navigationDelay);
    }
  });
});

if (document.documentElement.dataset.pipNavigationEnhanced !== 'true') {
  document.documentElement.dataset.pipNavigationEnhanced = 'true';
  document.documentElement.dataset.pipTransitionMode = reducedMotionQuery.matches ? 'reduced' : 'enhanced';

  document.querySelectorAll('a[href]').forEach((clicked) => {
    if (clicked.dataset.pipTransitionBound === 'true') return;
    clicked.dataset.pipTransitionBound = 'true';

    clicked.addEventListener('click', (event) => {
      if (
        reducedMotionQuery.matches
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || clicked.hasAttribute('download')
        || (clicked.target && clicked.target !== '_self')
      ) return;

      const destination = new URL(clicked.href, window.location.href);
      if (destination.origin !== window.location.origin || !['http:', 'https:'].includes(destination.protocol)) return;
      if (
        destination.pathname === window.location.pathname
        && destination.search === window.location.search
        && destination.hash
      ) return;
      if (destination.href === window.location.href) return;

      const guide = document.querySelector('[data-pip-guide]');
      if (!guide || guide.dataset.pipNavigating === 'true') return;

      event.preventDefault();
      guide.dataset.pipNavigating = 'true';
      animatePipDeparture(guide);
      window.setTimeout(() => window.location.assign(destination.href), 300);
    }, { capture: true });
  });
}
