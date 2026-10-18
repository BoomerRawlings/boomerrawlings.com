import * as THREE from 'three';
import portalAtlas from '../../data/brain/portal-brain.json';

type SceneOptions = { moving?: boolean };
type PortalScene = { dispose(): void; setMotion(moving: boolean): void };
type PortalAtlas = { meshes: { id: string; kind: string; positions: string; normals: string; edges: string }[] };

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
  let textReady = false, atlasReady = false;
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
    uTime: { value: 0 }, uAssembly: { value: 1 }, uName: { value: 1 },
    uOpacity: { value: 1 }, uWire: { value: 1 },
    uSize: { value: 1.35 * Math.min(window.devicePixelRatio || 1, 1.5) },
  };
  const vertexShader = `
    attribute vec3 aScatter;
    attribute vec3 aWord;
    attribute vec3 aText;
    attribute vec3 aNormal;
    attribute vec2 aTextWeight;
    attribute vec3 color;
    uniform float uAssembly;
    uniform float uName;
    uniform float uTime;
    uniform float uSize;
    varying vec3 vColor;
    varying float vScan;
    varying float vInk;
    varying float vFacing;
    void main() {
      float gather = smoothstep(0.0, 1.0, uAssembly);
      float name = smoothstep(0.0, 1.0, uName);
      vec3 lettering = mix(aWord, aText, name);
      vec3 p = mix(lettering, position, gather);
      float stream = sin(gather * 3.14159265);
      p.x += sin(lettering.y * 1.3 + aScatter.x) * stream * 0.18;
      p.y += cos(lettering.x * 1.2 + aScatter.y) * stream * 0.12;
      p.z += sin(lettering.x * 0.9 + aScatter.z) * stream * 0.42;
      vec3 normal = normalize(mat3(modelViewMatrix) * aNormal);
      vFacing = mix(1.0, 0.16 + 0.84 * smoothstep(-0.2, 0.7, normal.z), gather);
      vInk = mix(mix(aTextWeight.x, aTextWeight.y, name), 1.0, gather);
      float scan = mod(uTime * 0.34, 3.4) - 1.7;
      vScan = exp(-pow((position.y - scan) * 15.0, 2.0)) * gather;
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
      uniform float uWire;
      varying vec3 vColor;
      varying float vScan;
      varying float vInk;
      varying float vFacing;
      void main() {
        vec3 ink = mix(vColor, vec3(0.88, 0.98, 1.0), vScan);
        gl_FragColor = vec4(ink, (0.2 + vScan * 0.4) * uOpacity * uWire * vInk * vFacing);
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
      varying float vInk;
      varying float vFacing;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (abs(p.x) + abs(p.y) > 1.0) discard;
        gl_FragColor = vec4(mix(vColor, vec3(0.95,1.0,1.0),vScan), (0.43 + vScan * 0.3) * uOpacity * vInk * vFacing);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));

  // Bundled measured exterior data is decoded before the first frame. Its same
  // connected edges form both wordmarks and the final anatomical surface.
  const points: THREE.Vector3[] = [], scattered: THREE.Vector3[] = [], normals: THREE.Vector3[] = [];
  const textGeometries: { geometry: THREE.BufferGeometry; indices: number[]; kind: 'wire' | 'points' }[] = [];
  const colors: THREE.Color[] = [], edges: number[] = [];
  const buildGeometry = (indices: number[], kind: 'wire' | 'points' = 'wire') => {
    const positions = new Float32Array(indices.length * 3);
    const displacement = new Float32Array(indices.length * 3);
    const color = new Float32Array(indices.length * 3);
    const normal = new Float32Array(indices.length * 3);
    indices.forEach((index, i) => {
      points[index].toArray(positions, i * 3);
      scattered[index].toArray(displacement, i * 3);
      colors[index].toArray(color, i * 3);
      normals[index].toArray(normal, i * 3);
    });
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(displacement, 3));
    g.setAttribute('aWord', new THREE.BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute('aText', new THREE.BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute('aNormal', new THREE.BufferAttribute(normal, 3));
    g.setAttribute('aTextWeight', new THREE.BufferAttribute(new Float32Array(indices.length * 2).fill(1), 2));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    textGeometries.push({ geometry: g, indices, kind });
    return g;
  };
  anatomy.rotation.set(.16, -1.04, -.035);

  const orbitMaterials: THREE.LineBasicMaterial[] = [], orbits: THREE.Group[] = [];
  const orbitTracers: THREE.Points[] = [];
  const tracerMaterial = material(new THREE.PointsMaterial({ color: 0xc8f6ff, size: 3.5, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
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
    const tracerGeometry = geometry(new THREE.BufferGeometry());
    tracerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([radius, 0, 0], 3));
    const tracer = new THREE.Points(tracerGeometry, tracerMaterial);
    tracer.userData.radius = radius; group.add(tracer); orbitTracers.push(tracer);
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
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial); scene.add(grid);

  // Several depth planes share a slow current. Sparse links and drifting points
  // make the space move continuously without competing with reading surfaces.
  const currentUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 }, uLinked: { value: 0 } };
  const currentVertex = `
    attribute float aPhase;
    uniform float uTime;
    uniform float uLinked;
    varying float vPhase;
    varying float vDepth;
    void main() {
      vec3 p = position;
      float rise = uTime * (0.045 + aPhase * 0.04);
      float loop = mod(p.y + 6.0 + rise, 12.0) - 6.0;
      float linkedLoop = p.y + mod(rise + aPhase * 12.0, 12.0) - aPhase * 12.0;
      p.y = mix(loop, linkedLoop, uLinked);
      p.x += sin(uTime * 0.13 + p.y * 0.6 + aPhase * 6.28) * 0.23;
      p.z += sin(uTime * 0.08 + aPhase * 6.28) * 0.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((1.5 + aPhase * 2.5) * 8.4 / -mv.z, 0.8, 3.0);
      vPhase = aPhase;
      vDepth = clamp(1.0 - (-mv.z - 5.0) / 20.0, 0.08, 1.0);
    }
  `;
  const currentMaterial = material(new THREE.ShaderMaterial({
    uniforms: currentUniforms, vertexShader: currentVertex,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying float vPhase;
      varying float vDepth;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float pulse = 0.55 + 0.3 * sin(uTime * 0.55 + vPhase * 6.28);
        gl_FragColor = vec4(mix(vec3(0.3,0.67,0.78),vec3(0.75,0.95,1.0),vPhase), (1.0-d*d) * pulse * vDepth * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const currentPositions: number[] = [], currentPhases: number[] = [];
  const currentCount = window.innerWidth < 720 ? 220 : 520;
  for (let n = 0; n < currentCount; n++) {
    currentPositions.push((random() - .5) * 24, (random() - .5) * 12, -1.5 - random() * 15);
    currentPhases.push(random());
  }
  const currentGeometry = geometry(new THREE.BufferGeometry());
  currentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(currentPositions, 3));
  currentGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(currentPhases, 1));
  const current = new THREE.Points(currentGeometry, currentMaterial); current.frustumCulled = false; scene.add(current);

  const currentLinkPositions: number[] = [], currentLinkPhases: number[] = [];
  // Local pairs use a shared phase so links remain short while they drift.
  for (let n = 0; n < 70; n++) {
    const x = (random() - .5) * 22, y = (random() - .5) * 10, z = -4 - random() * 12, phase = random();
    currentLinkPositions.push(x, y, z, x + .18 + random() * .7, y + .1 + random() * .45, z - random() * .5);
    currentLinkPhases.push(phase, phase);
  }
  const currentLinkGeometry = geometry(new THREE.BufferGeometry());
  currentLinkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(currentLinkPositions, 3));
  currentLinkGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(currentLinkPhases, 1));
  const currentLinkMaterial = material(new THREE.ShaderMaterial({
    uniforms: { ...currentUniforms, uLinked: { value: 1 } }, vertexShader: currentVertex,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying float vPhase;
      varying float vDepth;
      void main() {
        float pulse = 0.05 + 0.09 * pow(0.5 + 0.5 * sin(uTime * 0.6 + vPhase * 6.28), 3.0);
        gl_FragColor = vec4(0.3,0.68,0.8,pulse * vDepth * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const currentLinks = new THREE.LineSegments(currentLinkGeometry, currentLinkMaterial); currentLinks.frustumCulled = false; scene.add(currentLinks);

  const fragments = new THREE.Group();
  const shardShape = geometry(new THREE.TetrahedronGeometry(.06));
  const shardGeometry = geometry(new THREE.EdgesGeometry(shardShape));
  const shardMaterial = material(new THREE.LineBasicMaterial({ color: 0xb1e6ef, transparent: true, opacity: .16, depthWrite: false }));
  for (let n = 0; n < 34; n++) {
    const shard = new THREE.LineSegments(shardGeometry, shardMaterial);
    shard.position.set((random() - .5) * 16, (random() - .5) * 10, -2 - random() * 12);
    shard.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    shard.userData.phase = random() * Math.PI * 2;
    shard.userData.baseY = shard.position.y;
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
  const packetGeometry = geometry(new THREE.BufferGeometry());
  const packetPositions = new Float32Array(4 * 2 * 3);
  packetGeometry.setAttribute('position', new THREE.BufferAttribute(packetPositions, 3).setUsage(THREE.DynamicDrawUsage));
  packetGeometry.setDrawRange(0, 0);
  const packetMaterial = material(new THREE.PointsMaterial({ color: 0xd6f8ff, size: 3, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
  const packets = new THREE.Points(packetGeometry, packetMaterial); packets.frustumCulled = false; scene.add(packets);
  const projected = new THREE.Vector3(), ray = new THREE.Vector3();
  const screenToWorld = (x: number, y: number, out: THREE.Vector3) => {
    projected.set(x / width * 2 - 1, 1 - y / height * 2, .5).unproject(camera);
    ray.copy(projected).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
  };
  const sampleIntroText = () => {
    if (disposed) return;
    const resolution = Math.min(1, 1400 / width);
    const rasterize = (lines: HTMLElement[]) => {
      const textCanvas = document.createElement('canvas');
      textCanvas.width = Math.ceil(width * resolution); textCanvas.height = Math.ceil(height * resolution);
      const context = textCanvas.getContext('2d', { willReadFrequently: true });
      if (!context || !lines.length) return null;
      context.scale(resolution, resolution); context.fillStyle = '#fff';
      for (const line of lines) {
        const box = line.getBoundingClientRect(), style = getComputedStyle(line);
        if (!box.width || !box.height || !line.textContent?.trim()) continue;
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.textAlign = 'center'; context.textBaseline = 'alphabetic';
        if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
        const label = line.textContent.trim(), metrics = context.measureText(label);
        const baseline = box.top + (box.height + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
        context.fillText(label, box.left + box.width / 2, baseline);
      }
      const pixels = context.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
      const samples: THREE.Vector3[] = [], segments: number[] = [], cells = new Map<string, number>();
      const step = width < 720 ? 2 : 3;
      for (let y = 0; y < textCanvas.height; y += step) {
        for (let x = 0; x < textCanvas.width; x += step) {
          if (pixels[(y * textCanvas.width + x) * 4 + 3] < 105) continue;
          const point = screenToWorld(x / resolution, y / resolution, new THREE.Vector3()).sub(core.position).divideScalar(core.scale.x);
          const index = samples.length; samples.push(point); cells.set(`${x},${y}`, index);
          for (const [dx, dy] of [[-step, 0], [0, -step], [-step, -step]]) {
            const neighbor = cells.get(`${x + dx},${y + dy}`);
            if (neighbor !== undefined) segments.push(neighbor, index);
          }
        }
      }
      return samples.length && segments.length ? { samples, segments } : null;
    };
    const word = document.querySelector<HTMLElement>('.intro-wordmark-text');
    const wordShape = rasterize(word ? [word] : []);
    const nameShape = rasterize(Array.from(document.querySelectorAll<HTMLElement>('#intro-expansion .intro-expansion-line')));
    if (!wordShape || !nameShape) { textReady = false; return; }
    for (const entry of textGeometries) {
      const weights = entry.geometry.getAttribute('aTextWeight') as THREE.BufferAttribute;
      for (const [shape, attributeName, axis] of [[wordShape, 'aWord', 0], [nameShape, 'aText', 1]] as const) {
        const attribute = entry.geometry.getAttribute(attributeName) as THREE.BufferAttribute;
        const targetCount = entry.kind === 'wire' ? entry.indices.length / 2 : entry.indices.length;
        const sourceCount = entry.kind === 'wire' ? shape.segments.length / 2 : shape.samples.length;
        const weight = Math.min(1.5, sourceCount / Math.max(1, targetCount)) * (entry.kind === 'wire' ? 2 : .24);
        for (let n = 0; n < targetCount; n++) {
          const sourceIndex = Math.floor(n / targetCount * sourceCount);
          if (entry.kind === 'wire') {
            for (let end = 0; end < 2; end++) {
              const p = shape.samples[shape.segments[sourceIndex * 2 + end]];
              attribute.setXYZ(n * 2 + end, p.x, p.y, p.z);
              weights.setComponent(n * 2 + end, axis, weight);
            }
          } else {
            const p = shape.samples[sourceIndex]; attribute.setXYZ(n, p.x, p.y, p.z);
            weights.setComponent(n, axis, weight);
          }
        }
        attribute.needsUpdate = true;
      }
      weights.needsUpdate = true;
    }
    textReady = document.fonts.status === 'loaded';
  };
  const installMeasuredBrain = () => {
    try {
      const atlas = portalAtlas as PortalAtlas;
      const bytes = (encoded: string) => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const signedWords = (encoded: string) => {
        const data = bytes(encoded), view = new DataView(data.buffer);
        return Array.from({ length: data.length / 2 }, (_, index) => view.getInt16(index * 2, true));
      };
      const unsignedWords = (encoded: string) => {
        const data = bytes(encoded), view = new DataView(data.buffer);
        return Array.from({ length: data.length / 2 }, (_, index) => view.getUint16(index * 2, true));
      };
      const sourcePoints: THREE.Vector3[] = [], sourceNormals: THREE.Vector3[] = [], sourceColors: THREE.Color[] = [], sourceEdges: number[] = [];
      for (const item of atlas.meshes) {
        const positions = signedWords(item.positions), normalData = new Int8Array(bytes(item.normals).buffer), meshEdges = unsignedWords(item.edges);
        if (positions.length % 3 || normalData.length !== positions.length || meshEdges.length % 2) throw new Error('Invalid reference surface');
        const offset = sourcePoints.length;
        for (let n = 0; n < positions.length; n += 3) {
          // Same anatomical reflection as the detailed atlas: R,S,A -> a right-handed scene.
          sourcePoints.push(new THREE.Vector3(-positions[n] / 100, positions[n + 1] / 100, positions[n + 2] / 100));
          sourceNormals.push(new THREE.Vector3(-normalData[n] / 127, normalData[n + 1] / 127, normalData[n + 2] / 127).normalize());
          sourceColors.push(new THREE.Color(item.kind === 'cerebellum' ? 0x6ed1e5 : item.kind === 'brainstem' ? 0x9be5ed : 0x74d9ef));
        }
        meshEdges.forEach(index => sourceEdges.push(offset + index));
      }
      if (sourcePoints.length < 1000) throw new Error('Incomplete reference surface');
      const bounds = new THREE.Box3().setFromPoints(sourcePoints), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      const scale = 2.4 / Math.max(size.x, size.y, size.z);
      anatomy.clear();
      for (const entry of textGeometries) {
        entry.geometry.dispose(); const index = geometries.indexOf(entry.geometry); if (index >= 0) geometries.splice(index, 1);
      }
      textGeometries.length = 0; points.length = 0; normals.length = 0; scattered.length = 0; colors.length = 0; edges.length = 0;
      sourcePoints.forEach((point, index) => {
        point.sub(center).multiplyScalar(scale); points.push(point); normals.push(sourceNormals[index]); colors.push(sourceColors[index]);
        scattered.push(new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1));
      });
      edges.push(...sourceEdges);
      anatomy.add(new THREE.LineSegments(buildGeometry(edges), networkMaterial));
      anatomy.add(new THREE.Points(buildGeometry(points.map((_, index) => index), 'points'), pointMaterial));
      atlasReady = true;
    } catch (error) {
      console.warn('Brain portal reference surface could not be decoded.', error);
    }
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
    targetAlpha = home ? 1 : (view === 'course' || view === 'scope' || view === 'setup' ? .17 : .065);
  };
  const connectorEnd = new THREE.Vector3(), connectorStart = new THREE.Vector3(), elbow = new THREE.Vector3(), packet = new THREE.Vector3();
  const updateConnectors = () => {
    const buttons = view === 'home' && !loading ? Array.from(stage?.querySelectorAll<HTMLElement>('.portal-cloud') || []).slice(0, 4) : [];
    let count = 0, active = false;
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
      const firstDistance = connectorStart.distanceTo(elbow), secondDistance = elbow.distanceTo(connectorEnd);
      const bend = firstDistance / Math.max(.001, firstDistance + secondDistance);
      for (let pulse = 0; pulse < 2; pulse++) {
        const progress = (elapsed * .21 + count * .19 + pulse * .5) % 1;
        if (progress < bend) packet.copy(connectorStart).lerp(elbow, progress / Math.max(.001, bend));
        else packet.copy(elbow).lerp(connectorEnd, (progress - bend) / Math.max(.001, 1 - bend));
        packet.toArray(packetPositions, (count * 2 + pulse) * 3);
      }
      active ||= button.matches(':hover, :focus-visible');
      connectorEnd.toArray(endpointPositions, count * 3); count++;
    }
    connectorsGeometry.setDrawRange(0, count * 4); endpointGeometry.setDrawRange(0, count);
    packetGeometry.setDrawRange(0, count * 2);
    connectorMaterial.opacity = active ? .48 : .25 + Math.sin(elapsed * .7) * .035;
    endpointMaterial.opacity = active ? .95 : .65;
    connectorsGeometry.attributes.position.needsUpdate = true;
    endpointGeometry.attributes.position.needsUpdate = true;
    packetGeometry.attributes.position.needsUpdate = true;
  };

  const render = (now: number) => {
    if (disposed || !contextAvailable || document.hidden || portal?.hidden) return;
    const dt = Math.min((now - previous) / 1000, .04); previous = now;
    const introTime = Math.max(0, (now - assemblyStart) / 1000);
    const assembly = atlasReady ? (loading ? THREE.MathUtils.clamp((introTime - 3.8) / 2.55, 0, 1) : 1) : 0;
    if (moving) {
      elapsed += dt;
      for (const axis of ['x', 'y'] as const) {
        cameraVelocity[axis] += ((loading ? 0 : cursor[axis] * .16) - cameraOffset[axis]) * 16 * dt;
        cameraVelocity[axis] *= Math.exp(-6 * dt); cameraOffset[axis] += cameraVelocity[axis] * dt;
      }
      camera.position.x = cameraOffset.x; camera.position.y = cameraOffset.y;
      camera.lookAt(lookAt); camera.updateMatrixWorld();
      orbits[0].rotation.z = .23 + elapsed * .025;
      orbits[1].rotation.z = -.1 - elapsed * .018;
      orbits[2].rotation.z = .25 + elapsed * .012;
      fragments.rotation.y = Math.sin(elapsed * .04) * .06;
      fragments.children.forEach((shard, index) => {
        shard.rotation.x += dt * (.025 + index % 3 * .012);
        shard.rotation.z += dt * (index % 2 ? .035 : -.025);
        shard.position.y = shard.userData.baseY + Math.sin(elapsed * .16 + shard.userData.phase) * .24;
      });
      grid.position.z = elapsed * .065 % .85;
      orbitTracers.forEach((tracer, index) => {
        const radius = tracer.userData.radius, angle = elapsed * (.15 + index * .045) + index * 2;
        const attribute = tracer.geometry.getAttribute('position') as THREE.BufferAttribute;
        attribute.setXYZ(0, Math.cos(angle) * radius, Math.sin(angle) * radius, 0); attribute.needsUpdate = true;
      });
      shared.uTime.value = elapsed;
      currentUniforms.uTime.value = elapsed;
    }
    // The orientation follows the intro state even when ambient motion is paused.
    anatomy.rotation.x = .16 * assembly;
    anatomy.rotation.y = (-1.04 + Math.sin(elapsed * .12) * .18) * assembly;
    anatomy.rotation.z = (-.035 + Math.sin(elapsed * .15) * .025) * assembly;
    updateLayout();
    const blend = moving ? 1 - Math.exp(-5 * dt) : 1;
    core.position.lerp(targetPosition, blend);
    core.scale.setScalar(THREE.MathUtils.lerp(core.scale.x, targetScale, blend));
    alpha = THREE.MathUtils.lerp(alpha, targetAlpha, blend);
    const introOpacity = loading ? (moving && textReady ? THREE.MathUtils.smoothstep(introTime, 0, .3) : 0) : 1;
    anatomy.visible = loading ? textReady : atlasReady;
    shared.uOpacity.value = alpha * introOpacity;
    shared.uAssembly.value = assembly;
    shared.uName.value = loading ? THREE.MathUtils.clamp((introTime - 1.1) / 1.2, 0, 1) : 1;
    shared.uWire.value = 1;
    orbitMaterials.forEach((m, index) => { m.opacity = alpha * (index === 2 ? .35 : .26) * assembly * introOpacity; });
    tracerMaterial.opacity = alpha * .78 * assembly * introOpacity;
    const ambient = loading ? .35 : view === 'home' ? 1 : view === 'quiz' || view === 'cards' ? .25 : .6;
    gridMaterial.opacity = ambient * .13;
    shardMaterial.opacity = ambient * .22;
    currentUniforms.uOpacity.value = ambient * .68;
    updateConnectors(); renderer.render(scene, camera);
    const wiretextVisible = Boolean(loading && moving && textReady && introOpacity > .95);
    if (portal?.classList.contains('portal-wiretext-ready') !== wiretextVisible) portal?.classList.toggle('portal-wiretext-ready', wiretextVisible);
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
    core.position.copy(targetPosition); core.scale.setScalar(targetScale);
    if (loading) sampleIntroText(); requestRender();
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') cursor.set((event.clientX / width - .5) * 2, (.5 - event.clientY / height) * 2);
  };
  const pointerLeave = () => cursor.set(0, 0);
  const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; cancelAnimationFrame(frame); canvas.style.opacity = '0'; portal?.classList.remove('portal-wiretext-ready'); };
  const contextRestored = () => { contextAvailable = true; canvas.style.opacity = ''; requestRender(); };
  const observer = new MutationObserver(() => {
    const nextLoading = portal?.classList.contains('portal-loading') ?? false;
    if (nextLoading && !loading) { assemblyStart = performance.now(); sampleIntroText(); }
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
  installMeasuredBrain();
  previous = assemblyStart = performance.now();
  resize();
  void document.fonts.ready.then(() => { if (!disposed && loading) { sampleIntroText(); requestRender(); } });
  return {
    setMotion(value: boolean) { moving = value; if (!moving) portal?.classList.remove('portal-wiretext-ready'); requestRender(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); portal?.classList.remove('portal-wiretext-ready');
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
