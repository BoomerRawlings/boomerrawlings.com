import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const companionsRoot = join(projectRoot, 'src', 'assets', 'companions');
const distRoot = join(projectRoot, 'dist');
const specPath = join(companionsRoot, 'workshop-spec.json');

const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const sameJson = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const sameSequence = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);
const hashFile = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
const countMatches = (text, expression) => [...text.matchAll(expression)].length;

assert(existsSync(specPath), 'Little Workshop specification is missing');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

assert(
  spec.id === 'little-workshop' &&
    spec.version === 3 &&
    spec.stage === 'authored-prologue-alpha' &&
    spec.workingTitle === 'Little Workshop',
  'Little Workshop prologue identity is invalid',
);
assert(
  !('room' in spec) && !('navigation' in spec) && !('mvp' in spec),
  'Stale room, navigation, or inventory-era specification remains operative',
);

for (const field of ['doctrine', 'worldviewContract', 'relationship']) {
  const path = resolve(companionsRoot, spec[field] ?? '');
  assert(spec[field] && existsSync(path), `Little Workshop ${field} is missing`);
  assert(readFileSync(path, 'utf8').trim().length > 0, `Little Workshop ${field} is empty`);
}

const expectedSources = {
  'little-workshop-concept-source.txt':
    '664FB83D9C67C5AD468A9C3A9B4A351C5FDED0570BE1ABD98174ACC752EA8177',
  'little-workshop-room-source.txt':
    'F39635AA441F9AC4F95F3C434F9E7E1B8DA85B65A1C40BDF7B8923EFA338C879',
};
assert(Array.isArray(spec.sources) && spec.sources.length === 2, 'Archived source provenance is incomplete');
for (const source of spec.sources) {
  const path = resolve(companionsRoot, source.path ?? '');
  assert(expectedSources[source.path] === source.sha256, `Unexpected source declaration: ${source.path}`);
  assert(
    source.status === 'archived-future-concept' && source.runtimeAuthority === false,
    `Archived source is still presented as runtime authority: ${source.path}`,
  );
  assert(existsSync(path) && hashFile(path) === source.sha256, `Source hash mismatch: ${source.path}`);
}

const expectedImplementation = {
  data: join(projectRoot, 'src', 'data', 'little-workshop-prologue.ts'),
  state: join(projectRoot, 'src', 'scripts', 'little-workshop-state.ts'),
  voice: join(projectRoot, 'src', 'scripts', 'little-workshop-voice.ts'),
  idle: join(projectRoot, 'src', 'scripts', 'little-workshop-idle.ts'),
  component: join(projectRoot, 'src', 'components', 'LittleWorkshopScene.astro'),
  route: join(projectRoot, 'src', 'pages', 'aristotter', 'index.astro'),
  objectSprites: join(companionsRoot, 'objects'),
};
const implementation = {};
for (const [key, expectedPath] of Object.entries(expectedImplementation)) {
  const declared = spec.implementation?.[key];
  const actualPath = resolve(companionsRoot, declared ?? '');
  assert(declared && actualPath === expectedPath, `Little Workshop ${key} path is not canonical`);
  assert(existsSync(actualPath), `Little Workshop ${key} is missing`);
  implementation[key] = actualPath;
}

assert(
  sameJson(spec.access, {
    linkPossessionOnly: true,
    authenticationImplemented: false,
    listedInNavigation: false,
    listedInSitemap: false,
    robots: ['noindex', 'nofollow', 'noarchive', 'noimageindex'],
  }),
  'Unlisted link-only access contract is invalid',
);

