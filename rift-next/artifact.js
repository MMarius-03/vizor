// RIFT Core uses target-local units: the image plane is z=0 and the object
// projects toward the camera along +z. Geometry is created only once.
export function createRiftCore(THREE) {
  const root = new THREE.Group();
  const fadeMaterials = [];
  // Small, deterministic maps add surface grain without external image assets.
  const grain = (base, variation, brushed = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const image = context.createImageData(128, 128);
    let seed = brushed ? 7919 : 104729;
    for (let y = 0; y < 128; y += 1) {
      const striation = brushed ? Math.sin(y * .9) * variation * .35 : 0;
      for (let x = 0; x < 128; x += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = ((seed >>> 24) / 255 - .5) * variation;
        const value = Math.max(0, Math.min(255, base + striation + noise));
        const at = (y * 128 + x) * 4;
        image.data[at] = image.data[at + 1] = image.data[at + 2] = value;
        image.data[at + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = 2;
    return texture;
  };
  const ceramicGrain = grain(235, 18);
  const metalGrain = grain(226, 26, true);
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color, metalness: .38, roughness: .43, flatShading: true,
      transparent: true, ...options,
    });
    fadeMaterials.push(value);
    return value;
  };

  const ceramic = material(0x202923, { metalness: .22, roughness: .66, map: ceramicGrain });
  const metal = material(0x788079, { metalness: .67, roughness: .34, map: metalGrain });
  const recess = material(0x080d0b, { metalness: .1, roughness: .82 });
  const bladeFace = material(0x344139, { metalness: .32, roughness: .5, map: ceramicGrain });
  const acid = material(0xcde940, {
    metalness: .12, roughness: .3, emissive: 0x8ca521, emissiveIntensity: .65,
  });
  const nucleusMaterial = material(0xa6cc9c, {
    metalness: .26, roughness: .22, flatShading: false,
    emissive: 0x7faf42, emissiveIntensity: .18,
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

  // A real cut plane removes the front of the reactor vessel while the iris
  // separates. The dark cap frames the newly exposed mechanism.
  const sectionCutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), .46);
  const sectionLocalPlane = sectionCutPlane.clone();
  const vesselMaterial = material(0x45564a, {
    metalness: .62, roughness: .42, map: metalGrain,
    side: THREE.DoubleSide, clippingPlanes: [sectionCutPlane],
  });
  const vessel = new THREE.Mesh(new THREE.CylinderGeometry(.365, .365, .34, 12, 1), vesselMaterial);
  vessel.name = 'rift-reactor-vessel';
  vessel.rotation.x = Math.PI / 2;
  vessel.position.z = .275;
  root.add(vessel);
  const innerMetal = material(0x9aafa0, {
    metalness: .68, roughness: .29, map: metalGrain,
    emissive: 0x416d42, emissiveIntensity: .25,
  });
  const innerGlow = material(0xb8ed9a, {
    metalness: .15, roughness: .2, emissive: 0x7fbd42, emissiveIntensity: 1.25,
  });
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(.065, .085, .32, 8), innerGlow);
  spindle.rotation.x = Math.PI / 2;
  spindle.position.z = .29;
  root.add(spindle);
  for (const z of [.14, .24, .36]) {
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(.19, .012, 4, 32), z === .24 ? acid : innerMetal);
    orbit.position.z = z;
    root.add(orbit);
  }
  const spokeGeometry = new THREE.BoxGeometry(.23, .018, .024);
  for (let i = 0; i < 6; i += 1) {
    const angle = i * Math.PI / 3;
    const spoke = new THREE.Mesh(spokeGeometry, i % 2 ? innerMetal : acid);
    spoke.position.set(Math.cos(angle) * .16, Math.sin(angle) * .16, .2);
    spoke.rotation.z = angle;
    root.add(spoke);
  }
  const cap = new THREE.Mesh(
    new THREE.RingGeometry(.205, .36, 12),
    material(0x70826d, { metalness: .68, roughness: .32, map: metalGrain, side: THREE.DoubleSide }),
  );
  cap.name = 'rift-cut-face';
  cap.visible = false;
  root.add(cap);
  const cutRim = new THREE.Mesh(new THREE.TorusGeometry(.367, .012, 4, 48), acid);
  cutRim.visible = false;
  root.add(cutRim);
  const scanMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8ff9e, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  });
  fadeMaterials.push(scanMaterial);
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(.44, .007, 3, 48), scanMaterial);
  scanRing.visible = false;
  root.add(scanRing);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xb7ed75, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  fadeMaterials.push(beamMaterial);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.035, .11, .54, 12, 1, true), beamMaterial,
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.z = .5;
  beam.visible = false;
  root.add(beam);

  // Engraved ticks make the structure readable when it is only a few pixels wide.
  const tickGeometry = new THREE.BoxGeometry(.035, .008, .004);
  for (let i = 0; i < 24; i += 1) {
    const angle = i * Math.PI / 12;
    const tick = new THREE.Mesh(tickGeometry, i % 6 ? recess : acid);
    tick.position.set(Math.cos(angle) * .585, Math.sin(angle) * .585, .086);
    tick.rotation.z = angle;
    root.add(tick);
  }

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
  const partTargets = [];
  const hitMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, side: THREE.DoubleSide,
  });
  const addPartTarget = (parent, id, label, radius, position, kind = 'part') => {
    const target = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), hitMaterial);
    target.position.set(...position);
    target.name = `rift-hit-${id}`;
    target.userData = { partId: id, partLabel: label, kind };
    parent.add(target);
    partTargets.push(target);
    return target;
  };
  addPartTarget(root, 'vessel', 'Camera reactorului', .27, [.25, 0, .25]);
  addPartTarget(root, 'frame', 'Inelul de ancorare', .18, [-.49, 0, .09]);
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
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.16, .012, 4, 24), acid);
    halo.position.z = .08;
    halo.visible = false;
    holder.add(halo);
    addPartTarget(holder, `node-${i}`, `Nodul ${i + 1}`, .15, [0, 0, .04], 'node');
    const energyCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(angle) * .77, Math.sin(angle) * .77, .59),
      new THREE.Vector3(Math.cos(angle) * .43, Math.sin(angle) * .43, .78),
      new THREE.Vector3(0, 0, .46),
    );
    const energyGeometry = new THREE.BufferGeometry().setFromPoints(energyCurve.getPoints(30));
    const energyMaterial = new THREE.LineDashedMaterial({
      color: 0xe4ff8a, dashSize: .085, gapSize: .045,
      transparent: true, opacity: 0, depthWrite: false,
    });
    fadeMaterials.push(energyMaterial);
    const energyLine = new THREE.Line(energyGeometry, energyMaterial);
    energyLine.name = `rift-energy-${i + 1}`;
    energyLine.computeLineDistances();
    energyLine.visible = false;
    root.add(energyLine);
    const energyDot = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), innerGlow);
    energyDot.visible = false;
    root.add(energyDot);
    nodes.push({ holder, faceMaterial, path, halo, energyCurve, energyLine, energyDot,
      energyMaterial, energyTime: 1, active: false, lift: 0, flash: 0 });
  }

  const nucleus = new THREE.Group();
  nucleus.name = 'rift-nucleus';
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
  addPartTarget(nucleus, 'crystal', 'Cristalul central', .19, [0, 0, .105]);
  addPartTarget(nucleus, 'collar', 'Colierul nucleului', .17, [-.21, 0, .02]);
  const rotor = new THREE.Group();
  rotor.name = 'rift-rotor';
  nucleus.add(rotor);
  ring(.3, .255, .025, metal, .145, Math.PI / 6, rotor);
  addPartTarget(rotor, 'rotor', 'Rotorul', .12, [.28, 0, .17]);
  const toothGeometry = new THREE.BoxGeometry(.11, .025, .02);
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3;
    const tooth = new THREE.Mesh(toothGeometry, acid);
    tooth.position.set(Math.cos(angle) * .28, Math.sin(angle) * .28, .18);
    tooth.rotation.z = angle + Math.PI / 2;
    rotor.add(tooth);
  }
  root.add(nucleus);

  // The completed mechanism gains a raised crown, so its silhouette changes
  // when viewed from the side instead of relying on a flat screen flash.
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(.46, .022, 5, 36), acid);
  crownRing.name = 'rift-crown';
  crownRing.position.z = .62;
  crownRing.rotation.x = .28;
  crownRing.visible = false;
  root.add(crownRing);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xd5ef44, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(.42, .02, 4, 40), pulseMaterial);
  pulseRing.name = 'rift-pulse';
  pulseRing.position.z = .69;
  pulseRing.visible = false;
  root.add(pulseRing);
  fadeMaterials.push(pulseMaterial);

  // Three slender rails make the depth between the anchored base and the
  // lifted core legible from oblique phone angles.
  const sectionRails = [];
  const railGeometry = new THREE.BoxGeometry(.018, .018, .46);
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3;
    const rail = new THREE.Mesh(railGeometry, i === 0 ? acid : metal);
    rail.position.set(Math.cos(angle) * .32, Math.sin(angle) * .32, .48);
    rail.visible = false;
    root.add(rail);
    sectionRails.push(rail);
  }

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
    addPartTarget(hinge, 'iris', 'Carcasa iris', .19,
      [Math.cos(angle) * .31, Math.sin(angle) * .31, .05]);
    blades.push({ hinge, angle, index: i });
  }

  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0xeaff9c, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  });
  fadeMaterials.push(selectionMaterial);
  const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(.15, .008, 4, 32), selectionMaterial);
  selectionRing.name = 'rift-selection';
  selectionRing.visible = false;
  root.add(selectionRing);

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
  let pulseFlash = 0;
  let pulseCount = 0;
  let crownLift = 0;
  let sectionOpen = false;
  let sectionProgress = 0;
  let sectionDragging = false;
  let selectedTarget = null;
  let selectionTime = 0;
  let fadeOpacity = 1;
  const selectionPosition = new THREE.Vector3();
  function update(dt) {
    pulseFlash = Math.max(0, pulseFlash - dt * 1.4);
    const blend = 1 - Math.exp(-Math.min(dt, .08) * 7);
    openness += (desiredOpen - openness) * blend;
    if (Math.abs(desiredOpen - openness) < .001) openness = desiredOpen;
    if (!sectionDragging) {
      sectionProgress += ((sectionOpen ? 1 : 0) - sectionProgress) * blend;
      if (Math.abs((sectionOpen ? 1 : 0) - sectionProgress) < .001) sectionProgress = sectionOpen ? 1 : 0;
    }
    const eased = openness * openness * (3 - 2 * openness);
    const cutZ = .46 - .225 * sectionProgress;
    root.updateWorldMatrix(true, false);
    sectionLocalPlane.constant = cutZ;
    sectionCutPlane.copy(sectionLocalPlane).applyMatrix4(root.matrixWorld);
    cap.visible = sectionProgress > .025;
    cap.position.z = cutZ + .002;
    cap.material.opacity = fadeOpacity * Math.min(1, sectionProgress * 4);
    cutRim.visible = cap.visible;
    cutRim.position.z = cutZ + .006;
    scanRing.visible = cap.visible;
    scanRing.position.z = cutZ + .014;
    scanRing.scale.setScalar(1 + .08 * Math.sin(sectionProgress * Math.PI));
    scanMaterial.opacity = fadeOpacity * .42 * Math.min(1, sectionProgress * 5);
    beam.visible = sectionProgress > .04;
    beam.scale.y = Math.max(.01, sectionProgress);
    beamMaterial.opacity = fadeOpacity * .17 * sectionProgress;
    for (const { hinge, angle, index } of blades) {
      hinge.position.x = Math.cos(angle) * (.31 * eased + .12 * sectionProgress);
      hinge.position.y = Math.sin(angle) * (.31 * eased + .12 * sectionProgress);
      hinge.position.z = .36 + (index % 2) * .012 + .06 * eased + .16 * sectionProgress;
      hinge.rotation.z = (index % 2 ? 1 : -1) * .15 * eased;
    }
    nucleus.position.z = .275 + .11 * eased + .36 * sectionProgress;
    nucleus.rotation.z = .14 * eased;
    nucleusMaterial.emissiveIntensity = .12 + 1.35 * eased + (nodes.every((node) => node.active) ? .7 : 0) + pulseFlash * 2.4;
    nucleus.scale.setScalar(1 + pulseFlash * .16);
    acid.emissiveIntensity = .65 + pulseFlash * 1.5;
    rotor.rotation.z = rotorAngle;
    const complete = nodes.every((node) => node.active);
    crownLift += ((complete ? 1 : 0) - crownLift) * blend;
    crownRing.visible = crownLift > .01;
    crownRing.position.x = .2 * sectionProgress;
    crownRing.position.y = .06 * sectionProgress;
    crownRing.position.z = .43 + .19 * crownLift + .42 * sectionProgress;
    crownRing.rotation.x = .28 + .5 * sectionProgress;
    crownRing.scale.setScalar(.75 + .25 * crownLift - .12 * sectionProgress);
    crownRing.rotation.z += dt * (.2 + .35 * crownLift);
    pulseRing.visible = pulseFlash > .01;
    pulseRing.position.z = .69 + .42 * sectionProgress;
    pulseRing.scale.setScalar(1 + (1 - pulseFlash) * 2.3);
    pulseMaterial.opacity = pulseFlash * .76 * fadeOpacity;
    for (const node of nodes) {
      node.flash = Math.max(0, node.flash - dt * 2.5);
      node.lift += ((node.active ? 1 : 0) - node.lift) * blend;
      node.holder.visible = eased > .15;
      node.holder.position.z = .56 + node.lift * .17 + .2 * sectionProgress;
      node.path.visible = node.lift > .01 && eased > .15;
      node.path.scale.x = Math.max(.01, node.lift);
      node.halo.visible = node.lift > .01;
      node.halo.scale.setScalar(.6 + .4 * node.lift + node.flash * .18);
      node.holder.scale.setScalar(.55 + .45 * eased + node.flash * .12);
      node.faceMaterial.color.setHex(node.active ? 0xf3ffd4 : armed ? 0xcde940 : 0x657064);
      node.faceMaterial.emissiveIntensity = node.active ? 1.4 + node.flash : armed ? .7 : .12;
      if (node.energyTime < 1) {
        node.energyTime = Math.min(1, node.energyTime + dt * 1.45);
        const travel = Math.min(1, node.energyTime * 1.45);
        node.energyLine.geometry.setDrawRange(0, Math.max(2, Math.ceil(31 * travel)));
        node.energyMaterial.opacity = fadeOpacity * Math.min(1, (1 - node.energyTime) * 2) * .95;
        node.energyDot.position.copy(node.energyCurve.getPoint(travel));
        node.energyDot.visible = node.energyTime < .7;
        node.energyLine.visible = true;
      } else {
        node.energyLine.visible = false;
        node.energyDot.visible = false;
      }
    }
    selectionTime = Math.max(0, selectionTime - dt);
    selectionRing.visible = !!selectedTarget && selectionTime > 0 && openness > .2;
    if (selectionRing.visible) {
      selectedTarget.getWorldPosition(selectionPosition);
      root.worldToLocal(selectionPosition);
      selectionRing.position.copy(selectionPosition);
      selectionRing.position.z += .08;
      selectionRing.scale.setScalar(1 + .12 * Math.sin(selectionTime * 12));
      selectionMaterial.opacity = fadeOpacity * Math.min(1, selectionTime * 2) * .9;
    }
    hitTarget.position.z = .22 + .3 * sectionProgress;
    for (const rail of sectionRails) {
      rail.visible = sectionProgress > .02;
      rail.scale.z = Math.max(.01, sectionProgress);
      rail.position.z = .48 + .12 * sectionProgress;
    }
  }

  return {
    root, hitTarget, partTargets, update,
    selectPart(target) {
      if (!desiredOpen || !partTargets.includes(target) || target.userData.kind !== 'part') return '';
      selectedTarget = target;
      selectionTime = 2.3;
      return target.userData.partLabel;
    },
    scrubSection(value) {
      if (!desiredOpen || !nodes.every((node) => node.active)) return false;
      sectionDragging = true;
      sectionProgress = THREE.MathUtils.clamp(value, 0, 1);
      return true;
    },
    toggle() {
      if (armed || nodes.some((node) => node.active)) return !!desiredOpen;
      desiredOpen = desiredOpen ? 0 : 1;
      return !!desiredOpen;
    },
    dragRotor(deltaX) {
      if (!desiredOpen) return { accepted: false, armed };
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
      node.energyTime = 0;
      if (nodes.every((item) => item.active)) {
        pulseFlash = 1;
      }
      return true;
    },
    pulse() {
      if (!desiredOpen || !nodes.every((node) => node.active)) return false;
      pulseFlash = 1;
      pulseCount += 1;
      return true;
    },
    setSection(open) {
      if (!desiredOpen || !nodes.every((node) => node.active) ||
          (sectionOpen === !!open && !sectionDragging)) return false;
      sectionOpen = !!open;
      sectionDragging = false;
      return true;
    },
    reset() {
      desiredOpen = 0;
      armed = false;
      rotorAngle = 0;
      pulseFlash = 0;
      crownLift = 0;
      sectionOpen = false;
      sectionDragging = false;
      selectedTarget = null;
      selectionTime = 0;
      nodes.forEach((node) => { node.active = false; node.lift = 0; node.flash = 0; node.energyTime = 1; });
      return true;
    },
    getNodeWorldPosition(index, out) { return nodes[index]?.holder.getWorldPosition(out); },
    getCoreWorldPosition(out) { return nucleus.getWorldPosition(out); },
    get isOpen() { return !!desiredOpen; },
    get isArmed() { return armed; },
    get progress() { return nodes.filter((node) => node.active).length; },
    get isComplete() { return nodes.every((node) => node.active); },
    get isSectionOpen() { return sectionOpen; },
    get sectionAmount() { return sectionProgress; },
    get nodeStates() { return nodes.map((node) => node.active); },
    getSyncState() {
      return { open: !!desiredOpen, armed, nodes: nodes.map((node) => node.active), section: sectionOpen, pulseCount };
    },
    restoreState(state) {
      if (state?.experience !== 'core' || !Array.isArray(state.nodes) || state.nodes.length !== 3) return;
      desiredOpen = state.open ? 1 : 0;
      openness = desiredOpen;
      armed = !!state.armed;
      rotorAngle = armed ? .85 : 0;
      pulseFlash = 0;
      pulseCount = Number.isSafeInteger(state.pulseCount) && state.pulseCount >= 0 ? state.pulseCount : 0;
      nodes.forEach((node, index) => {
        node.active = !!state.nodes[index];
        node.lift = node.active ? 1 : 0;
        node.flash = 0;
        node.energyTime = 1;
      });
      crownLift = nodes.every((node) => node.active) ? 1 : 0;
      sectionOpen = !!state.section && nodes.every((node) => node.active);
      sectionProgress = sectionOpen ? 1 : 0;
      sectionDragging = false;
      selectedTarget = null;
      selectionTime = 0;
      update(0);
    },
    setOpacity(alpha) {
      if (fadeOpacity === alpha) return;
      fadeOpacity = alpha;
      for (const surface of fadeMaterials) {
        surface.opacity = surface === pulseMaterial ? pulseFlash * .76 * alpha : alpha;
        surface.depthWrite = surface !== pulseMaterial && alpha >= .99;
      }
    },
  };
}
