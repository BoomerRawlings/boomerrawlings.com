import test from 'node:test';
import assert from 'node:assert/strict';
import { courses, courseById, chapterById, courseTopicIds } from '../public/brain/courses.js';
import { topics } from '../public/brain/curriculum.js';

// Independent TOC/page manifest, checked against the supplied editions.
// Ward: printed pp. 1–450 (PDF indices 13–462).
// Reisberg: EPUB chapter headings and page-list anchors, printed pp. 2–572.
const manifest = {
  '105': [
    ['The Science of the Mind', 2, 23],
    ['The Neural Basis for Cognition', 24, 60],
    ['Visual Perception', 62, 101],
    ['Recognizing Objects', 102, 141],
    ['Paying Attention', 142, 184],
    ['The Acquisition of Memories and the Working-Memory System', 186, 225],
    ['The Many Types of Memory', 226, 263],
    ['Remembering Complex Events', 264, 304],
    ['Concepts and Generic Knowledge', 306, 341],
    ['Language', 342, 383],
    ['Visual Knowledge', 384, 426],
    ['Judgment and Reasoning', 428, 471],
    ['Problem Solving and Creativity', 472, 503],
    ['Intelligence', 504, 533],
    ['Conscious Thought, Unconscious Thought', 534, 572],
  ],
  '108': [
    ['Introducing cognitive neuroscience', 1, 18],
    ['Introducing the brain', 19, 34],
    ['The electrophysiological brain', 35, 54],
    ['The imaged brain', 55, 86],
    ['The lesioned brain and stimulated brain', 87, 114],
    ['The developing brain', 115, 142],
    ['The seeing brain', 143, 174],
    ['The hearing brain', 175, 202],
    ['The attending brain', 203, 232],
    ['The acting brain', 233, 264],
    ['The remembering brain', 265, 298],
    ['The speaking brain', 299, 330],
    ['The literate brain', 331, 358],
    ['The numerate brain', 359, 384],
    ['The executive brain', 385, 414],
    ['The social and emotional brain', 415, 450],
  ],
};
const topicIds = new Set(topics.map(topic => topic.id));
const allChapters = courses.flatMap(course => course.chapters);
const words = value => value.trim().split(/\s+/).length;
function text(value, context, minimum = 1) {
  assert.equal(typeof value, 'string', context + ': expected text');
  assert.equal(value, value.trim(), context + ': unexpected surrounding whitespace');
  assert.ok(words(value) >= minimum && value.length > 0, context + ': missing substantive content');
  assert.ok(!/<\/?[a-z][^>]*>/i.test(value), context + ': HTML in plain study content');
  assert.ok(!/\b(TODO|TBD|placeholder|coming soon)\b/i.test(value), context + ': unfinished content');
}

test('Both official course names retain every chapter from the supplied textbook editions', () => {
  assert.deepEqual(courses.map(course => [course.id, course.code, course.title]), [
    ['105', 'PSYC 105', 'Cognitive Psychology'],
    ['108', 'PSYC 108', 'Cognitive Neuroscience'],
  ]);
  assert.deepEqual(Object.keys(courseById).sort(), ['105', '108']);
  assert.equal(allChapters.length, 31);
  assert.equal(new Set(allChapters.map(chapter => chapter.id)).size, 31);
  assert.equal(Object.keys(chapterById).length, 31);
  for (const course of courses) {
    assert.equal(courseById[course.id], course);
    assert.deepEqual(course.chapters.map(chapter => [chapter.title, ...chapter.pages]), manifest[course.id]);
    for (let index = 0; index < course.chapters.length; index++) {
      const chapter = course.chapters[index];
      assert.equal(chapter.number, index + 1);
      assert.equal(chapter.id, course.id + '-ch' + chapter.number);
      assert.equal(chapter.courseId, course.id);
      assert.equal(chapterById[chapter.id], chapter);
      assert.ok(chapter.pages.every(Number.isSafeInteger));
      assert.ok(chapter.pages[1] >= chapter.pages[0]);
      if (index) assert.ok(chapter.pages[0] > course.chapters[index - 1].pages[1], chapter.id + ': overlapping page spans');
    }
  }
});

test('Textbook provenance distinguishes chapter organization from an unverified lecture schedule', () => {
  assert.equal(courseById['105'].book.author, 'Daniel Reisberg');
  assert.equal(courseById['105'].book.edition, 8);
  assert.equal(courseById['105'].book.year, 2022);
  assert.equal(courseById['108'].book.author, 'Jamie Ward');
  assert.equal(courseById['108'].book.edition, 4);
  assert.equal(courseById['108'].book.year, 2020);
  for (const course of courses) {
    assert.equal(course.catalogUrl, 'https://catalog.ucsd.edu/courses/PSYC.html');
    text(course.book.title, course.id + ': book title');
    assert.equal(new URL(course.book.url).protocol, 'https:');
    assert.ok(/not a verified lecture schedule/.test(course.mappingNote));
    assert.equal(course.lectures, undefined, 'No supplied syllabus: do not invent a lecture order');
    for (const chapter of course.chapters) assert.equal(chapter.lectureNumber, undefined);
  }
});

