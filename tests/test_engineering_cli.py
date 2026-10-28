import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from spacecraft_lab.engineering.benchmarks import paired_benchmark
from spacecraft_lab.io import load_json

ROOT=Path(__file__).resolve().parents[1]


class EngineeringWorkflowTests(unittest.TestCase):
    def test_benchmark_matches_scenarios_and_uses_identical_replay_samples(self):
        r=paired_benchmark(dict(duration_seconds=1200,faults=[dict(kind='heater_stuck_on',start_seconds=100,duration_seconds=500)]),[1,2,3])
        self.assertEqual(len(r['runs']),3)
        self.assertEqual(r,paired_benchmark(dict(duration_seconds=1200,faults=[dict(kind='heater_stuck_on',start_seconds=100,duration_seconds=500)]),[1,2,3]))
        for pair in r['runs']:
            self.assertEqual(pair['baseline']['scenario_sha256'],pair['assisted']['scenario_sha256'])
            self.assertEqual(pair['diagnostic_replay']['baseline']['samples'],pair['diagnostic_replay']['assisted']['samples'])
            self.assertEqual(pair['baseline']['violations'],[])
        self.assertEqual(r['summary']['baseline']['safe_mode_seconds']['n'],3)

    def test_training_seed_and_duplicate_evaluation_seeds_refused(self):
        with self.assertRaises(ValueError):paired_benchmark({},[9001])
        with self.assertRaises(ValueError):paired_benchmark({},[1,1])
        with self.assertRaises(ValueError):paired_benchmark({},[])

    def test_json_loader_rejects_duplicates_nonfinite_and_oversized_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input.json'
            for content in ['{"seed":1,"seed":2}','{"seed":NaN}','x'*300000]:
                p.write_text(content)
                with self.subTest(content=content[:30]),self.assertRaises(ValueError):load_json(p)

    def test_engineering_cli_generates_replayable_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            request=Path(tmp)/'request.json';out=Path(tmp)/'report.json'
            request.write_text(json.dumps(dict(duration_seconds=120,seed=7)))
            proc=subprocess.run([sys.executable,'run_engineering.py',str(request),'--policy','assisted','--out',str(out)],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(proc.returncode,0,proc.stderr)
            r=json.loads(out.read_text())
            self.assertEqual(r['schema_version'],'engineering-0.2')
            self.assertEqual(r['data_provenance'],'SYNTHETIC')
            self.assertFalse(r['model_validated_for_flight'])

    def test_legacy_cli_refuses_oversized_input_without_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input.json';out=Path(tmp)/'out.json'
            p.write_text('{"name":"'+'x'*300000+'"}')
            proc=subprocess.run([sys.executable,'sync_lunar_ops.py',str(p),'--out',str(out)],cwd=ROOT,capture_output=True,text=True)
            self.assertNotEqual(proc.returncode,0)
            self.assertFalse(out.exists())
            self.assertIn('256000',proc.stderr)
