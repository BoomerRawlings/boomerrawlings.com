import { previewInfo, previewPlacement } from './preview-data.js?v=stars-20261012';

/** One accessible card shared by pointer, touch and keyboard exploration. */
export class NodePreview {
  constructor(stage, canvas, getIndex, onOpen, { onPanStart, onZoom } = {}) {
    this.stage = stage; this.canvas = canvas; this.getIndex = getIndex; this.onOpen = onOpen;
    this.card = stage.querySelector('#node-preview');
    this.announcement = stage.querySelector('#preview-announcement');
    this.fields = Object.fromEntries(['kind', 'title', 'collection', 'meta', 'context', 'open'].map(key => [key, stage.querySelector('#preview-' + key)]));
    this.card.addEventListener('pointerenter', () => { this.overCard = true; this.cancelHide(); });
    this.card.addEventListener('pointerleave', () => { this.overCard = false; this.scheduleHide(); });
    this.card.addEventListener('focusin', () => { this.cancelHide(); if (this.node) { this.pinned = true; this.card.dataset.reason = 'keyboard'; } });
    this.card.addEventListener('focusout', event => { if (!this.card.contains(event.relatedTarget)) this.scheduleHide(); });
    stage.querySelector('#preview-close').addEventListener('click', () => this.close(true));
    this.fields.open.addEventListener('click', () => { const node = this.node; this.close(); if (node) this.onOpen(node); });
    stage.querySelector('#preview-zoom')?.addEventListener('click', () => { if (this.node) onZoom?.(this.node); });
    this.card.addEventListener('dragstart', event => event.preventDefault());
    this.card.addEventListener('pointerdown', event => {
      if (!onPanStart || event.target.closest('button,a,input,select,textarea')) return;
      // Touch can still scroll long metadata; the header is an explicit pan handle.
      if (event.pointerType !== 'mouse' && !event.target.closest('.preview-header')) return;
      onPanStart(event);
    });
  }
  cancelHide() { clearTimeout(this.timer); }
  scheduleHide() {
    this.cancelHide();
    if (this.pinned || this.overCard || this.card.contains(this.card.ownerDocument.activeElement)) return;
    this.timer = setTimeout(() => this.close(), 220);
  }
  update(node, anchor, reason = 'hover') {
    if (!node) {
      if (reason === 'hover') this.scheduleHide();
      else this.close();
      return;
    }
    if (this.restoringFocus || (this.pinned && reason === 'hover')) return;
    this.cancelHide();
    if (this.node?.id !== node.id) this.card.scrollTop = 0;
    this.node = node;
    this.pinned = reason === 'select' || reason === 'keyboard';
    const info = previewInfo(node, this.getIndex());
    this.fields.kind.textContent = info.kind === 'person' ? 'Credited name' : info.kind === 'theme' ? 'Inferred theme' : 'Publication / record';
    for (const key of ['title', 'collection', 'meta', 'context']) this.fields[key].textContent = info[key];
    this.fields.open.textContent = info.actionLabel + ' ↗';
    this.card.hidden = false;
    this.card.dataset.nodeId = node.id;
    this.card.dataset.reason = reason;
    const stage = this.stage.getBoundingClientRect(), canvas = this.canvas.getBoundingClientRect();
    const position = previewPlacement({ x: (anchor?.x ?? canvas.width / 2) + canvas.left - stage.left, y: (anchor?.y ?? canvas.height / 2) + canvas.top - stage.top }, this.card.getBoundingClientRect(), stage);
    this.card.style.left = position.x + 'px';
    this.card.style.top = position.y + 'px';
    if (reason !== 'hover') this.announcement.textContent = [info.title, info.collection, info.meta, info.context].filter(Boolean).join('. ');
  }
  close(restoreFocus = false) {
    this.cancelHide(); this.card.hidden = true; this.node = null; this.pinned = false; this.overCard = false;
    this.announcement.textContent = '';
    if (restoreFocus) {
      this.restoringFocus = true;
      this.canvas.focus({ preventScroll: true });
      this.restoringFocus = false;
    }
  }
}
