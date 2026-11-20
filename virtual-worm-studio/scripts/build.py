#!/usr/bin/env python3
"""Build a browser-launching standalone distribution on the current OS."""
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    command = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
               '--onedir', '--console', '--name', 'VirtualWormStudio',
               '--distpath', str(ROOT / 'dist'), '--workpath', str(ROOT / 'build'),
               '--specpath', str(ROOT / 'build')]
    # Do not bundle Blender or a user's downloaded model, settings, or exports.
    for name in ['web', 'assets', 'VERSION', 'export_blend.py']:
        destination = '.' if name in ['VERSION', 'export_blend.py'] else name
        command += ['--add-data', str(ROOT / name) + os.pathsep + destination]
    command.append(str(ROOT / 'launch.py'))
    subprocess.run(command, cwd=ROOT, check=True)
    distribution = ROOT / 'dist/VirtualWormStudio'
    for name in ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'VERSION']:
        shutil.copy2(ROOT / name, distribution / name)
    shutil.copytree(ROOT / 'docs', distribution / 'docs', dirs_exist_ok=True)
    (distribution / 'model').mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'model/README.md', distribution / 'model/README.md')
    executable = distribution / ('VirtualWormStudio.exe' if os.name == 'nt' else 'VirtualWormStudio')
    # Exercises the actual frozen app, not merely the source entry point.
    with tempfile.TemporaryDirectory(prefix='vws-frozen-check-') as check_dir:
        subprocess.run([str(executable), '--doctor', '--data-dir', check_dir], check=True)
    shutil.rmtree(distribution / 'cache', ignore_errors=True)
    version = (ROOT / 'VERSION').read_text().strip()
    system = {'Darwin': 'macOS', 'Windows': 'Windows', 'Linux': 'Linux'}[platform.system()]
    name = f'VirtualWormStudio-{version}-{system}-{platform.machine()}'
    release = ROOT / 'release'
    release.mkdir(exist_ok=True)
    if system == 'Linux':
        archive = release / (name + '.tar.gz')
        with tarfile.open(archive, 'w:gz') as out:
            out.add(distribution, arcname='VirtualWormStudio')
    else:
        archive = release / (name + '.zip')
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
            for path in sorted(distribution.rglob('*')):
                if path.is_file():out.write(path, path.relative_to(distribution.parent))
    print('Built ' + str(archive))


if __name__ == '__main__':
    main()
