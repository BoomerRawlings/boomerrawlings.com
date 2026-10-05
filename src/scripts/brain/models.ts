import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type BrainTopic = { id: string; title: string; scene: string; modelTarget?: string; category?: string; color?: string };
export type BrainViewer = {
  setTopic(topic: BrainTopic): void;
  setMode(scene: string, target?: string): void;
  setExploded(value: boolean): void;
  setLabels(value: boolean): void;
  setPlaying(value: boolean): void;
  setView(view: 'lateral' | 'superior' | 'anterior'): void;
  reset(): void; resize(): void; dispose(): void;
};
type Options = { onSelect?: (id: string) => void; onStatus?: (text: string) => void };
type AtlasMesh = { id: string; name: string; kind: string; hemisphere?: string; positions: number[]; indices: number[] };
type Atlas = { metadata?: unknown; meshes: AtlasMesh[] };
type Receptor = { metadata?: unknown; chains: { id: string; name?: string; points?: number[][]; segments?: number[][][] }[] };
type Label = { element: HTMLDivElement; object: THREE.Object3D; point: THREE.Vector3 };
type Part = { object: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 };
type Atom = [string, number, number, number?];
type Bond = [number, number, number?];
const C = { pearl: 0xdbe9ed, teal: 0x62f0df, pink: 0xef77ca, amber: 0xffc676, blue: 0x79baff, muted: 0x577880, violet: 0xb1a3ff };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
let atlasPromise: Promise<Atlas> | undefined;
let receptorPromise: Promise<Receptor> | undefined;
async function getAtlas(): Promise<Atlas> {
  return atlasPromise ??= fetch('/brain/models/atlas.json').then(r => { if (!r.ok) throw new Error('Atlas unavailable'); return r.json(); }).catch(e => { atlasPromise = undefined; throw e; });
}
async function getReceptor(): Promise<Receptor> {
  return receptorPromise ??= fetch('/brain/models/gaba-a-6d6t.json').then(r => { if (!r.ok) throw new Error('Structure unavailable'); return r.json(); }).catch(e => { receptorPromise = undefined; throw e; });
}