const expectedPlacementActions = [
  { id: 'otter', label: 'Give to Otter' },
  { id: 'middle', label: 'Set Between Them' },
  { id: 'whale', label: 'Give to Whale' },
];
const expectedActionVocabulary = [
  'excited',
  'hand-over',
  'inspect',
  'look-at-object',
  'look-forward',
  'pause',
  'pick-up',
  'put-down',
  'share',
  'suspicious',
  'toss',
];
const expectedExcludedSystems = [
  'room-simulation',
  'camera',
  'map',
  'pathfinding',
  'direct-character-movement',
  'keyboard-movement',
  'hud',
  'inventory-management',
  'crafting',
  'resource-loop',
  'openai-runtime',
  'free-text-before-interaction-50',
];
assert(
  spec.surface?.projection === 'flat-2d' &&
    sameSequence(spec.surface.characters, ['pyotter', 'mikwhale']) &&
    sameSequence(spec.surface.layoutOrder, ['pyotter', 'selected-object', 'mikwhale']) &&
    spec.surface.maximumVisibleSelectedObjectCount === 1 &&
    spec.surface.centerEmptyUntilObjectSelection === true &&
    sameJson(spec.surface.standardPlacementInteractions, [1, 48]) &&
    sameJson(spec.surface.placementActions, expectedPlacementActions) &&
    sameSequence(spec.surface.excludedSystems, expectedExcludedSystems),
  'Flat three-placement surface contract is invalid',
);
assert(
  sameJson(spec.surface.objectDrawer, {
    interactions: [1, 48],
    unlockMode: 'progressive-through-current-interaction',
    duplicateObjectIds: 'single-entry',
    selectionControl: 'native-radio-group',
    visibleLabels: true,
    orientation: 'horizontal',
    overflow: 'scroll',
    visibleScrollbar: true,
    selectionRequiredBeforePlacement: true,
    currentAuthoredObjectAdvances: true,
    priorObjectReuseAdvances: false,
    hiddenAtInteractions: [49, 50],
  }),
  'Progressive object-drawer contract is invalid',
);
assert(
  sameJson(spec.surface.physicalActionDurationMs, {
    minimum: 2000,
    maximum: 8000,
    currentBase: 2200,
    reducedMotion: 40,
  }) &&
    sameSequence(spec.surface.actionVocabulary, expectedActionVocabulary) &&
    sameJson(spec.surface.dialogue, {
      position: 'near-speaker',
      sentencesPerDisplayedUtterance: { minimum: 1, maximum: 3 },
      politeLiveAnnouncement: true,
    }),
  'Action timing or dialogue surface contract is invalid',
);

const expectedAwareness = [
  { range: [1, 14], communicationLevelAfterCompletion: 0, mode: 'unaware' },
  {
    range: [15, 20],
    communicationLevelAfterCompletion: 0,
    mode: 'unaware',
    vagueRepeatNoticeOnlyAt: 15,
  },
  { range: [21, 30], communicationLevelAfterCompletion: 1, mode: 'placement-pattern' },
  { range: [31, 38], communicationLevelAfterCompletion: 2, mode: 'intentionality' },
  {
    range: [39, 43],
    communicationLevelAfterCompletion: 3,
    mode: 'restrained-outward-address',
  },
  {
    range: [44, 46],
    communicationLevelAfterCompletion: 4,
    mode: 'three-placement-communication-tests',
  },
  { range: [47, 48], communicationLevelAfterCompletion: 5, mode: 'answer-mapping' },
  { range: [49, 49], communicationLevelAfterCompletion: 6, mode: 'explicit-strawberry-choice' },
  { range: [50, 50], communicationLevelAfterCompletion: 7, mode: 'unicode-name-and-stop' },
];
assert(
  spec.prologue?.interactionCount === 50 &&
    spec.prologue.authoredOrderedSequence === true &&
    spec.prologue.choiceModel === 'state-based-linear-progression' &&
    spec.prologue.choiceTreeExpansionAllowed === false &&
    spec.prologue.currentAuthoredObjectPlacementAdvancesOneInteraction === true &&
    spec.prologue.priorObjectReuseAdvancesInteraction === false &&
    sameJson(spec.prologue.awareness, expectedAwareness),
  'Fifty-interaction awareness contract is invalid',
);
assert(
  sameJson(spec.prologue.communicationTests, {
    range: [44, 46],
    expectedTargets: { 44: 'otter', 45: 'middle', 46: 'whale' },
    allPlacementsValid: true,
    complianceRequired: false,
    refusalEndsExchange: false,
  }) &&
    sameJson(spec.prologue.answerMapping, {
      range: [47, 48],
      otter: 'yes',
      middle: 'unsure',
      whale: 'no',
    }),
  'Communication-test or answer mapping contract is invalid',
);
assert(
  spec.prologue.strawberry?.interaction === 49 &&
    spec.prologue.strawberry.inputKind === 'placement-choice' &&
    sameJson(spec.prologue.strawberry.options, [
      { value: 'yes', label: 'Yes.', placement: 'otter' },
      { value: 'never-tried', label: 'Never tried one.', placement: 'middle' },
      { value: 'no', label: 'No.', placement: 'whale' },
    ]) &&
    sameJson(spec.prologue.name, {
      interaction: 50,
      inputKind: 'free-text',
      onlyFreeTextInput: true,
      unicodeNormalization: 'NFC',
      maximumGraphemes: 40,
      blankAdvances: false,
      stopAfterValidName: true,
    }),
  'Strawberry or Unicode-name boundary is invalid',
);

