"""Closed registry of the seven deterministic mission-assurance roles.

Definitions are descriptive JSON contracts, never import paths or executable tools.
The compiled role policy is a ceiling: supplied definitions may restrict it only.
"""
import json
from types import MappingProxyType

from .contracts import PERMISSIONS


_ROLES = {
    'power': ('Power Specialist', 'power', ['read_telemetry', 'propose_safe_mode']),
    'thermal': ('Thermal Specialist', 'thermal', ['read_telemetry']),
    'diagnostic': ('Diagnostic Specialist', 'diagnostics', ['read_residuals']),
    'recovery': ('Recovery Specialist', 'recovery', ['propose_finite_actions']),
    'commander': ('Mission Intelligence Orchestrator', 'coordination', ['coordinate_candidates']),
    'safety': ('Independent Safety Kernel', 'safety', ['verify_modeled_constraints']),
    'validation': ('Proposal and Outcome Validator', 'validation', ['verify_proposal_evidence', 'verify_observed_effect']),
}


def _definition(agent_id):
    name, domain, tools = _ROLES[agent_id]
    output = 'proposal-2.0' if agent_id in ('power', 'recovery') else {
        'thermal': 'thermal-evidence-1.0', 'diagnostic': 'confirmed-alarms-1.0',
        'commander': 'bounded-candidates-1.0', 'safety': 'safety-kernel-1.0',
        'validation': 'proposal-verification-1.0 and observed-outcome-1.0',
    }[agent_id]
    return dict(schema_version='agent-definition-1.0', agent_id=agent_id, name=name,
        version='1.0', domain=domain, system_prompt='N/A: deterministic finite rules',
        model_configuration=dict(kind='deterministic', provider=None, model=None),
        allowed_tools=list(tools),
        input_schema=dict(type='object', contract='current synthetic interval state',
                          max_properties=64, max_alarms=5, max_evidence_items=16),
        output_schema=dict(type='object', contract=output, max_items=256),
        permissions=sorted(PERMISSIONS.get(agent_id, set())), compute_budget=60000,
        deadline_seconds=30, error_policy='FAIL_CLOSED',
        approval_policy='Independent SafetyKernel approval required before simulated actuation',
        evaluation_metrics=['compute_units', 'proposal_verification_results', 'observed_outcomes'])


class AgentRegistry:
    """Validate finite role definitions and return detached discovery records.

    No registration, callable loading, prompt override, or permission expansion is
    supported. Keeping serialized records internally prevents nested caller edits.
    """
    __slots__ = ('_definitions', '_by_id')

    def __init__(self, definitions=None):
        if definitions is None:
            definitions = [_definition(agent_id) for agent_id in _ROLES]
        if not isinstance(definitions, list) or len(definitions) != len(_ROLES):
            raise ValueError('Agent registry requires exactly the seven finite roles')
        copied = []
        seen = set()
        for definition in definitions:
            if not isinstance(definition, dict):
                raise ValueError('Agent definition must be an object')
            agent_id = definition.get('agent_id')
            if not isinstance(agent_id, str) or agent_id not in _ROLES or agent_id in seen:
                raise ValueError('Unknown or duplicate agent role')
            expected = _definition(agent_id)
            if set(definition) != set(expected):
                raise ValueError('Invalid agent-definition fields; executable entrypoints are forbidden')
            adjustable = {'allowed_tools', 'permissions', 'compute_budget', 'deadline_seconds'}
            if any(definition[key] != value for key, value in expected.items() if key not in adjustable):
                raise ValueError('Invalid finite agent metadata or input/output schema')
            for key in ('allowed_tools', 'permissions'):
                values = definition[key]
                if (not isinstance(values, list) or any(not isinstance(v, str) for v in values)
                        or len(values) != len(set(values)) or not set(values) <= set(expected[key])):
                    raise ValueError('Agent tools and permissions may not exceed the compiled role policy')
            for key in ('compute_budget', 'deadline_seconds'):
                if type(definition[key]) is not int or not 1 <= definition[key] <= expected[key]:
                    raise ValueError('Invalid agent compute budget or deadline')
            try:
                copied.append(json.dumps(definition, sort_keys=True, allow_nan=False))
            except (ValueError, TypeError, OverflowError) as exc:
                raise ValueError('Agent definition is not bounded JSON') from exc
            seen.add(agent_id)
        self._definitions = tuple(copied)
        self._by_id = MappingProxyType({json.loads(record)['agent_id']: record for record in copied})

    def discover(self):
        return [json.loads(record) for record in self._definitions]

    def get(self, agent_id):
        if not isinstance(agent_id, str) or agent_id not in self._by_id:
            raise ValueError('Unknown agent role')
        return json.loads(self._by_id[agent_id])
