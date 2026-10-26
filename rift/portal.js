import * as THREE from 'three';

const CYAN = new THREE.Color(0xd8f34a);
const LIME = new THREE.Color(0xf0ffae);
const VIOLET = new THREE.Color(0x9cad70);

export function createPortal(scene, camera) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const base = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.85, 80),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.018;
  root.add(base);

  const foot = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 80),
    new THREE.MeshBasicMaterial({ color: 0x344823, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }),
  );
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = 0.011;
  root.add(foot);

  const back = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({ color: 0x080e0a, side: THREE.DoubleSide }),
  );
  back.position.set(0, 1.04, -0.075);
  back.scale.set(0.59, 0.88, 1);
  root.add(back);

  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFrequency: { value: 0.22 }, uPulse: { value: 0 }, uStable: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime; uniform float uFrequency; uniform float uPulse; uniform float uStable;
      void main(){
        vec2 p=vUv-.5; float r=length(p)*2.0; float a=atan(p.y,p.x);
        float spiral=sin(a*5.0-r*13.0+uTime*(1.4+uFrequency*2.0));
        float filaments=pow(max(0.0,sin(a*12.0+r*20.0-uTime*1.9)),8.0);
        float depth=sin(r*27.0-uTime*2.7+spiral*2.0)*.5+.5;
        float pulse=exp(-abs(r-fract(uTime*.42+uPulse*.17))*16.0);
        vec3 deep=vec3(.016,.029,.015);
        vec3 cyan=vec3(.70,.94,.20);
        vec3 violet=vec3(.38,.53,.22);
        vec3 color=mix(deep,mix(cyan,violet,depth),.17+filaments*.52+max(spiral,0.0)*.12);
        color+=cyan*(1.0-r)*(.11+.13*uStable);
        color+=mix(cyan,violet,uFrequency)*pulse*.38;
        color+=cyan*pow(max(0.0,1.0-r),8.0)*.6;
        float edge=1.0-smoothstep(.76,1.0,r);
        gl_FragColor=vec4(color,edge);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(1, 96), coreMaterial);
  core.position.set(0, 1.04, -0.045);
  core.scale.set(0.59, 0.88, 1);
  root.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.13, 10, 96),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.y = 1.04;
  halo.scale.y = 1.35;
  root.add(halo);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.048, 12, 112),
    new THREE.MeshStandardMaterial({ color: 0x324125, emissive: CYAN, emissiveIntensity: 1.3, metalness: 0.65, roughness: 0.27 }),
  );
  outerRing.position.y = 1.04;
  outerRing.scale.y = 1.35;
  root.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.59, 0.012, 6, 96),
    new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  innerRing.position.set(0, 1.04, 0.019);
  innerRing.scale.y = 1.37;
  root.add(innerRing);

  const accents = new THREE.Group();
  accents.position.y = 1.04;
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(i % 3 === 0 ? 0.075 : 0.032, 0.011, 0.015),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? CYAN : VIOLET, transparent: true, opacity: i % 3 === 0 ? 0.9 : 0.5 }),
    );
    mark.position.set(Math.sin(angle) * 0.84, Math.cos(angle) * 1.11, 0.024);
    mark.rotation.z = -angle;
    accents.add(mark);
  }
  root.add(accents);

  const nodeAngles = [-0.8, 0.8, Math.PI];
  const nodes = nodeAngles.map((angle, index) => {
    const group = new THREE.Group();
    group.position.set(Math.sin(angle) * 0.72, 1.04 + Math.cos(angle) * 0.97, 0.065);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const jewel = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.085, 0),
      new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.25 }),
    );
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.userData = { kind: 'node', index };
    group.add(glow, jewel, hit);
    root.add(group);
    return { group, glow, jewel, hit };
  });

  const coreHit = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  coreHit.position.set(0, 1.04, 0.05);
  coreHit.scale.y = 1.4;
  coreHit.userData = { kind: 'core' };
  root.add(coreHit);

  const particles = new THREE.Group();
  for (let i = 0; i < 28; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(i % 5 ? 0.009 : 0.017, 5, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? CYAN : VIOLET, transparent: true, opacity: 0.65 }));
    dot.userData = { angle: i * 2.4, radius: 0.1 + (i % 9) * 0.057, speed: 0.3 + (i % 6) * 0.08, offset: (i % 7) / 7 };
    particles.add(dot);
  }
  particles.position.y = 1.04;
  root.add(particles);

  const light = new THREE.PointLight(CYAN, 2.5, 3.5);
  light.position.set(0, 1.1, 0.3);
  root.add(light);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let placed = false;
  let state = null;
  let lastPulse = 0;
  let pulseKick = 0;
  let time = 0;

  function place(point) {
    root.position.set(point.x, 0, point.z);
    root.rotation.y = Math.atan2(camera.position.x - point.x, camera.position.z - point.z);
    root.scale.setScalar(0.01);
    root.visible = true;
    placed = true;
  }

  function setState(next) {
    state = next;
    if (next.pulse !== lastPulse) { pulseKick = 1; lastPulse = next.pulse; }
    if (next.phase === 'idle') { root.visible = false; placed = false; }
    if (placed && next.phase !== 'idle') root.visible = true;
    nodes.forEach(({ jewel, glow }, i) => {
      const color = next.nodes[i] ? LIME : (Math.abs(next.frequency - [0.22, 0.52, 0.82][i]) < 0.085 ? CYAN : VIOLET);
      jewel.material.color.copy(color);
      jewel.material.emissive.copy(color);
      glow.material.color.copy(color);
    });
  }

  function update(delta) {
    if (!root.visible) return;
    const dt = Math.min(delta, 0.05);
    time += dt;
    pulseKick = Math.max(0, pulseKick - dt * 1.45);
    const targetScale = state?.phase === 'sealed' ? 0.01 : 1;
    root.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(1, dt * (targetScale < 1 ? 2.3 : 5)));
    halo.material.opacity = 0.13 + Math.sin(time * 2.7) * 0.05 + pulseKick * 0.33;
    halo.scale.x = 1 + pulseKick * 0.15;
    halo.scale.y = 1.35 + pulseKick * 0.17;
    innerRing.rotation.z += dt * 0.2;
    accents.rotation.z -= dt * 0.055;
    coreMaterial.uniforms.uTime.value = time;
    coreMaterial.uniforms.uFrequency.value = state?.frequency ?? 0.22;
    coreMaterial.uniforms.uStable.value = state ? state.nodes.filter(Boolean).length / 3 : 0;
    coreMaterial.uniforms.uPulse.value += pulseKick * dt * 3;
    nodes.forEach(({ group, jewel, glow }, i) => {
      jewel.rotation.y += dt * (0.7 + i * 0.2);
      jewel.rotation.x += dt * 0.36;
      glow.scale.setScalar(1 + Math.sin(time * 3 + i * 2) * 0.18 + pulseKick * 0.5);
      group.position.z = 0.065 + Math.sin(time * 2.2 + i * 2) * 0.035;
    });
    for (const dot of particles.children) {
      const { angle, radius, speed, offset } = dot.userData;
      const a = angle + time * speed;
      dot.position.set(Math.sin(a) * radius, Math.cos(a) * radius * 1.28, 0.02 + Math.sin(time + offset * 6) * 0.045);
    }
    light.intensity = 2.2 + Math.sin(time * 3) * 0.5 + pulseKick * 2;
  }

  function pick(clientX, clientY, canvas) {
    if (!placed || !root.visible || root.scale.x < 0.25) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...nodes.map((node) => node.hit), coreHit], false);
    return hits[0]?.object.userData ?? null;
  }

  function groundPoint(clientX, clientY, canvas) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    return raycaster.ray.intersectPlane(ground, point) ? point : null;
  }

  return { place, setState, update, pick, groundPoint, get placed() { return placed; } };
}
