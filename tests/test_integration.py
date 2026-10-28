import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from spacecraft_lab.integration import run_mission, read_mission

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "integrations/examples/lunar_ops_satellite_request.json"


class LunarOpsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def test_mission_contract_and_identifiers(self):
        req = read_mission(self.payload)
        self.assertEqual(req.mission_id, "lunar-ops-demo-001")
        self.assertEqual(req.asset_type, "orbital_relay")

    def test_deterministic_replay_and_hash(self):
        a = run_mission(self.payload)
        b = run_mission(copy.deepcopy(self.payload))
        self.assertEqual(a, b)
        self.assertEqual(a["source"], "spacecraft-reliability-lab")
        self.assertEqual(a["target"], "lunar-ops")
        self.assertEqual(a["result_status"], "COMPLETED")
        self.assertEqual(a["data_provenance"], "SYNTHETIC")
        self.assertFalse(a["model_validated_for_flight"])
        self.assertEqual(len(a["telemetry"]), 240)

    def test_relay_comms_and_eclipse_status(self):
        result = run_mission(self.payload)
        self.assertLess(result["metrics"]["comms_availability_pct"], 100)
        self.assertIn("SYNTHETIC_COMMS_INTERRUPTION", result["advisory_flags"])

    def test_rejects_unknown_and_forged_identity_fields(self):
        for extra in ["company_id", "role", "credentials", "force_execute"]:
            with self.subTest(extra=extra):
                payload = copy.deepcopy(self.payload)
                payload[extra] = "admin"
                with self.assertRaises(ValueError):
                    run_mission(payload)

    def test_version_target_and_context_validation(self):
        for field, value in [("schema_version", "2.0"), ("source", "some-other-app"), ("target", "lunar-ops")]:
            payload = copy.deepcopy(self.payload)
            payload[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                run_mission(payload)
        payload = copy.deepcopy(self.payload)
        payload["context"]["asset_type"] = "rover"
        with self.assertRaises(ValueError):
            run_mission(payload)

    def test_invalid_faults_and_units_fail_closed(self):
        payload = copy.deepcopy(self.payload)
        payload["scenario"]["battery_capacity_wh"] = "500 kWh"
        with self.assertRaises(ValueError):
            run_mission(payload)
        payload = copy.deepcopy(self.payload)
        payload["scenario"]["faults"] = [{"kind":"unknown", "start_minute": 0, "duration_minutes": 3}]
        with self.assertRaises(ValueError):
            run_mission(payload)

    def test_cli_success_generates_importable_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "response.json"
            proc = subprocess.run([sys.executable, "sync_lunar_ops.py", str(EXAMPLE), "--out", str(out)], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            report = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(report["mission_id"], "lunar-ops-demo-001")
            self.assertEqual(report, run_mission(self.payload))

    def test_cli_invalid_input_does_not_write_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            req = Path(tmp) / "invalid.json"
            out = Path(tmp) / "result.json"
            req.write_text('{"source":"lunar-ops"}', encoding="utf-8")
            proc = subprocess.run([sys.executable, "sync_lunar_ops.py", str(req), "--out", str(out)], cwd=ROOT, capture_output=True, text=True)
            self.assertNotEqual(proc.returncode, 0)
            self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
