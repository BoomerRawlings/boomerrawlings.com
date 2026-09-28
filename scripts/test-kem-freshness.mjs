import assert from 'node:assert/strict';
import { assertFresh, parsePhotoTimestamp } from '../src/scripts/kem-freshness.js';

let checks = 0;
function check(description, run) {
  try { run(); checks += 1; }
  catch (error) { error.message = `${description}: ${error.message}`; throw error; }
}

const now = Date.parse('2026-09-28T20:24:00.000Z');
const original = { DateTimeOriginal: '2026:09:28 13:23:00', OffsetTimeOriginal: '-07:00' };
const read = (tags, options = {}) => parsePhotoTimestamp(tags, { now, ...options });

check('exact capture time accepted', () => assert.equal(assertFresh(now, now), 0));
check('exact five-minute boundary accepted', () => assert.equal(assertFresh(now - 300_000, now), 300_000));
check('one millisecond expired rejected', () => assert.throws(() => assertFresh(now - 300_001, now), /last 5 minutes/));
check('future timestamps strictly rejected', () => assert.throws(() => assertFresh(now + 1, now), /future/));
check('invalid numeric timestamps rejected', () => {
  for (const value of [NaN, Infinity, undefined, null, '2026-09-28', new Date(now)]) {
    assert.throws(() => assertFresh(value, now), /unreadable/);
  }
});
check('nonfinite clock rejected', () => assert.throws(() => assertFresh(now, NaN), /finite current time/));
check('negative timezone offset converted', () => assert.equal(read(original).capturedAt, now - 60_000));
check('positive fractional-hour offset converted', () => {
  assert.equal(read({ DateTimeOriginal: '2026:09:29 02:08:00', OffsetTimeOriginal: '+05:45' }).capturedAt, now - 60_000);
});
check('explicit timezone is named in source', () => assert.match(read(original).source, /DateTimeOriginal \(UTC-07:00\)/));
check('embedded ISO timezone accepted', () => assert.equal(read({ DateTimeOriginal: '2026-09-28T20:23:00Z' }).capturedAt, now - 60_000));
check('conflicting embedded and separate offsets rejected', () => {
  assert.throws(() => read({ ...original, DateTimeOriginal: '2026:09:28 13:23:00Z' }), /unreadable/);
});
check('invalid offsets rejected', () => {
  for (const offset of ['PDT', '+25:00', '+14:01', '-07:60', '-0700', 420, '']) {
    if (offset === '') continue; // Empty offset is absent; the documented device-timezone fallback applies.
    assert.throws(() => read({ ...original, OffsetTimeOriginal: offset }), /unreadable/);
  }
});
check('calendar-invalid original rejected despite fresh GPS', () => {
  assert.throws(() => read({ DateTimeOriginal: '2026:02:30 20:23:00', OffsetTimeOriginal: 'Z',
    GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 23, 0] }), /unreadable/);
});
check('calendar and clock fields strictly checked', () => {
  for (const value of ['2026:13:01 20:23:00', '2026:09:31 20:23:00', '2026:09:28 24:00:00',
    '2026:09:28 20:60:00', '2026:09:28 20:23:60', '2026:00:28 20:23:00', '2026:09:00 20:23:00']) {
    assert.throws(() => read({ DateTimeOriginal: value, OffsetTimeOriginal: 'Z' }), /unreadable/);
  }
});
check('leap day accepted only in leap year', () => {
  assert.equal(parsePhotoTimestamp({ DateTimeOriginal: '2024:02:29 12:00:00', OffsetTimeOriginal: 'Z' },
    { now: Date.parse('2024-02-29T12:01:00Z') }).capturedAt, Date.parse('2024-02-29T12:00:00Z'));
  assert.throws(() => read({ DateTimeOriginal: '2026:02:29 12:00:00', OffsetTimeOriginal: 'Z' }), /unreadable/);
});
check('millisecond precision retained', () => {
  assert.equal(read({ ...original, SubSecTimeOriginal: '123' }).capturedAt, now - 60_000 + 123);
  assert.equal(read({ ...original, DateTimeOriginal: '2026:09:28 13:23:00.123456' }).capturedAt, now - 60_000 + 123);
});
check('conflicting fractional seconds rejected', () => {
  assert.throws(() => read({ ...original, DateTimeOriginal: '2026:09:28 13:23:00.123', SubSecTimeOriginal: '456' }), /unreadable/);
});
check('raw EXIF strings with trailing NULL accepted', () => {
  assert.equal(read({ DateTimeOriginal: '2026:09:28 13:23:00\0', OffsetTimeOriginal: '-07:00\0' }).capturedAt, now - 60_000);
});
check('revived Date objects rejected rather than guessing timezone', () => {
  assert.throws(() => read({ DateTimeOriginal: new Date(now - 60_000) }), /unreadable/);
});
check('offsetless metadata uses supplied device offset and labels assumption', () => {
  const result = read({ DateTimeOriginal: original.DateTimeOriginal }, { timezoneOffsetMinutes: 420 });
  assert.equal(result.capturedAt, now - 60_000);
  assert.match(result.source, /timezone assumed from this device \(UTC-07:00\)/);
});
check('offset override cannot supersede actual EXIF offset', () => {
  assert.equal(read(original, { timezoneOffsetMinutes: 0 }).capturedAt, now - 60_000);
});
check('invalid device offset rejected', () => {
  for (const offset of [Infinity, 1.5, 841, '420']) {
    assert.throws(() => read({ DateTimeOriginal: original.DateTimeOriginal }, { timezoneOffsetMinutes: offset }), /timezoneOffsetMinutes/);
  }
});
check('device-local timezone matches original wall clock', () => {
  const date = new Date(now - 60_000);
  const pad = (value) => String(value).padStart(2, '0');
  const raw = `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  assert.equal(read({ DateTimeOriginal: raw }).capturedAt, now - 60_000);
});
check('GPS fallback is UTC independent of device offset', () => {
  const result = read({ GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 23, 0] }, { timezoneOffsetMinutes: 420 });
  assert.equal(result.capturedAt, now - 60_000);
  assert.match(result.source, /GPS capture timestamp \(UTC\)/);
});
check('GPS time strings accepted', () => {
  assert.equal(read({ GPSDateStamp: '2026:09:28\0', GPSTimeStamp: '20:23:00.125' }).capturedAt, now - 60_000 + 125);
});
check('GPS rational triples accepted', () => {
  assert.equal(read({ GPSDateStamp: '2026:09:28', GPSTimeStamp: [[20, 1], [23, 1], [1, 4]] }).capturedAt, now - 60_000 + 250);
});
check('GPS invalid and incomplete evidence rejected', () => {
  for (const tags of [
    { GPSDateStamp: '2026:09:28' }, { GPSTimeStamp: [20, 23, 0] },
    { GPSDateStamp: '2026:09:31', GPSTimeStamp: [20, 23, 0] },
    { GPSDateStamp: '2026:09:28', GPSTimeStamp: [24, 0, 0] },
    { GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 23, 60] },
    { GPSDateStamp: '2026:09:28', GPSTimeStamp: [[20, 0], [23, 1], [0, 1]] },
    { GPSDateStamp: '2026:09:28', GPSTimeStamp: ['20', '23', '00'] },
  ]) assert.throws(() => read(tags), /unreadable/);
});
check('original capture always wins over GPS', () => {
  const result = read({ ...original, GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 24, 0] });
  assert.equal(result.capturedAt, now - 60_000);
});
check('stale original never rescued by GPS or file creation', () => {
  assert.throws(() => read({ DateTimeOriginal: '2026:09:28 20:18:59', OffsetTimeOriginal: 'Z',
    GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 24, 0], CreateDate: '2026:09:28 20:24:00', lastModified: now }), /last 5 minutes/);
});
check('future original never rescued by valid alternate', () => {
  assert.throws(() => read({ DateTimeOriginal: '2026:09:28 20:24:01', OffsetTimeOriginal: 'Z',
    GPSDateStamp: '2026:09:28', GPSTimeStamp: [20, 23, 0] }), /future/);
});
check('file, modify, and digitization dates never qualify', () => {
  for (const tags of [undefined, null, {}, { lastModified: now }, { ModifyDate: original.DateTimeOriginal },
    { CreateDate: original.DateTimeOriginal, OffsetTimeDigitized: '-07:00' },
    { DateTimeDigitized: original.DateTimeOriginal }, { DateTimeOriginal: '' }]) {
    assert.throws(() => read(tags), /no capture-time metadata/);
  }
});
check('age rechecked at final submission', () => {
  const result = read(original);
  assert.throws(() => assertFresh(result.capturedAt, now + 240_001), /last 5 minutes/);
});

// A separate Node process makes timezone tests reliable on Windows and Unix.
import { spawnSync } from 'node:child_process';
check('DST gap and repeated hour rejected without EXIF offset', () => {
  const moduleUrl = new URL('../src/scripts/kem-freshness.js', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { parsePhotoTimestamp } from ${JSON.stringify(moduleUrl)};
    assert.equal(new Date('2026-09-28T20:24:00Z').getTimezoneOffset(), 420, 'timezone fixture active');
    assert.throws(() => parsePhotoTimestamp({ DateTimeOriginal: '2026:03:08 02:30:00' },
      { now: Date.parse('2026-03-08T10:31:00Z') }), /unreadable/);
    assert.throws(() => parsePhotoTimestamp({ DateTimeOriginal: '2026:11:01 01:30:00' },
      { now: Date.parse('2026-11-01T09:31:00Z') }), /ambiguous/);
    assert.equal(parsePhotoTimestamp({ DateTimeOriginal: '2026:11:01 01:30:00', OffsetTimeOriginal: '-08:00' },
      { now: Date.parse('2026-11-01T09:31:00Z') }).capturedAt, Date.parse('2026-11-01T09:30:00Z'));
  `], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr || child.stdout);
});

console.log(`Kem photo freshness: ${checks} checks passed.`);
