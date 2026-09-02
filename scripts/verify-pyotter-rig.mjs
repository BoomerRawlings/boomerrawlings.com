import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedCapabilities as expectedPairCapabilities,
  expectedMarkers,
  verifyInteractionContract
} from './verify-companion-interactions.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const rigRoot = join(projectRoot, 'src', 'assets', 'pyotter');
const specPath = join(rigRoot, 'rig-spec.json');

if (!existsSync(specPath)) throw new Error('Pyotter rig spec is missing');

const raw = readFileSync(specPath, 'utf8');
const spec = JSON.parse(raw);
const expectedDirections = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const expectedCanonicalViews = ['n', 'nw', 'w', 'sw', 's'];
const expectedActions = ['sit', 'walk', 'crawl', 'run', 'swim'];
const expectedExpressions = ['warm', 'curious', 'thoughtful', 'skeptical', 'concerned', 'resolute', 'delighted'];
const expectedFaceModes = {
  n: 'hidden',
  nw: 'back-three-quarter',
  w: 'profile',
  sw: 'front-three-quarter',
  s: 'front'
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
  actual.length === expected.length && expected.every((value) => actual.includes(value));
const sameSequence = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);

for (const requiredDocument of [spec.philosophy, spec.philosophySource, spec.persona, spec.personaSource, spec.relationship]) {
  if (!requiredDocument || !existsSync(join(rigRoot, requiredDocument))) {
    throw new Error(`Missing Pyotter doctrine source: ${requiredDocument ?? 'undefined'}`);
  }
  if (readFileSync(join(rigRoot, requiredDocument), 'utf8').trim().length === 0) {
    throw new Error(`Empty Pyotter doctrine source: ${requiredDocument}`);
  }
}

for (const [source, expectedHash] of [
  [spec.philosophySource, spec.philosophySourceSha256],
  [spec.personaSource, spec.personaSourceSha256]
]) {
  const actualHash = createHash('sha256').update(readFileSync(join(rigRoot, source))).digest('hex').toUpperCase();
  if (!expectedHash || actualHash !== expectedHash.toUpperCase()) {
    throw new Error(`Pyotter source hash mismatch: ${source}`);
  }
}

const character = spec.characterContract ?? {};
if (
  character.name !== 'Pyotter Kropotkin' ||
  character.fictionalCounterfactual !== true ||
  character.historicalAttributionAllowed !== false ||
  character.covertPersuasionAllowed !== false ||
  character.gameEconomyAllowed !== false ||
  character.politicalViolenceAllowed !== false
) {
  throw new Error('Pyotter character safety contract is incomplete');
}
if (!sameMembers(spec.expressionVocabulary ?? [], expectedExpressions)) {
  throw new Error('Pyotter expression vocabulary is incomplete');
}
if (
  spec.sharedStageScale?.unit !== 'designPx' ||
  spec.sharedStageScale?.nominalWidth !== 400 ||
  spec.sharedStageScale?.nominalHeight !== 560 ||
  spec.sharedStageScale?.bodyLengthPx !== 560
) {
  throw new Error('Pyotter shared-stage scale is invalid');
}

const protocol = spec.interactionProtocol ?? {};
const interactionContractPath = join(rigRoot, protocol.contract ?? '');
if (!protocol.contract || !existsSync(interactionContractPath)) {
  throw new Error('Pyotter shared interaction contract is missing');
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
  !sameMembers(Object.keys(protocol.capabilities ?? {}), expectedPairCapabilities) ||
  !sameMembers(Object.keys(interactionContract.capabilities ?? {}), expectedPairCapabilities)
) {
  throw new Error('Pyotter friendship interaction protocol is incomplete');
}
for (const attachment of Object.values(protocol.roles ?? {})) {
  if (!spec.attachments.includes(attachment)) throw new Error(`Unknown Pyotter interaction attachment: ${attachment}`);
}
for (const [capability, roles] of Object.entries(protocol.capabilities ?? {})) {
  if (!protocol.roles[roles.self] || !protocol.roles[roles.partner]) {
    throw new Error(`Unknown Pyotter interaction role in ${capability}`);
  }
  const shared = interactionContract.capabilities[capability];
  if (roles.self !== shared.selfRole || roles.partner !== shared.partnerRole) {
    throw new Error(`Pyotter role mapping conflicts with shared ${capability} contract`);
  }
}
if (
  protocol.cancelPose?.action !== 'sit' ||
  protocol.cancelPose?.direction !== 's' ||
  protocol.reducedMotionFallback !== 'static-contact' ||
  spec.constraints.rootMotionInClipAllowed !== false ||
  spec.constraints.reducedMotionFallback?.action !== 'sit' ||
  spec.constraints.reducedMotionFallback?.direction !== 's'
) {
  throw new Error('Pyotter cancellation, reduced-motion, or root-motion fallback is invalid');
}

