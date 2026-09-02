import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(projectRoot, path), 'utf8');
const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const count = (source, expression) => [...source.matchAll(expression)].length;

const sceneSource = read('src/components/LittleWorkshopScene.astro');
const pyotterSource = read('src/components/PyotterPuppet.astro');
const mikwhaleSource = read('src/components/MikwhalePuppet.astro');
const frameSource = read('src/scripts/little-workshop-frame-animation.ts');
const voiceSource = read('src/scripts/little-workshop-voice.ts');
const builtHtml = read('dist/aristotter/index.html');
const atlasManifest = JSON.parse(
  read('src/assets/aristotter/characters/character-motion-v3-manifest.json'),
);

const atlasPaths = {
  pyotter: 'src/assets/aristotter/characters/pyotter/character-motion-v3.webp',
  mikwhale: 'src/assets/aristotter/characters/mikwhale/character-motion-v3.webp',
};

assert(
  atlasManifest.version === 3 && atlasManifest.frameNames.length === 32,
  'The doubled-frame atlas manifest is incomplete',
);
let atlasBytes = 0;
for (const [character, relativePath] of Object.entries(atlasPaths)) {
  const absolutePath = join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${character}: full-frame atlas is missing`);
  const bytes = statSync(absolutePath).size;
  atlasBytes += bytes;
  assert(bytes > 100_000 && bytes < 1_500_000, `${character}: atlas size is implausible`);
  const header = readFileSync(absolutePath).subarray(0, 12);
  assert(
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
      header.subarray(8, 12).toString('ascii') === 'WEBP',
    `${character}: atlas is not a valid WebP container`,
  );
  const metadata = atlasManifest.characters[character];
  assert(
    metadata.path === relativePath &&
      metadata.width === 3072 &&
      metadata.height === 2048 &&
      metadata.columns === 8 &&
      metadata.rows === 4 &&
      metadata.cellWidth === 384 &&
      metadata.cellHeight === 512 &&
      metadata.bytes === bytes,
    `${character}: atlas dimensions or manifest metadata changed`,
  );
  assert(
    metadata.frames.length === 32 &&
      metadata.frames.every(
        (entry, index) =>
          entry.name === atlasManifest.frameNames[index] &&
          entry.column === index % 8 &&
          entry.row === Math.floor(index / 8) &&
          entry.bbox[0] >= 0 &&
          entry.bbox[1] >= 0 &&
          entry.bbox[2] <= 384 &&
          entry.bbox[3] <= 512 &&
          entry.partialAlphaPixels > 0,
      ),
    `${character}: frame order, alpha, or cell bounds are invalid`,
  );
}
assert(atlasBytes < 2_500_000, 'Initial character atlas payload exceeds 2.5 MB');

const puppetSource = pyotterSource + '\n' + mikwhaleSource;
assert(
  count(puppetSource, /data-frame-character="(?:pyotter|mikwhale)"/gu) === 2,
  'Expected exactly one full-frame renderer per character',
);
for (const character of ['pyotter', 'mikwhale']) {
  const source = character === 'pyotter' ? pyotterSource : mikwhaleSource;
  assert(
    source.includes(`data-frame-character="${character}"`) &&
      source.includes('data-frame="neutral"'),
    `${character}: neutral full-frame hook is missing`,
  );
  assert(
    source.includes('background-size: 800% 400%'),
    `${character}: atlas must remain a strict 8 × 4 grid`,
  );
  for (const frame of atlasManifest.frameNames) {
    assert(source.includes(`data-frame='${frame}'`), `${character}: missing frame ${frame}`);
  }
}

const runtimeVisualSource = sceneSource + '\n' + puppetSource;
for (const obsolete of [
  'character__legacy-puppet',
  'puppet-layer',
  'data-idle-part',
  'data-voice-part',
  'character__mouth',
  'pyotter-front-transparent-v1.png',
  'mikwhale-master-transparent.png',
]) {
  assert(!runtimeVisualSource.includes(obsolete), `Legacy puppet artifact remains: ${obsolete}`);
}
assert(
  !builtHtml.includes('data-idle-part') &&
    !builtHtml.includes('data-voice-part') &&
    !builtHtml.includes('character__legacy-puppet'),
  'Built page still contains legacy articulated overlays',
);

assert(
  sceneSource.includes('createLittleWorkshopFrameAnimationEngine') &&
    !sceneSource.includes('createLittleWorkshopIdleEngine') &&
    !sceneSource.includes('createLittleWorkshopPerformanceEngine'),
  'Scene does not exclusively use the full-frame animation engine',
);
assert(
  /onUtteranceStart:\s*\(event\)\s*=>\s*\{[\s\S]*?frameAnimationEngine\.startSpeech\(event\)/u.test(
    sceneSource,
  ) &&
    /onViseme:\s*\(event\)\s*=>\s*\{[\s\S]*?frameAnimationEngine\.viseme\(event\)/u.test(
      sceneSource,
    ) &&
    /onUtteranceEnd:\s*\(event\)\s*=>\s*\{[\s\S]*?frameAnimationEngine\.endSpeech\(event\)/u.test(
      sceneSource,
    ),
  'Voice events are not connected to exclusive full-character frames',
);
assert(
  frameSource.includes("mode: 'idle' | 'speech'") &&
    frameSource.includes("channel.mode === 'speech'") &&
    frameSource.includes("'blink-quarter'") &&
    frameSource.includes("'blink-half'") &&
    frameSource.includes("'blink-three-quarter'") &&
    frameSource.includes("'blink-closed'") &&
    frameSource.includes('FRAME_GESTURE_INTERVAL_MS = 45'),
  'Frame ownership or complete blink sequencing is missing',
);
assert(
  frameSource.includes('requestAnimationFrame') &&
    !frameSource.includes('.animate('),
  'Animation engine must use one frame scheduler and no independent Web Animations tracks',
);

const gestureStart = sceneSource.indexOf('const unlockVoiceFromGesture');
const gestureEnd = sceneSource.indexOf('const dispose =', gestureStart);
assert(gestureStart >= 0 && gestureEnd > gestureStart, 'Gesture unlock wiring is missing');
const gestureSource = sceneSource.slice(gestureStart, gestureEnd);
assert(
  count(gestureSource, /unlockVoiceFromGesture\(\);/gu) >= 5,
  'Every voice toggle/gameplay gesture must attempt an audio unlock',
);
assert(
  !/await\s+unlockVoiceFromGesture\(\)/u.test(gestureSource),
  'A stalled mobile AudioContext resume can still block gameplay',
);
assert(
  voiceSource.includes("audioSession.type = 'playback'") &&
    voiceSource.includes('createBufferSource()') &&
    voiceSource.includes("unlockingContext.state !== 'running'") &&
    voiceSource.includes("context?.state === 'closed'"),
  'Mobile audio session, priming, interrupted-state, or closed-context recovery is missing',
);

const frameUrl = pathToFileURL(
  join(projectRoot, 'src/scripts/little-workshop-frame-animation.ts'),
).href;
const voiceUrl = pathToFileURL(join(projectRoot, 'src/scripts/little-workshop-voice.ts')).href;
const dataUrl = pathToFileURL(join(projectRoot, 'src/data/little-workshop-prologue.ts')).href;

const probeSource = `
const frame = await import(${JSON.stringify(frameUrl)});
const voice = await import(${JSON.stringify(voiceUrl)});
const data = await import(${JSON.stringify(dataUrl)});
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const allowedFrames = new Set(frame.CHARACTER_FRAMES);
assert(allowedFrames.size === 32, 'Expected 32 complete character frames');
assert(
  same(frame.BLINK_FRAME_SEQUENCE, [
    'blink-quarter', 'blink-half', 'blink-three-quarter', 'blink-closed',
    'blink-three-quarter', 'blink-half', 'blink-quarter', 'neutral',
  ]),
  'Blink does not use all doubled intermediate frames',
);
assert(
  frame.GESTURE_FRAME_SEQUENCE.length === 16 &&
    frame.GESTURE_FRAME_SEQUENCE[0] === 'gesture-00' &&
    frame.GESTURE_FRAME_SEQUENCE.at(-1) === 'gesture-15',
  'Gesture sequence is not doubled to 16 frames',
);
for (const [viseme, pair] of Object.entries(frame.SPEECH_FRAME_PAIRS)) {
  assert(pair.length === 2 && pair.every((name) => allowedFrames.has(name)), viseme + ': invalid speech pair');
}

for (const character of ['pyotter', 'mikwhale']) {
  const variants = frame.FRAME_IDLE_VARIANTS[character];
  assert(variants.length === 50, character + ': expected 50 authored idle timelines');
  assert(new Set(variants.map((variant) => variant.id)).size === 50, character + ': duplicate idle ids');
  assert(new Set(variants.map((variant) => JSON.stringify(variant.cues))).size === 50, character + ': duplicate idle timelines');
  for (const variant of variants) {
    assert(variant.durationMs === 20000, variant.id + ': duration changed');
    assert(variant.cues[0].atMs === 0 && variant.cues[0].frame === 'neutral', variant.id + ': must begin neutral');
    assert(variant.cues.at(-1).atMs === 19999 && variant.cues.at(-1).frame === 'neutral', variant.id + ': must end neutral');
    let previous = -1;
    for (const cue of variant.cues) {
      assert(Number.isFinite(cue.atMs) && cue.atMs >= previous && cue.atMs < 20000, variant.id + ': invalid cue order');
      assert(allowedFrames.has(cue.frame), variant.id + ': unknown frame');
      previous = cue.atMs;
    }
  }
  const catalog = JSON.stringify(variants);
  for (const frameName of [
    'inhale',
    'blink-half',
    'blink-closed',
    'smile',
    'gesture-00',
    character === 'pyotter' ? 'gesture-04' : 'gesture-14',
  ]) {
    assert(catalog.includes(frameName), character + ': idle catalog never uses ' + frameName);
  }
  for (let cycle = 0; cycle < 5; cycle += 1) {
    const first = frame.createFrameIdleVariantOrder(character, 12345, cycle);
    const second = frame.createFrameIdleVariantOrder(character, 12345, cycle);
    assert(same(first, second), character + ': shuffle is not deterministic');
    assert(first.length === 50 && new Set(first).size === 50, character + ': shuffle is not a permutation');
  }
}

const collectBeats = (value, output, seen = new Set()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) collectBeats(entry, output, seen);
    return;
  }
  if ((value.speaker === 'pyotter' || value.speaker === 'mikwhale') && typeof value.text === 'string') {
    output.push({ speaker: value.speaker, text: value.text });
  }
  for (const entry of Object.values(value)) collectBeats(entry, output, seen);
};
assert(data.littleWorkshopPrologue.length === 50, 'Prologue interaction count changed');
const beats = [];
collectBeats(data.littleWorkshopPrologue, beats);
collectBeats(data.objectReuseDialogue, beats);
assert(beats.length > 100, 'Dialogue corpus is unexpectedly incomplete');
const visemes = new Set();
for (const beat of beats) {
  const first = voice.createSpeechPlan(beat.speaker, beat.text);
  const second = voice.createSpeechPlan(beat.speaker, beat.text);
  assert(same(first, second), 'Speech planning is not deterministic');
  assert(first.totalDurationMs <= 4000, 'Speech exceeds four seconds');
  for (const event of first.events) visemes.add(event.viseme);
}
assert(visemes.size === 5, 'Dialogue corpus does not exercise all five speaking frames');

