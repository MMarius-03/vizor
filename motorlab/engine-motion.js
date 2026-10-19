import * as THREE from "three";

// The crankshaft rotates at 12 rad/s in the source animation. Two revolutions
// finish before the outer components begin separating at about 1.67 seconds.
const RUN_START = 1 / 12;
const RUN_DURATION = Math.PI / 3;

export function createRunningClip(source) {
  const samples = 128;
  const tracks = source.tracks.map((sourceTrack) => {
    const track = sourceTrack.clone();
    const size = sourceTrack.getValueSize();
    const sample = sourceTrack.createInterpolant();
    const first = Array.from(sample.evaluate(RUN_START));
    const last = Array.from(sample.evaluate(RUN_START + RUN_DURATION));
    const times = new Float32Array(samples + 1);
    const values = new Float32Array((samples + 1) * size);
    const rotation = sourceTrack.ValueTypeName === "quaternion";
    const q = new THREE.Quaternion();
    const correction = rotation ? new THREE.Quaternion().fromArray(last).normalize().invert()
      .multiply(new THREE.Quaternion().fromArray(first).normalize()) : null;
    const drift = new THREE.Quaternion();
    for (let i = 0; i <= samples; i += 1) {
      const time = RUN_DURATION * i / samples;
      times[i] = time;
      const value = Array.from(sample.evaluate(RUN_START + time));
      // Correct only the baked endpoint drift, spread over the whole cycle.
      // Easing toward the first pose near the seam used to brake the crankshaft
      // almost to a stop at every repeat. Interpolation supplies in-between frames.
      const blend = i / samples;
      if (rotation) {
        drift.identity().slerp(correction, blend);
        q.fromArray(value).normalize().multiply(drift).normalize().toArray(values, i * size);
      } else {
        for (let k = 0; k < size; k += 1) values[i * size + k] = value[k] + (first[k] - last[k]) * blend;
      }
    }
    track.times = times;
    track.values = values;
    return track.optimize();
  });
  return new THREE.AnimationClip("V8 running", RUN_DURATION, tracks);
}
