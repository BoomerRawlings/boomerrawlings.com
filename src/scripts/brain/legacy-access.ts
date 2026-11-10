// Access stays in memory for the current document. The encrypted lecture payload
// remains governed by the existing password/decryption implementation.
let open = false;

export function isLectureRoom(): boolean {
  return location.pathname.replace(/\/+$/, '') === '/brain/lectures';
}

export function hasLectureAccess(): boolean { return open; }

export function setLectureAccess(value: boolean): void {
  if (open === value) return;
  open = value;
  window.dispatchEvent(new CustomEvent('brain-lecture-access', { detail: { unlocked: value } }));
}

export function privateStudyMode(mode: string): boolean {
  return ['lectures', 'practice', 'recall', 'paths'].includes(mode);
}
