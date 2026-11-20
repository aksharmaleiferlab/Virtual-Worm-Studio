#!/usr/bin/env python3
"""Create a clean GitHub source ZIP without local state or downloaded models."""
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
version = (ROOT / 'VERSION').read_text().strip()
archive = ROOT.parent / f'VirtualWormStudio-{version}-GitHub-Source.zip'
excluded_dirs = {'.git', '__pycache__', '.venv', 'venv', 'cache', 'build', 'dist', 'release', 'runtime', 'exports'}
excluded_files = {'settings.json', 'last-error.log', '.DS_Store', 'Thumbs.db'}
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for path in sorted(ROOT.rglob('*')):
        relative = path.relative_to(ROOT)
        if not path.is_file() or any(p in excluded_dirs for p in relative.parts):continue
        if path.name in excluded_files or path.name.startswith('.settings-') or path.suffix in {'.blend', '.blend1', '.pyc'}:continue
        if relative == Path('web/model.bin'):continue
        if len(relative.parts) == 1 and (path.suffix in {'.png', '.glb', '.csv'} or path.name.endswith('-view.json')):continue
        if path.stat().st_size > 25 * 1024 * 1024:raise ValueError('Repository file exceeds 25 MiB: ' + str(relative))
        output.write(path, Path('virtual-worm-studio') / relative)
with zipfile.ZipFile(archive) as source:
    if source.testzip() is not None:raise ValueError('Archive CRC verification failed')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(archive.suffix + '.sha256').write_text(digest + '  ' + archive.name + '\n')
print(str(archive))
print('SHA-256: ' + digest)
