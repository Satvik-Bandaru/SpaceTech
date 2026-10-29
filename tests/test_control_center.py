import http.client
import json
import socket
import threading
import tempfile
import time
from pathlib import Path
import unittest

from spacecraft_lab.control_center import create_server


class ControlCenterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder=tempfile.TemporaryDirectory()
        cls.server = create_server(0,workflow_path=Path(cls.folder.name)/'jobs.sqlite')
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.folder.cleanup()

    def request(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        body = json.dumps(data) if data is not None else None
        h = {'Content-Type': 'application/json', **(headers or {})}
        connection.request(method, path, body, h)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_static_routes_are_explicit_and_protected(self):
        status, headers, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'Spacecraft Health', body)
        self.assertIn("default-src 'self'", headers['Content-Security-Policy'])
        for path in ('/app.js','/style.css','/scene.js','/ui-core.js','/assurance.js','/assurance.css'):
            self.assertEqual(self.request('GET', path)[0], 200)
        for path in ('/../AGENTS.md', '/spacecraft_lab/model.py', '/unknown'):
            self.assertEqual(self.request('GET', path)[0], 404)

    def test_bootstrap_and_run_use_real_engine_reproducibly(self):
        status, _, raw = self.request('GET', '/api/bootstrap')
        self.assertEqual(status, 200)
        scenario = json.loads(raw)['scenario']
        scenario.update(duration_seconds=60, faults=[])
        payload = {'scenario': scenario}
        first = self.request('POST', '/api/run', payload)
        self.assertEqual(first[0], 200)
        result = json.loads(first[2])
        self.assertEqual(result['baseline']['scenario_sha256'], result['assisted']['scenario_sha256'])
        self.assertEqual(len(result['baseline']['telemetry']), 6)
        self.assertFalse(result['baseline']['checks']['violations'])
        self.assertEqual(first[2], self.request('POST', '/api/run', payload)[2])

    def test_bad_and_expensive_scenarios_fail_closed(self):
        for scenario in ({'unknown': 1}, {'seed': True}, {'duration_seconds': 21600, 'dt_seconds': 1}, {'normal_load_w': 10**400}):
            self.assertEqual(self.request('POST', '/api/run', {'scenario': scenario})[0], 400)
        self.assertEqual(self.request('POST', '/api/run', {'scenario': {}, 'arbitrary': 1})[0], 400)
        self.assertEqual(self.request('POST', '/api/run', {'scenario': {}, 'padding': 'x'*256001})[0], 413)

    def test_reject_cross_origin_and_untrusted_host(self):
        self.assertEqual(self.request('GET', '/', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/run', {'scenario': {}}, {'Origin': 'https://evil.example'})[0], 403)
        origin = f'http://127.0.0.1:{self.port}'
        self.assertEqual(self.request('POST', '/api/run', {'scenario': {'duration_seconds': 60}}, {'Origin': origin})[0], 200)

    def test_duplicate_json_keys_rejected(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.port)
        connection.request('POST', '/api/run', '{"scenario":{},"scenario":{}}', {'Content-Type': 'application/json'})
        response = connection.getresponse()
        self.assertEqual(response.status, 400)
        response.read()
        connection.close()

    def test_accepted_connections_have_header_read_deadline(self):
        server = create_server(0)
        try:
            with socket.create_connection(server.server_address) as client:
                accepted, _ = server.get_request()
                try:
                    self.assertEqual(accepted.gettimeout(), 5)
                finally:
                    accepted.close()
        finally:
            server.server_close()

    def test_research_routes_run_study_and_health_exchange(self):
        data={'scenario':{'duration_seconds':120,'seed':3}}
        status,_,raw=self.request('POST','/api/research/run',data)
        self.assertEqual(status,200)
        reports=json.loads(raw)
        self.assertEqual(set(reports),{'none','basic','enhanced'})
        status,_,raw=self.request('POST','/api/research/study',{**data,'seeds':[1,2,3]})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(raw)['summary']['basic']['safe_mode_seconds']['n'],3)
        status,_,raw=self.request('POST','/api/research/health',{**data,'strategy':'basic','mission_id':'demo','asset_id':'relay'})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(raw)['schema_version'],'2.0')
        self.assertEqual(self.request('POST','/api/research/study',{**data,'seeds':list(range(13))})[0],400)
        self.assertEqual(self.request('POST','/api/research/study',{'scenario':{'dt_seconds':1,'duration_seconds':2000},'seeds':[1,2,3]})[0],400)

    def test_assurance_requires_explicit_plan_approval(self):
        status,_,raw=self.request('POST','/api/assurance/prepare',{'scenario':{'duration_seconds':120},'options':{'probe_unsafe':True}})
        self.assertEqual(status,200)
        job=json.loads(raw);self.assertEqual(job['status'],'PREPARED')
        self.assertEqual(self.request('POST','/api/assurance/approve',{'job_id':job['job_id'],'plan_sha256':'forged'})[0],400)
        self.assertEqual(self.request('GET',f"/api/assurance/jobs/{job['job_id']}")[0],200)
        self.assertEqual(self.request('POST','/api/assurance/cancel',{'job_id':job['job_id']})[0],200)
        self.assertEqual(self.request('GET',f"/api/assurance/jobs/{job['job_id']}/result")[0],409)
        self.assertEqual(self.request('GET','/api/assurance/jobs/invalid')[0],400)

    def test_background_assurance_run_returns_real_complete_evidence(self):
        status,_,raw=self.request('POST','/api/assurance/prepare',{'scenario':{'duration_seconds':180,'initial_battery_wh':40},'options':{'probe_unsafe':True}})
        self.assertEqual(status,200);job=json.loads(raw)
        status,_,_=self.request('POST','/api/assurance/approve',{'job_id':job['job_id'],'plan_sha256':job['plan_sha256']})
        self.assertEqual(status,200)
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            _,_,raw=self.request('GET',f"/api/assurance/jobs/{job['job_id']}")
            state=json.loads(raw)
            if state['status'] in ('COMPLETE','FAILED','CANCELLED'):break
            time.sleep(.005)
        self.assertEqual(state['status'],'COMPLETE',state.get('error'))
        status,_,raw=self.request('GET',f"/api/assurance/jobs/{job['job_id']}/result")
        self.assertEqual(status,200);report=json.loads(raw)
        self.assertEqual(len(report['telemetry']),18)
        self.assertTrue(any(not d['safety_check_result']['approved'] for d in report['assurance']['decisions']))
        self.assertFalse(report['checks']['violations'])
