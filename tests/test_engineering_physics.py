import math
import unittest

from spacecraft_lab.engineering.config import engineering_config
from spacecraft_lab.engineering.physics import power_step, thermal_step, radiated_power


class ReferencePhysicsTests(unittest.TestCase):
    def test_discharge_efficiency_and_exact_balance(self):
        row = power_step(100, 200, 0, 60, 60, .9, .8, 100, 100)
        self.assertAlmostEqual(row['battery_wh'], 98.75)
        self.assertAlmostEqual(row['served_w'], 60)
        self.assertAlmostEqual(row['conversion_loss_wh'], .25)
        self.assertAlmostEqual(row['balance_residual_wh'], 0)

    def test_charge_efficiency_and_curtailment_at_capacity(self):
        row = power_step(199, 200, 200, 50, 60, .8, .9, 100, 100)
        self.assertEqual(row['battery_wh'], 200)
        self.assertAlmostEqual(row['curtailed_w'], 75)
        self.assertAlmostEqual(row['conversion_loss_wh'], .25)
        self.assertAlmostEqual(row['balance_residual_wh'], 0)

    def test_empty_battery_does_not_supply_fictional_load(self):
        row = power_step(0, 200, 10, 90, 60, .9, .9, 100, 50)
        self.assertEqual(row['served_w'], 10)
        self.assertEqual(row['unserved_w'], 80)
        self.assertEqual(row['battery_wh'], 0)

    def test_discharge_power_limit(self):
        row = power_step(100, 200, 0, 100, 60, 1, 1, 100, 40)
        self.assertEqual(row['served_w'], 40)
        self.assertEqual(row['unserved_w'], 60)

    def test_radiation_known_value_and_equilibrium(self):
        self.assertAlmostEqual(radiated_power(300, 0, 1, 1), 459.300327939, places=8)
        loss = radiated_power(300, 250, .7, .4)
        out = thermal_step(300, loss, 250, .7, .4, 20000, 10)
        self.assertEqual(out['temperature_k'], 300)
        self.assertAlmostEqual(out['balance_residual_j'], 0)

    def test_adiabatic_temperature_rise(self):
        out = thermal_step(300, 100, 250, 0, .4, 10000, 60)
        self.assertAlmostEqual(out['temperature_k'], 300.6)
        self.assertAlmostEqual(out['stored_heat_j'], 6000)

    def test_smaller_time_steps_converge(self):
        def integrate(dt):
            t = 300
            for _ in range(600 // dt):
                t = thermal_step(t, 65, 250, .7, .4, 20000, dt)['temperature_k']
            return t
        self.assertLess(abs(integrate(5)-integrate(1)), abs(integrate(60)-integrate(1)))

    def test_reject_malformed_or_unbounded_inputs(self):
        cases = [dict(seed=True), dict(dt_seconds=0), dict(duration_seconds=90000), dict(typo=2),
                 dict(charge_efficiency=0), dict(initial_temperature_k=float('nan')),
                 dict(faults=[dict(kind='heater_stuck_on', start_seconds=True, duration_seconds=60)]),
                 dict(faults=[{}]), dict(faults=[dict(kind='fake', start_seconds=0,duration_seconds=5)]),
                 dict(faults=[dict(kind='battery_leak',start_seconds=0,duration_seconds=5,severity=-1)]),
                 dict(faults=[dict(kind='comms_loss',start_seconds=7,duration_seconds=30)])]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(ValueError):
                engineering_config(value)

    def test_reference_equations_reject_nonphysical_numbers(self):
        with self.assertRaises(ValueError):
            power_step(100, 0, 0, 60, 60, .9, .8, 100, 100)
        with self.assertRaises(ValueError):
            thermal_step(300, 100, 250, .7, .4, 0, 10)
        with self.assertRaises(ValueError):
            radiated_power(-1, 0, .7, .4)

    def test_power_invariants_on_deterministic_grid(self):
        for energy in (0, 1, 50, 100):
            for solar in (0, 20, 100, 500):
                for demand in (0, 30, 150):
                    r = power_step(energy, 100, solar, demand, 10, .92, .88, 75, 80)
                    self.assertTrue(0 <= r['battery_wh'] <= 100)
                    self.assertLess(abs(r['balance_residual_wh']), 1e-12)
                    self.assertTrue(math.isclose(r['served_w']+r['unserved_w'], demand))
