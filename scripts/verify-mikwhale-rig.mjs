import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedCapabilities, expectedMarkers, verifyInteractionContract } from './verify-companion-interactions.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const rigRoot = join(projectRoot, 'src', 'assets', 'mikwhale');
const pyotterRoot = join(projectRoot, 'src', 'assets', 'pyotter');
const specPath = join(rigRoot, 'rig-spec.json');
const pyotterSpecPath = join(pyotterRoot, 'rig-spec.json');

if (!existsSync(specPath)) throw new Error('Mikwhale rig spec is missing');
if (!existsSync(pyotterSpecPath)) throw new Error('Pyotter parity spec is missing');

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const pyotter = JSON.parse(readFileSync(pyotterSpecPath, 'utf8'));
const expectedDirections = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const expectedCanonicalViews = ['n', 'nw', 'w', 'sw', 's'];
const expectedActions = ['sit', 'walk', 'crawl', 'run', 'swim'];
const expectedExpressions = [
  'warm',
  'curious',
  'thoughtful',
  'skeptical',
  'concerned',
  'resolute',
  'delighted',
  'defiant',
  'tender',
  'sheepish'
];
const expectedFaceModes = {
  n: 'hidden',
  nw: 'back-three-quarter',
  w: 'profile',
  sw: 'front-three-quarter',
  s: 'front'
};
const expectedVisualTraits = [
  'high-receding-bald-crown',
  'visible-blowhole',
  'wild-dark-side-curls',
  'massive-untamed-beard',
  'curled-moustache',
  'heavy-expressive-brows',
  'intense-kind-eyes',
  'centered-charcoal-cravat',
  'pectoral-fins',
  'paired-whale-flukes'
];
const expectedActionContracts = {
  sit: ['float-rest', 'resting', 2000, 12, 24, 0],
  walk: ['gentle-paddle', 'paddling', 667, 12, 8, 0.8],
  crawl: ['near-bottom-sneak', 'lowGlide', 1000, 12, 12, 0.35],
  run: ['burst-dash', 'sprint', 500, 16, 8, 2],
  swim: ['relaxed-cruise', 'streamlined', 1000, 12, 12, 1.1]
};
const exactDirectionMap = {
  n: ['n', false],
  ne: ['nw', true],
  e: ['w', true],
  se: ['sw', true],
  s: ['s', false],
  sw: ['sw', false],
  w: ['w', false],
  nw: ['nw', false]
};

const sameMembers = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && expected.every((value) => actual.includes(value));
const sameSequence = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();

for (const requiredDocument of [
  spec.productDoctrine,
  spec.philosophy,
  spec.philosophySource,
  spec.persona,
  spec.relationship
]) {
  const path = join(rigRoot, requiredDocument ?? '');
  if (!requiredDocument || !existsSync(path)) throw new Error(`Missing Mikwhale doctrine source: ${requiredDocument ?? 'undefined'}`);
  if (readFileSync(path, 'utf8').trim().length === 0) throw new Error(`Empty Mikwhale doctrine source: ${requiredDocument}`);
}
if (hashFile(join(rigRoot, spec.philosophySource)) !== spec.philosophySourceSha256?.toUpperCase()) {
  throw new Error('Mikwhale philosophy source hash mismatch');
}

const character = spec.characterContract ?? {};
for (const falseFlag of [
  'historicalAttributionAllowed',
  'covertPersuasionAllowed',
  'gameEconomyAllowed',
  'politicalViolenceAllowed',
  'bigotryAllowed',
  'subordinatePropAllowed'
]) {
  if (character[falseFlag] !== false) throw new Error(`Mikwhale character guardrail missing: ${falseFlag}`);
}
if (character.name !== 'Mikwhale Bakunin' || character.fictionalCounterfactual !== true) {
  throw new Error('Mikwhale fictional identity contract is incomplete');
}
if (
  spec.visualIdentity?.species !== 'baby-beluga-inspired pocket whale' ||
  !sameMembers(spec.visualIdentity?.requiredTraits, expectedVisualTraits) ||
  !spec.visualIdentity?.forbiddenTraits?.includes('glasses')
) {
  throw new Error('Mikwhale Bakunin likeness contract is incomplete');
}
if (!sameMembers(spec.expressionVocabulary, expectedExpressions)) {
  throw new Error('Mikwhale expression vocabulary is incomplete');
}
if (
  pyotter.sharedStageScale?.unit !== 'designPx' ||
  spec.sharedStageScale?.unit !== 'designPx' ||
  spec.sharedStageScale?.nominalWidth / pyotter.sharedStageScale?.nominalWidth !== 1.3 ||
  spec.sharedStageScale?.nominalHeight / pyotter.sharedStageScale?.nominalHeight !== 1.15 ||
  spec.sharedStageScale?.bodyLengthPx !== spec.sharedStageScale?.nominalHeight
) {
  throw new Error('Mikwhale shared-stage scale does not preserve duo proportions');
}