const stored = new Map();
let primerStarts = 0;
let resumeCalls = 0;
let contextCreations = 0;
const parameter = () => ({
  value: 1,
  cancelScheduledValues() {},
  setTargetAtTime(value) { this.value = value; },
  setValueAtTime(value) { this.value = value; },
});
const node = () => ({
  connect(next) { return next; },
  disconnect() {},
});
const fakeContext = {
  state: 'interrupted',
  sampleRate: 48000,
  currentTime: 0,
  destination: node(),
  createBuffer() { return {}; },
  createBufferSource() {
    return {
      ...node(),
      buffer: null,
      onended: null,
      start() {
        primerStarts += 1;
        queueMicrotask(() => this.onended?.());
      },
    };
  },
  createGain() {
    return { ...node(), gain: parameter() };
  },
  async resume() {
    resumeCalls += 1;
    this.state = 'running';
  },
  async close() {
    this.state = 'closed';
  },
};
const audioSession = { type: 'ambient' };
const engine = voice.createLittleWorkshopVoiceEngine({
  storage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
  contextFactory: () => {
    contextCreations += 1;
    return fakeContext;
  },
  audioSession,
});
assert(engine.getStatus() === 'disabled' && contextCreations === 0, 'AudioContext was not lazy');
engine.setEnabled(true);
const unlocking = engine.unlockFromGesture();
assert(primerStarts === 1, 'Gesture did not synchronously start the one-sample primer');
assert(audioSession.type === 'playback', 'Safari playback audio session was not requested');
assert(await unlocking === 'ready', 'Interrupted AudioContext did not recover');
assert(resumeCalls === 1 && contextCreations === 1, 'AudioContext recovery count is invalid');
await engine.dispose();

