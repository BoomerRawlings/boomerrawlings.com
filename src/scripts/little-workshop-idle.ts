/**
 * Deterministic, articulated idles for the Little Workshop characters.
 *
 * Variant creation is pure and safe to import in Node. Browser APIs are only
 * resolved when createLittleWorkshopIdleEngine() is called. The animated root
 * is deliberately kept at identity: production motion belongs to named rig
 * descendants, never to the whole character.
 */

export type IdleCharacter = 'pyotter' | 'mikwhale';

export const IDLE_PARTS = Object.freeze([
  'head',
  'eye-left',
  'eye-right',
  'nose',
  'fur',
  'ear-left',
  'ear-right',
  'paw-left',
  'paw-right',
  'chest',
  'torso',
  'foot-left',
  'foot-right',
  'tail',
] as const);

export type IdlePart = (typeof IDLE_PARTS)[number];

export const IDLE_VARIANT_COUNT = 50;
export const IDLE_VARIANT_DURATION_MS = 20_000;
export const IDLE_IDENTITY_TRANSFORM =
  'translate3d(0px, 0px, 0) rotate(0deg) scaleX(1) scaleY(1)';

export interface IdleKeyframe {
  readonly offset: number;
  readonly transform: string;
  readonly easing: string;
  /** Used by seam-safe eyelid overlays; omitted for all other anatomy. */
  readonly opacity?: number;
}

export interface IdlePartTrack {
  readonly part: IdlePart;
  readonly active: boolean;
  readonly transformOrigin: string;
  readonly keyframes: readonly IdleKeyframe[];
}

export interface IdleVariant {
  readonly id: string;
  readonly character: IdleCharacter;
  readonly index: number;
  readonly name: string;
  readonly durationMs: typeof IDLE_VARIANT_DURATION_MS;
  /**
   * Identity-only compatibility clock for consumers of the former whole-rig
   * API. The runtime never uses it when articulated markup is present.
   */
  readonly keyframes: readonly IdleKeyframe[];
  /** Canonical articulated tracks; one for every entry in IDLE_PARTS. */
  readonly partTracks: readonly IdlePartTrack[];
  /** Readable alias for partTracks. Both properties reference the same array. */
  readonly parts: readonly IdlePartTrack[];
}

interface MotionSample {
  readonly offset: number;
  readonly x?: number;
  readonly y?: number;
  readonly rotate?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly absoluteScaleX?: number;
  readonly absoluteScaleY?: number;
  readonly easing?: string;
  readonly opacity?: number;
}

interface PartRange {
  readonly xPixels: number;
  readonly yPixels: number;
  readonly rotationDegrees: number;
  readonly scaleXAmount: number;
  readonly scaleYAmount: number;
  readonly origin: string;
}

type AccentGroup = 'head-ears' | 'paws' | 'tail-feet' | 'nose-fur';

interface IdleMotif {
  readonly names: Readonly<Record<IdleCharacter, string>>;
  readonly accents: readonly AccentGroup[];
  readonly energy: number;
  readonly timingBias: number;
}

interface IdleProfile {
  readonly phase: number;
  readonly ranges: Readonly<Record<IdlePart, PartRange>>;
}

const CHARACTERS: readonly IdleCharacter[] = Object.freeze(['pyotter', 'mikwhale']);
const SMOOTH_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';
const QUICK_SMOOTH_EASING = 'cubic-bezier(0.4, 0, 0.6, 1)';

const range = (
  xPixels: number,
  yPixels: number,
  rotationDegrees: number,
  scaleXAmount: number,
  scaleYAmount: number,
  origin: string,
): PartRange =>
  Object.freeze({
    xPixels,
    yPixels,
    rotationDegrees,
    scaleXAmount,
    scaleYAmount,
    origin,
  });

const PYOTTER_EYE_RANGE = range(1.4, 0.5, 0, 0.035, 0.02, '50% 52%');
const PYOTTER_EAR_LEFT_RANGE = range(0.45, 0.65, 2, 0.012, 0.018, '78% 88%');
const PYOTTER_EAR_RIGHT_RANGE = range(0.45, 0.65, 2, 0.012, 0.018, '22% 88%');
const PYOTTER_PAW_LEFT_RANGE = range(0.8, 3, 2, 0.01, 0.012, '72% 16%');
const PYOTTER_PAW_RIGHT_RANGE = range(0.8, 3, 2, 0.01, 0.012, '28% 16%');
const PYOTTER_FOOT_LEFT_RANGE = range(0.65, 1.1, 1, 0.01, 0.01, '70% 18%');
const PYOTTER_FOOT_RIGHT_RANGE = range(0.65, 1.1, 1, 0.01, 0.01, '30% 18%');

