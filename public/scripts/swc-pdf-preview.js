const dialog = document.querySelector('[data-pdf-dialog]');
const gallery = dialog?.querySelector('[data-pdf-gallery]');
const heading = dialog?.querySelector('#pdf-dialog-title');
const original = dialog?.querySelector('[data-pdf-open]');
let trigger = null;

if (dialog && gallery && heading && original && typeof dialog.showModal === 'function') {
  document.querySelectorAll('a[data-pdf-preview]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const pages = link.parentElement.querySelector('template[data-pdf-pages]');
      if (!pages) return;
      event.preventDefault();
      trigger = link;
      const title = link.dataset.pdfTitle || 'Document preview';
      heading.textContent = title;
      original.href = link.href;
      gallery.replaceChildren(pages.content.cloneNode(true));
      dialog.showModal();
      gallery.scrollTop = 0;
    });
  });
  dialog.querySelector('[data-pdf-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    gallery.replaceChildren();
    trigger?.focus({ preventScroll: true });
  });
}
