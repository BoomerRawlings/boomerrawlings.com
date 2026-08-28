/**
 * Procedural Little Workshop voices.
 *
 * The planner is deliberately pure and independent of Web Audio. The engine does
 * not touch browser globals or create an AudioContext until unlockFromGesture()
 * is called from a trusted interaction handler.
 */

export type VoiceSpeaker = 'pyotter' | 'mikwhale';
export type VoiceViseme = 'rest' | 'small' | 'open' | 'wide' | 'round' | 'smile';
export type VoicePauseKind =
  | 'word'
  | 'comma'
  | 'sentence'
  | 'ellipsis'
  | 'question'
  | 'exclamation'
  | 'colon'
  | 'dash'
  | 'line-break';

export interface VoicePreset {
  readonly speaker: VoiceSpeaker;
  readonly basePitchHz: number;
  readonly pitchRangeHz: number;
  readonly baseChirpMs: number;
  readonly gapMs: number;
  readonly formantHz: number;
  readonly formantRangeHz: number;
  readonly formantQ: number;
  readonly gain: number;
  readonly pan: number;
  readonly waveform: OscillatorType;
  readonly vibratoRateHz: number;
  readonly vibratoDepthHz: number;
  readonly brightness: number;
}

/** Immutable character profiles; Pyotter's complete pitch range is above Mikwhale's. */
export const VOICE_PRESETS: Readonly<Record<VoiceSpeaker, VoicePreset>> = Object.freeze({
  pyotter: Object.freeze({
    speaker: 'pyotter',
    basePitchHz: 410,
    pitchRangeHz: 72,
    baseChirpMs: 68,
    gapMs: 10,
    formantHz: 2_150,
    formantRangeHz: 560,
    formantQ: 3.8,
    gain: 0.72,
    pan: -0.24,
    waveform: 'sawtooth',
    vibratoRateHz: 8.2,
    vibratoDepthHz: 8,
    brightness: 0.7,
  }),
  mikwhale: Object.freeze({
    speaker: 'mikwhale',
    basePitchHz: 154,
    pitchRangeHz: 30,
    baseChirpMs: 96,
    gapMs: 16,
    formantHz: 1_080,
    formantRangeHz: 300,
    formantQ: 3.1,
    gain: 0.78,
    pan: 0.24,
    waveform: 'triangle',
    vibratoRateHz: 5.1,
    vibratoDepthHz: 3.2,
    brightness: 0.42,
  }),
});

export interface SpeechPlanOptions {
  /** Additional deterministic variation. Equal inputs and seeds always match. */
  readonly seed?: number;
  /** Playback cadence multiplier, clamped to 0.6–1.6. */
  readonly rate?: number;
  /** Pitch and mouth variation, clamped to 0–1. */
  readonly expressiveness?: number;
}

export interface VoiceChirpEvent {
  readonly index: number;
  readonly symbol: string;
  readonly atMs: number;
  readonly durationMs: number;
  readonly pitchHz: number;
  readonly endPitchHz: number;
  readonly formantHz: number;
  readonly formantQ: number;
  readonly gain: number;
  readonly pan: number;
  readonly vibratoRateHz: number;
  readonly vibratoDepthHz: number;
  readonly waveform: OscillatorType;
  readonly viseme: Exclude<VoiceViseme, 'rest'>;
}

export interface VoicePause {
  readonly kind: VoicePauseKind;
  readonly atMs: number;
  readonly durationMs: number;
}

export interface SpeechPlan {
  readonly version: 1;
  readonly speaker: VoiceSpeaker;
  readonly text: string;
  readonly seed: number;
  readonly totalDurationMs: number;
  readonly events: readonly VoiceChirpEvent[];
  readonly pauses: readonly VoicePause[];
}

