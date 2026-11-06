import { campusLayout } from './campus-layout.js?v=3';
import { campusRoute } from './campus-route.js?v=2';

// Coordinates and proportions share one source with the printed image target.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  root.name = 'atlas-campus';
  const solids = [];
  const outlines = [];
  const buildings = [];
  const buildingTargets = [];
  const labels = [];
  const buildingHeights = new Map(campusLayout.buildings.map(block => [block.id, block.height]));
  const inside = ([x,y], points) => points.reduce((hit,[ax,ay],i) => {
    const [bx,by] = points[(i+1)%points.length];
    return hit !== ((ay>y)!==(by>y) && x < (bx-ax)*(y-ay)/(by-ay)+ax);
  }, false);
  // Reserve space around footprints and paths so foliage does not hide entrances.
  const clearLandscapePoint = point => {
    const samples = [point,...[[16,0],[-16,0],[0,20],[0,-20]].map(([x,y])=>[point[0]+x,point[1]+y])];
    if (!samples.every(p => campusLayout.greens.some(g => inside(p,g)))) return false;
    if (samples.some(p => campusLayout.buildings.some(b => inside(p,b.points)))) return false;
    const [left,top,right,bottom] = campusLayout.sportField;
    if (point[0]>left-18 && point[0]<right+18 && point[1]>top-20 && point[1]<bottom+20) return false;
    return campusLayout.paths.every(path => path.points.slice(1).every((b,i) => {
      const a=path.points[i], dx=b[0]-a[0], dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
      return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)>path.width/2+20;
    }));
  };
  const treePositions = [
    [246,270],[242,318],[239,379],[206,477],[341,689],[353,740],[374,792],
    [559,546],[566,596],[725,235],[871,244],[901,300],[881,493],
    [733,753],[837,752],[677,815],[904,823],[677,904],[862,918],
    [285,689],[290,738],[365,686],[473,849],[493,902],[587,834],[599,920],
    [688,752],[712,790],[866,749],[864,810],[691,915],[838,917],[894,899],
    [739,223],[905,226],[906,474],[862,504],[519,557],[444,562],
  ].filter(clearLandscapePoint);
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
  const reliefTexture = (kind) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y += 1) {
      for (let x = 0; x < 128; x += 1) {
        const grain = 118 + ((x * 29 + y * 47 + x * y * 5) % 24);
        const seam = kind === 'roof' && (x % 32 < 2 || y % 48 < 2);
        const value = seam ? 78 : grain;
        const p = (y * 128 + x) * 4;
        image.data[p] = image.data[p + 1] = image.data[p + 2] = value;
        image.data[p + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'roof' ? 4 : 2, kind === 'roof' ? 4 : 2);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 2;
    return texture;
  };
  const roofRelief = reliefTexture('roof');
  const wallRelief = reliefTexture('wall');
  const groundRelief = reliefTexture('ground');
  const materials = {
    ground: new THREE.MeshStandardMaterial({ color: 0xb8bbb2, roughness: .98 }),
    plan: new THREE.MeshStandardMaterial({ color: 0xe9e7dc, map:groundTexture,
      bumpMap:groundRelief, bumpScale:.012, roughness:.94 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x8cae70, map:groundTexture,
      bumpMap:groundRelief, bumpScale:.016, roughness:1 }),
    grassLight: new THREE.MeshStandardMaterial({ color: 0xa6c17d, map:groundTexture,
      bumpMap:groundRelief, bumpScale:.016, roughness:1 }),
    path: new THREE.MeshStandardMaterial({ color: 0xd3d1c7, bumpMap:groundRelief,
      bumpScale:.009, roughness:.96 }),
    curb: new THREE.MeshStandardMaterial({ color: 0xa8aaa5, roughness:1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xaebeb9, bumpMap:wallRelief,
      bumpScale:.006, roughness:.88, metalness:.01 }),
    dormWall: new THREE.MeshStandardMaterial({ color: 0xa6b1ac, bumpMap:wallRelief,
      bumpScale:.006, roughness:.92 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x536b77, map:roofTexture,
      bumpMap:roofRelief, bumpScale:.014, roughness:.58, metalness:.22 }),
    dormRoof: new THREE.MeshStandardMaterial({ color: 0x746864, map:roofTexture,
      bumpMap:roofRelief, bumpScale:.012, roughness:.7, metalness:.08 }),
    amenityRoof: new THREE.MeshStandardMaterial({ color: 0x4e8094, map:roofTexture,
      bumpMap:roofRelief, bumpScale:.015, roughness:.5, metalness:.3 }),
    neutralWall: new THREE.MeshStandardMaterial({ color: 0xa7aaa5, roughness:.92 }),
    neutralRoof: new THREE.MeshStandardMaterial({ color: 0x8d9492, map:roofTexture, roughness:.78 }),
    window: new THREE.MeshStandardMaterial({ color: 0x244b62, metalness:.35, roughness:.24,
      emissive:0x102f42, emissiveIntensity:.18 }),
    glass: new THREE.MeshStandardMaterial({ color:0x8fc8d8, metalness:.25, roughness:.16,
      transparent:true, opacity:.68, depthWrite:false }),
    dome: new THREE.MeshStandardMaterial({ color:0x2d9ed0, metalness:.38, roughness:.28,
      emissive:0x0a4163, emissiveIntensity:.16 }),
    timber: new THREE.MeshStandardMaterial({ color:0x8a5e39, roughness:.68 }),
    entrance: new THREE.MeshStandardMaterial({ color:0x40515a, metalness:.24, roughness:.48 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xeaa43e }),
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color:0x536871, transparent:true, opacity:.62 });
  const roofRimMaterial = new THREE.LineBasicMaterial({ color:0x304d5b, transparent:true, opacity:.88 });
  const windowGeometry = new THREE.BoxGeometry(.034,.011,.025);
  const xy = ([u, v]) => new THREE.Vector2((u / 1000 - .5) * 3.28, (.5 - v / 1000) * 2.44);
  const polygon = points => {
    const vectors = points.map(xy);
    const shape = new THREE.Shape();
    vectors.forEach((p, i) => i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y));
    shape.closePath();
    return shape;
  };
  const contactShadowTexture = () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const trace = block => {
      ctx.beginPath();
      const rings = [block.points, ...(block.holes || [])];
      for (const points of rings) {
        points.forEach(([u,v], index) => {
          const x = u / 1000 * size;
          const y = v / 1000 * size;
          if (index) ctx.lineTo(x,y); else ctx.moveTo(x,y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    };
    ctx.save();
    ctx.translate(5,7);
    ctx.filter = 'blur(7px)';
    ctx.fillStyle = 'rgba(20,33,37,.34)';
    campusLayout.buildings.forEach(trace);
    for (const [u,v] of treePositions) {
      ctx.beginPath(); ctx.arc(u/1000*size,v/1000*size,7,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(2,3);
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = 'rgba(18,28,31,.18)';
    campusLayout.buildings.forEach(trace);
    ctx.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    return texture;
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
  const contactShadows = add(new THREE.PlaneGeometry(3.28,2.44),
    new THREE.MeshBasicMaterial({ map:contactShadowTexture(), transparent:true, opacity:.65,
      depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1 }), 'atlas-contact-shadows');
  contactShadows.position.z = .036;
  contactShadows.renderOrder = 2;
  campusLayout.greens.forEach((points, i) => {
    const patch = add(new THREE.ShapeGeometry(polygon(points)),
      i % 2 ? materials.grassLight : materials.grass, `atlas-lawn-${i}`);
    patch.position.z = .017;
  });
  const pathSegments=[];
  campusLayout.paths.forEach(({ points, width }) => {
    for (let j = 1; j < points.length; j += 1) {
      const a = xy(points[j - 1]), b = xy(points[j]);
      const length = a.distanceTo(b);
      pathSegments.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,length,width:width*.003,angle:Math.atan2(b.y-a.y,b.x-a.x)});
    }
  });
  const pathBox=new THREE.BoxGeometry(1,1,1);
  [false,true].forEach(isCurb=>{
    const mesh=new THREE.InstancedMesh(pathBox,isCurb?materials.curb:materials.path,pathSegments.length);
    mesh.name=isCurb?'atlas-curbs':'atlas-paths';
    const matrix=new THREE.Matrix4(), orientation=new THREE.Quaternion();
    pathSegments.forEach((segment,i)=>{
      orientation.setFromAxisAngle(new THREE.Vector3(0,0,1),segment.angle);
      matrix.compose(new THREE.Vector3(segment.x,segment.y,isCurb?.025:.032),orientation,
        new THREE.Vector3(segment.length+(isCurb?.006:0),segment.width+(isCurb?.024:0),isCurb?.009:.012));
      mesh.setMatrixAt(i,matrix);
    });
    root.add(mesh); solids.push(mesh);
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
  const crownGeometry = new THREE.IcosahedronGeometry(.047, 1);
  const crown = new THREE.InstancedMesh(crownGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), treePositions.length);
  crown.name = 'atlas-trees';
  const treeMatrix = new THREE.Matrix4();
  treePositions.forEach((point, index) => {
    const position = xy(point);
    const size = .85 + (index % 4) * .12;
    treeMatrix.compose(new THREE.Vector3(position.x, position.y, .11 + size*.014),
      new THREE.Quaternion(), new THREE.Vector3(size,size,1.2*size));
    crown.setMatrixAt(index, treeMatrix);
    crown.setColorAt(index,new THREE.Color([0x638050,0x85965d,0x497357,0x728b4c][index%4]));
  });
  crown.instanceMatrix.needsUpdate = true;
  root.add(crown); solids.push(crown);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.006,.009,.085,6),
    materials.timber,treePositions.length);
  trunks.name = 'atlas-tree-trunks';
  treePositions.forEach((point,index) => {
    const p=xy(point);
    treeMatrix.compose(new THREE.Vector3(p.x,p.y,.067),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),new THREE.Vector3(1,1,1));
    trunks.setMatrixAt(index,treeMatrix);
  });
  root.add(trunks); solids.push(trunks);
  // Benches are repeated as instances: seat, back and two feet, four draw calls total.
  const benches = [[740,790],[800,770],[880,830],[800,930]].filter(clearLandscapePoint);
  const benchParts = [
    { name:'seats',size:[.075,.025,.008],offset:[0,0,.052],material:materials.timber },
    { name:'backs',size:[.075,.006,.025],offset:[0,.012,.067],material:materials.timber },
    { name:'feet-left',size:[.007,.02,.03],offset:[-.026,0,.033],material:materials.entrance },
    { name:'feet-right',size:[.007,.02,.03],offset:[.026,0,.033],material:materials.entrance },
  ];
  benchParts.forEach(part => {
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(...part.size),part.material,benches.length);
    mesh.name=`atlas-bench-${part.name}`;
    benches.forEach((point,index)=>{
      const p=xy(point);
      treeMatrix.makeTranslation(p.x+part.offset[0],p.y+part.offset[1],part.offset[2]);
      mesh.setMatrixAt(index,treeMatrix);
    });
    root.add(mesh); solids.push(mesh);
  });

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
  const detailMesh = (holder, geometry, material, name, position, rotation = null) => {
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name;
    mesh.position.copy(position);
    if (rotation) mesh.rotation.set(rotation.x,rotation.y,rotation.z);
    holder.add(mesh);
    solids.push(mesh);
    return mesh;
  };
  const addLandmarkDetails = (block,holder) => {
    const z0 = .038;
    if (block.id === 'A') {
      const entrance = xy([782,687]);
      for (let step = 0; step < 4; step += 1) {
        const loc = xy([782,688 + step * 7]);
        detailMesh(holder,new THREE.BoxGeometry(.16 + step*.022,.025,.008 + step*.002),materials.path,
          `atlas-A-step-${step}`,new THREE.Vector3(loc.x,loc.y,z0+.006+step*.004));
      }
      detailMesh(holder,new THREE.BoxGeometry(.17,.062,.018),materials.entrance,'atlas-A-canopy',
        new THREE.Vector3(entrance.x,entrance.y,z0+.112));
      for (const side of [-1,1]) detailMesh(holder,new THREE.BoxGeometry(.012,.012,.105),materials.entrance,
        `atlas-A-canopy-pillar-${side}`,new THREE.Vector3(entrance.x+side*.062,entrance.y-.014,z0+.055));
      detailMesh(holder,new THREE.BoxGeometry(.13,.012,.085),materials.glass,'atlas-A-entrance-glass',
        new THREE.Vector3(entrance.x,entrance.y+.025,z0+.064));
      const roofPoint = xy([700,505]);
      detailMesh(holder,new THREE.BoxGeometry(.18,.15,.025),materials.roof,'atlas-A-raised-roof',
        new THREE.Vector3(roofPoint.x,roofPoint.y,z0+block.height+.014));
    }
    if (block.id === 'E') {
      const rotunda = xy([636,752]);
      detailMesh(holder,new THREE.CylinderGeometry(.112,.118,.205,24),materials.wall,'atlas-E-rotunda',
        new THREE.Vector3(rotunda.x,rotunda.y,z0+.103),new THREE.Euler(Math.PI/2,0,0));
      detailMesh(holder,new THREE.CylinderGeometry(.116,.116,.072,24,1,true),materials.glass,
        'atlas-E-rotunda-glass',new THREE.Vector3(rotunda.x,rotunda.y,z0+.142),
        new THREE.Euler(Math.PI/2,0,0));
      const bridge = xy([570,707]);
      detailMesh(holder,new THREE.BoxGeometry(.36,.06,.055),materials.glass,'atlas-E-glass-bridge',
        new THREE.Vector3(bridge.x,bridge.y,z0+.17));
      for (const side of [-1,1]) detailMesh(holder,new THREE.BoxGeometry(.014,.014,.14),materials.entrance,
        `atlas-E-bridge-pillar-${side}`,new THREE.Vector3(bridge.x+side*.135,bridge.y,z0+.07));
    }
    if (block.id === 'OBSERVATOR') {
      const domePoint = xy([875,397]);
      const roofZ = z0 + block.height;
      detailMesh(holder,new THREE.CylinderGeometry(.102,.108,.035,24),materials.wall,'atlas-observatory-collar',
        new THREE.Vector3(domePoint.x,domePoint.y,roofZ+.017),new THREE.Euler(Math.PI/2,0,0));
      detailMesh(holder,new THREE.SphereGeometry(.101,24,10,0,Math.PI*2,0,Math.PI/2),materials.dome,
        'atlas-observatory-main-dome',new THREE.Vector3(domePoint.x,domePoint.y,roofZ+.035),
        new THREE.Euler(Math.PI/2,0,0));
      const towerPoint = xy([889,369]);
      detailMesh(holder,new THREE.CylinderGeometry(.047,.052,.09,20),materials.glass,'atlas-observatory-tower',
        new THREE.Vector3(towerPoint.x,towerPoint.y,roofZ+.045),new THREE.Euler(Math.PI/2,0,0));
      detailMesh(holder,new THREE.SphereGeometry(.052,20,8,0,Math.PI*2,0,Math.PI/2),materials.dome,
        'atlas-observatory-tower-dome',new THREE.Vector3(towerPoint.x,towerPoint.y,roofZ+.09),
        new THREE.Euler(Math.PI/2,0,0));
    }
    if (block.id === 'NATAȚIE') {
      const centre = xy([624,101]);
      const roofZ = z0 + block.height;
      detailMesh(holder,new THREE.CylinderGeometry(.105,.105,.4,20,1,false,-Math.PI/2,Math.PI),
        materials.amenityRoof,'atlas-pool-arched-roof',new THREE.Vector3(centre.x,centre.y,roofZ),
        new THREE.Euler(0,0,Math.PI/2));
      const glassEnd = detailMesh(holder,new THREE.PlaneGeometry(.17,.11),materials.glass,
        'atlas-pool-glass-end',new THREE.Vector3(centre.x+.202,centre.y,roofZ+.052),
        new THREE.Euler(0,Math.PI/2,0));
      glassEnd.renderOrder = 3;
      const timber = xy([624,137]);
      detailMesh(holder,new THREE.BoxGeometry(.4,.014,.018),materials.timber,'atlas-pool-timber-edge',
        new THREE.Vector3(timber.x,timber.y,roofZ+.015));
    }
  };
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
    // Keep the observatory footprint and domes' width; lower its complete silhouette by 10%.
    if (block.id === 'OBSERVATOR') holder.scale.z = .9;
    root.add(holder);
    const dorm = block.id.startsWith('CĂMIN');
    const amenity = ['SPORT', 'NATAȚIE', 'OBSERVATOR', 'AULA'].includes(block.id);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth:block.height,
      bevelEnabled:!block.neutral, bevelThickness:.006, bevelSize:.005, bevelSegments:1, steps:1 }),
      block.neutral ? materials.neutralWall : dorm ? materials.dormWall : materials.wall);
    body.position.z = .038;
    body.name = `${holder.name}-volume`;
    body.userData.atlasBuildingId = block.id;
    holder.add(body);
    solids.push(body); buildingTargets.push(body);
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
          const levels = block.height > .19 ? [.38,.7] : [.58];
          levels.forEach(level => windows.push({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t,
            angle, level }));
        }
      }
      if (windows.length) {
        const glazing = new THREE.InstancedMesh(windowGeometry, materials.window, windows.length);
        const transform = new THREE.Matrix4();
        const orientation = new THREE.Quaternion();
        windows.forEach((window, slot) => {
          orientation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), window.angle);
          transform.compose(new THREE.Vector3(window.x,window.y,.038+block.height*window.level),
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
    roof.userData.atlasBuildingId = block.id;
    holder.add(roof); solids.push(roof); buildingTargets.push(roof);
    const roofEdge = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), roofRimMaterial);
    roofEdge.position.z = roof.position.z + .002;
    holder.add(roofEdge);
    solids.push(roofEdge);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 20), edgeMaterial);
    holder.add(border);
    outlines.push({ mesh:body, line:border });
    addLandmarkDetails(block,holder);
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
  let selection = null;
  let routeGroup = null, routePulse = null, routePoints = null, routeDistance = 0, routePhase = 0;
  const clearRoute = () => {
    if(routeGroup){routeGroup.removeFromParent();routeGroup.traverse(object=>{
      object.geometry?.dispose();object.material?.dispose();
    });}
    routeGroup=routePulse=routePoints=null;routeDistance=routePhase=0;
  };
  const showRoute = (start,destination) => {
    clearRoute();
    if(!start||!destination)return false;
    const points=campusRoute(campusLayout,start.entrance || start.point,destination.entrance || destination.point);
    if(!points||points.length<2)return false;
    routeGroup=new THREE.Group();routeGroup.name='atlas-campus-route';
    routePoints=points.map(xy);routeDistance=0;
    for(let i=1;i<routePoints.length;i++)routeDistance+=routePoints[i-1].distanceTo(routePoints[i]);
    for(const [radius,color,z] of [[.022,0x164c68,.060],[.013,0x74e5ff,.067]]){
      const curve=new THREE.CurvePath();
      for(let i=1;i<routePoints.length;i++){
        const a=routePoints[i-1],b=routePoints[i];
        if(a.distanceTo(b)>.0001)curve.add(new THREE.LineCurve3(
          new THREE.Vector3(a.x,a.y,z),new THREE.Vector3(b.x,b.y,z)));
      }
      routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(48,routePoints.length*6),radius,6,false),
        new THREE.MeshBasicMaterial({color,depthTest:false})));
    }
    const mark=(p,color,name)=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.042,.008,6,24),new THREE.MeshBasicMaterial({color,depthTest:false}));
      ring.position.set(p.x,p.y,.08);ring.name=name;routeGroup.add(ring);
    };
    mark(routePoints[0],0x74e5ff,'atlas-route-start');
    mark(routePoints.at(-1),0xffbb61,'atlas-route-destination');
    routePulse=new THREE.Mesh(new THREE.SphereGeometry(.024,8,6),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));
    routePulse.name='atlas-route-pulse';routeGroup.add(routePulse);
    routeGroup.traverse(object=>{if(object.isMesh)object.renderOrder=10;});
    root.add(routeGroup);return true;
  };
  const updateRoute = dt => {
    if(!routePulse||routeDistance<=0)return;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){routePulse.visible=false;return;}
    routePulse.visible=true;
    routePhase=(routePhase+dt*.34)%routeDistance;
    let left=routePhase;
    for(let i=1;i<routePoints.length;i++){
      const a=routePoints[i-1],b=routePoints[i],length=a.distanceTo(b);
      if(left<=length){routePulse.position.set(a.x+(b.x-a.x)*left/length,a.y+(b.y-a.y)*left/length,.088);break;}
      left-=length;
    }
  };
  const selectionMaterials = [];
  const selectionMaterial = new THREE.MeshBasicMaterial({ color:0x51c9ff, transparent:true, opacity:0 });
  const clearSelection = () => {
    selectionMaterials.splice(0).forEach(({mesh,original,highlight})=>{
      mesh.material=original; highlight.dispose();
    });
    if (selection) {
      selection.removeFromParent();
      selection.traverse(object=>object.geometry?.dispose());
      selection=null;
    }
  };
  const selectPlace = place => {
    clearSelection();
    if (!place) return;
    const block=campusLayout.buildings.find(b=>b.id===place.building);
    const holder=block ? root.getObjectByName(`atlas-building-${block.id}`) : root;
    const [left,top,right,bottom]=campusLayout.sportField;
    const rings=block ? [block.points,...(block.holes||[])] : [[[left,top],[right,top],[right,bottom],[left,bottom]]];
    if (block) holder.traverse(mesh=>{
      if (!mesh.isMesh || !mesh.material.isMeshStandardMaterial) return;
      const original=mesh.material, highlight=original.clone();
      highlight.userData.baseColor=original.color.clone();
      highlight.emissive.set(0x135b83); highlight.emissiveIntensity=0;
      mesh.material=highlight; selectionMaterials.push({mesh,original,highlight});
    });
    selection=new THREE.Group(); selection.name='atlas-place-selection';
    selection.userData.placeId=place.id;
    rings.forEach(points=>points.forEach((point,i)=>{
      const a=xy(point),b=xy(points[(i+1)%points.length]);
      const rail=new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b)+.012,.014,.01),selectionMaterial);
      rail.position.set((a.x+b.x)/2,(a.y+b.y)/2,block ? .05+block.height : .045);
      rail.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);
      selection.add(rail);
    }));
    selection.visible=!technical;
    selectionMaterial.opacity=0;
    holder.add(selection);
  };
  const updateSelection = dt => {
    if (!selection || technical) return;
    const blend=1-Math.exp(-Math.min(dt,.05)*12);
    selectionMaterial.opacity=THREE.MathUtils.lerp(selectionMaterial.opacity,.95,blend);
    selectionMaterials.forEach(({highlight})=>{
      highlight.color.copy(highlight.userData.baseColor).lerp(new THREE.Color(0x279bd5),selectionMaterial.opacity*.5);
      highlight.emissiveIntensity=selectionMaterial.opacity*.5;
    });
  };
  return {
    root,
    buildingTargets,
    selectPlace,
    showRoute,
    clearRoute,
    updateRoute,
    updateSelection,
    freezeStatic() {
      root.traverse(object=>{ if(object!==root) { object.updateMatrix(); object.matrixAutoUpdate=false; } });
    },
    getPlaceWorldPosition(place, target) {
      const point = xy(place.point);
      target.set(point.x, point.y, .10 + (buildingHeights.get(place.building) || 0) *
        (place.building === 'OBSERVATOR' ? .9 : 1));
      return root.localToWorld(target);
    },
    setViewFromNorth() {
      root.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');
      labels.forEach(label => { label.rotation.z = Math.PI / 2; });
    },
    setProgress(value) { target = THREE.MathUtils.clamp(value,0,1); },
    setEffect(value) { effect = THREE.MathUtils.clamp(value,0,1); },
    setTechnical(value) {
      technical = !!value;
      if (selection) selection.visible=!technical;
      solids.forEach(mesh => { mesh.visible = !technical; });
      outlines.forEach(({ line }) => { line.visible = true; });
      labels.forEach(label => { label.visible = !technical; });
    },
    update(dt) {
      updateSelection(dt);
      updateRoute(dt);
      progress = THREE.MathUtils.damp(progress,target,7,Math.min(dt,.05));
      outlines.forEach(({ mesh,line }) => {
        line.position.copy(mesh.position); line.quaternion.copy(mesh.quaternion); line.scale.copy(mesh.scale);
      });
      buildings.forEach(({ holder,start,end }) => {
        holder.visible = progress > start;
        holder.scale.z = Math.max(.003,THREE.MathUtils.smoothstep(progress,start,end));
      });
      contactShadows.visible = !technical && progress > .3;
      contactShadows.material.opacity = .65 * THREE.MathUtils.smoothstep(progress,.3,.78);
      marker.visible = !technical && progress > .75;
      marker.scale.setScalar(.7+effect*.5);
    },
    get progress() { return progress; },
    get effect() { return effect; },
    get technical() { return technical; },
  };
}
