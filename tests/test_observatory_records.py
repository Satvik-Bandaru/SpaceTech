import json
from pathlib import Path
import tempfile
import unittest

from spacecraft_lab.observatory_records import ObservationRecords


class ObservationRecordsTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'observations'
        self.store = ObservationRecords(self.path)

    def report(self, digit='a'):
        return {'schema_version': 'observatory-1.0', 'run_id': digit * 64,
                'config': {'seed': 7}, 'metrics': {'captures': 2},
                'source': 'SYNTHETIC', 'observations': []}

    def test_durable_restore_and_dedup(self):
        report = self.report()
        self.store.save(report)
        self.store.save(report)
        restored = ObservationRecords(self.path)
        self.assertEqual(restored.get(report['run_id']), report)
        self.assertEqual(len(restored.history()['runs']), 1)
        self.assertEqual(restored.history()['runs'][0]['config'], report['config'])

    def test_existing_run_identity_cannot_silently_replace_evidence(self):
        report = self.report()
        self.store.save(report)
        changed = {**report, 'metrics': {'captures': 999}}
        with self.assertRaises(ValueError):
            self.store.save(changed)
        self.assertEqual(self.store.get(report['run_id']), report)

    def test_path_and_integrity_guards(self):
        for invalid in ('../config', 'a' * 63, 'A' * 64):
            with self.assertRaises(ValueError):
                self.store.get(invalid)
        self.store.save(self.report())
        target = self.path / ('a' * 64 + '.json')
        body = json.loads(target.read_text())
        body['report']['metrics']['captures'] = 999
        target.write_text(json.dumps(body))
        with self.assertRaises(OSError):
            self.store.get('a' * 64)
        self.assertEqual(self.store.history()['unreadable_records'], ['a' * 64])

    def test_capacity_preserves_prior_reports_and_finite_serialization(self):
        store = ObservationRecords(self.path, max_records=1)
        store.save(self.report())
        with self.assertRaises(OSError):
            store.save(self.report('b'))
        self.assertEqual(store.get('a' * 64), self.report())
        bad = self.report()
        bad['metrics']['captures'] = float('nan')
        with self.assertRaises(ValueError):
            store.save(bad)
        self.assertEqual(store.get('a' * 64), self.report())

    def test_missing_record_and_invalid_identity(self):
        with self.assertRaises(FileNotFoundError):
            self.store.get('f' * 64)
        with self.assertRaises(ValueError):
            self.store.save({**self.report(), 'run_id': '../../other'})

    def test_dangling_record_is_reported_without_disabling_valid_records(self):
        self.store.save(self.report())
        (self.path / ('c' * 64 + '.json')).symlink_to(self.path / 'missing.json')
        self.assertEqual(self.store.history()['unreadable_records'], ['c' * 64])
        self.store.save(self.report('b'))
        self.assertEqual(len(self.store.history()['runs']), 2)

    def test_symbolic_store_root_fails_closed(self):
        elsewhere = Path(self.folder.name) / 'elsewhere'
        elsewhere.mkdir()
        self.path.symlink_to(elsewhere, target_is_directory=True)
        for operation in (lambda: self.store.save(self.report()), self.store.history,
                          lambda: self.store.get('a' * 64)):
            with self.assertRaises(OSError):
                operation()
        self.assertEqual(list(elsewhere.iterdir()), [])
