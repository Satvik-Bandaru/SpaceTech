import copy
import csv
import io
import json
import unittest
from unittest.mock import patch

from spacecraft_lab.assurance.agents import MissionCancelled
from spacecraft_lab import campaigns


class CampaignTests(unittest.TestCase):
    def request(self):
        return dict(name='Battery reserve comparison', scenario=dict(duration_seconds=120,
            initial_battery_wh=90), variants=[dict(name='More reserve',
            changes=dict(initial_battery_wh=120))], seeds=[3, 1], strategies=['basic', 'none'])

    def test_normalization_is_strict_bounded_and_does_not_mutate_inputs(self):
        raw=self.request(); before=copy.deepcopy(raw)
        normalized=campaigns.normalize_campaign(raw)
        self.assertEqual(raw,before)
        self.assertEqual(normalized['scenario']['dt_seconds'],10)
        self.assertEqual(normalized['scenario']['faults'],[])
        self.assertEqual(normalized['assurance_options']['max_decisions'],128)
        self.assertEqual(normalized['variants'],raw['variants'])
        normalized['variants'][0]['changes']['initial_battery_wh']=150
        self.assertEqual(raw,before)
        defaults=campaigns.normalize_campaign({})
        self.assertEqual(defaults['seeds'],[0,1,2])
        self.assertEqual(defaults['strategies'],['none','basic','enhanced','assured'])

    def test_rejects_unsafe_unknown_and_oversized_requests(self):
        invalid=[{'shell':'anything'}, {'name':'x'*81}, {'variants':[{'name':'x','changes':{'seed':5}}]},
            {'variants':[{'name':'x','changes':{'script':'x'}}]},
            {'variants':[{'name':'x','changes':{'safe_load_w':1000}}]},
            {'variants':[{'name':'x','changes':{},'config':{}}]},
            {'variants':[{'name':'x','changes':{}}]*4},
            {'assurance_options':{'tools':['shell']}}, {'scenario':{'duration_seconds':2001,'dt_seconds':1}}]
        invalid.extend({'seeds':seeds} for seeds in ([],[1,1],[True],[9001],[-1],[2**32],list(range(9)),[[1]]))
        invalid.extend({'strategies':strategies} for strategies in ([],['basic'],['none','none'],['basic','magic'],[{},'none']))
        for raw in invalid:
            with self.subTest(raw=raw),self.assertRaises(ValueError):campaigns.normalize_campaign(raw)
        with self.assertRaises(ValueError):
            campaigns.normalize_campaign(dict(variants=[dict(name='x',changes={})]*3,seeds=[0,1,2],strategies=['none','basic','enhanced']))

    def test_interval_budget_counts_assured_baseline_and_each_variant_horizon(self):
        valid=dict(scenario=dict(duration_seconds=20000,dt_seconds=10),seeds=[0,1])
        self.assertEqual(campaigns.normalize_campaign(valid)['seeds'],[0,1])
        with self.assertRaises(ValueError):campaigns.normalize_campaign({**valid,'seeds':[0,1,2]})
        # Four seeds * 2,000 intervals * (basic + assured + assured baseline) = 24,000.
        with self.assertRaises(ValueError):
            campaigns.normalize_campaign(dict(scenario=dict(duration_seconds=2000,dt_seconds=1),
                seeds=[0,1,2,3],strategies=['basic','assured']))
        with self.assertRaises(ValueError):
            campaigns.normalize_campaign(dict(scenario=dict(duration_seconds=120),seeds=[0],
                variants=[dict(name='Longer',changes=dict(duration_seconds=2100,dt_seconds=1))]))

    def test_real_campaign_is_deterministic_retains_cases_and_pairs_by_seed(self):
        raw=self.request(); before=copy.deepcopy(raw); updates=[]
        report=campaigns.run_campaign(raw,progress=updates.append)
        self.assertEqual(raw,before)
        self.assertEqual(report,campaigns.run_campaign(raw))
        self.assertEqual(report['schema_version'],'counterfactual-campaign-1.0')
        self.assertEqual([v['variant_id'] for v in report['variants']],['reference','variant-1'])
        self.assertEqual(len(report['runs']),8)
        self.assertEqual(len({run['case_id'] for run in report['runs']}),8)
        self.assertEqual(report['checks']['violations'],[])
        self.assertIn('campaigns.py',report['source_sha256'])
        for run in report['runs']:
            self.assertEqual(run['report']['config']['seed'],run['seed'])
            self.assertEqual(len(run['report']['telemetry']),12)
            self.assertEqual(run['report']['strategy'],run['strategy'])
        self.assertEqual([u['completed_runs'] for u in updates],[v for i in range(8) for v in (i,i+1)])
        self.assertTrue(all(u['total_runs']==8 for u in updates))
        self.assertEqual(updates[0]['variant_id'],'reference')
        for row in report['paired_comparisons']:
            self.assertEqual(row['reference_variant_id'],'reference')
            self.assertAlmostEqual(row['metrics']['min_battery_pct']['mean'],12.5)
            self.assertEqual(row['metrics']['min_battery_pct']['n'],2)
            # Identical seeds and paths have no observed variation in the reserve delta.
            self.assertEqual(row['metrics']['load_energy_served_wh']['mean'],0)
        for row in report['strategy_comparisons']:
            self.assertEqual(row['reference_strategy'],'basic')
            self.assertEqual(row['strategy'],'none')
        changed=copy.deepcopy(raw); changed['variants'][0]['changes']['initial_battery_wh']=150
        self.assertNotEqual(report['campaign_id'],campaigns.run_campaign(changed)['campaign_id'])

    def test_paired_and_strategy_statistics_match_real_seedwise_differences(self):
        raw=dict(scenario=dict(duration_seconds=1200,initial_battery_wh=40,
            faults=[dict(kind='heater_stuck_on',start_seconds=0,duration_seconds=900)]),
            variants=[dict(name='Less heater fault',changes=dict(faults=[dict(kind='heater_stuck_on',
                start_seconds=0,duration_seconds=300)]))],seeds=[7,2,9],strategies=['none','assured'])
        report=campaigns.run_campaign(raw)
        cases={(r['variant_id'],r['strategy'],r['seed']):r['evaluation_metrics'] for r in report['runs']}
        for row in report['paired_comparisons']:
            values=[cases[(row['variant_id'],row['strategy'],s)]['max_temperature_k']-
                cases[('reference',row['strategy'],s)]['max_temperature_k'] for s in [7,2,9]]
            self.assertAlmostEqual(row['metrics']['max_temperature_k']['mean'],sum(values)/3)
        for row in report['strategy_comparisons']:
            self.assertEqual(row['reference_strategy'],'none')
            values=[cases[(row['variant_id'],row['strategy'],s)]['min_battery_pct']-
                cases[(row['variant_id'],'none',s)]['min_battery_pct'] for s in [7,2,9]]
            self.assertAlmostEqual(row['metrics']['min_battery_pct']['mean'],sum(values)/3)
        self.assertEqual(report['checks']['checked_reports'],18)
        assured=[r for r in report['runs'] if r['strategy']=='assured']
        self.assertTrue(all('baseline' in r['report'] for r in assured))

    def test_relaxed_variant_threshold_does_not_change_common_success_criterion(self):
        report=campaigns.run_campaign(dict(scenario=dict(duration_seconds=10,initial_temperature_k=340),
            variants=[dict(name='Relaxed temperature limit',changes=dict(high_temperature_k=350))],
            seeds=[0],strategies=['none','basic']))
        self.assertTrue(all(row['successes']==0 for row in report['summary']))
        self.assertEqual(report['evaluation_criteria']['temperature_limits_k'],[263.15,333.15])
        self.assertEqual(report['evaluation_criteria']['reference_variant_id'],'reference')
        self.assertIn('Common reference criteria',report['evaluation_criteria']['evaluation_scope'])
        for run in report['runs']:
            self.assertEqual(run['evaluation_metrics']['mission_success'],0)
            self.assertIsNot(run['evaluation_metrics'],run['report']['research_metrics'])
            if run['variant_id']=='variant-1':
                self.assertEqual(run['report']['research_metrics']['mission_success'],1)
                self.assertEqual(run['report']['mission_criteria']['temperature_limits_k'],[263.15,350])
        self.assertTrue(all(row['metrics']['mission_success']['mean']==0 for row in report['paired_comparisons']))

    def test_single_seed_mean_interval_is_absent_and_proxy_uses_wilson(self):
        report=campaigns.run_campaign(dict(scenario=dict(duration_seconds=120),seeds=[0],strategies=['none','basic']))
        row=report['summary'][0]
        self.assertEqual(row['n'],1)
        self.assertEqual(row['successes'],1)
        self.assertIsNone(row['metrics']['mission_success']['ci95'])
        self.assertAlmostEqual(row['mission_success_ci95'][0],0.2065493144)
        self.assertAlmostEqual(row['mission_success_ci95'][1],1)

    def test_cancellation_propagates_engine_checkpoint_and_stops_later_cases(self):
        updates=[]
        with self.assertRaises(MissionCancelled):
            campaigns.run_campaign(self.request(),cancelled=lambda:True,progress=updates.append)
        self.assertFalse(any(u['completed_runs'] for u in updates))
        def cancelled():return any(u['completed_runs']==1 for u in updates)
        updates.clear()
        with self.assertRaises(MissionCancelled):
            campaigns.run_campaign(self.request(),cancelled=cancelled,progress=updates.append)
        self.assertEqual(max(u['completed_runs'] for u in updates),1)

    def test_invalid_or_violated_engine_checks_fail_closed_including_assured_baseline(self):
        original=campaigns.run_strategy
        def broken(*args,**kwargs):
            report=original(*args,**kwargs);report['checks']['violations']=['power conservation'];return report
        with patch.object(campaigns,'run_strategy',broken),self.assertRaises(ValueError):
            campaigns.run_campaign(self.request())
        original_assured=campaigns.run_assurance
        def bad_baseline(*args,**kwargs):
            report=original_assured(*args,**kwargs);report['baseline']['checks']['violations']='';return report
        with patch.object(campaigns,'run_assurance',bad_baseline),self.assertRaises(ValueError):
            campaigns.run_campaign(dict(scenario=dict(duration_seconds=120),seeds=[0],strategies=['none','assured']))

    def test_exports_label_seed_scope_pair_direction_and_neutralize_formula_names(self):
        raw=self.request();raw['variants'][0]['name']='=HYPERLINK("unsafe")'
        report=campaigns.run_campaign(raw)
        rows=list(csv.DictReader(io.StringIO(campaigns.campaign_csv(report))))
        self.assertTrue(any(row['row_type']=='paired_variant_delta' for row in rows))
        named=[row['variant_name'] for row in rows if row['variant_id']=='variant-1']
        self.assertTrue(named)
        self.assertTrue(all(name.startswith("'=") for name in named))
        self.assertTrue(all(json.loads(row['evaluation_criteria'])==report['evaluation_criteria'] for row in rows))
        md=campaigns.campaign_markdown(report)
        for term in ('SYNTHETIC','not flight-qualified','[3, 1]','variant minus reference','not independent missions',
                'Student-t','Wilson','Common reference criteria','263.15','333.15'):
            self.assertIn(term,md)
        self.assertNotIn('winner',md.lower())


if __name__=='__main__':unittest.main()