if (spec.stage !== 'pre-rig' || spec.medium !== 'water') throw new Error('Mikwhale must remain a water pre-rig');
if (!sameMembers(Object.keys(spec.directions ?? {}), expectedDirections)) throw new Error('Mikwhale must resolve exactly eight directions');
if (!sameMembers(spec.canonicalViews, expectedCanonicalViews)) throw new Error('Mikwhale must author exactly five canonical views');
for (const [direction, [view, flipX]] of Object.entries(exactDirectionMap)) {
  if (spec.directions[direction]?.view !== view || spec.directions[direction]?.flipX !== flipX) {
    throw new Error(`Incorrect Mikwhale direction resolver: ${direction}`);
  }
}

if (!sameMembers(Object.keys(spec.actions ?? {}), expectedActions)) throw new Error('Mikwhale action set is incomplete');
for (const action of expectedActions) {
  const contract = spec.actions[action];
  const [semantic, posture, durationMs, fps, frameCount, speed] = expectedActionContracts[action];
  if (
    contract.semantic !== semantic ||
    contract.posture !== posture ||
    contract.loop !== true ||
    contract.durationMs !== durationMs ||
    contract.fps !== fps ||
    contract.frameCount !== frameCount ||
    contract.speedBodyLengthsPerSecond !== speed
  ) {
    throw new Error(`Invalid Mikwhale action contract: ${action}`);
  }
  if (!sameMembers(spec.authoringCoverage?.[action], expectedCanonicalViews)) {
    throw new Error(`${action} does not cover every Mikwhale canonical view`);
  }
  const pyotterAction = pyotter.actions?.[action];
  if (
    pyotterAction?.durationMs !== durationMs ||
    pyotterAction?.fps !== fps ||
    pyotterAction?.speedBodyLengthsPerSecond !== speed
  ) {
    throw new Error(`Mikwhale lacks timing parity with Pyotter: ${action}`);
  }
}
if (!sameMembers(spec.channels, pyotter.channels)) throw new Error('Mikwhale animation channels do not match Pyotter');
if (!sameMembers(Object.keys(spec.viewProfiles ?? {}), expectedCanonicalViews)) {
  throw new Error('Mikwhale direction visibility profiles are incomplete');
}

const boneIds = spec.bones.map(({ id }) => id);
const slotIds = spec.slots.map(({ id }) => id);
if (new Set(boneIds).size !== boneIds.length || new Set(slotIds).size !== slotIds.length) {
  throw new Error('Mikwhale rig contains duplicate bone or slot ids');
}
if (spec.bones.filter(({ parent }) => parent === null).length !== 1 || !boneIds.includes('root')) {
  throw new Error('Mikwhale rig must contain exactly one root');
}
const parents = new Map(spec.bones.map(({ id, parent }) => [id, parent]));
for (const bone of spec.bones) {
  if (bone.parent !== null && !parents.has(bone.parent)) throw new Error(`Unknown Mikwhale parent bone: ${bone.parent}`);
  const visited = new Set([bone.id]);
  let parent = bone.parent;
  while (parent !== null) {
    if (visited.has(parent)) throw new Error(`Mikwhale bone cycle detected at ${bone.id}`);
    visited.add(parent);
    parent = parents.get(parent);
  }
}
for (const slot of spec.slots) {
  if (!boneIds.includes(slot.bone)) throw new Error(`Unknown Mikwhale slot bone: ${slot.bone}`);
}
for (const view of expectedCanonicalViews) {
  const profile = spec.viewProfiles[view];
  if (
    profile.faceMode !== expectedFaceModes[view] ||
    !Array.isArray(profile.hiddenSlots) ||
    new Set(profile.hiddenSlots).size !== profile.hiddenSlots.length ||
    profile.hiddenSlots.some((slot) => !slotIds.includes(slot)) ||
    !boneIds.includes(profile.farLimb) ||
    !boneIds.includes(profile.nearLimb) ||
    profile.farLimb === profile.nearLimb
  ) {
    throw new Error(`Invalid Mikwhale direction profile: ${view}`);
  }
}
if (
  !spec.viewProfiles.n.hiddenSlots.includes('bellyPatch') ||
  !spec.viewProfiles.nw.hiddenSlots.includes('bellyPatch') ||
  !spec.viewProfiles.s.hiddenSlots.includes('dorsalRidge') ||
  !spec.viewProfiles.sw.hiddenSlots.includes('dorsalRidge')
) {
  throw new Error('Mikwhale front/back anatomical visibility is invalid');
}
const bodyVariants = spec.slots.find(({ id }) => id === 'bodyBase')?.variants ?? [];
for (const action of expectedActions) {
  if (!bodyVariants.includes(spec.actions[action].posture)) throw new Error(`Missing Mikwhale posture art: ${spec.actions[action].posture}`);
}

