import type {
  VoiceSpeaker,
  VoiceUtteranceEndEvent,
  VoiceUtteranceEvent,
  VoiceViseme,
  VoiceVisemeEvent,
} from './little-workshop-voice';

export const CHARACTER_FRAMES = [
  'neutral',
  'inhale-mid',
  'inhale',
  'blink-quarter',
  'blink-half',
  'blink-three-quarter',
  'blink-closed',
  'wide-mid',
  'small-mid',
  'small',
  'open-mid',
  'open',
  'round-mid',
  'round',
  'smile-mid',
  'smile',
  'gesture-00',
  'gesture-01',
  'gesture-02',
  'gesture-03',
  'gesture-04',
  'gesture-05',
  'gesture-06',
  'gesture-07',
  'gesture-08',
  'gesture-09',
  'gesture-10',
  'gesture-11',
  'gesture-12',
  'gesture-13',
  'gesture-14',
  'gesture-15',
] as const;

export type CharacterFrame = (typeof CHARACTER_FRAMES)[number];

export interface FrameCue {
  readonly atMs: number;
  readonly frame: CharacterFrame;
}

export interface FrameIdleVariant {
  readonly id: string;
  readonly character: VoiceSpeaker;
  readonly durationMs: number;
  readonly cues: readonly FrameCue[];
}

export type FrameAnimationState = 'idle' | 'speech' | 'reduced-motion' | 'disposed';

export interface FrameAnimationOptions {
  readonly root: ParentNode;
  readonly reducedMotionQuery?: MediaQueryList;
  readonly seed?: number;
  readonly onStateChange?: (state: FrameAnimationState) => void;
  readonly onVariantStart?: (event: {
    character: VoiceSpeaker;
    variant: FrameIdleVariant;
  }) => void;
}

export interface LittleWorkshopFrameAnimationEngine {
  start(): FrameAnimationState;
  startSpeech(event: VoiceUtteranceEvent): void;
  viseme(event: VoiceVisemeEvent): void;
  endSpeech(event: VoiceUtteranceEndEvent): void;
  cancelSpeech(): void;
  getState(): FrameAnimationState;
  getCurrentVariant(character: VoiceSpeaker): FrameIdleVariant | null;
  dispose(): void;
}

export const FRAME_IDLE_DURATION_MS = 20_000;
export const FRAME_IDLE_VARIANT_COUNT = 50;
export const FRAME_BLINK_INTERVAL_MS = 42;
export const FRAME_GESTURE_INTERVAL_MS = 45;

const CHARACTERS: readonly VoiceSpeaker[] = ['pyotter', 'mikwhale'];
const CHARACTER_SALT: Readonly<Record<VoiceSpeaker, number>> = {
  pyotter: 0x50594f54,
  mikwhale: 0x4d494b57,
};
type SpeechFramePair = readonly [midpoint: CharacterFrame, target: CharacterFrame];

export const SPEECH_FRAME_PAIRS: Readonly<Record<VoiceViseme, SpeechFramePair>> =
  Object.freeze({
    rest: ['neutral', 'neutral'],
    small: ['small-mid', 'small'],
    open: ['open-mid', 'open'],
    wide: ['wide-mid', 'open'],
    round: ['round-mid', 'round'],
    smile: ['smile-mid', 'smile'],
  });

export const BLINK_FRAME_SEQUENCE = Object.freeze([
  'blink-quarter',
  'blink-half',
  'blink-three-quarter',
  'blink-closed',
  'blink-three-quarter',
  'blink-half',
  'blink-quarter',
  'neutral',
] as const satisfies readonly CharacterFrame[]);

export const GESTURE_FRAME_SEQUENCE = Object.freeze(
  Array.from({ length: 16 }, (_, index) =>
    `gesture-${String(index).padStart(2, '0')}`,
  ) as CharacterFrame[],
);

const mix32 = (value: number): number => {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
};

