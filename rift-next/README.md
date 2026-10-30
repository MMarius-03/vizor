# RIFT NEXT — image tracking proof

This folder is a separate WebAR experiment. The current experience remains in [`../rift/`](../rift/).

## Try it

1. Open `https://mmarius-03.github.io/vizor/rift-next/` on the laptop. Keep the complete static target image visible.
2. Use **Copiază linkul de iPhone** and open that link in Safari on the iPhone.
3. Allow the rear camera, frame the complete target, then move slowly sideways. The cube should stay attached to the same place on the laptop image. Tap the cube to change its color.
4. Briefly cover the target, then uncover it. The cube should disappear and return at the target.

Add `&debug=1` to the iPhone URL to see target events, canvas size and frame rate. Camera access requires HTTPS on the phone.

This is a **tracking test**, not the final RIFT scene. It uses an image displayed on the laptop as a visual marker. The image target events come from 8th Wall; the cube is placed only after `reality.imagefound`/`reality.imageupdated`. No placement on a real table, hand tracking or real-world occlusion is claimed. The image-only setup disables floor-based world tracking for this first experiment.

## Files and sources

- `target-source.png` is the exact image displayed on the laptop. `tools/make-target.py` regenerates it with Pillow.
- `target-data/rift-screen.json` and the derived images were produced with `npx @8thwall/image-target-cli@latest`. Its `imagePath` was changed to a page-relative URL for GitHub Pages.
- `app.js` uses the same Three.js and [8th Wall Engine Binary](https://8thwall.org/docs/open-source) family as the existing RIFT page. See the [image target configuration](https://8thwall.org/docs/api/engine/xrcontroller/configure) and [event documentation](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule).

The camera tracking must be validated on a physical iPhone. Desktop viewport emulation cannot establish whether the laptop image tracks steadily in Safari.
