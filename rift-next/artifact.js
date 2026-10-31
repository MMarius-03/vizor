// RIFT Core uses target-local units: the image plane is z=0 and the object
// projects toward the camera along +z. Geometry is created only once.
export function createRiftCore(THREE) {
  const root = new THREE.Group();
  const fadeMaterials = [];
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color, metalness: .38, roughness: .43, flatShading: true,
      transparent: true, ...options,
    });
    fadeMaterials.push(value);
    return value;
  };

  const ceramic = material(0x171e1b, { metalness: .18, roughness: .64 });
  const metal = material(0x4d5951, { metalness: .58, roughness: .34 });
  const recess = material(0x080d0b, { metalness: .1, roughness: .82 });
  const bladeFace = material(0x26312b, { metalness: .28, roughness: .48 });
  const acid = material(0xcde940, {
    metalness: .12, roughness: .3, emissive: 0x8ca521, emissiveIntensity: .65,
  });
  const nucleusMaterial = material(0xb9d937, {
    metalness: .18, roughness: .28, emissive: 0x8ca521, emissiveIntensity: .12,
  });

  const polygon = (radius, sides = 6, offset = Math.PI / 6) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = offset + i * Math.PI * 2 / sides;
      return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  const extrude = (shape, depth, bevel = .008) => new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  });
  const plate = (points, depth, bevel, surface, z, parent = root) => {
    const shape = points instanceof THREE.Shape ? points : new THREE.Shape(points);
    const mesh = new THREE.Mesh(extrude(shape, depth, bevel), surface);
    mesh.position.z = z;
    parent.add(mesh);
    return mesh;
  };
  const ring = (outer, inner, depth, surface, z, offset = Math.PI / 6, parent = root) => {
    const shape = new THREE.Shape(polygon(outer, 6, offset));
    shape.holes.push(new THREE.Path(polygon(inner, 6, offset).reverse()));
    return plate(shape, depth, 0, surface, z, parent);
  };

  // The mounting plate and raised bridge give the core a readable side profile.
  plate(polygon(.64), .055, .012, ceramic, .005);
  ring(.7, .62, .045, metal, .015);
  ring(.53, .37, .024, recess, .064);
  ring(.55, .49, .026, metal, .18);
  ring(.34, .285, .014, acid, .15);

  const braceGeometry = new THREE.BoxGeometry(.065, .085, .18);
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    const brace = new THREE.Mesh(braceGeometry, i % 2 ? ceramic : metal);
    brace.position.set(Math.cos(angle) * .54, Math.sin(angle) * .54, .135);
    brace.rotation.z = angle;
    root.add(brace);
  }

  // Three physical terminals become the large one-thumb interaction targets.
  const nodes = [];
  const pathGeometry = new THREE.BoxGeometry(.48, .022, .016);
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3;
    const holder = new THREE.Group();
    holder.name = `rift-node-${i + 1}`;
    holder.visible = false;
    holder.position.set(Math.cos(angle) * .77, Math.sin(angle) * .77, .56);
    root.add(holder);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .052, 6), ceramic);
    housing.rotation.x = Math.PI / 2;
    holder.add(housing);
    const faceMaterial = material(0x657064, {
      metalness: .22, roughness: .38, emissive: 0x53631f, emissiveIntensity: .12,
    });
    const face = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .058, 6), faceMaterial);
    face.rotation.x = Math.PI / 2;
    face.position.z = .028;
    holder.add(face);
    const path = new THREE.Mesh(pathGeometry, acid);
    path.position.set(Math.cos(angle) * .43, Math.sin(angle) * .43, .52);
    path.rotation.z = angle;
    path.visible = false;
    root.add(path);
    nodes.push({ holder, faceMaterial, path, active: false, flash: 0 });
  }

  const nucleus = new THREE.Group();
  nucleus.position.z = .275;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(.245, .275, .15, 6), ceramic,
  );
  collar.rotation.x = Math.PI / 2;
  nucleus.add(collar);
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(.205, 0), nucleusMaterial);
  crystal.position.z = .09;
  nucleus.add(crystal);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 0), recess);
  crown.position.set(.015, -.012, .205);
  nucleus.add(crown);
  const rotor = new THREE.Group();
  nucleus.add(rotor);
  ring(.3, .255, .025, metal, .145, Math.PI / 6, rotor);
  const toothGeometry = new THREE.BoxGeometry(.11, .025, .02);
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3;
    const tooth = new THREE.Mesh(toothGeometry, acid);
    tooth.position.set(Math.cos(angle) * .28, Math.sin(angle) * .28, .18);
    tooth.rotation.z = angle + Math.PI / 2;
    rotor.add(tooth);
  }
  root.add(nucleus);

  const blades = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    const point = (radius, delta) => new THREE.Vector2(
      Math.cos(angle + delta) * radius,
      Math.sin(angle + delta) * radius,
    );
    const hinge = new THREE.Group();
    hinge.position.z = .36 + (i % 2) * .012;
    root.add(hinge);
    plate([
      point(.045, -.39), point(.46, -.48), point(.49, .39),
      point(.16, .37), point(.055, .11),
    ], .046, .012, i % 2 ? ceramic : bladeFace, 0, hinge);
    // A narrow metal seam breaks up the dark shell from oblique views.
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.22, .014, .012), metal);
    seam.position.set(Math.cos(angle) * .31, Math.sin(angle) * .31, .055);
    seam.rotation.z = angle;
    hinge.add(seam);
    blades.push({ hinge, angle, index: i });
  }

  // This transparent volume gives a reliable one-thumb tap target from an angle.
  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(.63, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      depthWrite: false, colorWrite: false, side: THREE.DoubleSide,
    }),
  );
  hitTarget.position.z = .22;
  root.add(hitTarget);

  let openness = 0;
  let desiredOpen = 0;
  let rotorAngle = 0;
  let armed = false;
  function update(dt) {
    const blend = 1 - Math.exp(-Math.min(dt, .08) * 7);
    openness += (desiredOpen - openness) * blend;
    if (Math.abs(desiredOpen - openness) < .001) openness = desiredOpen;
    const eased = openness * openness * (3 - 2 * openness);
    for (const { hinge, angle, index } of blades) {
      hinge.position.x = Math.cos(angle) * .31 * eased;
      hinge.position.y = Math.sin(angle) * .31 * eased;
      hinge.position.z = .36 + (index % 2) * .012 + .06 * eased;
      hinge.rotation.z = (index % 2 ? 1 : -1) * .15 * eased;
    }
    nucleus.position.z = .275 + .11 * eased;
    nucleus.rotation.z = .14 * eased;
    nucleusMaterial.emissiveIntensity = .12 + 1.35 * eased + (nodes.every((node) => node.active) ? .7 : 0);
    rotor.rotation.z = rotorAngle;
    for (const node of nodes) {
      node.flash = Math.max(0, node.flash - dt * 2.5);
      node.holder.visible = eased > .15;
      node.path.visible = node.active && eased > .15;
      node.holder.scale.setScalar(.55 + .45 * eased + node.flash * .22);
      node.faceMaterial.color.setHex(node.active ? 0xf3ffd4 : armed ? 0xcde940 : 0x657064);
      node.faceMaterial.emissiveIntensity = node.active ? 1.4 + node.flash : armed ? .7 : .12;
    }
  }

  return {
    root, hitTarget, update,
    toggle() {
      if (nodes.every((node) => node.active)) return true;
      desiredOpen = desiredOpen ? 0 : 1;
      return !!desiredOpen;
    },
    dragRotor(deltaX) {
      if (!desiredOpen || nodes.every((node) => node.active)) return { accepted: false, armed };
      rotorAngle += deltaX * .014;
      const justArmed = !armed && Math.abs(rotorAngle) >= .75;
      if (justArmed) armed = true;
      return { accepted: true, armed, justArmed };
    },
    activateNode(index) {
      const node = nodes[index];
      if (!desiredOpen || !armed || !node || node.active) return false;
      node.active = true;
      node.flash = 1;
      node.path.visible = true;
      return true;
    },
    getNodeWorldPosition(index, out) { return nodes[index]?.holder.getWorldPosition(out); },
    get isOpen() { return !!desiredOpen; },
    get isArmed() { return armed; },
    get progress() { return nodes.filter((node) => node.active).length; },
    get isComplete() { return nodes.every((node) => node.active); },
    get nodeStates() { return nodes.map((node) => node.active); },
    setOpacity(alpha) {
      for (const surface of fadeMaterials) {
        surface.opacity = alpha;
        surface.depthWrite = alpha >= .99;
      }
    },
  };
}
