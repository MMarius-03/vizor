// Schematic USV campus, composed for a small image-anchored AR model.
// XY is the campus plan; positive Z is building height.
export function createAtlas(THREE) {
  const root = new THREE.Group();
  root.name = 'atlas-campus';
  const solids = [];
  const outlines = [];
  const buildings = [];
  const paths = [];
  const lawn = new THREE.MeshStandardMaterial({ color: 0xa4c853, roughness: .95 });
  const lawnShade = new THREE.MeshStandardMaterial({ color: 0x83aa40, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d7ca, roughness: .92 });
  const paving = new THREE.MeshStandardMaterial({ color: 0xf0eee3, roughness: .95 });
  const campusBlue = new THREE.MeshStandardMaterial({ color: 0x13508a, roughness: .62 });
  const roofBlue = new THREE.MeshStandardMaterial({ color: 0x1168a4, roughness: .58 });
  const roofDark = new THREE.MeshStandardMaterial({ color: 0x173e68, roughness: .72 });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xa5d9e1 });
  const orange = new THREE.MeshBasicMaterial({ color: 0xf09d30 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf7f1d9, transparent: true, opacity: .88 });
  const add = (geometry, material, parent = root, technical = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    solids.push(mesh);
    if (technical) {
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), edgeMaterial);
      parent.add(edge);
      outlines.push({ mesh, edge });
    }
    return mesh;
  };

  const base = add(new THREE.BoxGeometry(3.38, 2.48, .13), stone, root, false);
  base.position.z = -.07;
  base.name = 'atlas-campus-base';
  const green = add(new THREE.BoxGeometry(3.23, 2.32, .014), lawn, root, false);
  green.position.z = .008;
  green.name = 'atlas-green';

  const patch = (x, y, w, d, dark = false) => {
    const mesh = add(new THREE.BoxGeometry(w, d, .017), dark ? lawnShade : lawn, root, false);
    mesh.position.set(x, y, .027);
    return mesh;
  };
  patch(1.12, .72, .59, .55, true);
  patch(-1.17, .69, .65, .48, true);
  patch(.25, -.85, .62, .35, true);
  patch(-.95, -.86, .58, .29);

  // Paths form a legible cross on the phone and leave green courtyards between blocks.
  const path = (x, y, w, d, angle = 0) => {
    const mesh = add(new THREE.BoxGeometry(w, d, .018), paving, root, false);
    mesh.position.set(x, y, .039);
    mesh.rotation.z = angle;
    paths.push(mesh);
  };
  path(-.02, -.02, .12, 2.21);
  path(-.59, -.12, .11, 2.05);
  path(.63, -.04, .11, 2.14);
  path(0, .31, 3.1, .105);
  path(0, -.38, 3.1, .115);
  path(.95, -.76, .83, .09, -.43);
  path(-1.11, .04, .65, .09, .35);
  const plaza = add(new THREE.CylinderGeometry(.16, .16, .022, 36), paving, root, false);
  plaza.rotation.x = Math.PI / 2;
  plaza.position.set(.3, -.1, .043);
  paths.push(plaza);

  const labelTexture = letter => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = '#f7f5e9';
    context.font = 'bold 88px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, 64, 70);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // Relative footprints follow the reference: A in the centre, E to the east,
  // B/C to the south-west, and the smaller F–J buildings across the north.
  const blocks = [
    ['A', .25, .47, .71, .34, .29, [[-.38, -.25, .22, .22], [.4, .09, .18, .25]]],
    ['B', -1.05, -.73, .66, .28, .25, [[.34, .1, .18, .19]]],
    ['C', -1.17, -.26, .51, .24, .25, [[-.3, .08, .16, .2]]],
    ['D', -.87, .56, .39, .49, .27, [[.19, -.27, .22, .18]]],
    ['E', 1.09, -.12, .49, .55, .32, [[-.3, -.19, .2, .22]]],
    ['F', -.46, .84, .25, .29, .22, []],
    ['G', -.99, 1.0, .27, .17, .19, []],
    ['H', .87, .94, .28, .2, .21, []],
    ['J', -1.42, .96, .17, .19, .16, []],
    ['L', -.25, -.09, .36, .34, .24, [[-.2, -.18, .16, .19]]],
    ['M', 1.43, .66, .21, .19, .16, []],
  ];
  blocks.forEach(([letter, x, y, w, d, h, wings], index) => {
    const holder = new THREE.Group();
    holder.name = `atlas-building-${letter}`;
    holder.position.set(x, y, .049);
    root.add(holder);
    const parts = [[0, 0, w, d], ...wings];
    parts.forEach(([px, py, pw, pd], part) => {
      const body = add(new THREE.BoxGeometry(pw, pd, h), campusBlue, holder);
      body.position.set(px, py, h / 2);
      const roof = add(new THREE.BoxGeometry(pw * 1.03, pd * 1.03, .018), part ? roofDark : roofBlue, holder, false);
      roof.position.set(px, py, h + .009);
      if (pw > .3 && pd > .2) {
        for (const offset of [-.25, .25]) {
          const pane = add(new THREE.BoxGeometry(pw * .14, .008, h * .32), windowMaterial, holder, false);
          pane.position.set(px + pw * offset, py - pd / 2 - .005, h * .52);
        }
      }
    });
    const labelSize = Math.min(w, d, .35) * .7;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelSize, labelSize),
      new THREE.MeshBasicMaterial({ map: labelTexture(letter), transparent: true, depthWrite: false }));
    label.position.z = h + .021;
    holder.add(label);
    buildings.push({ holder, start: .15 + index * .027, end: .42 + index * .033 });
  });

  const pin = new THREE.Group();
  pin.name = 'atlas-campus-pin';
  const stem = add(new THREE.CylinderGeometry(.012, .012, .21, 10), orange, pin, false);
  stem.rotation.x = Math.PI / 2;
  stem.position.z = .18;
  const head = add(new THREE.SphereGeometry(.052, 12, 10), orange, pin, false);
  head.position.z = .3;
  pin.position.set(.34, .47, .36);
  root.add(pin);

  root.rotation.x = -1.18;
  let target = .9;
  let progress = .9;
  let effect = .65;
  let technical = false;
  return {
    root,
    setProgress(value) { target = THREE.MathUtils.clamp(value, 0, 1); },
    setEffect(value) { effect = THREE.MathUtils.clamp(value, 0, 1); },
    setTechnical(value) {
      technical = !!value;
      solids.forEach(mesh => { mesh.visible = !technical; });
      outlines.forEach(({ edge }) => { edge.visible = technical; });
      paths.forEach(mesh => { mesh.visible = !technical; });
    },
    update(dt) {
      progress = THREE.MathUtils.damp(progress, target, 7, Math.min(dt, .05));
      outlines.forEach(({ mesh, edge }) => {
        edge.position.copy(mesh.position);
        edge.quaternion.copy(mesh.quaternion);
        edge.scale.copy(mesh.scale);
      });
      buildings.forEach(({ holder, start, end }) => {
        holder.visible = progress > start;
        holder.scale.z = Math.max(.003, THREE.MathUtils.smoothstep(progress, start, end));
      });
      pin.visible = !technical && progress > .6;
      head.scale.setScalar(.8 + effect * .4);
    },
    get progress() { return progress; },
    get effect() { return effect; },
    get technical() { return technical; },
  };
}
