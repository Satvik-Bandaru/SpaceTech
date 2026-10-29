"""Independent proposal-contract and observed-evidence check before SafetyKernel.

Passing this check says only that the finite proposal is supported by its current
synthetic observation. Resource feasibility and actuation authority stay in the
separate safety kernel; post-execution observations stay in the orchestrator.
"""
from .contracts import digest, validate_proposal
from .registry import AgentRegistry


_ALARM_EVIDENCE = {
    'ISOLATE_HEATER': ('heater_stuck_on', 'NO_CONFIRMED_HEATER_ALARM'),
    'SWITCH_REDUNDANT_ADCS': ('attitude_fault', 'NO_CONFIRMED_ATTITUDE_ALARM'),
    'RESET_RADIO_ATTEMPT': ('comms_loss', 'NO_CONFIRMED_RADIO_ALARM'),
}
_ALARMS = frozenset(('solar_array_loss', 'heater_stuck_on', 'comms_loss', 'attitude_fault', 'battery_leak'))


class ProposalVerifier:
    def __init__(self, registry=None):
        self.registry = registry if registry is not None else AgentRegistry()
        if not isinstance(self.registry, AgentRegistry):
            raise ValueError('Proposal verifier requires a finite AgentRegistry')

    def verify(self, state, candidate):
        reasons = []
        state_sha256 = None
        evidence_time = None
        try:
            validate_proposal(candidate)
        except (ValueError, TypeError, KeyError, OverflowError) as exc:
            reasons.append('INVALID_PROPOSAL_CONTRACT: ' + str(exc))
        try:
            if not isinstance(state, dict):
                raise ValueError('Evidence state must be an object')
            evidence_time = state['time_seconds']
            if type(evidence_time) is not int or evidence_time < 0:
                raise ValueError('Evidence clock must be a nonnegative integer')
            alarms = state['alarms']
            if (not isinstance(alarms, list) or len(alarms) > len(_ALARMS)
                    or any(not isinstance(a, str) or a not in _ALARMS for a in alarms)
                    or len(alarms) != len(set(alarms))):
                raise ValueError('Expected finite confirmed diagnostic alarms')
            state_sha256 = digest(state)
        except (ValueError, TypeError, KeyError, OverflowError) as exc:
            reasons.append('INVALID_EVIDENCE_STATE: ' + str(exc))
        if not reasons:
            if candidate['time_seconds'] != evidence_time or candidate['evidence'] != [f'telemetry:{evidence_time}']:
                reasons.append('STALE_OR_UNBOUND_EVIDENCE')
            if candidate['run_id'] != state.get('run_id'):
                reasons.append('RUN_ID_MISMATCH')
            if candidate['mission_state_sha256'] != state_sha256:
                reasons.append('STATE_BINDING_MISMATCH')
            role = self.registry.get(candidate['source_agent'])
            if candidate['action'] not in role['permissions']:
                reasons.append('AGENT_PERMISSION_DENIED')
            required_alarm = _ALARM_EVIDENCE.get(candidate['action'])
            if required_alarm and required_alarm[0] not in alarms:
                reasons.append(required_alarm[1])
        return dict(schema_version='proposal-verification-1.0', verified=not reasons,
            reasons=reasons or ['CURRENT_CONTRACT_PERMISSION_AND_EVIDENCE_PASS'],
            phase='PRE_EXECUTION', evidence_time_seconds=evidence_time, state_sha256=state_sha256,
            run_id=state.get('run_id') if isinstance(state, dict) else None,
            authority='Evidence verification only; independent SafetyKernel approval still required')
