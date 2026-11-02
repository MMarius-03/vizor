import { campusLayout } from './campus-layout.js?v=2';

// Coordinates and proportions share one source with the printed image target.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  root.name = 'atlas-campus';
  const solids = [];
  const outlines = [];
  const buildings = [];
  const labels = [];
  const materials = {
    ground: new THREE.MeshStandardMaterial({ color: 0xd9ddd3, roughness: .94 }),
    plan: new THREE.MeshBasicMaterial({ color: 0xf0efe5 }),
    grass: new THREE.MeshBasicMaterial({ color: 0xaad25f }),
    path: new THREE.MeshBasicMaterial({ color: 0xf7f5ec }),
    wall: new THREE.MeshStandardMaterial({ color: 0x23679e, roughness: .75 }),
    roof: new THREE.MeshBasicMaterial({ color: 0x79b5e2 }),
    neutralWall: new THREE.MeshStandardMaterial({ color: 0x9ca5a4, roughness: .88 }),
    neutralRoof: new THREE.MeshStandardMaterial({ color: 0xd6d9d5, roughness: .9 }),
    window: new THREE.MeshBasicMaterial({ color: 0xe2f3f6 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xeaa43e }),
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x135a9e, transparent: true, opacity: .8 });
  const xy = ([u, v]) => new THREE.Vector2((u / 1000 - .5) * 3.28, (.5 - v / 1000) * 2.44);
  const polygon = points => {
    const vectors = points.map(xy);
    const shape = new THREE.Shape();
    vectors.forEach((p, i) => i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y));
    shape.closePath();
    return shape;
  };
  const add = (geometry, material, name = '', edges = false) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    root.add(mesh);
    solids.push(mesh);
    if (edges) {
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), edgeMaterial);
      root.add(line);
      outlines.push({ mesh, line });
    }
    return mesh;
  };
  const base = add(new THREE.BoxGeometry(3.4, 2.56, .11), materials.ground, 'atlas-campus-base');
  base.position.z = -.07;
  const turf = add(new THREE.BoxGeometry(3.28, 2.44, .012), materials.plan, 'atlas-plan');
  turf.position.z = .002;
  campusLayout.greens.forEach((points, i) => {
    const patch = add(new THREE.ShapeGeometry(polygon(points)), materials.grass, `atlas-lawn-${i}`);
    patch.position.z = .017;
  });
  campusLayout.paths.forEach(({ points, width }, i) => {
    for (let j = 1; j < points.length; j += 1) {
      const a = xy(points[j - 1]), b = xy(points[j]);
      const length = a.distanceTo(b);
      const path = add(new THREE.BoxGeometry(length, width * .003, .012), materials.path, `atlas-path-${i}-${j}`);
      path.position.set((a.x+b.x)/2, (a.y+b.y)/2, .029);
      path.rotation.z = Math.atan2(b.y-a.y, b.x-a.x);
    }
  });
  const [x1,y1,x2,y2] = campusLayout.sportField;
  const fieldCenter = xy([(x1+x2)/2,(y1+y2)/2]);
  const field = add(new THREE.BoxGeometry((x2-x1)*.00328,(y2-y1)*.00244,.014),
    new THREE.MeshStandardMaterial({ color: 0xcce78e, roughness: 1 }), 'atlas-sport-field');
  field.position.set(fieldCenter.x, fieldCenter.y, .03);
  const parkCenter = xy(campusLayout.park.center);
  const park = add(new THREE.TorusGeometry(campusLayout.park.radius*.0029, .012, 6, 36),
    materials.path, 'atlas-park-ring');
  park.position.set(parkCenter.x,parkCenter.y,.035);
  const parkDot = add(new THREE.CylinderGeometry(.035,.035,.025,20), materials.grass, 'atlas-park-centre');
  parkDot.rotation.x = Math.PI/2;
  parkDot.position.set(parkCenter.x,parkCenter.y,.046);

  const labelTexture = text => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#163f6d';
    context.font = `bold ${text.length > 3 ? 50 : 150}px Arial, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 135);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const labelPositions = { A:[768,579], D:[783,370], E:[560,748], 'CĂMIN 1':[475,614], 'CĂMIN 2':[457,453] };
  campusLayout.buildings.forEach((block, index) => {
    const shape = polygon(block.points);
    for (const holePoints of block.holes || []) {
      const hole = new THREE.Path();
      holePoints.map(xy).reverse().forEach((p,i) => i ? hole.lineTo(p.x,p.y) : hole.moveTo(p.x,p.y));
      hole.closePath();
      shape.holes.push(hole);
    }
    const holder = new THREE.Group();
    holder.name = `atlas-building-${block.id}`;
    root.add(holder);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth:block.height, bevelEnabled:false, steps:1 }),
      block.neutral ? materials.neutralWall : materials.wall);
    body.position.z = .038;
    body.name = `${holder.name}-volume`;
    holder.add(body);
    solids.push(body);
    const roof = new THREE.Mesh(new THREE.ShapeGeometry(shape), block.neutral ? materials.neutralRoof : materials.roof);
    roof.position.z = .039 + block.height;
    holder.add(roof); solids.push(roof);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 20), edgeMaterial);
    holder.add(border);
    outlines.push({ mesh:body, line:border });
    if (!block.neutral) {
    const labelPoint = labelPositions[block.id] || [
      block.points.reduce((sum,p)=>sum+p[0],0)/block.points.length,
      block.points.reduce((sum,p)=>sum+p[1],0)/block.points.length,
    ];
    const loc = xy(labelPoint);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(block.id.length > 3 ? .23 : .17, .11),
      new THREE.MeshBasicMaterial({ map:labelTexture(block.id), transparent:true, depthWrite:false }));
    label.position.set(loc.x,loc.y,.043+block.height);
    holder.add(label); labels.push(label);
    }
    buildings.push({ holder, start:.12+index*.022, end:.48+index*.023 });
  });
  const marker = add(new THREE.SphereGeometry(.046,10,8), materials.accent, 'atlas-campus-marker');
  const markerPoint = xy([612,556]);
  marker.position.set(markerPoint.x,markerPoint.y,.35);
  root.rotation.x = -1.18;
  let target = .9, progress = .9, effect = .65, technical = false;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value,0,1); },
    setEffect(value) { effect = THREE.MathUtils.clamp(value,0,1); },
    setTechnical(value) {
      technical = !!value;
      solids.forEach(mesh => { mesh.visible = !technical; });
      outlines.forEach(({ line }) => { line.visible = technical; });
      labels.forEach(label => { label.visible = !technical; });
    },
    update(dt) {
      progress = THREE.MathUtils.damp(progress,target,7,Math.min(dt,.05));
      outlines.forEach(({ mesh,line }) => {
        line.position.copy(mesh.position); line.quaternion.copy(mesh.quaternion); line.scale.copy(mesh.scale);
      });
      buildings.forEach(({ holder,start,end }) => {
        holder.visible = progress > start;
        holder.scale.z = Math.max(.003,THREE.MathUtils.smoothstep(progress,start,end));
      });
      marker.visible = !technical && progress > .75;
      marker.scale.setScalar(.7+effect*.5);
    },
    get progress() { return progress; },
    get effect() { return effect; },
    get technical() { return technical; },
  };
}
