// Object studies only. Coordinates match the image anchor: XY is the screen,
// and positive Z projects out toward the phone.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  const buildings = [];
  const foundations = [];
  const solid = [];
  const outline = [];
  const roads = [];
  const details = [];
  const concrete = new THREE.MeshStandardMaterial({ color: 0xa59d90, roughness: .9 });
  const limestone = new THREE.MeshStandardMaterial({ color: 0xd3c7b6, roughness: .92 });
  const terrainDark = new THREE.MeshStandardMaterial({ color: 0x746c60, roughness: .95 });
  const sandstone = new THREE.MeshStandardMaterial({ color: 0xb4957c, roughness: .94 });
  const terra = new THREE.MeshStandardMaterial({ color: 0xb95f43, roughness: .78 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x38403d, roughness: .8 });
  const windowDark = new THREE.MeshBasicMaterial({ color: 0x3b423e });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x667573, metalness: .08,
    roughness: .22, transparent: true, opacity: .72, depthWrite: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe2c7aa, transparent: true, opacity: .86 });
  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x443c35 });
  const register = (geometry, material, parent = root, outlineEnabled = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    solid.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), lineMaterial);
    edges.visible = false;
    parent.add(edges);
    outline.push({ mesh, edges, outlineEnabled });
    return mesh;
  };

  const base = register(new THREE.BoxGeometry(3.35, 2.45, .15), terrainDark, root, false);
  base.position.z = -.02;
  const terrainShape = new THREE.Shape();
  [[-1.48,-.99],[-1.08,-1.15],[-.57,-1.05],[-.12,-1.16],[.5,-1.03],[1.17,-1.1],
    [1.52,-.76],[1.4,-.19],[1.56,.43],[1.19,1.02],[.47,1.11],[-.1,1.02],
    [-.63,1.17],[-1.42,.87],[-1.53,.25]].forEach(([x,y],i) =>
    i ? terrainShape.lineTo(x,y) : terrainShape.moveTo(x,y));
  terrainShape.closePath();
  const lowerTerrain = register(new THREE.ExtrudeGeometry(terrainShape, {
    depth: .08, bevelEnabled: false, steps: 1,
  }), concrete, root, false);
  lowerTerrain.scale.set(.97,.96,1);
  lowerTerrain.position.z = .025;
  const terrain = register(new THREE.ExtrudeGeometry(terrainShape, {
    depth: .09, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .035, bevelThickness: .025,
  }), limestone, root, false);
  terrain.position.z = .055;
  const contourMaterial = new THREE.LineBasicMaterial({ color: 0x8b7969, transparent: true, opacity: .6 });
  for (const scale of [.91,.76,.61]) {
    const points = terrainShape.getPoints(36).map(point => new THREE.Vector3(point.x*scale,point.y*scale,.169));
    const contour = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),contourMaterial);
    root.add(contour);
  }

  // Streets are actual recesses between blocks, visible from oblique angles.
  for (const x of [-.95, -.27, .43, 1.03]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(.075, 1.93, .006), roadMaterial);
    road.position.set(x, 0, .185);
    root.add(road);
    roads.push(road);
  }
  for (const y of [.19, .75]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(2.84, .07, .006), roadMaterial);
    road.position.set(0, y, .185);
    root.add(road);
    roads.push(road);
  }

  // The river occupies the gap between the first two rows of buildings.
  const riverCanvas = document.createElement('canvas');
  riverCanvas.width = 256;
  riverCanvas.height = 64;
  const riverContext = riverCanvas.getContext('2d');
  riverContext.fillStyle = '#304f5a';
  riverContext.fillRect(0, 0, 256, 64);
  for (let x = -64; x < 320; x += 34) {
    riverContext.strokeStyle = x % 3 ? '#89aab0' : '#d2d6c9';
    riverContext.lineWidth = x % 3 ? 7 : 4;
    riverContext.beginPath();
    riverContext.moveTo(x, 64);
    riverContext.lineTo(x + 66, 0);
    riverContext.stroke();
  }
  const riverTexture = new THREE.CanvasTexture(riverCanvas);
  riverTexture.colorSpace = THREE.SRGBColorSpace;
  riverTexture.wrapS = THREE.RepeatWrapping;
  riverTexture.wrapT = THREE.RepeatWrapping;
  const riverVertices = [];
  const riverUV = [];
  const riverIndices = [];
  for (let i = 0; i <= 48; i++) {
    const x = -1.48 + i * 2.96 / 48;
    const y = -.51 + Math.sin(x * 3.4) * .018;
    riverVertices.push(x, y - .11, .198, x, y + .11, .198);
    riverUV.push(i / 12, 0, i / 12, 1);
    if (i < 48) {
      const n = i * 2;
      riverIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const riverGeometry = new THREE.BufferGeometry();
  riverGeometry.setAttribute('position', new THREE.Float32BufferAttribute(riverVertices, 3));
  riverGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(riverUV, 2));
  riverGeometry.setIndex(riverIndices);
  riverGeometry.computeVertexNormals();
  const river = new THREE.Mesh(riverGeometry, new THREE.MeshBasicMaterial({
    map: riverTexture, side: THREE.DoubleSide, depthWrite: false,
  }));
  river.name = 'atlas-river';
  root.add(river);
  const foregroundRiver = new THREE.Mesh(riverGeometry, river.material);
  foregroundRiver.scale.y = .72;
  foregroundRiver.position.y = -.66;
  foregroundRiver.name = 'atlas-river-front';
  root.add(foregroundRiver);
  const bridge = register(new THREE.BoxGeometry(.22, .3, .035), limestone, root, false);
  bridge.position.set(.44, -.51, .224);
  const bridgeRail = register(new THREE.BoxGeometry(.02, .3, .035), terra, root, false);
  bridgeRail.position.set(.44, -.51, .257);

  const plots = [
    [-1.22,-.82,.42,.39,.32,3],[-.68,-.8,.36,.43,.78,1],[-.04,-.83,.42,.42,.45,0],
    [.72,-.82,.4,.4,.67,3],[1.24,-.77,.29,.38,.38,1],
    [-1.27,-.19,.4,.42,.94,1],[-.62,-.17,.39,.39,.53,3],[.08,-.14,.43,.47,1.18,2],
    [.75,-.15,.42,.41,.63,0],[1.29,-.1,.28,.38,.72,3],
    [-1.25,.52,.42,.37,.55,0],[-.63,.5,.35,.4,.83,3],[.07,.49,.4,.43,1.43,2],
    [.75,.49,.38,.4,1.02,1],[1.27,.54,.29,.37,.45,0],
  ];
  plots.forEach(([x,y,w,d,h,kind], index) => {
    const foundation = new THREE.Group();
    foundation.name = `atlas-foundation-${index}`;
    foundation.position.set(x,y,.178);
    const pad = register(new THREE.BoxGeometry(w*1.19,d*1.19,.055),kind === 2 ? terra : terrainDark,foundation,false);
    pad.position.z = .027;
    root.add(foundation);
    foundations.push({holder:foundation,start:.07+index*.01,end:.25+index*.01});
    const holder = new THREE.Group();
    holder.name = `atlas-building-${index}`;
    holder.position.set(x,y,.235);
    root.add(holder);
    const face = kind === 2 ? terra : kind === 1 ? charcoal : kind === 3 ? sandstone : concrete;
    const body = register(new THREE.BoxGeometry(w,d,h), face, holder);
    body.position.z = h/2;
    const crown = register(new THREE.BoxGeometry(w*1.08,d*1.08,.035), kind === 2 ? limestone : terrainDark, holder, false);
    crown.position.z = h + .02;
    if (h > .44) {
      const terrace = register(new THREE.BoxGeometry(w*.82,d*.82,.045),kind === 2 ? terra : limestone,holder,false);
      terrace.position.z = h + .058;
    }
    if (h > .5) {
      const rows = Math.min(5,Math.floor(h/.18));
      for(let row=1;row<=rows;row++) {
        const z=row*h/(rows+1);
        for(const offset of [-.21,.21]) {
          const pane = new THREE.Mesh(new THREE.BoxGeometry(w*.16,.008,.075),kind === 2 ? limestone : windowDark);
          pane.position.set(offset*w,-d/2-.007,z);
          holder.add(pane);
          details.push(pane);
        }
      }
      const sideWindow = register(new THREE.BoxGeometry(.009,d*.32,h*.36),kind === 2 ? limestone : glass,holder,false);
      sideWindow.position.set(w/2+.007,0,h*.53);
    }
    if (kind === 2 && h > 1) {
      const crownTop = register(new THREE.BoxGeometry(w*.57,d*.57,.13),charcoal,holder,false);
      crownTop.position.z = h + .135;
      const antenna = register(new THREE.CylinderGeometry(.012,.012,.19,8),terra,holder,false);
      antenna.rotation.x = Math.PI/2;
      antenna.position.z = h + .29;
      const beacon = register(new THREE.SphereGeometry(.045,8,6),terra,holder,false);
      beacon.position.z = h + .39;
    }
    buildings.push({ holder, start: .21 + index * .018, end: .53 + index * .026 });
  });

  const signal = new THREE.Mesh(new THREE.TorusGeometry(1.02,.009,3,80),
    new THREE.MeshBasicMaterial({ color: 0xc86a4a, transparent: true, opacity: .6 }));
  signal.scale.y = .75;
  signal.position.z = .21;
  root.add(signal);
  root.rotation.x = -1.18;
  root.rotation.z = 0;
  let target = .9;
  let progress = .9;
  let technical = false;
  let effect = .65;
  let riverOffset = 0;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value, 0, 1); },
    setEffect(value) { effect = THREE.MathUtils.clamp(value, 0, 1); },
    setTechnical(value) {
      technical = !!value;
      solid.forEach(mesh => { mesh.visible = !technical; });
      outline.forEach(({ edges, outlineEnabled }) => { edges.visible = technical && outlineEnabled; });
      roads.forEach(road => { road.visible = !technical; });
      details.forEach(detail => { detail.visible = !technical; });
      river.visible = !technical;
      foregroundRiver.visible = !technical;
    },
    update(dt) {
      progress = THREE.MathUtils.damp(progress, target, 7, Math.min(dt,.05));
      outline.forEach(({mesh,edges}) => {
        edges.position.copy(mesh.position);
        edges.quaternion.copy(mesh.quaternion);
        edges.scale.copy(mesh.scale);
      });
      buildings.forEach(({holder,start,end}) => {
        holder.visible = progress > start + .06;
        holder.scale.z = Math.max(.003, THREE.MathUtils.smoothstep(progress,start,end));
      });
      foundations.forEach(({holder,start,end}) => {
        holder.visible = progress > start;
        holder.scale.z = Math.max(.003,THREE.MathUtils.smoothstep(progress,start,end));
      });
      roads.forEach(road => { road.visible = !technical && progress > .16; });
      river.visible = !technical && progress > .16;
      foregroundRiver.visible = river.visible;
      bridge.visible = river.visible;
      bridgeRail.visible = river.visible;
      riverOffset = (riverOffset + dt * effect * .23) % 1;
      riverTexture.offset.x = riverOffset;
      signal.material.opacity = .18 + .38 * progress;
    },
    get progress() { return progress; },
    get technical() { return technical; },
    get effect() { return effect; },
    get riverOffset() { return riverOffset; },
  };
}

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
