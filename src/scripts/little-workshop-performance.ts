/**
 * Part-level speech performance for the Little Workshop puppets.
 *
 * The voice engine owns audio and mouth visemes. This module only moves the
 * transform-neutral wrappers inside each articulated body part. A complete
 * deterministic phrase is handed to Web Animations up front; live viseme
 * callbacks add small synchronized accents without a timer or per-frame loop.
 */

import type {
  SpeechPlan,
  VoiceSpeaker,
  VoiceUtteranceEndEvent,
  VoiceUtteranceEvent,
  VoiceViseme,
  VoiceVisemeEvent,
} from './little-workshop-voice';

export const LITTLE_WORKSHOP_PERFORMANCE_PARTS = Object.freeze([
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

export type LittleWorkshopPerformancePart =
  (typeof LITTLE_WORKSHOP_PERFORMANCE_PARTS)[number];

export const LITTLE_WORKSHOP_PERFORMANCE_IDENTITY =
  'translate3d(0px, 0px, 0) rotate(0deg) scaleX(1) scaleY(1)';

export interface LittleWorkshopPerformanceKeyframe {
  readonly offset: number;
  readonly transform: string;
  readonly transformOrigin: string;
  readonly easing: string;
}

export interface LittleWorkshopPartPerformance {
  readonly part: LittleWorkshopPerformancePart;
  readonly keyframes: readonly LittleWorkshopPerformanceKeyframe[];
}

export interface LittleWorkshopSpeechPerformancePlan {
  readonly version: 1;
  readonly speaker: VoiceSpeaker;
  readonly sourceSeed: number;
  readonly seed: number;
  readonly durationMs: number;
  readonly parts: Readonly<
    Record<LittleWorkshopPerformancePart, LittleWorkshopPartPerformance>
  >;
}

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rotate: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

interface ArticulationBeat {
  readonly index: number;
  readonly atMs: number;
  readonly durationMs: number;
  readonly intensity: number;
  readonly viseme: Exclude<VoiceViseme, 'rest'>;
}

interface PerformanceStyle {
  readonly salt: number;
  readonly peakRatio: number;
  readonly attackMs: number;
  readonly releaseMs: number;
  readonly movement: number;
  readonly easingIn: string;
  readonly easingOut: string;
}

interface PhraseStructure {
  readonly rhythm: readonly number[];
  readonly gaze: number;
  readonly blink: number;
  readonly gesture: number;
  readonly gestureSide: -1 | 1;
  readonly emphasis: number;
  readonly emphasisPart: 'ears' | 'tail' | null;
  readonly nose: readonly number[];
  readonly fur: readonly number[];
}

const IDENTITY_POSE: Pose = Object.freeze({
  x: 0,
  y: 0,
  rotate: 0,
  scaleX: 1,
  scaleY: 1,
});

/** Pyotter articulates quickly and brightly; Mikwhale lands fewer, deeper beats. */
const PERFORMANCE_STYLES: Readonly<Record<VoiceSpeaker, PerformanceStyle>> = Object.freeze({
  pyotter: Object.freeze({
    salt: 0x50594f54,
    peakRatio: 0.34,
    attackMs: 30,
    releaseMs: 78,
    movement: 1,
    easingIn: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
    easingOut: 'cubic-bezier(0.3, 0, 0.4, 1)',
  }),
  mikwhale: Object.freeze({
    salt: 0x4d494b57,
    peakRatio: 0.5,
    attackMs: 64,
    releaseMs: 154,
    movement: 0.82,
    easingIn: 'cubic-bezier(0.18, 0.68, 0.3, 1)',
    easingOut: 'cubic-bezier(0.32, 0, 0.34, 1)',
  }),
});

const PART_ORIGINS: Readonly<Record<LittleWorkshopPerformancePart, string>> = Object.freeze({
  head: '50% 82%',
  'eye-left': '50% 50%',
  'eye-right': '50% 50%',
  nose: '50% 50%',
  fur: '50% 18%',
  'ear-left': '50% 88%',
  'ear-right': '50% 88%',
  'paw-left': '50% 12%',
  'paw-right': '50% 12%',
  chest: '50% 78%',
  torso: '50% 88%',
  'foot-left': '50% 12%',
  'foot-right': '50% 12%',
  tail: '24% 52%',
});

/** Child motion is only the residual articulation not supplied by its parent bone. */
const PART_AMPLITUDES: Readonly<Record<LittleWorkshopPerformancePart, number>> = Object.freeze({
  head: 0.5,
  'eye-left': 0.58,
  'eye-right': 0.58,
  nose: 0.2,
  fur: 0.24,
  'ear-left': 0.3,
  'ear-right': 0.3,
  'paw-left': 0.38,
  'paw-right': 0.38,
  chest: 0.3,
  torso: 0,
  'foot-left': 0,
  'foot-right': 0,
  tail: 0.26,
});

const PART_SEEDS: Readonly<Record<LittleWorkshopPerformancePart, number>> = Object.freeze(
  Object.fromEntries(
    LITTLE_WORKSHOP_PERFORMANCE_PARTS.map((part, index) => [
      part,
      Math.imul(index + 1, 0x9e3779b1) >>> 0,
    ]),
  ) as Record<LittleWorkshopPerformancePart, number>,
);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const cleanNumber = (value: number, places = 4): number => {
  const scale = 10 ** places;
  const rounded = Math.round(value * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
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

const unitFromSeed = (seed: number): number => mix32(seed) / 4_294_967_296;

const identityFrame = (
  offset: number,
  origin: string,
  easing: string,
): LittleWorkshopPerformanceKeyframe => ({
  offset,
  transform: LITTLE_WORKSHOP_PERFORMANCE_IDENTITY,
  transformOrigin: origin,
  easing,
});

const transformForPose = (pose: Pose): string =>
  `translate3d(${cleanNumber(pose.x)}px, ${cleanNumber(pose.y)}px, 0) ` +
  `rotate(${cleanNumber(pose.rotate)}deg) ` +
  `scaleX(${cleanNumber(pose.scaleX)}) scaleY(${cleanNumber(pose.scaleY)})`;

const scalePose = (pose: Pose, amount: number): Pose => ({
  x: pose.x * amount,
  y: pose.y * amount,
  rotate: pose.rotate * amount,
  scaleX: 1 + (pose.scaleX - 1) * amount,
  scaleY: 1 + (pose.scaleY - 1) * amount,
});

const sideForPart = (part: LittleWorkshopPerformancePart): -1 | 0 | 1 => {
  if (part.endsWith('-left')) return -1;
  if (part.endsWith('-right')) return 1;
  return 0;
};

const visemeShape = (viseme: Exclude<VoiceViseme, 'rest'>): number => {
  if (viseme === 'wide') return 1;
  if (viseme === 'smile') return 0.72;
  if (viseme === 'round') return -0.76;
  if (viseme === 'open') return 0.42;
  return -0.18;
};

const poseForBeat = (
  speaker: VoiceSpeaker,
  part: LittleWorkshopPerformancePart,
  beat: ArticulationBeat,
  planSeed: number,
  blink: boolean,
): Pose => {
  const style = PERFORMANCE_STYLES[speaker];
  const sharedSeed = mix32(
    planSeed ^ Math.imul(beat.index + 1, 0x85ebca6b) ^ Math.trunc(beat.atMs * 10),
  );
  const partSeed = mix32(sharedSeed ^ PART_SEEDS[part]);
  const direction = unitFromSeed(sharedSeed) < 0.5 ? -1 : 1;
  const isEye = part === 'eye-left' || part === 'eye-right';
  const variationSeed = isEye ? mix32(sharedSeed ^ 0x45594553) : partSeed;
  const variation = (unitFromSeed(variationSeed) * 2 - 1) * 0.24;
  const side = sideForPart(part);
  const shape = visemeShape(beat.viseme);
  const energy = (0.42 + clamp(beat.intensity, 0, 1) * 0.58) * style.movement;

  if (part === 'head') {
    return speaker === 'pyotter'
      ? {
          x: direction * (0.34 + Math.abs(shape) * 0.22) * energy,
          y: -(0.78 + Math.max(0, shape) * 0.58) * energy,
          rotate: direction * (1.2 + variation) * energy,
          scaleX: 1 + 0.006 * energy,
          scaleY: 1 - 0.004 * energy,
        }
      : {
          x: direction * 0.2 * energy,
          y: -(0.42 + Math.max(0, shape) * 0.34) * energy,
          rotate: direction * (0.68 + variation * 0.42) * energy,
          scaleX: 1 + 0.003 * energy,
          scaleY: 1 + 0.005 * energy,
        };
  }

  if (part === 'eye-left' || part === 'eye-right') {
    if (blink) {
      return {
        x: 0,
        y: 0.12 * energy,
        rotate: 0,
        scaleX: 1.015,
        scaleY: speaker === 'pyotter' ? 0.12 : 0.2,
      };
    }
    return {
      x: direction * (speaker === 'pyotter' ? 0.76 : 0.48) * energy,
      y: variation * 0.24,
      rotate: 0,
      scaleX: 1,
      scaleY: 1 - Math.max(0, shape) * 0.025 * energy,
    };
  }

  if (part === 'nose') {
    return speaker === 'pyotter'
      ? {
          x: direction * (0.32 + Math.abs(shape) * 0.14) * energy,
          y: -0.18 * energy,
          rotate: direction * (1.35 + variation) * energy,
          scaleX: 1 + 0.025 * energy,
          scaleY: 1 - 0.018 * energy,
        }
      : {
          x: 0,
          y: -0.2 * energy,
          rotate: direction * 0.12 * energy,
          scaleX: 1 + (0.075 + Math.max(0, -shape) * 0.025) * energy,
          scaleY: 1 - (0.13 + Math.max(0, shape) * 0.035) * energy,
        };
  }

  if (part === 'fur') {
    return speaker === 'pyotter'
      ? {
          x: direction * 0.18 * energy,
          y: -0.42 * energy,
          rotate: direction * (0.48 + variation) * energy,
          scaleX: 1 + 0.018 * energy,
          scaleY: 1 + (0.024 + Math.max(0, shape) * 0.012) * energy,
        }
      : {
          x: direction * 0.22 * energy,
          y: 0.42 * energy,
          rotate: direction * (0.72 + variation * 0.6) * energy,
          scaleX: 1 + 0.009 * energy,
          scaleY: 1 + (0.032 + Math.max(0, shape) * 0.016) * energy,
        };
  }

  if (part === 'ear-left' || part === 'ear-right') {
    return speaker === 'pyotter'
      ? {
          x: side * 0.18 * energy,
          y: -0.48 * energy,
          rotate: side * (2.2 + variation) * energy,
          scaleX: 1 + 0.012 * energy,
          scaleY: 1 + 0.028 * energy,
        }
      : {
          x: side * 0.2 * energy,
          y: 0.24 * energy,
          rotate: side * (1.15 + variation * 0.7) * energy,
          scaleX: 1,
          scaleY: 1 + 0.018 * energy,
        };
  }

  if (part === 'paw-left' || part === 'paw-right') {
    const activeSide = (beat.index & 1) === 0 ? -1 : 1;
    const emphasis = side === activeSide ? 1 : 0.54;
    return speaker === 'pyotter'
      ? {
          x: -side * 0.38 * emphasis * energy,
          y: -1.12 * emphasis * energy,
          rotate: -side * (2.7 + shape * 0.5) * emphasis * energy,
          scaleX: 1 + 0.012 * energy,
          scaleY: 1 + 0.008 * energy,
        }
      : {
          x: side * 0.74 * emphasis * energy,
          y: -0.5 * emphasis * energy,
          rotate: side * (1.65 + Math.max(0, shape) * 0.5) * emphasis * energy,
          scaleX: 1 + 0.018 * energy,
          scaleY: 1 - 0.007 * energy,
        };
  }

  if (part === 'chest') {
    return speaker === 'pyotter'
      ? {
          x: 0,
          y: -0.36 * energy,
          rotate: direction * 0.18 * energy,
          scaleX: 1 + 0.018 * energy,
          scaleY: 1 + (0.022 + Math.max(0, shape) * 0.012) * energy,
        }
      : {
          x: 0,
          y: -0.28 * energy,
          rotate: direction * 0.12 * energy,
          scaleX: 1 + (0.025 + Math.max(0, -shape) * 0.01) * energy,
          scaleY: 1 + (0.04 + Math.max(0, shape) * 0.014) * energy,
        };
  }

  if (part === 'torso') {
    // Torso motion is deliberately subordinate to head, face, and extremities.
    return speaker === 'pyotter'
      ? {
          x: -direction * 0.1 * energy,
          y: 0.22 * energy,
          rotate: -direction * 0.18 * energy,
          scaleX: 1 + 0.003 * energy,
          scaleY: 1 - 0.002 * energy,
        }
      : {
          x: -direction * 0.08 * energy,
          y: 0.18 * energy,
          rotate: -direction * 0.12 * energy,
          scaleX: 1 + 0.004 * energy,
          scaleY: 1 + 0.006 * energy,
        };
  }

  if (part === 'foot-left' || part === 'foot-right') {
    const activeSide = (beat.index & 1) === 0 ? -1 : 1;
    const emphasis = side === activeSide ? 1 : 0.4;
    return speaker === 'pyotter'
      ? {
          x: side * 0.16 * energy,
          y: -0.46 * emphasis * energy,
          rotate: side * 1.4 * emphasis * energy,
          scaleX: 1 + 0.012 * emphasis * energy,
          scaleY: 1 - 0.01 * emphasis * energy,
        }
      : {
          x: side * 0.42 * energy,
          y: -0.25 * emphasis * energy,
          rotate: side * 0.85 * emphasis * energy,
          scaleX: 1 + 0.022 * emphasis * energy,
          scaleY: 1 - 0.012 * emphasis * energy,
        };
  }

  return speaker === 'pyotter'
    ? {
        x: direction * 0.52 * energy,
        y: -0.24 * energy,
        rotate: direction * (2.5 + variation) * energy,
        scaleX: 1 + 0.012 * energy,
        scaleY: 1 - 0.006 * energy,
      }
    : {
        x: direction * 0.36 * energy,
        y: -0.18 * energy,
        rotate: direction * (1.15 + variation * 0.5) * energy,
        scaleX: 1 + 0.016 * energy,
        scaleY: 1 - 0.008 * energy,
      };
};

const normalizedBeats = (plan: SpeechPlan, durationMs: number): readonly ArticulationBeat[] => {
  const beats: ArticulationBeat[] = [];
  for (const [fallbackIndex, event] of plan.events.entries()) {
    if (!Number.isFinite(event.atMs) || !Number.isFinite(event.durationMs)) continue;
    const atMs = clamp(event.atMs, 0, durationMs);
    const eventDuration = clamp(event.durationMs, 1, Math.max(1, durationMs - atMs));
    beats.push({
      index: Number.isInteger(event.index) ? event.index : fallbackIndex,
      atMs,
      durationMs: eventDuration,
      intensity: clamp(event.gain, 0, 1),
      viseme: event.viseme,
    });
  }
  beats.sort((left, right) => left.atMs - right.atMs || left.index - right.index);
  if (beats.length > 0) return beats;
  return Object.freeze([
    {
      index: 0,
      atMs: durationMs * 0.35,
      durationMs: Math.min(180, durationMs * 0.3),
      intensity: 0.2,
      viseme: 'small' as const,
    },
  ]);
};

const nearestBeatIndex = (
  beats: readonly ArticulationBeat[],
  targetMs: number,
  excluded: ReadonlySet<number> = new Set(),
): number => {
  let selected = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (const [index, beat] of beats.entries()) {
    if (excluded.has(index)) continue;
    const nextDistance = Math.abs(beat.atMs + beat.durationMs * 0.5 - targetMs);
    if (nextDistance < distance) {
      selected = index;
      distance = nextDistance;
    }
  }
  return selected;
};

const emphasisScore = (beat: ArticulationBeat, seed: number): number => {
  const shape = beat.viseme === 'wide' || beat.viseme === 'open' ? 0.18 : beat.viseme === 'round' ? 0.1 : 0;
  return beat.intensity + shape + unitFromSeed(seed ^ Math.imul(beat.index + 1, 0x27d4eb2d)) * 0.04;
};

const strongestBeatIndex = (
  beats: readonly ArticulationBeat[],
  seed: number,
  excluded: ReadonlySet<number> = new Set(),
): number => {
  let selected = -1;
  let score = Number.NEGATIVE_INFINITY;
  for (const [index, beat] of beats.entries()) {
    if (excluded.has(index)) continue;
    const nextScore = emphasisScore(beat, seed);
    if (nextScore > score) {
      selected = index;
      score = nextScore;
    }
  }
  return selected;
};

const structureForPhrase = (
  speaker: VoiceSpeaker,
  beats: readonly ArticulationBeat[],
  durationMs: number,
  seed: number,
): PhraseStructure => {
  const wantedRhythm =
    speaker === 'pyotter'
      ? durationMs < 850
        ? 1
        : durationMs < 2_200
          ? 2
          : 3
      : durationMs < 1_650
        ? 1
        : 2;
  const rhythmCount = Math.min(wantedRhythm, beats.length);
  const rhythm: number[] = [];
  const used = new Set<number>();
  for (let index = 0; index < rhythmCount; index += 1) {
    const targetMs = durationMs * ((index + 1) / (rhythmCount + 1));
    let selected = -1;
    let score = Number.POSITIVE_INFINITY;
    for (const [beatIndex, beat] of beats.entries()) {
      if (used.has(beatIndex)) continue;
      const center = beat.atMs + beat.durationMs * 0.5;
      const distance = Math.abs(center - targetMs) / durationMs;
      const nextScore =
        distance -
        emphasisScore(beat, seed ^ Math.imul(index + 1, 0x9e3779b1)) * 0.11;
      if (nextScore < score) {
        selected = beatIndex;
        score = nextScore;
      }
    }
    if (selected >= 0) {
      used.add(selected);
      rhythm.push(selected);
    }
  }
  rhythm.sort((left, right) => beats[left].atMs - beats[right].atMs);

  const gaze = durationMs >= 360 ? nearestBeatIndex(beats, durationMs * 0.2) : -1;
  const blinkMinimum = speaker === 'pyotter' ? 560 : 820;
  const blink =
    durationMs >= blinkMinimum
      ? nearestBeatIndex(
          beats,
          durationMs * (0.56 + unitFromSeed(seed ^ 0xb11b11) * 0.1),
          gaze >= 0 && beats.length > 1 ? new Set([gaze]) : new Set(),
        )
      : -1;
  const gesture =
    durationMs >= (speaker === 'pyotter' ? 540 : 760) && beats.length >= 2
      ? strongestBeatIndex(beats, seed ^ 0x50415753)
      : -1;
  const gestureSide: -1 | 1 = unitFromSeed(seed ^ 0x53494445) < 0.5 ? -1 : 1;
  const emphasisExcluded = gesture >= 0 ? new Set([gesture]) : new Set<number>();
  const emphasis =
    durationMs >= (speaker === 'pyotter' ? 980 : 1_260) && beats.length >= 4
      ? strongestBeatIndex(beats, seed ^ 0x454d5048, emphasisExcluded)
      : -1;
  const emphasisPart: 'ears' | 'tail' | null =
    emphasis < 0 ? null : unitFromSeed(seed ^ 0x41434354) < 0.62 ? 'ears' : 'tail';
  const firstRhythm = rhythm[0] ?? -1;
  const lastRhythm = rhythm[rhythm.length - 1] ?? -1;
  const nose =
    firstRhythm < 0 || (rhythm.length === 1 && speaker === 'mikwhale')
      ? []
      : [firstRhythm];
  const fur =
    lastRhythm < 0 || (lastRhythm === firstRhythm && speaker === 'pyotter')
      ? []
      : [lastRhythm];

  return Object.freeze({
    rhythm: Object.freeze(rhythm),
    gaze,
    blink,
    gesture,
    gestureSide,
    emphasis,
    emphasisPart,
    nose: Object.freeze(nose),
    fur: Object.freeze(fur),
  });
};

const selectedIndicesForPart = (
  part: LittleWorkshopPerformancePart,
  structure: PhraseStructure,
): readonly number[] => {
  if (part === 'head' || part === 'chest') return structure.rhythm;
  if (part === 'eye-left' || part === 'eye-right') {
    return [...new Set([structure.gaze, structure.blink].filter((index) => index >= 0))];
  }
  if (part === 'nose') return structure.nose;
  if (part === 'fur') return structure.fur;
  if (part === 'paw-left') {
    return structure.gesture >= 0 && structure.gestureSide === -1 ? [structure.gesture] : [];
  }
  if (part === 'paw-right') {
    return structure.gesture >= 0 && structure.gestureSide === 1 ? [structure.gesture] : [];
  }
  if (part === 'ear-left' || part === 'ear-right') {
    return structure.emphasisPart === 'ears' ? [structure.emphasis] : [];
  }
  if (part === 'tail') {
    return structure.emphasisPart === 'tail' ? [structure.emphasis] : [];
  }
  // Torso and planted feet/flukes inherit phrase motion from their parent bones.
  return [];
};

const keyframesForPart = (
  speaker: VoiceSpeaker,
  part: LittleWorkshopPerformancePart,
  beats: readonly ArticulationBeat[],
  durationMs: number,
  seed: number,
  structure: PhraseStructure,
): readonly LittleWorkshopPerformanceKeyframe[] => {
  const style = PERFORMANCE_STYLES[speaker];
  const origin = PART_ORIGINS[part];
  const selected = selectedIndicesForPart(part, structure);
  const frames = new Map<
    number,
    { readonly priority: number; readonly pose: Pose; readonly easing: string }
  >();
  const setFrame = (timeMs: number, pose: Pose, easing: string, priority: number): void => {
    const timeKey = cleanNumber(clamp(timeMs, 0, durationMs), 2);
    const previous = frames.get(timeKey);
    if (!previous || priority >= previous.priority) frames.set(timeKey, { priority, pose, easing });
  };

  setFrame(0, IDENTITY_POSE, style.easingIn, 4);
  setFrame(durationMs, IDENTITY_POSE, style.easingOut, 4);

  for (const originalIndex of selected) {
    const beat = beats[originalIndex];
    if (!beat) continue;
    const blink =
      (part === 'eye-left' || part === 'eye-right') && originalIndex === structure.blink;
    const peakMs = clamp(
      beat.atMs + beat.durationMs * style.peakRatio,
      Math.min(1, durationMs),
      Math.max(Math.min(1, durationMs), durationMs - 1),
    );
    const gaze = (part === 'eye-left' || part === 'eye-right') && !blink;
    const slowPart =
      part === 'fur' ||
      part === 'chest' ||
      part === 'tail' ||
      part === 'ear-left' ||
      part === 'ear-right';
    const attackMs = gaze
      ? speaker === 'pyotter'
        ? 92
        : 150
      : blink
      ? speaker === 'pyotter'
        ? 24
        : 40
      : style.attackMs * (slowPart ? 1.35 : 1);
    const releaseMs = gaze
      ? speaker === 'pyotter'
        ? 190
        : 300
      : blink
      ? speaker === 'pyotter'
        ? 46
        : 76
      : style.releaseMs * (slowPart ? 1.25 : 1);
    setFrame(peakMs - attackMs, IDENTITY_POSE, style.easingIn, 1);
    const pose = poseForBeat(speaker, part, beat, seed, blink);
    setFrame(
      peakMs,
      blink ? pose : scalePose(pose, PART_AMPLITUDES[part]),
      style.easingOut,
      3,
    );
    setFrame(peakMs + releaseMs, IDENTITY_POSE, style.easingIn, 1);
  }

  const ordered = [...frames.entries()].sort(([left], [right]) => left - right);
  const keyframes = ordered.map(([timeMs, frame]) =>
    Object.freeze({
      offset: cleanNumber(timeMs / durationMs, 6),
      transform: transformForPose(frame.pose),
      transformOrigin: origin,
      easing: frame.easing,
    }),
  );
  keyframes[0] = Object.freeze(identityFrame(0, origin, style.easingIn));
  keyframes[keyframes.length - 1] = Object.freeze(identityFrame(1, origin, style.easingOut));
  return Object.freeze(keyframes);
};

/**
 * Pure deterministic planner. Equal speech plans produce byte-for-byte equal
 * part motion; no clock, DOM state, or random global is consulted.
 */
export const createLittleWorkshopPerformancePlan = (
  speechPlan: SpeechPlan,
): LittleWorkshopSpeechPerformancePlan => {
  const speaker: VoiceSpeaker = speechPlan.speaker === 'mikwhale' ? 'mikwhale' : 'pyotter';
  const sourceSeed = Number.isFinite(speechPlan.seed) ? Math.trunc(speechPlan.seed) >>> 0 : 0;
  const seed = mix32(sourceSeed ^ PERFORMANCE_STYLES[speaker].salt);
  const lastEventEnd = speechPlan.events.reduce(
    (maximum, event) =>
      Math.max(
        maximum,
        Number.isFinite(event.atMs) && Number.isFinite(event.durationMs)
          ? event.atMs + event.durationMs
          : 0,
      ),
    0,
  );
  const durationMs = clamp(Math.max(speechPlan.totalDurationMs, lastEventEnd, 1), 1, 60_000);
  const beats = normalizedBeats(speechPlan, durationMs);
  const structure = structureForPhrase(speaker, beats, durationMs, seed);
  const parts = {} as Record<LittleWorkshopPerformancePart, LittleWorkshopPartPerformance>;

  for (const part of LITTLE_WORKSHOP_PERFORMANCE_PARTS) {
    parts[part] = Object.freeze({
      part,
      keyframes: keyframesForPart(speaker, part, beats, durationMs, seed, structure),
    });
  }

  return Object.freeze({
    version: 1 as const,
    speaker,
    sourceSeed,
    seed,
    durationMs: cleanNumber(durationMs, 2),
    parts: Object.freeze(parts),
  });
};

export type LittleWorkshopPerformanceState =
  | 'idle'
  | 'speaking'
  | 'reduced-motion'
  | 'unsupported'
  | 'disposed';

export interface LittleWorkshopPerformanceEngineOptions {
  /** Defaults to the current document. */
  readonly root?: ParentNode | null;
  /** Optional single-character scopes; useful for fragments and isolated tests. */
  readonly characterRoots?: Partial<Record<VoiceSpeaker, ParentNode | null>>;
  /** Explicit initial override. Otherwise reducedMotionQuery is authoritative. */
  readonly reducedMotion?: boolean;
  /** Defaults to `(prefers-reduced-motion: reduce)` when available. */
  readonly reducedMotionQuery?: MediaQueryList | null;
  readonly onStateChange?: (state: LittleWorkshopPerformanceState) => void;
}

export interface LittleWorkshopPerformanceEngine {
  getState(): LittleWorkshopPerformanceState;
  getActiveUtteranceId(): number | null;
  getAvailableParts(speaker: VoiceSpeaker): readonly LittleWorkshopPerformancePart[];
  /** Re-query the supplied root after articulated markup changes. */
  refresh(): LittleWorkshopPerformanceState;
  /** Directly accepts VoiceEngineHooks.onUtteranceStart's event. */
  start(event: VoiceUtteranceEvent): LittleWorkshopSpeechPerformancePlan | null;
  /** Directly accepts VoiceEngineHooks.onViseme's event, including its intensity. */
  viseme(event: VoiceVisemeEvent): boolean;
  /** Directly accepts VoiceEngineHooks.onUtteranceEnd's event. */
  end(event: VoiceUtteranceEndEvent): void;
  /** Smoothly settles the current utterance, optionally only when its ID matches. */
  cancel(utteranceId?: number): void;
  /** Explicitly update the preference when no MediaQueryList is being passed through. */
  setReducedMotion(reduced: boolean): LittleWorkshopPerformanceState;
  dispose(): void;
}

type AnimatablePartElement = Element & {
  animate(keyframes: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions): Animation;
};

type PartTargets = Record<LittleWorkshopPerformancePart, AnimatablePartElement[]>;

interface ActivePerformance {
  readonly utteranceId: number;
  readonly speaker: VoiceSpeaker;
  readonly plan: LittleWorkshopSpeechPerformancePlan;
  readonly sourcePlan: SpeechPlan;
  readonly animations: Set<Animation>;
  readonly elements: Set<AnimatablePartElement>;
  readonly seenVisemes: Set<string>;
  accentCount: number;
  lastAccentAtMs: number;
}

const emptyTargets = (): PartTargets => {
  const targets = {} as PartTargets;
  for (const part of LITTLE_WORKSHOP_PERFORMANCE_PARTS) targets[part] = [];
  return targets;
};

const resolveDocument = (): Document | null => {
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

const invokeSafely = <Arguments extends readonly unknown[]>(
  callback: ((...values: Arguments) => void) | undefined,
  ...values: Arguments
): void => {
  try {
    callback?.(...values);
  } catch {
    // Presentation observers must not break animation cleanup.
  }
};

const matchesSafely = (node: ParentNode, selector: string): boolean => {
  try {
    const candidate = node as ParentNode & { matches?: (value: string) => boolean };
    return candidate.matches?.(selector) === true;
  } catch {
    return false;
  }
};

const queryOneSafely = (root: ParentNode | null, selector: string): Element | null => {
  try {
    return root?.querySelector(selector) ?? null;
  } catch {
    return null;
  }
};

const queryManySafely = (root: ParentNode | null, selector: string): Element[] => {
  try {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  } catch {
    return [];
  }
};

const isAnimatable = (element: Element): element is AnimatablePartElement =>
  typeof (element as Element & { animate?: unknown }).animate === 'function';

const scopeForSpeaker = (
  root: ParentNode | null,
  explicit: ParentNode | null | undefined,
  speaker: VoiceSpeaker,
): ParentNode | null => {
  if (explicit !== undefined) return explicit;
  const selector =
    `[data-performance="${speaker}"], ` +
    `[data-voice-character="${speaker}"], ` +
    `[data-character="${speaker}"]`;
  if (root && matchesSafely(root, selector)) return root;
  return queryOneSafely(root, selector);
};

const targetsForSpeaker = (
  root: ParentNode | null,
  explicit: ParentNode | null | undefined,
  speaker: VoiceSpeaker,
): PartTargets => {
  const scope = scopeForSpeaker(root, explicit, speaker);
  const targets = emptyTargets();
  if (!scope) return targets;

  for (const part of LITTLE_WORKSHOP_PERFORMANCE_PARTS) {
    const preferredSelector = `[data-voice-part="${part}"]`;
    const preferred = [
      ...(matchesSafely(scope, preferredSelector) ? [scope as unknown as Element] : []),
      ...queryManySafely(scope, preferredSelector),
    ].filter(isAnimatable);
    const fallback =
      preferred.length > 0
        ? []
        : [
            ...(matchesSafely(scope, `[data-part-visual="${part}"]`)
              ? [scope as unknown as Element]
              : []),
            ...queryManySafely(scope, `[data-part-visual="${part}"]`),
          ].filter(isAnimatable);
    targets[part] = [...new Set(preferred.length > 0 ? preferred : fallback)];
  }
  return targets;
};

const partTargetCount = (targets: PartTargets): number =>
  LITTLE_WORKSHOP_PERFORMANCE_PARTS.reduce((count, part) => count + targets[part].length, 0);

const hasVisibleMotion = (motion: LittleWorkshopPartPerformance): boolean =>
  motion.keyframes.some((frame) => frame.transform !== LITTLE_WORKSHOP_PERFORMANCE_IDENTITY);

const liveAccentPart = (
  speaker: VoiceSpeaker,
  viseme: Exclude<VoiceViseme, 'rest'>,
): 'nose' | 'fur' =>
  speaker === 'pyotter'
    ? viseme === 'small' || viseme === 'round'
      ? 'nose'
      : 'fur'
    : viseme === 'round'
      ? 'nose'
      : 'fur';

const customOrigin = (
  element: AnimatablePartElement,
  part: LittleWorkshopPerformancePart,
): string => {
  try {
    return element.getAttribute('data-voice-origin')?.trim() || PART_ORIGINS[part];
  } catch {
    return PART_ORIGINS[part];
  }
};

const withOrigin = (
  keyframes: readonly LittleWorkshopPerformanceKeyframe[],
  origin: string,
): Keyframe[] =>
  keyframes.map((frame) => ({
    offset: frame.offset,
    transform: frame.transform,
    transformOrigin: origin,
    easing: frame.easing,
  }));

const createAnimation = (
  element: AnimatablePartElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  additive = true,
): Animation | null => {
  if (!additive) {
    try {
      return element.animate(keyframes, options);
    } catch {
      return null;
    }
  }
  try {
    return element.animate(keyframes, { ...options, composite: 'add' });
  } catch {
    try {
      // Older Web Animations implementations may reject additive composition.
      return element.animate(keyframes, options);
    } catch {
      return null;
    }
  }
};

/** Creates the DOM renderer; construction never animates a whole character wrapper. */
export const createLittleWorkshopPerformanceEngine = (
  options: LittleWorkshopPerformanceEngineOptions = {},
): LittleWorkshopPerformanceEngine => {
  const documentRoot = resolveDocument();
  const root = options.root === undefined ? documentRoot : options.root;
  const motionQuery = resolveMotionQuery(options.reducedMotionQuery);
  let manualReduced = options.reducedMotion;
  let targets: Record<VoiceSpeaker, PartTargets> = {
    pyotter: emptyTargets(),
    mikwhale: emptyTargets(),
  };
  let state: LittleWorkshopPerformanceState = 'idle';
  let active: ActivePerformance | null = null;
  let disposed = false;
  let listenerAttached = false;
  const recoveries = new Map<Animation, AnimatablePartElement>();

  const isReduced = (): boolean => {
    if (manualReduced !== undefined) return manualReduced;
    try {
      return motionQuery?.matches === true;
    } catch {
      return false;
    }
  };

  const setState = (next: LittleWorkshopPerformanceState): LittleWorkshopPerformanceState => {
    if (state === next) return state;
    state = next;
    invokeSafely(options.onStateChange, next);
    return state;
  };

  const track = (
    animation: Animation,
    collection: Set<Animation> | Map<Animation, AnimatablePartElement>,
  ): void => {
    void animation.finished.then(
      () => collection.delete(animation),
      () => collection.delete(animation),
    );
  };

  const cancelRecoveries = (): void => {
    for (const animation of recoveries.keys()) {
      try {
        animation.cancel();
      } catch {
        // Detached or completed recovery animations are already inert.
      }
    }
    recoveries.clear();
  };

  const presentationTransform = (
    element: AnimatablePartElement,
  ): { readonly transform: string; readonly origin: string } => {
    try {
      const view = element.ownerDocument?.defaultView;
      const computed = view?.getComputedStyle(element);
      const transform = computed?.transform;
      return {
        transform:
          transform && transform !== 'none' ? transform : LITTLE_WORKSHOP_PERFORMANCE_IDENTITY,
        origin: computed?.transformOrigin || '50% 50%',
      };
    } catch {
      return { transform: LITTLE_WORKSHOP_PERFORMANCE_IDENTITY, origin: '50% 50%' };
    }
  };

  const settleActive = (animateRecovery: boolean): void => {
    const current = active;
    if (!current) return;
    const presented = new Map<
      AnimatablePartElement,
      { readonly transform: string; readonly origin: string }
    >();
    if (animateRecovery) {
      for (const element of current.elements) presented.set(element, presentationTransform(element));
    }
    // Consolidate any older cross-fade before creating the next recovery.
    cancelRecoveries();
    for (const animation of current.animations) {
      try {
        animation.cancel();
      } catch {
        // Cancellation is best effort when markup is being detached.
      }
    }
    current.animations.clear();
    active = null;

    if (animateRecovery && !isReduced() && !disposed) {
      const duration = current.speaker === 'pyotter' ? 130 : 210;
      for (const [element, from] of presented) {
        if (from.transform === LITTLE_WORKSHOP_PERFORMANCE_IDENTITY) continue;
        const recovery = createAnimation(
          element,
          [
            {
              offset: 0,
              transform: from.transform,
              transformOrigin: from.origin,
            },
            {
              offset: 1,
              transform: LITTLE_WORKSHOP_PERFORMANCE_IDENTITY,
              transformOrigin: from.origin,
            },
          ],
          {
            duration,
            iterations: 1,
            fill: 'none',
            easing: 'cubic-bezier(0.2, 0.72, 0.28, 1)',
          },
          false,
        );
        if (!recovery) continue;
        recoveries.set(recovery, element);
        track(recovery, recoveries);
      }
    }
  };

  const refresh = (): LittleWorkshopPerformanceState => {
    if (disposed) return setState('disposed');
    if (active) settleActive(!isReduced());
    else cancelRecoveries();
    targets = {
      pyotter: targetsForSpeaker(root, options.characterRoots?.pyotter, 'pyotter'),
      mikwhale: targetsForSpeaker(root, options.characterRoots?.mikwhale, 'mikwhale'),
    };
    if (isReduced()) return setState('reduced-motion');
    return setState(
      partTargetCount(targets.pyotter) + partTargetCount(targets.mikwhale) > 0
        ? 'idle'
        : 'unsupported',
    );
  };

  const motionChanged = (): void => {
    if (disposed) return;
    if (isReduced()) {
      settleActive(false);
      cancelRecoveries();
      setState('reduced-motion');
      return;
    }
    setState(
      partTargetCount(targets.pyotter) + partTargetCount(targets.mikwhale) > 0
        ? 'idle'
        : 'unsupported',
    );
  };

  const attachMotionListener = (): void => {
    if (listenerAttached) return;
    listenerAttached = true;
    try {
      motionQuery?.addEventListener('change', motionChanged);
    } catch {
      try {
        motionQuery?.addListener(motionChanged);
      } catch {
        // A partial MediaQueryList remains a valid static preference source.
      }
    }
  };

  const detachMotionListener = (): void => {
    if (!listenerAttached) return;
    listenerAttached = false;
    try {
      motionQuery?.removeEventListener('change', motionChanged);
    } catch {
      try {
        motionQuery?.removeListener(motionChanged);
      } catch {
        // Best-effort lifecycle cleanup.
      }
    }
  };

  const start = (event: VoiceUtteranceEvent): LittleWorkshopSpeechPerformancePlan | null => {
    if (disposed) return null;
    const plan = createLittleWorkshopPerformancePlan(event.plan);
    if (active) settleActive(true);
    if (isReduced()) {
      setState('reduced-motion');
      return null;
    }

    // Re-query at utterance boundaries so replaced SVG fragments do not retain stale nodes.
    targets[event.speaker] = targetsForSpeaker(
      root,
      options.characterRoots?.[event.speaker],
      event.speaker,
    );
    if (partTargetCount(targets[event.speaker]) === 0) {
      setState('unsupported');
      return null;
    }

    const next: ActivePerformance = {
      utteranceId: event.utteranceId,
      speaker: event.speaker,
      plan,
      sourcePlan: event.plan,
      animations: new Set(),
      elements: new Set(),
      seenVisemes: new Set(),
      accentCount: 0,
      lastAccentAtMs: Number.NEGATIVE_INFINITY,
    };
    active = next;
    for (const part of LITTLE_WORKSHOP_PERFORMANCE_PARTS) {
      const motion = plan.parts[part];
      if (!hasVisibleMotion(motion)) continue;
      for (const element of targets[event.speaker][part]) {
        const animation = createAnimation(
          element,
          withOrigin(motion.keyframes, customOrigin(element, part)),
          {
            duration: plan.durationMs,
            iterations: 1,
            fill: 'none',
            easing: 'linear',
          },
        );
        if (!animation) continue;
        next.animations.add(animation);
        next.elements.add(element);
        track(animation, next.animations);
      }
    }
    if (next.animations.size === 0) {
      active = null;
      setState('unsupported');
      return null;
    }
    setState('speaking');
    return plan;
  };

  const viseme = (event: VoiceVisemeEvent): boolean => {
    const current = active;
    if (
      disposed ||
      isReduced() ||
      !current ||
      current.utteranceId !== event.utteranceId ||
      current.speaker !== event.speaker ||
      event.viseme === 'rest' ||
      event.intensity <= 0
    ) {
      return false;
    }
    const eventKey = `${event.atMs}|${event.durationMs}|${event.viseme}|${event.intensity}`;
    if (current.seenVisemes.has(eventKey)) return false;
    current.seenVisemes.add(eventKey);

    const expected = current.sourcePlan.events.find(
      (planned) => Math.abs(planned.atMs - event.atMs) <= 0.2,
    );
    const excessIntensity = clamp(event.intensity - (expected?.gain ?? 0), 0, 1);
    const minimumGap = event.speaker === 'pyotter' ? 520 : 760;
    if (
      excessIntensity < 0.08 ||
      current.accentCount >= 2 ||
      event.atMs - current.lastAccentAtMs < minimumGap
    ) {
      return false;
    }

    const style = PERFORMANCE_STYLES[event.speaker];
    const beat: ArticulationBeat = {
      index: Math.max(0, Math.round(event.atMs * 10)),
      atMs: event.atMs,
      durationMs: event.durationMs,
      intensity: clamp(event.intensity, 0, 1),
      viseme: event.viseme,
    };
    const duration = clamp(
      Math.max(event.durationMs, style.attackMs + style.releaseMs * 0.5),
      event.speaker === 'pyotter' ? 84 : 132,
      event.speaker === 'pyotter' ? 176 : 270,
    );
    const part = liveAccentPart(event.speaker, event.viseme);
    const accent = scalePose(
      poseForBeat(event.speaker, part, beat, current.plan.seed, false),
      excessIntensity * 0.1,
    );
    let animated = false;
    for (const element of targets[event.speaker][part]) {
      const origin = customOrigin(element, part);
      const animation = createAnimation(
        element,
        [
          {
            offset: 0,
            transform: LITTLE_WORKSHOP_PERFORMANCE_IDENTITY,
            transformOrigin: origin,
            easing: style.easingIn,
          },
          {
            offset: event.speaker === 'pyotter' ? 0.32 : 0.48,
            transform: transformForPose(accent),
            transformOrigin: origin,
            easing: style.easingOut,
          },
          {
            offset: 1,
            transform: LITTLE_WORKSHOP_PERFORMANCE_IDENTITY,
            transformOrigin: origin,
            easing: style.easingIn,
          },
        ],
        { duration, iterations: 1, fill: 'none', easing: 'linear' },
      );
      if (!animation) continue;
      current.animations.add(animation);
      current.elements.add(element);
      track(animation, current.animations);
      animated = true;
    }
    if (animated) {
      current.accentCount += 1;
      current.lastAccentAtMs = event.atMs;
    }
    return animated;
  };

  const end = (event: VoiceUtteranceEndEvent): void => {
    if (!active || active.utteranceId !== event.utteranceId) return;
    settleActive(!isReduced());
    if (!disposed) setState(isReduced() ? 'reduced-motion' : 'idle');
  };

  const cancel = (utteranceId?: number): void => {
    if (disposed || !active) return;
    if (utteranceId !== undefined && active.utteranceId !== utteranceId) return;
    settleActive(!isReduced());
    setState(isReduced() ? 'reduced-motion' : 'idle');
  };

  const setReducedMotion = (reduced: boolean): LittleWorkshopPerformanceState => {
    if (disposed) return setState('disposed');
    manualReduced = Boolean(reduced);
    motionChanged();
    return state;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    settleActive(false);
    cancelRecoveries();
    detachMotionListener();
    targets = { pyotter: emptyTargets(), mikwhale: emptyTargets() };
    setState('disposed');
  };

  attachMotionListener();
  refresh();

  return Object.freeze({
    getState: () => state,
    getActiveUtteranceId: () => active?.utteranceId ?? null,
    getAvailableParts: (speaker: VoiceSpeaker) =>
      Object.freeze(
        LITTLE_WORKSHOP_PERFORMANCE_PARTS.filter((part) => targets[speaker][part].length > 0),
      ),
    refresh,
    start,
    viseme,
    end,
    cancel,
    setReducedMotion,
    dispose,
  });
};
