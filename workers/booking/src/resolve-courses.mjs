export const RESOLVE_COURSE_REASONS = Object.freeze([
  'authentication_required', 'lookup_timeout', 'lookup_network_error', 'lookup_http_error',
  'unsupported_response', 'course_not_found', 'course_ambiguous', 'course_mismatch',
  'package_mismatch', 'package_missing',
]);

// Serialized into the owned TSS browser. No closure dependencies, navigation,
// student fields, or mutation. Service/entity/field names come from the saved
// Schedule of Classes manifest, CourseAbbr table binding, and _loadClassSections.
export async function resolveRoomieCourses() {
  const expected = [
    { courseCode: 'ECON-120A', packageIds: ['167365', '167366', '167367', '167368', '167369', '167370', '167371', '167372'] },
    { courseCode: 'MGT-162', packageIds: ['164325', '164326', '164327'] },
  ];
  const fail = reason => ({ resolved: false, courses: [], failures: expected.map(({ courseCode }) => ({ courseCode, reason })) });
  if (window.location.origin !== 'https://tss.ucsd.edu') return fail('authentication_required');
  const base = 'https://tss.ucsd.edu/sap/opu/odata4/sap/yucsd_con_module_sb/srvd/sap/yucsd_con_module_servicedef/0001/';
  const numericId = value => typeof value === 'string' && /^\d{1,10}$/.test(value) && /[1-9]/.test(value)
    ? value.replace(/^0+(?=\d)/, '') : null;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  async function read(path, query) {
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await window.fetch(url.href, { method: 'GET', credentials: 'same-origin',
            redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
          if (response.status === 401 || response.status === 403) return { error: 'authentication_required' };
          if (!response.ok) return { error: 'lookup_http_error' };
          if (!/application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type') || '')) return { error: 'unsupported_response' };
          if (Number(response.headers.get('content-length')) > 262144) return { error: 'unsupported_response' };
          const text = await response.text();
          if (text.length > 262144) return { error: 'unsupported_response' };
          let data;
          try { data = JSON.parse(text); } catch { return { error: 'unsupported_response' }; }
          if (!object(data) || data.error || data['@odata.nextLink'] || !Array.isArray(data.value)
            || data.value.length > 1000 || !data.value.every(object)) return { error: 'unsupported_response' };
          return { rows: data.value };
        })(),
        new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ error: 'lookup_timeout' }); }, 8000); }),
      ]);
    } catch { return { error: controller.signal.aborted ? 'lookup_timeout' : 'lookup_network_error' }; }
    finally { clearTimeout(timer); }
  }
  const results = await Promise.all(expected.map(async ({ courseCode, packageIds }) => {
    const failure = reason => ({ failure: { courseCode, reason } });
    const modules = await read('YUCSD_CON_MODULE', {
      $filter: `AcademicYear eq '2026' and AcademicPeriod eq '3' and CourseAbbr eq '${courseCode}'`,
      $select: 'AcademicYear,AcademicPeriod,ModuleID,CourseAbbr', $top: '5',
    });
    if (modules.error) return failure(modules.error);
    if (modules.rows.length === 0) return failure('course_not_found');
    if (modules.rows.length !== 1) return failure('course_ambiguous');
    const row = modules.rows[0], moduleId = numericId(row.ModuleID);
    if (!moduleId || row.CourseAbbr !== courseCode || row.AcademicYear !== '2026' || numericId(row.AcademicPeriod) !== '3') return failure('course_mismatch');
    // Use the exact observed key text for the server read, then export canonical
    // numeric IDs only. Numeric validation excludes OData key injection.
    const sections = await read(`YUCSD_CON_MODULE(AcademicYear='2026',AcademicPeriod='${row.AcademicPeriod}',ModuleID='${row.ModuleID}')/_sections`, {
      $select: 'AcYear,AcPeriod,ModuleID,EventPkgObjid', $top: '1000',
    });
    if (sections.error) return failure(sections.error);
    const seen = new Set();
    for (const section of sections.rows) {
      if (section.AcYear !== '2026' || numericId(section.AcPeriod) !== '3' || numericId(section.ModuleID) !== moduleId) return failure('package_mismatch');
      const id = numericId(section.EventPkgObjid);
      if (id && packageIds.includes(id)) seen.add(id);
    }
    if (!packageIds.every(id => seen.has(id))) return failure('package_missing');
    return { course: { courseCode, moduleId, packageIds: [...packageIds] } };
  }));
  const courses = results.flatMap(result => result.course ? [result.course] : []);
  const failures = results.flatMap(result => result.failure ? [result.failure] : []);
  return { resolved: failures.length === 0, courses, failures };
}
