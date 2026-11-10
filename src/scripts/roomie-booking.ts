const cards = [...document.querySelectorAll<HTMLDetailsElement>('[data-roomie-card]')];
const filter = document.querySelector<HTMLSelectElement>('[data-roomie-filter]');
const expand = document.querySelector<HTMLButtonElement>('[data-expand-roomies]');
const status = document.querySelector<HTMLElement>('[data-roomie-status]');

const visibleCards = () => cards.filter(card => !card.hidden);
const syncExpandLabel = () => {
  if (!expand) return;
  const shown = visibleCards();
  expand.textContent = shown.length > 0 && shown.every(card => card.open) ? 'Collapse all' : 'Expand all';
};

filter?.addEventListener('change', () => {
  const room = filter.value;
  cards.forEach(card => {
    card.hidden = room !== 'all' && card.dataset.roomNumber !== room;
    if (room !== 'all' && !card.hidden) card.open = true;
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
  const open = shown.some(card => !card.open);
  shown.forEach(card => card.open = open);
  syncExpandLabel();
});

cards.forEach(card => card.addEventListener('toggle', syncExpandLabel));
syncExpandLabel();
