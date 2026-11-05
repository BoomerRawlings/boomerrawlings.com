// The directory is supplied privately at runtime, never embedded in client bundles.
export function configuredCatalog(value) {
  try {
    if (typeof value !== 'string' || value.length > 20000) return null;
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed?.destinations) || parsed.destinations.length < 1 || parsed.destinations.length > 12) return null;
    const ids = new Set();
    const destinations = parsed.destinations.map(item => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(item.id) || ids.has(item.id)) throw new Error('Invalid catalog');
      ids.add(item.id);
      for (const [field, limit] of [['title', 100], ['kicker', 100], ['description', 500]]) {
        if (typeof item[field] !== 'string' || !item[field].trim() || item[field].length > limit || /[\x00-\x1f]/.test(item[field])) throw new Error('Invalid catalog');
      }
      if (typeof item.href !== 'string' || item.href.length > 300 || !/^\/[A-Za-z0-9/_-]+(?:#[A-Za-z0-9=&_%-]+)?$/.test(item.href) || item.href.startsWith('//')) throw new Error('Invalid catalog');
      if (typeof item.accent !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(item.accent)) throw new Error('Invalid catalog');
      const allowedSymbols = ['dialogue', 'futures', 'folio', 'atlas', 'vessel', 'neuron'];
      if (item.symbol !== undefined && !allowedSymbols.includes(item.symbol)) throw new Error('Invalid symbol');
      return { id: item.id, title: item.title, kicker: item.kicker, description: item.description, href: item.href, accent: item.accent, ...(item.symbol ? { symbol: item.symbol } : {}) };
    });
    return { destinations };
  } catch { return null; }
}