const MAX_TEXT_SYMBOLS = 600;
/** Keeps procedural speech inside the workshop's longest visible dialogue beat. */
export const MAX_SPEECH_PLAN_MS = 4_000;
const MAX_CHIRPS_BY_SPEAKER: Readonly<Record<VoiceSpeaker, number>> = Object.freeze({
  pyotter: 54,
  mikwhale: 38,
});
const LETTER_PATTERN = /^\p{Letter}$/u;
const NUMBER_PATTERN = /^\p{Number}$/u;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const rounded = (value: number, places = 3): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

const normalizeText = (value: string): string => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  let normalized = text;
  try {
    normalized = text.normalize('NFC');
  } catch {
    // Some embedded browsers can reject malformed Unicode; the original remains safe.
  }
  return Array.from(normalized).slice(0, MAX_TEXT_SYMBOLS).join('');
};

const hashText = (value: string): number => {
  let hash = 0x811c9dc5;
  for (const symbol of value) {
    const codePoint = symbol.codePointAt(0) ?? 0;
    hash ^= codePoint;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const deterministicRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const visemeForSymbol = (
  symbol: string,
  random: () => number,
): Exclude<VoiceViseme, 'rest'> => {
  const lower = symbol.toLocaleLowerCase('en-US');
  if (lower === 'o' || lower === 'u' || lower === 'w' || lower === 'q') return 'round';
  if (lower === 'a') return random() > 0.2 ? 'wide' : 'open';
  if (lower === 'e' || lower === 'i' || lower === 'y') {
    return random() > 0.34 ? 'smile' : 'wide';
  }
  if (VOWELS.has(lower)) return 'open';
  if ('bmpfv'.includes(lower)) return 'small';
  if (NUMBER_PATTERN.test(symbol)) return random() > 0.5 ? 'round' : 'open';
  if (!LETTER_PATTERN.test(symbol)) return random() > 0.5 ? 'smile' : 'round';
  return random() > 0.72 ? 'open' : 'small';
};

const pitchShapeForViseme = (viseme: Exclude<VoiceViseme, 'rest'>): number => {
  if (viseme === 'wide') return 0.36;
  if (viseme === 'smile') return 0.24;
  if (viseme === 'round') return -0.28;
  if (viseme === 'open') return 0.08;
  return -0.12;
};

const pauseForSymbol = (
  symbols: readonly string[],
  index: number,
): { consumed: number; kind: VoicePauseKind; baseMs: number } | null => {
  const symbol = symbols[index];
  if (symbol === '.' && symbols[index + 1] === '.' && symbols[index + 2] === '.') {
    return { consumed: 3, kind: 'ellipsis', baseMs: 410 };
  }
  if (symbol === '…') return { consumed: 1, kind: 'ellipsis', baseMs: 410 };
  if (symbol === '\n' || symbol === '\r') {
    const consumed = symbol === '\r' && symbols[index + 1] === '\n' ? 2 : 1;
    return { consumed, kind: 'line-break', baseMs: 290 };
  }
  if (symbol === ',' || symbol === ';' || symbol === '，' || symbol === '；') {
    return { consumed: 1, kind: 'comma', baseMs: 165 };
  }
  if (symbol === '.' || symbol === '。') return { consumed: 1, kind: 'sentence', baseMs: 300 };
  if (symbol === '?' || symbol === '？') return { consumed: 1, kind: 'question', baseMs: 330 };
  if (symbol === '!' || symbol === '！') return { consumed: 1, kind: 'exclamation', baseMs: 255 };
  if (symbol === ':' || symbol === '：') return { consumed: 1, kind: 'colon', baseMs: 190 };
  if ('—–-'.includes(symbol)) return { consumed: 1, kind: 'dash', baseMs: 210 };
  return null;
};

/**
 * Creates a serializable, deterministic animalese-style utterance plan.
 * This function is pure: it does not read clocks, storage, or browser APIs.
 */
export const createSpeechPlan = (
  speaker: VoiceSpeaker,
  rawText: string,
  rawOptions: SpeechPlanOptions | number = {},
): SpeechPlan => {
  const preset = VOICE_PRESETS[speaker] ?? VOICE_PRESETS.pyotter;
  const text = normalizeText(rawText);
  const options = typeof rawOptions === 'number' ? { seed: rawOptions } : rawOptions;
  const rate = clamp(options.rate ?? 1, 0.6, 1.6);
  const expressiveness = clamp(options.expressiveness ?? 0.72, 0, 1);
  const suppliedSeed = Number.isFinite(options.seed) ? Math.trunc(options.seed ?? 0) >>> 0 : 0;
  const seed = (hashText(`${preset.speaker}\u0000${text}`) ^ suppliedSeed) >>> 0;
  const random = deterministicRandom(seed);
  const symbols = Array.from(text);
  const events: VoiceChirpEvent[] = [];
  const pauses: VoicePause[] = [];
  let cursorMs = 0;
  let lastWasWhitespace = false;
  let speechSymbolsSeen = 0;
  const speechSymbolCount = symbols.reduce(
    (count, symbol) => count + (LETTER_PATTERN.test(symbol) || NUMBER_PATTERN.test(symbol) ? 1 : 0),
    0,
  );
  const chirpBudget = MAX_CHIRPS_BY_SPEAKER[preset.speaker];

  for (let symbolIndex = 0; symbolIndex < symbols.length; ) {
    const symbol = symbols[symbolIndex];
    const punctuation = pauseForSymbol(symbols, symbolIndex);
    if (punctuation) {
      const durationMs = rounded(punctuation.baseMs / rate, 1);
      pauses.push({ kind: punctuation.kind, atMs: rounded(cursorMs, 1), durationMs });
      cursorMs += durationMs;
      symbolIndex += punctuation.consumed;
      lastWasWhitespace = false;
      continue;
    }

    if (/\s/u.test(symbol)) {
      if (!lastWasWhitespace) {
        const durationMs = rounded((preset.gapMs * 1.8) / rate, 1);
        pauses.push({ kind: 'word', atMs: rounded(cursorMs, 1), durationMs });
        cursorMs += durationMs;
      }
      lastWasWhitespace = true;
      symbolIndex += 1;
      continue;
    }

    lastWasWhitespace = false;
    const isSpeechSymbol = LETTER_PATTERN.test(symbol) || NUMBER_PATTERN.test(symbol);
    if (!isSpeechSymbol) {
      // Quotes, apostrophes, emoji, joiners, symbols, and format marks stay silent.
      symbolIndex += 1;
      continue;
    }

    speechSymbolsSeen += 1;
    if (speechSymbolCount > chirpBudget) {
      const currentSlot = Math.floor(((speechSymbolsSeen - 1) * chirpBudget) / speechSymbolCount);
      const previousSlot =
        speechSymbolsSeen === 1
          ? -1
          : Math.floor(((speechSymbolsSeen - 2) * chirpBudget) / speechSymbolCount);
      if (currentSlot === previousSlot) {
        symbolIndex += 1;
        continue;
      }
    }

    const viseme = visemeForSymbol(symbol, random);
    const durationVariance = 0.83 + random() * 0.34;
    const durationMs = clamp(
      (preset.baseChirpMs * durationVariance) / rate,
      34,
      150,
    );
    const pitchShape = pitchShapeForViseme(viseme);
    const pitchJitter = (random() * 2 - 1) * preset.pitchRangeHz * expressiveness;
    const pitchHz = clamp(
      preset.basePitchHz + pitchJitter + pitchShape * preset.pitchRangeHz,
      preset.basePitchHz - preset.pitchRangeHz,
      preset.basePitchHz + preset.pitchRangeHz,
    );
    const glideDirection = random() > 0.48 ? 1 : -1;
    const endPitchHz = clamp(
      pitchHz + glideDirection * preset.pitchRangeHz * (0.08 + random() * 0.18) * expressiveness,
      preset.basePitchHz - preset.pitchRangeHz,
      preset.basePitchHz + preset.pitchRangeHz,
    );
    const formantShape = viseme === 'round' ? -0.38 : viseme === 'smile' ? 0.34 : 0.05;
    const formantHz = clamp(
      preset.formantHz +
        formantShape * preset.formantRangeHz +
        (random() * 2 - 1) * preset.formantRangeHz * 0.28 * expressiveness,
      540,
      3_800,
    );
    const gain = preset.gain * (0.79 + random() * 0.21);
    const pan = clamp(preset.pan + (random() * 2 - 1) * 0.025, -0.9, 0.9);

    events.push({
      index: events.length,
      symbol,
      atMs: rounded(cursorMs, 1),
      durationMs: rounded(durationMs, 1),
      pitchHz: rounded(pitchHz, 2),
      endPitchHz: rounded(endPitchHz, 2),
      formantHz: rounded(formantHz, 2),
      formantQ: rounded(preset.formantQ * (0.9 + random() * 0.2), 2),
      gain: rounded(gain, 3),
      pan: rounded(pan, 3),
      vibratoRateHz: rounded(preset.vibratoRateHz * (0.94 + random() * 0.12), 2),
      vibratoDepthHz: rounded(preset.vibratoDepthHz * (0.78 + random() * 0.35), 2),
      waveform: preset.waveform,
      viseme,
    });

    cursorMs += durationMs + preset.gapMs / rate;
    symbolIndex += 1;
  }

  const tailMs = events.length > 0 ? 45 : 0;
  const uncappedDurationMs = cursorMs + tailMs;
  const timeScale =
    uncappedDurationMs > MAX_SPEECH_PLAN_MS ? MAX_SPEECH_PLAN_MS / uncappedDurationMs : 1;
  const scaledEvents =
    timeScale < 1
      ? events.map((event) => ({
          ...event,
          atMs: rounded(event.atMs * timeScale, 1),
          durationMs: rounded(event.durationMs * timeScale, 1),
        }))
      : events;
  const scaledPauses =
    timeScale < 1
      ? pauses.map((pause) => ({
          ...pause,
          atMs: rounded(pause.atMs * timeScale, 1),
          durationMs: rounded(pause.durationMs * timeScale, 1),
        }))
      : pauses;
  return {
    version: 1,
    speaker: preset.speaker,
    text,
    seed,
    totalDurationMs: rounded(Math.min(uncappedDurationMs, MAX_SPEECH_PLAN_MS), 1),
    events: scaledEvents,
    pauses: scaledPauses,
  };
};

export const LITTLE_WORKSHOP_VOICE_STORAGE_KEY = 'little-workshop-voice-preferences-v1';

export interface VoicePreferences {
  readonly enabled: boolean;
  readonly volume: number;
}

export interface VoicePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_PREFERENCES: VoicePreferences = Object.freeze({ enabled: false, volume: 0.68 });

const normalizePreferences = (value: unknown): VoicePreferences => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES };
  const record = value as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_PREFERENCES.enabled,
    volume:
      typeof record.volume === 'number' && Number.isFinite(record.volume)
        ? clamp(record.volume, 0, 1)
        : DEFAULT_PREFERENCES.volume,
  };
};