test('Every chapter provides finite original study material and hidden-answer retrieval content', () => {
  const prompts = new Set();
  let retrievalCount = 0;
  for (const chapter of allChapters) {
    text(chapter.overview, chapter.id + ': overview', 20);
    assert.ok(chapter.ideas.length >= 3, chapter.id + ': too few explained core ideas');
    assert.equal(new Set(chapter.ideas.map(idea => idea.title)).size, chapter.ideas.length);
    for (const idea of chapter.ideas) {
      text(idea.title, chapter.id + ': idea title');
      text(idea.explanation, chapter.id + ': idea explanation', 10);
    }
    assert.ok(chapter.misconceptions.length >= 1);
    for (const misconception of chapter.misconceptions) {
      text(misconception.claim, chapter.id + ': misconception', 5);
      text(misconception.correction, chapter.id + ': correction', 12);
      assert.notEqual(misconception.claim, misconception.correction);
    }
    assert.ok(chapter.questions.length >= 2, chapter.id + ': missing retrieval practice');
    for (const question of chapter.questions) {
      text(question.prompt, chapter.id + ': retrieval prompt', 5);
      text(question.answer, chapter.id + ': answer explanation', 12);
      assert.notEqual(question.prompt, question.answer);
      assert.ok(!prompts.has(question.prompt), chapter.id + ': duplicated retrieval prompt');
      prompts.add(question.prompt);
      retrievalCount++;
    }
  }
  assert.ok(retrievalCount >= 62);
});

test('Linked models are canonical and explicitly described as supporting material', () => {
  for (const course of courses) {
    assert.equal(new Set(course.backgroundTopicIds).size, course.backgroundTopicIds.length);
    for (const id of course.backgroundTopicIds) assert.ok(topicIds.has(id), course.id + ': invalid background model ' + id);
    for (const chapter of course.chapters) {
      assert.equal(new Set(chapter.topicIds).size, chapter.topicIds.length, chapter.id + ': duplicated model');
      for (const id of chapter.topicIds) assert.ok(topicIds.has(id), chapter.id + ': nonexistent model ' + id);
      if (chapter.topicIds.length) text(chapter.modelNote, chapter.id + ': missing explanation of model coverage', 7);
    }
  }
  assert.deepEqual(courseById['105'].backgroundTopicIds, []);
  assert.ok(courseById['108'].backgroundTopicIds.includes('nmda'));
  assert.ok(!chapterById['108-ch2'].topicIds.includes('nmda'), 'Detailed receptors are supplemental biology, not Ward chapter 2 coverage');
  assert.ok(chapterById['108-ch7'].topicIds.includes('optic-radiation'));
  assert.ok(chapterById['108-ch10'].topicIds.includes('corticospinal'));
  assert.ok(chapterById['108-ch11'].topicIds.includes('hippocampal-circuit'));
});

test('Notes-only cognition chapters remain populated without mislabeling a prior model as their illustration', () => {
  for (const id of ['105-ch4', '105-ch5', '105-ch9', '105-ch10', '105-ch11', '105-ch12', '105-ch13', '105-ch14', '108-ch13', '108-ch14']) {
    const chapter = chapterById[id];
    assert.deepEqual(chapter.topicIds, [], id + ': unrelated model must not be fabricated for this chapter');
    assert.ok(chapter.ideas.length >= 3 && chapter.questions.length >= 2, id + ': notes-only chapter is an empty catalog entry');
  }
});

test('Course filtering includes repeated chapter models once, tolerates invalid saved scopes and returns independent arrays', () => {
  const expected = course => [...new Set([...course.chapters.flatMap(chapter => chapter.topicIds), ...course.backgroundTopicIds])];
  for (const course of courses) {
    const first = courseTopicIds(course.id);
    assert.deepEqual(first, expected(course));
    assert.equal(new Set(first).size, first.length);
    first.splice(0, first.length, 'not-a-model');
    assert.deepEqual(courseTopicIds(course.id), expected(course), course.id + ': caller mutated permanent scope');
  }
  assert.equal(courseTopicIds('105').length, 19);
  assert.deepEqual([...courseTopicIds('108')].sort(), [...topicIds].sort());
  for (const invalid of ['all', 'unknown', '__proto__', 'constructor', '', null, undefined]) assert.deepEqual(courseTopicIds(invalid), []);
});

test('Methods and systems notes retain essential scientific distinctions', () => {
  assert.match(chapterById['108-ch3'].misconceptions[0].correction, /postsynaptic currents/);
  assert.match(chapterById['108-ch4'].misconceptions[0].correction, /correlational/);
  assert.match(chapterById['108-ch7'].misconceptions[0].correction, /opposite visual field from both eyes/);
  assert.match(chapterById['108-ch11'].misconceptions[0].correction, /form of synaptic change/);
  assert.match(chapterById['105-ch14'].misconceptions[0].correction, /Within-population heritability/);
  assert.match(chapterById['105-ch15'].questions[1].answer, /theoretical account/);
});
