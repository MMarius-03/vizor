# Credits and third-party software

RIFT NEXT loads [Three.js 0.183.2](https://threejs.org/) and the [8th Wall Engine Binary](https://8thwall.org/docs/open-source) with XRExtras from jsDelivr. Three.js is MIT licensed. The XR Engine Binary remains subject to its own [license](https://github.com/8thwall/engine/blob/main/LICENSE). Image target data is generated with the [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/tree/main/apps/image-target-cli).

The original repository's author credit and terms are unchanged. The new target artwork and experiment code are additions to this repository.

`studies/campus-geo-data.js` contains campus boundary and reference coordinates derived from © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This adapted geospatial dataset is distributed under ODbL 1.0. Retrieved 2026-11-06 from the OSM API; individual source objects are linked in the dataset. The affine transform maps these geographic references to our schematic model; it is not a surveyed map. See `PLAN-GEOLOCATIE.md` for calibration and validation limits.
