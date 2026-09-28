// EXIF is editable metadata, not proof of identity or an unaltered photograph.
// Only capture timestamps qualify. File dates and digitization dates never do.
const FIVE_MINUTES = 5 * 60 * 1000;
const MINUTE = 60 * 1000;
const hasValue = (value) => value !== undefined && value !== null && value !== '';

function invalidTimestamp() {
  return new Error('This photo has an unreadable capture timestamp. Take a new photo using the live camera.');
}

function validateNow(now) {
  if (!Number.isFinite(now)) throw new TypeError('A finite current time is required.');
}

/** Return the photo's age in milliseconds; the five-minute boundary is inclusive. */
export function assertFresh(capturedAt, now = Date.now()) {
  validateNow(now);
  if (!Number.isFinite(capturedAt)) throw invalidTimestamp();
  const age = now - capturedAt;
  if (age < 0) {
    throw new Error('This photo’s capture timestamp is in the future. Check your device clock, then take a new photo using the live camera.');
  }
  if (age > FIVE_MINUTES) {
    throw new Error('The Feline Bureau requires a photo taken within the last 5 minutes. Take a new photo using the live camera, then try again.');
  }
  return age;
}

function utcFromParts(parts) {
  const [year, month, day, hour, minute, second, millisecond] = parts;
  if (!parts.every(Number.isInteger) || year < 1 || year > 9999 || month < 1 || month > 12 ||
      day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 ||
      second < 0 || second > 59 || millisecond < 0 || millisecond > 999) throw invalidTimestamp();
  // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw invalidTimestamp();
  }
  return date.getTime();
}

function offsetMinutes(raw) {
  if (typeof raw !== 'string') throw invalidTimestamp();
  const value = raw.trim().replace(/\0+$/, '').trim();
  if (value === 'Z') return 0;
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw invalidTimestamp();
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw invalidTimestamp();
  // Same sign convention as Date#getTimezoneOffset: UTC minus local time.
  return (match[1] === '+' ? -1 : 1) * (hours * 60 + minutes);
}

