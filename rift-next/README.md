# RIFT NEXT — image tracking proof

This folder is a separate WebAR experiment. The current experience remains in [`../rift/`](../rift/).

## Try it

1. Open `https://mmarius-03.github.io/vizor/rift-next/` on the laptop. Use **Mărește ținta** after copying the phone link. Keep the complete static target image visible and raise the laptop brightness enough to avoid a dim or reflective image.
2. Use **Copiază linkul de iPhone** and open that link in Safari on the iPhone.
3. Allow the rear camera, frame the complete target, then move slowly sideways. The cube should stay attached to the same place on the laptop image. Tap the cube to change its color.
4. Briefly cover the target, then uncover it. A short tracking interruption should fade the cube and reconnect it. A longer loss should hide it until the target is recognized again.

The default mode combines image tracking with world tracking to keep the last known anchor during short detection gaps. Add `&tracking=image` to compare the original image-only tracking, and `&debug=1` to see detection events, losses, recoveries, canvas size and frame rate. Camera access requires HTTPS on the phone. These modes need a physical iPhone comparison; the mock browser test cannot measure actual tracking quality.

This is a **tracking test**, not the final RIFT scene. It uses an image displayed on the laptop as a visual marker. The image target events come from 8th Wall; the cube is placed only after `reality.imagefound`/`reality.imageupdated`. During a brief loss, the hybrid mode holds the last anchor while world tracking updates the camera. There is no placement on a real table, hand tracking or real-world occlusion yet. The comparison mode disables world tracking.

## Files and sources

- `target-source.png` is the exact image displayed on the laptop. `tools/make-target.py` regenerates it with Pillow.
- `target-data/rift-screen.json` and the derived images were produced with `npx @8thwall/image-target-cli@latest`. Its `imagePath` was changed to a page-relative URL for GitHub Pages.
- `app.js` uses the same Three.js and [8th Wall Engine Binary](https://8thwall.org/docs/open-source) family as the existing RIFT page. See the [image target configuration](https://8thwall.org/docs/api/engine/xrcontroller/configure) and [event documentation](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule).

The camera tracking must be validated on a physical iPhone. Desktop viewport emulation cannot establish whether the laptop image tracks steadily in Safari.
