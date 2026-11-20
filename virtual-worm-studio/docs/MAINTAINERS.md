# Maintainer guide

## Repository preparation and publishing

This folder is the repository root. It contains source and prepared anatomy,
not a copy of a user's installation/settings. The original `.blend` download
is optional; do not make it a startup prerequisite.

Every tracked file in this package is below GitHub's 25 MiB browser-upload
limit. The geometry archive is split into 16 MiB parts; the application joins
and verifies them locally. Generated `cache/model.bin` is about 56.5 MiB and
is ignored by Git. No Git LFS setup is needed for this release.

1. Create a new empty GitHub repository in your account, choosing its visibility.
2. From a terminal in this folder, run:

```sh
git init -b main
git add .
git status --short
git commit -m "Add Virtual Worm Studio 1.5.0"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_REPOSITORY_URL` with the new repository URL. Authenticate using
your normal Git/GitHub mechanism. Do not put a token into this README or commands.
Before committing, verify that `settings.json`, downloaded `.blend`, cache,
logs, runtime binaries, and personal exported figures are absent from the index.
Files in an alternate custom export directory also need to be kept out of Git.

You can instead use GitHub's Upload files interface, but ensure hidden files
such as `.github/workflows/build.yml`, `.gitignore`, and `.gitattributes` are
included. Git is more reliable for preserving the full folder layout. Upload
the *contents of the repository folder*, not the outer ZIP as a substitute
for the source tree.

This package has not been automatically published to a GitHub account.

## Validation

From the repository root:

```sh
python3 -m unittest discover -s tests -v
python3 launch.py --doctor
node --test tests/web.test.mjs
```

Node.js 20+ is needed only for the JavaScript development tests. No npm install
is required. Run Python tests in a terminal permitted to bind localhost sockets.
Python tests exercise model checksums/recovery, settings preservation,
cross-platform paths/names, API session/origin/Host checks, geometry serving,
optional-dependency errors, and exports. JS tests check name parsing, portable
filenames, and embedded PNG view metadata.

For manual visual regression:

1. Launch in a desktop browser with WebGL2.
2. Select `Cuticle, Intestine, Pharynx` together.
3. Enable line art for all three. Confirm all three silhouettes remain visible.
4. Open Individual cell colors & style. Keep Cuticle=Outline, set the organs=Filled.
5. Color intestine red and pharynx green. Click the cuticle in the viewport.
6. Confirm all three remain selected and colored organs remain visible.
7. Toggle faint context on and off twice. Confirm the switch and view restore.
8. Export PNG; verify colored organs, outline, scale bar, and background.
9. Save JSON, reload it, and load an exported PNG that retains metadata.
10. Export GLB and CSV. If Blender is configured, export .blend and verify
    object names/colors and original world coordinates against the source.

macOS local checks do not establish Windows/Linux GUI or Blender compatibility.
Complete this manual checklist on each intended release platform/hardware.

## Build standalone portable downloads

Use a native host for each target OS and architecture. Recommended build
interpreter: Python 3.11 (CI); Python 3.12 is also a source-test target.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-build.txt
python scripts/build.py
```

Windows PowerShell equivalent:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-build.txt
python scripts/build.py
```

If PowerShell activation is restricted, use `.venv\Scripts\python.exe` directly
instead of changing machine-wide execution policy. Builds use PyInstaller
**onedir** with a console, then open the default browser. The output is not
a native embedded browser window and is not a single-file installer.

The builder:

- Includes offline viewer libraries, both anatomy parts, manifest, and extraction helper.
- Excludes original `.blend`, Blender, settings, caches, and user exports.
- Invokes the actual frozen executable with `--doctor` before archiving.
- Creates `release/VirtualWormStudio-VERSION-OS-ARCH.zip` or `.tar.gz`.
- Keeps supporting `_internal` files together with the executable.

PyInstaller builds for the current OS; it cannot produce Windows/Linux
executables on a Mac. For Apple Silicon and Intel downloads, build on both
architectures or explicitly test the compatible architecture strategy.
On Linux, the build system's glibc and native dependencies determine the
oldest usable distribution; test on the distributions you intend to support.
Blender stays an external optional dependency regardless of build method.

### GitHub Actions

Push the full source tree to GitHub. Open **Actions → Test and build portable
apps → Run workflow**. The workflow tests Python 3.11 and 3.12 on macOS,
Windows, and Ubuntu, runs the Node tests, then builds one archive per OS using
Python 3.11. Pull requests run tests only. Version-tag pushes also trigger builds.

Download each successful job's artifact. GitHub wraps uploaded artifacts in
another ZIP; unzip that wrapper to obtain the actual portable release archive.
The architecture is named in each inner archive and reflects the runner.
A workflow file is supplied here; an actual green run must be observed in
your repository before describing those platform builds as tested.

### Publish a release

1. Update VERSION, README, package.json, and CHANGELOG consistently.
2. Commit changes, then push a matching version tag (for this release, `v1.5.0`).
3. Wait for all test/build jobs and inspect the resulting archives.
4. Run the manual checklist on each target platform. Check that no local paths,
   settings, logs, model downloads, or figures were bundled accidentally.
5. Create a GitHub Release for the tag and attach the **inner** OS archives,
   a clean source ZIP, and SHA-256 checksums.
6. Describe actual tested OS/CPU/Blender versions, optional original-model setup,
   and any unsigned-binary installation limitations.

The workflow does not automatically publish releases or send messages.
Signing and notarization require the maintainer's credentials and a separate
release process; no signing keys are included. Pin exact build dependencies
and action commit SHAs for a controlled release if your project requires it.

## Regenerating prepared anatomy (advanced)

Ordinary users never need this. Changing only the optional source path does
not change the prepared viewer model.

1. Obtain the original February 2012 .blend from the Virtual Worm site.
2. Back up the current prepared assets/catalog. Use compatible Blender 3.0.1.
3. From this repository, run (adjust executable and source paths):

```sh
/path/to/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python prepare_model.py -- /path/to/Virtual_Worm_February_2012.blend
```

4. This writes `web/model.bin` and `web/catalog.json` in source runs.
5. Recompress and split geometry, updating checksums:

```sh
python3 scripts/pack_assets.py --source-blend /path/to/Virtual_Worm_February_2012.blend
```

6. Verify names, coordinates, source-in-scene flags, colors, scale calibration,
   and optional extraction against the original. Rerun tests and visual checks.
7. Remove the ignored generated `web/model.bin` if desired; normal launch
   serves the verified data-folder cache instead.

Both compressed parts and their manifest must change together. The packing
script removes previous `model.bin.gz.part*` files before writing the new set.
Do not replace this release with a different model without updating attribution,
expected source names, coordinate/calibration assumptions, and documentation.

## Create a clean source archive

Run `python3 scripts/package_source.py` from the repository root. The ZIP and
SHA-256 file are written beside the repository folder, excluding generated
state, user exports, original models, and build outputs. Inspect the archive
before attaching it to a GitHub Release.

## Source references

- Anatomy and license statement: https://caltech.wormbase.org/virtualworm/
- Original videos: https://caltech.wormbase.org/virtualworm/Instructional_Videos.html
- Blender previous releases: https://www.blender.org/download/previous-versions/
- Three.js r170: https://github.com/mrdoob/three.js/tree/r170
- GitHub file limits: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