const MIKWHALE_EYE_RANGE = range(1.15, 0.4, 0, 0.03, 0.018, '50% 52%');
const MIKWHALE_EAR_LEFT_RANGE = range(0.5, 0.55, 1.8, 0.014, 0.02, '76% 84%');
const MIKWHALE_EAR_RIGHT_RANGE = range(0.5, 0.55, 1.8, 0.014, 0.02, '24% 84%');
const MIKWHALE_PAW_LEFT_RANGE = range(0.85, 2.8, 1.8, 0.01, 0.012, '74% 18%');
const MIKWHALE_PAW_RIGHT_RANGE = range(0.85, 2.8, 1.8, 0.01, 0.012, '26% 18%');
const MIKWHALE_FOOT_LEFT_RANGE = range(0.75, 1, 1, 0.01, 0.01, '68% 20%');
const MIKWHALE_FOOT_RIGHT_RANGE = range(0.75, 1, 1, 0.01, 0.01, '32% 20%');

const PROFILES: Readonly<Record<IdleCharacter, IdleProfile>> = Object.freeze({
  pyotter: Object.freeze({
    phase: 0x71a2f31d,
    ranges: Object.freeze({
      head: range(1.25, 1.75, 1.45, 0.006, 0.007, '50% 82%'),
      'eye-left': PYOTTER_EYE_RANGE,
      'eye-right': PYOTTER_EYE_RANGE,
      nose: range(0.55, 0.5, 1.2, 0.018, 0.02, '50% 58%'),
      fur: range(0.45, 0.75, 0.9, 0.014, 0.018, '50% 80%'),
      'ear-left': PYOTTER_EAR_LEFT_RANGE,
      'ear-right': PYOTTER_EAR_RIGHT_RANGE,
      'paw-left': PYOTTER_PAW_LEFT_RANGE,
      'paw-right': PYOTTER_PAW_RIGHT_RANGE,
      chest: range(0.25, 0.65, 0.2, 0.012, 0.016, '50% 88%'),
      torso: range(0.2, 0.5, 0.18, 0.008, 0.01, '50% 86%'),
      'foot-left': PYOTTER_FOOT_LEFT_RANGE,
      'foot-right': PYOTTER_FOOT_RIGHT_RANGE,
      tail: range(1.1, 0.9, 2.5, 0.01, 0.012, '16% 58%'),
    }),
  }),
  mikwhale: Object.freeze({
    phase: 0xb41c09e7,
    ranges: Object.freeze({
      head: range(1.05, 1.5, 1.3, 0.005, 0.006, '50% 84%'),
      'eye-left': MIKWHALE_EYE_RANGE,
      'eye-right': MIKWHALE_EYE_RANGE,
      nose: range(0.5, 0.45, 1, 0.016, 0.018, '50% 60%'),
      fur: range(0.55, 0.8, 0.85, 0.016, 0.02, '50% 76%'),
      'ear-left': MIKWHALE_EAR_LEFT_RANGE,
      'ear-right': MIKWHALE_EAR_RIGHT_RANGE,
      'paw-left': MIKWHALE_PAW_LEFT_RANGE,
      'paw-right': MIKWHALE_PAW_RIGHT_RANGE,
      chest: range(0.22, 0.65, 0.16, 0.011, 0.015, '50% 88%'),
      torso: range(0.18, 0.45, 0.14, 0.007, 0.009, '50% 88%'),
      'foot-left': MIKWHALE_FOOT_LEFT_RANGE,
      'foot-right': MIKWHALE_FOOT_RIGHT_RANGE,
      tail: range(1.2, 1, 2.35, 0.011, 0.013, '50% 18%'),
    }),
  }),
});

const ACCENT_PARTS: Readonly<Record<AccentGroup, readonly IdlePart[]>> = Object.freeze({
  'head-ears': Object.freeze(['head', 'ear-left', 'ear-right'] as const),
  paws: Object.freeze(['paw-left', 'paw-right'] as const),
  'tail-feet': Object.freeze(['tail', 'foot-left', 'foot-right'] as const),
  'nose-fur': Object.freeze(['nose', 'fur'] as const),
});

const MOTIFS: readonly IdleMotif[] = Object.freeze([
  Object.freeze({
    names: Object.freeze({ pyotter: 'soft listening', mikwhale: 'deep listening' }),
    accents: Object.freeze(['head-ears'] as const),
    energy: 0.78,
    timingBias: -0.36,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'curious survey', mikwhale: 'measured survey' }),
    accents: Object.freeze(['nose-fur'] as const),
    energy: 0.9,
    timingBias: 0.22,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'whisker thought', mikwhale: 'moustache thought' }),
    accents: Object.freeze(['paws'] as const),
    energy: 0.84,
    timingBias: 0.48,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'paw patience', mikwhale: 'flipper patience' }),
    accents: Object.freeze(['tail-feet'] as const),
    energy: 0.82,
    timingBias: -0.12,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'cozy breath', mikwhale: 'buoyant breath' }),
    accents: Object.freeze(['head-ears', 'nose-fur'] as const),
    energy: 0.72,
    timingBias: -0.5,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'bright perk', mikwhale: 'solemn perk' }),
    accents: Object.freeze(['head-ears', 'paws'] as const),
    energy: 1.02,
    timingBias: 0.1,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'ear-led wonder', mikwhale: 'curl-led wonder' }),
    accents: Object.freeze(['nose-fur', 'tail-feet'] as const),
    energy: 0.94,
    timingBias: 0.38,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'tiny reset', mikwhale: 'weighty reset' }),
    accents: Object.freeze(['paws', 'tail-feet'] as const),
    energy: 0.88,
    timingBias: -0.25,
  }),
  Object.freeze({
    names: Object.freeze({
      pyotter: 'tail-contained delight',
      mikwhale: 'fluke-contained delight',
    }),
    accents: Object.freeze(['head-ears', 'tail-feet'] as const),
    energy: 1,
    timingBias: 0.3,
  }),
  Object.freeze({
    names: Object.freeze({ pyotter: 'thoughtful stillness', mikwhale: 'deliberate stillness' }),
    accents: Object.freeze(['nose-fur', 'paws'] as const),
    energy: 0.68,
    timingBias: -0.44,
  }),
]);

