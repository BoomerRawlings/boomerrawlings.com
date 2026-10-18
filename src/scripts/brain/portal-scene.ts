import * as THREE from 'three';

type SceneOptions = { moving?: boolean };
type PortalScene = { dispose(): void; setMotion(moving: boolean): void };

/** Decorative neural HUD. Interactive targets and study content remain accessible HTML. */
export function initializePortalScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): PortalScene {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    canvas.style.display = 'none';
    return { dispose() {}, setMotion() {} };
  }
  const portal = document.getElementById('brain-portal');
  const stage = document.getElementById('portal-stage');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 70);
  const focalDistance = 8.4;
  camera.position.set(0, 0, focalDistance);
  const lookAt = new THREE.Vector3();
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let moving = options.moving ?? !preference.matches;
  let disposed = false, contextAvailable = true, frame = 0, width = 1, height = 1;
  let elapsed = 0, previous = performance.now(), assemblyStart = previous;
  let loading = portal?.classList.contains('portal-loading') ?? false;
  let view = stage?.dataset.view || 'home';
  const cursor = new THREE.Vector2();
  const cameraOffset = new THREE.Vector2();
  const cameraVelocity = new THREE.Vector2();
  const core = new THREE.Group();
  const anatomy = new THREE.Group();
  core.add(anatomy); scene.add(core);
  const targetPosition = new THREE.Vector3();
  let targetScale = 1, targetAlpha = 1, alpha = 1;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const geometry = <T extends THREE.BufferGeometry>(g: T): T => { geometries.push(g); return g; };
  const material = <T extends THREE.Material>(m: T): T => { materials.push(m); return m; };
  let seed = 1986;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const shared = {
    uTime: { value: 0 }, uAssembly: { value: 1 }, uOpacity: { value: 1 },
    uSize: { value: 2.2 * Math.min(window.devicePixelRatio || 1, 1.5) },
  };
  const vertexShader = `
    attribute vec3 aScatter;
    attribute vec3 color;
    uniform float uAssembly;
    uniform float uTime;
    uniform float uSize;
    varying vec3 vColor;
    varying float vScan;
    void main() {
      vec3 p = mix(aScatter, position, smoothstep(0.0, 1.0, uAssembly));
      float scan = mod(uTime * 0.34, 3.4) - 1.7;
      vScan = exp(-pow((position.y - scan) * 15.0, 2.0));
      vColor = color;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(uSize * (8.4 / -mv.z), 1.0, 4.5);
    }
  `;
  const networkMaterial = material(new THREE.ShaderMaterial({
    uniforms: shared, vertexShader,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vScan;
      void main() {
        vec3 ink = mix(vColor, vec3(0.88, 0.98, 1.0), vScan);
        gl_FragColor = vec4(ink, (0.19 + vScan * 0.5) * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const pointMaterial = material(new THREE.ShaderMaterial({
    uniforms: shared, vertexShader,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vScan;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (abs(p.x) + abs(p.y) > 1.0) discard;
        gl_FragColor = vec4(mix(vColor, vec3(0.95,1.0,1.0),vScan), (0.61 + vScan * 0.35) * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));

  // Folded bilateral form with a medial fissure: a cortical abstraction,
  // never the anatomical diagram used by identification questions.
  const points: THREE.Vector3[] = [], scattered: THREE.Vector3[] = [];
  const colors: THREE.Color[] = [], edges: number[] = [];
  const rows = 35, columns = 49;
  for (const side of [-1, 1]) {
    const base = points.length;
    for (let i = 0; i <= rows; i++) {
      const u = .035 + (Math.PI - .07) * i / rows;
      for (let j = 0; j <= columns; j++) {
        const v = -Math.PI / 2 + Math.PI * j / columns;
        const fold = 1 + .047 * Math.sin(u * 17 + Math.sin(v * 5) * 2) + .034 * Math.cos(v * 19 + u * 5);
        const dome = Math.sin(u);
        const crown = Math.max(0, Math.cos(u));
        const medialNotch = .085 * Math.pow(crown, 4);
        const p = new THREE.Vector3(
          side * (.11 + .97 * dome * Math.cos(v) * fold),
          1.18 * Math.cos(u) * fold + .09 * Math.sin(v) * dome - medialNotch + .07 * dome * Math.cos(v) * crown,
          .81 * dome * Math.sin(v) * fold,
        );
        points.push(p);
        scattered.push(p.clone().addScaledVector(p.clone().normalize(), 1.7 + random() * 2.8).add(new THREE.Vector3((random() - .5) * 2, (random() - .5) * 2, (random() - .5) * 2)));
        colors.push(new THREE.Color().setRGB(.26 + random() * .25, .67 + random() * .25, .91 + random() * .09));
        const index = base + i * (columns + 1) + j;
        if (j < columns) edges.push(index, index + 1);
        if (i < rows) edges.push(index, index + columns + 1);
        if (i < rows && j < columns && (i + j) % 3 === 0) edges.push(index, index + columns + 2);
      }
    }
  }
  const buildGeometry = (indices: number[]) => {
    const positions = new Float32Array(indices.length * 3);
    const displacement = new Float32Array(indices.length * 3);
    const color = new Float32Array(indices.length * 3);
    indices.forEach((index, i) => {
      points[index].toArray(positions, i * 3);
      scattered[index].toArray(displacement, i * 3);
      colors[index].toArray(color, i * 3);
    });
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(displacement, 3));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    return g;
  };
  anatomy.add(new THREE.LineSegments(buildGeometry(edges), networkMaterial));
  anatomy.add(new THREE.Points(buildGeometry(points.map((_, i) => i)), pointMaterial));
  anatomy.rotation.set(.13, -.1, -.055);
  const deepEdges: number[] = [];
  for (let n = 0; n < 90; n++) {
    const first = Math.floor(random() * points.length);
    let second = Math.floor(random() * points.length);
    if (points[first].distanceTo(points[second]) > 1.7) second = Math.min(points.length - 1, first + 100);
    deepEdges.push(first, second);
  }
  const deepMaterial = material(networkMaterial.clone());
  deepMaterial.uniforms = { ...shared, uOpacity: { value: .17 } };
  anatomy.add(new THREE.LineSegments(buildGeometry(deepEdges), deepMaterial));

  const orbitMaterials: THREE.LineBasicMaterial[] = [], orbits: THREE.Group[] = [];
  const makeOrbit = (radius: number, rotation: THREE.Euler, amber = false) => {
    const group = new THREE.Group(), positions: number[] = [];
    const steps = 210;
    for (let n = 0; n < steps; n++) {
      if ((n > 30 && n < 48) || (n > 114 && n < 148)) continue;
      const a = n / steps * Math.PI * 2, b = (n + 1) / steps * Math.PI * 2;
      positions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0, Math.cos(b) * radius, Math.sin(b) * radius, 0);
      if (n % 7 === 0) positions.push(Math.cos(a) * (radius + .035), Math.sin(a) * (radius + .035), 0, Math.cos(a) * (radius + .08), Math.sin(a) * (radius + .08), 0);
    }
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const m = material(new THREE.LineBasicMaterial({ color: amber ? 0xf0be79 : 0x8de5f4, transparent: true, opacity: amber ? .38 : .28, depthWrite: false, blending: THREE.AdditiveBlending }));
    orbitMaterials.push(m);
    group.add(new THREE.LineSegments(g, m));
    group.rotation.copy(rotation); core.add(group); orbits.push(group);
  };
  makeOrbit(1.4, new THREE.Euler(1.12, -.25, .23));
  makeOrbit(1.5, new THREE.Euler(-.32, .62, -.1));
  makeOrbit(1.58, new THREE.Euler(.12, -.28, .25), true);

  const gridPositions: number[] = [], gridColors: number[] = [];
  const addGridLine = (a: number[], b: number[], intensity: number) => {
    gridPositions.push(...a, ...b);
    for (let n = 0; n < 2; n++) gridColors.push(.21 * intensity, .65 * intensity, .75 * intensity);
  };
  for (let z = -18; z <= 3; z += .85) addGridLine([-13, -2.25, z], [13, -2.25, z], .22 + (z + 18) / 21 * .6);
  for (let x = -13; x <= 13; x += .85) addGridLine([x, -2.25, -18], [x, -2.25, 3], .55);
  const gridGeometry = geometry(new THREE.BufferGeometry());
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
  gridGeometry.setAttribute('color', new THREE.Float32BufferAttribute(gridColors, 3));
  const gridMaterial = material(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .1, depthWrite: false }));
  scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

  const fragments = new THREE.Group();
  const shardShape = geometry(new THREE.TetrahedronGeometry(.06));
  const shardGeometry = geometry(new THREE.EdgesGeometry(shardShape));
  const shardMaterial = material(new THREE.LineBasicMaterial({ color: 0xb1e6ef, transparent: true, opacity: .16, depthWrite: false }));
  for (let n = 0; n < 34; n++) {
    const shard = new THREE.LineSegments(shardGeometry, shardMaterial);
    shard.position.set((random() - .5) * 16, (random() - .5) * 10, -2 - random() * 12);
    shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    shard.scale.setScalar(.4 + random() * 1.5); fragments.add(shard);
  }
  scene.add(fragments);

  const connectorsGeometry = geometry(new THREE.BufferGeometry());
  const connectorPositions = new Float32Array(4 * 4 * 3);
  connectorsGeometry.setAttribute('position', new THREE.BufferAttribute(connectorPositions, 3).setUsage(THREE.DynamicDrawUsage));
  connectorsGeometry.setDrawRange(0, 0);
  const connectorMaterial = material(new THREE.LineBasicMaterial({ color: 0x76cfdf, transparent: true, opacity: .31, depthWrite: false }));
  const connectors = new THREE.LineSegments(connectorsGeometry, connectorMaterial);
  connectors.frustumCulled = false; scene.add(connectors);
  const endpointGeometry = geometry(new THREE.BufferGeometry());
  const endpointPositions = new Float32Array(4 * 3);
  endpointGeometry.setAttribute('position', new THREE.BufferAttribute(endpointPositions, 3).setUsage(THREE.DynamicDrawUsage));
  endpointGeometry.setDrawRange(0, 0);
  const endpointMaterial = material(new THREE.PointsMaterial({ color: 0xdaeff5, size: 3, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false }));
  const endpoints = new THREE.Points(endpointGeometry, endpointMaterial);
  endpoints.frustumCulled = false; scene.add(endpoints);
  const projected = new THREE.Vector3(), ray = new THREE.Vector3();
  const screenToWorld = (x: number, y: number, out: THREE.Vector3) => {
    projected.set(x / width * 2 - 1, 1 - y / height * 2, .5).unproject(camera);
    ray.copy(projected).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
  };
  const updateLayout = () => {
    view = loading ? 'home' : stage?.dataset.view || 'home';
    const mobile = width < 720, home = view === 'home';
    const x = home ? width * .5 : width * (mobile ? 1.05 : .91);
    const y = home ? (mobile ? Math.min(300, height * .39) : height * .56) : height * .56;
    screenToWorld(x, y, targetPosition);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * focalDistance;
    const pixels = home ? (mobile ? 165 : Math.min(290, height * .39, width * .26)) : (mobile ? 200 : 315);
    targetScale = pixels / height * viewHeight / 2.4;
    targetAlpha = home ? 1 : (view === 'course' || view === 'setup' ? .17 : .065);
  };
  const connectorEnd = new THREE.Vector3(), connectorStart = new THREE.Vector3(), elbow = new THREE.Vector3();
  const updateConnectors = () => {
    const buttons = view === 'home' && !loading ? Array.from(stage?.querySelectorAll<HTMLElement>('.portal-cloud') || []).slice(0, 4) : [];
    let count = 0;
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      if (!box.width || !box.height || box.top > height) continue;
      const center = box.left + box.width / 2;
      const x = center < width / 2 ? box.right + 7 : box.left - 7;
      screenToWorld(x, box.top + box.height / 2, connectorEnd);
      connectorStart.copy(core.position);
      const direction = Math.sign(connectorEnd.x - core.position.x) || 1;
      connectorStart.x += direction * .95 * core.scale.x;
      connectorStart.y += (connectorEnd.y - core.position.y) * .27;
      elbow.copy(connectorStart).lerp(connectorEnd, .47); elbow.y = connectorEnd.y;
      connectorStart.toArray(connectorPositions, count * 12); elbow.toArray(connectorPositions, count * 12 + 3);
      elbow.toArray(connectorPositions, count * 12 + 6); connectorEnd.toArray(connectorPositions, count * 12 + 9);
      connectorEnd.toArray(endpointPositions, count * 3); count++;
    }
    connectorsGeometry.setDrawRange(0, count * 4); endpointGeometry.setDrawRange(0, count);
    connectorsGeometry.attributes.position.needsUpdate = true;
    endpointGeometry.attributes.position.needsUpdate = true;
  };

  const render = (now: number) => {
    if (disposed || !contextAvailable || document.hidden || portal?.hidden) return;
    const dt = Math.min((now - previous) / 1000, .04); previous = now;
    if (moving) {
      elapsed += dt;
      for (const axis of ['x', 'y'] as const) {
        cameraVelocity[axis] += (cursor[axis] * .16 - cameraOffset[axis]) * 16 * dt;
        cameraVelocity[axis] *= Math.exp(-6 * dt); cameraOffset[axis] += cameraVelocity[axis] * dt;
      }
      camera.position.x = cameraOffset.x; camera.position.y = cameraOffset.y;
      camera.lookAt(lookAt); camera.updateMatrixWorld();
      anatomy.rotation.y = -.1 + Math.sin(elapsed * .12) * .1;
      anatomy.rotation.z = -.055 + Math.sin(elapsed * .15) * .025;
      orbits[0].rotation.z = .23 + elapsed * .025;
      orbits[1].rotation.z = -.1 - elapsed * .018;
      orbits[2].rotation.z = .25 + elapsed * .012;
      fragments.rotation.y = Math.sin(elapsed * .04) * .06;
      shared.uTime.value = elapsed;
    }
    updateLayout();
    const blend = moving ? 1 - Math.exp(-5 * dt) : 1;
    core.position.lerp(targetPosition, blend);
    core.scale.setScalar(THREE.MathUtils.lerp(core.scale.x, targetScale, blend));
    alpha = THREE.MathUtils.lerp(alpha, targetAlpha, blend);
    shared.uOpacity.value = alpha;
    shared.uAssembly.value = loading && moving ? Math.min(1, Math.max(0, (now - assemblyStart) / 2900)) : 1;
    deepMaterial.uniforms.uOpacity.value = alpha * .15;
    orbitMaterials.forEach((m, index) => { m.opacity = alpha * (index === 2 ? .35 : .26) * shared.uAssembly.value; });
    gridMaterial.opacity = view === 'home' ? .1 : .045;
    shardMaterial.opacity = view === 'home' ? .16 : .065;
    updateConnectors(); renderer.render(scene, camera);
    if (moving) frame = requestAnimationFrame(render);
  };
  const requestRender = () => {
    cancelAnimationFrame(frame);
    if (disposed || !contextAvailable || document.hidden || portal?.hidden) return;
    previous = performance.now(); frame = requestAnimationFrame(render);
  };
  const resize = () => {
    width = Math.max(1, window.innerWidth); height = Math.max(1, window.innerHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    renderer.setSize(width, height, false); updateLayout();
    core.position.copy(targetPosition); core.scale.setScalar(targetScale); requestRender();
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') cursor.set((event.clientX / width - .5) * 2, (.5 - event.clientY / height) * 2);
  };
  const pointerLeave = () => cursor.set(0, 0);
  const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; cancelAnimationFrame(frame); canvas.style.opacity = '0'; };
  const contextRestored = () => { contextAvailable = true; canvas.style.opacity = ''; requestRender(); };
  const observer = new MutationObserver(() => {
    const nextLoading = portal?.classList.contains('portal-loading') ?? false;
    if (nextLoading && !loading) assemblyStart = performance.now();
    loading = nextLoading; requestRender();
  });
  if (stage) observer.observe(stage, { attributes: true, attributeFilter: ['data-view'], childList: true });
  if (portal) observer.observe(portal, { attributes: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('pointermove', pointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', pointerLeave);
  document.addEventListener('visibilitychange', requestRender);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  resize();
  return {
    setMotion(value: boolean) { moving = value; requestRender(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', requestRender);
      window.removeEventListener('pointermove', pointerMove);
      document.documentElement.removeEventListener('pointerleave', pointerLeave);
      document.removeEventListener('visibilitychange', requestRender);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose();
    },
  };
}
