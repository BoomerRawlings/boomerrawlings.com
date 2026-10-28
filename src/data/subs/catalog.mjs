import europe from './europe.json' with { type: 'json' };
import major from './major.json' with { type: 'json' };
import asia from './asia.json' with { type: 'json' };

const compare = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
const entries = new Map();
for (const entry of [...europe, ...major, ...asia]) {
  const key = `${entry.type.trim().toLocaleLowerCase('en')}|${entry.country.trim()}`;
  const existing = entries.get(key);
  if (existing) existing.sources = [...new Set([...existing.sources, ...entry.sources])];
  else entries.set(key, { ...entry, sources: [...entry.sources] });
}
export const catalog = [...entries.values()].sort((a, b) => compare(a.type, b.type) || compare(a.country, b.country));
export const countries = [...new Set(catalog.flatMap(entry => entry.country.split(' / ')))].sort(compare);
export const sources = [...new Set(catalog.flatMap(entry => entry.sources))].sort(compare);