const freezeSamples = (samples: readonly MotionSample[]): readonly MotionSample[] =>
  Object.freeze(samples.map((sample) => Object.freeze(sample)));

const HEAD_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.08, y: -0.16, rotate: -0.16 },
  { offset: 0.46, x: -0.18, y: -0.55, rotate: -0.68 },
  { offset: 0.56, x: -0.06, y: -0.14, rotate: -0.12 },
  { offset: 0.68 },
  { offset: 1 },
]);

const PYOTTER_EYE_SAMPLES = freezeSamples([
  { offset: 0, opacity: 0 },
  { offset: 0.12, opacity: 0 },
  { offset: 0.382, opacity: 0 },
  { offset: 0.389, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.395, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.405, opacity: 0, easing: QUICK_SMOOTH_EASING },
  { offset: 0.782, opacity: 0 },
  { offset: 0.789, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.795, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.805, opacity: 0, easing: QUICK_SMOOTH_EASING },
  { offset: 1, opacity: 0 },
]);

// Keep each character binocular, but do not make the pair blink in lockstep.
const MIKWHALE_EYE_SAMPLES = freezeSamples([
  { offset: 0, opacity: 0 },
  { offset: 0.12, opacity: 0 },
  { offset: 0.287, opacity: 0 },
  { offset: 0.294, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.3, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.31, opacity: 0, easing: QUICK_SMOOTH_EASING },
  { offset: 0.667, opacity: 0 },
  { offset: 0.674, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.68, opacity: 1, easing: QUICK_SMOOTH_EASING },
  { offset: 0.69, opacity: 0, easing: QUICK_SMOOTH_EASING },
  { offset: 1, opacity: 0 },
]);

const NOSE_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.08, y: -0.08, rotate: -0.1 },
  { offset: 0.46, x: -0.4, y: -0.26, rotate: -0.56, scaleX: 0.38, scaleY: -0.28 },
  { offset: 0.56, x: 0.1, y: 0.08, rotate: 0.12, scaleX: -0.12, scaleY: 0.14 },
  { offset: 0.68 },
  { offset: 1 },
]);

const FUR_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, y: 0.08, rotate: -0.06, scaleX: 0.1, scaleY: -0.08 },
  { offset: 0.46, x: -0.16, y: -0.32, rotate: -0.48, scaleX: -0.16, scaleY: 0.5 },
  { offset: 0.56, x: 0.06, y: -0.1, rotate: 0.08, scaleX: 0.08, scaleY: 0.16 },
  { offset: 0.68 },
  { offset: 1 },
]);

const EAR_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.08, y: -0.08, rotate: -0.12 },
  { offset: 0.46, x: -0.3, y: -0.26, rotate: -0.72, scaleX: 0.12, scaleY: 0.16 },
  { offset: 0.56, x: 0.08, y: -0.08, rotate: 0.14 },
  { offset: 0.68 },
  { offset: 1 },
]);

const PAW_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.08, y: -0.1, rotate: -0.08 },
  { offset: 0.46, x: -0.34, y: -0.62, rotate: -0.58, scaleX: 0.1, scaleY: 0.1 },
  { offset: 0.56, x: -0.1, y: -0.16, rotate: -0.14 },
  { offset: 0.68 },
  { offset: 1 },
]);

const CHEST_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.11, y: 0.16, scaleX: 0.24, scaleY: -0.22 },
  { offset: 0.24, y: -0.4, scaleX: -0.16, scaleY: 0.62 },
  { offset: 0.37, y: 0.12, scaleX: 0.2, scaleY: -0.2 },
  { offset: 0.5, y: -0.34, scaleX: -0.14, scaleY: 0.54 },
  { offset: 0.63, y: 0.1, scaleX: 0.18, scaleY: -0.18 },
  { offset: 0.76, y: -0.3, scaleX: -0.12, scaleY: 0.46 },
  { offset: 0.89, y: 0.08, scaleX: 0.14, scaleY: -0.14 },
  { offset: 1 },
]);

const TORSO_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.15, y: 0.2, rotate: -0.08, scaleX: 0.22, scaleY: -0.22 },
  { offset: 0.31, y: -0.34, rotate: 0.12, scaleX: -0.14, scaleY: 0.46 },
  { offset: 0.47, y: 0.16, rotate: -0.1, scaleX: 0.18, scaleY: -0.18 },
  { offset: 0.63, y: -0.3, rotate: 0.12, scaleX: -0.12, scaleY: 0.4 },
  { offset: 0.79, y: 0.12, rotate: -0.06, scaleX: 0.14, scaleY: -0.14 },
  { offset: 0.9, y: -0.12, scaleY: 0.16 },
  { offset: 1 },
]);

