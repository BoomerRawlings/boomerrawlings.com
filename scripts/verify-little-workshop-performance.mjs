import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const voicePath = join(projectRoot, 'src', 'scripts', 'little-workshop-voice.ts');
const idlePath = join(projectRoot, 'src', 'scripts', 'little-workshop-idle.ts');
const performancePath = join(projectRoot, 'src', 'scripts', 'little-workshop-performance.ts');
const prologuePath = join(projectRoot, 'src', 'data', 'little-workshop-prologue.ts');
const componentPath = join(projectRoot, 'src', 'components', 'LittleWorkshopScene.astro');
const pyotterPuppetPath = join(projectRoot, 'src', 'components', 'PyotterPuppet.astro');
const mikwhalePuppetPath = join(projectRoot, 'src', 'components', 'MikwhalePuppet.astro');

const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const countMatches = (text, expression) => [...text.matchAll(expression)].length;

for (const path of [
  voicePath,
  idlePath,
  performancePath,
  prologuePath,
  componentPath,
  pyotterPuppetPath,
  mikwhalePuppetPath,
]) {
  assert(existsSync(path), `Missing Little Workshop performance source: ${path}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
assert(
  Number.isInteger(nodeMajor) && nodeMajor >= 24,
  `Little Workshop performance verification requires Node 24 or newer; found ${process.version}`,
);

const voiceSource = readFileSync(voicePath, 'utf8');
const idleSource = readFileSync(idlePath, 'utf8');
const performanceSource = readFileSync(performancePath, 'utf8');
const prologueSource = readFileSync(prologuePath, 'utf8');
const componentSource = readFileSync(componentPath, 'utf8');
const pyotterPuppetSource = readFileSync(pyotterPuppetPath, 'utf8');
const mikwhalePuppetSource = readFileSync(mikwhalePuppetPath, 'utf8');
const puppetSource = `${pyotterPuppetSource}\n${mikwhalePuppetSource}`;
const presentationSource = `${componentSource}\n${puppetSource}`;

assert(
  prologueSource.includes('export const littleWorkshopPrologue') &&
    prologueSource.includes('export const objectReuseDialogue'),
  'The authored and object-reuse dialogue sources are not both available',
);

const probeSource = `
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const voice = await import(${JSON.stringify(pathToFileURL(voicePath).href)});
const idle = await import(${JSON.stringify(pathToFileURL(idlePath).href)});
const data = await import(${JSON.stringify(pathToFileURL(prologuePath).href)});

assert(Number(process.versions.node.split('.')[0]) >= 24, 'TypeScript probe did not run under Node 24+');

const characters = ['pyotter', 'mikwhale'];
const transformPattern = /^translate3d\\(([-+]?(?:\\d+\\.?\\d*|\\.\\d+))px, ([-+]?(?:\\d+\\.?\\d*|\\.\\d+))px, 0\\) rotate\\(([-+]?(?:\\d+\\.?\\d*|\\.\\d+))deg\\) scaleX\\(([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\) scaleY\\(([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\)$/;

assert(idle.IDLE_VARIANT_COUNT === 50, 'Idle variant count constant must be 50');
assert(idle.IDLE_VARIANT_DURATION_MS === 20000, 'Idle variants must last exactly 20 seconds');
assert(typeof idle.IDLE_IDENTITY_TRANSFORM === 'string', 'Idle identity transform is missing');

for (const character of characters) {
  const variants = idle.LITTLE_WORKSHOP_IDLE_VARIANTS[character];
  const regenerated = idle.createIdleVariants(character);
  assert(Array.isArray(variants) && variants.length === 50, character + ': expected exactly 50 idle variants');
  assert(sameJson(variants, regenerated), character + ': idle variant generation is not deterministic');
  assert(new Set(variants.map((variant) => variant.id)).size === 50, character + ': idle IDs are not unique');
  assert(new Set(variants.map((variant) => variant.name)).size === 50, character + ': idle names are not unique');
  assert(
    new Set(variants.map((variant) => JSON.stringify(variant.keyframes))).size === 50,
    character + ': idle motion sequences are not all unique',
  );

  for (const [variantIndex, variant] of variants.entries()) {
    const context = character + ' idle ' + (variantIndex + 1);
    assert(variant.character === character && variant.index === variantIndex, context + ': identity mismatch');
    assert(variant.durationMs === 20000, context + ': duration is not 20 seconds');
    assert(Array.isArray(variant.keyframes) && variant.keyframes.length >= 2, context + ': keyframes missing');
    assert(variant.keyframes[0].offset === 0, context + ': first offset must be zero');
    assert(variant.keyframes.at(-1).offset === 1, context + ': last offset must be one');
    assert(
      variant.keyframes[0].transform === idle.IDLE_IDENTITY_TRANSFORM &&
        variant.keyframes.at(-1).transform === idle.IDLE_IDENTITY_TRANSFORM,
      context + ': animation must enter and leave at the identity transform',
    );

    let previousOffset = -1;
    for (const [frameIndex, frame] of variant.keyframes.entries()) {
      const frameContext = context + ' keyframe ' + (frameIndex + 1);
      assert(finite(frame.offset) && frame.offset >= 0 && frame.offset <= 1, frameContext + ': invalid offset');
      assert(frame.offset > previousOffset, frameContext + ': offsets must be strictly ordered');
      previousOffset = frame.offset;
      assert(typeof frame.easing === 'string' && /^cubic-bezier\\(/.test(frame.easing), frameContext + ': easing missing');
      const transform = transformPattern.exec(frame.transform);
      assert(transform, frameContext + ': transform is incomplete or invalid');
      const values = transform.slice(1).map(Number);
      assert(values.every(finite), frameContext + ': transform contains a non-finite value');
      assert(values[3] > 0 && values[4] > 0, frameContext + ': transform scale must stay positive');
    }
  }

  for (const seed of [0, 1, 0x50594f54, 0xffffffff]) {
    let previousOrder = null;
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const order = idle.createIdleVariantOrder(character, seed, cycle);
      const repeated = idle.createIdleVariantOrder(character, seed, cycle);
      assert(sameJson(order, repeated), character + ': idle order is not deterministic');
      assert(order.length === 50 && new Set(order).size === 50, character + ': idle order repeats within a cycle');
      assert(
        order.every((index) => Number.isInteger(index) && index >= 0 && index < 50),
        character + ': idle order contains an invalid index',
      );
      assert(order.every((value, index) => index === 0 || order[index - 1] !== value), character + ': adjacent idle repeated');
      if (previousOrder) {
        assert(!sameJson(order, previousOrder), character + ': consecutive idle cycles use the same order');
      }
      previousOrder = order;
    }
  }
}

const collectBeats = (value, path, output, seen = new Set()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectBeats(entry, path + '[' + index + ']', output, seen));
    return;
  }
  if (
    (value.speaker === 'pyotter' || value.speaker === 'mikwhale') &&
    typeof value.text === 'string'
  ) {
    output.push({ speaker: value.speaker, text: value.text, path });
  }
  for (const [key, entry] of Object.entries(value)) {
    collectBeats(entry, path + '.' + key, output, seen);
  }
};

assert(data.littleWorkshopPrologue.length === 50, 'Voice corpus must cover exactly 50 interactions');
const authoredBeats = [];
const reuseBeats = [];
collectBeats(data.littleWorkshopPrologue, 'prologue', authoredBeats);
collectBeats(data.objectReuseDialogue, 'objectReuseDialogue', reuseBeats);
assert(authoredBeats.length > 50, 'Authored dialogue corpus is unexpectedly incomplete');
assert(reuseBeats.length > 0, 'Object-reuse dialogue corpus is missing');

const allBeats = [...authoredBeats, ...reuseBeats];
const visemes = new Set();
const chirpLimits = { pyotter: 54, mikwhale: 38 };
const pauseKinds = new Set([
  'word', 'comma', 'sentence', 'ellipsis', 'question', 'exclamation', 'colon', 'dash', 'line-break',
]);

const validatePlan = (plan, expectedSpeaker, context) => {
  assert(plan && plan.version === 1 && plan.speaker === expectedSpeaker, context + ': plan identity mismatch');
  assert(finite(plan.totalDurationMs) && plan.totalDurationMs >= 0, context + ': duration is invalid');
  assert(plan.totalDurationMs <= 4000, context + ': duration exceeds four seconds');
  assert(Array.isArray(plan.events), context + ': chirp events missing');
  assert(plan.events.length <= chirpLimits[expectedSpeaker], context + ': chirp budget exceeded');

  let previousAt = -1;
  for (const [eventIndex, event] of plan.events.entries()) {
    assert(event.index === eventIndex, context + ': event indices are unordered');
    assert(typeof event.symbol === 'string' && Array.from(event.symbol).length === 1, context + ': invalid event symbol');
    assert(
      ['small', 'open', 'wide', 'round', 'smile'].includes(event.viseme),
      context + ': invalid viseme',
    );
    visemes.add(event.viseme);
    for (const key of [
      'atMs', 'durationMs', 'pitchHz', 'endPitchHz', 'formantHz', 'formantQ', 'gain', 'pan',
      'vibratoRateHz', 'vibratoDepthHz',
    ]) {
      assert(finite(event[key]), context + ': event ' + eventIndex + ' has non-finite ' + key);
    }
    assert(event.atMs >= previousAt, context + ': chirp events are not ordered');
    assert(event.durationMs > 0, context + ': chirp duration must be positive');
    assert(event.atMs + event.durationMs <= plan.totalDurationMs + 0.2, context + ': chirp exceeds plan duration');
    const preset = voice.VOICE_PRESETS[expectedSpeaker];
    const minimumPitch = preset.basePitchHz - preset.pitchRangeHz;
    const maximumPitch = preset.basePitchHz + preset.pitchRangeHz;
    assert(
      event.pitchHz >= minimumPitch && event.pitchHz <= maximumPitch &&
        event.endPitchHz >= minimumPitch && event.endPitchHz <= maximumPitch,
      context + ': chirp left its character pitch range',
    );
    previousAt = event.atMs;
  }

  let previousPauseAt = -1;
  for (const [pauseIndex, pause] of plan.pauses.entries()) {
    assert(pauseKinds.has(pause.kind), context + ': pause kind is invalid');
    assert(finite(pause.atMs) && finite(pause.durationMs), context + ': pause is non-finite');
    assert(pause.atMs >= previousPauseAt && pause.durationMs > 0, context + ': pauses are invalid or unordered');
    assert(pause.atMs + pause.durationMs <= plan.totalDurationMs + 0.2, context + ': pause exceeds plan duration');
    previousPauseAt = pause.atMs;
  }
};

for (const [beatIndex, beat] of allBeats.entries()) {
  const first = voice.createSpeechPlan(beat.speaker, beat.text);
  const second = voice.createSpeechPlan(beat.speaker, beat.text);
  assert(sameJson(first, second), beat.path + ': speech planning is not deterministic');
  assert(first.text === beat.text.normalize('NFC'), beat.path + ': text normalization changed content unexpectedly');
  validatePlan(first, beat.speaker, beat.path + ' beat ' + beatIndex);
}

const pyotterMinimumPitch = voice.VOICE_PRESETS.pyotter.basePitchHz - voice.VOICE_PRESETS.pyotter.pitchRangeHz;
const mikwhaleMaximumPitch = voice.VOICE_PRESETS.mikwhale.basePitchHz + voice.VOICE_PRESETS.mikwhale.pitchRangeHz;
assert(pyotterMinimumPitch > mikwhaleMaximumPitch, 'Pyotter pitch range must remain entirely above Mikwhale');
assert(voice.MAX_SPEECH_PLAN_MS === 4000, 'Speech plan hard limit must remain four seconds');

const stressText = 'Abcdefghijklmnopqrstuvwxyz0123456789'.repeat(30);
for (const speaker of characters) {
  const stressPlan = voice.createSpeechPlan(speaker, stressText, { seed: 8675309 });
  validatePlan(stressPlan, speaker, speaker + ' chirp stress plan');
  assert(
    stressPlan.events.length === chirpLimits[speaker],
    speaker + ': long speech does not consume exactly its bounded chirp budget',
  );
}

const silentText = '\"“”‘’...?!,;:—–-()[]{} / \\\\ 😀 👩🏽‍💻 © ™ ♥️ 🚩';
for (const speaker of characters) {
  const silentPlan = voice.createSpeechPlan(speaker, silentText);
  assert(silentPlan.events.length === 0, speaker + ': punctuation or emoji generated a chirp');
  validatePlan(silentPlan, speaker, speaker + ' punctuation/emoji silence');
}

const unicodeText = 'Jose\\u0301 李 Καλημέρα Привет مرحبًا १२३ 👩🏽‍💻 e\\u0301 ' + String.fromCharCode(0xd800);
for (const speaker of characters) {
  let unicodePlan;
  try {
    unicodePlan = voice.createSpeechPlan(speaker, unicodeText, { seed: 42 });
  } catch (error) {
    fail(speaker + ': Unicode planning threw: ' + String(error));
  }
  assert(typeof unicodePlan.text === 'string' && unicodePlan.text.includes('José'), speaker + ': NFC Unicode normalization failed');
  assert(Array.from(unicodePlan.text).length <= 600, speaker + ': Unicode text safety bound failed');
  assert(unicodePlan.events.length > 0, speaker + ': multilingual Unicode corpus produced no chirps');
  validatePlan(unicodePlan, speaker, speaker + ' Unicode plan');
}
assert(visemes.size >= 5, 'Authored voice corpus does not exercise at least five visemes');

const stored = new Map();
let writes = 0;
let contextCreations = 0;
const storage = {
  getItem: (key) => stored.has(key) ? stored.get(key) : null,
  setItem: (key, value) => { writes += 1; stored.set(key, value); },
};
const defaultEngine = voice.createLittleWorkshopVoiceEngine({
  storage,
  contextFactory: () => { contextCreations += 1; throw new Error('context must stay lazy'); },
});
assert(defaultEngine.getPreferences().enabled === false, 'Voice must default to opt-in off');
assert(defaultEngine.getStatus() === 'disabled', 'Default voice engine must be disabled');
assert(writes === 0 && contextCreations === 0, 'Default voice construction performed a side effect');
const disabledSpeech = defaultEngine.speak('pyotter', 'Hello.');
assert(
  disabledSpeech.started === false && disabledSpeech.reason === 'disabled',
  'Disabled voice engine attempted playback',
);
assert(contextCreations === 0, 'Speaking while disabled created an AudioContext');
defaultEngine.setEnabled(true);
assert(writes === 1, 'Voice opt-in was not persisted');
assert(
  JSON.parse(stored.get(voice.LITTLE_WORKSHOP_VOICE_STORAGE_KEY)).enabled === true,
  'Persisted voice opt-in is invalid',
);
const restoredEngine = voice.createLittleWorkshopVoiceEngine({ storage, contextFactory: () => { contextCreations += 1; throw new Error('unused'); } });
assert(restoredEngine.getPreferences().enabled === true, 'Stored voice opt-in did not restore');
assert(restoredEngine.getStatus() === 'locked', 'Opted-in voice must remain gesture-locked');
const malformedEngine = voice.createLittleWorkshopVoiceEngine({
  storage: { getItem: () => '{not-json', setItem: () => {} },
  contextFactory: () => { throw new Error('unused'); },
});
assert(malformedEngine.getPreferences().enabled === false, 'Malformed storage must fail closed');
await defaultEngine.dispose();
await restoredEngine.dispose();
await malformedEngine.dispose();
assert(
  defaultEngine.getStatus() === 'disposed' && restoredEngine.getStatus() === 'disposed',
  'Voice engine disposal did not reach the terminal state',
);
assert(contextCreations === 0, 'Voice preference probe created audio before a gesture');

console.log('PERFORMANCE_PROBE=' + JSON.stringify({
  nodeVersion: process.version,
  authoredBeatCount: authoredBeats.length,
  reuseBeatCount: reuseBeats.length,
  planCount: allBeats.length,
  visemeCount: visemes.size,
  idleVariantsPerCharacter: 50,
}));
`;

const probeProcess = spawnSync(
  process.execPath,
  ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', probeSource],
  { cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);
assert(
  probeProcess.status === 0,
  `Unable to verify Little Workshop voice/idle modules:\n${probeProcess.stderr || probeProcess.stdout}`,
);
const probeLine = probeProcess.stdout
  .split(/\r?\n/)
  .find((line) => line.startsWith('PERFORMANCE_PROBE='));
assert(probeLine, 'Little Workshop performance module probe returned no result');
const probe = JSON.parse(probeLine.slice('PERFORMANCE_PROBE='.length));

assert(
  /if\s*\(order\.length\s*>\s*1\s*&&\s*order\[0\]\s*===\s*channel\.previousIndex\)/u.test(
    idleSource,
  ) && /\[order\[0\],\s*order\[1\]\]\s*=\s*\[order\[1\],\s*order\[0\]\]/u.test(idleSource),
  'Idle engine does not prevent a repeat at shuffled-cycle boundaries',
);

const toggleTag = componentSource.match(/<button\b(?=[^>]*\bdata-voice-toggle\b)[^>]*>/u)?.[0];
assert(toggleTag, 'Native voice toggle button is missing');
assert(/\btype="button"/u.test(toggleTag), 'Voice toggle must use native button semantics');
assert(/\baria-pressed="false"/u.test(toggleTag), 'Voice toggle must visibly default to unpressed');
assert(!/\bhidden\b/u.test(toggleTag) && !/\baria-hidden="true"/u.test(toggleTag), 'Voice toggle is hidden');
const voiceToggleCss = componentSource.match(/\.voice-toggle\s*\{([\s\S]*?)\n\s*\}/u)?.[1] ?? '';
assert(/display:\s*inline-flex/u.test(voiceToggleCss), 'Voice toggle is not visibly laid out');
assert(!/(?:display:\s*none|visibility:\s*hidden|opacity:\s*0)/u.test(voiceToggleCss), 'Voice toggle CSS hides it');

const announceBeatStart = componentSource.indexOf('const announceBeat');
const playBeatsStart = componentSource.indexOf('const playBeats');
const playBeatsEnd = componentSource.indexOf('const stateValue', playBeatsStart);
assert(announceBeatStart >= 0 && playBeatsStart > announceBeatStart && playBeatsEnd > playBeatsStart, 'Dialogue playback functions are missing');
const announceBeatSource = componentSource.slice(announceBeatStart, playBeatsStart);
const playBeatsSource = componentSource.slice(playBeatsStart, playBeatsEnd);
assert(/return\s+voiceEngine\.speak\(id,\s*beat\.text\)/u.test(announceBeatSource), 'Dialogue beats are not sent to the voice engine');
assert(/const\s+speech\s*=\s*announceBeat\(beat\)/u.test(playBeatsSource), 'playBeats does not start speech');
assert(/speech\.plan\.totalDurationMs\s*\+\s*80/u.test(playBeatsSource), 'playBeats lacks the 80ms speech tail');
assert(
  /await\s+wait\(Math\.max\(beatDuration\(beat\),\s*speechDuration\)\)/u.test(playBeatsSource),
  'playBeats can advance before the planned voice plus 80ms completes',
);

const gestureStart = componentSource.indexOf('const unlockVoiceFromGesture');
const gestureEnd = componentSource.indexOf("reducedMotion.addEventListener('change'", gestureStart);
assert(gestureStart >= 0 && gestureEnd > gestureStart, 'Gameplay voice-unlock wiring is missing');
const gestureSource = componentSource.slice(gestureStart, gestureEnd);
assert(
  /voiceEngine\.getPreferences\(\)\.enabled[\s\S]*voiceEngine\.unlockFromGesture\(\)/u.test(gestureSource),
  'Gameplay gestures do not conditionally unlock opted-in audio',
);
assert(
  countMatches(gestureSource, /await\s+unlockVoiceFromGesture\(\)/gu) >= 4,
  'Object, placement, answer, and name gestures must all unlock opted-in audio',
);
for (const marker of [
  'for (const button of placementButtons)',
  'for (const choice of objectChoices)',
  'for (const button of strawberryButtons)',
  "nameForm.addEventListener(",
]) {
  const markerIndex = gestureSource.indexOf(marker);
  assert(markerIndex >= 0, `Missing gameplay gesture handler: ${marker}`);
  assert(
    gestureSource.slice(markerIndex, markerIndex + 480).includes('await unlockVoiceFromGesture();'),
    `Gameplay handler does not unlock voice: ${marker}`,
  );
}
assert(
  /voiceToggle\.addEventListener\([\s\S]*voiceEngine\.setEnabled\(enable\)[\s\S]*voiceEngine\.unlockFromGesture\(\)/u.test(
    gestureSource,
  ),
  'Voice toggle does not opt in and unlock from its native click',
);

const beginRunStart = componentSource.indexOf('const beginRun');
const beginRunEnd = componentSource.indexOf('const wait', beginRunStart);
assert(
  beginRunStart >= 0 && /voiceEngine\.cancel\('cancelled'\)/u.test(componentSource.slice(beginRunStart, beginRunEnd)),
  'A new gameplay run does not cancel current speech',
);
const disposeStart = componentSource.indexOf('const dispose =');
const disposeEnd = componentSource.indexOf('if (debugEnabled)', disposeStart);
const disposeSource = componentSource.slice(disposeStart, disposeEnd);
assert(
  /idleEngine\.dispose\(\)/u.test(disposeSource) &&
    /performanceEngine\.dispose\(\)/u.test(disposeSource) &&
    /voiceEngine\.dispose\(\)/u.test(disposeSource) &&
    /abortController\.abort\(\)/u.test(disposeSource) &&
    /astro:before-swap/u.test(disposeSource),
  'Performance engines do not fully dispose during scene teardown',
);

assert(countMatches(puppetSource, /class="character__mouth"\s+data-mouth="(?:pyotter|mikwhale)"/gu) === 2, 'Expected one SVG mouth layer per character');
assert(countMatches(puppetSource, /class="character__mouth-cavity"/gu) === 2, 'Expected two SVG mouth cavities');
assert(countMatches(puppetSource, /class="character__mouth-tongue"/gu) === 2, 'Expected two independent SVG tongue layers');
for (const character of ['pyotter', 'mikwhale']) {
  assert(countMatches(puppetSource, new RegExp(`data-mouth="${character}"`, 'gu')) === 1, `${character}: SVG mouth hook is missing or duplicated`);
  assert(countMatches(componentSource, new RegExp(`data-performance="${character}"`, 'gu')) === 1, `${character}: performance layer is missing or duplicated`);
  assert(countMatches(puppetSource, new RegExp(`data-idle-target="${character}"`, 'gu')) === 1, `${character}: idle layer is missing or duplicated`);
  const characterPuppet = character === 'pyotter' ? pyotterPuppetSource : mikwhalePuppetSource;
  assert(/class="puppet-base"/u.test(characterPuppet), `${character}: clean seam-safe base art is missing`);
  assert(countMatches(characterPuppet, /data-idle-part="(?:head|eye-left|eye-right|nose|fur|ear-left|ear-right|paw-left|paw-right|chest|torso|foot-left|foot-right|tail)"/gu) === 14, `${character}: expected fourteen articulated idle roles`);
  assert(countMatches(characterPuppet, /class="[^"]*puppet__eyelid[^"]*"/gu) === 2, `${character}: expected two dedicated eyelid overlays`);
}
assert(
  /characterElements\[speaker\]\.dataset\.viseme\s*=\s*viseme/u.test(componentSource) &&
    /performanceEngine\.viseme\(event\)/u.test(componentSource),
  'Voice visemes are not connected to character data hooks',
);
for (const viseme of ['small', 'open', 'wide', 'round', 'smile']) {
  assert(puppetSource.includes(`[data-viseme='${viseme}']`), `Missing mouth styling for ${viseme} viseme`);
}

assert(
  componentSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)')") &&
    componentSource.includes('reducedMotionQuery: reducedMotion') &&
    /reducedMotion\.addEventListener\('change',\s*restAllMouths/u.test(componentSource) &&
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/u.test(presentationSource),
  'Reduced-motion preference is not connected to idle and mouth behavior',
);
const reducedMotionCss = presentationSource.slice(presentationSource.indexOf('@media (prefers-reduced-motion: reduce)'));
for (const marker of ['.character__performance', '.puppet-layer', '.character__mouth']) assert(presentationSource.includes(marker), `Reduced-motion CSS omits ${marker}`);
assert(
  countMatches(reducedMotionCss, /(?:animation|transition):\s*none\s*!important/gu) >= 2,
  'Reduced-motion CSS does not suppress character interpolation',
);

const productionSource = [voiceSource, idleSource, performanceSource, prologueSource, presentationSource].join('\n');
for (const [label, expression] of [
  ['fetch', /\bfetch\s*\(/u],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/u],
  ['WebSocket', /\bWebSocket\b/u],
  ['speechSynthesis', /\bspeechSynthesis\b/u],
  ['audio tag', /<audio\b/iu],
  ['data-audio hook', /\bdata-audio(?:\s|=)/iu],
  ['audio URL', /(?:src|href)\s*=\s*[^\n>]*\.(?:mp3|wav|ogg|m4a|aac|flac|opus)(?:[?"'\s>]|$)/iu],
]) {
  assert(!expression.test(productionSource), `Little Workshop performance uses forbidden ${label}`);
}
assert(
  /createOscillator\(\)/u.test(voiceSource) &&
    /createBiquadFilter\(\)/u.test(voiceSource) &&
    /createGain\(\)/u.test(voiceSource),
  'Voice renderer is not fully procedural Web Audio',
);

const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus']);
const audioFiles = [];
const scanForAudio = (directory) => {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scanForAudio(path);
    else if (audioExtensions.has(extname(entry.name).toLowerCase())) audioFiles.push(path);
  }
};
scanForAudio(join(projectRoot, 'src'));
scanForAudio(join(projectRoot, 'public'));
assert(audioFiles.length === 0, `Pre-recorded audio files are forbidden: ${audioFiles.join(', ')}`);

console.log(
  `Little Workshop performance valid under ${probe.nodeVersion}: 50 × 20s unique idles per character; ${probe.planCount} deterministic dialogue plans (${probe.authoredBeatCount} authored + ${probe.reuseBeatCount} reuse); ${probe.visemeCount} visemes; procedural opt-in voice only.`,
);
