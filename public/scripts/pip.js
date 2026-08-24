const SOUND_KEY = 'pip-sound';
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

document.querySelectorAll('[data-pip-guide]').forEach((guide) => {
  if (guide.dataset.pipEnhanced === 'true') return;
  guide.dataset.pipEnhanced = 'true';

  const message = guide.querySelector('[data-pip-message]');
  const form = guide.querySelector('[data-pip-form]');
  const progress = guide.querySelector('[data-pip-progress]');
  const current = guide.querySelector('[data-pip-current]');
  const progressLabel = guide.querySelector('[data-pip-progress-label]');
  const nextLabel = guide.querySelector('[data-pip-next-label]');
  const soundToggle = guide.querySelector('[data-pip-sound]');
  const submitButton = form?.querySelector('button[type="submit"]');
  const destination = form?.action;
  const destinationLabel = form?.dataset.pipDestination;

  let steps = [];
  try {
    const parsed = JSON.parse(guide.dataset.pipSteps ?? '[]');
    if (Array.isArray(parsed)) steps = parsed.filter((step) => typeof step === 'string');
  } catch {
    steps = [];
  }

  if (!message || !form || !progress || !current || !progressLabel || !nextLabel || !soundToggle || !submitButton || !destination || !destinationLabel || steps.length === 0) return;

  const stepKey = `pip-step:${guide.dataset.pipKey ?? window.location.pathname}`;
  const storedStep = Number.parseInt(readStorage(window.sessionStorage, stepKey) ?? '0', 10);
  let step = Number.isInteger(storedStep) && storedStep >= 0 && storedStep < steps.length ? storedStep : 0;
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
    message.textContent = steps[step];
    current.textContent = String(step + 1).padStart(2, '0');
    progressLabel.textContent = `Step ${step + 1} of ${steps.length}`;
    nextLabel.textContent = step === steps.length - 1 ? `Next: ${destinationLabel}` : 'Next';
    submitButton.setAttribute(
      'aria-label',
      step === steps.length - 1 ? `Continue to ${destinationLabel}` : `Show Pip’s next note, step ${step + 2} of ${steps.length}`,
    );
  };

  progress.hidden = false;
  soundToggle.hidden = false;
  syncSoundPreference();
  updateStep();

  window.addEventListener('pageshow', syncSoundPreference);
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

  form.addEventListener('submit', (event) => {
    if (step < steps.length - 1) {
      event.preventDefault();
      step += 1;
      writeStorage(window.sessionStorage, stepKey, String(step));
      updateStep();
      animatePip(guide);
      if (soundEnabled) playPipSound();
      return;
    }

    if (form.dataset.pipNavigating === 'true') {
      event.preventDefault();
      return;
    }

    form.dataset.pipNavigating = 'true';
    event.preventDefault();
    animatePip(guide);
    const navigationDelay = soundEnabled ? 190 : 0;
    try {
      if (soundEnabled) playPipSound(true);
    } finally {
      window.setTimeout(() => window.location.assign(destination), navigationDelay);
    }
  });
});
