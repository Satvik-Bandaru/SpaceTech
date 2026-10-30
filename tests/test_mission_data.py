import json
from pathlib import Path
import shutil
import subprocess
import unittest

from spacecraft_lab.assurance.runner import run_assurance
from spacecraft_lab.reliability import run_strategy


class MissionDataTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node needed for mission instrumentation checks')
    def test_instrumentation_with_actual_engine_reports(self):
        root = Path(__file__).resolve().parents[1]
        scenario = json.loads((root / 'scenarios/assurance_solar_thermal.json').read_text())
        payload = {
            'standard': run_strategy(scenario, 'basic'),
            'assured': run_assurance(scenario, {'probe_unsafe': True}),
        }
        result = subprocess.run(
            ['node', 'tests/mission-data.test.cjs', '--engine-reports'], cwd=root,
            input=json.dumps(payload, allow_nan=False), capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
