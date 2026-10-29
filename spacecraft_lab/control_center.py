"""Local-only presentation/API adapter; physics remains in engineering/."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import logging
from pathlib import Path

from .engineering.config import engineering_config
from .engineering.model import run_engineering
from .io import load_json
from .reliability import run_strategy, run_study, STRATEGIES
from .health_exchange import export_health
from .presets import presets

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
                  '/research.css': ('research.css', 'text/css; charset=utf-8'),
                  '/ui-core.js': ('ui-core.js', 'text/javascript; charset=utf-8')}
        if self.path in routes:
            name, mime = routes[self.path]
            self.send(200, (WEB / name).read_bytes(), mime)
        elif self.path == '/api/bootstrap':
            self.send(200, {'scenario': load_json(ROOT / 'scenarios/engineering_multifault.json'),
                            'max_samples': 2000, 'model_version': 'spacecraft-reference-v0.2', 'presets':presets()})
        else:
            self.send(404, {'error': 'Route not found'})

    def do_POST(self):
        if not self.trusted():
            return
        if self.path not in ('/api/run','/api/research/run','/api/research/study','/api/research/health'):
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
            allowed={'/api/run':{'scenario'},'/api/research/run':{'scenario'},
                     '/api/research/study':{'scenario','seeds'},'/api/research/health':{'scenario','strategy','mission_id','asset_id'}}[self.path]
            if not isinstance(data, dict) or set(data) != allowed:
                raise ValueError('Unexpected or missing request fields')
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


class LocalServer(HTTPServer):
    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address


def create_server(port=8014):
    # Serial server bounds compute concurrency for this personal local application.
    server = LocalServer(('127.0.0.1', port), Handler)
    server.timeout = 5
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
