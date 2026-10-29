import json
from pathlib import Path
import tempfile
import unittest

from spacecraft_lab.assurance.workflow import WorkflowStore
from spacecraft_lab.assurance.runner import run_assurance

ROOT=Path(__file__).resolve().parents[1]


class AssuranceAcceptance(unittest.TestCase):
    def test_connected_solar_fault_rejection_recovery_replay_export(self):
        scenario=json.loads((ROOT/'scenarios/assurance_solar_thermal.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'jobs.sqlite')
            job=store.prepare(scenario,{'probe_unsafe':True})
            self.assertEqual(job['status'],'PREPARED')
            store.approve(job['job_id'],job['plan_sha256'],background=False)
            completed=store.get(job['job_id'],include_result=True)
            self.assertEqual(completed['status'],'COMPLETE')
            report=completed['result']
            solar=[e for e in report['events'] if e['event']=='FAULT_DETECTED' and e.get('fault')=='solar_array_loss']
            self.assertTrue(solar)
            self.assertLess(report['telemetry'][0]['solar_w'],scenario.get('solar_generation_w',180))
            rejected=[d for d in report['assurance']['decisions'] if not d['safety_check_result']['approved']]
            self.assertTrue(any(d['time_seconds']>=solar[0]['time_seconds'] and d['action']=='REQUEST_NORMAL_MODE' for d in rejected))
            isolation=next(d for d in report['assurance']['decisions'] if d['action']=='ISOLATE_HEATER' and d['execution_status']=='EXECUTED')
            self.assertTrue(isolation['safety_check_result']['approved'])
            self.assertEqual(isolation['observed_outcome']['status'],'ACHIEVED')
            dt=report['config']['dt_seconds'];row=report['telemetry'][isolation['time_seconds']//dt]
            self.assertTrue(row['heater_isolated'])
            self.assertEqual(report['scenario_sha256'],report['baseline']['scenario_sha256'])
            self.assertFalse(any(t['heater_isolated'] for t in report['baseline']['telemetry']))
            self.assertEqual(report,run_assurance(job['plan']['scenario'],job['plan']['options']))
            path=Path(folder)/'export.json';path.write_text(json.dumps(report,allow_nan=False))
            self.assertEqual(json.loads(path.read_text()),report)
            self.assertEqual(report['checks']['violations'],[])
            self.assertTrue(any(e['event']=='RETURN_TO_NORMAL' for e in report['events']))
            self.assertTrue(any(d['action']=='REQUEST_NORMAL_MODE' and d['execution_status']=='EXECUTED' for d in report['assurance']['decisions']))
            store.close()
