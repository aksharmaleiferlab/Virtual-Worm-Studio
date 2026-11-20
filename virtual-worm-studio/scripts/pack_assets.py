#!/usr/bin/env python3
"""Repack a freshly regenerated web/model.bin into GitHub-friendly assets."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-blend', required=True, type=Path)
args = parser.parse_args()
raw = (ROOT / 'web/model.bin').read_bytes()
compressed = gzip.compress(raw, compresslevel=9, mtime=0)
source = args.source_blend.resolve()
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
for path in assets.glob('model.bin.gz.part*'):path.unlink()
parts = []
for i, offset in enumerate(range(0, len(compressed), 16 * 1024 * 1024)):
    name = f'model.bin.gz.part{i + 1:02d}'
    (assets / name).write_bytes(compressed[offset:offset + 16 * 1024 * 1024])
    parts.append('assets/' + name)
manifest = {'source': source.name, 'geometry': {'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'compressed_sha256': hashlib.sha256(compressed).hexdigest(),
            'parts': parts}, 'original_blend_sha256': source_hash}
(assets / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Packed {len(raw)} geometry bytes into {len(parts)} parts.')
