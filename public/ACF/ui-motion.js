/** Short, semantic reveals. Text, focus and hit targets are never deferred. */
export class UIMotion {
  constructor(document, { active = true } = {}) {
    this.document = document;
    this.active = active;
    this.paused = false;
    this.running = new Map();
    this.keys = new WeakMap();
    this.media = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.onVisibility = () => { if (document.hidden) this.stop(); };
    this.onPreference = () => { if (this.media.matches) this.stop(); };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.media?.addEventListener('change', this.onPreference);
  }

  setActive(active) { this.active = Boolean(active); if (!this.active) this.stop(); }
  setPaused(paused) {
    this.paused = Boolean(paused);
    this.document.body?.setAttribute('data-ui-motion-paused', String(this.paused));
    if (this.paused) this.stop();
  }
  allowed() { return this.active && !this.paused && !this.document.hidden && !this.media?.matches && !this.document.body?.classList?.contains('entry-pending'); }

  reveal(surface, { key, fields, mode = 'panel' } = {}) {
    if (!surface || (key !== undefined && this.keys.get(surface) === key)) return;
    this.cancel(surface, false);
    if (key !== undefined) this.keys.set(surface, key);
    if (!this.allowed() || surface.hidden || surface.closest?.('[hidden]') || !surface.animate || surface.getClientRects?.().length === 0) return;

    const trace = this.document.createElement('span');
    trace.className = 'ui-trace';
    trace.setAttribute('aria-hidden', 'true');
    surface.classList.add('ui-motion-surface');
    surface.dataset.uiMotion = 'revealing';
    surface.append(trace);
    const entry = { animations: [], finished: [], trace };
    this.running.set(surface, entry);
    const animate = (element, frames, options) => {
      const animation = element.animate(frames, { easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards', ...options });
      entry.animations.push(animation);
      entry.finished.push(animation.finished.catch(() => {}));
    };
    try {
      animate(trace, [
        { transform: 'scaleX(.015)', opacity: .15, offset: 0 },
        { transform: 'scaleX(1)', opacity: .9, offset: .64 },
        { transform: 'scaleX(1)', opacity: 0, offset: 1 },
      ], { duration: 560 });
      if (mode === 'view') animate(surface, [{ opacity: .72 }, { opacity: 1 }], { duration: 320 });
      const rows = [...(fields || surface.children)].filter(node => node !== trace && !node.hidden && node.animate).slice(0, 12);
      rows.forEach((node, i) => {
        // Controls retain their complete clickable area throughout the reveal.
        const control = node.matches?.('button,a,input,select,textarea,label,summary') || node.querySelector?.('button,a,input,select,textarea,summary');
        const start = { opacity: .18 };
        const end = { opacity: 1 };
        if (!control) {
          start.transform = 'translateY(4px)'; end.transform = 'translateY(0)';
          start.clipPath = 'inset(0 22% 0 0)'; end.clipPath = 'inset(0 0% 0 0)';
        }
        animate(node, [start, end], { duration: 330, delay: 45 + i * 18 });
      });
      Promise.all(entry.finished).then(() => {
        if (this.running.get(surface) === entry) this.clear(surface, entry);
      });
    } catch {
      // Unsupported animation features must never affect the readable UI.
      this.cancel(surface, false);
    }
  }

  clear(surface, entry) {
    entry.trace.remove();
    surface.dataset.uiMotion = 'settled';
    this.running.delete(surface);
  }
  cancel(surface, forget = true) {
    for (const child of [...this.running.keys()]) if (child !== surface && surface?.contains?.(child)) this.cancel(child, forget);
    if (forget) this.keys.delete(surface);
    const entry = this.running.get(surface);
    if (!entry) return;
    this.clear(surface, entry);
    for (const animation of entry.animations) animation.cancel();
  }
  stop() { for (const surface of [...this.running.keys()]) this.cancel(surface); }
  destroy() {
    this.stop();
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    this.media?.removeEventListener('change', this.onPreference);
  }
}
