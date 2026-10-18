import * as THREE from 'three';

/** An ambient scene only. Every interactive target is semantic HTML above it. */
export function initializePortalScene(canvas: HTMLCanvasElement): { dispose(): void } {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    canvas.style.display = 'none';
    return { dispose() {} };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, 1, .1, 70);
  camera.position.set(0, 0, 14);
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2(20, 20);
  const pointerTarget = new THREE.Vector2(20, 20);
  let pointerActive = false;
  let disposed = false;
  let frame = 0;
  let previous = performance.now();
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let visibleWidth = 1;
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;

  const sphereGeometry = new THREE.SphereGeometry(1, 40, 28);
  const bubbleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color('#b3dceb') },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-viewPosition.xyz);
        vPosition = position;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        float facing = max(dot(normal, normalize(vView)), 0.0);
        float rim = pow(1.0 - facing, 2.8);
        float light = max(dot(normal, normalize(vec3(-0.65, 0.8, 1.1))), 0.0);
        float highlight = pow(light, 18.0);
        float sheen = sin(vPosition.y * 4.0 + vPosition.x * 2.0 + uTime * 0.15) * 0.5 + 0.5;
        vec3 pearl = mix(uTint, vec3(0.75, 0.72, 0.88), sheen * 0.24);
        vec3 color = pearl * (0.35 + light * 0.45) + vec3(0.84, 0.94, 1.0) * highlight * 0.8;
        float alpha = 0.022 + rim * 0.23 + highlight * 0.19 + light * 0.025;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  type Cloud = {
    group: THREE.Group;
    anchor: THREE.Vector3;
    offset: THREE.Vector3;
    velocity: THREE.Vector3;
    x: number;
    y: number;
    phase: number;
    radius: number;
  };
  const clouds: Cloud[] = [];
  const addCloud = (x: number, y: number, z: number, radius: number, phase: number, satellite = true) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(sphereGeometry, bubbleMaterial);
    body.scale.set(radius * 1.22, radius, radius * .92);
    group.add(body);
    if (satellite) {
      const left = new THREE.Mesh(sphereGeometry, bubbleMaterial);
      left.scale.setScalar(radius * .55);
      left.position.set(-radius * .84, -radius * .26, radius * .1);
      const right = new THREE.Mesh(sphereGeometry, bubbleMaterial);
      right.scale.setScalar(radius * .42);
      right.position.set(radius * .92, radius * .22, radius * .05);
      group.add(left, right);
    }
    const anchor = new THREE.Vector3(x * visibleWidth, y * visibleHeight, z);
    group.position.copy(anchor);
    group.rotation.z = phase * .04;
    scene.add(group);
    clouds.push({ group, anchor, offset: new THREE.Vector3(), velocity: new THREE.Vector3(), x, y, phase, radius });
  };

  // Leave the reading area calm; luminous forms gather at the perimeter.
  addCloud(-.53, .10, -2.8, 1.75, .8);
  addCloud(.55, -.17, -3.2, 2.0, 3.1);
  addCloud(.39, .43, -4.5, .9, 1.9);
  addCloud(-.37, -.44, -4.0, 1.05, 5.2);
  addCloud(-.32, .28, -3.2, .22, 4.1, false);
  addCloud(.27, -.38, -3.0, .32, 2.3, false);
  addCloud(.40, .08, -3.9, .19, 6.1, false);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(135 * 3);
  let seed = 1759;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < 135; index += 1) {
    starPositions[index * 3] = (random() - .5) * 38;
    starPositions[index * 3 + 1] = (random() - .5) * 24;
    starPositions[index * 3 + 2] = -7 - random() * 15;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xb6d1e7, size: .027, sizeAttenuation: true, transparent: true, opacity: .37, depthWrite: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const orbitGeometry = new THREE.TorusGeometry(5.2, .0035, 3, 160);
  const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xa4c8db, transparent: true, opacity: .075, depthWrite: false });
  const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbit.position.set(0, 0, -5.5);
  orbit.rotation.set(1.1, .25, -.3);
  scene.add(orbit);

  const resize = () => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    visibleWidth = visibleHeight * camera.aspect;
    renderer.setSize(width, height, false);
    for (const cloud of clouds) {
      cloud.anchor.x = cloud.x * visibleWidth;
      cloud.anchor.y = cloud.y * visibleHeight;
      // Smaller edge forms protect text on narrow screens.
      cloud.group.scale.setScalar(width < 600 ? .72 : 1);
      cloud.group.position.copy(cloud.anchor).add(cloud.offset);
    }
    if (reducedMotion.matches || document.hidden) renderer.render(scene, camera);
  };

  const movePointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    pointerActive = true;
    pointerTarget.set((event.clientX / width - .5) * visibleWidth, (.5 - event.clientY / height) * visibleHeight);
  };
  const leavePointer = () => { pointerActive = false; };

  const animate = (now: number) => {
    if (disposed || document.hidden) return;
    const dt = Math.min((now - previous) / 1000, .035);
    previous = now;
    if (!reducedMotion.matches) {
      elapsed += dt;
      pointer.lerp(pointerTarget, Math.min(1, dt * 7));
      bubbleMaterial.uniforms.uTime.value = elapsed;
      for (const cloud of clouds) {
        const driftX = Math.sin(elapsed * .13 + cloud.phase) * .13;
        const driftY = Math.cos(elapsed * .17 + cloud.phase) * .15;
        let forceX = (driftX - cloud.offset.x) * 2.1;
        let forceY = (driftY - cloud.offset.y) * 2.1;
        if (pointerActive) {
          const dx = cloud.group.position.x - pointer.x;
          const dy = cloud.group.position.y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const reach = cloud.radius + 1.7;
          if (distance < reach && distance > .001) {
            const force = Math.pow(1 - distance / reach, 2) * 2.3;
            forceX += dx / distance * force;
            forceY += dy / distance * force;
          }
        }
        cloud.velocity.x = (cloud.velocity.x + forceX * dt) * Math.exp(-2.1 * dt);
        cloud.velocity.y = (cloud.velocity.y + forceY * dt) * Math.exp(-2.1 * dt);
        cloud.offset.x += cloud.velocity.x * dt;
        cloud.offset.y += cloud.velocity.y * dt;
        cloud.group.position.copy(cloud.anchor).add(cloud.offset);
        cloud.group.rotation.y = Math.sin(elapsed * .08 + cloud.phase) * .12;
        cloud.group.rotation.z = Math.sin(elapsed * .11 + cloud.phase) * .08;
      }
      stars.rotation.z = Math.sin(elapsed * .025) * .02;
      orbit.rotation.z = -.3 + Math.sin(elapsed * .04) * .08;
    }
    renderer.render(scene, camera);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
  };

  const resume = () => {
    window.cancelAnimationFrame(frame);
    if (document.hidden || disposed) return;
    previous = performance.now();
    frame = window.requestAnimationFrame(animate);
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    window.cancelAnimationFrame(frame);
    canvas.style.opacity = '0';
  };
  const onContextRestored = () => { canvas.style.opacity = ''; resume(); };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', movePointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', leavePointer);
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', resume);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  resize();
  frame = window.requestAnimationFrame(animate);

  return {
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', movePointer);
      document.documentElement.removeEventListener('pointerleave', leavePointer);
      document.removeEventListener('visibilitychange', resume);
      reducedMotion.removeEventListener('change', resume);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      sphereGeometry.dispose();
      bubbleMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      orbitGeometry.dispose();
      orbitMaterial.dispose();
      renderer.dispose();
    },
  };
}
