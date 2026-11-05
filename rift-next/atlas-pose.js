// Filter world-anchor corrections, independently of the camera's own motion.
// Small detector noise stays inside a dead zone; real corrections converge faster.
export function smoothAtlasPose(root, position, rotation, scale, dt, width = .75, motion = 0) {
  const step = Math.min(Math.max(dt, 0), .05);
  const size = Math.max(.01, width * scale);
  const distance = root.position.distanceTo(position);
  const positionDeadzone = size * .002;
  if (distance > positionDeadzone) {
    const speed = 3 + 13 * Math.max(motion, Math.min(1, distance / (size * .12)));
    root.position.lerp(position, (1 - Math.exp(-speed * step)) * (1 - positionDeadzone / distance));
  }
  const angle = root.quaternion.angleTo(rotation);
  const angleDeadzone = .006;
  if (angle > angleDeadzone) {
    const speed = 3 + 12 * Math.max(motion, Math.min(1, angle / .2));
    root.quaternion.slerp(rotation, (1 - Math.exp(-speed * step)) * (1 - angleDeadzone / angle));
  }
  const delta = scale - root.scale.x;
  const scaleDeadzone = scale * .002;
  if (Math.abs(delta) > scaleDeadzone) {
    const speed = 2.5 + 10 * Math.max(motion, Math.min(1, Math.abs(delta) / (scale * .12)));
    root.scale.setScalar(root.scale.x + (delta - Math.sign(delta) * scaleDeadzone) * (1 - Math.exp(-speed * step)));
  }
}

// Reject isolated pose jumps, but accept a sustained move on its next observation.
// Velocity uses signed deltas, so alternating detector noise cancels out.
export function createAtlasPoseTracker(THREE) {
  const position=new THREE.Vector3(), rotation=new THREE.Quaternion();
  const sample=new THREE.Vector3(), sampleRotation=new THREE.Quaternion();
  const candidate=new THREE.Vector3(), candidateRotation=new THREE.Quaternion();
  const velocity=new THREE.Vector3(), delta=new THREE.Vector3();
  let scale=1, last=0, initialized=false, candidateAt=-Infinity, candidateScale=1;
  let scaleVelocity=0, motion=0;
  return {
    position, rotation,
    get scale() { return scale; },
    motionAt(now) { return motion*Math.exp(-Math.max(0,now-last-60)/160); },
    measure(p,q,s,now,width,reset=false) {
      sample.set(p.x,p.y,p.z); sampleRotation.set(q.x,q.y,q.z,q.w).normalize();
      const size=Math.max(.01,width*s);
      if (initialized && !reset) {
        const jump=sample.distanceTo(position)>size*.18 || sampleRotation.angleTo(rotation)>.35 || Math.abs(s-scale)>scale*.18;
        if (jump && !(now-candidateAt<180 && sample.distanceTo(candidate)<size*.08 &&
            sampleRotation.angleTo(candidateRotation)<.15 && Math.abs(s-candidateScale)<s*.08)) {
          candidate.copy(sample); candidateRotation.copy(sampleRotation); candidateScale=s; candidateAt=now;
          return false;
        }
        const dt=Math.max(.008,Math.min(.15,(now-last)/1000));
        delta.copy(sample).sub(position).multiplyScalar(1/(size*dt));
        const alpha=1-Math.exp(-dt/.12);
        velocity.lerp(delta,alpha);
        scaleVelocity+=( (s-scale)/(scale*dt)-scaleVelocity)*alpha;
        motion=Math.min(1,Math.max(0,(velocity.length()-.035)/.22, (Math.abs(scaleVelocity)-.025)/.22));
      } else { velocity.set(0,0,0); scaleVelocity=0; motion=0; }
      candidateAt=-Infinity;
      position.copy(sample); rotation.copy(sampleRotation); scale=s; last=now; initialized=true;
      return true;
    },
  };
}
