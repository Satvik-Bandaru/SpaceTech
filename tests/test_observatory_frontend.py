import json
from pathlib import Path
import shutil
import subprocess
import unittest

from spacecraft_lab.advisory import economy_assessment, engineering_assessment
from spacecraft_lab.observatory import run_observatory


class ObservatoryFrontendTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node needed for observation UI checks')
    def test_ui_with_actual_simulation_and_advisory_results(self):
        root = Path(__file__).resolve().parents[1]
        payload = {
            'report': run_observatory({}),
            'empty': run_observatory({'capture_budget': 0}),
            'engineering': engineering_assessment({}),
            'economy': economy_assessment({}),
        }
        result = subprocess.run(
            ['node', 'tests/observatory-frontend.cjs'], cwd=root,
            input=json.dumps(payload, allow_nan=False), capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
