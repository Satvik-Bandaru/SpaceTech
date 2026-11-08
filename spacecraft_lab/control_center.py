"""Local-only presentation/API adapter; physics remains in engineering/."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import logging
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit,parse_qs

from .engineering.config import engineering_config
from .engineering.model import run_engineering
from .io import load_json
from .reliability import run_strategy, run_study, STRATEGIES
from .health_exchange import export_health
from .presets import presets
from .assurance.workflow import WorkflowStore
from .observatory import run_observatory
from .advisory import engineering_assessment, economy_assessment
from .observatory_records import ObservationRecords

ROOT = Path(__file__).resolve().parent.parent
WEB = Path(__file__).resolve().parent / 'web'
MAX_BODY = 256000


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key')
        result[key] = value
    return result


class Handler(BaseHTTPRequestHandler):
    server_version = 'SpacecraftLab/0.2'

    def log_message(self, *args):
        pass

    def send(self, status, content, mime='application/json'):
        if not isinstance(content, bytes):
            content = json.dumps(content, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(content)
        self.close_connection = True
        logging.getLogger('spacecraft.http').info(json.dumps({'method':self.command,'route':self.path[:100],'status':status,'response_bytes':len(content)}))

    def trusted(self):
        port = self.server.server_address[1]
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        origin = self.headers.get('Origin')
        if self.headers.get('Host') not in hosts or (origin and origin not in {f'http://{h}' for h in hosts}):
            self.send(403, {'error': 'Only this local application origin is accepted'})
            return False
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.send(403, {'error': 'Cross-site request refused'})
            return False
        return True

    def do_GET(self):
        if not self.trusted():
            return
        routes = {'/': ('index.html', 'text/html; charset=utf-8'),
                  '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
                  '/style.css': ('style.css', 'text/css; charset=utf-8'),
                  '/scene.js': ('scene.js', 'text/javascript; charset=utf-8'),
                  '/scene-model.js': ('scene-model.js', 'text/javascript; charset=utf-8'),
                  '/research.css': ('research.css', 'text/css; charset=utf-8'),
                  '/assurance.js': ('assurance.js', 'text/javascript; charset=utf-8'),
                  '/assurance.css': ('assurance.css', 'text/css; charset=utf-8'),
                  '/campaign.js': ('campaign.js', 'text/javascript; charset=utf-8'),
                  '/campaign.css': ('campaign.css', 'text/css; charset=utf-8'),
                  '/mission-control.js': ('mission-control.js', 'text/javascript; charset=utf-8'),
                  '/mission-data.js': ('mission-data.js', 'text/javascript; charset=utf-8'),
                  '/mission-control.css': ('mission-control.css', 'text/css; charset=utf-8'),
                  '/observatory.js': ('observatory.js', 'text/javascript; charset=utf-8'),
                  '/observatory.css': ('observatory.css', 'text/css; charset=utf-8'),
                  '/orbital-backdrop.svg': ('orbital-backdrop.svg', 'image/svg+xml'),
                  '/earth-horizon.png': ('earth-horizon.png', 'image/png'),
                  '/mli-material.png': ('mli-material.png', 'image/png'),
                  '/solar-material.png': ('solar-material.png', 'image/png'),
                  '/ui-core.js': ('ui-core.js', 'text/javascript; charset=utf-8')}
        if self.path in routes:
            name, mime = routes[self.path]
            self.send(200, (WEB / name).read_bytes(), mime)
        elif self.path == '/api/bootstrap':
            self.send(200, {'scenario': load_json(ROOT / 'scenarios/engineering_multifault.json'),
                            'max_samples': 2000, 'model_version': 'spacecraft-reference-v0.2', 'presets':presets()})
        elif self.path == '/api/observatory/history':
            try:
                self.send(200, self.server.observation_records.history())
            except OSError:
                self.send(503, {'error': 'Local observation store unavailable'})
        elif self.path.startswith('/api/observatory/reports/'):
            try:
                self.send(200, self.server.observation_records.get(self.path.split('/api/observatory/reports/', 1)[1]))
            except ValueError as exc:
                self.send(400, {'error': str(exc)})
            except FileNotFoundError:
                self.send(404, {'error': 'Saved observation mission not found'})
            except OSError:
                self.send(503, {'error': 'Saved observation record unavailable or corrupt'})
        elif urlsplit(self.path).path=='/api/jobs':
            try:
                query=parse_qs(urlsplit(self.path).query,keep_blank_values=True)
                if set(query)-{'limit'} or any(len(v)!=1 for v in query.values()):raise ValueError('History accepts one optional limit')
                limit=int(query.get('limit',['20'])[0])
                self.send(200,self.server.assurance_store().list_jobs(limit))
            except (ValueError,TypeError,KeyError) as exc:self.send(400,{'error':str(exc)})
            except (sqlite3.Error,OSError):self.send(503,{'error':'Local workflow store unavailable'})
        elif self.path.startswith('/api/assurance/jobs/'):
            parts=self.path.split('/')
            try:
                if len(parts) not in (5,6) or (len(parts)==6 and parts[5]!='result'):raise ValueError('Invalid job route')
                job=self.server.assurance_store().get(parts[4],include_result=len(parts)==6)
                if len(parts)==6:
                    if job['status']!='COMPLETE' or job['result'] is None:
                        self.send(409,{'error':'Job has no complete result','status':job['status']});return
                    self.send(200,job['result'])
                else:self.send(200,job)
            except (ValueError,TypeError,KeyError) as exc:self.send(400,{'error':str(exc)})
            except (sqlite3.Error,OSError):self.send(503,{'error':'Local workflow store unavailable'})
        else:
            self.send(404, {'error': 'Route not found'})

    def do_POST(self):
        if not self.trusted():
            return
        if self.path not in ('/api/run','/api/research/run','/api/research/study','/api/research/health','/api/assurance/prepare','/api/assurance/approve','/api/assurance/cancel','/api/campaigns/prepare','/api/observatory/run','/api/advisory/engineering','/api/advisory/economy'):
            self.send(404, {'error': 'Route not found'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY:
                self.send(413, {'error': 'JSON request must be 1–256000 bytes'})
                return
            if self.headers.get_content_type() != 'application/json':
                self.send(415, {'error': 'Use application/json'})
                return
            self.connection.settimeout(5)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Incomplete request')
            data = json.loads(raw, object_pairs_hook=unique_object,
                              parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
            if self.path == '/api/observatory/run':
                if not isinstance(data, dict) or set(data) != {'config'}:
                    raise ValueError('Observation requests require only config')
                report = run_observatory(data['config'])
                try:
                    self.server.observation_records.save(report)
                except OSError as exc:
                    self.send(503, {'error': str(exc)}); return
                self.send(200, report); return
            if self.path == '/api/advisory/engineering':
                self.send(200, engineering_assessment(data)); return
            if self.path == '/api/advisory/economy':
                self.send(200, economy_assessment(data)); return
            if self.path=='/api/campaigns/prepare':
                self.send(200,self.server.assurance_store().prepare_campaign(data));return
            allowed={'/api/run':{'scenario'},'/api/research/run':{'scenario'},
                     '/api/research/study':{'scenario','seeds'},'/api/research/health':{'scenario','strategy','mission_id','asset_id'},
                     '/api/assurance/prepare':{'scenario','options'},'/api/assurance/approve':{'job_id','plan_sha256'},
                     '/api/assurance/cancel':{'job_id'}}[self.path]
            if not isinstance(data, dict) or set(data) != allowed:
                raise ValueError('Unexpected or missing request fields')
            if self.path.startswith('/api/assurance/'):
                store=self.server.assurance_store()
                if self.path.endswith('/prepare'):
                    cfg=engineering_config(data['scenario'])
                    if cfg.duration_seconds//cfg.dt_seconds>2000:raise ValueError('Browser assurance plans allow <=2000 intervals per strategy')
                    result=store.prepare(data['scenario'],data['options'])
                elif self.path.endswith('/approve'):result=store.approve(data['job_id'],data['plan_sha256'])
                else:result=store.cancel(data['job_id'])
                self.send(200,result);return
            cfg = engineering_config(data['scenario'])
            if cfg.duration_seconds // cfg.dt_seconds > 2000:
                raise ValueError('Browser runs allow at most 2000 samples per policy; use the CLI for larger studies')
            if self.path=='/api/run':
                reports = {policy: run_engineering(cfg, policy) for policy in ('baseline', 'assisted')}
            elif self.path=='/api/research/run':
                reports = {s:run_strategy(data['scenario'],s) for s in STRATEGIES}
            elif self.path=='/api/research/study':
                seeds=data['seeds']
                if not isinstance(seeds,list) or len(seeds)>12 or len(seeds)*3*cfg.duration_seconds//cfg.dt_seconds>12000:
                    raise ValueError('Browser studies allow <=12 seeds and <=12000 aggregate engine intervals')
                reports=run_study(data['scenario'],seeds)
            else:
                reports=export_health(run_strategy(data['scenario'],data['strategy']),data['mission_id'],data['asset_id'])
            self.send(200, reports)
        except (ValueError, TypeError, KeyError, RecursionError, TimeoutError, OverflowError) as exc:
            self.send(400, {'error': str(exc)})
        except (sqlite3.Error,OSError):self.send(503,{'error':'Local workflow store unavailable'})


class LocalServer(HTTPServer):
    def assurance_store(self):
        if self.workflow is None:self.workflow=WorkflowStore(self.workflow_path)
        return self.workflow

    def server_close(self):
        if getattr(self,'workflow',None) is not None:self.workflow.close()
        super().server_close()

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address


def create_server(port=8014,workflow_path=None):
    # Serial server bounds compute concurrency for this personal local application.
    server = LocalServer(('127.0.0.1', port), Handler)
    server.timeout = 5
    server.workflow=None
    server.workflow_path=Path(workflow_path) if workflow_path else ROOT/'artifacts'/'assurance.sqlite'
    server.observation_records=ObservationRecords(server.workflow_path.parent/'observatory')
    return server


def main():
    logging.basicConfig(level=logging.INFO,format='%(message)s')
    parser = argparse.ArgumentParser(description='Local synthetic Spacecraft Health Control Center')
    parser.add_argument('--port', type=int, default=8014)
    args = parser.parse_args()
    try:
        server = create_server(args.port)
    except OSError as exc:
        parser.error(str(exc))
    print(f'Spacecraft Health Control Center: http://127.0.0.1:{server.server_address[1]}/', flush=True)
    print('SYNTHETIC / advisory only. Press Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