const expectedCounters = [
  'interaction_count',
  'communication_level',
  'otter_gifts',
  'middle_placements',
  'whale_gifts',
  'sharing_choices',
  'autonomy_choices',
  'experimentation_choices',
  'automation_choices',
  'centralized_solution_choices',
  'distributed_solution_choices',
  'player_complied_with_tests',
  'player_resisted_tests',
];
const expectedFlags = [
  'known_to_characters',
  'gave_otter_first_apple',
  'gave_whale_key',
  'repeatedly_favors_otter',
  'repeatedly_favors_whale',
  'frequently_uses_middle',
  'communication_test_success',
  'communication_test_refused',
];
const expectedValues = [
  'name',
  'player_name',
  'strawberry_answer',
  'current_object',
  'previous_objects',
  'important_choices',
  'important_events',
  'notable_event_flags',
];
assert(
  spec.persistence?.implemented === true &&
    spec.persistence.scope === 'browser-device-local' &&
    spec.persistence.format === 'versioned-json-envelope' &&
    spec.persistence.version === 1 &&
    spec.persistence.storageKey === 'little-workshop-state' &&
    spec.persistence.commitBoundary === 'completed-semantic-interaction' &&
    spec.persistence.objectReuseCommitBoundary === 'completed-repeat-reaction' &&
    spec.persistence.objectReusePreservesInteractionCount === true &&
    spec.persistence.restoreMidAnimation === 'last-committed-interaction' &&
    spec.persistence.crossDeviceSync === false &&
    spec.persistence.serverBackup === false &&
    spec.persistence.rawPointerTrailsStored === false &&
    spec.persistence.animationFramesStored === false &&
    sameSequence(spec.persistence.requiredCounters, expectedCounters) &&
    sameSequence(spec.persistence.requiredFlags, expectedFlags) &&
    sameSequence(spec.persistence.requiredValues, expectedValues),
  'Versioned semantic persistence contract is invalid',
);
assert(
  sameJson(spec.runtime, {
    prologueImplemented: true,
    persistenceImplemented: true,
    objectSelectionDrawerImplemented: true,
    proceduralVoiceImplemented: true,
    synchronizedVisemesImplemented: true,
    continuousIdleImplemented: true,
    roomImplemented: false,
    movementImplemented: false,
    inventoryImplemented: false,
    craftingImplemented: false,
    openAiImplemented: false,
    implementedClaims: [
      'flat-two-character-stage',
      'one-current-object',
      'progressively-unlocked-object-drawer',
      'older-object-repeat-reactions',
      'fifty-authored-interactions',
      'three-placement-actions',
      'state-based-dialogue-variation',
      'versioned-browser-local-state',
      'strawberry-multiple-choice',
      'unicode-name-terminal-state',
      'opt-in-procedural-character-voices',
      'voice-synchronized-six-state-mouths',
      'fifty-independent-idles-per-character',
      'layered-idle-and-performance-transforms',
    ],
  }),
  'Runtime boundary overstates or omits the implemented prologue',
);

const doctrine = readFileSync(implementation.doctrine ?? resolve(companionsRoot, spec.doctrine), 'utf8');
for (const marker of [
  'authored-prologue alpha',
  'one flat 2D stage',
  'progressively unlocked, horizontally scrollable object drawer',
  'without changing `interaction_count`',
  'There is no room',
  'state-based variation',
  'Interaction 15 alone',
  'Otter = yes, middle = unsure, Whale = no',
  'only free-text field',
  'archived future concepts',
]) {
  assert(doctrine.includes(marker), `Little Workshop doctrine is missing: ${marker}`);
}
assert(
  !doctrine.includes('Status: movement-scene alpha') &&
    !doctrine.includes('safe-route locomotion are implemented'),
  'Little Workshop doctrine retains false movement implementation claims',
);