const FOOT_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.08, y: -0.08, rotate: -0.1 },
  { offset: 0.46, x: -0.38, y: -0.42, rotate: -0.7, scaleX: 0.14, scaleY: 0.1 },
  { offset: 0.56, x: -0.08, y: 0.06, rotate: -0.08 },
  { offset: 0.68 },
  { offset: 1 },
]);

const TAIL_SAMPLES = freezeSamples([
  { offset: 0 },
  { offset: 0.28 },
  { offset: 0.38, x: -0.1, y: -0.06, rotate: -0.14 },
  { offset: 0.46, x: -0.62, y: -0.26, rotate: -0.78, scaleX: 0.08, scaleY: 0.06 },
  { offset: 0.52, x: 0.42, y: -0.18, rotate: 0.58, scaleX: -0.06, scaleY: 0.08 },
  { offset: 0.58, x: -0.12, y: -0.04, rotate: -0.16 },
  { offset: 0.68 },
  { offset: 1 },
]);

const samplesForPart = (
  part: IdlePart,
  character: IdleCharacter,
): readonly MotionSample[] => {
  if (part === 'head') return HEAD_SAMPLES;
  if (part === 'eye-left' || part === 'eye-right') {
    return character === 'pyotter' ? PYOTTER_EYE_SAMPLES : MIKWHALE_EYE_SAMPLES;
  }
  if (part === 'nose') return NOSE_SAMPLES;
  if (part === 'fur') return FUR_SAMPLES;
  if (part === 'ear-left' || part === 'ear-right') return EAR_SAMPLES;
  if (part === 'paw-left' || part === 'paw-right') return PAW_SAMPLES;
  if (part === 'chest') return CHEST_SAMPLES;
  if (part === 'torso') return TORSO_SAMPLES;
  if (part === 'foot-left' || part === 'foot-right') return FOOT_SAMPLES;
  return TAIL_SAMPLES;
};

const rounded = (value: number, places = 3): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

const formatNumber = (value: number, places = 3): string => {
  const normalized = Math.abs(value) < 10 ** -places ? 0 : rounded(value, places);
  return String(normalized);
};

const mix32 = (value: number): number => {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
};

const randomFromSeed = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const directionForPart = (
  part: IdlePart,
  character: IdleCharacter,
  motifIndex: number,
  variation: number,
): number => {
  const globalDirection =
    ((motifIndex + variation + (character === 'mikwhale' ? 1 : 0)) & 1) === 0 ? 1 : -1;
  if (part === 'ear-right' || part === 'paw-right' || part === 'foot-right') {
    return -globalDirection;
  }
  // Both eyes travel together to create gaze rather than cross-eyed mirroring.
  return globalDirection;
};

const transformForSample = (
  sample: MotionSample,
  partRange: PartRange,
  amplitude: number,
  direction: number,
): string => {
  if (sample.offset === 0 || sample.offset === 1) return IDLE_IDENTITY_TRANSFORM;
  const x = (sample.x ?? 0) * partRange.xPixels * amplitude * direction;
  const y = (sample.y ?? 0) * partRange.yPixels * amplitude;
  const rotate =
    (sample.rotate ?? 0) * partRange.rotationDegrees * amplitude * direction;
  const scaleX =
    sample.absoluteScaleX ?? 1 + (sample.scaleX ?? 0) * partRange.scaleXAmount * amplitude;
  const scaleY =
    sample.absoluteScaleY ?? 1 + (sample.scaleY ?? 0) * partRange.scaleYAmount * amplitude;
  return `translate3d(${formatNumber(x)}px, ${formatNumber(y)}px, 0) rotate(${formatNumber(
    rotate,
  )}deg) scaleX(${formatNumber(scaleX, 4)}) scaleY(${formatNumber(scaleY, 4)})`;
};

const createCompatibilityClock = (
  character: IdleCharacter,
  index: number,
): readonly IdleKeyframe[] => {
  const phase = PROFILES[character].phase;
  const random = randomFromSeed(mix32(phase ^ Math.imul(index + 1, 0x9e3779b1)));
  const offsets = [
    0,
    0.14 + random() * 0.08,
    0.43 + random() * 0.12,
    0.74 + random() * 0.1,
    1,
  ];
  return Object.freeze(
    offsets.map((offset) =>
      Object.freeze({
        offset: rounded(offset, 4),
        transform: IDLE_IDENTITY_TRANSFORM,
        easing: SMOOTH_EASING,
      }),
    ),
  );
};

const isBaselinePart = (part: IdlePart): boolean =>
  part === 'eye-left' ||
  part === 'eye-right' ||
  part === 'chest' ||
  part === 'torso';

const accentGroupForPart = (motif: IdleMotif, part: IdlePart): AccentGroup | null =>
  motif.accents.find((accent) => ACCENT_PARTS[accent].includes(part)) ?? null;