console.log('FRAME_PROBE=' + JSON.stringify({
  beats: beats.length,
  idleVariantsPerCharacter: 50,
  visemes: visemes.size,
  primerStarts,
  resumeCalls,
}));
`;

const probe = spawnSync(
  process.execPath,
  ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', probeSource],
  { cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);
assert(
  probe.status === 0,
  `Unable to verify frame animation and mobile audio:\n${probe.stderr || probe.stdout}`,
);
const probeLine = probe.stdout
  .split(/\r?\n/u)
  .find((line) => line.startsWith('FRAME_PROBE='));
assert(probeLine, 'Animation/audio probe returned no result');
const result = JSON.parse(probeLine.slice('FRAME_PROBE='.length));

const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus']);
const audioFiles = [];
const scan = (directory) => {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (audioExtensions.has(extname(entry.name).toLowerCase())) audioFiles.push(path);
  }
};
scan(join(projectRoot, 'src'));
scan(join(projectRoot, 'public'));
assert(audioFiles.length === 0, `Pre-recorded audio files are forbidden: ${audioFiles.join(', ')}`);

console.log(
  `Little Workshop true animation valid: two 32-frame WebP atlases (${(
    atlasBytes /
    1024 /
    1024
  ).toFixed(2)} MiB), 50 × 20s exclusive timelines per character, ${result.beats} voiced beats, doubled full-frame visemes/blinks/gestures, and Safari gesture/audio-session recovery.`,
);
