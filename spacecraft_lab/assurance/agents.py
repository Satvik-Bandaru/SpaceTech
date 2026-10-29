"""Bounded deterministic specialists and commander. No arbitrary tools or source mutation."""
from copy import deepcopy

from .contracts import proposal, validate_options, digest,implementation_manifest
from .safety import SafetyKernel
from .registry import AgentRegistry
from .verification import ProposalVerifier


class MissionCancelled(Exception):
    def __init__(self,checkpoint):
        super().__init__('Simulation cancelled at an interval boundary')
        self.checkpoint=checkpoint


class MissionIntelligenceOrchestrator:
    def __init__(self,options,cancelled=None):
        self.options=validate_options(options)
        self.implementation_sha256=implementation_manifest()
        self.registry=AgentRegistry();self.verifier=ProposalVerifier(self.registry)
        self.kernel=SafetyKernel();self.decisions=[];self.last_proposed={};self.pending=[]
        self.steps=0;self.budget_exhausted=False;self.cancelled=cancelled;self.last_state=None
        self.agent_state={definition['agent_id']:dict(agent_id=definition['agent_id'],status='IDLE',
            compute_units=0,allowed_tools=definition['allowed_tools'],compute_budget=definition['compute_budget'],
            deadline_policy='Finite synchronous work inside the 30-second workflow deadline',
            uncertainty='Rule-based synthetic model; no empirical confidence calibration',last_evidence=None)
            for definition in self.registry.discover()}

    def step(self,state):
        if self.steps>=10000:raise MissionCancelled(self.checkpoint())
        self.steps+=1;self.last_state=deepcopy(state)
        if self.cancelled and self.cancelled():
            raise MissionCancelled(self.checkpoint())
        t=state['time_seconds'];candidates=[]
        evidence=[f'telemetry:{t}']
        facts={'power':dict(battery_pct=100*state['battery_wh']/state['battery_capacity_wh'],base_load_w=state['base_load_w']),
               'thermal':dict(temperature_k=state['temperature_k'],heater_isolated_since=state['heater_isolated_since']),
               'diagnostic':dict(confirmed_alarms=list(state['alarms']))}
        for agent,fact in facts.items():
            self.agent_state[agent].update(status='COMPLETE',last_evidence=dict(time_seconds=t,**fact))
            self.agent_state[agent]['compute_units']+=1
        def add(action,reason,source='recovery'):
            # Event-driven cooldown limits repeated rejected recommendations.
            if t-self.last_proposed.get(action,-100000)<120:return
            self.last_proposed[action]=t;candidates.append(proposal(source,action,t,reason,evidence,state=state))
        if facts['power']['battery_pct']<25 and state['mode']!='safe':add('REQUEST_SAFE_MODE','Stored energy below 25% reserve','power')
        if self.options['probe_unsafe'] and t in (0,120):
            add('REQUEST_NORMAL_MODE','Explicit research probe: attempt early return to normal')
        if state['mode']=='safe' and state['stable_seconds']+state['dt_seconds']>=300:
            add('REQUEST_NORMAL_MODE','Candidate healthy dwell reached; verify normal-load resource budget independently')
        if 'heater_stuck_on' in state['alarms'] and state['heater_isolated_since'] is None:add('ISOLATE_HEATER','Persistent thermal residual confirms unwanted heater load')
        if state['heater_isolated_since'] is not None and t-state['heater_isolated_since']>=300 and state['heater_attempts']<2:add('RETRY_HEATER','Consider bounded reconnection after dwell; kernel must verify safety')
        if 'attitude_fault' in state['alarms'] and not state['adcs_redundant']:add('SWITCH_REDUNDANT_ADCS','Persistent pointing alarm supports redundant actuator')
        if 'comms_loss' in state['alarms'] and state['radio_attempts']<2:add('RESET_RADIO_ATTEMPT','Persistent powered-link loss supports bounded reset trial')
        self.agent_state['commander']['compute_units']+=len(candidates)
        self.agent_state['commander']['status']='COMPLETE'
        approved=set()
        available=self.options['max_decisions']-len(self.decisions)
        if len(candidates)>available:
            self.budget_exhausted=True;self.agent_state['commander']['status']='BUDGET_EXHAUSTED'
        verified=[];verification_results={}
        for candidate in candidates[:available]:
            verification=self.verifier.verify(state,candidate)
            self.agent_state['validation']['compute_units']+=1
            self.agent_state['validation']['status']='COMPLETE'
            self.agent_state['recovery']['compute_units']+=1
            self.agent_state['recovery']['status']='COMPLETE'
            if verification['verified']:
                verified.append(candidate);verification_results[candidate['proposal_id']]=verification
            else:
                # Rejected evidence never reaches resource approval or simulated actuation.
                verdict=dict(approved=False,reasons=['PROPOSAL_VERIFICATION_REJECTED',*verification['reasons']],
                    kernel_status='NOT_RUN',state_sha256=verification['state_sha256'],
                    fallback='Existing hard safe-mode supervisor remains active; no rejected action is applied')
                self.decisions.append({**candidate,'verification_result':verification,'safety_check_result':verdict,
                    'execution_status':'REJECTED','observed_outcome':None,'evidence_state':deepcopy(state),
                    'safety_projection':deepcopy(state)})
        for checked in self.kernel.verify_batch(state,verified):
            p=checked['candidate'];verdict=checked['verdict']
            self.agent_state['safety']['compute_units']+=1
            self.agent_state['safety']['status']='COMPLETE'
            d={**p,'verification_result':verification_results[p['proposal_id']],
               'safety_check_result':verdict,'execution_status':'APPROVED' if verdict['approved'] else 'REJECTED',
               'observed_outcome':None,'evidence_state':deepcopy(state),'safety_projection':checked['projection']}
            self.decisions.append(d)
            if verdict['approved']:
                approved.add(p['action']);self.pending.append(d)
        return approved

    def observe(self,row,applied):
        remaining=[]
        for d in self.pending:
            if d['execution_status']=='APPROVED':
                d['execution_status']='EXECUTED' if d['action'] in applied else 'NOT_EXECUTED'
                if d['execution_status']=='NOT_EXECUTED':
                    d['observed_outcome']=dict(status='NOT_APPLIED',time_seconds=row['time_seconds']);continue
            if d['action']=='RESET_RADIO_ATTEMPT' and row['interval_start_seconds']==d['time_seconds']:
                remaining.append(d);continue
            key,target={'ISOLATE_HEATER':('heater_isolated',True),'RETRY_HEATER':('heater_isolated',False),
                'SWITCH_REDUNDANT_ADCS':('redundant_adcs',True),'RESET_RADIO_ATTEMPT':('comms_up',True),
                'REQUEST_NORMAL_MODE':('mode','normal'),'REQUEST_SAFE_MODE':('mode','safe')}[d['action']]
            d['observed_outcome']=dict(time_seconds=row['time_seconds'],field=key,value=row[key],
                expected=target,status='ACHIEVED' if row[key]==target else 'NOT_ACHIEVED',
                interpretation='Observed modeled effect; not a lasting repair or causal mission benefit')
            self.agent_state['validation']['compute_units']+=1;self.agent_state['validation']['status']='COMPLETE'
        self.pending=remaining

    def checkpoint(self):
        return dict(schema_version='commander-checkpoint-1.0',steps=self.steps,last_state=deepcopy(self.last_state),
            decisions=deepcopy(self.decisions),agents=deepcopy(self.agent_state),
            limitation='Interval-boundary mission record; not a resumable physics-integrator/RNG checkpoint')

    def report(self):
        if self.budget_exhausted:self.agent_state['commander']['status']='BUDGET_EXHAUSTED'
        for d in self.pending:d['observed_outcome']=dict(status='NOT_OBSERVED',reason='Run ended before verification interval')
        return dict(schema_version='assurance-audit-1.0',options=self.options,decisions=self.decisions,
            agents=list(self.agent_state.values()),intervals=self.steps,budget_exhausted=self.budget_exhausted,
            orchestrator='MissionIntelligenceOrchestrator',agent_registry=self.registry.discover(),
            dependency_graph=[['power','commander'],['thermal','commander'],['diagnostic','recovery'],
                ['recovery','commander'],['commander','validation'],['validation','safety'],
                ['safety','simulated_plant'],['simulated_plant','validation']],
            llm=dict(connected=False,required=False,status='Deterministic specialists active; no LLM tools configured'),
            audit_sha256=digest(self.decisions))


# Compatibility for the physics engine and existing local callers.
MissionCommander=MissionIntelligenceOrchestrator