const timingAnchorForPart = (
  motif: IdleMotif,
  part: IdlePart,
): IdlePart => {
  if (part === 'eye-left' || part === 'eye-right') return 'eye-left';
  if (part === 'chest' || part === 'torso') return 'chest';
  const accent = accentGroupForPart(motif, part);
  return accent ? ACCENT_PARTS[accent][0] : part;
};

const identityTrack = (part: IdlePart, transformOrigin: string): IdlePartTrack =>
  Object.freeze({
    part,
    active: false,
    transformOrigin,
    keyframes: Object.freeze([
      Object.freeze({
        offset: 0,
        transform: IDLE_IDENTITY_TRANSFORM,
        easing: SMOOTH_EASING,
        ...(part === 'eye-left' || part === 'eye-right' ? { opacity: 0 } : {}),
      }),
      Object.freeze({
        offset: 1,
        transform: IDLE_IDENTITY_TRANSFORM,
        easing: SMOOTH_EASING,
        ...(part === 'eye-left' || part === 'eye-right' ? { opacity: 0 } : {}),
      }),
    ]),
  });

const createPartTrack = (
  character: IdleCharacter,
  part: IdlePart,
  variantIndex: number,
  motifIndex: number,
  variation: number,
): IdlePartTrack => {
  const profile = PROFILES[character];
  const motif = MOTIFS[motifIndex];
  const partRange = profile.ranges[part];
  const baseline = isBaselinePart(part);
  const semanticAccent = accentGroupForPart(motif, part);
  if (!baseline && !semanticAccent) return identityTrack(part, partRange.origin);

  // Coupled anatomy shares timing seeds; eye tracks are exactly binocular.
  const timingPartIndex = IDLE_PARTS.indexOf(timingAnchorForPart(motif, part));
  const random = randomFromSeed(
    mix32(
      profile.phase ^
        Math.imul(variantIndex + 1, 0x9e3779b1) ^
        Math.imul(timingPartIndex + 1, 0x85ebca6b),
    ),
  );
  const variationAmount = 0.9 + variation * 0.045;
  const roleAmount =
    part === 'eye-left' || part === 'eye-right'
      ? 0.72
      : part === 'chest' || part === 'torso'
        ? 0.48
        : 0.82;
  const amplitude = motif.energy * roleAmount * variationAmount * (0.96 + random() * 0.08);
  const direction = directionForPart(part, character, motifIndex, variation);
  const source = samplesForPart(part, character);
  let previousOffset = -1;
  const keyframes = source.map((sample, sampleIndex): IdleKeyframe => {
    if (sampleIndex === 0 || sampleIndex === source.length - 1) {
      previousOffset = sample.offset;
      return Object.freeze({
        offset: sample.offset,
        transform: IDLE_IDENTITY_TRANSFORM,
        easing: SMOOTH_EASING,
        ...(part === 'eye-left' || part === 'eye-right' ? { opacity: 0 } : {}),
      });
    }

    const previousSourceOffset = source[sampleIndex - 1]?.offset ?? 0;
    const nextSourceOffset = source[sampleIndex + 1]?.offset ?? 1;
    const timingWave = Math.sin(
      (sampleIndex + 1) * 1.73 + variantIndex * 0.61 + timingPartIndex,
    );
    const accentShift = semanticAccent
      ? motif.timingBias * 0.08 + (variation - 2) * 0.006
      : 0;
    const timingNudge =
      Math.sin(Math.PI * sample.offset) *
        (accentShift + (semanticAccent ? 0 : motif.timingBias * 0.005)) +
      timingWave * (0.0025 + variation * 0.00045) +
      (random() - 0.5) * 0.002;
    const minimum = Math.max(previousSourceOffset + 0.004, previousOffset + 0.004);
    const maximum = nextSourceOffset - 0.004;
    const offset = Math.min(maximum, Math.max(minimum, sample.offset + timingNudge));
    previousOffset = offset;
    return Object.freeze({
      offset: rounded(offset, 4),
      transform: transformForSample(sample, partRange, amplitude, direction),
      easing: sample.easing ?? SMOOTH_EASING,
      ...(sample.opacity === undefined ? {} : { opacity: sample.opacity }),
    });
  });

  return Object.freeze({
    part,
    active: true,
    transformOrigin: partRange.origin,
    keyframes: Object.freeze(keyframes),
  });
};

/**
 * Builds the complete immutable idle library for one character. Equal inputs
 * return equivalent data; no clocks, layout reads, or browser APIs are used.
 */
export const createIdleVariants = (character: IdleCharacter): readonly IdleVariant[] => {
  const resolvedCharacter: IdleCharacter = PROFILES[character] ? character : 'pyotter';
  const variants = Array.from({ length: IDLE_VARIANT_COUNT }, (_, index): IdleVariant => {
    const motifIndex = index % MOTIFS.length;
    const variation = Math.floor(index / MOTIFS.length);
    const motif = MOTIFS[motifIndex];
    const partTracks = Object.freeze(
      IDLE_PARTS.map((part) =>
        createPartTrack(resolvedCharacter, part, index, motifIndex, variation),
      ),
    );
    return Object.freeze({
      id: `${resolvedCharacter}-idle-${String(index + 1).padStart(2, '0')}`,
      character: resolvedCharacter,
      index,
      name: `${motif.names[resolvedCharacter]} ${variation + 1}`,
      durationMs: IDLE_VARIANT_DURATION_MS,
      keyframes: createCompatibilityClock(resolvedCharacter, index),
      partTracks,
      parts: partTracks,
    });
  });
  return Object.freeze(variants);
};