for (const field of ['attachments', 'hitAreas']) {
  if (!Array.isArray(spec[field]) || new Set(spec[field]).size !== spec[field].length) {
    throw new Error(`Mikwhale ${field} must be unique`);
  }
}
const protocol = spec.interactionProtocol ?? {};
const interactionContractPath = join(rigRoot, protocol.contract ?? '');
if (!protocol.contract || !existsSync(interactionContractPath)) {
  throw new Error('Mikwhale shared interaction contract is missing');
}
const interactionContract = JSON.parse(readFileSync(interactionContractPath, 'utf8'));
verifyInteractionContract(interactionContract);
if (
  protocol.version !== 1 ||
  protocol.phaseUnit !== 'normalized' ||
  protocol.rootMotion !== 'external' ||
  protocol.attachmentCoordinatesStatus !== 'required-with-production-layers' ||
  !sameSequence(protocol.markerOrder, expectedMarkers) ||
  !sameSequence(interactionContract.markerOrder, expectedMarkers) ||
  !sameMembers(Object.keys(protocol.capabilities ?? {}), expectedCapabilities) ||
  !sameMembers(Object.keys(interactionContract.capabilities ?? {}), expectedCapabilities)
) {
  throw new Error('Mikwhale friendship interaction protocol is incomplete');
}
for (const attachment of Object.values(protocol.roles ?? {})) {
  if (!spec.attachments.includes(attachment)) throw new Error(`Unknown Mikwhale interaction attachment: ${attachment}`);
}
for (const [capability, roles] of Object.entries(protocol.capabilities ?? {})) {
  if (!protocol.roles[roles.self] || !protocol.roles[roles.partner]) {
    throw new Error(`Unknown Mikwhale interaction role in ${capability}`);
  }
  const shared = interactionContract.capabilities[capability];
  if (roles.self !== shared.selfRole || roles.partner !== shared.partnerRole) {
    throw new Error(`Mikwhale role mapping conflicts with shared ${capability} contract`);
  }
}
if (
  protocol.version !== pyotter.interactionProtocol?.version ||
  protocol.contract !== pyotter.interactionProtocol?.contract ||
  !sameSequence(protocol.markerOrder, pyotter.interactionProtocol?.markerOrder) ||
  !sameMembers(Object.keys(protocol.capabilities), Object.keys(pyotter.interactionProtocol?.capabilities ?? {})) ||
  resolve(rigRoot, spec.relationship) !== resolve(pyotterRoot, pyotter.relationship)
) {
  throw new Error('Mikwhale and Pyotter do not share one friendship protocol');
}
if (
  protocol.cancelPose?.action !== 'sit' ||
  protocol.cancelPose?.direction !== 's' ||
  protocol.reducedMotionFallback !== 'static-contact' ||
  spec.constraints.reducedMotionFallback?.action !== 'sit' ||
  spec.constraints.reducedMotionFallback?.direction !== 's'
) {
  throw new Error('Mikwhale cancellation or reduced-motion fallback is invalid');
}

const constraints = spec.constraints ?? {};
if (
  constraints.defaultProp !== null ||
  constraints.mirrorAtRootOnly !== true ||
  constraints.normalizeDiagonalVelocity !== true ||
  constraints.preservePhaseOnDirectionChange !== true ||
  constraints.tailStrokeAxis !== 'dorsoventral' ||
  constraints.landLocomotionAllowed !== false ||
  constraints.flippersUsedAsFeet !== false ||
  constraints.rootMotionInClipAllowed !== false
) {
  throw new Error('Mikwhale whale-motion constraints are incomplete');
}
if (parents.get('cravat') !== 'body') throw new Error('Mikwhale cravat must follow the body, not head rotation');
const runtimeSlotValues = spec.slots.flatMap(({ id, variants = [] }) => [id, ...variants]);
if (runtimeSlotValues.some((value) => /rock|glasses|paw|hindleg/i.test(value))) {
  throw new Error('Mikwhale contains a forbidden prop, accessory, or land-anatomy slot');
}

for (const reference of spec.references ?? []) {
  const path = join(rigRoot, reference);
  if (!existsSync(path)) throw new Error(`Missing Mikwhale reference art: ${reference}`);
  if (hashFile(path) !== spec.referenceSha256?.[reference]?.toUpperCase()) {
    throw new Error(`Mikwhale reference hash mismatch: ${reference}`);
  }
}
const master = readFileSync(join(rigRoot, 'reference', 'mikwhale-master-transparent.png'));
if (master.toString('ascii', 1, 4) !== 'PNG' || ![4, 6].includes(master[25])) {
  throw new Error('Mikwhale master must be a transparent PNG');
}

const canonicalClipCount = expectedActions.length * expectedCanonicalViews.length;
const resolvedStateCount = expectedActions.length * expectedDirections.length;
console.log(
  `Mikwhale pre-rig contract valid: ${canonicalClipCount} required action/view clips resolve to ${resolvedStateCount} eight-direction states with Pyotter contract parity; no runtime clips asserted.`
);
