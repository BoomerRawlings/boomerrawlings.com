import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = resolve(projectRoot, 'src/data/roomie-course-options.json');
const metadataPath = resolve(projectRoot, 'src/data/roomie-course-metadata.json');
const catalogUrl = 'https://classplanner.apps.ucsd.edu/api/v1/public/catalog/courses/search';

export function normalizeCourseCode(value) {
  const match = String(value).trim().toUpperCase().match(/^([A-Z]+)[\s-]*(\d+)([A-Z]*)$/);
  if (!match) throw new Error(`Invalid course code: ${value}`);
  return `${match[1]}-${String(Number(match[2])).padStart(3, '0')}${match[3]}`;
}

// Keys remain stable when the catalog changes the order of meetings.
export function meetingKey(meeting) {
  return [meeting.meeting_kind, meeting.day_code, meeting.specific_date,
    meeting.start_time_display, meeting.end_time_display].map((value) => value ?? '').join('|');
}

export function bookingRoutes(moduleId, packageId, metadata) {
  if (moduleId === null || moduleId === undefined || moduleId === '') {
    return { courseUrl: null, bookingUrl: null };
  }
  const values = [moduleId, metadata.academicYear, metadata.academicPeriod];
  if (!values.every((value) => /^\d+$/.test(String(value)))) {
    throw new Error('TSS module, academic year, and academic period must be verified numeric IDs.');
  }
  const year = metadata.academicYear;
  const period = metadata.academicPeriod;
  const courseUrl = `https://tss.ucsd.edu/fiori#YSchedule-view&/YUCSD_CON_MODULE(AcademicYear='${year}',AcademicPeriod='${period}',ModuleID='${moduleId}')?layout=MidColumnFullScreen`;
  if (packageId === null || packageId === undefined) return { courseUrl, bookingUrl: null };
  if (!/^\d+$/.test(String(packageId))) throw new Error(`Invalid event package ID: ${packageId}`);
  return {
    courseUrl,
    bookingUrl: `https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/${year}/${period}/?`,
  };
}

function normalizeTime(value) {
  return typeof value === 'string' && value.trim() && !/^tba$/i.test(value.trim()) ? value : null;
}

function normalizeSection(section, override = {}) {
  return {
    id: section.section_id,
    code: section.section_code,
    type: section.instruction_type_name,
    instructors: [...(section.instructors ?? [])],
    meetings: (section.meetings ?? []).map((meeting) => {
      const detail = override.meetings?.[meetingKey(meeting)] ?? {};
      // A section's classroom is not evidence for its exam room.
      const recurring = meeting.meeting_kind === 'class' ? override : {};
      return {
        kind: meeting.meeting_kind,
        day: meeting.day_code ?? null,
        date: meeting.specific_date ?? null,
        startTime: normalizeTime(meeting.start_time_display),
        endTime: normalizeTime(meeting.end_time_display),
        location: detail.location ?? recurring.location ?? null,
        startDate: detail.startDate ?? recurring.startDate ?? null,
        endDate: detail.endDate ?? recurring.endDate ?? null,
      };
    }),
    seatsAvailable: section.seats_available ?? null,
  };
}

export function normalizeCourse(course, metadata) {
  const code = normalizeCourseCode(course.module_code);
  if (course.term_code !== metadata.term) throw new Error(`${code}: unexpected catalog term.`);
  const override = metadata.courses?.[code] ?? {};
  const rawSections = course.sections ?? [];
  const sectionIds = rawSections.map((section) => section.section_id);
  if (new Set(sectionIds).size !== sectionIds.length) throw new Error(`${code}: duplicate section IDs.`);
  if (course.section_count !== rawSections.length) throw new Error(`${code}: incomplete catalog sections.`);
  const sections = new Map(rawSections.map((section) => [section.section_id,
    normalizeSection(section, override.sections?.[section.section_id])]));
  // Unmapped sections cannot establish package contents; retain them separately.
  // This does not imply that an unmapped section is optional.
  const packageTypes = new Set(rawSections
    .filter((section) => section.event_package_ids?.length)
    .map((section) => section.instruction_type_name));
  const packages = new Map();
  for (const section of rawSections) {
    for (const packageId of new Set(section.event_package_ids ?? [])) {
      const group = packages.get(String(packageId)) ?? [];
      group.push(section);
      packages.set(String(packageId), group);
    }
  }
  const assigned = new Set();
  const options = [];
  for (const [packageId, group] of packages) {
    const includedTypes = new Set(group.map((section) => section.instruction_type_name));
    if (![...packageTypes].every((type) => includedTypes.has(type))) continue;
    const members = group.map((section) => sections.get(section.section_id))
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    members.forEach((section) => assigned.add(section.id));
    options.push({
      packageId,
      label: members.map((section) => section.code).join(' + '),
      bookingUrl: bookingRoutes(override.moduleId, packageId, metadata).bookingUrl,
      sections: members,
    });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })
    || a.packageId.localeCompare(b.packageId, 'en', { numeric: true }));
  return {
    code,
    title: course.module_name || course.course_title || code,
    category: override.category ?? course.subject_name ?? course.subject_code,
    categoryStyle: override.categoryStyle ?? 'other',
    sectionCount: sections.size,
    options,
    unassignedSections: [...sections.values()].filter((section) => !assigned.has(section.id)),
    courseUrl: bookingRoutes(override.moduleId, null, metadata).courseUrl,
  };
}

export async function fetchCourse(code, term, fetcher = fetch) {
  const canonical = normalizeCourseCode(code);
  for (let offset = 0; ; offset += 10) {
    const response = await fetcher(catalogUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term_code: term, q: canonical.replace('-', ' '), limit: 10, offset }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${canonical}: catalog returned HTTP ${response.status}.`);
    const result = await response.json();
    if (result.term_code !== term || !Array.isArray(result.courses)) {
      throw new Error(`${canonical}: unexpected catalog response.`);
    }
    const matches = result.courses.filter((course) => normalizeCourseCode(course.module_code) === canonical);
    if (matches.length > 1) throw new Error(`${canonical}: ambiguous exact course matches.`);
    if (matches.length === 1) return matches[0];
    if (!result.courses.length || offset + 10 >= result.total) {
      throw new Error(`${canonical}: no exact course found in ${term}.`);
    }
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

export async function refreshCourses(codes) {
  const metadata = await readJson(metadataPath);
  const existing = await readJson(dataPath, { term: metadata.term, courses: {} });
  if (existing.term !== metadata.term) throw new Error('Existing course data uses another term; migrate it explicitly.');
  const courses = { ...existing.courses };
  for (const code of [...new Set(codes.map(normalizeCourseCode))]) {
    const course = await fetchCourse(code, metadata.term);
    courses[code] = normalizeCourse(course, metadata);
  }
  // Only write after every requested course succeeds; keep other imported courses.
  const output = { term: metadata.term, updatedAt: new Date().toISOString(), courses };
  await writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const codes = process.argv.slice(2);
  if (!codes.length || codes.includes('--help')) {
    console.log('Usage: node scripts/refresh-roomie-courses.mjs ECON100A ECON120A MGT162');
    console.log('Refreshes public catalog data. Verified TSS IDs and meeting overrides live in src/data/roomie-course-metadata.json.');
    process.exitCode = codes.length ? 0 : 1;
  } else {
    refreshCourses(codes).then((data) => {
      for (const code of [...new Set(codes.map(normalizeCourseCode))]) {
        const course = data.courses[code];
        console.log(`${code}: ${course.sectionCount} sections; ${course.options.length} complete options; ${course.unassignedSections.length} unassigned.`);
      }
    }).catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
