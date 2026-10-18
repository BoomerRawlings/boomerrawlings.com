import * as THREE from 'three';
import portalAtlas from '../../data/brain/portal-brain.json';
import type { StudyAtlas, StudyView } from './study-visuals';

type Vec3 = readonly [number, number, number];
export type StudyModelFrame = {
  view: StudyView; scale: number; centerX: number; centerY: number;
  width: number; height: number; eye: Vec3; right: Vec3; up: Vec3;
};
export type StudyModelOptions = {
  deep?: boolean;
  surface?: boolean;
  atlas?: StudyAtlas;
  onAvailabilityChange?: (available: boolean) => void;
};
export type StudyModel = { update(frame: StudyModelFrame, options?: StudyModelOptions): void; dispose(): void };
type PortalMesh = { id: string; kind: string; positions: string; normals: string; edges: string };
type DecodedPortalMesh = { id: string; kind: string; positions: Float32Array; normals: Float32Array; colors: Float32Array; edges: Uint16Array };

const bytes = (encoded: string) => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
function words(encoded: string, signed = false): number[] {
  const data = bytes(encoded), view = new DataView(data.buffer);
  return Array.from({ length: data.length / 2 }, (_, index) => signed ? view.getInt16(index * 2, true) : view.getUint16(index * 2, true));
}
const reflected = (point: Vec3) => new THREE.Vector3(-point[0], point[1], point[2]);
let decodedPortal: { meshes: DecodedPortalMesh[]; centerY: number; scale: number } | undefined;

/** The exact measured data and coordinate reflection used by portal-scene.ts.
 * CPU arrays are shared; each mounted model owns and disposes its GPU objects. */
function decodePortal() {
  if (decodedPortal) return decodedPortal;
  const bounds = new THREE.Box3();
  const meshes = (portalAtlas.meshes as PortalMesh[]).map(mesh => {
    const values = words(mesh.positions, true), normals = new Int8Array(bytes(mesh.normals).buffer), edges = Uint16Array.from(words(mesh.edges));
    if (values.length % 3 || normals.length !== values.length || edges.length % 2) throw new Error('Invalid portal brain geometry');
    const positions = new Float32Array(values.length), normal = new Float32Array(values.length), colors = new Float32Array(values.length);
    const color = new THREE.Color(mesh.kind === 'cerebellum' ? 0x6ed1e5 : mesh.kind === 'brainstem' ? 0x9be5ed : 0x74d9ef);
    for (let index = 0; index < values.length; index += 3) {
      const point = new THREE.Vector3(-values[index] / 100, values[index + 1] / 100, values[index + 2] / 100);
      point.toArray(positions, index); bounds.expandByPoint(point);
      new THREE.Vector3(-normals[index] / 127, normals[index + 1] / 127, normals[index + 2] / 127).normalize().toArray(normal, index);
      color.toArray(colors, index);
    }
    if (edges.some(index => index >= positions.length / 3)) throw new Error('Invalid portal brain edge');
    return { id: mesh.id, kind: mesh.kind, positions, normals: normal, colors, edges };
  });
  const size = bounds.getSize(new THREE.Vector3());
  decodedPortal = { meshes, centerY: bounds.getCenter(new THREE.Vector3()).y, scale: 2.4 / Math.max(size.x, size.y, size.z) };
  return decodedPortal;
}

/** Orthographic camera matches the SVG annotation projection exactly. The
 * screen's orientation stays fixed; the home model's scan and glow can move. */