const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const shuffle = <Value>(values: readonly Value[], random: () => number): Value[] => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const gestureCues = (atMs: number): FrameCue[] => {
  const cues: FrameCue[] = GESTURE_FRAME_SEQUENCE.map((frame, index) => ({
    atMs: atMs + index * FRAME_GESTURE_INTERVAL_MS,
    frame,
  }));
  cues.push({
    atMs:
      atMs + GESTURE_FRAME_SEQUENCE.length * FRAME_GESTURE_INTERVAL_MS + 110,
    frame: 'neutral',
  });
  return cues;
};

const createIdleVariant = (
  character: VoiceSpeaker,
  index: number,
): FrameIdleVariant => {
  const random = createRandom(mix32(CHARACTER_SALT[character] ^ index));
  const openSlots = Array.from({ length: 12 }, (_, slot) => 900 + slot * 1_500);
  const chosenSlots = shuffle(openSlots, random)
    .slice(0, 6 + (index % 3))
    .sort((left, right) => left - right);
  const cues: FrameCue[] = [{ atMs: 0, frame: 'neutral' }];

  chosenSlots.forEach((slot, eventIndex) => {
    const jitter = Math.floor(random() * 260);
    const atMs = slot + jitter;
    const selector = (index * 3 + eventIndex * 5 + (character === 'mikwhale' ? 2 : 0)) % 11;

    if (eventIndex === 0) {
      cues.push(...gestureCues(atMs));
      return;
    }

    if (selector <= 4) {
      cues.push(
        ...BLINK_FRAME_SEQUENCE.map((frame, frameIndex) => ({
          atMs: atMs + frameIndex * FRAME_BLINK_INTERVAL_MS,
          frame,
        })),
      );
      return;
    }

    if (selector <= 7) {
      const durationMs = 520 + (index % 4) * 45;
      cues.push(
        { atMs, frame: 'inhale-mid' },
        { atMs: atMs + 90, frame: 'inhale' },
        { atMs: atMs + durationMs - 90, frame: 'inhale-mid' },
        { atMs: atMs + durationMs, frame: 'neutral' },
      );
      return;
    }

    if (selector === 8) {
      const durationMs = 360 + (index % 5) * 35;
      cues.push(
        { atMs, frame: 'smile-mid' },
        { atMs: atMs + 60, frame: 'smile' },
        { atMs: atMs + durationMs - 60, frame: 'smile-mid' },
        { atMs: atMs + durationMs, frame: 'neutral' },
      );
      return;
    }

    cues.push(...gestureCues(atMs));
  });

  cues.push({ atMs: FRAME_IDLE_DURATION_MS - 1, frame: 'neutral' });
  cues.sort((left, right) => left.atMs - right.atMs);

  return Object.freeze({
    id: `${character}-frame-idle-${String(index + 1).padStart(2, '0')}`,
    character,
    durationMs: FRAME_IDLE_DURATION_MS,
    cues: Object.freeze(cues),
  });
};

export const FRAME_IDLE_VARIANTS: Readonly<Record<VoiceSpeaker, readonly FrameIdleVariant[]>> =
  Object.freeze({
    pyotter: Object.freeze(
      Array.from({ length: FRAME_IDLE_VARIANT_COUNT }, (_, index) =>
        createIdleVariant('pyotter', index),
      ),
    ),
    mikwhale: Object.freeze(
      Array.from({ length: FRAME_IDLE_VARIANT_COUNT }, (_, index) =>
        createIdleVariant('mikwhale', index),
      ),
    ),
  });

export const createFrameIdleVariantOrder = (
  character: VoiceSpeaker,
  seed: number,
  cycle: number,
): number[] => {
  const random = createRandom(
    mix32(seed ^ CHARACTER_SALT[character] ^ Math.imul(cycle + 1, 0x9e3779b1)),
  );
  return shuffle(
    Array.from({ length: FRAME_IDLE_VARIANT_COUNT }, (_, index) => index),
    random,
  );
};

const frameForTime = (variant: FrameIdleVariant, elapsedMs: number): CharacterFrame => {
  let frame: CharacterFrame = 'neutral';
  for (const cue of variant.cues) {
    if (cue.atMs > elapsedMs) break;
    frame = cue.frame;
  }
  return frame;
};

