import copy
import json
from pathlib import Path
import tempfile
import unittest

from spacecraft_lab.reliability import run_strategy, run_study, mean_interval, wilson_interval, STRATEGIES, assess_modes
from spacecraft_lab.health_exchange import export_health, validate_health
from read_health import read_health


class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.scenario = dict(duration_seconds=1200, seed=7, sensor_noise_k=0,
            faults=[dict(kind='heater_stuck_on',start_seconds=60,duration_seconds=900),
                    dict(kind='attitude_fault',start_seconds=120,duration_seconds=600)])

    def test_three_strategies_share_inputs_and_none_has_no_actuator_actions(self):
        before = copy.deepcopy(self.scenario)
        runs = {s:run_strategy(self.scenario,s) for s in STRATEGIES}
        self.assertEqual(self.scenario,before)
        self.assertEqual(len({r['scenario_sha256'] for r in runs.values()}),1)
        self.assertEqual(len({r['run_id'] for r in runs.values()}),3)
        self.assertEqual(runs['none']['actions'],[])
        self.assertTrue(runs['basic']['actions'])
        self.assertEqual(runs['none']['checks']['violations'],[])
        self.assertEqual(runs['basic'],run_strategy(self.scenario,'basic'))

    def test_actions_have_evidence_constraints_and_observed_result(self):
        r=run_strategy(self.scenario,'enhanced')
        for a in r['actions']:
            for key in ('evidence','constraints','expected_effect','resulting_state','outcome'):
                self.assertIn(key,a)
            self.assertIn(a['outcome'],('achieved','not_achieved','not_observed'))
        self.assertTrue(all(t['operating_mode'] in ('NORMAL','DEGRADED','SAFE_MODE','RECOVERY','FAILED') for t in r['telemetry']))
        self.assertTrue(all('sunlit' in t for t in r['telemetry']))
        self.assertTrue(any(d['action']=='ENTER_SAFE_MODE' for d in r['autonomy_decisions']))

    def test_statistics_known_values_and_small_sample_limits(self):
        self.assertEqual(mean_interval([1])['ci95'],None)
        lo,hi=wilson_interval(0,10)
        self.assertAlmostEqual(lo,0)
        self.assertAlmostEqual(hi,.2775328,places=6)
        summary=mean_interval([1,2,3])
        self.assertEqual(summary['mean'],2)
        self.assertAlmostEqual(summary['ci95'][1],2+4.302653/3**.5,places=5)

    def test_paired_study_reproducible_and_bounded(self):
        r=run_study(self.scenario,[1,2,3])
        self.assertEqual(r,run_study(self.scenario,[1,2,3]))
        self.assertEqual(r['summary']['basic']['safe_mode_seconds']['n'],3)
        self.assertEqual(r['paired_enhanced_minus_basic']['safe_mode_seconds']['n'],3)
        for run in r['runs']:
            self.assertEqual(len({x['scenario_sha256'] for x in run['strategies'].values()}),1)
        for seeds in ([],[1,1],[True],[9001],[[1]],list(range(31))):
            with self.assertRaises(ValueError):run_study(self.scenario,seeds)
        with self.assertRaises(ValueError):run_strategy({},'magic')

    def test_nominal_success_and_power_failure_are_explicit(self):
        nominal=run_strategy(dict(duration_seconds=120),'basic')
        self.assertEqual(nominal['research_metrics']['mission_success'],1)
        failed=run_strategy(dict(duration_seconds=600,initial_battery_wh=0,solar_generation_w=0),'basic')
        self.assertEqual(failed['research_metrics']['mission_success'],0)
        self.assertEqual(failed['telemetry'][-1]['operating_mode'],'FAILED')

    def test_operational_assessment_transitions_have_consecutive_failure_dwell(self):
        r=run_strategy(dict(duration_seconds=1200),'basic')
        rows=r['telemetry']
        for i,row in enumerate(rows):
            row.update(mode='normal',battery_pct=70,comms_up=True,unserved_w=0,diagnosed_faults=[])
            if 1<=i<3:row['battery_pct']=30
            if 3<=i<5:row['mode']='safe'
            if 80<=i:row['unserved_w']=1
        transitions=assess_modes(rows,r['config'])
        self.assertEqual([t['resulting'] for t in transitions],['DEGRADED','SAFE_MODE','RECOVERY','NORMAL','FAILED'])
        self.assertEqual(rows[108]['operating_mode'],'NORMAL')
        self.assertEqual(rows[109]['operating_mode'],'FAILED')

    def test_offline_health_contract_is_versioned_and_tamper_evident(self):
        report=run_strategy(self.scenario,'basic')
        packet=export_health(report,'demo-mission','relay-01')
        self.assertEqual(packet,validate_health(copy.deepcopy(packet)))
        self.assertEqual(packet,export_health(report,'demo-mission','relay-01'))
        self.assertEqual(len({e['event_id'] for e in packet['events']}),len(packet['events']))
        for change in ({'schema_version':'1.0'},{'data_provenance':'FLIGHT'},{'mission_id':'../bad'}):
            with self.assertRaises(ValueError):validate_health({**packet,**change})
        broken=copy.deepcopy(packet);broken['health'][-1]['battery_wh']+=1
        with self.assertRaises(ValueError):validate_health(broken)

    def test_health_export_rejects_forged_report_even_with_fresh_packet_hash(self):
        for mutate in ('battery','time','mission','run_id'):
            r=run_strategy(dict(duration_seconds=120),'basic')
            if mutate=='battery':r['telemetry'][0]['battery_wh']=-1
            if mutate=='time':r['telemetry'][0]['time_seconds']=999
            if mutate=='mission':r['research_metrics']['mission_success']=False
            if mutate=='run_id':r['run_id']='forged'
            with self.subTest(mutate=mutate),self.assertRaises(ValueError):
                export_health(r,'demo','relay')

    def test_local_health_reader_round_trip_and_duplicate_refusal(self):
        packet=export_health(run_strategy({'duration_seconds':120},'basic'),'demo','relay')
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'health.json';p.write_text(json.dumps(packet))
            self.assertEqual(read_health(p),packet)
            p.write_text('{"schema_version":"2.0","schema_version":"1.0"}')
            with self.assertRaises(ValueError):read_health(p)
