const empty = () => Object.freeze({ subjectId: '', subjectLabel: '', forumAccountId: '', forumAccountToken: '', forumProfileIdPrefix: '', text: Object.freeze({}) });
export let presentation = empty();

// Workspace-specific identities and copy arrive only from the authenticated API.
export function configurePresentation(value) {
  if (value == null) { presentation = empty(); return; }
  const fields = ['subjectId', 'subjectLabel', 'forumAccountId', 'forumAccountToken', 'forumProfileIdPrefix'];
  if (value.version !== 1 || fields.some(key => typeof value[key] !== 'string' || !value[key] || value[key].length > 200)
    || !value.text || typeof value.text !== 'object' || Array.isArray(value.text)
    || Object.entries(value.text).some(([key, text]) => !/^text\d+$/.test(key) || typeof text !== 'string' || text.length > 4000)) {
    throw new Error('Workspace presentation settings are unavailable.');
  }
  presentation = Object.freeze({ ...Object.fromEntries(fields.map(key => [key, value[key]])), text: Object.freeze({ ...value.text }) });
}
