import { campusLayout } from './campus-layout.js?v=3';

// Coordinates and proportions share one source with the printed image target.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  root.name = 'atlas-campus';
  const solids = [];
  const outlines = [];
  const buildings = [];
  const labels = [];
  // One small, shared texture keeps the campus detailed without adding image downloads.
  const surfaceTexture = (kind) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y += 1) {
      for (let x = 0; x < 128; x += 1) {
        const n = (x * 73 + y * 151 + x * y * 17) % 37;
        const seam = kind === 'roof' && (x % 32 < 2 || y % 48 < 2);
        const value = Math.max(0, 239 + n - (seam ? 35 : 0));
        const p = (y * 128 + x) * 4;
        image.data[p] = image.data[p + 1] = image.data[p + 2] = value;
        image.data[p + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'roof' ? 3 : 2, kind === 'roof' ? 3 : 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    return texture;
  };
  const roofTexture = surfaceTexture('roof');
  const groundTexture = surfaceTexture('ground');
  const materials = {
    ground: new THREE.MeshStandardMaterial({ color: 0xc6c9bd, roughness: .98 }),
    plan: new THREE.MeshStandardMaterial({ color: 0xecebe1, map: groundTexture, roughness: .96 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x9bbd6d, map: groundTexture, roughness: 1 }),
    grassLight: new THREE.MeshStandardMaterial({ color: 0xaac77b, map: groundTexture, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: 0xe7e5d9, roughness: .96 }),
    curb: new THREE.MeshStandardMaterial({ color: 0xb9b9ae, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x42789c, roughness: .84, metalness: .03 }),
    dormWall: new THREE.MeshStandardMaterial({ color: 0x628aa1, roughness: .9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x86aebc, map: roofTexture, roughness: .88 }),
    dormRoof: new THREE.MeshStandardMaterial({ color: 0xa5b9ba, map: roofTexture, roughness: .92 }),
    amenityRoof: new THREE.MeshStandardMaterial({ color: 0x758f9c, map: roofTexture, roughness: .8 }),
    neutralWall: new THREE.MeshStandardMaterial({ color: 0x919c99, roughness: .92 }),
    neutralRoof: new THREE.MeshStandardMaterial({ color: 0xc3c9c1, map: roofTexture, roughness: .94 }),
    window: new THREE.MeshStandardMaterial({ color: 0x315b72, metalness: .25, roughness: .37,
      emissive: 0x183747, emissiveIntensity: .12 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xeaa43e }),
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x335f7b, transparent: true, opacity: .66 });
  const roofRimMaterial = new THREE.LineBasicMaterial({ color: 0x426779, transparent: true, opacity: .9 });
  const windowGeometry = new THREE.BoxGeometry(.028, .009, .018);
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
    const patch = add(new THREE.ShapeGeometry(polygon(points)),
      i % 2 ? materials.grassLight : materials.grass, `atlas-lawn-${i}`);
    patch.position.z = .017;
  });
  campusLayout.paths.forEach(({ points, width }, i) => {
    for (let j = 1; j < points.length; j += 1) {
      const a = xy(points[j - 1]), b = xy(points[j]);
      const length = a.distanceTo(b);
      const curb = add(new THREE.BoxGeometry(length + .006, width * .003 + .024, .009),
        materials.curb, `atlas-curb-${i}-${j}`);
      curb.position.set((a.x+b.x)/2, (a.y+b.y)/2, .025);
      curb.rotation.z = Math.atan2(b.y-a.y, b.x-a.x);
      const path = add(new THREE.BoxGeometry(length, width * .003, .012), materials.path, `atlas-path-${i}-${j}`);
      path.position.set(curb.position.x, curb.position.y, .032);
      path.rotation.z = curb.rotation.z;
    }
  });
  const [x1,y1,x2,y2] = campusLayout.sportField;
  const fieldCenter = xy([(x1+x2)/2,(y1+y2)/2]);
  const field = add(new THREE.BoxGeometry((x2-x1)*.00328,(y2-y1)*.00244,.014),
    new THREE.MeshStandardMaterial({ color: 0x86ae69, roughness: 1 }), 'atlas-sport-field');
  field.position.set(fieldCenter.x, fieldCenter.y, .03);
  const fieldWidth = (x2-x1)*.00328-.022;
  const fieldHeight = (y2-y1)*.00244-.022;
  const fieldLineMaterial = new THREE.LineBasicMaterial({ color: 0xe4e8d4, transparent: true, opacity: .8 });
  const fieldOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-fieldWidth/2,-fieldHeight/2,0),
    new THREE.Vector3(fieldWidth/2,-fieldHeight/2,0),
    new THREE.Vector3(fieldWidth/2,fieldHeight/2,0),
    new THREE.Vector3(-fieldWidth/2,fieldHeight/2,0),
  ]), fieldLineMaterial);
  fieldOutline.name = 'atlas-sport-field-line';
  fieldOutline.position.set(fieldCenter.x, fieldCenter.y, .04);
  root.add(fieldOutline); solids.push(fieldOutline);
  const midfield = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-fieldHeight/2,.04), new THREE.Vector3(0,fieldHeight/2,.04),
  ]), fieldLineMaterial);
  midfield.position.set(fieldCenter.x, fieldCenter.y, 0);
  root.add(midfield); solids.push(midfield);
  const parkCenter = xy(campusLayout.park.center);
  const park = add(new THREE.TorusGeometry(campusLayout.park.radius*.0029, .012, 6, 36),
    materials.path, 'atlas-park-ring');
  park.position.set(parkCenter.x,parkCenter.y,.035);
  const parkDot = add(new THREE.CylinderGeometry(.035,.035,.025,20), materials.grass, 'atlas-park-centre');
  parkDot.rotation.x = Math.PI/2;
  parkDot.position.set(parkCenter.x,parkCenter.y,.046);
  const treePositions = [
    [246,270],[242,318],[239,379],[206,477],[341,689],[353,740],[374,792],
    [559,546],[566,596],[725,235],[871,244],[901,300],[881,493],
    [733,753],[837,752],[677,815],[904,823],[677,904],[862,918],
  ];
  const crownGeometry = new THREE.SphereGeometry(.027, 7, 5);
  const crown = new THREE.InstancedMesh(crownGeometry,
    new THREE.MeshStandardMaterial({ color: 0x668a61, roughness: 1 }), treePositions.length);
  crown.name = 'atlas-trees';
  const treeMatrix = new THREE.Matrix4();
  treePositions.forEach((point, index) => {
    const position = xy(point);
    const size = .8 + (index % 4) * .09;
    treeMatrix.compose(new THREE.Vector3(position.x, position.y, .057),
      new THREE.Quaternion(), new THREE.Vector3(size,size,.8));
    crown.setMatrixAt(index, treeMatrix);
  });
  crown.instanceMatrix.needsUpdate = true;
  root.add(crown); solids.push(crown);

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
    const dorm = block.id.startsWith('CĂMIN');
    const amenity = ['SPORT', 'NATAȚIE', 'OBSERVATOR', 'AULA'].includes(block.id);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth:block.height, bevelEnabled:false, steps:1 }),
      block.neutral ? materials.neutralWall : dorm ? materials.dormWall : materials.wall);
    body.position.z = .038;
    body.name = `${holder.name}-volume`;
    holder.add(body);
    solids.push(body);
    if (!block.neutral && block.id !== 'OBSERVATOR') {
      const windows = [];
      for (let edge = 0; edge < block.points.length; edge += 1) {
        const a = xy(block.points[edge]);
        const b = xy(block.points[(edge + 1) % block.points.length]);
        const length = a.distanceTo(b);
        const count = Math.floor(length / .063);
        if (count < 2) continue;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        for (let slot = 0; slot < count; slot += 1) {
          const t = (slot + 1) / (count + 1);
          windows.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle });
        }
      }
      if (windows.length) {
        const glazing = new THREE.InstancedMesh(windowGeometry, materials.window, windows.length);
        const transform = new THREE.Matrix4();
        const orientation = new THREE.Quaternion();
        windows.forEach((window, slot) => {
          orientation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), window.angle);
          transform.compose(new THREE.Vector3(window.x, window.y, .038 + block.height * .61),
            orientation, new THREE.Vector3(1, 1, 1));
          glazing.setMatrixAt(slot, transform);
        });
        glazing.instanceMatrix.needsUpdate = true;
        glazing.name = `${holder.name}-windows`;
        holder.add(glazing);
        solids.push(glazing);
      }
    }
    const roof = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      block.neutral ? materials.neutralRoof : dorm ? materials.dormRoof
        : amenity ? materials.amenityRoof : materials.roof);
    roof.position.z = .039 + block.height;
    holder.add(roof); solids.push(roof);
    const roofEdge = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), roofRimMaterial);
    roofEdge.position.z = roof.position.z + .002;
    holder.add(roofEdge);
    solids.push(roofEdge);
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
  const marker = add(new THREE.SphereGeometry(.026,10,8), materials.accent, 'atlas-campus-marker');
  const markerPoint = xy([612,556]);
  marker.position.set(markerPoint.x,markerPoint.y,.09);
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
