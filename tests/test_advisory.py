"""Independent equation and boundary checks for bounded local advisory tools."""
import copy
import json
import math
import unittest

from spacecraft_lab.advisory import engineering_assessment, economy_assessment


class AdvisoryTests(unittest.TestCase):
    def test_engineering_reference_equations_and_provenance(self):
        report = engineering_assessment({
            'dry_mass_kg': 100, 'propellant_mass_kg': 100, 'isp_seconds': 300,
            'power_w': 120, 'eclipse_minutes': 30, 'battery_wh': 100,
            'usable_fraction': .8,
        })
        self.assertAlmostEqual(report['delta_v_m_s'], 9.80665 * 300 * math.log(2))
        self.assertEqual(report['required_eclipse_wh'], 60)
        self.assertEqual(report['battery_margin_wh'], 20)
        self.assertEqual(report['source'], 'SYNTHETIC / design inputs')
        self.assertIn('ideal', ' '.join(report['assumptions']).lower())
        self.assertIn('flight', ' '.join(report['limitations']).lower())

    def test_engineering_zero_propellant_and_battery_deficit(self):
        report = engineering_assessment({'propellant_mass_kg': 0, 'battery_wh': 0})
        self.assertEqual(report['delta_v_m_s'], 0)
        self.assertLess(report['battery_margin_wh'], 0)
        self.assertIn('deficit', report['assessment'].lower())

    def test_engineering_zero_eclipse_has_zero_energy(self):
        report = engineering_assessment({'eclipse_minutes': 0, 'battery_wh': 0})
        self.assertEqual(report['required_eclipse_wh'], 0)
        self.assertEqual(report['battery_margin_wh'], 0)

    def test_economy_discounted_cashflow_reference(self):
        report = economy_assessment({'initial_cost': 1000, 'annual_revenue': 500,
                                    'annual_operating_cost': 100, 'discount_rate': .1,
                                    'years': 3, 'downside_fraction': .2})
        rows = {row['name']: row for row in report['scenarios']}
        self.assertAlmostEqual(rows['Base']['npv'], -1000 + sum(400 / 1.1**year for year in (1, 2, 3)))
        self.assertEqual(rows['Downside']['annual_net_cash'], 280)
        self.assertEqual(rows['Upside']['annual_net_cash'], 520)
        self.assertLess(rows['Downside']['npv'], rows['Base']['npv'])
        self.assertLess(rows['Base']['npv'], rows['Upside']['npv'])
        self.assertIn('SYNTHETIC', report['source'])
        self.assertIn('nominal', ' '.join(report['assumptions']).lower())

    def test_zero_discount_and_no_sensitivity_are_well_defined(self):
        report = economy_assessment({'initial_cost': 200, 'annual_revenue': 60,
                                    'annual_operating_cost': 10, 'years': 4,
                                    'discount_rate': 0, 'downside_fraction': 0})
        self.assertEqual([row['npv'] for row in report['scenarios']], [0, 0, 0])

    def test_economy_recommendation_distinguishes_loss_and_sensitivity(self):
        poor = economy_assessment({'annual_revenue': 0})
        self.assertIn('negative', poor['recommendation'].lower())
        robust = economy_assessment({'initial_cost': 0, 'annual_revenue': 1000,
                                     'annual_operating_cost': 0})
        self.assertIn('positive', robust['recommendation'].lower())

    def test_strict_validation_rejects_bools_nonfinite_unknown_and_excessive(self):
        cases = [None, [], {'typo': 1}, {'dry_mass_kg': 0}, {'dry_mass_kg': True},
                 {'dry_mass_kg': 1e100}, {'isp_seconds': float('inf')},
                 {'power_w': float('nan')}, {'eclipse_minutes': -1},
                 {'usable_fraction': 0}, {'usable_fraction': 1.01},
                 {'battery_wh': -1}, {'propellant_mass_kg': '20'}]
        for data in cases:
            with self.subTest(data=data), self.assertRaises(ValueError):
                engineering_assessment(data)
        cases = [None, [], {'typo': 1}, {'initial_cost': True}, {'initial_cost': -1},
                 {'annual_revenue': float('nan')}, {'annual_operating_cost': float('inf')},
                 {'years': 0}, {'years': 31}, {'years': 2.5}, {'years': True},
                 {'discount_rate': -0.1}, {'discount_rate': 1.01},
                 {'downside_fraction': -1}, {'downside_fraction': 1.01},
                 {'initial_cost': 1e100}, {'annual_revenue': '100'}]
        for data in cases:
            with self.subTest(data=data), self.assertRaises(ValueError):
                economy_assessment(data)

    def test_calls_are_deterministic_do_not_mutate_and_serialize_finitely(self):
        for method, data in ((engineering_assessment, {'power_w': 55}),
                             (economy_assessment, {'years': 10})):
            original = copy.deepcopy(data)
            first = method(data)
            self.assertEqual(first, method(data))
            self.assertEqual(data, original)
            json.dumps(first, allow_nan=False)

    def test_admitted_boundaries_produce_finite_outputs(self):
        for mass in (0.001, 1000000):
            r = engineering_assessment({'dry_mass_kg': mass, 'propellant_mass_kg': 1000000,
                                        'isp_seconds': 10000, 'power_w': 10000000,
                                        'eclipse_minutes': 10080, 'battery_wh': 1000000000})
            self.assertTrue(math.isfinite(r['delta_v_m_s']))
            json.dumps(r, allow_nan=False)
        r = economy_assessment({'initial_cost': 1e12, 'annual_revenue': 1e12,
                                'annual_operating_cost': 1e12, 'years': 30,
                                'discount_rate': 1, 'downside_fraction': 1})
        json.dumps(r, allow_nan=False)


if __name__ == '__main__':
    unittest.main()
