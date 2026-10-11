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
    const times = new Float32Array(samples + 1);
    const values = new Float32Array((samples + 1) * size);
    const rotation = sourceTrack.ValueTypeName === "quaternion";
    const q = new THREE.Quaternion();
    const firstQuaternion = rotation ? new THREE.Quaternion().fromArray(first) : null;
    for (let i = 0; i <= samples; i += 1) {
      const time = RUN_DURATION * i / samples;
      times[i] = time;
      const value = Array.from(sample.evaluate(RUN_START + time));
      // The baked export has small phase drift; close the seam over the final
      // 65 ms. Static cover tracks never enter the global explosion segment.
      const blend = THREE.MathUtils.smoothstep(time, RUN_DURATION - 0.065, RUN_DURATION);
      if (rotation) {
        q.fromArray(value).normalize().slerp(firstQuaternion, blend).toArray(values, i * size);
      } else {
        for (let k = 0; k < size; k += 1) values[i * size + k] = THREE.MathUtils.lerp(value[k], first[k], blend);
      }
    }
    track.times = times;
    track.values = values;
    return track.optimize();
  });
  return new THREE.AnimationClip("V8 running", RUN_DURATION, tracks);
}
