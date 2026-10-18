type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>;
const reloadKey = 'brain-study-tools-reload-at';
const retryInterval = 60_000;

// An open tab can retain chunk URLs from the previous deployment. Refresh the
// document once to discover the new URLs, without looping if the network is down.
export function claimStudyToolsReload(error: unknown, getStorage: () => ReloadStorage, now = Date.now()): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!/dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script|Load failed/i.test(message)) return false;
  try {
    const storage = getStorage();
    const previous = storage.getItem(reloadKey);
    const lastReload = previous === null ? NaN : Number(previous);
    if (Number.isFinite(lastReload) && now - lastReload < retryInterval) return false;
    storage.setItem(reloadKey, String(now));
    return true;
  } catch {
    // Storage may be unavailable in private/embedded browsers. Offer a manual
    // reload instead; an automatic refresh without a guard could loop forever.
    return false;
  }
}
