# Maintainer guide for this repository layout

The GitHub repository root contains README.md, example figures, LICENSE,
.github/workflows/build.yml, and the virtual-worm-studio app folder.
Keep the workflow at the repository root; GitHub ignores nested workflow files.
Its run steps set working-directory to virtual-worm-studio, and uploaded
archives come from virtual-worm-studio/release/.

## Source use and tests

From the repository root:

```sh
cd virtual-worm-studio
python3 -m unittest discover -s tests -v
python3 launch.py --doctor
node --test tests/web.test.mjs
python3 launch.py
```

On Windows use `py -3` instead of `python3`. Node 20+ is only needed for JS
development tests. The source app needs Python 3.10+, a WebGL2 browser, and
no pip packages. Prepared anatomy is already included.

## Build standalone downloads on GitHub

1. Commit the repair files, including the root `.github` folder. Finder may
   hide dotfiles; Git commits them normally. Press Command+Shift+Period in
   Finder if you need to see them.
2. In GitHub, open Actions > Test and build portable apps > Run workflow.
3. Wait for test jobs and all three build jobs to finish.
4. Open the successful run and download the Windows, macOS, and Linux
   artifacts. Each artifact ZIP contains an inner release archive.
5. Extract the outer artifact ZIP and then the inner archive. Windows builds
   contain VirtualWormStudio.exe and the support files that must stay with it.
6. Test the actual app on each target system. Attach the inner release archives
   to a GitHub Release for easier public downloads.

The workflow does not publish a Release automatically. No binaries have been
built merely by adding the workflow file. Source archives from Code > Download
ZIP contain launch scripts, not an executable.

## Build locally

Run from virtual-worm-studio, on the OS/CPU you intend to target:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-build.txt
python scripts/build.py
```

Use Python 3.11 for the build environment. On Windows, create the venv with
`py -3.11 -m venv .venv` and invoke `.venv\Scripts\python.exe` directly
for pip/build if activation is unavailable. Output is in the app's release
folder. PyInstaller is not a cross-compiler: build Windows binaries on Windows.
The builder runs --doctor against the frozen app before archiving.

Keep docs/screenshot.jpg and this guide: the README links to them, and the
build script copies docs into standalone distributions.

## Manual checks before publishing

Select Cuticle, Intestine, Pharynx. Outline Cuticle and fill/color the organs.
Click Cuticle: all three remain selected and the organs remain visible.
Toggle faint context on/off. Export PNG with a scale bar, JSON, GLB, and CSV.
Check PNG embedded view settings against JSON. If optional Blender/source
model are configured, test editable .blend export and original coordinates.
Record the actual OS/CPU/browser/Blender versions tested.

Do not commit user exports, cache, settings.json, original .blend downloads,
logs, virtual environments, or build outputs. Inspect `git status` before
every commit. Hidden .gitignore files protect those paths.

To package clean application source, run `python3 scripts/package_source.py`
inside virtual-worm-studio. For a full repository ZIP including the workflow,
use a clean Git archive from the repository root after committing all files.

For anatomy regeneration, run prepare_model.py using compatible Blender,
then scripts/pack_assets.py --source-blend with the original source path.
Always update both compressed parts and the manifest together; verify
coordinates and calibration before distributing modified anatomy.