const resolvePreferenceStorage = (
  supplied: VoicePreferenceStorage | null | undefined,
): VoicePreferenceStorage | null => {
  if (supplied !== undefined) return supplied;
  try {
    const candidate = (globalThis as { localStorage?: VoicePreferenceStorage }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
};

const readPreferences = (storage: VoicePreferenceStorage | null): VoicePreferences => {
  if (!storage) return { ...DEFAULT_PREFERENCES };
  try {
    const serialized = storage.getItem(LITTLE_WORKSHOP_VOICE_STORAGE_KEY);
    return serialized ? normalizePreferences(JSON.parse(serialized) as unknown) : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

const writePreferences = (
  storage: VoicePreferenceStorage | null,
  preferences: VoicePreferences,
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(LITTLE_WORKSHOP_VOICE_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
};

export type VoiceEngineState =
  | 'disabled'
  | 'locked'
  | 'unlocking'
  | 'ready'
  | 'speaking'
  | 'unsupported'
  | 'error'
  | 'disposed';

export type VoiceEndReason = 'finished' | 'cancelled' | 'interrupted' | 'disabled' | 'disposed';

export interface VoiceStatusEvent {
  readonly state: VoiceEngineState;
  readonly message?: string;
  readonly speaker?: VoiceSpeaker;
  readonly utteranceId?: number;
}

export interface VoiceUtteranceEvent {
  readonly utteranceId: number;
  readonly speaker: VoiceSpeaker;
  readonly plan: SpeechPlan;
}

export interface VoiceVisemeEvent {
  readonly utteranceId: number;
  readonly speaker: VoiceSpeaker;
  readonly viseme: VoiceViseme;
  readonly atMs: number;
  readonly durationMs: number;
  readonly intensity: number;
}

export interface VoiceUtteranceEndEvent extends VoiceUtteranceEvent {
  readonly reason: VoiceEndReason;
}

export interface VoiceEngineHooks {
  onStatus?(event: VoiceStatusEvent): void;
  onUtteranceStart?(event: VoiceUtteranceEvent): void;
  onViseme?(event: VoiceVisemeEvent): void;
  onUtteranceEnd?(event: VoiceUtteranceEndEvent): void;
}

export interface VoiceEngineOptions {
  readonly storage?: VoicePreferenceStorage | null;
  readonly hooks?: VoiceEngineHooks;
  /** Deferred factory for tests or embedded runtimes. It is called only by unlockFromGesture(). */
  readonly contextFactory?: () => AudioContext;
}

export interface VoiceSpeakOptions extends SpeechPlanOptions {
  readonly volume?: number;
}

export interface VoicePlaybackResult {
  readonly started: boolean;
  readonly reason?: 'disabled' | 'locked' | 'unsupported' | 'empty' | 'disposed' | 'error';
  readonly utteranceId?: number;
  readonly plan: SpeechPlan;
}

export interface LittleWorkshopVoiceEngine {
  getStatus(): VoiceEngineState;
  getPreferences(): VoicePreferences;
  isSupported(): boolean;
  setHooks(hooks: VoiceEngineHooks): void;
  setEnabled(enabled: boolean): VoicePreferences;
  setVolume(volume: number): VoicePreferences;
  /** Must be invoked synchronously from a click/tap/key interaction handler. */
  unlockFromGesture(): Promise<VoiceEngineState>;
  speak(speaker: VoiceSpeaker, text: string, options?: VoiceSpeakOptions): VoicePlaybackResult;
  cancel(reason?: Exclude<VoiceEndReason, 'finished' | 'disposed'>): void;
  dispose(): Promise<void>;
}

interface ActiveUtterance extends VoiceUtteranceEvent {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timers: Array<ReturnType<typeof setTimeout>>;
}

type AudioContextConstructor = new (contextOptions?: AudioContextOptions) => AudioContext;

const audioContextConstructor = (): AudioContextConstructor | null => {
  try {
    const scope = globalThis as unknown as {
      AudioContext?: AudioContextConstructor;
      webkitAudioContext?: AudioContextConstructor;
    };
    return scope.AudioContext ?? scope.webkitAudioContext ?? null;
  } catch {
    return null;
  }
};

const invokeSafely = <Arguments extends readonly unknown[]>(
  callback: ((...values: Arguments) => void) | undefined,
  ...values: Arguments
): void => {
  try {
    callback?.(...values);
  } catch {
    // UI callbacks cannot be allowed to corrupt audio cleanup or scheduling.
  }
};

/** Creates a lazy, cancellable Web Audio renderer around the pure speech planner. */
export const createLittleWorkshopVoiceEngine = (
  options: VoiceEngineOptions = {},
): LittleWorkshopVoiceEngine => {
  const storage = resolvePreferenceStorage(options.storage);
  let preferences = readPreferences(storage);
  let hooks = options.hooks ?? {};
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let active: ActiveUtterance | null = null;
  let state: VoiceEngineState = preferences.enabled ? 'locked' : 'disabled';
  let disposed = false;
  let utteranceCounter = 0;
  let unlockPromise: Promise<VoiceEngineState> | null = null;

  const emitStatus = (next: VoiceEngineState, details: Omit<VoiceStatusEvent, 'state'> = {}): void => {
    state = next;
    invokeSafely(hooks.onStatus, { state: next, ...details });
  };

  const restingViseme = (utterance: VoiceUtteranceEvent): void => {
    invokeSafely(hooks.onViseme, {
      utteranceId: utterance.utteranceId,
      speaker: utterance.speaker,
      viseme: 'rest',
      atMs: utterance.plan.totalDurationMs,
      durationMs: 0,
      intensity: 0,
    });
  };

  const teardownActive = (
    reason: VoiceEndReason,
    emitNextStatus: boolean,
    stopSources: boolean,
  ): void => {
    const utterance = active;
    if (!utterance) return;
    active = null;

    for (const timer of utterance.timers) clearTimeout(timer);
    if (stopSources) {
      for (const source of utterance.sources) {
        try {
          source.stop();
        } catch {
          // Already-ended sources are harmless.
        }
      }
    }
    for (const node of utterance.nodes) {
      try {
        node.disconnect();
      } catch {
        // A disconnected node is already clean.
      }
    }

    if (reason !== 'finished') restingViseme(utterance);
    invokeSafely(hooks.onUtteranceEnd, {
      utteranceId: utterance.utteranceId,
      speaker: utterance.speaker,
      plan: utterance.plan,
      reason,
    });
    if (!emitNextStatus || disposed) return;
    if (!preferences.enabled) emitStatus('disabled');
    else if (!context || context.state !== 'running') emitStatus('locked');
    else emitStatus('ready');
  };

  const persistPreferences = (): void => {
    writePreferences(storage, preferences);
  };

  const updateMasterVolume = (): void => {
    if (!context || !masterGain) return;
    const target = preferences.enabled ? preferences.volume : 0;
    try {
      masterGain.gain.cancelScheduledValues(context.currentTime);
      masterGain.gain.setTargetAtTime(target, context.currentTime, 0.018);
    } catch {
      masterGain.gain.value = target;
    }
  };

  const scheduleVisemes = (utterance: ActiveUtterance, leadMs: number): void => {
    const { plan } = utterance;
    for (let index = 0; index < plan.events.length; index += 1) {
      const event = plan.events[index];
      const nextEvent = plan.events[index + 1];
      utterance.timers.push(
        setTimeout(() => {
          if (active?.utteranceId !== utterance.utteranceId) return;
          invokeSafely(hooks.onViseme, {
            utteranceId: utterance.utteranceId,
            speaker: utterance.speaker,
            viseme: event.viseme,
            atMs: event.atMs,
            durationMs: event.durationMs,
            intensity: clamp(event.gain, 0, 1),
          });
        }, Math.max(0, leadMs + event.atMs)),
      );

      const gapAfterMs = (nextEvent?.atMs ?? plan.totalDurationMs) - (event.atMs + event.durationMs);
      if (gapAfterMs >= 34 || !nextEvent) {
        utterance.timers.push(
          setTimeout(() => {
            if (active?.utteranceId !== utterance.utteranceId) return;
            invokeSafely(hooks.onViseme, {
              utteranceId: utterance.utteranceId,
              speaker: utterance.speaker,
              viseme: 'rest',
              atMs: rounded(event.atMs + event.durationMs, 1),
              durationMs: rounded(gapAfterMs, 1),
              intensity: 0,
            });
          }, Math.max(0, leadMs + event.atMs + event.durationMs)),
        );
      }
    }
  };

  const scheduleChirp = (
    utterance: ActiveUtterance,
    event: VoiceChirpEvent,
    startTime: number,
    utteranceVolume: number,
  ): void => {
    if (!context || !masterGain) return;
    const eventStart = startTime + event.atMs / 1_000;
    const eventEnd = eventStart + event.durationMs / 1_000;
    const attackEnd = Math.min(eventEnd, eventStart + Math.min(0.012, event.durationMs / 3_000));
    const releaseStart = Math.max(attackEnd, eventEnd - Math.min(0.024, event.durationMs / 2_000));

    const carrier = context.createOscillator();
    const vibrato = context.createOscillator();
    const vibratoGain = context.createGain();
    const formant = context.createBiquadFilter();
    const directGain = context.createGain();
    const formantGain = context.createGain();
    const envelope = context.createGain();
    const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;

    carrier.type = event.waveform;
    carrier.frequency.setValueAtTime(Math.max(20, event.pitchHz), eventStart);
    carrier.frequency.exponentialRampToValueAtTime(Math.max(20, event.endPitchHz), eventEnd);
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(event.vibratoRateHz, eventStart);
    vibratoGain.gain.setValueAtTime(event.vibratoDepthHz, eventStart);
    vibrato.connect(vibratoGain).connect(carrier.frequency);

    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(event.formantHz, eventStart);
    formant.Q.setValueAtTime(event.formantQ, eventStart);
    directGain.gain.setValueAtTime(0.13 + VOICE_PRESETS[utterance.speaker].brightness * 0.1, eventStart);
    formantGain.gain.setValueAtTime(0.78 + VOICE_PRESETS[utterance.speaker].brightness * 0.2, eventStart);
    envelope.gain.setValueAtTime(0.0001, eventStart);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, event.gain * utteranceVolume),
      attackEnd,
    );
    envelope.gain.setValueAtTime(
      Math.max(0.0001, event.gain * utteranceVolume),
      releaseStart,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, eventEnd);

    carrier.connect(directGain).connect(envelope);
    carrier.connect(formant).connect(formantGain).connect(envelope);
    if (panner) {
      panner.pan.setValueAtTime(event.pan, eventStart);
      envelope.connect(panner).connect(masterGain);
      utterance.nodes.push(panner);
    } else {
      envelope.connect(masterGain);
    }

    carrier.start(eventStart);
    vibrato.start(eventStart);
    carrier.stop(eventEnd + 0.015);
    vibrato.stop(eventEnd + 0.015);
    utterance.sources.push(carrier, vibrato);
    utterance.nodes.push(vibratoGain, formant, directGain, formantGain, envelope);
  };

  return {
    getStatus: () => state,
    getPreferences: () => ({ ...preferences }),
    isSupported: () =>
      !disposed &&
      (context
        ? context.state !== 'closed'
        : options.contextFactory !== undefined || audioContextConstructor() !== null),
    setHooks: (nextHooks) => {
      hooks = nextHooks;
    },
    setEnabled: (enabled) => {
      if (disposed) return { ...preferences };
      preferences = { ...preferences, enabled: Boolean(enabled) };
      persistPreferences();
      if (!preferences.enabled) {
        teardownActive('disabled', false, true);
        updateMasterVolume();
        emitStatus('disabled');
      } else {
        updateMasterVolume();
        emitStatus(context?.state === 'running' ? 'ready' : 'locked');
      }
      return { ...preferences };
    },
    setVolume: (volume) => {
      if (disposed) return { ...preferences };
      preferences = { ...preferences, volume: clamp(volume, 0, 1) };
      persistPreferences();
      updateMasterVolume();
      return { ...preferences };
    },
    unlockFromGesture: async () => {
      if (disposed) return 'disposed';
      if (!preferences.enabled) {
        emitStatus('disabled');
        return 'disabled';
      }
      if (context?.state === 'running') {
        emitStatus(active ? 'speaking' : 'ready');
        return state;
      }
      if (unlockPromise) return unlockPromise;

      emitStatus('unlocking');
      unlockPromise = (async (): Promise<VoiceEngineState> => {
        try {
          if (!context) {
            const Context = options.contextFactory ? null : audioContextConstructor();
            if (!options.contextFactory && !Context) {
              emitStatus('unsupported', { message: 'Web Audio is unavailable.' });
              return 'unsupported';
            }
            const createdContext = options.contextFactory
              ? options.contextFactory()
              : Context
                ? new Context()
                : null;
            if (!createdContext) {
              emitStatus('unsupported', { message: 'Web Audio is unavailable.' });
              return 'unsupported';
            }
            context = createdContext;
            masterGain = context.createGain();
            masterGain.gain.value = preferences.volume;
            masterGain.connect(context.destination);
          }
          const unlockingContext = context;
          if (unlockingContext.state === 'suspended') await unlockingContext.resume();
          if (disposed) {
            try {
              if (unlockingContext.state !== 'closed') await unlockingContext.close();
            } catch {
              // Disposal has already won the lifecycle race.
            }
            return 'disposed';
          }
          if (unlockingContext.state !== 'running') {
            emitStatus('locked', { message: 'Audio still requires a user gesture.' });
            return 'locked';
          }
          updateMasterVolume();
          emitStatus('ready');
          return 'ready';
        } catch {
          if (disposed) return 'disposed';
          emitStatus('error', { message: 'The voice engine could not start.' });
          return 'error';
        } finally {
          unlockPromise = null;
        }
      })();
      return unlockPromise;
    },
    speak: (speaker, text, speakOptions = {}) => {
      const plan = createSpeechPlan(speaker, text, speakOptions);
      if (disposed) return { started: false, reason: 'disposed', plan };
      if (!preferences.enabled) {
        emitStatus('disabled');
        return { started: false, reason: 'disabled', plan };
      }
      if (plan.events.length === 0) return { started: false, reason: 'empty', plan };
      if (!context || !masterGain) {
        const supported = options.contextFactory !== undefined || audioContextConstructor() !== null;
        emitStatus(supported ? 'locked' : 'unsupported');
        return { started: false, reason: supported ? 'locked' : 'unsupported', plan };
      }
      if (context.state !== 'running') {
        emitStatus('locked', { message: 'Call unlockFromGesture() from an interaction first.' });
        return { started: false, reason: 'locked', plan };
      }

      teardownActive('interrupted', false, true);
      const utterance: ActiveUtterance = {
        utteranceId: ++utteranceCounter,
        speaker: plan.speaker,
        plan,
        sources: [],
        nodes: [],
        timers: [],
      };
      active = utterance;
      const leadMs = 32;
      const startTime = context.currentTime + leadMs / 1_000;
      const utteranceVolume = clamp(speakOptions.volume ?? 1, 0, 1);

      try {
        for (const event of plan.events) scheduleChirp(utterance, event, startTime, utteranceVolume);
        scheduleVisemes(utterance, leadMs);
        utterance.timers.push(
          setTimeout(() => {
            if (active?.utteranceId !== utterance.utteranceId) return;
            teardownActive('finished', true, false);
          }, leadMs + plan.totalDurationMs),
        );
        emitStatus('speaking', {
          speaker: utterance.speaker,
          utteranceId: utterance.utteranceId,
        });
        invokeSafely(hooks.onUtteranceStart, {
          utteranceId: utterance.utteranceId,
          speaker: utterance.speaker,
          plan: utterance.plan,
        });
        return { started: true, utteranceId: utterance.utteranceId, plan };
      } catch {
        teardownActive('cancelled', false, true);
        emitStatus('error', { message: 'The utterance could not be scheduled.' });
        return { started: false, reason: 'error', plan };
      }
    },
    cancel: (reason = 'cancelled') => {
      if (disposed) return;
      teardownActive(reason, true, true);
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      teardownActive('disposed', false, true);
      try {
        masterGain?.disconnect();
      } catch {
        // Already disconnected.
      }
      masterGain = null;
      const closingContext = context;
      context = null;
      if (closingContext && closingContext.state !== 'closed') {
        try {
          await closingContext.close();
        } catch {
          // Closing is best-effort on browsers tearing down the page.
        }
      }
      emitStatus('disposed');
    },
  };
};