const dataUrl = pathToFileURL(implementation.data).href;
const stateUrl = pathToFileURL(implementation.state).href;
const probeSource = `
const data = await import(${JSON.stringify(dataUrl)});
const state = await import(${JSON.stringify(stateUrl)});
const makeStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const storage = makeStorage();
const reuseStorage = makeStorage();
state.recordPlacement({ target: 'otter', object_id: 'apple' }, reuseStorage);
const beforeObjectReuse = state.loadState(reuseStorage);
state.recordObjectReuse({ target: 'middle', object_id: 'apple' }, reuseStorage);
const afterObjectReuse = state.loadState(reuseStorage);
const expectedTargets = { 44: 'otter', 45: 'middle', 46: 'whale' };
const fallbackTargets = ['otter', 'middle', 'whale'];
for (let index = 0; index < 48; index += 1) {
  const sequence = index + 1;
  const target = expectedTargets[sequence] ??
    (data.littleWorkshopPrologue[index].object.id === 'key' ? 'whale' : fallbackTargets[index % 3]);
  state.recordPlacement({
    target,
    object_id: data.littleWorkshopPrologue[index].object.id,
    state_effects: data.littleWorkshopPrologue[index].placements[target].stateEffects,
    test_response: expectedTargets[sequence] ? 'complied' : undefined,
  }, storage);
}
const after48 = state.loadState(storage);
const rejectedStrawberry = state.recordStrawberry('unsupported-answer', storage);
state.recordStrawberry('never-tried', storage);
const after49 = state.loadState(storage);
const blankName = state.recordName('   ', storage);
state.recordName('  Jose\\u0301 李 👩🏽‍💻 e\\u0301  ', storage);
const after50 = state.loadState(storage);
const malformedStorage = {
  getItem: () => '{not-json', setItem: () => {}, removeItem: () => {},
};
const unknownVersionStorage = {
  getItem: () => JSON.stringify({ version: 999, state: after50 }),
  setItem: () => {}, removeItem: () => {},
};
const deniedStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('denied'); },
  removeItem: () => {},
};
state.recordPlacement({
  target: 'middle',
  object_id: 'apple',
  state_effects: { volatileProgress: true },
}, deniedStorage);
const staleSeedStorage = makeStorage();
state.recordPlacement({ target: 'otter', object_id: 'apple' }, staleSeedStorage);
const staleSerialized = staleSeedStorage.getItem(state.LITTLE_WORKSHOP_STORAGE_KEY);
const staleWriteBlockedStorage = {
  getItem: () => staleSerialized,
  setItem: () => { throw new Error('quota'); },
  removeItem: () => {},
};
state.recordPlacement({
  target: 'middle',
  object_id: 'ball',
  state_effects: { newestVolatileProgress: true },
}, staleWriteBlockedStorage);
console.log('WORKSHOP_PROBE=' + JSON.stringify({
  prologue: data.littleWorkshopPrologue,
  count: data.littleWorkshopPrologueCount,
  version: state.LITTLE_WORKSHOP_STATE_VERSION,
  storageKey: state.LITTLE_WORKSHOP_STORAGE_KEY,
  levels: Array.from({ length: 51 }, (_, count) => state.communicationLevelForInteractionCount(count)),
  initial: state.createInitialState(),
  beforeObjectReuse,
  afterObjectReuse,
  after48,
  rejectedStrawberryCount: rejectedStrawberry.PLAYER_STATE.interaction_count,
  after49,
  blankNameCount: blankName.PLAYER_STATE.interaction_count,
  after50,
  malformedCount: state.loadState(malformedStorage).PLAYER_STATE.interaction_count,
  unknownVersionCount: state.loadState(unknownVersionStorage).PLAYER_STATE.interaction_count,
  deniedStorageState: state.loadState(deniedStorage),
  staleWriteBlockedState: state.loadState(staleWriteBlockedStorage),
}));
`;
const probeProcess = spawnSync(
  process.execPath,
  ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', probeSource],
  { cwd: projectRoot, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 },
);
assert(
  probeProcess.status === 0,
  `Unable to execute workshop data/state modules:\n${probeProcess.stderr || probeProcess.stdout}`,
);
const probeLine = probeProcess.stdout
  .split(/\r?\n/)
  .find((line) => line.startsWith('WORKSHOP_PROBE='));
assert(probeLine, 'Workshop data/state probe returned no result');
const probe = JSON.parse(probeLine.slice('WORKSHOP_PROBE='.length));
const prologue = probe.prologue;

assert(probe.count === 50 && prologue.length === 50, 'Authored prologue must contain exactly 50 interactions');
assert(
  sameSequence(
    prologue.map((interaction) => interaction.sequence),
    Array.from({ length: 50 }, (_, index) => index + 1),
  ),
  'Prologue interaction sequence is not exactly 1 through 50',
);
assert(
  new Set(prologue.map((interaction) => interaction.id)).size === 50,
  'Prologue interaction IDs must be unique',
);

const expectedLevelForCount = (count) => {
  if (count >= 50) return 7;
  if (count >= 49) return 6;
  if (count >= 47) return 5;
  if (count >= 44) return 4;
  if (count >= 39) return 3;
  if (count >= 31) return 2;
  if (count >= 21) return 1;
  return 0;
};
assert(
  sameSequence(
    probe.levels,
    Array.from({ length: 51 }, (_, count) => expectedLevelForCount(count)),
  ),
  'State communication-level boundaries do not match the authored prologue',
);

