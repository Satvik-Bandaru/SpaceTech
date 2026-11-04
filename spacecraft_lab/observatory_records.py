"""Bounded completed synthetic capture reports; independent of assurance storage."""
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

MAX_REPORT_BYTES = 8_000_000
MAX_STORE_BYTES = 64_000_000


def _identity(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-f0-9]{64}', value):
        raise ValueError('Invalid observation run ID')
    return value


def _encode(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


class ObservationRecords:
    """Content digests detect damage, not identity. Serial server, no multi-writer support.

    Capacity fails closed without deleting saved reports. Atomic completed-file writes
    are not a promise of crash-proof or continuously streaming instrument storage.
    """
    def __init__(self, folder, max_records=20):
        self.folder = Path(folder)
        self.max_records = max_records

    def _files(self):
        self._check_folder()
        if not self.folder.exists():
            return []
        return [p for p in self.folder.glob('*.json') if re.fullmatch(r'[a-f0-9]{64}', p.stem)]

    def _check_folder(self):
        if self.folder.is_symlink():
            raise OSError('Observation store directory must not be a symbolic link')

    def save(self, report):
        if not isinstance(report, dict) or report.get('schema_version') != 'observatory-1.0':
            raise ValueError('Only completed observatory reports are accepted')
        run_id = _identity(report.get('run_id'))
        body = _encode(report)
        envelope = _encode({'report': report, 'report_sha256': hashlib.sha256(body).hexdigest()})
        if len(envelope) > MAX_REPORT_BYTES:
            raise ValueError('Observation report exceeds 8 MB capacity')
        self._check_folder()
        self.folder.mkdir(parents=True, exist_ok=True)
        target = self.folder / (run_id + '.json')
        files = self._files()
        if target.is_symlink():
            raise OSError('Observation record path must not be a symbolic link')
        if target.exists():
            if _encode(self.get(run_id)) != body:
                raise ValueError('Run ID already binds different saved evidence; use a new model version')
            return
        if not target.exists() and len(files) >= self.max_records:
            raise OSError('Observation store full; export/archive records before adding missions')
        others = sum(p.lstat().st_size for p in files if p != target)
        if others + len(envelope) > MAX_STORE_BYTES:
            raise OSError('Observation store exceeds 64 MB capacity')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=self.folder, prefix='.capture-', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(envelope)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def get(self, run_id):
        run_id = _identity(run_id)
        self._check_folder()
        path = self.folder / (run_id + '.json')
        if path.is_symlink():
            raise OSError('Observation record path must not be a symbolic link')
        if path.stat().st_size > MAX_REPORT_BYTES:
            raise OSError('Saved observation exceeds report capacity')
        try:
            envelope = json.loads(path.read_bytes())
            report = envelope['report']
            if (report.get('run_id') != run_id or report.get('schema_version') != 'observatory-1.0'
                    or hashlib.sha256(_encode(report)).hexdigest() != envelope['report_sha256']):
                raise ValueError('Saved observation digest mismatch')
            return report
        except (ValueError, TypeError, KeyError, AttributeError, RecursionError) as exc:
            raise OSError('Saved observation record failed integrity validation') from exc

    def history(self):
        runs, unreadable = [], []
        files = sorted(self._files(), key=lambda p: p.lstat().st_mtime_ns, reverse=True)
        for path in files[:self.max_records]:
            try:
                report = self.get(path.stem)
                runs.append({k: report[k] for k in ('run_id', 'config', 'metrics')})
            except (OSError, KeyError):
                unreadable.append(path.stem)
        return {'runs': runs, 'unreadable_records': unreadable,
                'capacity': self.max_records, 'max_bytes': MAX_STORE_BYTES}
