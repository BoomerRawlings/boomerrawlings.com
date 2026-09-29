// Open the disclosure containing a citation or shared school/table destination.
// A separate file keeps this behavior compatible with the site's script policy.
function revealStudyTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  let parent = target.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  target.scrollIntoView({block:'start'});
}

window.addEventListener('hashchange', revealStudyTarget);
// The school reader must apply its URL selection before we scroll to it.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', revealStudyTarget, {once:true});
} else {
  revealStudyTarget();
}
document.addEventListener('click', event => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  if (link?.hash === location.hash) revealStudyTarget();
});
