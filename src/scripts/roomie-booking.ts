import { enhanceDisclosures } from './roomie-disclosures';

const cards = [...document.querySelectorAll<HTMLDetailsElement>('[data-roomie-card]')];
const filter = document.querySelector<HTMLSelectElement>('[data-roomie-filter]');
const expand = document.querySelector<HTMLButtonElement>('[data-expand-roomies]');
const status = document.querySelector<HTMLElement>('[data-roomie-status]');
const collection = document.querySelector<HTMLElement>('#roomie-collection');

const visibleCards = () => cards.filter(card => !card.hidden);
const syncExpandLabel = () => {
  if (!expand) return;
  const shown = visibleCards();
  expand.textContent = shown.length > 0 && shown.every(card => disclosures?.isOpen(card) ?? card.open) ? 'Collapse all' : 'Expand all';
};
const disclosures = collection ? enhanceDisclosures(collection, syncExpandLabel) : undefined;
const setOpen = (card: HTMLDetailsElement, open: boolean) => {
  if (disclosures) disclosures.setOpen(card, open);
  else card.open = open;
};

filter?.addEventListener('change', () => {
  const room = filter.value;
  cards.forEach(card => {
    const hidden = room !== 'all' && card.dataset.roomNumber !== room;
    // Resolve pending intent before hiding, including any nested transitions.
    if (hidden) disclosures?.finishWithin(card);
    card.hidden = hidden;
    if (room !== 'all' && !card.hidden) setOpen(card, true);
  });
  if (status) {
    status.textContent = room === 'all'
      ? `Showing all ${cards.length} roomies.`
      : `Showing ${filter.selectedOptions[0].textContent}.`;
  }
  syncExpandLabel();
});

expand?.addEventListener('click', () => {
  const shown = visibleCards();
  const open = shown.some(card => !(disclosures?.isOpen(card) ?? card.open));
  shown.forEach(card => setOpen(card, open));
  syncExpandLabel();
});

cards.forEach(card => card.addEventListener('toggle', syncExpandLabel));
syncExpandLabel();
