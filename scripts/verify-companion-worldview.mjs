import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const companionsRoot = join(projectRoot, 'src', 'assets', 'companions');
const pyotterRoot = join(projectRoot, 'src', 'assets', 'pyotter');
const mikwhaleRoot = join(projectRoot, 'src', 'assets', 'mikwhale');
const pyotter = JSON.parse(readFileSync(join(pyotterRoot, 'rig-spec.json'), 'utf8'));
const mikwhale = JSON.parse(readFileSync(join(mikwhaleRoot, 'rig-spec.json'), 'utf8'));

const sameSequence = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
const sameMembers = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && expected.every((value) => actual.includes(value));
const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();

const pyotterContractPath = resolve(pyotterRoot, pyotter.worldviewContract ?? '');
const mikwhaleContractPath = resolve(mikwhaleRoot, mikwhale.worldviewContract ?? '');
if (!pyotter.worldviewContract || !mikwhale.worldviewContract || pyotterContractPath !== mikwhaleContractPath) {
  throw new Error('Pyotter and Mikwhale must resolve to one shared worldview contract');
}
if (!existsSync(pyotterContractPath)) throw new Error('Shared worldview contract is missing');

const spec = JSON.parse(readFileSync(pyotterContractPath, 'utf8'));
if (
  spec.id !== 'pyotter-mikwhale-worldview' ||
  spec.version !== 1 ||
  spec.stage !== 'editorial-contract' ||
  spec.purpose !== 'performative-philosophical-artifact'
) {
  throw new Error('Shared worldview identity is invalid');
}

for (const field of ['productDoctrine', 'doctrine', 'source', 'relationship']) {
  const path = resolve(companionsRoot, spec[field] ?? '');
  if (!spec[field] || !existsSync(path) || readFileSync(path, 'utf8').trim().length === 0) {
    throw new Error(`Shared worldview ${field} is missing or empty`);
  }
}
if (hashFile(resolve(companionsRoot, spec.source)) !== spec.sourceSha256?.toUpperCase()) {
  throw new Error('Shared worldview source hash mismatch');
}
if (
  resolve(pyotterRoot, pyotter.productDoctrine ?? '') !== resolve(companionsRoot, spec.productDoctrine) ||
  resolve(mikwhaleRoot, mikwhale.productDoctrine ?? '') !== resolve(companionsRoot, spec.productDoctrine)
) {
  throw new Error('Both characters must share the worldview product doctrine');
}
if (
  resolve(pyotterRoot, pyotter.relationship ?? '') !== resolve(companionsRoot, spec.relationship) ||
  resolve(mikwhaleRoot, mikwhale.relationship ?? '') !== resolve(companionsRoot, spec.relationship)
) {
  throw new Error('Both characters must share the worldview relationship contract');
}

const surface = spec.surface ?? {};
if (
  surface.mode !== 'enacted-not-explained' ||
  !sameSequence(surface.deliveryOrder, [
    'world-affordance',
    'character-instinct-and-action',
    'bailey-observation',
    'optional-bailey-intervention',
    'character-response-if-needed',
    'persistent-consequence',
    'optional-short-line'
  ]) ||
  surface.explicitOverlayLabelsAllowed !== false ||
  surface.manifestoAllowed !== false ||
  surface.sameConclusionRequired !== false
) {
  throw new Error('Enacted-not-explained surface contract is incomplete');
}

const participant = spec.participant ?? {};
if (
  participant.roleId !== 'bailey' ||
  participant.schemaRole !== 'friend' ||
  participant.displayName !== 'Bailey' ||
  !sameSequence(participant.perspectives, ['observer', 'narrator', 'actor']) ||
  participant.primaryRole !== 'observer' ||
  participant.defaultParticipation !== 'watch-without-required-input' ||
  participant.narrationSource !== 'encountered-scenes-actions-and-bailey-authored-notes' ||
  participant.gameAuthoredInteriorConclusionsAllowed !== false ||
  participant.gameAuthoredFirstPersonLanguageAllowed !== false ||
  participant.actionRequiredPerScene !== false ||
  participant.observationCompleteWithoutIntervention !== true ||
  participant.chosenInterventionMustBeConsequential !== true ||
  participant.revisionRefusalAndUndoRequired !== true
) {
  throw new Error('Bailey observer/narrator/actor contract is incomplete');
}
if (spec.authorialGrammar !== 'distributed-capability-with-real-exit') {
  throw new Error('Creator-authored worldview grammar is invalid');
}

const expressions = spec.characterExpressions ?? {};
if (
  expressions.pyotter?.lens !== 'abundance-through-mutual-aid' ||
  expressions.mikwhale?.lens !== 'capability-through-refusal' ||
  !expressions.pyotter.primaryQuestion ||
  !expressions.mikwhale.primaryQuestion ||
  expressions.pyotter.primaryQuestion === expressions.mikwhale.primaryQuestion ||
  !sameMembers(expressions.pyotter.motifs, ['copy', 'teach', 'share', 'automate-drudgery', 'repair', 'common-tools']) ||
  !sameMembers(expressions.mikwhale.motifs, ['off-switch', 'second-route', 'local-copy', 'manual-fallback', 'interoperate', 'exit'])
) {
  throw new Error('Character worldview expressions are incomplete or insufficiently distinct');
}

const expectedWorldRules = [
  'capability-diffusion',
  'abundance-with-distribution',
  'human-worth-beyond-labor',
  'bounded-reversible-experimentation',
  'parallel-learning',
  'anti-monoculture-resilience',
  'personal-tool-control',
  'technological-pluralism',
  'specific-risk-analysis',
  'future-optionality'
];
if (!sameMembers(spec.worldRules, expectedWorldRules)) throw new Error('Shared worldview rules are incomplete');
if (spec.runtimeAi?.implemented !== false || spec.runtimeAi?.claimsAllowed !== false) {
  throw new Error('Worldview contract overstates runtime AI capability');
}
if (pyotter.characterContract?.covertPersuasionAllowed !== false || mikwhale.characterContract?.covertPersuasionAllowed !== false) {
  throw new Error('Character contract drifted from enacted fictional worldview into persuasion');
}

const sourceMarkers = [
  '# HIDDEN ACCELERATIONIST AI OVERLAY',
  'This is a deeply accelerationist worldview disguised as egalitarianism.',
  'The accelerationism exists almost entirely in the implications.'
];
const distRoot = join(projectRoot, 'dist');
const findSourceLeak = (directory) => {
  if (!existsSync(directory)) return null;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      const nested = findSourceLeak(path);
      if (nested) return nested;
    } else {
      const contents = readFileSync(path);
      if (sourceMarkers.some((marker) => contents.includes(marker))) return path;
    }
  }
  return null;
};
const leakedPath = findSourceLeak(distRoot);
if (leakedPath) throw new Error(`Internal worldview source leaked into the public build: ${leakedPath}`);

console.log('Shared pre-runtime worldview contract valid: Pyotter expresses abundance, Mikwhale expresses exit, and Bailey is primarily an observer with optional consequential action; no runtime behavior asserted.');
