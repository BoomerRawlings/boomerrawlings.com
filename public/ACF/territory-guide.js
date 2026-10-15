/** Contextual directions from the current map selection, with no separate tour state. */
export function territoryGuide({ selectedIds = [], byId, comparison = null }) {
  const selected = [...new Set(selectedIds)].filter(id => byId.has(id)).slice(0, 2);
  if (!selected.length) return {
    phase: 'first',
    title: 'Start with two subjects',
    body: 'Choose a subject, or click a territory in the map. Add a second to see what connects them.',
    pickerLabel: '1 · First subject',
    pickerPlaceholder: 'Choose your first subject',
  };
  if (selected.length === 1) return {
    phase: 'second',
    title: 'Now choose a second subject',
    body: `${byId.get(selected[0]).label} is selected. Choose another to separate their clusters and explore their connections.`,
    pickerLabel: '2 · Second subject',
    pickerPlaceholder: 'Choose your second subject',
  };
  const current = comparison?.left.id === selected[0] && comparison?.right.id === selected[1] ? comparison : null;
  return {
    phase: 'compare',
    title: current?.memberIds.size === 0 ? 'No matching records' : 'Explore what connects them',
    body: current?.memberIds.size === 0
      ? 'No records match these subjects and filters. Clear filters or try another subject.'
      : current?.shared.size === 0
        ? 'No shared records in this view. Explore a cluster, or open the map key to read its connections.'
        : current
          ? 'Shared records sit between the clusters. Click a star to explore; open the map key to read the connections.'
          : 'Your two subjects are selected. Explore their clusters, or choose a different second subject.',
    pickerLabel: 'Change second subject',
    pickerPlaceholder: 'Choose another subject',
  };
}