/** All schematic coordinates are illustrative. Atlas meshes retain their shared anatomical frame. */
export async function createBrainViewer(container: HTMLElement, options: Options = {}): Promise<BrainViewer | null> {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { options.onStatus?.('3D unavailable on this device. All study content remains available.'); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x071217, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  renderer.domElement.setAttribute('aria-label', 'Interactive neuroscience model. Drag to rotate; scroll or pinch to zoom.');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.setAttribute('aria-hidden', 'true');
  labelLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2';
  container.appendChild(labelLayer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .05, 100);
  camera.position.set(7.4, 4.0, 9.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.minDistance = 3.8; controls.maxDistance = 22; controls.enablePan = false;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xddefff, 0x263b41, 1.55));
  const key = new THREE.DirectionalLight(0xe8f5ff, 3); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(C.teal, 1.4); rim.position.set(5, 1, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(C.pink, .55); fill.position.set(-5, -1, -2); scene.add(fill);
  const stage = new THREE.Group(); scene.add(stage);
  const ground = new THREE.GridHelper(20, 32, 0x244c53, 0x18343e); ground.position.y = -3.1;
  (ground.material as THREE.Material).transparent = true; (ground.material as THREE.Material).opacity = .20;
  scene.add(ground);
  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(3.9, .008, 6, 120), new THREE.MeshBasicMaterial({ color: 0x46727a, transparent: true, opacity: .45 }));
  orbitRing.rotation.x = Math.PI / 2; orbitRing.position.y = -3.05; scene.add(orbitRing);
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const labels: Label[] = []; const parts: Part[] = [];
  let animations: ((t: number, dt: number) => void)[] = [];
  let layouts: (() => void)[] = [];
  let disposed = false, visible = true, dirty = true, playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches, showLabels = true, exploded = false, explosion = 0;
  let generation = 0, time = 0, previous = 0, frame = 0;
  let current: BrainTopic = { id: 'brain-overview', title: 'Human brain', scene: 'brain', modelTarget: 'brain' };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = (text: string) => options.onStatus?.(text);
  const material = (color: number | string = C.pearl, opacity = 1, emissive = 0): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .12, transparent: opacity < 1, opacity, depthWrite: opacity >= .8, emissive: color, emissiveIntensity: emissive });
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = stage) => { const m = new THREE.Mesh(geometry, mat); parent.add(m); return m; };
  const ball = (position: THREE.Vector3, radius: number, color: number | string, parent: THREE.Object3D = stage, opacity = 1) => { const m = mesh(new THREE.SphereGeometry(radius, 20, 14), material(color, opacity, .06), parent); m.position.copy(position); return m; };
  function tube(points: THREE.Vector3[], radius: number, color: number | string, parent: THREE.Object3D = stage, opacity = 1, segments = 48) {
    const curve = new THREE.CatmullRomCurve3(points);
    const m = mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), material(color, opacity, .14), parent);
    return { mesh: m, curve };
  }
  function link(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number | string, parent: THREE.Object3D = stage, opacity = 1) {
    const delta = b.clone().sub(a), m = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material(color, opacity), parent);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize()); return m;
  }
  function label(text: string, object: THREE.Object3D, point = V()) {
    const el = document.createElement('div'); el.textContent = text;
    el.style.cssText = 'position:absolute;left:0;top:0;padding:5px 8px;border:1px solid #638c9566;border-radius:4px;background:#07171edf;color:#dfedf0;font:500 10px/1.2 ui-monospace,SFMono-Regular,monospace;letter-spacing:.035em;white-space:nowrap;box-shadow:0 3px 18px #0003;will-change:transform';
    labelLayer.appendChild(el); labels.push({ element: el, object, point });
  }
  function selectable(object: THREE.Object3D, id: string) { object.userData.topicId = id; }
  function separable(object: THREE.Object3D, offset: THREE.Vector3) { parts.push({ object, base: object.position.clone(), offset }); }
  function disposeObject(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    object.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) geometries.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(a => materials.add(a)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
  function clear() { disposeObject(stage); stage.clear(); labels.splice(0).forEach(l => l.element.remove()); parts.length = 0; animations = []; layouts = []; explosion = 0; dirty = true; }
  function pulse(curve: THREE.Curve<THREE.Vector3>, color = C.teal, count = 3, speed = .15, parent: THREE.Object3D = stage, radius = .065) {
    const dots = Array.from({ length: count }, () => ball(V(), radius, color, parent));
    animations.push(t => dots.forEach((dot, i) => dot.position.copy(curve.getPointAt((t * speed + i / count) % 1))));
    dots.forEach((dot, i) => dot.position.copy(curve.getPointAt(i / count)));
  }
  function membrane(y: number, parent: THREE.Object3D = stage, span = 7, depth = 2.8) {
    const group = new THREE.Group(); parent.add(group); group.position.y = y;
    const panel = mesh(new THREE.BoxGeometry(span, .16, depth), material(0x38646d, .15), group);
    for (let x = -span / 2; x <= span / 2; x += .34) for (const z of [-depth / 2, depth / 2]) {
      for (const side of [-1, 1]) { ball(V(x, side * .14, z), .10, C.muted, group); link(V(x, side * .13, z), V(x + .025, 0, z), .021, C.muted, group); }
    }
    panel.renderOrder = -1; return group;
  }

  function atlasGeometry(source: AtlasMesh, center: THREE.Vector3, scale: number) {
    const positions = new Float32Array(source.positions.length);
    for (let i = 0; i < positions.length; i += 3) { positions[i] = (source.positions[i] - center.x) * scale; positions[i + 1] = (source.positions[i + 1] - center.y) * scale; positions[i + 2] = (source.positions[i + 2] - center.z) * scale; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (source.indices?.length) geometry.setIndex(source.indices);
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
  }
  function atlasFrame(data: Atlas) {
    const box = new THREE.Box3();
    for (const m of data.meshes) for (let i = 0; i < m.positions.length; i += 3) box.expandByPoint(V(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
    const size = box.getSize(V()); return { center: box.getCenter(V()), scale: 5.8 / Math.max(size.x, size.y, size.z) };
  }
  const atlasTopic = (id: string) => {
    if (/frontal|parietal|temporal|occipital|insula|limbic|hemisphere/.test(id)) return 'cerebral-cortex';
    if (/midbrain|pons|medulla/.test(id)) return 'brainstem';
    if (/caudate|putamen|pallid/.test(id)) return 'basal-ganglia';
    if (/callosum/.test(id)) return 'corpus-callosum';
    if (/fornix|peduncles|white-matter/.test(id)) return 'white-matter';
    if (/ventricle/.test(id)) return 'brain-overview';
    return id;
  };
  async function brain(target: string, token: number, isTracts = false) {
    status('Loading human atlas anatomy…');
    try {
      const data = await getAtlas(); if (disposed || token !== generation) return;
      const { center, scale } = atlasFrame(data), chosen = canonical(target), overview = /^(brain|wholebrain|brainoverview|overview|lobes|cerebralcortex)$/.test(chosen);
      const isMatch = (m: AtlasMesh) => { const id = canonical(m.id); return id.includes(chosen) || (chosen === 'brainstem' && m.kind === 'brainstem') || (chosen === 'basalganglia' && /caudate|putamen|pallid/.test(id)); };
      const selected = data.meshes.filter(isMatch); const exterior = data.meshes.filter(m => m.kind === 'cortex');
      const useShells = exterior.length === 0;
      let labelCount = 0;
      for (const source of data.meshes) {
        if (source.kind === 'shell' && !useShells) continue;
        const cortical = source.kind === 'cortex' || source.kind === 'shell';
        const highlight = isMatch(source), internal = source.kind === 'internal' || source.kind === 'white-matter' || source.kind === 'ventricle';
        if (isTracts && !cortical && source.kind !== 'white-matter' && source.kind !== 'brainstem') continue;
        if (overview && internal && !exploded) continue;
        if (!overview && internal && !highlight && !isTracts) continue;
        const opacity = isTracts ? (cortical ? .075 : .22) : overview ? 1 : highlight ? 1 : cortical ? .12 : .18;
        const color = highlight && !overview ? C.amber : source.kind === 'white-matter' ? C.teal : cortical ? (source.id.includes('temporal') ? 0xc8dce0 : source.id.includes('frontal') ? 0xd6e7e8 : 0xbacecf) : C.pink;
        const geo = atlasGeometry(source, center, scale), m = mesh(geo, material(color, opacity, highlight && !overview ? .14 : 0));
        m.userData.atlas = true; selectable(m, atlasTopic(source.id));
        const midpoint = geo.boundingBox!.getCenter(V());
        let offset = midpoint.clone().multiplyScalar(.22);
        if (source.hemisphere === 'left' || source.id.endsWith('-left')) offset.x -= .8;
        if (source.hemisphere === 'right' || source.id.endsWith('-right')) offset.x += .8;
        if (internal) offset.y += .4;
        separable(m, offset);
        const canLabel = !isTracts && (highlight && !overview || overview && (cortical && !source.id.endsWith('-left') && !/insula|limbic/.test(source.id) || source.kind === 'cerebellum'));
        if (canLabel && labelCount++ < 7) label(source.name || source.id.replaceAll('-', ' '), m, midpoint);
      }
      if (isTracts) {
        buildTracts(target);
        status('Atlas-derived anatomy · Allen human atlas. Colored pathways are teaching schematics, not tractography.');
      } else status(`Atlas-derived anatomy · Allen human atlas${!overview && selected.length === 0 ? ' · selected structure not segmented' : ''}.`);
      dirty = true;
    } catch {
      if (disposed || token !== generation) return;
      if (isTracts) { buildTracts(target); status('Teaching schematic · not to scale. Atlas context unavailable.'); }
      else { status('Atlas could not load. Study notes remain available; select another model or retry.'); }
    }
  }

  function buildTracts(target: string) {
    const chosen = canonical(target), all = /whitematter|tracts|brainoverview/.test(chosen);
    const bundles: { id: string; name: string; color: number; paths: number[][][] }[] = [
      { id: 'corpus-callosum', name: 'Corpus callosum', color: C.teal, paths: [[[-2, .9, .6], [-1.2, 1.45, .2], [0, 1.55, 0], [1.2, 1.45, .2], [2, .9, .6]], [[-1.6, 1.2, -1], [-.8, 1.5, -.9], [0, 1.55, -.7], [.8, 1.5, -.9], [1.6, 1.2, -1]]] },
      { id: 'corticospinal', name: 'Corticospinal pathway', color: C.pink, paths: [[[-1.4, 1.7, .1], [-.8, .5, .2], [-.35, -.5, .15], [-.24, -1.5, .4], [.16, -2.7, .4]], [[1.4, 1.7, .1], [.8, .5, .2], [.35, -.5, .15], [.24, -1.5, .4], [-.16, -2.7, .4]]] },
      { id: 'optic-radiation', name: 'Optic radiations', color: C.amber, paths: [[[-.5, .1, -.3], [-1.3, -.25, .8], [-1.85, -.1, -.8], [-1.3, .5, -2]], [[.5, .1, -.3], [1.3, -.25, .8], [1.85, -.1, -.8], [1.3, .5, -2]]] },
      { id: 'association-fibers', name: 'Association pathways', color: C.blue, paths: [[[-1.8, .1, 1.4], [-2.05, 1.25, .9], [-2, 1.3, -.7], [-1.7, .35, -1.4]], [[1.8, .1, 1.4], [2.05, 1.25, .9], [2, 1.3, -.7], [1.7, .35, -1.4]]] },
      { id: 'dorsal-column', name: 'Dorsal column → medial lemniscus', color: C.violet, paths: [[[-.26, -2.7, -.25], [-.26, -1.55, -.28], [.3, -.8, .2], [.48, .3, .1], [1.45, 1.5, .1]], [[.26, -2.7, -.25], [.26, -1.55, -.28], [-.3, -.8, .2], [-.48, .3, .1], [-1.45, 1.5, .1]]] },
    ];
    for (const bundle of bundles) {
      const active = all || canonical(bundle.id) === chosen, group = new THREE.Group(); stage.add(group);
      if (!active) continue;
      for (const path of bundle.paths) for (let i = 0; i < 5; i++) {
        const points = path.map(p => V(p[0] + (i - 2) * .046, p[1], p[2] + (i - 2) * .05));
        const strand = tube(points, .023, bundle.color, group, .86, 64); selectable(strand.mesh, bundle.id);
        if (i === 2) pulse(strand.curve, bundle.color, 3, .10, group, .048);
      }
      const anchor = bundle.paths[0][1]; label(bundle.name, group, V(...anchor as [number, number, number]));
      separable(group, V((bundles.indexOf(bundle) - 2) * .48, bundles.indexOf(bundle) * .14, .5));
    }
  }

  function neuron(target: string) {
    const glia = /astrocyte|microglia/.test(target), astro = target.includes('astrocyte');
    const soma = ball(V(-1.2, .3), glia ? .53 : .59, glia ? (astro ? C.teal : C.violet) : C.pearl);
    soma.scale.set(1, 1.08, .8); selectable(soma, glia ? (astro ? 'astrocytes' : 'microglia') : 'neuron');
    const nucleus = ball(V(-1.2, .3, .38), .21, C.amber, stage, .8);
    label(glia ? (astro ? 'Astrocyte' : 'Microglial soma') : 'Soma · integrates inputs', soma, V(0, .8));
    if (glia) {
      const paths = astro ? 9 : 6;
      for (let i = 0; i < paths; i++) {
        const angle = i / paths * Math.PI * 2, center = V(-1.2, .3);
        const mid = V(center.x + Math.cos(angle) * 1.15, center.y + Math.sin(angle) * 1.15, Math.sin(i * 2.2) * .35);
        const end = V(center.x + Math.cos(angle) * 2.1, center.y + Math.sin(angle) * 2.1, Math.sin(i * 2.2) * .65);
        const branch = tube([center, mid, end], astro ? .10 : .055, astro ? C.teal : C.violet, stage);
        for (let j = -1; j <= 1; j++) {
          const tip = end.clone().add(V(Math.cos(angle + j * .7) * .35, Math.sin(angle + j * .7) * .35, j * .12));
          tube([mid, end, tip], .022, astro ? C.teal : C.violet);
          if (astro) ball(tip, .105, C.teal);
        }
        if (!astro) animations.push(t => { branch.mesh.scale.z = 1 + Math.sin(t * .6 + i) * .1; });
      }
      if (astro) {
        const vessel = tube([V(1.45, -2.3, -.4), V(1.75, 0, -.4), V(1.45, 2.3, -.4)], .24, C.pink, stage, .65); label('Capillary · endfeet interface', vessel.mesh, V(1.8, -.6, -.4));
      } else { const debris = ball(V(1.6, .7), .18, C.amber); label('Surveillance and debris clearance', debris, V(.1, .45)); }
      status('Teaching schematic · not to scale. Glial shape varies across regions and states.'); return;
    }
    for (let i = 0; i < 7; i++) {
      const angle = (.26 + i / 6 * 1.5) * Math.PI;
      const start = V(-1.2, .3), mid = V(-1.2 + Math.cos(angle) * 1.15, .3 + Math.sin(angle) * 1.2, Math.sin(i * 1.8) * .35);
      const end = V(-1.2 + Math.cos(angle) * 2.0, .3 + Math.sin(angle) * 2.0, Math.sin(i * 1.8) * .65);
      const branch = tube([start, mid, end], .065, target === 'dendrites' ? C.amber : C.pearl); selectable(branch.mesh, 'dendrites');
      for (const side of [-1, 1]) { const tip = end.clone().add(V(side * .38, .32, side * .18)); tube([mid, end, tip], .028, C.pearl); for (let s = 0; s < 3; s++) ball(end.clone().lerp(tip, s / 3).add(V(0, .12, .05)), .045, C.teal); }
    }
    const axon = tube([V(-.8, 0), V(.05, -.6, .1), V(1.7, -.6, .1), V(3.3, -.45, .1)], .07, C.pink, stage, 1, 64); selectable(axon.mesh, 'neuron');
    const myelin = new THREE.Group(); stage.add(myelin);
    for (let i = 0; i < 5; i++) {
      const p = axon.curve.getPointAt(.22 + i * .145), q = axon.curve.getPointAt(.31 + i * .145);
      const sheath = link(p, q, .19, target === 'myelin' ? C.amber : 0x83bcb7, myelin); selectable(sheath, 'myelin');
      link(p, p.clone().lerp(q, .1), .20, C.pearl, myelin, .65);
    }
    separable(myelin, V(0, .95, .3));
    for (let i = 0; i < 3; i++) { const end = V(3.65, -.5 + (i - 1) * .6, (i - 1) * .3); tube([V(3.25, -.45, .1), V(3.4, -.5 + (i - 1) * .3, 0), end], .04, C.pink); ball(end, .13, C.pink); }
    label('Dendritic arbor', stage, V(-2.5, 1.8, .4)); label('Myelin · saltatory conduction', stage, V(1.1, -.95, .2)); label('Axon terminals', stage, V(3.2, .55, .1));
    pulse(axon.curve, C.amber, 2, .15);
    if (target === 'resting-potential' || target === 'membrane') {
      for (let i = 0; i < 14; i++) { const ion = ball(V(-1.2 + Math.cos(i * 2.4) * .93, .3 + Math.sin(i * 2.4) * .93, .2), .047, i % 2 ? C.teal : C.amber); animations.push(t => { ion.position.z = .2 + Math.sin(t + i) * .12; }); }
      label('Resting potential: ion gradients + selective permeability', nucleus, V(1.1, 1.6, 0));
    }
    status('Teaching schematic · not to scale. Moving pulses represent electrical signals.');
  }

  function circuit(target: string) {
    type Node = { label: string; id: string; p: THREE.Vector3; color: number };
    let nodes: Node[]; let edges: [number, number, boolean][];
    if (target.includes('basal')) {
      nodes = [{ label: 'Cortex', id: 'cerebral-cortex', p: V(0, 2), color: C.pearl }, { label: 'Striatum', id: 'basal-ganglia', p: V(-2, .5), color: C.teal }, { label: 'GPe', id: 'basal-ganglia', p: V(-1.9, -1.2), color: C.pink }, { label: 'STN', id: 'basal-ganglia', p: V(.1, -1.6), color: C.amber }, { label: 'GPi / SNr', id: 'basal-ganglia', p: V(1, -.2), color: C.pink }, { label: 'Thalamus', id: 'thalamus', p: V(2.4, .8), color: C.blue }];
      edges = [[0, 1, false], [1, 4, true], [1, 2, true], [2, 3, true], [3, 4, false], [4, 5, true], [5, 0, false], [0, 3, false]];
    } else if (target.includes('hippocamp')) {
      nodes = [{ label: 'Entorhinal cortex', id: 'hippocampal-circuit', p: V(-2.7, 1), color: C.pearl }, { label: 'Dentate gyrus', id: 'hippocampus', p: V(-1, -1.3), color: C.teal }, { label: 'CA3', id: 'hippocampus', p: V(1.1, -1.1), color: C.pink }, { label: 'CA1', id: 'hippocampus', p: V(2.1, 1), color: C.amber }, { label: 'Subiculum', id: 'hippocampal-circuit', p: V(.1, 1.9), color: C.blue }];
      edges = [[0, 1, false], [1, 2, false], [2, 3, false], [3, 4, false], [4, 0, false], [0, 3, false], [2, 2, false]];
    } else if (target.includes('cerebell')) {
      nodes = [{ label: 'Mossy fibers', id: 'cerebellar-circuit', p: V(-2.6, -1.5), color: C.teal }, { label: 'Granule cells', id: 'cerebellum', p: V(-1.4, .3), color: C.blue }, { label: 'Purkinje cell', id: 'cerebellum', p: V(0, 1.6), color: C.pearl }, { label: 'Deep nuclei', id: 'cerebellum', p: V(2, -.6), color: C.amber }, { label: 'Climbing fiber', id: 'cerebellar-circuit', p: V(1.9, 1.6), color: C.pink }];
      edges = [[0, 1, false], [1, 2, false], [2, 3, true], [4, 2, false], [0, 3, false]];
    } else {
      nodes = [{ label: 'Pyramidal cell', id: 'cortical-circuit', p: V(-1.8, .8), color: C.pearl }, { label: 'Excitatory neighbor', id: 'glutamate', p: V(1.8, 1.4), color: C.teal }, { label: 'Interneuron', id: 'gaba', p: V(.5, -1.4), color: C.pink }, { label: 'Thalamic input', id: 'thalamus', p: V(-2.4, -1.5), color: C.amber }];
      edges = [[3, 0, false], [0, 1, false], [1, 0, false], [0, 2, false], [2, 0, true], [2, 1, true]];
    }
    nodes.forEach((n, i) => { const group = new THREE.Group(); group.position.copy(n.p); stage.add(group); const soma = ball(V(), .29, n.color, group); selectable(soma, n.id); for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; tube([V(), V(Math.cos(a) * .42, Math.sin(a) * .42), V(Math.cos(a) * .65, Math.sin(a) * .65, .10)], .018, n.color, group); } label(n.label, group, V(0, .7, 0)); separable(group, V(0, 0, (i % 2 ? -1 : 1) * .7)); });
    edges.forEach(([from, to, inhibitory], i) => {
      const a = nodes[from].p, b = nodes[to].p, mid = a.clone().lerp(b, .5).add(V(0, from === to ? 1.1 : (i % 2 ? .25 : -.25), from === to ? .75 : (i % 2 ? .45 : -.35)));
      const path = tube([a, mid, b], .022, inhibitory ? C.pink : C.teal, stage, .68);
      pulse(path.curve, inhibitory ? C.pink : C.teal, 1, .16 + (i % 3) * .015, stage, .05);
      const endpoint = path.curve.getPointAt(.83), direction = path.curve.getTangentAt(.83).normalize();
      if (inhibitory) { const bar = mesh(new THREE.BoxGeometry(.23, .055, .055), material(C.pink)); bar.position.copy(endpoint); bar.quaternion.setFromUnitVectors(V(0, 1, 0), direction); }
      else { const cone = mesh(new THREE.ConeGeometry(.09, .19, 8), material(C.teal)); cone.position.copy(endpoint); cone.quaternion.setFromUnitVectors(V(0, 1, 0), direction); }
    });
    label('Teal arrow: excitation · pink bar: inhibition', stage, V(0, -2.3, 0));
    status('Teaching circuit · simplified connectivity, not anatomical positions. Pulse speed is illustrative.');
  }

  function synapse(target: string) {
    const electrical = target.includes('electrical');
    const top = membrane(electrical ? .3 : .8), bottom = membrane(electrical ? -.3 : -.8);
    separable(top, V(0, .9)); separable(bottom, V(0, -.9));
    label(electrical ? 'Cell 1 membrane' : 'Presynaptic terminal', top, V(-2, .45));
    label(electrical ? 'Cell 2 membrane' : 'Postsynaptic membrane', bottom, V(1.6, -.55));
    if (electrical) {
      for (let i = -2; i <= 2; i++) {
        const g = new THREE.Group(); g.position.x = i * .85; stage.add(g);
        for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; link(V(Math.cos(a) * .16, -.4, Math.sin(a) * .16), V(Math.cos(a) * .16, .4, Math.sin(a) * .16), .062, C.teal, g); }
        pulse(new THREE.LineCurve3(V(i * .85, .7), V(i * .85, -.7)), C.amber, 1, .3, stage, .055);
      }
      label('Gap junction · paired connexons', stage, V(0, 1.5));
      status('Teaching schematic · electrical coupling through gap junctions. Often bidirectional.'); return;
    }
    const terminal = mesh(new THREE.SphereGeometry(2.5, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), material(C.pearl, .075)); terminal.position.y = .85; terminal.scale.set(1.2, .75, .5);
    for (let i = 0; i < 7; i++) {
      const x = (i % 4 - 1.5) * 1.25, y = 1.45 + Math.floor(i / 4) * .8, z = (i % 2 ? .3 : -.4);
      const vesicle = new THREE.Group(); stage.add(vesicle); vesicle.position.set(x, y, z);
      const wall = ball(V(), .31, C.teal, vesicle, .24); selectable(wall, 'synaptic-release');
      for (let j = 0; j < 6; j++) ball(V(Math.cos(j * 2.4) * .16, Math.sin(j * 2.4) * .16, Math.sin(j * 1.6) * .14), .045, C.amber, vesicle);
      if (i === 1) animations.push(t => { vesicle.position.y = 1.45 - Math.max(0, Math.sin(t * .8)) * .5; });
    }
    for (let i = -2; i <= 2; i++) {
      const receptor = new THREE.Group(); receptor.position.set(i * 1.25, -.8, .0); stage.add(receptor);
      for (let j = 0; j < 4; j++) { const a = j / 4 * Math.PI * 2; const subunit = ball(V(Math.cos(a) * .17, 0, Math.sin(a) * .17), .12, target.includes('integration') && i < 0 ? C.pink : C.blue, receptor); subunit.scale.y = 2.7; selectable(subunit, target.includes('integration') && i < 0 ? 'gabaa' : 'ampa'); }
      separable(receptor, V(i * .17, -.35, .4));
    }
    const clearance = target.includes('clearance');
    for (let i = 0; i < 23; i++) {
      const particle = ball(V(), .047, C.amber);
      animations.push(t => {
        const phase = (t * .2 + i / 23) % 1, spread = Math.sin(i * 5.23) * 2.5;
        particle.position.set(clearance ? spread + phase * (spread > 0 ? .9 : -.9) : spread * Math.sin(phase * Math.PI / 2), .78 - phase * 1.48, Math.cos(i * 2.2) * .9 * Math.sin(phase * Math.PI));
        particle.scale.setScalar(target.includes('short-term') ? .75 + Math.sin(t * .45) * .25 : 1);
      });
    }
    if (clearance) {
      const glial = mesh(new THREE.BoxGeometry(.45, 3.7, 2), material(C.teal, .22)); glial.position.set(3.4, .3, 0); label('Transporters + enzymatic clearance', glial, V(-.6, 1.6));
      for (let i = 0; i < 5; i++) ball(V(3.12, -1 + i * .6, 0), .13, C.teal);
    }
    label('Vesicle · transmitter cargo', stage, V(-1.6, 2.6, .5)); label('Synaptic cleft', stage, V(-2.4, 0, .1));
    label(target.includes('integration') ? 'Excitatory + inhibitory receptor inputs' : 'Ligand-gated receptors', stage, V(1.5, -1.6, .2));
    status('Teaching schematic · not to scale. Vesicles, receptors, and transmitter motion are simplified.');
  }

  function molecule(target: string) {
    const chosen = canonical(target);
    if (chosen.includes('neuropeptide')) {
      const aa = ['Tyr', 'Gly', 'Gly', 'Phe', 'Met'];
      aa.forEach((name, i) => { const p = V((i - 2) * 1.2, Math.sin(i * 1.2) * .5, Math.cos(i * 1.2) * .4), m = ball(p, .35, [C.pearl, C.teal, C.teal, C.pink, C.amber][i]); if (i) link(V((i - 3) * 1.2, Math.sin((i - 1) * 1.2) * .5, Math.cos((i - 1) * 1.2) * .4), p, .075, C.muted); label(name, m, V(0, .6)); separable(m, V((i - 2) * .25, .3, 0)); });
      label('Met-enkephalin · five amino-acid residues', stage, V(0, -1.3)); status('Peptide teaching schematic · each sphere is one amino-acid residue, not an atom.'); return;
    }
    let atoms: Atom[] = [], bonds: Bond[] = [];
    const add = (symbol: string, x: number, y: number, z = 0) => { atoms.push([symbol, x, y, z]); return atoms.length - 1; };
    const bond = (a: number, b: number, order = 1) => bonds.push([a, b, order]);
    const ring = (cx = 0, cy = 0) => { for (let i = 0; i < 6; i++) add('C', cx + Math.cos(i * Math.PI / 3) * 1.03, cy + Math.sin(i * Math.PI / 3) * 1.03); for (let i = 0; i < 6; i++) bond(i, (i + 1) % 6, i % 2 ? 1 : 2); };
    if (chosen === 'dopamine' || chosen === 'norepinephrine') {
      ring(-.8); bond(2, add('O', -1.82, 1.75)); bond(3, add('O', -2.86, 0));
      bond(0, add('C', 1.32, .25, .18)); bond(8, add('C', 2.17, -.55, -.12)); bond(9, add('N', 3.17, -.12, .16));
      if (chosen === 'norepinephrine') bond(8, add('O', 1.5, 1.25, .36));
    } else if (chosen === 'serotonin') {
      ring(-1.1); bond(4, add('O', -2.12, -1.75));
      const n = add('N', .65, 1.1), c7 = add('C', 1.36, .33), c8 = add('C', .83, -.61);
      bond(1, n); bond(n, c7); bond(c7, c8, 2); bond(c8, 0);
      bond(c8, add('C', 1.75, -1.3, .2)); bond(10, add('C', 2.82, -.85, -.16)); bond(11, add('N', 3.72, -1.5, .1));
    } else if (chosen === 'acetylcholine') {
      add('C', -2.9, .4); add('C', -1.9, -.1); add('O', -1.95, -1.15); add('O', -.9, .5); add('C', .1, 0); add('C', 1.1, .5); add('N', 2.1, 0);
      add('C', 2.9, .75, .45); add('C', 2.7, -.9, .35); add('C', 2.15, -.05, -1.1);
      bonds = [[0, 1], [1, 2, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8], [6, 9]];
    } else if (chosen === 'glutamate') {
      atoms = [['C', -2.2, .3], ['C', -1.1, -.2], ['C', 0, .3, .2], ['C', 1.1, -.2, -.1], ['C', 2.2, .3], ['N', -1.1, -1.4, .2], ['O', -2.3, 1.4], ['O', -3.2, -.3], ['O', 2.3, 1.4], ['O', 3.2, -.3]];
      bonds = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [0, 6, 2], [0, 7], [4, 8, 2], [4, 9]];
    } else if (chosen === 'glycine') {
      atoms = [['N', -1.4, .4], ['C', -.4, -.2], ['C', .65, .3], ['O', .8, 1.4], ['O', 1.65, -.3]]; bonds = [[0, 1], [1, 2], [2, 3, 2], [2, 4]];
    } else if (chosen === 'histamine') {
      // Imidazole C4–N3–C2–N1–C5, with ethylamine attached at C4.
      atoms = [['C', 0, 0], ['N', -.2, 1], ['C', -1.2, 1.25], ['N', -1.8, .3], ['C', -1, -.65], ['C', 1.05, -.4, .15], ['C', 2.05, .15, -.12], ['N', 3.05, -.4, .1]];
      bonds = [[0, 1], [1, 2, 2], [2, 3], [3, 4], [4, 0, 2], [0, 5], [5, 6], [6, 7]];
    } else {
      atoms = [['N', -2.7, .3], ['C', -1.65, -.3], ['C', -.6, .3, .2], ['C', .45, -.3, -.15], ['C', 1.5, .3], ['O', 1.6, 1.4], ['O', 2.5, -.3]];
      bonds = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5, 2], [4, 6]];
    }
    const group = new THREE.Group(); stage.add(group);
    const atomColors: Record<string, number> = { C: 0xb6c9cd, N: C.blue, O: 0xf37d91, P: C.amber, S: 0xe4d882 };
    const atomMeshes = atoms.map(([symbol, x, y, z]) => { const sphere = ball(V(x, y, z || 0), symbol === 'C' ? .23 : .26, atomColors[symbol] || C.pearl, group); label(symbol === 'N' && chosen === 'acetylcholine' ? 'N⁺' : symbol, sphere, V(0, .02, .28)); separable(sphere, V(x * .22, y * .22, (z || 0) * .5)); return sphere; });
    bonds.forEach(([a, b, order]) => {
      const av = atomMeshes[a].position, bv = atomMeshes[b].position, initialLength = av.distanceTo(bv);
      const strands = (order === 2 ? [-1, 1] : [0]).map(side => ({ side, object: link(av, bv, order === 2 ? .035 : .054, C.muted, group) }));
      const layout = () => {
        const delta = bv.clone().sub(av), offset = V(-delta.y, delta.x).normalize().multiplyScalar(.06);
        strands.forEach(({ side, object }) => { object.position.copy(av).add(bv).multiplyScalar(.5).addScaledVector(offset, side); object.quaternion.setFromUnitVectors(V(0, 1, 0), delta.clone().normalize()); object.scale.y = delta.length() / initialLength; });
      };
      layout(); layouts.push(layout);
    });
    const box = new THREE.Box3().setFromObject(group), center = box.getCenter(V()); group.position.sub(center);
    label('C carbon  ·  N nitrogen  ·  O oxygen', stage, V(0, -2.1, 0));
    status('Heavy-atom teaching model · hydrogens omitted; bond layout and protonation simplified.');
  }

  async function channel(target: string, token: number) {
    const chosen = canonical(target), gaba = chosen === 'gabaa' || chosen === 'gaba';
    const nmda = chosen === 'nmda', ampa = chosen === 'ampa', sodium = chosen.includes('sodium'), calcium = chosen.includes('calcium');
    const bilayer = membrane(-.4, stage, 6.5, 3.6); bilayer.scale.y = 3;
    const protein = new THREE.Group(); stage.add(protein);
    const count = gaba ? 5 : 4, domainColor = [C.teal, C.blue, C.pink, C.amber, C.violet];
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, group = new THREE.Group(); protein.add(group); group.position.set(Math.cos(a) * .72, 0, Math.sin(a) * .72);
      for (let j = 0; j < 3; j++) { const helix: THREE.Vector3[] = []; for (let p = 0; p < 44; p++) helix.push(V(Math.cos(p * .55) * .08 + (j - 1) * .16, -1.25 + p * .054, Math.sin(p * .55) * .08)); tube(helix, .055, domainColor[i], group, 1, 72); }
      const head = ball(V(0, 1.35, 0), gaba || ampa || nmda ? .52 : .3, domainColor[i], group); head.scale.y = gaba || ampa || nmda ? 1.35 : .85;
      selectable(group, gaba ? 'gabaa' : ampa ? 'ampa' : nmda ? 'nmda' : sodium ? 'sodium-channel' : calcium ? 'calcium-channel' : 'potassium-channel');
      separable(group, V(Math.cos(a) * .8, .1, Math.sin(a) * .8));
      animations.push(t => { const gating = (.5 + .5 * Math.sin(t * .7)) * .075; group.scale.x = 1 + gating; group.scale.z = 1 + gating; });
    }
    const ionColor = gaba ? C.pink : calcium ? C.violet : sodium || ampa || nmda ? C.amber : C.teal;
    const outward = !(gaba || nmda || ampa || sodium || calcium);
    for (let i = 0; i < 9; i++) {
      const ion = ball(V(), .087, ionColor); animations.push(t => { const phase = (t * .22 + i / 9) % 1; ion.position.set(Math.sin(i * 2.4) * .12, (outward ? 1 : -1) * (-2.4 + phase * 5.8), Math.cos(i * 2.4) * .12); });
    }
    if (nmda) { const blocker = ball(V(0, .2, 0), .18, C.violet); label('Mg²⁺ block · voltage dependent', blocker, V(1.7, .3)); animations.push(t => { blocker.position.set(Math.max(0, Math.sin(t * .7)) * 1.8, .2, 0); }); }
    label(gaba ? 'GABA-A · pentameric receptor' : nmda ? 'NMDA · ligand + voltage dependence' : ampa ? 'AMPA · glutamate-gated receptor' : calcium ? 'Voltage-gated Ca²⁺ channel' : sodium ? 'Voltage-gated Na⁺ channel' : 'K⁺ channel · selective pore', stage, V(0, 2.8, 0));
    label(gaba ? 'Cl⁻ permeability' : calcium ? 'Ca²⁺ permeation' : ampa || nmda ? 'Cation permeability' : sodium ? 'Na⁺ permeation' : 'K⁺ permeation', stage, V(1.6, -1.7, .2));
    label('Lipid bilayer', stage, V(-2.5, -.3, .7));
    label('Extracellular', stage, V(-2.4, 1.8, 0)); label('Cytoplasmic', stage, V(-2.4, -1.8, 0));
    status(`Teaching schematic · not to scale · ${sodium || calcium ? 'four domains of one α subunit' : gaba ? 'five protein subunits' : 'four protein subunits'}. Ion direction depends on the electrochemical gradient.`);
    if (gaba) {
      try {
        const data = await getReceptor(); if (disposed || token !== generation) return;
        const points = data.chains.flatMap(c => c.segments?.flat() || c.points || []); if (!points.length) return;
        const bounds = new THREE.Box3().setFromPoints(points.map(p => V(p[0], p[1], p[2]))), center = bounds.getCenter(V()), size = bounds.getSize(V());
        const scale = 3.5 / Math.max(size.x, size.y, size.z);
        // Experimental coordinates retain their original orientation; place in a separate viewing group.
        disposeObject(protein); protein.clear(); parts.length = 0;
        for (let i = 0; i < data.chains.length; i++) {
          const chain = data.chains[i], g = new THREE.Group(); protein.add(g);
          for (const segment of chain.segments || [chain.points || []]) {
            if (segment.length < 2) continue;
            const path = segment.map(p => V(p[0], p[1], p[2]).sub(center).multiplyScalar(scale));
            tube(path, .035, domainColor[i % 5], g, 1, Math.min(path.length * 3, 1200));
          }
          separable(g, V(Math.cos(i / 5 * Math.PI * 2) * .6, 0, Math.sin(i / 5 * Math.PI * 2) * .6));
        }
        // Avoid assigning an anatomical membrane orientation to unaligned experimental coordinates.
        stage.children.filter(o => o !== protein).forEach(o => { if ((o as THREE.Group).isGroup || (o as THREE.Mesh).isMesh) { disposeObject(o); stage.remove(o); } });
        labels.splice(0).forEach(l => l.element.remove());
        animations = [];
        label('GABA-A receptor · experimental Cα backbone', protein, V(0, 2.4, 0));
        label('Five protein chains · PDB 6D6T', protein, V(0, -2.4, 0));
        status('Experimental structure · PDB 6D6T. Cα backbone traces; missing residues remain gaps.'); dirty = true;
      } catch { /* The explicitly labeled teaching schematic remains usable offline. */ }
    }
  }

  function plasticity(target: string) {
    const ltd = target.includes('ltd'), homeo = target.includes('homeostatic'), timing = target.includes('spike'), structural = target.includes('structural'), memory = target.includes('memory');
    const branch = tube([V(-3.1, -1.2, 0), V(0, -1.15, 0), V(3.1, -1.2, 0)], .27, C.pearl);
    for (let i = -2; i <= 2; i++) {
      const g = new THREE.Group(); stage.add(g); g.position.set(i * 1.15, -1.15, 0);
      tube([V(), V(.05, .45, .02), V(.1, .9, 0)], .10, C.pearl, g);
      const spine = ball(V(.1, 1.02), .34, i === 0 || homeo ? C.teal : C.pearl, g);
      const terminal = ball(V(.1, 2.04), .32, C.pink, g, .65);
      const receptors: THREE.Mesh[] = [];
      for (let j = 0; j < 5; j++) { const receptor = ball(V(.1 + (j - 2) * .10, 1.31, .1), .048, C.amber, g); receptors.push(receptor); }
      if (i === 0 || homeo) {
        animations.push(t => {
          const weight = .5 + .5 * Math.sin(t * .45), growth = ltd ? 1 - weight * .38 : .85 + weight * .55;
          spine.scale.setScalar(growth); receptors.forEach((r, j) => { r.visible = j < 2 + Math.round((ltd ? 1 - weight : weight) * 3); r.position.y = 1.02 + .29 * growth; });
          if (structural) g.scale.y = .65 + weight * .6;
          if (timing) { const mat = terminal.material as THREE.MeshStandardMaterial; mat.emissiveIntensity = Math.pow(Math.max(0, Math.sin(t * 3.2)), 10) * .9; }
        });
      }
      selectable(spine, ltd ? 'ltd' : 'ltp'); separable(g, V(i * .3, i % 2 ? .4 : 0, i % 2 ? .7 : 0));
    }
    label(ltd ? 'LTD · reduced synaptic efficacy' : homeo ? 'Homeostatic scaling · stabilize activity' : timing ? 'Relative spike timing shapes change' : structural ? 'Spine growth and remodeling' : memory ? 'Local synaptic change supports memory' : 'LTP · increased synaptic efficacy', stage, V(0, 2.2));
    label('AMPA receptor availability', stage, V(1.6, .4, .7));
    label('Dendritic branch', branch.mesh, V(-1.7, -1.8));
    status('Teaching schematic · one illustrative form of plasticity. Real mechanisms depend on synapse and induction.');
  }

  function setTopic(topic: BrainTopic) {
    if (disposed) return;
    current = topic; const token = ++generation; clear();
    const target = (topic.modelTarget || topic.id || '').toLowerCase();
    renderer.domElement.setAttribute('aria-label', `${topic.title}: interactive 3D model. Drag to rotate; scroll or pinch to zoom.`);
    switch (topic.scene) {
      case 'brain': void brain(target, token); break;
      case 'tracts': void brain(target, token, true); break;
      case 'circuit': circuit(target); break;
      case 'neuron': neuron(target); break;
      case 'synapse': synapse(target); break;
      case 'molecule': molecule(target); break;
      case 'channel': void channel(target, token); break;
      case 'plasticity': plasticity(target); break;
      default: void brain(target, token);
    }
    time = 0;
    camera.position.copy(topic.scene === 'molecule' ? V(2.8, 2.6, 11.6) : topic.scene === 'brain' || topic.scene === 'tracts' ? V(6, 3.2, 7.6) : V(7.4, 4, 9.4));
    controls.target.set(0, 0, 0); controls.update(); dirty = true;
    animations.forEach(fn => fn(0, 0));
  }
  const projected = V();
  function renderLabels() {
    const width = container.clientWidth, height = container.clientHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of labels) {
      if (!showLabels || !l.object.parent && l.object !== stage) { l.element.style.display = 'none'; continue; }
      l.object.localToWorld(projected.copy(l.point)); projected.project(camera);
      const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
      let hidden = projected.z > 1 || projected.z < -1 || x < 15 || x > width - 15 || y < 10 || y > height - 10;
      if (!hidden && l.object.userData.atlas) {
        raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
        const front = raycaster.intersectObjects(stage.children, true).find(hit => {
          const surface = hit.object as THREE.Mesh, mat = surface.material;
          return mat && !Array.isArray(mat) && mat.opacity >= .35;
        });
        hidden = Boolean(front && front.object !== l.object);
        if (!hidden) {
          l.element.style.display = 'block';
          const w = l.element.offsetWidth + 12, h = l.element.offsetHeight + 10;
          hidden = placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2);
          if (!hidden) placed.push({ x, y, w, h });
        }
      }
      l.element.style.display = hidden ? 'none' : 'block';
      l.element.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }
  function resize() { if (disposed) return; const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); dirty = true; }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) dirty = true; }); intersectionObserver.observe(container);
  const changed = () => { dirty = true; }; controls.addEventListener('change', changed);
  const documentChanged = () => { dirty = true; previous = 0; }; document.addEventListener('visibilitychange', documentChanged);
  const motionChanged = () => { dirty = true; }; reducedMotion.addEventListener('change', motionChanged);
  let downX = 0, downY = 0;
  const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
  function hit(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const intersection of raycaster.intersectObjects(stage.children, true)) {
      const surface = intersection.object as THREE.Mesh;
      if (surface.material && !Array.isArray(surface.material) && surface.material.opacity < .25) continue;
      let object: THREE.Object3D | null = intersection.object;
      while (object && object !== stage) { if (object.userData.topicId) return object.userData.topicId as string; object = object.parent; }
    }
    return null;
  }
  const up = (event: PointerEvent) => { if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return; const id = hit(event); if (id && id !== current.id) options.onSelect?.(id); };
  const move = (event: PointerEvent) => { if (event.buttons) return; renderer.domElement.style.cursor = hit(event) ? 'pointer' : 'grab'; };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointermove', move);
  function tick(ms: number) {
    if (disposed) return; frame = requestAnimationFrame(tick);
    const dt = previous ? Math.min((ms - previous) / 1000, .05) : 0; previous = ms;
    if (!visible || document.hidden) return;
    const motion = playing;
    if (motion && animations.length) { time += dt; animations.forEach(fn => fn(time, dt)); dirty = true; }
    const goal = exploded ? 1 : 0;
    if (Math.abs(explosion - goal) > .001) { explosion = reducedMotion.matches ? goal : THREE.MathUtils.damp(explosion, goal, 7, dt); parts.forEach(p => p.object.position.copy(p.base).addScaledVector(p.offset, explosion)); layouts.forEach(layout => layout()); dirty = true; }
    controls.update();
    if (dirty) { renderer.render(scene, camera); renderLabels(); dirty = false; }
  }
  resize(); frame = requestAnimationFrame(tick);
  return {
    setTopic,
    setMode(mode, target) { setTopic({ ...current, scene: mode, modelTarget: target || current.id }); },
    setExploded(value) {
      exploded = value;
      if (current.scene === 'brain' && /brainoverview|brain|lobes|cerebralcortex/.test(canonical(current.modelTarget || current.id))) {
        const position = camera.position.clone(), target = controls.target.clone();
        setTopic(current); camera.position.copy(position); controls.target.copy(target); controls.update();
      }
      dirty = true;
    },
    setLabels(value) { showLabels = value; dirty = true; },
    setPlaying(value) { playing = value; dirty = true; },
    setView(view) { const distance = camera.position.distanceTo(controls.target); camera.position.copy((view === 'superior' ? V(0, 1, .001) : view === 'anterior' ? V(0, 0, 1) : V(1, 0, .001)).normalize().multiplyScalar(distance)); controls.target.set(0, 0, 0); controls.update(); dirty = true; },
    reset() { exploded = false; setTopic(current); }, resize,
    dispose() {
      if (disposed) return; disposed = true; generation++; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', documentChanged); reducedMotion.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointermove', move);
      controls.removeEventListener('change', changed); controls.dispose(); clear(); disposeObject(ground); disposeObject(orbitRing); renderer.dispose(); renderer.domElement.remove(); labelLayer.remove();
    },
  };
}