const sentenceCount = (text) => {
  const normalized = text.replaceAll('{{observerName}}', 'Name').trim();
  const endings = normalized.match(/[.!?…]+(?:["'”’)]*)?(?=\s|$)/gu);
  return Math.max(1, endings?.length ?? 0);
};
const validateBeat = (beat, context) => {
  assert(beat && ['pyotter', 'mikwhale'].includes(beat.speaker), `${context}: invalid speaker`);
  assert(
    beat.label === (beat.speaker === 'pyotter' ? 'Otter' : 'Whale'),
    `${context}: speaker label mismatch`,
  );
  assert(typeof beat.text === 'string' && beat.text.trim(), `${context}: empty dialogue`);
  const sentences = sentenceCount(beat.text);
  assert(sentences >= 1 && sentences <= 3, `${context}: dialogue exceeds one to three sentences`);
};
const validateCues = (cues, context) => {
  assert(Array.isArray(cues) && cues.length > 0, `${context}: physical action cues are missing`);
  for (const cue of cues) {
    assert(
      ['pyotter', 'mikwhale', 'both', 'environment'].includes(cue.actor) &&
        typeof cue.action === 'string' &&
        expectedActionVocabulary.includes(cue.action),
      `${context}: invalid physical action cue`,
    );
  }
};
const placements = ['otter', 'middle', 'whale'];
const unlocks = new Map([
  [21, 1],
  [31, 2],
  [39, 3],
  [44, 4],
  [47, 5],
  [49, 6],
  [50, 7],
]);
for (const interaction of prologue) {
  const context = `interaction ${interaction.sequence}`;
  assert(
    interaction.requiredCommunicationLevel === expectedLevelForCount(interaction.sequence - 1),
    `${context}: required communication level is wrong`,
  );
  assert(
    (interaction.unlocksCommunicationLevel ?? null) === (unlocks.get(interaction.sequence) ?? null),
    `${context}: communication unlock is wrong`,
  );
  assert(
    interaction.object && typeof interaction.object.id === 'string' && interaction.object.id &&
      typeof interaction.object.label === 'string' && interaction.object.label,
    `${context}: current object is invalid`,
  );
  assert(
    sameSequence(Object.keys(interaction.placements), placements),
    `${context}: must author Otter, middle, and Whale outcomes`,
  );
  for (const [index, beat] of interaction.setup.entries()) validateBeat(beat, `${context} setup ${index + 1}`);
  for (const placement of placements) {
    const outcome = interaction.placements[placement];
    assert(outcome && typeof outcome.stateEffects === 'object', `${context} ${placement}: state effects missing`);
    for (const [index, beat] of outcome.beats.entries()) {
      validateBeat(beat, `${context} ${placement} beat ${index + 1}`);
    }
    validateCues(outcome.actionCues, `${context} ${placement}`);
  }
  for (const branch of interaction.branches ?? []) {
    assert(branch.id && branch.when, `${context}: invalid state branch`);
    for (const [index, beat] of branch.beats.entries()) {
      validateBeat(beat, `${context} branch ${branch.id} beat ${index + 1}`);
    }
    if (branch.actionCues) validateCues(branch.actionCues, `${context} branch ${branch.id}`);
  }
  assert(
    !Object.hasOwn(interaction, 'next') &&
      !Object.hasOwn(interaction, 'goto') &&
      !Object.hasOwn(interaction, 'children'),
    `${context}: explicit choice-tree expansion is forbidden`,
  );
  if (interaction.sequence <= 48) assert(!interaction.input, `${context}: premature alternate input`);
}

assert(
  prologue.slice(0, 38).every((interaction) => interaction.phase !== 'first-address') &&
    prologue[38].phase === 'first-address' &&
    prologue[38].id === 'bell-first-address',
  'Restrained outward address must begin exactly at interaction 39',
);
assert(
  prologue[14].id === 'hammer-recurrence' &&
    prologue[14].phase === 'principles-in-action' &&
    Object.values(prologue[14].placements).every(
      (outcome) => outcome.stateEffects.repetitionNoticed === true,
    ),
  'Interaction 15 must contain the sole vague repeat-notice milestone',
);

for (const [sequenceText, expectedTarget] of Object.entries(
  spec.prologue.communicationTests.expectedTargets,
)) {
  const sequence = Number(sequenceText);
  const interaction = prologue[sequence - 1];
  for (const placement of placements) {
    const result = interaction.placements[placement].stateEffects[`communicationTest${sequence}`];
    assert(
      placement === expectedTarget ? result === 'complied' : String(result).startsWith('resisted'),
      `Interaction ${sequence} does not preserve valid compliance/refusal outcomes`,
    );
  }
}
for (const sequence of [47, 48]) {
  const interaction = prologue[sequence - 1];
  for (const placement of placements) {
    assert(
      interaction.placements[placement].stateEffects[`mappedAnswer${sequence}`] ===
        spec.prologue.answerMapping[placement],
      `Interaction ${sequence} does not map ${placement} correctly`,
    );
  }
}
assert(
  prologue[48].object.id === 'strawberry' &&
    prologue[48].input?.kind === 'placement-choice' &&
    sameJson(prologue[48].input.options, spec.prologue.strawberry.options) &&
    prologue[48].stopAfter !== true,
  'Interaction 49 is not the explicit strawberry multiple choice',
);
assert(
  prologue[49].id === 'name-exchange' &&
    prologue[49].input?.kind === 'free-text' &&
    prologue[49].input.maxLength === 40 &&
    prologue[49].input.autocomplete === 'name' &&
    prologue[49].stopAfter === true,
  'Interaction 50 is not the Unicode-name terminal interaction',
);
assert(
  prologue.filter((interaction) => interaction.input?.kind === 'free-text').length === 1,
  'Free text must exist only at interaction 50',
);

const objectIds = new Set(
  prologue.map((interaction) => interaction.object.id.replace('-copy', '')),
);
for (const objectId of objectIds) {
  assert(
    existsSync(join(implementation.objectSprites, `${objectId}-v1.png`)),
    `Current-object sprite is missing: ${objectId}`,
  );
}

const stateSource = readFileSync(implementation.state, 'utf8');
assert(
  probe.version === spec.persistence.version && probe.storageKey === spec.persistence.storageKey,
  'State version or storage key does not match the specification',
);
for (const field of [...expectedCounters, ...expectedFlags, ...expectedValues]) {
  assert(new RegExp(`\\b${field}\\b`).test(stateSource), `State field is missing: ${field}`);
}
for (const exportName of [
  'createInitialState',
  'loadState',
  'saveState',
  'resetState',
  'recordPlacement',
  'recordObjectReuse',
  'recordStrawberry',
  'recordName',
  'communicationLevelForInteractionCount',
]) {
  assert(
    new RegExp(`export const ${exportName}\\b`).test(stateSource),
    `State API is missing: ${exportName}`,
  );
}
assert(
  stateSource.includes("normalize('NFC')") &&
    stateSource.includes("granularity: 'grapheme'") &&
    !stateSource.includes('innerHTML'),
  'Unicode name normalization or safe text handling is incomplete',
);
assert(
  probe.beforeObjectReuse.PLAYER_STATE.interaction_count === 1 &&
    probe.afterObjectReuse.PLAYER_STATE.interaction_count === 1 &&
    probe.afterObjectReuse.HISTORY.notable_event_flags.drawerObjectReuses === 1 &&
    probe.afterObjectReuse.HISTORY.notable_event_flags.lastReusedObject === 'apple' &&
    probe.afterObjectReuse.HISTORY.notable_event_flags.lastReusePlacement === 'middle' &&
    probe.afterObjectReuse.HISTORY.important_choices.at(-1) === 'reuse:apple:middle',
  'Older-object reuse does not persist semantically without advancing the authored sequence',
);
assert(
  probe.after48.PLAYER_STATE.interaction_count === 48 &&
    probe.after48.PLAYER_STATE.communication_level === 5 &&
    probe.after48.PLAYER_STATE.otter_gifts +
      probe.after48.PLAYER_STATE.middle_placements +
      probe.after48.PLAYER_STATE.whale_gifts ===
      48 &&
    probe.after48.PLAYER_STATE.player_complied_with_tests === 3 &&
    probe.after48.PLAYER_STATE.communication_test_success === true &&
    Object.keys(probe.after48.HISTORY.notable_event_flags).length >= 20 &&
    probe.after48.HISTORY.notable_event_flags.communicationTest44 === 'complied',
  'Placement state does not persist the first 48 semantic interactions',
);
assert(
  probe.rejectedStrawberryCount === 48 &&
    probe.after49.PLAYER_STATE.interaction_count === 49 &&
    probe.after49.PLAYER_STATE.communication_level === 6 &&
    probe.after49.PLAYER_STATE.strawberry_answer === 'never-tried' &&
    probe.blankNameCount === 49,
  'Strawberry or blank-name persistence boundary is invalid',
);
assert(
  probe.after50.PLAYER_STATE.interaction_count === 50 &&
    probe.after50.PLAYER_STATE.communication_level === 7 &&
    probe.after50.PLAYER_STATE.known_to_characters === true &&
    probe.after50.PLAYER_STATE.name === 'José 李 👩🏽‍💻 é' &&
    probe.after50.PLAYER_STATE.player_name === probe.after50.PLAYER_STATE.name,
  'Unicode name does not persist as the terminal semantic interaction',
);
assert(
  probe.malformedCount === 0 && probe.unknownVersionCount === 0,
  'Malformed or unknown-version state does not recover safely',
);
assert(
  probe.deniedStorageState.PLAYER_STATE.interaction_count === 1 &&
    probe.deniedStorageState.HISTORY.notable_event_flags.volatileProgress === true,
  'Unavailable persistent storage does not retain same-page volatile progress',
);
assert(
  probe.staleWriteBlockedState.PLAYER_STATE.interaction_count === 2 &&
    probe.staleWriteBlockedState.HISTORY.notable_event_flags.newestVolatileProgress === true,
  'Stale readable storage overwrites newer same-page volatile progress',
);

const componentSource = readFileSync(implementation.component, 'utf8');
const routeSource = readFileSync(implementation.route, 'utf8');
assert(
  countMatches(componentSource, /<article[^>]+data-character="pyotter"/g) === 1 &&
    countMatches(componentSource, /<article[^>]+data-character="mikwhale"/g) === 1 &&
    countMatches(componentSource, /<div class="current-object">/g) === 1 &&
    countMatches(componentSource, /<aside[^>]+data-dialogue=/g) === 2,
  'Flat character/object/dialogue stage markup is incomplete',
);
assert(
  /<fieldset[^>]+data-object-drawer[^>]+hidden/.test(componentSource) &&
    /<legend[^>]*>Choose an object<\/legend>/.test(componentSource) &&
    /<input[\s\S]+type="radio"[\s\S]+name="workshop-object"[\s\S]+data-object-choice=/.test(
      componentSource,
    ) &&
    /<label[^>]+for=/.test(componentSource) &&
    componentSource.includes('<span>{label}</span>') &&
    componentSource.includes('data-object-drawer-status') &&
    componentSource.includes('data-object-drawer-rail'),
  'Object drawer is not a semantic, visibly labelled single-selection control',
);
const placementButtons = [
  ...componentSource.matchAll(/<button[^>]+data-placement="([^"]+)"[^>]*>([^<]+)<\/button>/g),
].map((match) => ({ id: match[1], label: match[2].trim() }));
assert(sameJson(placementButtons, expectedPlacementActions), 'Rendered placement actions are not exact');
const strawberryButtons = [
  ...componentSource.matchAll(
    /<button[^>]+data-strawberry-answer="([^"]+)"[^>]*>([^<]+)<\/button>/g,
  ),
].map((match) => ({ value: match[1], label: match[2].trim() }));
assert(
  sameJson(
    strawberryButtons,
    spec.prologue.strawberry.options.map(({ value, label }) => ({ value, label })),
  ),
  'Rendered strawberry choices are not exact',
);
assert(
  /<form[^>]+data-name-form[^>]+hidden/.test(componentSource) &&
    /<input[\s\S]+type="text"[\s\S]+autocomplete="name"/.test(componentSource) &&
    componentSource.includes("interaction.input?.kind === 'free-text'") &&
    componentSource.includes("setPhase('awaiting-name')") &&
    componentSource.includes("setPhase('complete')"),
  'Name input is not gated to interaction 50 and terminal completion',
);
assert(
  componentSource.includes("setPhase('awaiting-object')") &&
    componentSource.includes('recordObjectReuse') &&
    /(?:selectedObject|object)\.isCurrent/.test(componentSource) &&
    /overflow-x:\s*auto/.test(componentSource) &&
    /scrollbar-width:\s*thin/.test(componentSource) &&
    /scroll-snap-type:\s*(?:inline|x)/.test(componentSource),
  'Object selection, repeat routing, or responsive horizontal drawer behavior is incomplete',
);
assert(
  componentSource.includes("live.textContent = beat.label + ': ' + beat.text") &&
    componentSource.includes('aria-live="polite"') &&
    componentSource.includes('dialogueTextElements[id].textContent = beat.text') &&
    !componentSource.includes('innerHTML'),
  'Near-speaker dialogue is not safely announced',
);
assert(
  componentSource.includes("phase === 'acting'") &&
    !componentSource.includes("phase === 'dialogue' ||"),
  'Dialogue live announcements are incorrectly hidden behind aria-busy',
);
assert(
  /state_effects:\s*(?:authoredOutcome|outcome)\.stateEffects/.test(componentSource) &&
    componentSource.includes('outcome.stateEffects);') &&
    componentSource.includes('branch?.stateEffects);'),
  'Authored outcome effects are not committed to semantic memory',
);
assert(
  componentSource.includes('reducedMotion.matches ? 40 : 2200') &&
    componentSource.includes(".character.is-acting [data-voice-part='head']") &&
    componentSource.includes(".character.is-acting [data-voice-part='paw-left']") &&
    componentSource.includes(".character.is-acting [data-voice-part='paw-right']") &&
    componentSource.includes('animation: object-handle 2.2s'),
  'Physical action timing or articulated performance routing is incomplete',
);