export function configureStudyModelCamera(camera: THREE.OrthographicCamera, frame: StudyModelFrame): void {
  const center = reflected(frame.right).multiplyScalar(frame.centerX).addScaledVector(reflected(frame.up), frame.centerY);
  camera.position.copy(center).addScaledVector(reflected(frame.eye), 400);
  camera.up.copy(reflected(frame.up)); camera.lookAt(center);
  camera.left = -frame.width / frame.scale / 2; camera.right = -camera.left;
  camera.top = frame.height / frame.scale / 2; camera.bottom = -camera.top;
  camera.near = 1; camera.far = 1000; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

/** Dense animated portal anatomy underneath accessible SVG teaching overlays.
 * Failure leaves the full SVG illustration in place through the callback. */
export function mountStudyModel(container: HTMLElement, initialFrame: StudyModelFrame, initialOptions: StudyModelOptions = {}): StudyModel {
  const canvas = document.createElement('canvas'); canvas.className = 'portal-study-model-canvas'; canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0' });
  container.prepend(canvas);
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { canvas.remove(); initialOptions.onAvailabilityChange?.(false); return { update() {}, dispose() {} }; }
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera();
  const anatomy = new THREE.Group(), depthShell = new THREE.Group(); scene.add(depthShell, anatomy);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => { geometries.push(value); return value; };
  const material = <T extends THREE.Material>(value: T): T => { materials.push(value); return value; };
  const portal = document.getElementById('brain-portal'), preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentFrame = initialFrame, options = initialOptions, disposed = false, contextAvailable = true, inViewport = true;
  let animation = 0, lastTime = performance.now(), elapsed = 0, available = false, depthAtlas: StudyAtlas | undefined;
  let wasConnected = container.isConnected;
  const notify = (value: boolean) => { if (value !== available) { available = value; options.onAvailabilityChange?.(value); } };
  const moving = () => !preference.matches && !portal?.classList.contains('portal-motion-paused');
  const uniforms = {
    uTime: { value: 0 }, uOpacity: { value: 1 }, uSize: { value: 1.55 * Math.min(window.devicePixelRatio || 1, 1.5) },
    uScale: { value: .012 }, uCenterY: { value: 0 }, uMedial: { value: 0 },
  };
  const vertexShader = `
    attribute vec3 aNormal;
    attribute vec3 color;
    uniform float uTime;
    uniform float uSize;
    uniform float uScale;
    uniform float uCenterY;
    varying vec3 vColor;
    varying float vScan;
    varying float vFacing;
    varying float vSide;
    void main() {
      vec3 normal = normalize(mat3(modelViewMatrix) * aNormal);
      vFacing = 0.16 + 0.84 * smoothstep(-0.2, 0.7, normal.z);
      float scan = mod(uTime * 0.34, 3.4) - 1.7;
      vScan = exp(-pow((((position.y - uCenterY) * uScale) - scan) * 15.0, 2.0));
      vColor = color; vSide = position.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize;
    }
  `;
  const fragmentCommon = `uniform float uOpacity; uniform float uMedial; varying vec3 vColor; varying float vScan; varying float vFacing; varying float vSide;`;
  const wireMaterial = material(new THREE.ShaderMaterial({ uniforms, vertexShader,
    fragmentShader: `${fragmentCommon} void main() { if (uMedial > 0.5 && vSide < 0.0) discard; gl_FragColor = vec4(mix(vColor, vec3(0.88,0.98,1.0), vScan), (0.24 + vScan * 0.4) * uOpacity * vFacing); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const pointMaterial = material(new THREE.ShaderMaterial({ uniforms, vertexShader,
    fragmentShader: `${fragmentCommon} void main() { if (uMedial > 0.5 && vSide < 0.0) discard; vec2 p = gl_PointCoord * 2.0 - 1.0; if (abs(p.x) + abs(p.y) > 1.0) discard; gl_FragColor = vec4(mix(vColor, vec3(0.95,1.0,1.0), vScan), (0.43 + vScan * 0.3) * uOpacity * vFacing); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const meshGroups: { id: string; group: THREE.Group }[] = [];
  const depthMeshes: { id: string; hemisphere: string; object: THREE.Mesh }[] = [];
  const surfaceMaterial = material(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide }));
  const medialClip = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
  const installDepthShell = (atlas: StudyAtlas) => {
    if (atlas === depthAtlas) return;
    for (const item of depthMeshes) { depthShell.remove(item.object); item.object.geometry.dispose(); const index = geometries.indexOf(item.object.geometry); if (index !== -1) geometries.splice(index, 1); }
    depthMeshes.length = 0; depthAtlas = atlas;
    for (const mesh of atlas.meshes.filter(item => item.kind !== 'internal')) {
      const values = words(mesh.positions, true), positions = new Float32Array(values.length), indices = words(mesh.triangles);
      for (let index = 0; index < values.length; index += 3) { positions[index] = -values[index] / 100; positions[index + 1] = values[index + 1] / 100; positions[index + 2] = values[index + 2] / 100; }
      const g = geometry(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setIndex(indices);
      const object = new THREE.Mesh(g, surfaceMaterial); object.renderOrder = -1; depthShell.add(object); depthMeshes.push({ id: mesh.id, hemisphere: mesh.hemisphere, object });
    }
  };
  const configure = () => {
    configureStudyModelCamera(camera, currentFrame);
    uniforms.uOpacity.value = options.deep ? .24 : 1;
    uniforms.uMedial.value = currentFrame.view === 'medial' ? 1 : 0;
    surfaceMaterial.clippingPlanes = currentFrame.view === 'medial' ? medialClip : [];
    const hideRight = currentFrame.view === 'medial' || currentFrame.view === 'lateral';
    for (const item of meshGroups) item.group.visible = !(hideRight && item.id === 'hemisphere-right');
    if (options.surface && options.atlas) installDepthShell(options.atlas);
    depthShell.visible = !!options.surface && !!depthAtlas;
    // Bias only the invisible occlusion surface away from the camera, so small
    // simplification differences do not erase the actual portal's front edges.
    depthShell.position.copy(reflected(currentFrame.eye)).multiplyScalar(-2.5);
    for (const item of depthMeshes) item.object.visible = !(hideRight && item.hemisphere === 'right');
  };
  const render = (time: number) => {
    animation = 0;
    if (disposed || !contextAvailable || document.hidden || !inViewport || portal?.hidden) return;
    const dt = Math.min(.05, Math.max(0, (time - lastTime) / 1000)); lastTime = time;
    if (moving()) elapsed += dt;
    uniforms.uTime.value = elapsed;
    try { renderer.render(scene, camera); notify(true); }
    catch { contextAvailable = false; canvas.style.visibility = 'hidden'; notify(false); return; }
    if (moving()) animation = requestAnimationFrame(render);
  };
  const requestRender = () => {
    cancelAnimationFrame(animation); animation = 0;
    if (disposed || !contextAvailable || document.hidden || !inViewport || portal?.hidden) return;
    lastTime = performance.now(); animation = requestAnimationFrame(render);
  };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth || currentFrame.width), height = Math.max(1, container.clientHeight || width * currentFrame.height / currentFrame.width);
    renderer.setSize(width, height, false); requestRender();
  };
  const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; cancelAnimationFrame(animation); canvas.style.visibility = 'hidden'; notify(false); };
  const contextRestored = () => { if (disposed) return; contextAvailable = true; canvas.style.visibility = ''; requestRender(); };
  const resizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(entries => { inViewport = entries.some(entry => entry.isIntersecting); requestRender(); }, { rootMargin: '100px' });
  const motionObserver = new MutationObserver(requestRender);
  const removalObserver = new MutationObserver(() => {
    if (container.isConnected) wasConnected = true;
    else if (wasConnected) dispose();
  });
  const dispose = () => {
    if (disposed) return; disposed = true; cancelAnimationFrame(animation);
    resizeObserver.disconnect(); visibilityObserver.disconnect(); motionObserver.disconnect(); removalObserver.disconnect();
    document.removeEventListener('visibilitychange', requestRender); preference.removeEventListener('change', requestRender);
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    notify(false);
  };
  try {
    const data = decodePortal(); uniforms.uScale.value = data.scale; uniforms.uCenterY.value = data.centerY;
    for (const mesh of data.meshes) {
      const wire = geometry(new THREE.BufferGeometry()), points = geometry(new THREE.BufferGeometry());
      for (const target of [wire, points]) {
        target.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3)); target.setAttribute('aNormal', new THREE.BufferAttribute(mesh.normals, 3)); target.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
      }
      wire.setIndex(new THREE.BufferAttribute(mesh.edges, 1));
      const group = new THREE.Group(); group.add(new THREE.LineSegments(wire, wireMaterial), new THREE.Points(points, pointMaterial));
      anatomy.add(group); meshGroups.push({ id: mesh.id, group });
    }
    configure(); resizeObserver.observe(container); visibilityObserver.observe(container);
    removalObserver.observe(document.body, { childList: true, subtree: true });
    if (portal) motionObserver.observe(portal, { attributes: true, attributeFilter: ['class', 'hidden'] });
    document.addEventListener('visibilitychange', requestRender); preference.addEventListener('change', requestRender);
    canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored); resize();
  } catch { dispose(); initialOptions.onAvailabilityChange?.(false); }
  return {
    update(frame, nextOptions = options) {
      if (disposed) return; currentFrame = frame; options = nextOptions;
      try { configure(); resize(); } catch { contextAvailable = false; canvas.style.visibility = 'hidden'; notify(false); }
    },
    dispose,
  };
}