if (!sameMembers(Object.keys(spec.directions), expectedDirections)) {
  throw new Error('Pyotter must resolve exactly eight directions');
}
if (!sameMembers(spec.canonicalViews, expectedCanonicalViews)) {
  throw new Error('Pyotter must author exactly five canonical views');
}
if (!sameMembers(Object.keys(spec.actions), expectedActions)) {
  throw new Error('Pyotter action set is incomplete');
}

for (const direction of expectedDirections) {
  const resolution = spec.directions[direction];
  if (!expectedCanonicalViews.includes(resolution.view) || typeof resolution.flipX !== 'boolean') {
    throw new Error(`Invalid direction resolver: ${direction}`);
  }
  const [view, flipX] = exactDirectionMap[direction];
  if (resolution.view !== view || resolution.flipX !== flipX) {
    throw new Error(`Incorrect Pyotter direction resolver: ${direction}`);
  }
}
if (!sameMembers(Object.keys(spec.viewProfiles ?? {}), expectedCanonicalViews)) {
  throw new Error('Pyotter direction visibility profiles are incomplete');
}

for (const action of expectedActions) {
  const coverage = spec.authoringCoverage[action] ?? [];
  if (!sameMembers(coverage, expectedCanonicalViews)) {
    throw new Error(`${action} does not cover every canonical view`);
  }
}

const boneIds = spec.bones.map(({ id }) => id);
const slotIds = spec.slots.map(({ id }) => id);
if (new Set(boneIds).size !== boneIds.length || new Set(slotIds).size !== slotIds.length) {
  throw new Error('Pyotter rig contains duplicate bone or slot ids');
}
if (spec.bones.filter(({ parent }) => parent === null).length !== 1 || !boneIds.includes('root')) {
  throw new Error('Pyotter rig must contain exactly one root');
}
const parents = new Map(spec.bones.map(({ id, parent }) => [id, parent]));
for (const bone of spec.bones) {
  if (bone.parent !== null && !parents.has(bone.parent)) {
    throw new Error(`Unknown parent bone: ${bone.parent}`);
  }
  const visited = new Set([bone.id]);
  let parent = bone.parent;
  while (parent !== null) {
    if (visited.has(parent)) throw new Error(`Pyotter bone cycle detected at ${bone.id}`);
    visited.add(parent);
    parent = parents.get(parent);
  }
}
for (const slot of spec.slots) {
  if (!boneIds.includes(slot.bone)) throw new Error(`Unknown slot bone: ${slot.bone}`);
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
    throw new Error(`Invalid Pyotter direction profile: ${view}`);
  }
}

for (const reference of spec.references) {
  if (!existsSync(join(rigRoot, reference))) throw new Error(`Missing reference art: ${reference}`);
}

const runtimeSlotValues = spec.slots.flatMap(({ id, variants = [] }) => [id, ...variants]);
if (runtimeSlotValues.some((value) => /rock/i.test(value)) || spec.constraints.defaultProp !== null) {
  throw new Error('Rock remains in the runtime slot or default-prop model');
}

const canonicalClipCount = expectedActions.length * expectedCanonicalViews.length;
const resolvedStateCount = expectedActions.length * expectedDirections.length;
console.log(`Pyotter pre-rig contract valid: ${canonicalClipCount} required action/view clips resolve to ${resolvedStateCount} eight-direction states; no runtime clips asserted.`);
