from pathlib import Path
import json
import shutil
import subprocess
import unittest
from spacecraft_lab.reliability import run_strategy,STRATEGIES
from spacecraft_lab.assurance.runner import run_assurance


class FrontendTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node needed for frontend checks; no browser runtime dependency')
    def test_replay_and_scene_state_contract(self):
        root=Path(__file__).resolve().parents[1]
        result=subprocess.run(['node','tests/frontend.test.cjs'],cwd=root,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)

    @unittest.skipUnless(shutil.which('node'), 'Node needed for frontend checks')
    def test_real_dashboard_script_with_engine_reports(self):
        root=Path(__file__).resolve().parents[1]
        scenario={'duration_seconds':120,'seed':7,'faults':[{'kind':'heater_stuck_on','start_seconds':0,'duration_seconds':60}]}
        payload={'scenario':scenario,'reports':{s:run_strategy(scenario,s) for s in STRATEGIES}}
        payload['assured']=run_assurance({**scenario,'initial_battery_wh':40},{'probe_unsafe':True})
        result=subprocess.run(['node','tests/frontend-integration.cjs'],cwd=root,input=json.dumps(payload),capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
