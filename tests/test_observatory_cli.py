import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from spacecraft_lab.io import load_json
from spacecraft_lab.observatory import run_observatory


class ObservatoryCLITests(unittest.TestCase):
    def test_saved_report_matches_pure_engine(self):
        root = Path(__file__).resolve().parents[1]
        config = root / 'scenarios/observatory_survey.json'
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'captured.json'
            result = subprocess.run([sys.executable, 'observe.py', str(config), '--out', str(output)],
                                    cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(output.read_text()), run_observatory(load_json(config)))
            self.assertIn('SYNTHETIC', result.stdout)

    def test_invalid_config_does_not_write_a_report(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            config, output = Path(folder) / 'bad.json', Path(folder) / 'result.json'
            config.write_text('{"steps": 999999}')
            result = subprocess.run([sys.executable, 'observe.py', str(config), '--out', str(output)],
                                    cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())
