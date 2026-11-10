import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCourseCode, normalizeCourse, fetchCourse, meetingKey, bookingRoutes }
  from './refresh-roomie-courses.mjs';

// Public catalog package associations captured 2026-11-10; unused fields omitted.
// Keep tests independent of live catalog changes and locally enriched metadata.
const metadata = {
  term: 'WI27', academicYear: '2026', academicPeriod: '3',
  courses: { 'ECON-100A': { moduleId: null, sections: {} } },
};
const section = (id, code, type, packages, instructors = ['Listed instructor'], meetings = []) => ({
  section_id: id, section_code: code, instruction_type_name: type,
  event_package_ids: packages, instructors, meetings, seats_available: 10,
});
const course = (code, types, sections) => ({
  term_code: 'WI27', module_code: code, instruction_types: types,
  section_count: sections.length, instructors: ['Course-level instructor'], sections,
});
const econ100 = course('ECON-100A', ['lecture', 'discussion'], [
  section('E 00007898', '001-000-LE', 'lecture', ['167237', '167238'], ['Listed instructor'], [
    { meeting_kind: 'class', day_code: 'T', specific_date: null, start_time_display: '8:00am', end_time_display: '9:20am' },
    { meeting_kind: 'final', day_code: 'S', specific_date: '2027-03-13', start_time_display: '8:00am', end_time_display: '10:59am' },
  ]),
  section('E 00007923', '001-001-DI', 'discussion', ['160176', '167237']),
  section('E 00007924', '001-002-DI', 'discussion', ['160177', '167238']),
  section('E 00007899', '002-000-LE', 'lecture', ['167239', '167240']),
  section('E 00007926', '002-001-DI', 'discussion', ['167239']),
  section('E 00007925', '002-002-DI', 'discussion', ['160213', '167240']),
]);
const econ120 = course('ECON-120A', ['lecture', 'discussion'], [
  section('E 00007961', '001-000-LE', 'lecture', ['160267', '167365', '167366']),
  section('E 00007938', '001-001-DI', 'discussion', ['160179', '167365']),
  section('E 00007939', '001-002-DI', 'discussion', ['160180', '167366']),
  section('E 00007962', '002-000-LE', 'lecture', ['154076', '160238', '167367', '167368']),
  section('E 00007940', '002-001-DI', 'discussion', ['160183', '167367']),
  section('E 00007964', '002-002-DI', 'discussion', ['167368']),
  section('E 00007963', '003-000-LE', 'lecture', ['167369', '167370']),
  section('E 00007965', '003-001-DI', 'discussion', ['160239', '167369']),
  section('E 00007966', '003-002-DI', 'discussion', ['160271', '167370']),
  section('E 00007937', '004-000-LE', 'lecture', ['160178', '167371', '167372']),
  section('E 00007967', '004-001-DI', 'discussion', ['160272', '167371']),
  section('E 00007941', '004-002-DI', 'discussion', ['160185', '167372']),
]);
const mgt = course('MGT-162', ['lecture'], [
  section('E 00013721', '001-000-LE', 'lecture', ['164325']),
  section('E 00013723', '002-000-LE', 'lecture', ['164326']),
  section('E 00013727', '003-000-LE', 'lecture', ['164327'], []),
  section('EL00005146', '004-000-LE', 'lecture', [], [], [
    { meeting_kind: 'class', day_code: null, specific_date: null, start_time_display: 'tba', end_time_display: 'tba' },
  ]),
]);
const mgtResults = { term_code: 'WI27', courses: [mgt, { ...mgt, module_code: 'MGT-162R' }] };

test('accepts shorthand and canonical course codes without conflating suffix variants', () => {
  assert.equal(normalizeCourseCode('econ100a'), 'ECON-100A');
  assert.equal(normalizeCourseCode('PHIL 10'), 'PHIL-010');
  assert.notEqual(normalizeCourseCode('MGT162'), normalizeCourseCode('MGT162R'));
  assert.throws(() => normalizeCourseCode('ECON100A or ECON120A'));
});

test('retains complete lecture/discussion packages and excludes partial package IDs', () => {
  const courses = [normalizeCourse(econ100, metadata), normalizeCourse(econ120, metadata)];
  assert.deepEqual(courses.map((entry) => entry.options.length), [4, 8]);
  assert.deepEqual(courses[0].options.map((option) => option.packageId), ['167237', '167238', '167239', '167240']);
  assert.deepEqual(courses[1].options.map((option) => option.packageId), ['167365', '167366', '167367', '167368', '167369', '167370', '167371', '167372']);
  assert.ok(courses.every((entry) => entry.options.every((option) => option.sections.length === 2)));
});

