/* Pixel-based cards and gutter-routed direct connections. */
(() => {
  'use strict';
  const capacity = (width, focused) => focused ? (width >= 1100 ? 8 : width >= 700 ? 6 : 4) : (width >= 1100 ? 12 : width >= 700 ? 9 : 6);
  function page({ids, centerId = null, page = 0, width}) {
    const candidates = [...new Set(ids)].filter(id => id !== centerId);
    const size = capacity(width, Boolean(centerId)), totalPages = Math.max(1, Math.ceil(candidates.length / size));
    const current = Math.max(0, Math.min(page, totalPages - 1));
    return {ids: [...(centerId ? [centerId] : []), ...candidates.slice(current * size, (current + 1) * size)], page: current, totalPages};
  }
  function layout({width, ids, centerId = null}) {
    const pad = 16, cardH = 154, rowGap = 24, nodes = [], connectors = [];
    const unique = [...new Set(ids)], leaves = unique.filter(id => id !== centerId);
    const add = (id, x, y, cardW) => { const node = {id, x, y, width:cardW, height:cardH}; nodes.push(node); return node; };
    if (!centerId) {
      const columns = width >= 1100 ? 4 : width >= 800 ? 3 : width >= 570 ? 2 : 1;
      const cardW = (width - pad * 2 - rowGap * (columns - 1)) / columns;
      unique.forEach((id, i) => add(id, pad + (i % columns) * (cardW + rowGap), pad + Math.floor(i / columns) * (cardH + rowGap), cardW));
      return {width, height:Math.max(200, pad * 2 + Math.ceil(unique.length / columns) * (cardH + rowGap) - rowGap), nodes, connectors};
    }
    const wide = width >= 1100, medium = width >= 700;
    const gutter = wide ? 84 : medium ? 88 : 58;
    const cardW = wide ? (width - pad * 2 - gutter * 2) / 3 : medium ? (width - pad * 2 - gutter) / 2 : width - pad * 2 - gutter;
    const rows = wide ? Math.ceil(leaves.length / 2) : leaves.length;
    const height = Math.max(cardH + pad * 2, (medium ? 0 : cardH + rowGap) + rows * (cardH + rowGap) - (rows ? rowGap : 0) + pad * 2);
    const hub = add(centerId, wide ? pad + cardW + gutter : medium ? pad : pad + gutter, pad, cardW);
    leaves.forEach((id, i) => {
      const left = wide && i % 2 === 0;
      const node = add(id, wide ? (left ? pad : width-pad-cardW) : medium ? width-pad-cardW : pad+gutter, pad + (wide ? Math.floor(i/2) : i) * (cardH+rowGap) + (medium ? 0 : cardH+rowGap), cardW);
      const y = node.y + cardH / 2, startY = hub.y + cardH / 2;
      const startX = left || !medium ? hub.x : hub.x + cardW;
      const endX = left ? node.x+cardW : node.x;
      const rail = left ? hub.x-gutter/2 : medium ? hub.x+cardW+gutter/2 : pad+12;
      const badge = {x:rail-22,y:y-22,width:44,height:44};
      connectors.push({source:centerId,target:id,path:`M${startX},${startY} L${rail},${startY} L${rail},${y} L${endX},${y}`,badge});
    });
    return {width, height, nodes, connectors};
  }
  window.LEONetworkLayout = {capacity, page, layout};
})();
