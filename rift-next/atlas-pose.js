// Filter world-anchor corrections, independently of the camera's own motion.
// Small detector noise stays inside a dead zone; real corrections converge faster.
export function smoothAtlasPose(root, position, rotation, scale, dt, width = .75) {
  const step = Math.min(Math.max(dt, 0), .05);
  const size = Math.max(.01, width * scale);
  const distance = root.position.distanceTo(position);
  const positionDeadzone = size * .002;
  if (distance > positionDeadzone) {
    const speed = 3 + 13 * Math.min(1, distance / (size * .12));
    root.position.lerp(position, (1 - Math.exp(-speed * step)) * (1 - positionDeadzone / distance));
  }
  const angle = root.quaternion.angleTo(rotation);
  const angleDeadzone = .006;
  if (angle > angleDeadzone) {
    const speed = 3 + 12 * Math.min(1, angle / .2);
    root.quaternion.slerp(rotation, (1 - Math.exp(-speed * step)) * (1 - angleDeadzone / angle));
  }
  const delta = scale - root.scale.x;
  const scaleDeadzone = scale * .002;
  if (Math.abs(delta) > scaleDeadzone) {
    const speed = 2.5 + 10 * Math.min(1, Math.abs(delta) / (scale * .12));
    root.scale.setScalar(root.scale.x + (delta - Math.sign(delta) * scaleDeadzone) * (1 - Math.exp(-speed * step)));
  }
}