test('unmapped instruction type does not suppress a shared lecture/lab package', () => {
  const source = course('PSYC-111A', ['lecture', 'lab', 'ot'], [
    section('E 00008854', '001-000-LE', 'lecture', ['160618', '164089']),
    section('E 00008855', '001-001-LA', 'lab', ['160619', '164089']),
    section('EL00007212', '001-001-OT', 'ot', []),
  ]);
  const result = normalizeCourse(source, metadata);
  assert.deepEqual(result.options.map((option) => option.packageId), ['164089']);
  assert.deepEqual(result.options[0].sections.map((entry) => entry.id), ['E 00008854', 'E 00008855']);
  assert.deepEqual(result.unassignedSections.map((entry) => entry.id), ['EL00007212']);
});

test('a course without package associations keeps every section unassigned', () => {
  const source = course('MGT-162R', ['in'], [
    section('EL00005223', '001-000-IN', 'in', []),
  ]);
  const result = normalizeCourse(source, metadata);
  assert.deepEqual(result.options, []);
  assert.deepEqual(result.unassignedSections.map((entry) => entry.id), ['EL00005223']);
});

test('preserves TBA unassigned section and missing instructor without using course-level professor', () => {
  const result = normalizeCourse(mgt, metadata);
  assert.equal(result.options.length, 3);
  assert.deepEqual(result.options[2].sections[0].instructors, []);
  assert.equal(result.unassignedSections[0].id, 'EL00005146');
  assert.deepEqual(result.unassignedSections[0].instructors, []);
  assert.equal(result.unassignedSections[0].meetings[0].startTime, null);
  assert.equal(result.unassignedSections[0].meetings[0].endTime, null);
  for (const unknown of ['', '   ', 'TBA', ' tBa ']) {
    const source = structuredClone(mgt);
    source.sections[3].meetings[0].start_time_display = unknown;
    source.sections[3].meetings[0].end_time_display = unknown;
    const meeting = normalizeCourse(source, metadata).unassignedSections[0].meetings[0];
    assert.equal(meeting.startTime, null);
    assert.equal(meeting.endTime, null);
  }
});

test('requires observed module ID before generating any TSS course or package link', () => {
  assert.deepEqual(bookingRoutes(null, '167237', metadata), { courseUrl: null, bookingUrl: null });
  assert.ok(normalizeCourse(econ100, metadata).options.every((option) => option.bookingUrl === null));
  assert.throws(() => bookingRoutes('not-verified', '167237', metadata));
  assert.ok(bookingRoutes('999', '167237', metadata).bookingUrl.endsWith('/167237/2026/3/?'));
});

test('class location override never silently assigns exam room; exact exam override works', () => {
  const enriched = structuredClone(metadata);
  const lecture = econ100.sections[0];
  const exam = lecture.meetings.find((meeting) => meeting.meeting_kind === 'final');
  enriched.courses['ECON-100A'].sections[lecture.section_id] = {
    location: 'Test classroom', startDate: '2027-01-04', endDate: '2027-03-12',
  };
  let meetings = normalizeCourse(econ100, enriched).options[0].sections[0].meetings;
  assert.equal(meetings.find((meeting) => meeting.kind === 'class').location, 'Test classroom');
  assert.equal(meetings.find((meeting) => meeting.kind === 'final').location, null);
  enriched.courses['ECON-100A'].sections[lecture.section_id].meetings = {
    [meetingKey(exam)]: { location: 'Test exam room' },
  };
  meetings = normalizeCourse(econ100, enriched).options[0].sections[0].meetings;
  assert.equal(meetings.find((meeting) => meeting.kind === 'final').location, 'Test exam room');
  assert.equal(meetings.find((meeting) => meeting.kind === 'final').date, '2027-03-13');
  assert.equal(meetings.find((meeting) => meeting.kind === 'final').endTime, '10:59am');
});

test('fuzzy catalog search requires exact code match even when remote variant appears first', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ ...mgtResults, courses: [...mgtResults.courses].reverse() }) });
  assert.equal((await fetchCourse('MGT162', 'WI27', fetcher)).module_code, 'MGT-162');
});

test('rejects incomplete section response and cross-term data', () => {
  assert.throws(() => normalizeCourse({ ...econ100, sections: econ100.sections.slice(1) }, metadata), /incomplete/);
  assert.throws(() => normalizeCourse({ ...econ100, term_code: 'FA26' }, metadata), /term/);
});
