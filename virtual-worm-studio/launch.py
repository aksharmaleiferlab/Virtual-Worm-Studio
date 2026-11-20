#!/usr/bin/env python3
"""Start the offline viewer using only the Python standard library."""
import argparse
import json
import sys
import threading
import webbrowser
from pathlib import Path
import runtime


def main():
    parser = argparse.ArgumentParser(description='Virtual Worm Studio: local anatomical illustrations')
    parser.add_argument('--data-dir', type=Path, default=runtime.default_data_dir(), help='Writable settings/cache folder; also the initial export folder')
    parser.add_argument('--port', type=int, default=0, help='Local port, or 0 for an available port')
    parser.add_argument('--no-browser', action='store_true', help='Print the URL without opening a browser')
    parser.add_argument('--blender', help='Path to Blender executable (or Blender.app on macOS); saved locally')
    parser.add_argument('--model', help='Path to downloaded original February 2012 .blend file; saved locally')
    parser.add_argument('--doctor', action='store_true', help='Verify anatomy assets, report optional dependencies, and exit')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535')
    data_dir = args.data_dir.expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    changes = {}
    for key, value in [('blender_path', args.blender), ('model_path', args.model)]:
        if value:
            path = Path(value).expanduser().resolve()
            if not path.exists():
                parser.error('Path does not exist: ' + str(path))
            changes[key] = str(path)
    if changes:
        runtime.update_settings(data_dir, changes)
    geometry = runtime.prepare_geometry(data_dir)
    settings = runtime.read_settings(data_dir)
    blender = runtime.resolve_blender(settings)
    model = runtime.resolve_model(settings, data_dir)
    if args.doctor:
        print(json.dumps({'version': (runtime.ROOT / 'VERSION').read_text().strip(),
                          'python': sys.version.split()[0], 'data_directory': str(data_dir),
                          'geometry': str(geometry), 'geometry_verified': True,
                          'blender': str(blender) if blender else None,
                          'original_model': str(model) if model else None,
                          'blend_export_configured': bool(blender and model)}, indent=2))
        return 0
    import server
    httpd = server.create_server(data_dir, geometry, args.port)
    url = 'http://127.0.0.1:' + str(httpd.server_port)
    print('Virtual Worm Studio ' + (runtime.ROOT / 'VERSION').read_text().strip())
    print('Local viewer: ' + url, flush=True)
    print('Export folder: ' + str(server.EXPORT_DIR), flush=True)
    print('Keep this terminal open. Press Ctrl+C here to quit.', flush=True)
    if not (blender and model):
        print('Optional .blend export: configure Blender and the original file in Model & Blender setup.', flush=True)
    if not args.no_browser:
        threading.Thread(target=webbrowser.open, args=(url,), daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping Virtual Worm Studio.')
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print('Startup error: ' + str(error), file=sys.stderr)
        print('Extract into a writable folder or use --data-dir with a writable folder.', file=sys.stderr)
        raise SystemExit(1)
