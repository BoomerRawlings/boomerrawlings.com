/** World-space grid: rebuilt with data, queried only for camera changes or nearby picks. */
export class SpatialGrid {
  constructor(nodes = []) {
    this.nodes = nodes;
    this.cells = new Map();
    this.lastVisited = 0;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const node of nodes) { left = Math.min(left, node.x); right = Math.max(right, node.x); top = Math.min(top, node.y); bottom = Math.max(bottom, node.y); }
    this.cellSize = Math.max(1, Math.sqrt(Math.max(1, (right - left) * (bottom - top)) / Math.max(1, nodes.length)) * 4);
    for (const node of nodes) {
      const x = Math.floor(node.x / this.cellSize), y = Math.floor(node.y / this.cellSize), key = `${x},${y}`;
      if (!this.cells.has(key)) this.cells.set(key, { x, y, nodes: [] });
      this.cells.get(key).nodes.push(node);
    }
  }
  query(left, top, right, bottom) {
    const x0 = Math.floor(left / this.cellSize), x1 = Math.floor(right / this.cellSize);
    const y0 = Math.floor(top / this.cellSize), y1 = Math.floor(bottom / this.cellSize);
    const found = [];
    this.lastVisited = 0;
    const visit = cell => {
      if (!cell) return;
      for (const node of cell.nodes) {
        this.lastVisited++;
        if (node.x >= left && node.x <= right && node.y >= top && node.y <= bottom) found.push(node);
      }
    };
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > this.cells.size * 2) {
      for (const cell of this.cells.values()) if (cell.x >= x0 && cell.x <= x1 && cell.y >= y0 && cell.y <= y1) visit(cell);
    } else for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) visit(this.cells.get(`${x},${y}`));
    return found;
  }
}
