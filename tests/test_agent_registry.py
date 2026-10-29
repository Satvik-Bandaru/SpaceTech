"""Finite registry and independent proposal evidence checks at the execution boundary."""
import copy
import importlib
import importlib.util
import unittest
from unittest.mock import patch

from spacecraft_lab.assurance.contracts import proposal
from spacecraft_lab.assurance.runner import run_assurance
from spacecraft_lab.assurance import agents


STATE = dict(run_id='eng-' + 'a' * 24, time_seconds=300, dt_seconds=10, battery_wh=180, battery_capacity_wh=240,
    temperature_k=293, low_temperature_k=263, high_temperature_k=333, heater_on_below_k=283,
    discharge_efficiency=.9, discharge_limit_w=150, base_load_w=120, radio_load_w=5,
    mode='normal', pointing_error_deg=0, comms_up=False, unserved_w=0,
    heater_isolated_since=None, heater_attempts=0, adcs_redundant=False, radio_attempts=0,
    last_radio_attempt=-120, stable_seconds=300, alarms=['comms_loss'], unavailable_actuators=[])


class AgentRegistryTests(unittest.TestCase):
    def setUp(self):
        for name in ('registry', 'verification'):
            self.assertIsNotNone(importlib.util.find_spec('spacecraft_lab.assurance.' + name),
                                 'Missing independent ' + name + ' module')
        self.registry_module = importlib.import_module('spacecraft_lab.assurance.registry')
        self.verification_module = importlib.import_module('spacecraft_lab.assurance.verification')
        self.registry = self.registry_module.AgentRegistry()

    def test_registry_discovery_and_inputs_cannot_mutate_permissions(self):
        definitions = self.registry.discover()
        self.assertEqual({d['agent_id'] for d in definitions},
                         {'power', 'thermal', 'diagnostic', 'recovery', 'commander', 'safety', 'validation'})
        supplied = copy.deepcopy(definitions)
        registry = self.registry_module.AgentRegistry(supplied)
        supplied[0]['allowed_tools'].append('run_shell')
        definitions[0]['permissions'].append('RESET_RADIO_ATTEMPT')
        fetched = registry.get('power')
        fetched['permissions'].append('RESET_RADIO_ATTEMPT')
        self.assertEqual(registry.get('power')['permissions'], ['REQUEST_SAFE_MODE'])
        self.assertNotIn('run_shell', registry.get('power')['allowed_tools'])
        with self.assertRaises(ValueError):
            registry.get('unknown')

    def test_malformed_unknown_duplicate_and_self_granted_definitions_are_rejected(self):
        for field, value in [('agent_id', 'flight_authority'), ('allowed_tools', ['run_shell']),
                             ('permissions', ['RESET_RADIO_ATTEMPT']), ('compute_budget', True),
                             ('deadline_seconds', 0), ('input_schema', {}),
                             ('model_configuration', {'kind': 'python', 'entrypoint': 'os.system'})]:
            definitions = self.registry.discover()
            definitions[0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.registry_module.AgentRegistry(definitions)
        definitions = self.registry.discover()
        definitions.append(copy.deepcopy(definitions[0]))
        with self.assertRaises(ValueError):
            self.registry_module.AgentRegistry(definitions)
        definitions = self.registry.discover()
        definitions[0]['entrypoint'] = 'arbitrary.module:function'
        with self.assertRaises(ValueError):
            self.registry_module.AgentRegistry(definitions)

    def test_verifier_rejects_stale_unbound_malformed_and_unauthorized_proposals(self):
        verifier = self.verification_module.ProposalVerifier(self.registry)
        current = proposal('recovery', 'RESET_RADIO_ATTEMPT', 300, 'Confirmed radio alarm', ['telemetry:300'], state=STATE)
        self.assertTrue(verifier.verify(STATE, current)['verified'])
        cases = [
            (proposal('recovery', 'RESET_RADIO_ATTEMPT', 290, 'Old alarm', ['telemetry:290'], state=STATE), 'STALE_OR_UNBOUND_EVIDENCE'),
            (proposal('recovery', 'RESET_RADIO_ATTEMPT', 300, 'Unbound alarm', ['telemetry:300', 'invented'], state=STATE), 'STALE_OR_UNBOUND_EVIDENCE'),
            (proposal('power', 'RESET_RADIO_ATTEMPT', 300, 'Self granted recovery action', ['telemetry:300'], state=STATE), 'AGENT_PERMISSION_DENIED'),
            ({**current, 'reason': 'Tampered content'}, 'INVALID_PROPOSAL_CONTRACT'),
        ]
        for candidate, reason in cases:
            with self.subTest(reason=reason):
                result = verifier.verify(STATE, candidate)
                self.assertFalse(result['verified'])
                self.assertTrue(any(reason in r for r in result['reasons']))
        for changed, reason in [({'run_id': 'eng-' + 'b' * 24}, 'RUN_ID_MISMATCH'),
                                ({'battery_wh': 170}, 'STATE_BINDING_MISMATCH')]:
            rejected = verifier.verify({**STATE, **changed}, current)
            self.assertFalse(rejected['verified'])
            self.assertIn(reason, rejected['reasons'])

    def test_alarm_actions_require_current_confirmed_diagnostic_evidence(self):
        verifier = self.verification_module.ProposalVerifier(self.registry)
        for action, alarm, reason in [('ISOLATE_HEATER', 'heater_stuck_on', 'NO_CONFIRMED_HEATER_ALARM'),
                                      ('SWITCH_REDUNDANT_ADCS', 'attitude_fault', 'NO_CONFIRMED_ATTITUDE_ALARM'),
                                      ('RESET_RADIO_ATTEMPT', 'comms_loss', 'NO_CONFIRMED_RADIO_ALARM')]:
            with self.subTest(action=action):
                no_alarm = {**STATE, 'alarms': []}
                candidate = proposal('recovery', action, 300, 'Alarm-triggered proposal', ['telemetry:300'], state=no_alarm)
                rejected = verifier.verify(no_alarm, candidate)
                self.assertFalse(rejected['verified'])
                self.assertIn(reason, rejected['reasons'])
                confirmed = {**STATE, 'alarms': [alarm]}
                candidate = proposal('recovery', action, 300, 'Alarm-triggered proposal', ['telemetry:300'], state=confirmed)
                self.assertTrue(verifier.verify(confirmed, candidate)['verified'])
        candidate = proposal('recovery', 'RESET_RADIO_ATTEMPT', 300, 'Alarm', ['telemetry:300'], state=STATE)
        for overrides in ({'time_seconds': True}, {'alarms': 'comms_loss'}, {'temperature_k': float('nan')}):
            self.assertFalse(verifier.verify({**STATE, **overrides}, candidate)['verified'])

    def test_orchestrator_rejects_invalid_evidence_before_kernel_or_execution(self):
        orchestrator_type = getattr(agents, 'MissionIntelligenceOrchestrator', None)
        self.assertIsNotNone(orchestrator_type, 'Named orchestrator is missing')
        orchestrator = orchestrator_type({})
        original = agents.proposal
        def stale_proposal(source, action, time_seconds, reason, evidence, *, state):
            return original(source, action, time_seconds - 10, reason, ['telemetry:290'], state=state)
        with patch.object(agents, 'proposal', stale_proposal):
            approved = orchestrator.step(copy.deepcopy(STATE))
        self.assertEqual(approved, set())
        decision = orchestrator.decisions[0]
        self.assertFalse(decision['verification_result']['verified'])
        self.assertFalse(decision['safety_check_result']['approved'])
        self.assertEqual(decision['safety_check_result']['kernel_status'], 'NOT_RUN')
        self.assertEqual(decision['execution_status'], 'REJECTED')
        self.assertEqual(orchestrator.agent_state['safety']['compute_units'], 0)
        self.assertEqual(orchestrator.agent_state['validation']['compute_units'], 1)

    def test_actual_run_records_verification_before_every_executed_action(self):
        report = run_assurance(dict(duration_seconds=600, faults=[
            dict(kind='heater_stuck_on', start_seconds=0, duration_seconds=400),
            dict(kind='comms_loss', start_seconds=0, duration_seconds=300)]))
        audit = report['assurance']
        executed = [d for d in audit['decisions'] if d['execution_status'] == 'EXECUTED']
        self.assertTrue(executed)
        for decision in executed:
            self.assertTrue(decision['verification_result']['verified'])
            self.assertEqual(decision['verification_result']['phase'], 'PRE_EXECUTION')
            self.assertEqual(decision['verification_result']['evidence_time_seconds'], decision['time_seconds'])
            self.assertTrue(decision['safety_check_result']['approved'])
            self.assertIsNotNone(decision['observed_outcome'])
        validation = next(a for a in audit['agents'] if a['agent_id'] == 'validation')
        self.assertGreaterEqual(validation['compute_units'], len(audit['decisions']) + len(executed))
        self.assertEqual(len(audit['agent_registry']), 7)


if __name__ == '__main__':
    unittest.main()
