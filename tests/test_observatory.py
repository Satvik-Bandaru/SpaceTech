import copy
import json
import math
import unittest

from spacecraft_lab.observatory import grover_probabilities, run_observatory


class ObservatoryTests(unittest.TestCase):
    def test_deterministic_five_instruments_capture_measured_novelty(self):
        config = {'seed': 7, 'steps': 24}
        saved = copy.deepcopy(config)
        first = run_observatory(config)
        self.assertEqual(config, saved)
        self.assertEqual(first, run_observatory(config))
        self.assertNotEqual(first['run_id'], run_observatory({'seed': 8})['run_id'])
        self.assertEqual(first['source'], 'SYNTHETIC')
        self.assertEqual(len(first['run_id']), 64)
        self.assertEqual(first['run_id'], first['config_sha256'])
        self.assertEqual(len(first['agents']), 5)
        self.assertEqual(first['metrics']['scans'], 120)
        self.assertGreater(first['metrics']['captures'], 0)
        self.assertEqual(first['metrics']['captures'], len(first['observations']))
        self.assertEqual(len(first['analysis']['findings']), len(first['observations']))
        seen = set()
        for observation in first['observations']:
            key = observation['agent_id'], observation['target_id']
            self.assertNotIn(key, seen)
            seen.add(key)
            self.assertGreaterEqual(observation['novelty_score'], first['config']['novelty_threshold'])
            self.assertTrue(observation['captured'])
            self.assertEqual(len(observation['image']), 16)
            self.assertTrue(all(len(row) == 16 for row in observation['image']))
            self.assertTrue(all(0 <= v <= 1 for row in observation['image'] for v in row))
            self.assertEqual(len(observation['spectrum']['reflectance']), 8)
        self.assertIn('SYNTHETIC', first['report_markdown'])
        self.assertIn('not', ' '.join(first['limitations']).lower())
        json.dumps(first, allow_nan=False)

    def test_budget_disabled_agents_and_no_capture_are_explicit(self):
        report = run_observatory({'capture_budget': 1, 'steps': 120})
        self.assertTrue(all(a['captures'] <= 1 for a in report['agents']))
        self.assertGreater(report['metrics']['budget_skips'], 0)
        self.assertEqual(sum(a['skipped_budget'] for a in report['agents']), report['metrics']['budget_skips'])
        empty = run_observatory({'enabled_agents': []})
        self.assertEqual(empty['metrics']['scans'], 0)
        self.assertEqual(empty['quantum']['status'], 'not_run')
        self.assertTrue(all(a['status'] == 'disabled' for a in empty['agents']))
        only = run_observatory({'enabled_agents': ['telescope'], 'capture_budget': 0})
        self.assertEqual(only['metrics']['scans'], 24)
        self.assertEqual(only['observations'], [])
        high = run_observatory({'novelty_threshold': 2})
        self.assertEqual(high['observations'], [])

    def test_strict_validation_bounds_and_no_arbitrary_tools(self):
        invalid = [None, [], {'seed': True}, {'seed': -1}, {'seed': 2**31}, {'seed': 10**400},
                   {'steps': 3}, {'steps': 121}, {'steps': 4.5},
                   {'novelty_threshold': float('nan')}, {'novelty_threshold': float('inf')},
                   {'novelty_threshold': .01}, {'novelty_threshold': True},
                   {'capture_budget': 121}, {'capture_budget': -1},
                   {'enabled_agents': ['telescope', 'telescope']},
                   {'enabled_agents': ['hardware']}, {'enabled_agents': 'all'},
                   {'enabled_agents': [[]]}, {'tool': 'shell'}]
        for config in invalid:
            with self.subTest(config=config), self.assertRaises(ValueError):
                run_observatory(config)

    def test_grover_matches_independent_analytic_probability(self):
        # N=8, one marked state, two iterations: sin²(5 asin(1/sqrt(8))).
        result = grover_probabilities([1, 0, 0, 0, 0, 0, 0, 0], .9)
        self.assertEqual(result['qubits'], 3)
        self.assertEqual(result['iterations'], 2)
        self.assertEqual(result['marked_indices'], [0])
        expected = math.sin(5 * math.asin(1 / math.sqrt(8))) ** 2
        self.assertAlmostEqual(result['probabilities'][0], expected, places=12)
        self.assertAlmostEqual(sum(result['probabilities']), 1, places=12)
        paired = grover_probabilities([1, 1, 0, 0, 0, 0, 0, 0], .9)
        self.assertEqual(paired['iterations'], 1)
        self.assertAlmostEqual(sum(paired['probabilities'][:2]), 1, places=12)
        for scores, threshold in [([0]*8, 1), ([1]*8, .5)]:
            result = grover_probabilities(scores, threshold)
            self.assertEqual(result['iterations'], 0)
            self.assertTrue(all(abs(p-.125) < 1e-12 for p in result['probabilities']))

    def test_quantum_report_preserves_classical_oracle_and_uncertainty(self):
        report = run_observatory({})
        quantum = report['quantum']
        self.assertEqual(quantum['status'], 'complete')
        self.assertEqual(len(quantum['probabilities']), 8)
        self.assertEqual(len(quantum['classical_scores']), 8)
        self.assertAlmostEqual(sum(v['probability'] for v in quantum['probabilities']), 1)
        self.assertIn(quantum['observation_id'], {o['id'] for o in report['observations']})
        self.assertTrue(any('speedup' in text for text in quantum['limitations']))
        self.assertTrue(any('confidence' in text for text in quantum['limitations']))

    def test_grover_rejects_nonfinite_and_invalid_values(self):
        for scores, threshold in [([1]*7, .5), ([1]*9, .5), ([True]*8, .5),
                                  ([float('nan')]*8, .5), ([1]*8, float('nan')),
                                  ([1]*8, True), ([2]*8, .5), ([1]*8, -1)]:
            with self.subTest(scores=scores, threshold=threshold), self.assertRaises(ValueError):
                grover_probabilities(scores, threshold)

    def test_agent_stream_is_independent_of_other_agents_enabled_state(self):
        all_agents = run_observatory({'seed': 13})
        isolated = run_observatory({'seed': 13, 'enabled_agents': ['infrared']})
        self.assertEqual([o for o in all_agents['observations'] if o['agent_id'] == 'infrared'],
                         isolated['observations'])
        self.assertEqual([e for e in all_agents['timeline'] if e['agent_id'] == 'infrared'],
                         isolated['timeline'])

    def test_varied_seed_scenarios_preserve_evidence_and_probability_invariants(self):
        for seed in range(10):
            with self.subTest(seed=seed):
                report = run_observatory({'seed': seed, 'steps': 4+seed*3,
                                         'capture_budget': seed % 4,
                                         'novelty_threshold': .05 + .08*seed})
                self.assertEqual(len(report['timeline']), report['metrics']['scans'])
                self.assertEqual(sum(e['event'] == 'captured' for e in report['timeline']),
                                 len(report['observations']))
                self.assertEqual(sum(e['event'] == 'budget_skipped' for e in report['timeline']),
                                 report['metrics']['budget_skips'])
                self.assertTrue(all(a['captures'] <= seed % 4 for a in report['agents']))
                json.dumps(report, allow_nan=False)
                if report['quantum']['status'] == 'complete':
                    self.assertAlmostEqual(sum(p['probability'] for p in report['quantum']['probabilities']), 1)


if __name__ == '__main__':
    unittest.main()
