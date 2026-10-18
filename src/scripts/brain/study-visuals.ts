/** Fixed anatomical illustrations for retrieval practice. No WebGL contexts,
 * animation loops, or screen-dependent changes to the answer's orientation. */
export type StudyView = 'lateral' | 'medial' | 'superior' | 'inferior' | 'anterior' | 'posterior' | 'oblique';
export type StudyRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'cerebellum' | 'basal-ganglia';
export type StudyDirection = 'anterior' | 'posterior' | 'superior' | 'inferior' | 'dorsal' | 'ventral' | 'rostral' | 'caudal' | 'medial' | 'lateral';
export type StudyTract = 'association' | 'commissural' | 'projection';
export type StudyVisualSpec =
  | { kind: 'region'; region: StudyRegion; view?: StudyView }
  | { kind: 'direction'; direction: StudyDirection; view?: StudyView }
  | { kind: 'view'; view: StudyView }
  | { kind: 'tract'; tract: StudyTract; view?: StudyView }
  | { kind: 'plane'; plane: 'sagittal' | 'coronal' | 'horizontal' };
type Vec3 = readonly [number, number, number];
type StudyMesh = { id: string; kind: string; hemisphere: string; positions: string; triangles: string; faceRegions?: string; regions?: string[] };
export type StudyAtlas = { version: number; metadata: { coordinates: { x: string; y: string; z: string } }; meshes: StudyMesh[] };
type DecodedMesh = { id: string; kind: string; hemisphere: string; points: Vec3[]; triangles: number[]; faceRegions: number[]; regions: string[] };
type VisualOptions = { revealed?: boolean };
type Projection = (point: Vec3) => [number, number, number];
export type StudyVisualFrame = { view: StudyView; scale: number; centerX: number; centerY: number; width: number; height: number; eye: Vec3; right: Vec3; up: Vec3 };
type RenderOptions = VisualOptions & { label?: string; description?: string; companion?: boolean; overlay?: (project: Projection) => string };
const WIDTH = 640, HEIGHT = 390;
const names: Record<string, string> = {
  frontal: 'Frontal lobe', parietal: 'Parietal lobe', temporal: 'Temporal lobe', occipital: 'Occipital lobe',
  cerebellum: 'Cerebellum', 'basal-ganglia': 'Basal ganglia',
  lateral: 'Lateral', medial: 'Medial', superior: 'Superior', inferior: 'Inferior', anterior: 'Anterior', posterior: 'Posterior',
  dorsal: 'Dorsal', ventral: 'Ventral', rostral: 'Rostral', caudal: 'Caudal',
  sagittal: 'Sagittal plane', coronal: 'Coronal plane', horizontal: 'Horizontal plane', oblique: 'Oblique',
  association: 'Association tract', commissural: 'Commissural tract', projection: 'Projection tract',
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
const cameras: Record<StudyView, { eye: Vec3; right: Vec3; up: Vec3 }> = {
  lateral: { eye: [-1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  medial: { eye: [1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  superior: { eye: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  inferior: { eye: [0, -1, 0], right: [-1, 0, 0], up: [0, 0, 1] },
  anterior: { eye: [0, 0, 1], right: [-1, 0, 0], up: [0, 1, 0] },
  posterior: { eye: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0] },
  oblique: (() => { const eye = unit([-1, .46, .7]), right = unit(cross(eye, [0, 1, 0])); return { eye, right, up: unit(cross(right, eye)) }; })(),
};

/** Source coordinates are R,S,A. Result is screen-right, screen-UP, depth.
 * The source swaps the last two RAS axes, so camera bases are explicit. */
export function projectStudyPoint(point: Vec3, view: StudyView): [number, number, number] {
  const camera = cameras[view];
  return [dot(point, camera.right), dot(point, camera.up), dot(point, camera.eye)];
}

/** Direction arrows describe the cerebrum, not the bent spinal neuraxis. */
export function getStudyDirectionArrow(direction: StudyDirection): { from: Vec3; to: Vec3 } {
  if (direction === 'medial') return { from: [53, 35, 5], to: [4, 35, 5] };
  if (direction === 'lateral') return { from: [4, 35, 5], to: [53, 35, 5] };
  if (direction === 'anterior' || direction === 'rostral') return { from: [-58, 12, -26], to: [-58, 12, 47] };
  if (direction === 'posterior' || direction === 'caudal') return { from: [-58, 12, 47], to: [-58, 12, -26] };
  if (direction === 'superior' || direction === 'dorsal') return { from: [-58, -24, 4], to: [-58, 52, 4] };
  return { from: [-58, 52, 4], to: [-58, -24, 4] };
}

/** Illustrative connection topology, not a measured individual tract. These
 * four points define a cubic Bezier curve; no signaling direction is implied. */
export function getStudyTractPath(tract: StudyTract): Vec3[] {
  if (tract === 'association') return [[-41, 39, 52], [-57, 55, 31], [-55, 53, -15], [-39, 49, -38]];
  if (tract === 'commissural') return [[-48, 23, 12], [-23, 43, 12], [23, 43, 12], [48, 23, 12]];
  return [[-38, 48, 13], [-27, 21, 11], [-9, -12, -11], [-7, -64, -24]];
}

const decoded = new WeakMap<StudyAtlas, DecodedMesh[]>();
function decodeAtlas(atlas: StudyAtlas): DecodedMesh[] {
  const cached = decoded.get(atlas); if (cached) return cached;
  if (atlas.version !== 1 || atlas.metadata.coordinates.x !== 'right' || atlas.metadata.coordinates.y !== 'superior' || atlas.metadata.coordinates.z !== 'anterior') throw new Error('Unsupported study atlas coordinates');
  const bytes = (encoded: string) => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const words = (encoded: string, signed = false) => { const b = bytes(encoded), view = new DataView(b.buffer); return Array.from({ length: b.length / 2 }, (_, i) => signed ? view.getInt16(i * 2, true) / 100 : view.getUint16(i * 2, true)); };
  const meshes = atlas.meshes.map(mesh => {
    const values = words(mesh.positions, true), points: Vec3[] = [];
    for (let n = 0; n < values.length; n += 3) points.push([values[n], values[n + 1], values[n + 2]]);
    return { ...mesh, points, triangles: words(mesh.triangles), faceRegions: mesh.faceRegions ? Array.from(bytes(mesh.faceRegions)) : [], regions: mesh.regions || [] };
  });
  decoded.set(atlas, meshes); return meshes;
}

function visualView(spec: StudyVisualSpec): StudyView {
  if (spec.kind === 'plane') return 'oblique';
  if (spec.view) return spec.view;
  if (spec.kind === 'tract') return spec.tract === 'projection' ? 'anterior' : 'superior';
  if (spec.kind === 'region' && spec.region === 'basal-ganglia') return 'oblique';
  if (spec.kind === 'direction' && ['medial', 'lateral'].includes(spec.direction)) return 'superior';
  return 'lateral';
}
function answerLabel(spec: StudyVisualSpec): string {
  return spec.kind === 'region' ? names[spec.region] : spec.kind === 'direction' ? names[spec.direction] : spec.kind === 'plane' ? names[spec.plane] : spec.kind === 'tract' ? names[spec.tract] : `${names[spec.view]} view`;
}
function description(spec: StudyVisualSpec, revealed: boolean): string {
  if (revealed) return `Wireframe illustration: ${answerLabel(spec)}.`;
  if (spec.kind === 'region') return 'An unlabeled brain region is brighter, filled and outlined within a dim wireframe brain. Identify the highlighted region.';
  if (spec.kind === 'direction') return 'A bright arrow crosses a fixed wireframe brain. Identify the anatomical direction toward the arrowhead.';
  if (spec.kind === 'plane') return 'A translucent flat marker intersects a whole wireframe brain. Identify the anatomical section plane.';
  if (spec.kind === 'tract') return 'A bright yellow connection with pale endpoints is highlighted within a wireframe brain. Identify the fiber class from the regions it connects.';
  return 'A fixed, unlabeled wireframe brain is shown from one anatomical viewpoint. Identify the view.';
}
const format = (n: number) => n.toFixed(1);
const pointText = (p: readonly number[]) => `${format(p[0])},${format(p[1])}`;
const pathTag = (d: string, className: string) => d ? `<path class="${className}" d="${d}"/>` : '';

/** Pure renderer: suitable for static verification and snapshots without a
 * browser or GPU. Unrevealed markup deliberately contains no answer label. */
export function buildStudyVisual(spec: StudyVisualSpec, atlas: StudyAtlas, options: VisualOptions = {}): string {
  return buildAnatomyVisual(spec, atlas, options);
}

export function getStudyVisualFrame(spec: StudyVisualSpec, atlas: StudyAtlas): StudyVisualFrame {
  const view = visualView(spec), meshes = decodeAtlas(atlas);
  const planeAxis = spec.kind === 'plane' ? ({ sagittal: 0, coronal: 2, horizontal: 1 } as const)[spec.plane] : null;
  const planeCorners: Vec3[] = planeAxis === null ? [] : planeAxis === 0 ? [[0, -90, -104], [0, 89, -104], [0, 89, 104], [0, -90, 104]] : planeAxis === 2 ? [[-88, -90, 0], [88, -90, 0], [88, 89, 0], [-88, 89, 0]] : [[-88, 0, -104], [88, 0, -104], [88, 0, 104], [-88, 0, 104]];
  const external = meshes.filter(mesh => mesh.kind !== 'internal' && (view !== 'lateral' && view !== 'medial' || mesh.hemisphere !== 'right'));
  const allPoints = external.flatMap(mesh => mesh.points.map(point => projectStudyPoint(point, view)));
  allPoints.push(...planeCorners.map(point => projectStudyPoint(point, view)));
  const minX = Math.min(...allPoints.map(p => p[0])), maxX = Math.max(...allPoints.map(p => p[0]));
  const minY = Math.min(...allPoints.map(p => p[1])), maxY = Math.max(...allPoints.map(p => p[1]));
  const scale = Math.min(440 / (maxX - minX), 285 / (maxY - minY));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  return { view, scale, centerX, centerY, width: WIDTH, height: HEIGHT, ...cameras[view] };
}

function buildAnatomyVisual(spec: StudyVisualSpec, atlas: StudyAtlas, options: RenderOptions = {}): string {
  const { view, scale, centerX, centerY } = getStudyVisualFrame(spec, atlas), camera = cameras[view], meshes = decodeAtlas(atlas);
  const deep = spec.kind === 'region' && spec.region === 'basal-ganglia';
  const planeAxis = spec.kind === 'plane' ? ({ sagittal: 0, coronal: 2, horizontal: 1 } as const)[spec.plane] : null;
  const planeCorners: Vec3[] = planeAxis === null ? [] : planeAxis === 0 ? [[0, -90, -104], [0, 89, -104], [0, 89, 104], [0, -90, 104]] : planeAxis === 2 ? [[-88, -90, 0], [88, -90, 0], [88, 89, 0], [-88, 89, 0]] : [[-88, 0, -104], [88, 0, -104], [88, 0, 104], [-88, 0, 104]];
  const external = meshes.filter(mesh => mesh.kind !== 'internal' && (view !== 'lateral' && view !== 'medial' || mesh.hemisphere !== 'right'));
  const project = (point: Vec3): [number, number, number] => { const p = projectStudyPoint(point, view); return [WIDTH / 2 + (p[0] - centerX) * scale, HEIGHT / 2 - (p[1] - centerY) * scale, p[2]]; };
  const trianglePath = (p: readonly number[][]) => `M${pointText(p[0])}L${pointText(p[1])}L${pointText(p[2])}Z`;
  const layers: { depth: number; context: string; silhouette: string; highlighted: string }[] = [];
  let intersections = '', highlightOutline = '';
  const chosen = [...external, ...(deep ? meshes.filter(mesh => mesh.kind === 'internal') : [])];
  for (const mesh of chosen) {
    const projected = mesh.points.map(project), context: string[] = [], highlighted: string[] = [];
    const edgeFaces = new Map<string, { a: number; b: number; visible: number; hidden: number; target: number; other: number }>();
    let depth = 0, silhouette = '';
    for (const p of projected) depth += p[2];
    for (let n = 0; n < mesh.triangles.length; n += 3) {
      const ids = mesh.triangles.slice(n, n + 3), vertices = ids.map(i => mesh.points[i]);
      // The medial image shows the inward surface of the left hemisphere;
      // right halves of bilateral context are removed with that hemisphere.
      if (view === 'medial' && mesh.hemisphere === 'bilateral' && vertices.every(p => p[0] > 0)) continue;
      const normal = cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0]));
      const visible = dot(normal, camera.eye) > 0;
      const region = mesh.regions[mesh.faceRegions[n / 3]] || '';
      const target = spec.kind === 'region' && (deep ? mesh.kind === 'internal' : spec.region === 'cerebellum' ? mesh.id === 'cerebellum' : region.startsWith(`${spec.region}-`));
      const poly = ids.map(i => projected[i]);
      if (visible) (target ? highlighted : context).push(trianglePath(poly));
      for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edgeFaces.has(key)) edgeFaces.set(key, { a, b, visible: 0, hidden: 0, target: 0, other: 0 });
        const edge = edgeFaces.get(key)!; edge[visible ? 'visible' : 'hidden']++; if (visible) edge[target ? 'target' : 'other']++;
      }
      if (planeAxis !== null) {
        const cuts: Vec3[] = [];
        for (let a = 0; a < 3; a++) { const b = (a + 1) % 3, pa = vertices[a], pb = vertices[b], va = pa[planeAxis], vb = pb[planeAxis];
          if ((va < 0 && vb >= 0) || (vb < 0 && va >= 0)) { const t = va / (va - vb); cuts.push([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t]); }
        }
        if (cuts.length === 2) intersections += `M${pointText(project(cuts[0]))}L${pointText(project(cuts[1]))}`;
      }
    }
    for (const edge of edgeFaces.values()) {
      const d = `M${pointText(projected[edge.a])}L${pointText(projected[edge.b])}`;
      if (edge.visible && edge.hidden) silhouette += d;
      if (edge.target && (edge.other || edge.hidden || edge.visible === 1)) highlightOutline += d;
    }
    layers.push({ depth: depth / projected.length, context: context.join(''), silhouette, highlighted: highlighted.join('') });
  }
  layers.sort((a, b) => a.depth - b.depth);
  // Keep silhouettes in their mesh's painter layer. Drawing every silhouette
  // last would reveal the cerebellum through the top of an opaque hemisphere.
  let body = layers.map(layer => pathTag(layer.context, 'study-mesh') + pathTag(layer.silhouette, 'study-silhouette')).join('');
  if (planeAxis !== null) {
    body += `<polygon class="study-plane" points="${planeCorners.map(point => pointText(project(point))).join(' ')}"/>` + pathTag(intersections, 'study-section');
  }
  body += layers.map(layer => pathTag(layer.highlighted, 'study-highlight')).join('') + pathTag(highlightOutline, 'study-highlight-edge');
  if (spec.kind === 'tract') {
    const midA = project([0, 45, -84]), midB = project([0, 45, 87]);
    if (view === 'superior') body += `<path class="study-midline" d="M${pointText(midA)}L${pointText(midB)}"/><text class="study-landmark" x="${format(midB[0])}" y="${format(midB[1] - 13)}" text-anchor="middle">MIDLINE</text>`;
    const points = getStudyTractPath(spec.tract).map(project);
    const connection = `M${pointText(points[0])}C${pointText(points[1])} ${pointText(points[2])} ${pointText(points[3])}`;
    body += pathTag(connection, 'study-tract-shadow') + pathTag(connection, 'study-tract-glow') + pathTag(connection, 'study-tract') + pathTag(connection, 'study-tract-core');
    for (const point of [points[0], points[3]]) body += `<circle class="study-tract-endpoint" cx="${format(point[0])}" cy="${format(point[1])}" r="6"/>`;
  }
  if (spec.kind === 'direction') {
    if (spec.direction === 'medial' || spec.direction === 'lateral') {
      const a = project([0, 45, -82]), b = project([0, 45, 86]);
      body += `<path class="study-midline" d="M${pointText(a)}L${pointText(b)}"/><text class="study-landmark" x="${format(b[0])}" y="${format(b[1] - 13)}" text-anchor="middle">MIDLINE</text>`;
    }
    const arrow = getStudyDirectionArrow(spec.direction), from = project(arrow.from), to = project(arrow.to);
    const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    const wingA = [to[0] - ux * 18 + uy * 10, to[1] - uy * 18 - ux * 10], wingB = [to[0] - ux * 18 - uy * 10, to[1] - uy * 18 + ux * 10];
    const line = `M${pointText(from)}L${pointText(to)}`;
    body += pathTag(line, 'study-arrow-shadow') + pathTag(line, 'study-arrow') + `<path class="study-arrowhead" d="M${pointText(wingA)}L${pointText(to)}L${pointText(wingB)}"/><circle class="study-arrow-origin" cx="${format(from[0])}" cy="${format(from[1])}" r="5"/>`;
  }
  // Basic landmarks orient the task, but the tested term is never printed.
  if ((spec.kind === 'direction' || spec.kind === 'region') && view === 'lateral') {
    const face = project([-38, -7, 82]);
    body += `<text class="study-landmark" x="${format(face[0] - 24)}" y="${format(face[1])}" text-anchor="end">FACE</text><path class="study-landmark-line" d="M${format(face[0] - 19)},${format(face[1] - 4)}L${format(face[0] - 4)},${format(face[1] - 4)}"/>`;
  }
  if (options.overlay) body += options.overlay(project);
  const desc = options.description ?? description(spec, !!options.revealed);
  const label = options.label ?? (options.revealed ? answerLabel(spec) : spec.kind === 'region' ? 'IDENTIFY THE HIGHLIGHT' : spec.kind === 'direction' ? 'FOLLOW THE ARROWHEAD' : spec.kind === 'plane' ? 'IDENTIFY THE PLANE' : spec.kind === 'tract' ? 'TRACE THE CONNECTION' : 'IDENTIFY THE VIEW');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${desc}" class="study-wireframe${options.companion ? ' study-wireframe-companion' : ''}${deep ? ' study-wireframe-deep' : ''}${spec.kind === 'view' || spec.kind === 'tract' && view === 'superior' ? ' study-wireframe-surface' : ''}"><title>${desc}</title><style>
    .study-mesh{fill:#102a35;fill-opacity:.16;stroke:#66cadf;stroke-width:.55;stroke-opacity:.34;stroke-linejoin:round}.study-silhouette{fill:none;stroke:#b7f1fa;stroke-width:1.1;stroke-opacity:.62}.study-highlight{fill:#efbf78;fill-opacity:.24;stroke:#ffe6b9;stroke-width:.85;stroke-opacity:.94;stroke-linejoin:round}.study-highlight-edge{fill:none;stroke:#fff0cf;stroke-width:1.9;stroke-linejoin:round}.study-wireframe-deep .study-mesh{fill:none;stroke-opacity:.16}.study-wireframe-deep .study-silhouette{stroke-opacity:.28}.study-wireframe-deep .study-highlight{fill-opacity:.48;stroke-width:.9}.study-plane{fill:#ffd28a;fill-opacity:.16;stroke:#ffe0a7;stroke-width:1.9;stroke-dasharray:9 5}.study-section{fill:none;stroke:#fff0cc;stroke-width:1.8;stroke-linejoin:round}.study-arrow-shadow{fill:none;stroke:#03101b;stroke-width:12;stroke-linecap:round}.study-arrow{fill:none;stroke:#ffe7b5;stroke-width:5;stroke-linecap:round}.study-arrowhead{fill:none;stroke:#fff3d5;stroke-width:5;stroke-linejoin:round;stroke-linecap:round}.study-arrow-origin{fill:#071724;stroke:#ffe7b5;stroke-width:2}.study-midline{fill:none;stroke:#c4e9f2;stroke-width:1.4;stroke-dasharray:4 5}.study-landmark,.study-visual-label{fill:#bed9e4;font:500 12px ui-monospace,monospace;letter-spacing:1.4px}.study-landmark-line{stroke:#bed9e4;stroke-width:1}.study-visual-label{fill:#e7f7fb;font-size:13px;letter-spacing:2px}.study-frame{fill:none;stroke:#67bdce;stroke-width:.8;stroke-opacity:.3}
    .study-wireframe-surface .study-mesh{fill:#081923;fill-opacity:1;stroke-opacity:.52}.study-tract-shadow{fill:none;stroke:#03101b;stroke-width:13;stroke-linecap:round}.study-tract-glow{fill:none;stroke:#ffe066;stroke-width:16;stroke-opacity:.16;stroke-linecap:round}.study-tract{fill:none;stroke:#ffe066;stroke-width:7;stroke-linecap:round}.study-tract-core{fill:none;stroke:#fff6cf;stroke-width:2;stroke-linecap:round}.study-tract-endpoint{fill:#fff6cf;stroke:#07131f;stroke-width:2}
    .study-wireframe-companion .study-landmark{font-size:20px;letter-spacing:.9px;paint-order:stroke;stroke:#07131f;stroke-width:3px;stroke-linejoin:round}.study-wireframe-companion .study-visual-label{font-size:20px;letter-spacing:1.2px}
    </style><path class="study-frame" d="M25 52V30H47 M593 30H615V52 M25 338V360H47 M593 360H615V338"/>${body}<text class="study-visual-label" x="320" y="378" text-anchor="middle">${label}</text></svg>`;
}

export type DirectionCompanionTerm = 'superior' | 'inferior' | 'anterior' | 'posterior' | 'medial' | 'lateral' | 'ipsilateral' | 'contralateral';
const companionTerms: Record<DirectionCompanionTerm, { label: string; explanation: string }> = {
  superior: { label: 'Dorsal / superior', explanation: 'Toward the top of the forebrain. The arrow points upward; ventral (inferior) points the opposite way.' },
  inferior: { label: 'Ventral / inferior', explanation: 'Toward the bottom of the forebrain. The arrow points downward; dorsal (superior) points the opposite way.' },
  anterior: { label: 'Anterior / rostral', explanation: 'Toward the front of the forebrain, near the face. The arrow points toward the FACE landmark.' },
  posterior: { label: 'Posterior / caudal', explanation: 'Toward the back of the forebrain, away from the face. The arrow points away from the FACE landmark.' },
  medial: { label: 'Medial', explanation: 'Toward the midline between the two hemispheres. The arrow moves inward toward the dashed line.' },
  lateral: { label: 'Lateral', explanation: 'Away from the midline between the two hemispheres. The arrow moves outward from the dashed line.' },
  ipsilateral: { label: 'Ipsilateral', explanation: 'On the same side. The circle A and diamond B are both in the left hemisphere, so B is ipsilateral to A.' },
  contralateral: { label: 'Contralateral', explanation: 'On the opposite side. Circle A is in the left hemisphere and diamond B is in the right, so B is contralateral to A.' },
};
const companionPairs: { label: string; terms: [DirectionCompanionTerm, DirectionCompanionTerm] }[] = [
  { label: 'Top / bottom', terms: ['superior', 'inferior'] },
  { label: 'Front / back', terms: ['anterior', 'posterior'] },
  { label: 'Midline', terms: ['medial', 'lateral'] },
  { label: 'Same / opposite side', terms: ['ipsilateral', 'contralateral'] },
];

/** Example positions compare laterality only. They are not tract endpoints,
 * specific named structures, or a claim about connectivity. */
export function getStudySideComparison(relation: 'ipsilateral' | 'contralateral'): { reference: Vec3; comparison: Vec3 } {
  return { reference: [-37, 45, 36], comparison: [relation === 'ipsilateral' ? -43 : 43, 45, -28] };
}

/** Companion rendering shares the measured atlas and its camera fitting with
 * retrieval illustrations. All teaching labels are withheld until revealed. */
export function buildDirectionCompanionVisual(term: DirectionCompanionTerm, atlas: StudyAtlas, options: VisualOptions = {}): string {
  if (!options.revealed) return buildAnatomyVisual({ kind: 'view', view: 'lateral' }, atlas, {
    companion: true,
    label: 'RECALL THE DIRECTIONS',
    description: 'Unlabeled wireframe brain for recalling anatomical direction terms. Reveal the answer to explore the explanations.',
  });
  const comparison = term === 'ipsilateral' || term === 'contralateral';
  const top = comparison || term === 'medial' || term === 'lateral';
  const view: StudyView = top ? 'superior' : 'lateral';
  const data = companionTerms[term];
  return buildAnatomyVisual(comparison ? { kind: 'view', view } : { kind: 'direction', direction: term, view }, atlas, {
    companion: true,
    revealed: true,
    label: data.label.toUpperCase(),
    description: `${data.label}. ${data.explanation}`,
    overlay: project => {
      let overlay = `<text class="study-landmark" x="43" y="54">${top ? 'VIEW FROM ABOVE' : 'SIDE VIEW'}</text>`;
      if (top) {
        const left = project([-40, 45, 76]), right = project([40, 45, 76]);
        overlay += `<text class="study-landmark" x="${format(left[0])}" y="${format(left[1])}" text-anchor="middle">LEFT</text><text class="study-landmark" x="${format(right[0])}" y="${format(right[1])}" text-anchor="middle">RIGHT</text>`;
      }
      if (comparison) {
        const from = project([0, 45, -82]), to = project([0, 45, 86]);
        overlay += `<path class="study-midline" d="M${pointText(from)}L${pointText(to)}"/><text class="study-landmark" x="${format(to[0])}" y="${format(to[1] - 13)}" text-anchor="middle">MIDLINE</text>`;
        const points = getStudySideComparison(term), a = project(points.reference), b = project(points.comparison);
        overlay += `<circle cx="${format(a[0])}" cy="${format(a[1])}" r="22" fill="#071724" stroke="#effaff" stroke-width="3"/><text x="${format(a[0])}" y="${format(a[1] + 7)}" text-anchor="middle" fill="#effaff" font-family="ui-monospace,monospace" font-size="22" font-weight="700">A</text>`;
        overlay += `<path d="M${format(b[0])},${format(b[1] - 27)}L${format(b[0] + 27)},${format(b[1])}L${format(b[0])},${format(b[1] + 27)}L${format(b[0] - 27)},${format(b[1])}Z" fill="#ffe7b5" stroke="#071724" stroke-width="3"/><text x="${format(b[0])}" y="${format(b[1] + 7)}" text-anchor="middle" fill="#071724" font-family="ui-monospace,monospace" font-size="22" font-weight="700">B</text>`;
      }
      return overlay;
    },
  });
}

let atlasPromise: Promise<StudyAtlas> | undefined;
function loadAtlas(): Promise<StudyAtlas> {
  atlasPromise ||= fetch('/brain/models/study-wireframe.json').then(response => { if (!response.ok) throw new Error(`Study illustration ${response.status}`); return response.json() as Promise<StudyAtlas>; }).catch(error => { atlasPromise = undefined; throw error; });
  return atlasPromise;
}

/** The intro's measured 3D model is the primary anatomy layer. SVG retains
 * accessible labels and precisely aligned teaching marks, and is the fallback. */
function createStudyGraphic(graphic: HTMLElement, atlas: StudyAtlas) {
  const modelHost = document.createElement('div'); modelHost.className = 'portal-study-model-host'; modelHost.setAttribute('aria-hidden', 'true');
  const annotations = document.createElement('div'); annotations.className = 'portal-study-model-annotations';
  graphic.replaceChildren(modelHost, annotations);
  let disposed = false, spec: StudyVisualSpec | undefined;
  let model: ReturnType<typeof import('./study-model').mountStudyModel> | undefined;
  const modelOptions = (current: StudyVisualSpec) => ({
    atlas,
    deep: current.kind === 'region' && current.region === 'basal-ganglia',
    surface: current.kind === 'view' || current.kind === 'tract' && visualView(current) === 'superior',
    onAvailabilityChange: (available: boolean) => { if (!disposed) graphic.classList.toggle('portal-study-model-active', available); },
  });
  void import('./study-model').then(({ mountStudyModel }) => {
    if (disposed || !graphic.isConnected || !spec) return;
    model = mountStudyModel(modelHost, getStudyVisualFrame(spec, atlas), modelOptions(spec));
  }).catch(() => { /* The complete, accessible static illustration remains. */ });
  return {
    render(markup: string, current: StudyVisualSpec) {
      if (disposed) return;
      spec = current; annotations.innerHTML = markup;
      graphic.setAttribute('aria-busy', 'false');
      model?.update(getStudyVisualFrame(current, atlas), modelOptions(current));
    },
    dispose() { disposed = true; model?.dispose(); graphic.classList.remove('portal-study-model-active'); },
  };
}

/** Stable native buttons preserve keyboard focus as diagrams change. A shared
 * atlas fetch is guarded against card flips, navigation and late completion. */
export function mountDirectionCompanion(container: HTMLElement, options: { revealed: boolean }): () => void {
  let disposed = false, atlas: StudyAtlas | undefined, pairIndex = 0, termIndex = 0;
  let illustration: ReturnType<typeof createStudyGraphic> | undefined;
  const figure = document.createElement('figure'); figure.className = 'portal-study-visual portal-direction-companion';
  const heading = document.createElement('p'); heading.className = 'portal-direction-heading'; heading.textContent = options.revealed ? 'Explore the directions' : 'Picture the directions';
  const graphic = document.createElement('div'); graphic.className = 'portal-study-visual-graphic'; graphic.setAttribute('aria-busy', 'true');
  const status = document.createElement('p'); status.className = 'portal-study-visual-status'; status.textContent = 'Loading anatomy.'; status.setAttribute('role', 'status'); graphic.append(status);
  const caption = document.createElement('figcaption');
  const explanation = document.createElement('p'); explanation.className = 'portal-direction-explanation';
  const context = document.createElement('p'); context.className = 'portal-direction-context';
  const credit = document.createElement('a'); credit.textContent = 'Allen atlas · CC BY 4.0'; credit.className = 'portal-study-visual-credit';
  credit.href = '/brain/models/credits.json'; credit.target = '_blank'; credit.rel = 'noopener';
  credit.title = 'Allen Institute / Ding et al. (2020), Allen Human Reference Atlas - 3D. Geometry simplified from the site atlas; CC BY 4.0.';
  const pairButtons: HTMLButtonElement[] = [], termButtons: HTMLButtonElement[] = [];
  const selected = () => companionPairs[pairIndex].terms[termIndex];
  const redraw = () => {
    if (disposed) return;
    if (atlas) {
      illustration ||= createStudyGraphic(graphic, atlas);
      const term = selected(), comparison = term === 'ipsilateral' || term === 'contralateral';
      const spec: StudyVisualSpec = !options.revealed ? { kind: 'view', view: 'lateral' }
        : comparison ? { kind: 'view', view: 'superior' }
        : { kind: 'direction', direction: term, view: term === 'medial' || term === 'lateral' ? 'superior' : 'lateral' };
      illustration.render(buildDirectionCompanionVisual(term, atlas, options), spec);
    }
    if (!options.revealed) return;
    pairButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === pairIndex)));
    termButtons.forEach((button, index) => { button.textContent = companionTerms[companionPairs[pairIndex].terms[index]].label; button.setAttribute('aria-pressed', String(index === termIndex)); });
    const term = selected(), data = companionTerms[term];
    explanation.textContent = `${data.label}: ${data.explanation}`;
    context.textContent = term === 'ipsilateral' || term === 'contralateral'
      ? 'A is the reference. These are illustrative locations, not a tract or a signal path.'
      : 'Terms here apply to the forebrain. A fixed view keeps the orientation clear.';
  };
  figure.append(heading);
  if (options.revealed) {
    const pairs = document.createElement('div'); pairs.className = 'portal-direction-pairs'; pairs.setAttribute('role', 'group'); pairs.setAttribute('aria-label', 'Choose a direction pair');
    companionPairs.forEach((pair, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = pair.label;
      button.addEventListener('click', event => { event.stopPropagation(); pairIndex = index; termIndex = 0; redraw(); });
      pairButtons.push(button); pairs.append(button);
    });
    const terms = document.createElement('div'); terms.className = 'portal-direction-terms'; terms.setAttribute('role', 'group'); terms.setAttribute('aria-label', 'Choose the term to illustrate');
    for (let index = 0; index < 2; index++) {
      const button = document.createElement('button'); button.type = 'button';
      button.addEventListener('click', event => { event.stopPropagation(); termIndex = index; redraw(); });
      termButtons.push(button); terms.append(button);
    }
    figure.append(pairs, terms);
    explanation.setAttribute('role', 'status'); explanation.setAttribute('aria-live', 'polite'); explanation.setAttribute('aria-atomic', 'true');
  } else {
    explanation.textContent = 'Recall the terms before you flip. Then use this model to compare each pair and see what it means.';
    context.textContent = 'Teaching labels appear with the answer.';
  }
  caption.append(explanation, context); figure.append(graphic, caption, credit); container.append(figure); redraw();
  void loadAtlas().then(result => { if (disposed || !figure.isConnected) return; atlas = result; redraw(); }).catch(() => {
    if (disposed || !figure.isConnected) return; graphic.setAttribute('aria-busy', 'false'); status.textContent = options.revealed ? 'The companion model could not load. The written explanation is still available; reload to restore the model.' : 'The companion model could not load. Flip for the written answer; reload to restore the model.'; status.classList.add('is-error');
  });
  return () => { disposed = true; illustration?.dispose(); figure.remove(); };
}

/** Mount returns a cancellation/cleanup function. A late shared fetch cannot
 * populate an old question after navigation or a flashcard flip. */
export function mountStudyVisual(container: HTMLElement, spec: StudyVisualSpec, options: VisualOptions = {}): () => void {
  let disposed = false;
  let illustration: ReturnType<typeof createStudyGraphic> | undefined;
  const figure = document.createElement('figure'); figure.className = 'portal-study-visual';
  const graphic = document.createElement('div'); graphic.className = 'portal-study-visual-graphic'; graphic.setAttribute('aria-busy', 'true');
  const status = document.createElement('p'); status.className = 'portal-study-visual-status'; status.textContent = 'Loading anatomy…'; status.setAttribute('role', 'status'); graphic.append(status);
  const caption = document.createElement('figcaption');
  caption.textContent = spec.kind === 'region' && spec.region === 'basal-ganglia' ? 'Outer brain shown transparently to reveal the highlighted deep structures.' : spec.kind === 'view' && spec.view === 'medial' ? 'Opposite hemisphere removed to expose the surface facing the midline.' : spec.kind === 'plane' ? 'A flat marker passes through the whole brain. The line follows its surface intersection.' : spec.kind === 'direction' ? 'Fixed view. Read the direction toward the arrowhead; terms apply to the cerebrum.' : 'Fixed anatomical view. Identify the brighter, filled region with the pale outline.';
  if (spec.kind === 'view' && spec.view !== 'medial') caption.textContent = 'Fixed anatomical view. Use the visible surfaces and the shape of the brain.';
  if (spec.kind === 'tract') caption.textContent = 'Simplified connection path, not a measured individual tract. Pale dots mark the connected regions; no signaling direction is implied.';
  const credit = document.createElement('a'); credit.textContent = 'Allen atlas · CC BY 4.0'; credit.className = 'portal-study-visual-credit';
  credit.href = '/brain/models/credits.json'; credit.target = '_blank'; credit.rel = 'noopener';
  credit.title = 'Allen Institute / Ding et al. (2020), Allen Human Reference Atlas – 3D. Geometry simplified from the site atlas; CC BY 4.0.';
  figure.append(graphic, caption, credit); container.append(figure);
  void loadAtlas().then(atlas => { if (disposed || !figure.isConnected) return; illustration = createStudyGraphic(graphic, atlas); illustration.render(buildStudyVisual(spec, atlas, options), spec); }).catch(() => {
    if (disposed || !figure.isConnected) return; graphic.setAttribute('aria-busy', 'false'); status.textContent = 'The anatomy illustration could not load. Reload this page before answering this visual question.'; status.classList.add('is-error');
  });
  return () => { disposed = true; illustration?.dispose(); figure.remove(); };
}
