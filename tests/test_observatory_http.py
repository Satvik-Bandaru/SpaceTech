"""Same-origin observation capture, saved evidence and advisory boundaries."""
import json
from pathlib import Path
import tempfile
import threading
import unittest
import http.client

from spacecraft_lab.control_center import create_server


class ObservatoryHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.server = create_server(0, workflow_path=Path(cls.folder.name) / 'jobs.sqlite')
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.folder.cleanup()

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection(*self.server.server_address, timeout=10)
        conn.request(method, path, None if data is None else json.dumps(data),
                     {'Content-Type': 'application/json', **(headers or {})})
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        conn.close()
        return result

    def test_capture_persist_restore_and_repeat(self):
        first = self.request('POST', '/api/observatory/run', {'config': {'seed': 7}})
        self.assertEqual(first[0], 200)
        report = json.loads(first[2])
        self.assertEqual(len(report['agents']), 5)
        self.assertGreater(report['metrics']['captures'], 0)
        self.assertEqual(first[2], self.request('POST', '/api/observatory/run', {'config': {'seed': 7}})[2])
        status, _, body = self.request('GET', '/api/observatory/history')
        self.assertEqual(status, 200)
        self.assertIn(report['run_id'], [r['run_id'] for r in json.loads(body)['runs']])
        restored = self.request('GET', '/api/observatory/reports/' + report['run_id'])
        self.assertEqual(restored[0], 200)
        self.assertEqual(json.loads(restored[2]), report)

    def test_bad_observation_requests_and_origin_fail_closed(self):
        for data in ({}, {'config': {}, 'shell': 'x'}, {'config': {'seed': True}},
                     {'config': {'steps': 121}}, {'config': {'enabled_agents': ['camera']}}):
            self.assertEqual(self.request('POST', '/api/observatory/run', data)[0], 400)
        self.assertEqual(self.request('POST', '/api/observatory/run', {'config': {}},
                                     {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('GET', '/api/observatory/reports/../../README.md')[0], 400)
        self.assertEqual(self.request('GET', '/api/observatory/reports/' + 'f' * 64)[0], 404)

    def test_advisory_reference_outputs_and_validation(self):
        status, _, raw = self.request('POST', '/api/advisory/engineering', {})
        self.assertEqual(status, 200)
        self.assertGreater(json.loads(raw)['delta_v_m_s'], 0)
        status, _, raw = self.request('POST', '/api/advisory/economy', {})
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(raw)['scenarios']), 3)
        for route in ('engineering', 'economy'):
            self.assertEqual(self.request('POST', '/api/advisory/' + route, {'unbounded': True})[0], 400)
            self.assertEqual(self.request('POST', '/api/advisory/' + route, [1])[0], 400)

    def test_observatory_assets_remain_local_and_nosniff(self):
        for path, mime in (('/observatory.js', 'text/javascript; charset=utf-8'),
                           ('/observatory.css', 'text/css; charset=utf-8')):
            status, headers, body = self.request('GET', path)
            self.assertEqual(status, 200)
            self.assertEqual(headers['Content-Type'], mime)
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
            self.assertGreater(len(body), 20)
