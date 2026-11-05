export { createAtlas } from './campus.js?v=11';

export function createOrbit(THREE) {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd7dee3, metalness: .68, roughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x26313b, metalness: .46, roughness: .48 });
  const cobalt = new THREE.MeshStandardMaterial({ color: 0x4c72a8, metalness: .25,
    roughness: .22, emissive: 0x183d77, emissiveIntensity: .55 });
  const fine = new THREE.LineDashedMaterial({ color: 0x6e9bd1, dashSize: .06, gapSize: .045,
    transparent: true, opacity: .68 });
  const solids = [];
  const add = (geometry, material, parent = root) => {
    const mesh = new THREE.Mesh(geometry,material);
    parent.add(mesh);
    solids.push(mesh);
    return mesh;
  };
  const base = add(new THREE.CylinderGeometry(.63,.69,.11,48), dark);
  base.position.set(0,-1.05,.28);
  const plinth = add(new THREE.CylinderGeometry(.49,.54,.045,48), metal);
  plinth.position.set(0,-.97,.28);
  const baseRim = add(new THREE.TorusGeometry(.51,.018,8,64),cobalt);
  baseRim.rotation.x = Math.PI/2;
  baseRim.position.set(0,-.93,.28);
  const stem = add(new THREE.CylinderGeometry(.06,.085,.76,20), dark);
  stem.position.set(0,-.57,.5);
  const mount = add(new THREE.CylinderGeometry(.11,.07,.26,20),metal);
  mount.position.set(0,-.14,.65);
  const axle = new THREE.Group();
  axle.position.set(0,.14,.78);
  root.add(axle);
  const center = add(new THREE.SphereGeometry(.16,24,16), cobalt, axle);
  const plasmaMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: .65 } },
    vertexShader: `varying vec3 vPoint; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        vPoint = position;
        vNormalView = normalize(normalMatrix * normal);
        vec4 viewPoint = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-viewPoint.xyz);
        gl_Position = projectionMatrix * viewPoint;
      }`,
    fragmentShader: `uniform float uTime; uniform float uPower;
      varying vec3 vPoint; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        vec3 p = normalize(vPoint);
        float wave = sin(p.x * 27.0 + sin(p.y * 18.0 + uTime * 1.7) * 3.5 + uTime * 2.4);
        float crossWave = sin(p.y * 19.0 - p.z * 11.0 - uTime * 1.5);
        float filament = pow(max(0.0, wave * crossWave), 4.0);
        float rim = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vView))), 2.0);
        vec3 color = mix(vec3(.13, .34, .77), vec3(.76, .94, 1.0), clamp(filament * 1.4 + rim * .4, 0.0, 1.0));
        float alpha = (.09 + filament * .64 + rim * .38) * (.28 + uPower * .72);
        gl_FragColor = vec4(color, alpha);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const plasma = add(new THREE.SphereGeometry(.3, 32, 24), plasmaMaterial, axle);
  plasma.name = 'orbit-plasma';
  const plasmaArcs = [0, 1, 2].map(index => {
    const arc = add(new THREE.TorusGeometry(.34 + index * .024, .006, 4, 52, Math.PI * 1.55),
      new THREE.MeshBasicMaterial({ color: index === 1 ? 0xd5f4ff : 0x6aaefb,
        transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }), axle);
    arc.rotation.set(index * .72, index * 1.1, index * 2.1);
    return arc;
  });
  const rings = [
    add(new THREE.TorusGeometry(.92,.026,8,96), metal, axle),
    add(new THREE.TorusGeometry(.78,.018,8,96), dark, axle),
    add(new THREE.TorusGeometry(.65,.014,8,96), cobalt, axle),
  ];
  rings[0].rotation.x = .52;
  rings[1].rotation.y = .94;
  rings[2].rotation.set(.68,.68,0);
  [rings[0],rings[1]].forEach((ring,ringIndex) => {
    const count = ringIndex ? 16 : 24;
    const radius = ringIndex ? .78 : .92;
    for(let i=0;i<count;i++) {
      const t=i*Math.PI*2/count;
      const tick = add(new THREE.BoxGeometry(i%4 ? .027 : .052,.014,.014),
        i%4 ? dark : cobalt,ring);
      tick.position.set(Math.cos(t)*radius,Math.sin(t)*radius,.008);
      tick.rotation.z=t;
    }
  });
  const arms = new THREE.Group();
  axle.add(arms);
  const armGroups=[];
  const armLengths = [.72,.7,.75];
  armLengths.forEach((length,index) => {
    const armGroup=new THREE.Group();
    arms.add(armGroup);
    armGroups.push(armGroup);
    const angle = Math.PI/2 + index * Math.PI*2/3;
    const end = new THREE.Vector3(Math.cos(angle)*length, Math.sin(angle)*length, .09);
    const beam = add(new THREE.CylinderGeometry(.042,.046,length,10), metal, armGroup);
    beam.position.copy(end).multiplyScalar(.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().normalize());
    const tip = add(new THREE.SphereGeometry(.095,16,12), index === 0 ? cobalt : metal, armGroup);
    tip.position.copy(end);
  });
  const glowCanvas=document.createElement('canvas');
  glowCanvas.width=glowCanvas.height=64;
  const glowContext=glowCanvas.getContext('2d');
  const glowGradient=glowContext.createRadialGradient(32,32,2,32,32,31);
  glowGradient.addColorStop(0,'rgba(239,250,255,1)');
  glowGradient.addColorStop(.25,'rgba(145,196,255,.8)');
  glowGradient.addColorStop(1,'rgba(60,110,200,0)');
  glowContext.fillStyle=glowGradient;
  glowContext.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);
  const glowMaterial=new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false});
  const glow=new THREE.Sprite(glowMaterial);
  glow.position.z=.23;
  glow.scale.set(.95,.95,1);
  axle.add(glow);
  const convergenceMaterial=new THREE.LineBasicMaterial({color:0xe5f4ff,transparent:true,opacity:0,depthWrite:false});
  const convergence=new THREE.Group();
  axle.add(convergence);
  const beamPoints=[];
  for(let i=0;i<3;i++) {
    const t=Math.PI/2+i*Math.PI*2/3;
    beamPoints.push(new THREE.Vector3(Math.cos(t)*.7,Math.sin(t)*.7,.16),new THREE.Vector3(0,0,.18));
  }
  convergence.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(beamPoints),convergenceMaterial));
  for(const [radius,sides,rotation] of [[.28,4,Math.PI/4],[.42,4,0],[.57,3,Math.PI/2]]) {
    const points=[];
    for(let i=0;i<=sides;i++) {
      const t=i*Math.PI*2/sides+rotation;
      points.push(new THREE.Vector3(Math.cos(t)*radius,Math.sin(t)*radius,.2));
    }
    convergence.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),convergenceMaterial));
  }
  for (const [radius,rotation] of [[1.03,0],[.87,.65]]) {
    const points = [];
    for (let i=0;i<=120;i++) {
      const t = i*Math.PI*2/120;
      points.push(new THREE.Vector3(Math.cos(t)*radius,Math.sin(t)*radius,0));
    }
    const trace = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),fine);
    trace.computeLineDistances();
    trace.rotation.x = rotation;
    axle.add(trace);
  }
  const technicalLines = new THREE.Group();
  technicalLines.visible = false;
  axle.add(technicalLines);
  const technicalMaterial = new THREE.LineBasicMaterial({ color: 0xd7dee3 });
  for (const [radius,rx,ry] of [[.92,.52,0],[.78,0,.94],[.65,.68,.68]]) {
    const points=[];
    for(let i=0;i<=96;i++) {
      const t=i*Math.PI*2/96;
      points.push(new THREE.Vector3(Math.cos(t)*radius,Math.sin(t)*radius,0));
    }
    const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),technicalMaterial);
    ring.rotation.set(rx,ry,0);
    technicalLines.add(ring);
  }
  for (let i=0;i<3;i++) {
    const t=Math.PI/2+i*Math.PI*2/3;
    const point=new THREE.Vector3(Math.cos(t)*.73,Math.sin(t)*.73,.09);
    const arm=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),point]),technicalMaterial);
    technicalLines.add(arm);
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),
      new THREE.MeshBasicMaterial({color:0x6e9bd1,wireframe:true}));
    marker.position.copy(point);
    technicalLines.add(marker);
  }
  let target = 0;
  let angle = 0;
  let progress = 0;
  let technical = false;
  let effect = .65;
  let plasmaTime = 0;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value,0,1)*Math.PI*2; },
    setEffect(value) { effect = THREE.MathUtils.clamp(value,0,1); },
    setTechnical(value) {
      technical = !!value;
      solids.forEach(mesh => { mesh.visible = !technical; });
      technicalLines.visible = technical;
    },
    update(dt) {
      plasmaTime += dt * effect * 2.8;
      plasmaMaterial.uniforms.uTime.value = plasmaTime;
      plasmaMaterial.uniforms.uPower.value = effect;
      plasmaArcs.forEach((arc, index) => {
        arc.rotation.z += dt * effect * (index % 2 ? -.9 : 1.2);
        arc.material.opacity = .12 + effect * .48;
      });
      angle = THREE.MathUtils.damp(angle,target,6,Math.min(dt,.05));
      progress=Math.abs(angle)/(Math.PI*2);
      armGroups.forEach((group,index) => {
        const reveal=THREE.MathUtils.smoothstep(progress,index*.23+.03,index*.23+.26);
        group.scale.setScalar(Math.max(.01,reveal));
      });
      arms.rotation.z = angle;
      rings[0].rotation.z = angle*.42;
      rings[1].rotation.z = -angle*.57;
      rings[2].rotation.z = angle*.29;
      rings.forEach((ring,index) => {
        const reveal=THREE.MathUtils.smoothstep(progress,.09+index*.08,.38+index*.08);
        ring.scale.setScalar(Math.max(.02,reveal));
      });
      technicalLines.rotation.z = angle;
      const aligned=THREE.MathUtils.smoothstep(progress,.94,.995);
      convergenceMaterial.opacity=aligned*.93;
      glowMaterial.opacity=effect*.14+aligned*.75;
      glow.scale.setScalar(.75+aligned*.7);
      center.material.emissiveIntensity=.55+aligned*1.8;
    },
    get progress() { return progress; },
    get aligned() { return progress>.995; },
    get technical() { return technical; },
    get effect() { return effect; },
    get plasmaTime() { return plasmaTime; },
  };
}
