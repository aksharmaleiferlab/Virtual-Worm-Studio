"""Portable paths, model-cache verification, and optional Blender discovery."""
import gzip
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL_NAME = 'Virtual_Worm_February_2012.blend'


def default_data_dir():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return ROOT


def read_settings(data_dir):
    path = Path(data_dir) / 'settings.json'
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('settings.json must contain a JSON object.')
    return value


def update_settings(data_dir, changes):
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    value = read_settings(data_dir)
    value.update(changes)
    # Same-directory rename is atomic; unique files allow independent instances.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=data_dir,
                                     prefix='.settings-', suffix='.tmp', delete=False) as f:
        temp = Path(f.name)
        json.dump(value, f, indent=2)
    try:
        temp.replace(data_dir / 'settings.json')
    finally:
        temp.unlink(missing_ok=True)
    return value


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def prepare_geometry(data_dir):
    manifest = json.loads((ROOT / 'assets/manifest.json').read_text(encoding='utf-8'))
    spec = manifest['geometry']
    cache = Path(data_dir) / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    output = cache / 'model.bin'
    if output.is_file() and output.stat().st_size == spec['bytes'] and sha256(output) == spec['sha256']:
        return output
    compressed = b''.join((ROOT / name).read_bytes() for name in spec['parts'])
    if hashlib.sha256(compressed).hexdigest() != spec['compressed_sha256']:
        raise ValueError('An anatomy asset is missing or damaged. Extract the complete package again.')
    raw = gzip.decompress(compressed)
    if len(raw) != spec['bytes'] or hashlib.sha256(raw).hexdigest() != spec['sha256']:
        raise ValueError('Anatomy checksum failed. Extract the complete package again.')
    with tempfile.NamedTemporaryFile(dir=cache, prefix='.geometry-', delete=False) as stream:
        temp = Path(stream.name)
        stream.write(raw)
    try:
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)
    return output


def resolve_blender(settings):
    explicit = settings.get('blender_path') or os.environ.get('VWS_BLENDER')
    if explicit:
        candidate = Path(explicit).expanduser()
        if candidate.suffix.lower() == '.app':
            candidate = candidate / 'Contents/MacOS/Blender'
        return candidate.resolve() if candidate.is_file() else None
    candidates = [ROOT / 'runtime/Blender/Blender.app/Contents/MacOS/Blender',
                  Path('/Applications/Blender.app/Contents/MacOS/Blender')]
    for variable in ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']:
        base = os.environ.get(variable)
        if base:
            candidates.extend(sorted(Path(base).glob('Blender Foundation/Blender */blender.exe'), reverse=True))
    executable = shutil.which('blender')
    if executable:
        candidates.insert(0, Path(executable))
    return next((p.resolve() for p in candidates if p.is_file()), None)


def resolve_model(settings, data_dir):
    explicit = settings.get('model_path') or os.environ.get('VWS_MODEL')
    candidates = [Path(explicit).expanduser()] if explicit else [Path(data_dir) / 'model' / MODEL_NAME, ROOT / 'model' / MODEL_NAME]
    return next((p.resolve() for p in candidates if p.is_file()), None)