export const LITTLE_WORKSHOP_IDLE_VARIANTS: Readonly<
  Record<IdleCharacter, readonly IdleVariant[]>
> = Object.freeze({
  pyotter: createIdleVariants('pyotter'),
  mikwhale: createIdleVariants('mikwhale'),
});

/** Returns a pure, deterministic shuffled pass through all 50 variants. */
export const createIdleVariantOrder = (
  character: IdleCharacter,
  seed = 0,
  cycle = 0,
): readonly number[] => {
  const profile = PROFILES[character] ?? PROFILES.pyotter;
  const normalizedSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  const normalizedCycle = Number.isFinite(cycle) ? Math.max(0, Math.trunc(cycle)) >>> 0 : 0;
  const random = randomFromSeed(
    mix32(normalizedSeed ^ profile.phase ^ Math.imul(normalizedCycle + 1, 0x9e3779b1)),
  );
  const order = Array.from({ length: IDLE_VARIANT_COUNT }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const replacementIndex = Math.floor(random() * (index + 1));
    [order[index], order[replacementIndex]] = [order[replacementIndex], order[index]];
  }
  return Object.freeze(order);
};

export type IdleEngineState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'reduced-motion'
  | 'unsupported'
  | 'disposed';

export interface IdleVariantStartEvent {
  readonly character: IdleCharacter;
  readonly variant: IdleVariant;
  readonly articulated: boolean;
  readonly animatedParts: readonly IdlePart[];
}

export type IdlePartTarget = Element | readonly Element[] | null;

export interface LittleWorkshopIdleEngineOptions {
  /** Defaults to the current document when available. */
  readonly root?: ParentNode | null;
  /** Explicit rig roots override root lookup one character at a time. */
  readonly targets?: Partial<Record<IdleCharacter, Element | null>>;
  /**
   * Optional explicit descendant bindings. Omitted roles resolve from either
   * data-idle-part="role" or data-part="role" below the character rig root.
   */
  readonly parts?: Partial<
    Record<IdleCharacter, Partial<Record<IdlePart, IdlePartTarget>>>
  >;
  readonly seed?: number;
  /** Lifecycle dependency injection; defaults to the current document. */
  readonly document?: Document | null;
  /** Preference dependency injection; defaults to matchMedia() when available. */
  readonly reducedMotionQuery?: MediaQueryList | null;
  readonly onStateChange?: (state: IdleEngineState) => void;
  readonly onVariantStart?: (event: IdleVariantStartEvent) => void;
}

export interface LittleWorkshopIdleEngine {
  getState(): IdleEngineState;
  getCurrentVariant(character: IdleCharacter): IdleVariant | null;
  getBoundParts(character: IdleCharacter): readonly IdlePart[];
  getMissingParts(character: IdleCharacter): readonly IdlePart[];
  start(): IdleEngineState;
  pause(): IdleEngineState;
  resume(): IdleEngineState;
  dispose(): void;
}

interface ResolvedParts {
  readonly elements: ReadonlyMap<IdlePart, readonly Element[]>;
  readonly hasPartMarkup: boolean;
}

interface IdleChannel {
  readonly character: IdleCharacter;
  readonly target: Element;
  readonly parts: ReadonlyMap<IdlePart, readonly Element[]>;
  readonly articulated: boolean;
  animations: Animation[];
  current: IdleVariant | null;
  queue: number[];
  cycle: number;
  previousIndex: number | null;
  generation: number;
  failed: boolean;
}

type RunIntent = 'idle' | 'running' | 'paused';

const invokeSafely = <Arguments extends readonly unknown[]>(
  callback: ((...values: Arguments) => void) | undefined,
  ...values: Arguments
): void => {
  try {
    callback?.(...values);
  } catch {
    // Presentation callbacks must not break animation lifecycle cleanup.
  }
};

const resolveDocument = (supplied: Document | null | undefined): Document | null => {
  if (supplied !== undefined) return supplied;
  try {
    return (globalThis as unknown as { document?: Document }).document ?? null;
  } catch {
    return null;
  }
};

const resolveMotionQuery = (
  supplied: MediaQueryList | null | undefined,
): MediaQueryList | null => {
  if (supplied !== undefined) return supplied;
  try {
    const matchMedia = (globalThis as unknown as { matchMedia?: (query: string) => MediaQueryList })
      .matchMedia;
    return matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  } catch {
    return null;
  }
};

const hasOwn = (value: object | undefined, key: PropertyKey): boolean =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

const asElements = (target: IdlePartTarget | undefined): readonly Element[] => {
  if (!target) return Object.freeze([]);
  return Object.freeze(Array.isArray(target) ? [...target] : [target as Element]);
};