interface CharacterChannel {
  readonly element: HTMLElement;
  order: number[];
  orderPosition: number;
  orderCycle: number;
  variantStartedAt: number;
  currentVariant: FrameIdleVariant;
  mode: 'idle' | 'speech';
  speechMidFrame: CharacterFrame;
  speechTargetFrame: CharacterFrame;
  speechReturnFrame: CharacterFrame;
  speechFrameStartedAt: number;
  speechMidpointMs: number;
  renderedFrame: CharacterFrame | null;
}

const fallbackNow = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

export const createLittleWorkshopFrameAnimationEngine = (
  options: FrameAnimationOptions,
): LittleWorkshopFrameAnimationEngine => {
  const seed = options.seed ?? 0x50594f54;
  const rootDocument =
    'ownerDocument' in options.root
      ? options.root.ownerDocument
      : (options.root as Document);
  const documentWindow = rootDocument?.defaultView;
  const requestFrame = documentWindow?.requestAnimationFrame.bind(documentWindow);
  const cancelFrame = documentWindow?.cancelAnimationFrame.bind(documentWindow);
  const reducedMotion =
    options.reducedMotionQuery ??
    documentWindow?.matchMedia('(prefers-reduced-motion: reduce)') ??
    null;
  let disposed = false;
  let started = false;
  let animationFrame = 0;
  let state: FrameAnimationState = reducedMotion?.matches ? 'reduced-motion' : 'idle';

  const channels = new Map<VoiceSpeaker, CharacterChannel>();
  for (const character of CHARACTERS) {
    const element = options.root.querySelector<HTMLElement>(
      `[data-frame-character="${character}"]`,
    );
    if (!element) {
      throw new Error(`Missing full-frame character renderer: ${character}`);
    }
    const order = createFrameIdleVariantOrder(character, seed, 0);
    channels.set(character, {
      element,
      order,
      orderPosition: 0,
      orderCycle: 0,
      variantStartedAt: fallbackNow(),
      currentVariant: FRAME_IDLE_VARIANTS[character][order[0]],
      mode: 'idle',
      speechMidFrame: 'neutral',
      speechTargetFrame: 'neutral',
      speechReturnFrame: 'neutral',
      speechFrameStartedAt: 0,
      speechMidpointMs: 0,
      renderedFrame: null,
    });
  }

  const emitState = (next: FrameAnimationState): void => {
    if (state === next) return;
    state = next;
    options.onStateChange?.(next);
  };

  const render = (channel: CharacterChannel, frame: CharacterFrame): void => {
    if (channel.renderedFrame === frame) return;
    channel.renderedFrame = frame;
    channel.element.dataset.frame = frame;
  };

  const beginNextVariant = (
    character: VoiceSpeaker,
    channel: CharacterChannel,
    startedAt: number,
  ): void => {
    channel.orderPosition += 1;
    if (channel.orderPosition >= channel.order.length) {
      channel.orderCycle += 1;
      channel.orderPosition = 0;
      const previousIndex = channel.order[channel.order.length - 1];
      channel.order = createFrameIdleVariantOrder(character, seed, channel.orderCycle);
      if (channel.order[0] === previousIndex) {
        [channel.order[0], channel.order[1]] = [channel.order[1], channel.order[0]];
      }
    }
    channel.variantStartedAt = startedAt;
    channel.currentVariant =
      FRAME_IDLE_VARIANTS[character][channel.order[channel.orderPosition]];
    options.onVariantStart?.({ character, variant: channel.currentVariant });
  };

  const draw = (now: number): void => {
    if (disposed) return;
    const isReduced = Boolean(reducedMotion?.matches);

    for (const character of CHARACTERS) {
      const channel = channels.get(character);
      if (!channel) continue;
      if (isReduced) {
        render(channel, channel.mode === 'speech' ? channel.speechTargetFrame : 'neutral');
        continue;
      }
      if (channel.mode === 'speech') {
        render(
          channel,
          now - channel.speechFrameStartedAt >= channel.speechMidpointMs
            ? channel.speechTargetFrame
            : channel.speechMidFrame,
        );
        continue;
      }

      let elapsedMs = now - channel.variantStartedAt;
      while (elapsedMs >= FRAME_IDLE_DURATION_MS) {
        beginNextVariant(
          character,
          channel,
          channel.variantStartedAt + FRAME_IDLE_DURATION_MS,
        );
        elapsedMs = now - channel.variantStartedAt;
      }
      render(channel, frameForTime(channel.currentVariant, Math.max(0, elapsedMs)));
    }

    animationFrame = requestFrame?.(draw) ?? 0;
  };

  const resetSpeech = (speaker?: VoiceSpeaker): void => {
    const now = fallbackNow();
    for (const character of CHARACTERS) {
      if (speaker && speaker !== character) continue;
      const channel = channels.get(character);
      if (!channel) continue;
      channel.mode = 'idle';
      channel.speechMidFrame = 'neutral';
      channel.speechTargetFrame = 'neutral';
      channel.speechReturnFrame = 'neutral';
      channel.speechFrameStartedAt = 0;
      channel.speechMidpointMs = 0;
      channel.variantStartedAt = now;
      render(channel, 'neutral');
    }
    if (!Array.from(channels.values()).some((channel) => channel.mode === 'speech')) {
      emitState(reducedMotion?.matches ? 'reduced-motion' : 'idle');
    }
  };

  const handleReducedMotion = (): void => {
    const hasSpeech = Array.from(channels.values()).some(
      (channel) => channel.mode === 'speech',
    );
    emitState(reducedMotion?.matches ? 'reduced-motion' : hasSpeech ? 'speech' : 'idle');
    for (const channel of channels.values()) {
      render(
        channel,
        channel.mode === 'speech' ? channel.speechTargetFrame : 'neutral',
      );
    }
  };

  reducedMotion?.addEventListener('change', handleReducedMotion);

  return {
    start: () => {
      if (disposed) return 'disposed';
      if (started) return state;
      started = true;
      const now = fallbackNow();
      for (const character of CHARACTERS) {
        const channel = channels.get(character);
        if (!channel) continue;
        channel.variantStartedAt = now;
        options.onVariantStart?.({ character, variant: channel.currentVariant });
        render(channel, 'neutral');
      }
      options.onStateChange?.(state);
      animationFrame = requestFrame?.(draw) ?? 0;
      return state;
    },
    startSpeech: (event) => {
      if (disposed) return;
      const channel = channels.get(event.speaker);
      if (!channel) return;
      channel.mode = 'speech';
      channel.speechMidFrame = 'neutral';
      channel.speechTargetFrame = 'neutral';
      channel.speechReturnFrame = 'neutral';
      channel.speechFrameStartedAt = fallbackNow();
      channel.speechMidpointMs = 0;
      render(channel, 'neutral');
      emitState(reducedMotion?.matches ? 'reduced-motion' : 'speech');
    },
    viseme: (event) => {
      if (disposed) return;
      const channel = channels.get(event.speaker);
      if (!channel || channel.mode !== 'speech') return;
      const pair = SPEECH_FRAME_PAIRS[event.viseme];
      channel.speechMidFrame =
        event.viseme === 'rest' ? channel.speechReturnFrame : pair[0];
      channel.speechTargetFrame = pair[1];
      if (event.viseme !== 'rest') channel.speechReturnFrame = pair[0];
      channel.speechFrameStartedAt = fallbackNow();
      channel.speechMidpointMs = Math.min(
        48,
        Math.max(17, event.durationMs * 0.42),
      );
      render(
        channel,
        reducedMotion?.matches ? channel.speechTargetFrame : channel.speechMidFrame,
      );
    },
    endSpeech: (event) => {
      if (disposed) return;
      resetSpeech(event.speaker);
    },
    cancelSpeech: () => {
      if (disposed) return;
      resetSpeech();
    },
    getState: () => state,
    getCurrentVariant: (character) =>
      disposed ? null : channels.get(character)?.currentVariant ?? null,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (animationFrame) cancelFrame?.(animationFrame);
      reducedMotion?.removeEventListener('change', handleReducedMotion);
      for (const channel of channels.values()) {
        render(channel, 'neutral');
      }
      emitState('disposed');
    },
  };
};
