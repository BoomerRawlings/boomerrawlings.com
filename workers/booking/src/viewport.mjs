// The hosted LiveView renderer clamps scale at 1 / devicePixelRatio. Match a
// new remote page to its viewer instead of relying on it to shrink 800px wide.
export function loginViewport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'width') || !Object.hasOwn(value, 'height')
    || !Number.isInteger(value.width) || value.width < 320 || value.width > 1440
    || !Number.isInteger(value.height) || value.height < 240 || value.height > 1000) return null;
  return { width: value.width, height: value.height };
}