const canAnimate = (element: Element): boolean => typeof element.animate === 'function';

const resolveParts = (
  target: Element,
  explicit: Partial<Record<IdlePart, IdlePartTarget>> | undefined,
): ResolvedParts => {
  const elements = new Map<IdlePart, readonly Element[]>();
  let hasPartMarkup = false;

  for (const part of IDLE_PARTS) {
    let candidates: readonly Element[];
    if (hasOwn(explicit, part)) {
      candidates = asElements(explicit?.[part]);
    } else {
      try {
        candidates = Array.from(
          target.querySelectorAll(
            `[data-idle-part="${part}"], [data-part="${part}"]`,
          ),
        );
      } catch {
        candidates = [];
      }
    }

    const descendants = [...new Set(candidates)].filter((element) => {
      try {
        return target.contains(element);
      } catch {
        return false;
      }
    });
    if (descendants.length > 0) hasPartMarkup = true;
    const animated = descendants.filter(canAnimate);
    if (animated.length > 0) elements.set(part, Object.freeze(animated));
  }

  return Object.freeze({ elements, hasPartMarkup });
};

const animationFrames = (
  track: IdlePartTrack,
  element: Element,
): Keyframe[] => {
  let transformOrigin = track.transformOrigin;
  try {
    const pivot = element.getAttribute('data-pivot')?.trim().split(/\s+/u);
    const pivotOrigin =
      pivot?.length === 2 && pivot.every((value) => Number.isFinite(Number(value)))
        ? `${pivot[0]}px ${pivot[1]}px`
        : null;
    transformOrigin =
      element.getAttribute('data-idle-origin') ??
      element.getAttribute('data-part-origin') ??
      pivotOrigin ??
      transformOrigin;
  } catch {
    // The authored track origin remains a safe default.
  }
  return track.keyframes.map((frame) => ({
    offset: frame.offset,
    transform: frame.transform,
    transformOrigin,
    easing: frame.easing,
    ...(frame.opacity === undefined ? {} : { opacity: frame.opacity }),
  }));
};

/**
 * Runs each character independently through shuffled 50-variant bags. Every
 * bound part receives its own compositor animation. Promise chaining advances
 * phrases, so there is no requestAnimationFrame or other per-frame JS loop.
 */
