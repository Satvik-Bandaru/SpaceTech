"""Exercise the actual studio script with complete reports from the real engine."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from spacecraft_lab.campaigns import run_campaign


@unittest.skipUnless(shutil.which('node'), 'Node needed for frontend checks')
class CampaignFrontendTests(unittest.TestCase):
    def test_studio_with_real_campaign_reports(self):
        scenario = dict(duration_seconds=120, initial_battery_wh=40,
            faults=[dict(kind='heater_stuck_on', start_seconds=0, duration_seconds=60)])
        requests = [dict(name='Frontend paired test', scenario=scenario,
            variants=[dict(name='More solar', changes=dict(solar_generation_w=220))],
            seeds=[0, 1], strategies=strategies)
            for strategies in (['basic', 'assured'], ['enhanced', 'assured'])]
        requests.append(dict(name='Criteria must stay fixed',
            scenario=dict(duration_seconds=10, initial_temperature_k=340),
            variants=[dict(name='Relax own thermal limit', changes=dict(high_temperature_k=350))],
            seeds=[0, 1], strategies=['basic', 'assured']))
        for request in requests:
            with self.subTest(name=request['name'], strategies=request['strategies']):
                result = run_campaign(request)
                process = subprocess.run(['node', 'tests/campaign-frontend.cjs', '--fixture'],
                    cwd=Path(__file__).resolve().parents[1], input=json.dumps(result),
                    text=True, capture_output=True, timeout=30)
                self.assertEqual(process.returncode, 0, process.stdout + process.stderr)
                self.assertIn('Engine-backed Counterfactual Studio', process.stdout)