function offsetLabel(minutes) {
  return `UTC${minutes <= 0 ? '+' : '-'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
}

function sameLocalParts(timestamp, parts) {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(),
    date.getMinutes(), date.getSeconds(), date.getMilliseconds()].every((value, index) => value === parts[index]);
}

function deviceLocalTimestamp(parts, wallTime) {
  const local = new Date(0);
  local.setFullYear(parts[0], parts[1] - 1, parts[2]);
  local.setHours(parts[3], parts[4], parts[5], parts[6]);
  if (!sameLocalParts(local.getTime(), parts)) throw invalidTimestamp(); // A skipped DST clock time.

  // During a clock rollback one wall time can mean two distinct instants.
  // Without an EXIF offset, neither is safe to silently choose.
  const possibleOffsets = new Set([-48, -24, -12, 0, 12, 24, 48].map((hours) =>
    new Date(local.getTime() + hours * 60 * MINUTE).getTimezoneOffset()));
  const candidates = [...possibleOffsets].map((offset) => wallTime + offset * MINUTE)
    .filter((timestamp) => sameLocalParts(timestamp, parts));
  if (new Set(candidates).size !== 1) {
    throw new Error('This photo’s capture time is ambiguous after a clock change. Take a new photo using the live camera.');
  }
  return { capturedAt: candidates[0], offset: local.getTimezoneOffset() };
}

function parseOriginal(tags, timezoneOffsetMinutes) {
  if (typeof tags.DateTimeOriginal !== 'string') throw invalidTimestamp();
  const raw = tags.DateTimeOriginal.trim().replace(/\0+$/, '').trim();
  const match = /^(\d{4})([:-])(\d{2})\2(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/.exec(raw);
  if (!match) throw invalidTimestamp();
  let fraction = match[8] ?? '';
  if (hasValue(tags.SubSecTimeOriginal)) {
    const subsecond = String(tags.SubSecTimeOriginal).trim().replace(/\0+$/, '').trim();
    if (!/^\d{1,9}$/.test(subsecond)) throw invalidTimestamp();
    if (fraction && fraction.padEnd(9, '0') !== subsecond.padEnd(9, '0')) throw invalidTimestamp();
    fraction = subsecond;
  }
  const parts = [Number(match[1]), Number(match[3]), Number(match[4]), Number(match[5]),
    Number(match[6]), Number(match[7]), Number(fraction.padEnd(3, '0').slice(0, 3))];
  const wallTime = utcFromParts(parts);
  const embeddedOffset = match[9];
  const tagOffset = tags.OffsetTimeOriginal;
  if (hasValue(tagOffset) || embeddedOffset) {
    const offset = offsetMinutes(hasValue(tagOffset) ? tagOffset : embeddedOffset);
    if (embeddedOffset && offsetMinutes(embeddedOffset) !== offset) throw invalidTimestamp();
    return { capturedAt: wallTime + offset * MINUTE, source: `EXIF DateTimeOriginal (${offsetLabel(offset)})` };
  }

  let local;
  if (timezoneOffsetMinutes !== undefined) {
    if (!Number.isInteger(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 14 * 60) {
      throw new TypeError('timezoneOffsetMinutes must be an integer UTC-minus-local offset within 14 hours.');
    }
    local = { capturedAt: wallTime + timezoneOffsetMinutes * MINUTE, offset: timezoneOffsetMinutes };
  } else {
    local = deviceLocalTimestamp(parts, wallTime);
  }
  return {
    capturedAt: local.capturedAt,
    source: `EXIF DateTimeOriginal; timezone assumed from this device (${offsetLabel(local.offset)})`,
  };
}

function gpsNumber(value) {
  // exifr normally decodes rational values to numbers. Also accept their raw pairs.
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[1] !== 0) {
    return value[0] / value[1];
  }
  throw invalidTimestamp();
}

function parseGps(tags) {
  if (typeof tags.GPSDateStamp !== 'string' || !hasValue(tags.GPSTimeStamp)) throw invalidTimestamp();
  const date = /^(\d{4}):?(\d{2}):?(\d{2})$/.exec(tags.GPSDateStamp.trim().replace(/\0+$/, '').trim());
  if (!date) throw invalidTimestamp();
  let time;
  if (Array.isArray(tags.GPSTimeStamp) && tags.GPSTimeStamp.length === 3) {
    time = tags.GPSTimeStamp.map(gpsNumber);
  } else if (typeof tags.GPSTimeStamp === 'string') {
    const match = /^(\d{2}):(\d{2}):(\d{2}(?:\.\d{1,9})?)$/.exec(tags.GPSTimeStamp.trim().replace(/\0+$/, '').trim());
    if (!match) throw invalidTimestamp();
    time = match.slice(1).map(Number);
  } else {
    throw invalidTimestamp();
  }
  if (!Number.isInteger(time[0]) || !Number.isInteger(time[1]) || time[2] < 0 || time[2] >= 60) throw invalidTimestamp();
  const wholeSeconds = Math.floor(time[2]);
  const parts = [Number(date[1]), Number(date[2]), Number(date[3]), time[0], time[1], wholeSeconds,
    Math.round((time[2] - wholeSeconds) * 1000)];
  // Round fractional GPS seconds to the precision represented by JS timestamps.
  // A rounded carry belongs in the timestamp, not in the calendar validation.
  const milliseconds = parts.pop();
  const capturedAt = utcFromParts([...parts, 0]) + milliseconds;
  return { capturedAt, source: 'EXIF GPS capture timestamp (UTC)' };
}

/**
 * Read raw exifr tags (reviveValues: false), then validate their capture age.
 * Present original-capture metadata always wins; a stale/invalid original is
 * never rescued by another field. GPS is used only if DateTimeOriginal is absent.
 * No EXIF capture data means rejection, even if file/create/modify dates exist.
 */
export function parsePhotoTimestamp(tags, { now = Date.now(), timezoneOffsetMinutes } = {}) {
  validateNow(now);
  if (!tags || typeof tags !== 'object') {
    throw new Error('This photo has no capture-time metadata. Take a new photo using the live camera.');
  }
  let result;
  if (hasValue(tags.DateTimeOriginal)) {
    result = parseOriginal(tags, timezoneOffsetMinutes);
  } else if (hasValue(tags.GPSDateStamp) || hasValue(tags.GPSTimeStamp)) {
    result = parseGps(tags);
  } else {
    throw new Error('This photo has no capture-time metadata. Screenshots and downloaded copies often lose it. Take a new photo using the live camera.');
  }
  assertFresh(result.capturedAt, now);
  return result;
}
