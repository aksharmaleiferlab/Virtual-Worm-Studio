# Third-party sources, attribution, and distribution

## Imported Virtual Worm anatomy

The prepared geometry (`assets/model.bin.gz.part01`, `part02`) and object
catalog (`web/catalog.json`) derive from **Virtual_Worm_February_2012.blend**,
created by **Chris Grove, PhD**, for **WormBase** at the **California Institute
of Technology**. Geometry was evaluated in original Blender world coordinates;
no individual cells were recentered or rescaled. Stored anatomical objects
outside the original active scene were included and flagged in the catalog.

Source: [Virtual Worm Project](https://caltech.wormbase.org/virtualworm/).
Original model instructions: [Instructional videos](https://caltech.wormbase.org/virtualworm/Instructional_Videos.html).

The project homepage states that the model is available for dissemination
under the MIT license with appropriate attribution. The original `.blend`
file is **not** included in this portable repository: users can download it
optionally from the original project for editable Blender extraction.
The prepared derived geometry is included so normal use works offline.

Retain the source attribution in redistributed geometry, documentation, and
illustration credits. Suggested credit:

> Anatomy imported from the Virtual Worm Project, February 2012 model,
> Chris Grove / WormBase / California Institute of Technology.
> Figure prepared with Virtual Worm Studio.

MIT permission and disclaimer text is reproduced in [LICENSE](LICENSE).
The application's copyright notice does not replace the source-model credit.
The original project has not endorsed this application.

## Three.js r170

`web/vendor/three.module.js`, `OrbitControls.js`, and `GLTFExporter.js`
are from Three.js r170. Copyright 2010–2024 Three.js authors; MIT license.
The upstream notice and full license are preserved in
[web/vendor/THREE-LICENSE.txt](web/vendor/THREE-LICENSE.txt).

Upstream: [Three.js source, r170](https://github.com/mrdoob/three.js/tree/r170).
Vendored libraries are local; no CDN is contacted by the application.

## Optional Blender installation

Blender is a separately installed optional dependency. It is **not** bundled
in the source archive or the included build workflow. Blender's GPL license
and source availability information are at
[blender.org/about/license](https://www.blender.org/about/license/).
If maintainers later redistribute Blender, they must satisfy its applicable
license/source-distribution requirements and preserve upstream notices.

## Standalone packaging tools and runtime

PyInstaller is a build-only dependency. Standalone builds contain a Python
runtime and PyInstaller bootloader, with their applicable license notices
as collected by the build tool. See
[PyInstaller's license](https://pyinstaller.org/en/stable/license.html)
and [Python's license](https://docs.python.org/3/license.html).
Review collected dependency notices before public binary distribution.
