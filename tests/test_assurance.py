import copy
import unittest
import random

from spacecraft_lab.assurance.contracts import proposal, validate_options, digest
from spacecraft_lab.assurance.safety import SafetyKernel
from spacecraft_lab.assurance.runner import run_assurance
from spacecraft_lab.assurance.agents import MissionCancelled


STATE=dict(run_id='eng-'+'0'*24,time_seconds=300,dt_seconds=10,battery_wh=180,battery_capacity_wh=240,
    temperature_k=293,low_temperature_k=263,high_temperature_k=333,heater_on_below_k=283,
    discharge_efficiency=.9,discharge_limit_w=150,base_load_w=120,radio_load_w=5,
    mode='normal',pointing_error_deg=0,comms_up=False,unserved_w=0,
    heater_isolated_since=None,heater_attempts=0,adcs_redundant=False,radio_attempts=0,
    last_radio_attempt=-120,stable_seconds=300,alarms=['comms_loss'],unavailable_actuators=[])


class AssuranceTests(unittest.TestCase):
    def test_same_time_proposal_cannot_rebind_to_changed_state_or_run(self):
        p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Confirmed radio alarm',['telemetry:300'],state=STATE)
        kernel=SafetyKernel()
        self.assertTrue(kernel.verify(STATE,p)['approved'])
        self.assertFalse(kernel.verify({**STATE,'battery_wh':200},p)['approved'])
        self.assertFalse(kernel.verify({**STATE,'run_id':'eng-'+'a'*24},p)['approved'])

    def test_kernel_requires_current_evidence_and_permissions(self):
        kernel=SafetyKernel()
        p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Confirmed radio alarm',['telemetry:300'],state=STATE)
        self.assertTrue(kernel.verify(STATE,p)['approved'])
        for changed in ({'time_seconds':290},{'source_agent':'power'},{'action':'RUN_SHELL'},{'risk':'magic'}):
            with self.subTest(changed=changed):
                verdict=kernel.verify(STATE,{**p,**changed})
                self.assertFalse(verdict['approved'])

    def test_unsafe_requests_rejected_before_actuation(self):
        k=SafetyKernel()
        for overrides in ({'battery_wh':10},{'temperature_k':340},{'radio_attempts':2},
                          {'last_radio_attempt':250},{'unavailable_actuators':['radio']},
                          {'discharge_limit_w':10},{'alarms':[]}):
            s={**STATE,**overrides}
            p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Radio fault',['telemetry:300'],state=s)
            with self.subTest(overrides=overrides):self.assertFalse(k.verify(s,p)['approved'])
        s={**STATE,'temperature_k':340,'alarms':['heater_stuck_on']}
        isolate=proposal('recovery','ISOLATE_HEATER',300,'Heater residual',['telemetry:300'],state=s)
        self.assertTrue(k.verify(s,isolate)['approved'])

    def test_retry_dwell_and_safe_mode_cannot_be_bypassed(self):
        k=SafetyKernel();s={**STATE,'heater_isolated_since':100}
        retry=proposal('recovery','RETRY_HEATER',300,'Reconnect trial',['telemetry:300'],state=s)
        self.assertFalse(k.verify(s,retry)['approved'])
        s={**STATE,'mode':'safe','battery_wh':30}
        normal=proposal('recovery','REQUEST_NORMAL_MODE',300,'Resume',['telemetry:300'],state=s)
        self.assertFalse(k.verify(s,normal)['approved'])

    def test_budget_and_input_contracts_are_bounded(self):
        for options in ({'max_decisions':0},{'probe_unsafe':'yes'},{'tools':['shell']},{'max_decisions':True}):
            with self.assertRaises(ValueError):validate_options(options)

    def test_corrupt_state_fails_closed_without_exception(self):
        p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Radio fault',['telemetry:300'],state=STATE)
        for value in (float('nan'),float('inf'),True,10**400):
            self.assertFalse(SafetyKernel().verify({**STATE,'battery_wh':value},p)['approved'])

    def test_cancellation_returns_interval_boundary_checkpoint(self):
        with self.assertRaises(MissionCancelled) as caught:run_assurance({'duration_seconds':120},{},lambda:True)
        self.assertEqual(caught.exception.checkpoint['last_state']['time_seconds'],0)

    def test_actual_plant_is_gated_reproducible_and_has_observed_outcomes(self):
        scenario=dict(duration_seconds=1200,initial_battery_wh=40,
            faults=[dict(kind='solar_array_loss',start_seconds=0,duration_seconds=600,severity=.8),
                    dict(kind='heater_stuck_on',start_seconds=100,duration_seconds=600)])
        before=copy.deepcopy(scenario)
        r=run_assurance(scenario,{'probe_unsafe':True})
        self.assertEqual(r,run_assurance(scenario,{'probe_unsafe':True}))
        self.assertEqual(scenario,before)
        self.assertTrue(any(not d['safety_check_result']['approved'] for d in r['assurance']['decisions']))
        executed=[d for d in r['assurance']['decisions'] if d['execution_status']=='EXECUTED']
        self.assertTrue(any(d['action']=='ISOLATE_HEATER' for d in executed))
        self.assertTrue(all(d['safety_check_result']['approved'] for d in executed))
        self.assertTrue(all(d['observed_outcome'] is not None for d in executed))
        self.assertTrue(all(d['run_id']==r['engine_run_id'] and d['mission_state_sha256']==digest(d['evidence_state']) for d in r['assurance']['decisions']))
        self.assertEqual(r['checks']['violations'],[])
        self.assertEqual(r['baseline']['checks']['violations'],[])

    def test_disabled_actuator_never_executes_and_budget_exhaustion_is_safe(self):
        scenario=dict(duration_seconds=1200,faults=[dict(kind='heater_stuck_on',start_seconds=0,duration_seconds=900)])
        r=run_assurance(scenario,{'unavailable_actuators':['heater_relay'],'max_decisions':2})
        self.assertFalse(any(row['heater_isolated'] for row in r['telemetry']))
        self.assertLessEqual(len(r['assurance']['decisions']),2)
        self.assertEqual(r['checks']['violations'],[])

    def test_randomized_radio_actions_always_preserve_modeled_reserve(self):
        rng=random.Random(53);approved=0
        for _ in range(300):
            s={**STATE,'battery_wh':rng.uniform(0,240),'temperature_k':rng.uniform(240,350),'discharge_limit_w':rng.uniform(0,400)}
            p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Confirmed alarm',['telemetry:300'],state=s)
            verdict=SafetyKernel().verify(s,p)
            if verdict['approved']:
                approved+=1
                demand=STATE['base_load_w']+STATE['radio_load_w']+5
                after=s['battery_wh']-demand*10/3600/.9
                self.assertGreaterEqual(after,60)
                self.assertLessEqual(demand,s['discharge_limit_w'])
                self.assertGreaterEqual(s['temperature_k'],266)
                self.assertLessEqual(s['temperature_k'],330)
        self.assertGreater(approved,0)

    def test_seeded_assured_plant_preserves_conservation_and_gate(self):
        for seed in range(8):
            r=run_assurance(dict(seed=seed,duration_seconds=1200,initial_battery_wh=40,
                faults=[dict(kind='heater_stuck_on',start_seconds=100,duration_seconds=700),
                        dict(kind='comms_loss',start_seconds=300,duration_seconds=500)]),{'probe_unsafe':True})
            self.assertEqual(r['checks']['violations'],[])
            self.assertTrue(all(d['safety_check_result']['approved'] for d in r['assurance']['decisions'] if d['execution_status']=='EXECUTED'))

    def test_radio_budget_includes_heater_and_storage_loss(self):
        s={**STATE,'battery_wh':61,'discharge_limit_w':2000,'additional_load_w':1000,'storage_loss_w':20}
        p=proposal('recovery','RESET_RADIO_ATTEMPT',300,'Confirmed alarm',['telemetry:300'],state=s)
        self.assertFalse(SafetyKernel().verify(s,p)['approved'])
        r=run_assurance(dict(duration_seconds=120,initial_battery_wh=71,initial_temperature_k=280,
            heater_w=1000,solar_generation_w=0,discharge_limit_w=2000,
            faults=[dict(kind='comms_loss',start_seconds=0,duration_seconds=120)]))
        reset=next(d for d in r['assurance']['decisions'] if d['action']=='RESET_RADIO_ATTEMPT')
        self.assertFalse(reset['safety_check_result']['approved'])

    def test_every_normal_recovery_has_prior_kernel_approval(self):
        r=run_assurance(dict(duration_seconds=1200,faults=[dict(kind='comms_loss',start_seconds=0,duration_seconds=120)]))
        returned=[e for e in r['events'] if e['event']=='RETURN_TO_NORMAL']
        self.assertTrue(returned)
        for event in returned:
            self.assertTrue(any(d['action']=='REQUEST_NORMAL_MODE' and d['time_seconds']==event['time_seconds'] and d['safety_check_result']['approved']
                for d in r['assurance']['decisions']))

    def test_cancellation_covers_baseline_phase(self):
        polls=0
        def cancelled():
            nonlocal polls
            polls+=1
            return polls>12
        with self.assertRaises(MissionCancelled):run_assurance({'duration_seconds':120},{},cancelled)

    def test_heater_reconnect_and_normal_recovery_share_one_feasible_budget(self):
        r=run_assurance(dict(duration_seconds=600,battery_capacity_wh=10,initial_battery_wh=10,
            initial_temperature_k=275,heater_w=1000,solar_generation_w=500,normal_load_w=0,safe_load_w=0,
            charge_limit_w=1000,discharge_limit_w=600,orbit_period_seconds=360,eclipse_seconds=30,
            faults=[dict(kind='heater_stuck_on',start_seconds=0,duration_seconds=60)]))
        self.assertEqual(r['metrics']['unserved_energy_wh'],0)
        self.assertTrue(any(d['action']=='RETRY_HEATER' and not d['safety_check_result']['approved'] for d in r['assurance']['decisions']))
