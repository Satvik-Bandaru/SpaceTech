import json
import unittest
from pathlib import Path

from spacecraft_lab.simulator import Config, Fault, config_from_dict, run

ROOT = Path(__file__).resolve().parent.parent


class ScenarioTests(unittest.TestCase):
    def test_deterministic(self):
        config = Config(seed=20, sensor_noise_c=0.25)
        self.assertEqual(run(config), run(config))

    def test_different_seeds_change_sensor_noise(self):
        cfg = Config(initial_temp_c=45.0, sensor_noise_c=5.0, duration_minutes=50)
        self.assertNotEqual(run(Config(**{**cfg.__dict__, "seed": 1}))["events"],
                            run(Config(**{**cfg.__dict__, "seed": 2}))["events"])

    def test_nominal(self):
        result = run(Config())
        self.assertEqual(result["metrics"]["safe_mode_minutes"], 0)
        self.assertEqual(result["metrics"]["normal_operational_pct"], 100)

    def test_eclipse_triggers_safe_mode(self):
        sc = json.loads((ROOT / "scenarios/solar_eclipse.json").read_text())
        output = run(config_from_dict(sc))
        self.assertGreater(output["metrics"]["safe_mode_minutes"], 0)
        self.assertIn("ENTER_SAFE_MODE", [e["event"] for e in output["events"]])
        self.assertGreaterEqual(output["metrics"]["min_battery_pct"], 0)

    def test_comms_outage_detected_after_three_minutes(self):
        output = run(Config(duration_minutes=25, faults=(Fault("comms_loss", 3, 10),)))
        self.assertIn({"minute": 5, "event": "COMMS_LOSS_DETECTED"}, output["events"])
        self.assertEqual(output["metrics"]["comms_availability_pct"], 60.0)

    def test_attitude_fault_forces_safe_mode(self):
        output = run(Config(duration_minutes=30, faults=(Fault("attitude_fault", 4, 10),)))
        self.assertEqual(output["events"][0]["minute"], 4)
        self.assertEqual(output["events"][0]["event"], "ENTER_SAFE_MODE")

    def test_invalid_payloads_fail_closed(self):
        invalid = [
            {"duration_minutes": 0}, {"seed": "3"},
            {"battery_capacity_wh": -2}, {"initial_battery_wh": 9999},
            {"faults": [{"kind": "unknown", "start_minute": 0, "duration_minutes": 2}]},
            {"faults": [{"kind": "eclipse", "start_minute": 1000, "duration_minutes": 2}]},
            {"normal_load_w": "150"}, {"bad_key": 1},
        ]
        for data in invalid:
            with self.subTest(data=data), self.assertRaises((ValueError, TypeError)):
                config_from_dict(data)

    def test_battery_never_exceeds_limits(self):
        cfg = Config(battery_capacity_wh=200, initial_battery_wh=1, duration_minutes=500,
                     faults=(Fault("eclipse", 0, 200),))
        result = run(cfg)
        self.assertTrue(all(0 <= t["battery_wh"] <= 200 for t in result["telemetry"]))


if __name__ == "__main__":
    unittest.main()