const prohibitedRuntimePatterns = [
  [/data-inventory|workshop-inventory|data-object-action/i, 'inventory-management UI'],
  [/addEventListener\s*\(\s*['"]key(?:down|up)['"]|onkey(?:down|up)|KeyboardEvent/i, 'keyboard movement'],
  [/navigation\.json|pathfind/i, 'pathfinding'],
  [/\bfetch\s*\(|WebSocket|EventSource|openai(?:\.com|-runtime)?/i, 'network AI'],
  [/data-craft|crafting-controls/i, 'crafting UI'],
];
for (const [pattern, label] of prohibitedRuntimePatterns) {
  assert(!pattern.test(componentSource + '\n' + stateSource), `Current runtime contains forbidden ${label}`);
}
assert(
  routeSource.includes('<LittleWorkshopScene />') &&
    routeSource.includes('noindex,nofollow,noarchive,noimageindex') &&
    routeSource.includes('referrer" content="no-referrer') &&
    !routeSource.includes('SiteLayout') &&
    !routeSource.includes('<nav'),
  'Unlisted route shell is incomplete or publicly framed',
);

const builtRoutePath = join(distRoot, 'aristotter', 'index.html');
assert(existsSync(builtRoutePath), 'Built Little Workshop route is missing; run the build first');
const builtHtml = readFileSync(builtRoutePath, 'utf8');
for (const marker of [
  'data-prologue',
  'data-prologue-stage',
  'data-object-anchor',
  'data-object-drawer',
  'data-object-choice',
  'Give to Otter',
  'Set Between Them',
  'Give to Whale',
  'data-strawberry-choices',
  'data-name-form',
  'noindex,nofollow,noarchive,noimageindex',
]) {
  assert(builtHtml.includes(marker), `Built Little Workshop route is missing: ${marker}`);
}
const builtScripts = [...builtHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) =>
  join(distRoot, match[1].replace(/^\//, '')),
);
assert(builtScripts.length > 0, 'Built Little Workshop client script is missing');
const builtRuntime = builtScripts
  .map((path) => {
    assert(existsSync(path), `Built Little Workshop script is missing: ${relative(projectRoot, path)}`);
    return readFileSync(path, 'utf8');
  })
  .join('\n');
for (const [pattern, label] of prohibitedRuntimePatterns) {
  assert(!pattern.test(builtHtml + '\n' + builtRuntime), `Built route contains forbidden ${label}`);
}

const walkFiles = (directory) => {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walkFiles(path));
    else files.push(path);
  }
  return files;
};
for (const sitemapPath of walkFiles(distRoot).filter((path) => /sitemap.*\.xml$/i.test(path))) {
  assert(
    !readFileSync(sitemapPath, 'utf8').includes('/aristotter/'),
    'Little Workshop leaked into the sitemap',
  );
}
for (const htmlPath of walkFiles(distRoot).filter(
  (path) => path.endsWith('.html') && path !== builtRoutePath,
)) {
  assert(
    !/href=["'][^"']*\/aristotter\/?["']/i.test(readFileSync(htmlPath, 'utf8')),
    `Public page links to Little Workshop: ${relative(distRoot, htmlPath)}`,
  );
}
for (const marker of [
  'Then I would strip almost everything away.',
  'Use one square room that functions as a workshop, study, kitchen, and living space at the same time.',
]) {
  for (const path of walkFiles(distRoot)) {
    assert(!readFileSync(path).includes(marker), `Archived private source leaked into build: ${relative(distRoot, path)}`);
  }
}

console.log(
  'Little Workshop verified: flat two-character stage, progressively unlocked object drawer, repeat reactions without story advancement, 50 authored interactions, exact awareness boundaries, three valid placements through 48, strawberry choice at 49, Unicode name/stop at 50, and versioned browser-local semantic state.',
);
