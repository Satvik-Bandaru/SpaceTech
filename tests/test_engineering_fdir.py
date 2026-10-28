import copy
import unittest

from spacecraft_lab.engineering.diagnostics import fit_signature_model, Diagnoser
from spacecraft_lab.engineering.controller import SafeManager
from spacecraft_lab.engineering.model import run_engineering, check_report
from spacecraft_lab.engineering.config import engineering_config
from spacecraft_lab.engineering.benchmarks import replay_diagnostics


HEALTHY = dict(battery_pct=70,temperature_k=293.15,pointing_error_deg=0,comms_up=True,unserved_w=0)


class FDIRTests(unittest.TestCase):
    def test_calibration_is_reproducible_and_does_not_consume_fault_truth(self):
        a=fit_signature_model(9001)
        self.assertEqual(a,fit_signature_model(9001))
        self.assertNotEqual(a,fit_signature_model(9002))
        d=Diagnoser('assisted',a)
        features=dict(solar_array_loss=.8,heater_stuck_on=100,comms_loss=0,attitude_fault=0,battery_leak=0)
        alarms=set()
        for _ in range(3):
            alarms=d.observe(features,10)
        self.assertIn('solar_array_loss',alarms)
        self.assertIn('heater_stuck_on',alarms)
        self.assertNotIn('comms_loss',alarms)
        with self.assertRaises(ValueError):
            d.observe({**features,'active_faults':['heater_stuck_on']},10)

    def test_persistence_rejects_a_single_transient(self):
        d=Diagnoser('baseline',fit_signature_model())
        high=dict(solar_array_loss=0,heater_stuck_on=100,comms_loss=0,attitude_fault=0,battery_leak=0)
        self.assertEqual(d.observe(high,10),set())
        self.assertEqual(d.observe({k:0 for k in high},10),set())

    def test_safe_mode_hysteresis_and_consecutive_recovery(self):
        m=SafeManager(263.15,333.15,recovery_seconds=30)
        self.assertEqual(m.update({**HEALTHY,'battery_pct':20},set(),10)[0],'safe')
        for _ in range(5):
            self.assertEqual(m.update({**HEALTHY,'battery_pct':30},set(),10)[0],'safe')
        self.assertEqual(m.update(HEALTHY,set(),10)[0],'safe')
        self.assertEqual(m.update({**HEALTHY,'comms_up':False},set(),10)[0],'safe')
        self.assertEqual(m.update(HEALTHY,set(),10)[0],'safe')
        self.assertEqual(m.update(HEALTHY,set(),10)[0],'safe')
        self.assertEqual(m.update(HEALTHY,set(),10)[0],'normal')

    def test_held_out_run_is_repeatable_and_preserves_request(self):
        cfg=dict(seed=7,duration_seconds=1200,faults=[dict(kind='heater_stuck_on',start_seconds=100,duration_seconds=600)])
        before=copy.deepcopy(cfg)
        for policy in ('baseline','assisted'):
            self.assertEqual(run_engineering(cfg,policy),run_engineering(cfg,policy))
        self.assertEqual(cfg,before)

    def test_overlapping_faults_and_actuator_recovery(self):
        cfg=dict(duration_seconds=1800,sensor_noise_k=0,solar_noise_w=0,battery_noise_wh=0,attitude_noise_deg=0,
                 faults=[dict(kind='heater_stuck_on',start_seconds=60,duration_seconds=1000),
                         dict(kind='attitude_fault',start_seconds=120,duration_seconds=900),
                         dict(kind='comms_loss',start_seconds=300,duration_seconds=400)])
        r=run_engineering(cfg,'baseline')
        event_types=[e['event'] for e in r['events']]
        self.assertIn('ISOLATE_HEATER',event_types)
        self.assertIn('SWITCH_REDUNDANT_ADCS',event_types)
        self.assertIn('ENTER_SAFE_MODE',event_types)
        self.assertTrue(any(len(t['injected_faults'])>1 for t in r['telemetry']))
        self.assertLessEqual(sum(e['event']=='RETRY_HEATER' for e in r['events']),2)
        self.assertLessEqual(sum(e['event']=='RESET_RADIO_ATTEMPT' for e in r['events']),2)
        self.assertEqual(r['checks']['violations'],[])

    def test_zero_noise_nominal_has_no_diagnostic_false_alarms(self):
        cfg=dict(duration_seconds=1200,sensor_noise_k=0,solar_noise_w=0,battery_noise_wh=0,attitude_noise_deg=0)
        for policy in ('baseline','assisted'):
            r=run_engineering(cfg,policy)
            self.assertEqual(r['diagnostics']['false_positive_samples'],0)
            self.assertEqual(r['metrics']['safe_mode_seconds'],0)

    def test_policy_changes_get_distinct_fingerprints(self):
        a=run_engineering(dict(duration_seconds=60),'baseline')
        b=run_engineering(dict(duration_seconds=60),'assisted')
        self.assertNotEqual(a['run_id'],b['run_id'])
        self.assertEqual(a['scenario_sha256'],b['scenario_sha256'])
        self.assertEqual(a['data_provenance'],'SYNTHETIC')
        self.assertFalse(a['model_validated_for_flight'])

    def test_direct_call_is_validated(self):
        with self.assertRaises(ValueError):
            run_engineering(dict(duration_seconds=20),'oracle')

    def test_checker_recomputes_conservation_after_trace_corruption(self):
        r=run_engineering(dict(duration_seconds=60))
        cfg=engineering_config(r['config'])
        broken=copy.deepcopy(r['telemetry'])
        broken[0]['battery_wh']+=10
        broken[1]['temperature_k']+=2
        checks=check_report(cfg,broken)
        self.assertIn('power conservation',checks['violations'])
        self.assertIn('thermal conservation',checks['violations'])

    def test_report_configuration_is_directly_replayable(self):
        r=run_engineering(dict(duration_seconds=120,faults=[dict(kind='comms_loss',start_seconds=20,duration_seconds=50)]))
        self.assertEqual(r,run_engineering(r['config']))

    def test_checker_rejects_nonfinite_power_channels(self):
        r=run_engineering(dict(duration_seconds=60))
        r['telemetry'][0]['unserved_w']=float('nan')
        self.assertIn('nonfinite trace',check_report(engineering_config(r['config']),r['telemetry'])['violations'])

    def test_total_power_loss_disables_radio_without_inventing_radio_fault(self):
        r=run_engineering(dict(duration_seconds=120,initial_battery_wh=0,solar_generation_w=0))
        self.assertEqual(r['metrics']['comms_availability_pct'],0)
        self.assertTrue(all(not t['comms_up'] for t in r['telemetry']))
        self.assertEqual(r['diagnostics']['per_fault']['comms_loss']['fp'],0)

    def test_adjacent_episodes_do_not_steal_preceding_interval_detections(self):
        cfg=dict(duration_seconds=120,sensor_noise_k=0,solar_noise_w=0,battery_noise_wh=0,attitude_noise_deg=0,
            faults=[dict(kind='battery_leak',start_seconds=0,duration_seconds=30),
                    dict(kind='battery_leak',start_seconds=30,duration_seconds=10,severity=.1)])
        r=run_engineering(cfg)
        self.assertEqual([e['latency_seconds'] for e in r['diagnostics']['episode_latencies']],[30,None])
        self.assertEqual(r['diagnostics']['missed_injected_episodes'],1)
        replay=replay_diagnostics(r,'baseline',fit_signature_model())
        self.assertEqual(replay['missed_injected_episodes'],1)

    def test_zero_severity_episode_is_not_a_missed_fault(self):
        r=run_engineering(dict(duration_seconds=120,faults=[dict(kind='comms_loss',start_seconds=0,duration_seconds=60,severity=0)]))
        self.assertEqual(r['diagnostics']['missed_injected_episodes'],0)

    def test_resource_and_heat_balances_across_seeded_faults(self):
        for seed in range(12):
            for policy in ('baseline','assisted'):
                r=run_engineering(dict(seed=seed,duration_seconds=1200,initial_battery_wh=40,
                    faults=[dict(kind='solar_array_loss',start_seconds=100,duration_seconds=700,severity=.8),
                            dict(kind='battery_leak',start_seconds=300,duration_seconds=500)]),policy)
                self.assertEqual(r['checks']['violations'],[])
                self.assertLess(r['checks']['max_power_residual_wh'],1e-8)
                self.assertLess(r['checks']['max_thermal_residual_j'],1e-6)
                self.assertTrue(all(t['battery_wh']>=0 for t in r['telemetry']))
