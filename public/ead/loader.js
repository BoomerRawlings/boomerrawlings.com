/* Deferred public workspace. This entry interaction is not authentication. */
let leoWorkspaceLoad;
// Bump with UI releases; match the entry shell's asset query version.
const LEO_ASSET_VERSION = '20260930-poem-1';
const leoAsset = name => `./${name}?v=${LEO_ASSET_VERSION}`;
function loadLEOWorkspace() {
  if (leoWorkspaceLoad) return leoWorkspaceLoad;
  leoWorkspaceLoad = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let markup;
    try {
      const response = await fetch(leoAsset('workspace.html'), {credentials:'omit', referrerPolicy:'no-referrer', signal:controller.signal});
      if (!response.ok) throw new Error('Workspace unavailable');
      markup = await response.text();
    } finally { clearTimeout(timeout); }
    const fragment = document.createElement('template');
    fragment.innerHTML = markup;
    if (!fragment.content.querySelector('#main')) throw new Error('Workspace incomplete');
    document.getElementById('research-workspace').replaceChildren(fragment.content);

    const asset = (name, kind) => new Promise((resolve, reject) => {
      const node = document.createElement(kind === 'css' ? 'link' : 'script');
      const timer = setTimeout(() => { node.remove(); reject(new Error('Asset timed out')); }, 20000);
      const done = error => {
        clearTimeout(timer); node.onload = node.onerror = null;
        if (error) { node.remove(); reject(new Error('Asset unavailable')); } else resolve();
      };
      node.onload = () => done(false); node.onerror = () => done(true);
      if (kind === 'css') { node.rel = 'stylesheet'; node.href = leoAsset(`${name}.css`); }
      else { node.src = leoAsset(`${name}.js`); }
      document.head.append(node);
    });
    const styles = ['style','oracle','implementation','atlas','plans','reveal'];
    const scripts = ['relevance','network-layout','app','atlas','implementation','plans','reveal'];
    await Promise.all(styles.map(name => asset(name, 'css')));
    await Promise.all(scripts.map(name => asset(name, 'js')));
    await new Promise((resolve, reject) => {
      const done = error => {
        clearTimeout(timer);
        document.removeEventListener('ead:atlas-ready', ready);
        document.removeEventListener('ead:load-error', failed);
        if (error) reject(new Error('Research unavailable')); else resolve();
      };
      const ready = () => done(false), failed = () => done(true);
      const timer = setTimeout(failed, 20000);
      document.addEventListener('ead:atlas-ready', ready, {once:true});
      document.addEventListener('ead:load-error', failed, {once:true});
      document.dispatchEvent(new Event('ead:open'));
    });
  })();
  return leoWorkspaceLoad;
}
