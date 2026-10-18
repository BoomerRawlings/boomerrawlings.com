import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';
import { selectQuestions, shuffleChoices } from '../public/brain/midterm-engine.js';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const standard = await readJson('../public/brain/midterm-bank.json');
const visual = await readJson('../public/brain/visual-study-bank.json');
const bankSource = (await transform(await readFile(new URL('../src/scripts/brain/study-bank.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const { selectStudyBank, studyAvailability, flashcardProgressKey } = await import(`data:text/javascript;base64,${Buffer.from(bankSource).toString('base64')}`);
const rendererSource = (await transform(await readFile(new URL('../src/scripts/brain/study-visuals.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const { buildStudyVisual, projectStudyPoint, getStudyDirectionArrow, getStudyTractPath } = await import(`data:text/javascript;base64,${Buffer.from(rendererSource).toString('base64')}`);
const atlas = await readJson('../public/brain/models/study-wireframe.json');
const seeded = () => { let state = 9127; return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646; };
const labelFor = spec => spec.kind === 'region'
  ? ({ frontal: 'Frontal lobe', parietal: 'Parietal lobe', temporal: 'Temporal lobe', occipital: 'Occipital lobe', cerebellum: 'Cerebellum', 'basal-ganglia': 'Basal ganglia' })[spec.region]
  : spec.kind === 'direction' ? spec.direction[0].toUpperCase() + spec.direction.slice(1)
    : spec.kind === 'tract' ? `${spec.tract[0].toUpperCase()}${spec.tract.slice(1)} tract`
    : spec.kind === 'view' ? `${spec.view[0].toUpperCase()}${spec.view.slice(1)} view`
      : `${spec.plane[0].toUpperCase()}${spec.plane.slice(1)} plane`;

for (const course of ['105', '108']) {
  test(`${course}: basic wireframe items cover regions, directions, surfaces, section planes and tracts with source scope`, () => {
    const data = visual[course];
    const items = [...data.questions, ...data.flashcards];
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    for (const item of items) {
      assert.ok(item.visual && typeof item.visual === 'object', `${item.id}: missing wireframe specification`);
      assert.ok(['direct', 'supporting'].includes(item.grounding), `${item.id}: missing source scope`);
      assert.ok(item.sourceNote?.trim().length > 30, `${item.id}: missing source explanation`);
      if (item.grounding === 'supporting') assert.match(item.sourceNote, /supporting|not separately|not explicitly/i, `${item.id}: extra vocabulary must be identified`);
      if (course === '105') assert.ok(Number(item.topic.match(/^M(\d+)/)?.[1]) <= 10, `${item.id}: outside Modules 1–10`);
    }
    const specs = data.questions.map(question => question.visual);
    assert.deepEqual(new Set(specs.filter(spec => spec.kind === 'region').map(spec => spec.region)), new Set(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'basal-ganglia']));
    assert.deepEqual(new Set(specs.filter(spec => spec.kind === 'direction').map(spec => spec.direction)), new Set(['dorsal', 'ventral', 'rostral', 'caudal', 'superior', 'inferior', 'anterior', 'posterior', 'medial', 'lateral']));
    assert.deepEqual(new Set(specs.filter(spec => spec.kind === 'view').map(spec => spec.view)), new Set(['lateral', 'medial', 'superior', 'inferior']));
    assert.deepEqual(new Set(specs.filter(spec => spec.kind === 'plane').map(spec => spec.plane)), new Set(['sagittal', 'coronal', 'horizontal']));
    assert.deepEqual(new Set(specs.filter(spec => spec.kind === 'tract').map(spec => spec.tract)), new Set(['association', 'commissural', 'projection']));
    for (const question of data.questions) {
      assert.equal(question.kind, 'mcq');
      assert.equal(question.difficulty, 'foundation');
      assert.ok(question.prompt && question.explanation);
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, question.choices.length);
      assert.equal(question.choices[question.correctIndex], labelFor(question.visual), `${question.id}: target and answer differ`);
      assert.equal(question.choiceExplanations.length, question.choices.length);
      assert.equal(new Set(question.choiceExplanations).size, question.choices.length);
      for (const explanation of question.choiceExplanations) assert.ok(explanation.trim().length >= 60, `${question.id}: every option needs substantive feedback`);
      const card = data.flashcards.find(item => JSON.stringify(item.visual) === JSON.stringify(question.visual));
      assert.ok(card, `${question.id}: missing matching visual flashcard`);
      assert.equal(card.grounding, question.grounding);
      assert.equal(card.sourceNote, question.sourceNote);
      assert.ok(card.answer.startsWith(`${labelFor(question.visual)}.`), `${card.id}: answer does not identify the displayed target`);
      if (question.visual.kind === 'direction') {
        const synonymous = { dorsal: 'up', superior: 'up', ventral: 'down', inferior: 'down', rostral: 'front', anterior: 'front', caudal: 'back', posterior: 'back', medial: 'midline', lateral: 'away' };
        const meanings = question.choices.map(choice => synonymous[choice.toLowerCase()] ?? choice);
        assert.equal(new Set(meanings).size, meanings.length, `${question.id}: equivalent forebrain terms cannot be competing answers`);
      }
    }
  });

  test(`${course}: ordinary study excludes supporting vocabulary; wireframe focus includes the full visual deck`, () => {
    const before = JSON.stringify({ standard: standard[course], visual: visual[course] });
    const mixed = selectStudyBank(standard[course], visual[course], 'all');
    const focused = selectStudyBank(standard[course], visual[course], 'visual');
    for (const field of ['questions', 'flashcards']) {
      assert.deepEqual(mixed[field].map(item => item.id), [...standard[course][field], ...visual[course][field].filter(item => item.grounding === 'direct')].map(item => item.id));
      assert.deepEqual(focused[field].map(item => item.id), visual[course][field].map(item => item.id));
      assert.equal(mixed[field].some(item => item.grounding === 'supporting'), false);
      assert.ok(focused[field].some(item => item.grounding === 'supporting'));
      assert.equal(new Set(mixed[field].map(item => item.id)).size, mixed[field].length);
      assert.notEqual(focused[field], visual[course][field]);
    }
    const counts = studyAvailability(focused);
    assert.deepEqual(counts, { mixed: focused.questions.length, foundation: focused.questions.length, application: 0, challenge: 0 });
    for (const difficulty of ['mixed', 'foundation', 'application', 'challenge']) {
      const session = selectQuestions(focused.questions, { length: 'all', difficulty }, seeded());
      assert.equal(session.questions.length, counts[difficulty]);
      assert.equal(session.requested, counts[difficulty]);
      assert.equal(session.available, counts[difficulty]);
      assert.equal(session.capped, false);
      assert.equal(new Set(session.questions.map(question => question.id)).size, counts[difficulty]);
    }
    assert.equal(selectQuestions(focused.questions, { length: 10, difficulty: 'foundation' }, seeded()).questions.length, 10);
    const capped = selectQuestions(focused.questions, { length: 80, difficulty: 'foundation' }, seeded());
    assert.equal(capped.questions.length, focused.questions.length);
    assert.equal(capped.capped, true);
    assert.equal(JSON.stringify({ standard: standard[course], visual: visual[course] }), before, 'selection must not mutate authored source banks');
  });

  test(`${course}: visual targets, source scope, correct answers and option feedback survive shuffles and retries`, () => {
    const before = JSON.stringify(visual[course]);
    for (const question of visual[course].questions) {
      let retry = question;
      const random = seeded();
      for (let pass = 0; pass < 12; pass++) {
        retry = shuffleChoices(retry, random);
        assert.deepEqual(retry.visual, question.visual);
        assert.equal(retry.grounding, question.grounding);
        assert.equal(retry.sourceNote, question.sourceNote);
        assert.equal(retry.choices[retry.correctIndex], question.choices[question.correctIndex]);
        retry.choices.forEach((choice, index) => assert.equal(retry.choiceExplanations[index], question.choiceExplanations[question.choices.indexOf(choice)], `${question.id}: feedback detached from its option`));
      }
    }
    assert.equal(JSON.stringify(visual[course]), before);
  });
}

test('flashcard progress preserves existing course/scope decks and isolates focused visual practice', () => {
  const keys = [];
  for (const course of ['105', '108']) for (const scope of ['general', 'midterm-1']) {
    const oldKey = `brain-${scope === 'general' ? 'general' : 'midterm'}-flashcards-${course}-v1`;
    assert.equal(flashcardProgressKey(course, scope, 'all'), oldKey);
    const focusedKey = flashcardProgressKey(course, scope, 'visual');
    assert.notEqual(focusedKey, oldKey);
    keys.push(oldKey, focusedKey);
  }
  assert.equal(new Set(keys).size, keys.length, 'course, scope and focus cannot overwrite another deck’s progress');
});

test('all-question sessions include every eligible question even beyond the old 80-question maximum', () => {
  const questions = Array.from({ length: 103 }, (_, index) => ({ id: `q${index}`, topic: `Topic ${index % 7}`, difficulty: index % 3 === 0 ? 'challenge' : 'foundation', choices: ['A', 'B'], correctIndex: 0 }));
  const all = selectQuestions(questions, { length: 'all', difficulty: 'mixed' }, seeded());
  assert.equal(all.questions.length, 103);
  assert.equal(all.requested, 103);
  assert.equal(all.capped, false);
  const challenge = selectQuestions(questions, { length: 'all', difficulty: 'challenge' }, seeded());
  assert.equal(challenge.questions.length, questions.filter(question => question.difficulty === 'challenge').length);
  assert.equal(challenge.capped, false);
});

test('anatomical cameras preserve geometry and show expected orientation from each side', () => {
  const point = [17, 31, 59];
  for (const view of ['lateral', 'medial', 'superior', 'inferior', 'anterior', 'posterior', 'oblique']) {
    const projected = projectStudyPoint(point, view);
    assert.ok(projected.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...projected) - Math.hypot(...point)) < 1e-8, `${view}: projection distorts anatomical proportions`);
  }
  const anatomicalRight = [1, 0, 0], superior = [0, 1, 0], anterior = [0, 0, 1];
  assert.ok(projectStudyPoint(anterior, 'lateral')[0] < 0, 'left lateral brain faces screen-left');
  assert.ok(projectStudyPoint(superior, 'lateral')[1] > 0, 'superior remains screen-up');
  assert.ok(projectStudyPoint(anterior, 'medial')[0] > 0, 'inside surface of the left hemisphere reverses anterior on screen');
  assert.ok(projectStudyPoint(anterior, 'superior')[1] > 0, 'superior view places anterior at the top');
  assert.ok(projectStudyPoint(anatomicalRight, 'superior')[0] > 0);
  assert.ok(projectStudyPoint(anterior, 'inferior')[1] > 0);
  assert.ok(projectStudyPoint(anatomicalRight, 'inferior')[0] < 0, 'looking from below reverses the left/right screen mapping');
  assert.ok(projectStudyPoint(anatomicalRight, 'anterior')[0] < 0, 'front view faces the observer');
  assert.ok(projectStudyPoint(anatomicalRight, 'posterior')[0] > 0);
});

test('arrows follow human forebrain conventions and medial arrows approach the actual midline', () => {
  for (const [first, second] of [['dorsal', 'superior'], ['ventral', 'inferior'], ['rostral', 'anterior'], ['caudal', 'posterior']]) {
    assert.deepEqual(getStudyDirectionArrow(first), getStudyDirectionArrow(second));
  }
  for (const [positive, negative, axis] of [['superior', 'inferior', 1], ['anterior', 'posterior', 2]]) {
    const forward = getStudyDirectionArrow(positive), backward = getStudyDirectionArrow(negative);
    assert.ok(forward.to[axis] > forward.from[axis]);
    assert.deepEqual(forward.from, backward.to);
    assert.deepEqual(forward.to, backward.from);
  }
  const medial = getStudyDirectionArrow('medial'), lateral = getStudyDirectionArrow('lateral');
  assert.ok(Math.abs(medial.to[0]) < Math.abs(medial.from[0]), 'medial must point toward x=0');
  assert.ok(Math.abs(lateral.to[0]) > Math.abs(lateral.from[0]), 'lateral must point away from x=0');
  for (const { visual: spec } of visual['105'].questions.filter(question => question.visual.kind === 'direction')) {
    const arrow = getStudyDirectionArrow(spec.direction);
    const from = projectStudyPoint(arrow.from, spec.view), to = projectStudyPoint(arrow.to, spec.view);
    assert.ok(Math.hypot(to[0] - from[0], to[1] - from[1]) > 10, `${spec.direction}: arrow cannot point into the screen and disappear`);
  }
});

test('tract illustrations preserve the endpoint relationships that define each class', () => {
  for (const tract of ['association', 'commissural', 'projection']) {
    const points = getStudyTractPath(tract);
    assert.equal(points.length, 4, `${tract}: a cubic connection requires four points`);
    assert.ok(points.every(point => point.length === 3 && point.every(Number.isFinite)));
    assert.notDeepEqual(points[0], points[3], `${tract}: connection endpoints must differ`);
  }
  const association = getStudyTractPath('association');
  assert.ok(association.every(point => point[0] < 0), 'association pathway stays in one hemisphere');
  assert.ok(association[0][1] > 0 && association[3][1] > 0, 'association endpoints remain on cortex');
  const commissural = getStudyTractPath('commissural');
  assert.ok(commissural[0][0] < 0 && commissural[3][0] > 0, 'commissural pathway connects opposite hemispheres');
  const projection = getStudyTractPath('projection');
  assert.ok(projection[0][1] > 0 && projection[3][1] < -50, 'projection pathway connects cortex with a lower CNS level');
  const expected = { '108-q002': 'association', '108-q016': 'commissural', '108-q034': 'projection', '108-q035': 'projection' };
  for (const [id, tract] of Object.entries(expected)) {
    const question = standard['108'].questions.find(item => item.id === id);
    assert.equal(question.visual.kind, 'tract', `${id}: original tract question needs a diagram`);
    assert.equal(question.visual.tract, tract);
    assert.ok(question.explanation.toLowerCase().includes(tract), `${id}: picture must support the authored explanation`);
  }
  assert.deepEqual(standard['108'].flashcards.find(item => item.id === '108-f008').visual, { kind: 'tract', tract: 'projection' });
});

test('compressed atlas has valid mesh indexes and labeled cortical regions in both hemispheres', () => {
  assert.equal(atlas.version, 1);
  assert.deepEqual([atlas.metadata.coordinates.x, atlas.metadata.coordinates.y, atlas.metadata.coordinates.z], ['right', 'superior', 'anterior']);
  assert.ok(atlas.metadata.source && atlas.metadata.license);
  for (const mesh of atlas.meshes) {
    const positions = Buffer.from(mesh.positions, 'base64');
    const triangles = Buffer.from(mesh.triangles, 'base64');
    assert.equal(positions.length % 6, 0, `${mesh.id}: invalid XYZ vertex storage`);
    assert.equal(triangles.length % 6, 0, `${mesh.id}: invalid triangle storage`);
    assert.ok(positions.length > 0 && triangles.length > 0);
    for (let offset = 0; offset < triangles.length; offset += 2) assert.ok(triangles.readUInt16LE(offset) < positions.length / 6, `${mesh.id}: face references a missing vertex`);
    if (mesh.kind === 'shell') {
      const faceRegions = Buffer.from(mesh.faceRegions, 'base64');
      assert.equal(faceRegions.length, triangles.length / 6, `${mesh.id}: region labels must match face count`);
      assert.ok([...faceRegions].every(index => index < mesh.regions.length));
      for (const region of ['frontal', 'parietal', 'temporal', 'occipital']) {
        const index = mesh.regions.indexOf(`${region}-${mesh.hemisphere}`);
        assert.ok(index >= 0 && faceRegions.includes(index), `${mesh.id}: missing ${region} highlight geometry`);
      }
    }
  }
  assert.deepEqual(new Set(atlas.meshes.filter(mesh => mesh.kind === 'internal').map(mesh => mesh.id)), new Set(['caudate', 'putamen', 'globus-pallidus']));
});

test('every authored visual renders finite target geometry without printing the answer before reveal', () => {
  const diagrams = new Map();
  const authoredVisuals = [...Object.values(standard), ...Object.values(visual)]
    .flatMap(bank => [...bank.questions, ...bank.flashcards])
    .filter(item => item.visual && typeof item.visual === 'object');
  const uniqueVisuals = new Map(authoredVisuals.map(item => [JSON.stringify(item.visual), item]));
  for (const question of uniqueVisuals.values()) {
    const spec = question.visual;
    const hidden = buildStudyVisual(spec, atlas);
    const revealed = buildStudyVisual(spec, atlas, { revealed: true });
    assert.match(hidden, /<svg[^>]+role="img"/);
    assert.match(hidden, /aria-label="[^"]+"/);
    assert.doesNotMatch(hidden, /NaN|Infinity|undefined/);
    assert.equal(hidden.toLowerCase().includes(labelFor(spec).toLowerCase()), false, `${question.id}: illustration gives away the answer`);
    assert.ok(revealed.includes(labelFor(spec)), `${question.id}: revealed illustration should name its target`);
    assert.match(hidden, /<path class="study-mesh" d="M[^\"]+"/);
    if (spec.kind === 'region') assert.match(hidden, /<path class="study-highlight" d="M[^\"]+"/, `${question.id}: no highlighted surface`);
    if (spec.kind === 'direction') assert.match(hidden, /<path class="study-arrowhead" d="M[^\"]+"/, `${question.id}: missing arrowhead`);
    if (spec.kind === 'plane') {
      assert.match(hidden, /<polygon class="study-plane" points="[^\"]+"/);
      assert.match(hidden, /<path class="study-section" d="M[^\"]+"/, `${question.id}: no intersection with the brain`);
    }
    if (spec.kind === 'tract') {
      assert.match(hidden, /<path class="study-tract" d="M[^\"]+C[^\"]+"/);
      assert.equal((hidden.match(/<circle class="study-tract-endpoint"/g) || []).length, 2, `${question.id}: both connection endpoints must be visible`);
      assert.doesNotMatch(hidden, /<path class="study-arrowhead"/, 'a connection diagram must not imply a direction of signal flow');
    }
    diagrams.set(JSON.stringify(spec), hidden);
  }
  for (const kind of ['region', 'view', 'plane', 'tract']) {
    const picturesByTarget = new Map([...diagrams].filter(([spec]) => JSON.parse(spec).kind === kind).map(([spec, picture]) => [labelFor(JSON.parse(spec)), picture]));
    assert.equal(new Set(picturesByTarget.values()).size, picturesByTarget.size, `different ${kind} targets must not collapse to the same picture`);
  }
  const invalidAxes = { ...atlas, metadata: { ...atlas.metadata, coordinates: { ...atlas.metadata.coordinates, y: 'anterior', z: 'superior' } } };
  assert.throws(() => buildStudyVisual({ kind: 'view', view: 'lateral' }, invalidAxes), /coordinates/, 'do not silently swap superior and anterior');
});
