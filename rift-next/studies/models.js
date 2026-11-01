// Object studies only. Coordinates match the image anchor: XY is the screen,
// and positive Z projects out toward the phone.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  const buildings = [];
  const solid = [];
  const outline = [];
  const roads = [];
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8afa0, roughness: .88 });
  const limestone = new THREE.MeshStandardMaterial({ color: 0xeae3d4, roughness: .92 });
  const terra = new THREE.MeshStandardMaterial({ color: 0xc86a4a, roughness: .78 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x252c2b, roughness: .8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x667573, metalness: .08,
    roughness: .22, transparent: true, opacity: .72, depthWrite: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xeae3d4 });
  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x443c35 });
  const register = (geometry, material, parent = root) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    solid.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), lineMaterial);
    edges.visible = false;
    parent.add(edges);
    outline.push({ mesh, edges });
    return mesh;
  };

  const base = register(new THREE.BoxGeometry(3.35, 2.45, .15), concrete);
  base.position.z = -.02;
  const terrainShape = new THREE.Shape();
  [[-1.48,-.99],[-1.08,-1.15],[-.57,-1.05],[-.12,-1.16],[.5,-1.03],[1.17,-1.1],
    [1.52,-.76],[1.4,-.19],[1.56,.43],[1.19,1.02],[.47,1.11],[-.1,1.02],
    [-.63,1.17],[-1.42,.87],[-1.53,.25]].forEach(([x,y],i) =>
    i ? terrainShape.lineTo(x,y) : terrainShape.moveTo(x,y));
  terrainShape.closePath();
  const terrain = register(new THREE.ExtrudeGeometry(terrainShape, {
    depth: .09, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .035, bevelThickness: .025,
  }), limestone);
  terrain.position.z = .055;

  // Streets are actual recesses between blocks, visible from oblique angles.
  for (const x of [-.95, -.27, .43, 1.03]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(.075, 1.93, .006), roadMaterial);
    road.position.set(x, 0, .185);
    root.add(road);
    roads.push(road);
  }
  for (const y of [-.54, .19, .75]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(2.84, .07, .006), roadMaterial);
    road.position.set(0, y, .185);
    root.add(road);
    roads.push(road);
  }

  const plots = [
    [-1.22,-.82,.42,.39,.31,0],[-.68,-.8,.36,.43,.56,1],[-.04,-.83,.42,.42,.37,0],
    [.72,-.82,.4,.4,.5,0],[1.24,-.77,.29,.38,.3,1],
    [-1.27,-.19,.4,.42,.68,1],[-.62,-.17,.39,.39,.42,0],[.08,-.14,.43,.47,.98,2],
    [.75,-.15,.42,.41,.46,0],[1.29,-.1,.28,.38,.57,1],
    [-1.25,.52,.42,.37,.43,0],[-.63,.5,.35,.4,.62,1],[.07,.49,.4,.43,1.43,2],
    [.75,.49,.38,.4,.73,1],[1.27,.54,.29,.37,.38,0],
  ];
  plots.forEach(([x,y,w,d,h,kind], index) => {
    const holder = new THREE.Group();
    holder.position.set(x,y,.2);
    root.add(holder);
    const face = kind === 2 ? terra : kind === 1 ? charcoal : concrete;
    const body = register(new THREE.BoxGeometry(w,d,h), face, holder);
    body.position.z = h/2;
    const crown = register(new THREE.BoxGeometry(w*1.08,d*1.08,.035), kind === 2 ? limestone : concrete, holder);
    crown.position.z = h + .02;
    if (h > .5) {
      const window = register(new THREE.BoxGeometry(w*.15,d*.72,.012), kind === 2 ? limestone : glass, holder);
      window.position.set(w*.22,0,h*.52);
    }
    if (kind === 2 && h > 1) {
      const beacon = register(new THREE.SphereGeometry(.055,8,6), terra, holder);
      beacon.position.z = h + .13;
    }
    buildings.push({ holder, start: .09 + index * .027, end: .44 + index * .028 });
  });

  const signal = new THREE.Mesh(new THREE.TorusGeometry(1.02,.009,3,80),
    new THREE.MeshBasicMaterial({ color: 0xc86a4a, transparent: true, opacity: .6 }));
  signal.scale.y = .75;
  signal.position.z = .21;
  root.add(signal);
  root.rotation.x = -.72;
  root.rotation.z = -.08;
  let target = .74;
  let progress = .74;
  let technical = false;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value, 0, 1); },
    setTechnical(value) {
      technical = !!value;
      solid.forEach(mesh => { mesh.visible = !technical; });
      outline.forEach(({ edges }) => { edges.visible = technical; });
      roads.forEach(road => { road.visible = !technical; });
    },
    update(dt) {
      progress = THREE.MathUtils.damp(progress, target, 7, Math.min(dt,.05));
      outline.forEach(({mesh,edges}) => {
        edges.position.copy(mesh.position);
        edges.quaternion.copy(mesh.quaternion);
        edges.scale.copy(mesh.scale);
      });
      buildings.forEach(({holder,start,end}) => {
        holder.scale.z = Math.max(.003, THREE.MathUtils.smoothstep(progress,start,end));
      });
      signal.material.opacity = .18 + .38 * progress;
    },
    get progress() { return progress; },
    get technical() { return technical; },
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
  base.rotation.x = Math.PI/2;
  base.position.z = .05;
  const plinth = add(new THREE.CylinderGeometry(.49,.54,.045,48), metal);
  plinth.rotation.x = Math.PI/2;
  plinth.position.z = .13;
  const stem = add(new THREE.CylinderGeometry(.065,.082,.72,20), dark);
  stem.rotation.x = Math.PI/2;
  stem.position.z = .47;
  const axle = new THREE.Group();
  axle.position.z = .94;
  root.add(axle);
  const center = add(new THREE.SphereGeometry(.16,24,16), cobalt, axle);
  const rings = [
    add(new THREE.TorusGeometry(.92,.026,8,96), metal, axle),
    add(new THREE.TorusGeometry(.78,.018,8,96), dark, axle),
    add(new THREE.TorusGeometry(.65,.014,8,96), cobalt, axle),
  ];
  rings[0].rotation.x = .52;
  rings[1].rotation.y = .94;
  rings[2].rotation.set(.68,.68,0);
  const arms = new THREE.Group();
  axle.add(arms);
  const armLengths = [.72,.7,.75];
  armLengths.forEach((length,index) => {
    const angle = Math.PI/2 + index * Math.PI*2/3;
    const end = new THREE.Vector3(Math.cos(angle)*length, Math.sin(angle)*length, .09);
    const beam = add(new THREE.CylinderGeometry(.042,.046,length,10), metal, arms);
    beam.position.copy(end).multiplyScalar(.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().normalize());
    const tip = add(new THREE.SphereGeometry(.095,16,12), index === 0 ? cobalt : metal, arms);
    tip.position.copy(end);
  });
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
  let technical = false;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value,0,1)*Math.PI*2; },
    setTechnical(value) {
      technical = !!value;
      solids.forEach(mesh => { mesh.visible = !technical; });
      technicalLines.visible = technical;
    },
    update(dt) {
      angle = THREE.MathUtils.damp(angle,target,6,Math.min(dt,.05));
      const reveal = THREE.MathUtils.smoothstep(Math.abs(angle),.04,1.3);
      arms.scale.setScalar(Math.max(.01,reveal));
      arms.rotation.z = angle;
      rings[0].rotation.z = angle*.42;
      rings[1].rotation.z = -angle*.57;
      rings[2].rotation.z = angle*.29;
      technicalLines.rotation.z = angle;
      center.material.emissiveIntensity = .5 + .35 * Math.max(0,1-Math.abs(angle/(Math.PI*2)-1));
    },
    get progress() { return angle/(Math.PI*2); },
    get technical() { return technical; },
  };
}
