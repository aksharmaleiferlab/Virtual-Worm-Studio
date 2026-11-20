import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import runtime
import server


class RuntimeTests(unittest.TestCase):
    def test_assets_recover_corrupt_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            path = runtime.prepare_geometry(directory)
            spec = json.loads((runtime.ROOT / 'assets/manifest.json').read_text())['geometry']
            self.assertEqual(path.stat().st_size, spec['bytes'])
            self.assertEqual(runtime.sha256(path), spec['sha256'])
            path.write_bytes(b'broken cache')
            self.assertEqual(runtime.sha256(runtime.prepare_geometry(directory)), spec['sha256'])

    def test_settings_preserve_model_when_export_folder_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            runtime.update_settings(directory, {'blender_path': 'example', 'model_path': 'worm.blend'})
            runtime.update_settings(directory, {'export_directory': directory})
            self.assertEqual(runtime.read_settings(directory)['blender_path'], 'example')
            self.assertEqual(runtime.read_settings(directory)['model_path'], 'worm.blend')

    def test_explicit_blender_and_model_with_spaces(self):
        with tempfile.TemporaryDirectory(prefix='worm test ') as directory:
            executable = Path(directory) / ('blender.exe' if os.name == 'nt' else 'blender')
            executable.write_text('test fixture')
            model = Path(directory) / runtime.MODEL_NAME
            model.write_bytes(b'BLENDER-v249')
            settings = {'blender_path': str(executable), 'model_path': str(model)}
            self.assertEqual(runtime.resolve_blender(settings), executable.resolve())
            self.assertEqual(runtime.resolve_model(settings, directory), model.resolve())

    def test_macos_app_path_resolution(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / 'Blender.app'
            binary = app / 'Contents/MacOS/Blender'
            binary.parent.mkdir(parents=True)
            binary.touch()
            self.assertEqual(runtime.resolve_blender({'blender_path': str(app)}), binary.resolve())

    def test_export_names_work_on_windows_and_unix(self):
        for name in ['../escape.png', 'CON.png', 'LPT1.csv', 'x:y.png', 'x?y.png', 'x*.png', '.secret.json', 'x.png ', 'x.exe']:
            with self.subTest(name=name), self.assertRaises(ValueError):server.validate_filename(name)
        with tempfile.TemporaryDirectory() as directory:
            one = server.save_unique('Figure 1.png', b'one', Path(directory))
            two = server.save_unique('Figure 1.png', b'two', Path(directory))
            self.assertEqual(one.read_bytes(), b'one')
            self.assertEqual(two.name, 'Figure 1_1.png')


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.geometry = Path(cls.temp.name) / 'fixture.bin'
        cls.geometry.write_bytes(b'anatomy-test')
        cls.httpd = server.create_server(cls.temp.name, cls.geometry)
        cls.url = 'http://127.0.0.1:' + str(cls.httpd.server_port)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown();cls.httpd.server_close();cls.thread.join();cls.temp.cleanup()

    def request(self, path, data=None, token=True, extra_headers=None):
        headers = {'Content-Type': 'application/json'}
        if token:headers['X-Worm-Token'] = server.TOKEN
        headers.update(extra_headers or {})
        body = json.dumps(data).encode() if data is not None else None
        return urlopen(Request(self.url + path, body, headers), timeout=10)

    def test_geometry_route_and_javascript_mime(self):
        with self.request('/model.bin') as response:self.assertEqual(response.read(), b'anatomy-test')
        with self.request('/app.js') as response:self.assertEqual(response.headers.get_content_type(), 'application/javascript')

    def test_session_and_origin_checks(self):
        with self.assertRaises(HTTPError) as error:self.request('/api/settings', {'export_directory': self.temp.name}, token=False)
        self.assertEqual(error.exception.code, 403)
        error.exception.close()
        with self.assertRaises(HTTPError) as error:self.request('/api/save?name=test.png', {}, extra_headers={'Origin': 'https://example.org'})
        self.assertEqual(error.exception.code, 403)
        error.exception.close()
        with self.assertRaises(HTTPError) as error:self.request('/api/settings', extra_headers={'Host': 'example.org'})
        self.assertEqual(error.exception.code, 403)
        error.exception.close()

    def test_optional_blender_failure_explains_setup(self):
        with patch.dict(os.environ, {'VWS_MODEL': ''}):
            with self.assertRaises(HTTPError) as error:self.request('/api/export-blend', {'names': ['Cuticle'], 'filename': 'worm.blend'})
        self.assertEqual(error.exception.code, 400)
        self.assertIn('original .blend', error.exception.read().decode())
        error.exception.close()

    def test_model_setup_survives_folder_change(self):
        model = Path(self.temp.name) / runtime.MODEL_NAME
        binary = Path(self.temp.name) / 'fake blender executable'
        model.write_bytes(b'BLENDER-v249');binary.touch()
        try:
            with self.request('/api/model-config', {'model_path': str(model), 'blender_path': str(binary)}) as response:
                status = json.load(response)
            self.assertTrue(status['model_available']);self.assertTrue(status['blender_available'])
            with self.request('/api/settings', {'export_directory': self.temp.name}):pass
            settings = runtime.read_settings(self.temp.name)
            self.assertEqual(settings['model_path'], str(model))
            self.assertEqual(settings['blender_path'], str(binary))
        finally:
            with self.request('/api/model-config', {'model_path': '', 'blender_path': ''}):pass
            model.unlink(missing_ok=True);binary.unlink(missing_ok=True)

    def test_settings_and_exports(self):
        folder = Path(self.temp.name) / 'figures with spaces'
        with self.request('/api/settings', {'export_directory': str(folder)}):pass
        with self.request('/api/save?name=Figure.png', {'example': 1}) as response:
            saved = json.load(response)
        self.assertEqual(Path(saved['path']).parent, folder)
        with self.request('/api/settings') as response:
            settings = json.load(response)
        self.assertEqual(settings['export_directory'], str(folder))
        self.assertEqual(settings['token'], server.TOKEN)


if __name__ == '__main__':unittest.main()