export const createLittleWorkshopIdleEngine = (
  options: LittleWorkshopIdleEngineOptions = {},
): LittleWorkshopIdleEngine => {
  const lifecycleDocument = resolveDocument(options.document);
  const root = options.root === undefined ? lifecycleDocument : options.root;
  const motionQuery = resolveMotionQuery(options.reducedMotionQuery);
  const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed ?? 0) >>> 0 : 0;
  const channels: IdleChannel[] = [];

  for (const character of CHARACTERS) {
    let target: Element | null = null;
    try {
      target = hasOwn(options.targets, character)
        ? (options.targets?.[character] ?? null)
        : (root?.querySelector(`[data-idle-target="${character}"]`) ?? null);
    } catch {
      target = null;
    }
    if (!target) continue;
    const resolvedParts = resolveParts(target, options.parts?.[character]);
    const articulated = resolvedParts.hasPartMarkup;
    const failed = articulated ? resolvedParts.elements.size === 0 : !canAnimate(target);
    channels.push({
      character,
      target,
      parts: resolvedParts.elements,
      articulated,
      animations: [],
      current: null,
      queue: [],
      cycle: 0,
      previousIndex: null,
      generation: 0,
      failed,
    });
  }

  let state: IdleEngineState = channels.some((channel) => !channel.failed)
    ? 'idle'
    : 'unsupported';
  let intent: RunIntent = 'idle';
  let disposed = false;
  let lifecycleAttached = false;

  const isHidden = (): boolean => {
    try {
      return lifecycleDocument?.hidden === true;
    } catch {
      return false;
    }
  };

  const isReduced = (): boolean => {
    try {
      return motionQuery?.matches === true;
    } catch {
      return false;
    }
  };

  const setState = (next: IdleEngineState): IdleEngineState => {
    if (state === next) return state;
    state = next;
    invokeSafely(options.onStateChange, state);
    return state;
  };

  const cancelChannel = (channel: IdleChannel): void => {
    channel.generation += 1;
    const animations = channel.animations;
    channel.animations = [];
    channel.current = null;
    for (const animation of animations) {
      try {
        animation.cancel();
      } catch {
        // A completed or detached effect is already visually inert.
      }
    }
  };

  const refillQueue = (channel: IdleChannel): void => {
    const order = [...createIdleVariantOrder(channel.character, seed, channel.cycle)];
    channel.cycle += 1;
    if (order.length > 1 && order[0] === channel.previousIndex) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    channel.queue = order;
  };

  const nextVariant = (channel: IdleChannel): IdleVariant => {
    if (channel.queue.length === 0) refillQueue(channel);
    const index = channel.queue.shift() ?? 0;
    channel.previousIndex = index;
    return LITTLE_WORKSHOP_IDLE_VARIANTS[channel.character][index];
  };

  const effectiveRunning = (): boolean =>
    !disposed && intent === 'running' && !isHidden() && !isReduced();

  const startChannel = (channel: IdleChannel): void => {
    if (!effectiveRunning() || channel.failed || channel.animations.length > 0) return;
    const variant = nextVariant(channel);
    const generation = channel.generation + 1;
    channel.generation = generation;
    channel.current = variant;
    const animations: Animation[] = [];
    const animatedPartSet = new Set<IdlePart>();

    if (channel.articulated) {
      for (const track of variant.partTracks) {
        if (!track.active) continue;
        const partElements = channel.parts.get(track.part) ?? [];
        for (const element of partElements) {
          try {
            animations.push(
              element.animate(animationFrames(track, element), {
                duration: variant.durationMs,
                iterations: 1,
                fill: 'none',
                easing: 'linear',
              }),
            );
            animatedPartSet.add(track.part);
          } catch {
            // One malformed/detached part must not stop the remaining rig.
          }
        }
      }
    } else {
      try {
        // Legacy roots receive an identity-only clock, never whole-model drift.
        animations.push(
          channel.target.animate(variant.keyframes as Keyframe[], {
            duration: variant.durationMs,
            iterations: 1,
            fill: 'none',
            easing: 'linear',
          }),
        );
      } catch {
        // The channel is marked failed below when no usable animation remains.
      }
    }

    if (animations.length === 0) {
      channel.current = null;
      channel.failed = true;
      if (channels.every((candidate) => candidate.failed)) setState('unsupported');
      return;
    }

    channel.animations = animations;
    const animatedParts = Object.freeze([...animatedPartSet]);
    invokeSafely(options.onVariantStart, {
      character: channel.character,
      variant,
      articulated: channel.articulated,
      animatedParts,
    });

    void Promise.all(
      animations.map((animation) =>
        animation.finished.then(
          () => true,
          () => false,
        ),
      ),
    ).then(() => {
      if (
        disposed ||
        channel.failed ||
        channel.generation !== generation ||
        channel.animations !== animations
      ) {
        return;
      }
      channel.animations = [];
      channel.current = null;
      if (effectiveRunning()) startChannel(channel);
    });
  };

  const sync = (): IdleEngineState => {
    if (disposed) return setState('disposed');
    const available = channels.filter((channel) => !channel.failed);
    if (available.length === 0) return setState('unsupported');

    if (isReduced()) {
      for (const channel of available) cancelChannel(channel);
      return setState('reduced-motion');
    }

    if (intent === 'idle') return setState('idle');
    if (intent === 'paused' || isHidden()) {
      for (const channel of available) {
        for (const animation of channel.animations) {
          try {
            animation.pause();
          } catch {
            // An animation may finish between the lifecycle event and pause.
          }
        }
      }
      return setState('paused');
    }

    for (const channel of available) {
      for (const animation of channel.animations) {
        try {
          animation.play();
        } catch {
          cancelChannel(channel);
        }
      }
      startChannel(channel);
    }
    return setState(channels.some((channel) => !channel.failed) ? 'running' : 'unsupported');
  };

  const lifecycleChanged = (): void => {
    sync();
  };

  const attachLifecycle = (): void => {
    if (lifecycleAttached) return;
    lifecycleAttached = true;
    try {
      lifecycleDocument?.addEventListener('visibilitychange', lifecycleChanged);
    } catch {
      // Embedded documents may not expose a complete EventTarget implementation.
    }
    try {
      motionQuery?.addEventListener('change', lifecycleChanged);
    } catch {
      try {
        motionQuery?.addListener(lifecycleChanged);
      } catch {
        // Old/partial MediaQueryList implementations remain a static preference.
      }
    }
  };

  const detachLifecycle = (): void => {
    if (!lifecycleAttached) return;
    lifecycleAttached = false;
    try {
      lifecycleDocument?.removeEventListener('visibilitychange', lifecycleChanged);
    } catch {
      // Best-effort cleanup during document teardown.
    }
    try {
      motionQuery?.removeEventListener('change', lifecycleChanged);
    } catch {
      try {
        motionQuery?.removeListener(lifecycleChanged);
      } catch {
        // Best-effort cleanup for legacy MediaQueryList implementations.
      }
    }
  };

  const channelFor = (character: IdleCharacter): IdleChannel | undefined =>
    channels.find((channel) => channel.character === character);

  return {
    getState: () => state,
    getCurrentVariant: (character) => channelFor(character)?.current ?? null,
    getBoundParts: (character) =>
      Object.freeze([...(channelFor(character)?.parts.keys() ?? [])]),
    getMissingParts: (character) => {
      const bound = channelFor(character)?.parts;
      return Object.freeze(IDLE_PARTS.filter((part) => !bound?.has(part)));
    },
    start: () => {
      if (disposed) return state;
      intent = 'running';
      attachLifecycle();
      return sync();
    },
    pause: () => {
      if (disposed) return state;
      intent = 'paused';
      return sync();
    },
    resume: () => {
      if (disposed) return state;
      intent = 'running';
      attachLifecycle();
      return sync();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      intent = 'idle';
      detachLifecycle();
      for (const channel of channels) cancelChannel(channel);
      setState('disposed');
    },
  };
};
