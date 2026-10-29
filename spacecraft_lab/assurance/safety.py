"""Independent deterministic pre-actuation gate. Never imports agents or an LLM."""
import math
from copy import deepcopy

from .contracts import validate_proposal, PERMISSIONS, ACTUATORS, digest


class SafetyKernel:
    def verify(self,state,candidate,*,evidence_state=None):
        reasons=[]
        try:
            validate_proposal(candidate)
            observation=state if evidence_state is None else evidence_state
            if candidate['run_id']!=observation['run_id'] or candidate['mission_state_sha256']!=digest(observation):
                reasons.append('MISSION_STATE_BINDING_MISMATCH')
            numeric=('battery_wh','battery_capacity_wh','temperature_k','low_temperature_k','high_temperature_k',
                'heater_on_below_k','discharge_efficiency','discharge_limit_w','base_load_w','radio_load_w','pointing_error_deg','unserved_w')
            if any(type(state[k]) not in (int,float) or not math.isfinite(state[k]) for k in numeric):raise ValueError('Nonfinite or nonnumeric state')
            for key in ('time_seconds','dt_seconds','heater_attempts','radio_attempts','last_radio_attempt','stable_seconds'):
                if type(state[key]) is not int:raise ValueError('Noninteger clock/counter')
            if state['dt_seconds']<=0 or state['time_seconds']<0 or min(state['heater_attempts'],state['radio_attempts'],state['stable_seconds'])<0:raise ValueError('Invalid clock/counter bounds')
            if not 0<=state['battery_wh']<=state['battery_capacity_wh'] or state['battery_capacity_wh']<=0:raise ValueError('Battery invariant')
            if not 0<state['discharge_efficiency']<=1 or min(state['discharge_limit_w'],state['base_load_w'],state['radio_load_w'])<0:raise ValueError('Power invariant')
            if not 0<state['low_temperature_k']<state['high_temperature_k'] or state['temperature_k']<=0:raise ValueError('Temperature invariant')
            if state['mode'] not in ('normal','safe') or type(state['comms_up']) is not bool:raise ValueError('Invalid mode/link state')
            if type(state['adcs_redundant']) is not bool:raise ValueError('Invalid actuator state')
            if not isinstance(state['alarms'],list) or any(not isinstance(v,str) for v in state['alarms']):raise ValueError('Invalid alarms')
            if not isinstance(state['unavailable_actuators'],list) or any(v not in ACTUATORS for v in state['unavailable_actuators']):raise ValueError('Invalid actuator availability')
            extra=state.get('additional_load_w',0);storage_loss=state.get('storage_loss_w',0)
            normal_load=state.get('normal_load_w',state['base_load_w'])
            reconnect=state.get('reconnect_heater_load_w',0)
            if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in (extra,storage_loss,normal_load,reconnect)):raise ValueError('Invalid full-load measurement')
            isolated=state['heater_isolated_since']
            if isolated is not None and (type(isolated) is not int or not 0<=isolated<=state['time_seconds']):raise ValueError('Invalid isolation clock')
            if candidate['time_seconds']!=state['time_seconds'] or candidate['evidence']!=[f"telemetry:{state['time_seconds']}"]:reasons.append('STALE_OR_UNBOUND_EVIDENCE')
            action=candidate['action']
            if action not in PERMISSIONS[candidate['source_agent']]:reasons.append('AGENT_PERMISSION_DENIED')
            actuator={'ISOLATE_HEATER':'heater_relay','RETRY_HEATER':'heater_relay','SWITCH_REDUNDANT_ADCS':'adcs_backup','RESET_RADIO_ATTEMPT':'radio'}.get(action)
            if actuator in state['unavailable_actuators']:reasons.append('ACTUATOR_UNAVAILABLE')
            soc=100*state['battery_wh']/state['battery_capacity_wh']
            healthy_temp=state['low_temperature_k']+3<=state['temperature_k']<=state['high_temperature_k']-3
            alarms=state['alarms']
            if action=='ISOLATE_HEATER':
                if 'heater_stuck_on' not in alarms:reasons.append('NO_CONFIRMED_HEATER_ALARM')
                if isolated is not None:reasons.append('ALREADY_ISOLATED')
            elif action=='RETRY_HEATER':
                if isolated is None or state['time_seconds']-isolated<300:reasons.append('ISOLATION_DWELL_NOT_MET')
                if state['heater_attempts']>=2:reasons.append('RETRY_BUDGET_EXHAUSTED')
                if not healthy_temp or state['temperature_k']>=state['heater_on_below_k']:reasons.append('HEATER_RECONNECT_THERMAL_MARGIN')
                if soc<40:reasons.append('INSUFFICIENT_RECOVERY_RESERVE')
                if 'heater_stuck_on' in alarms:reasons.append('HEATER_ALARM_PERSISTS')
                demand=state['base_load_w']+state['radio_load_w']+extra+reconnect
                if demand>state['discharge_limit_w'] or state['battery_wh']-(demand/state['discharge_efficiency']+storage_loss)*state['dt_seconds']/3600<.25*state['battery_capacity_wh']:reasons.append('HEATER_RECONNECT_POWER_BUDGET')
            elif action=='SWITCH_REDUNDANT_ADCS':
                if 'attitude_fault' not in alarms:reasons.append('NO_CONFIRMED_ATTITUDE_ALARM')
                if state['adcs_redundant']:reasons.append('REDUNDANCY_ALREADY_USED')
                if soc<10:reasons.append('INSUFFICIENT_ACTUATOR_RESERVE')
            elif action=='RESET_RADIO_ATTEMPT':
                if 'comms_loss' not in alarms:reasons.append('NO_CONFIRMED_RADIO_ALARM')
                if state['radio_attempts']>=2 or state['time_seconds']-state['last_radio_attempt']<120:reasons.append('RADIO_RETRY_LIMIT')
                if soc<25 or not healthy_temp:reasons.append('RESOURCE_OR_THERMAL_MARGIN')
                demand=state['base_load_w']+state['radio_load_w']+extra+5
                # Conservative one-interval power/energy check, with no solar credit.
                if demand>state['discharge_limit_w'] or state['battery_wh']-(demand/state['discharge_efficiency']+storage_loss)*state['dt_seconds']/3600<.25*state['battery_capacity_wh']:reasons.append('POWER_BUDGET_INFEASIBLE')
            elif action=='REQUEST_NORMAL_MODE':
                if soc<40 or not healthy_temp or abs(state['pointing_error_deg'])>=10 or not state['comms_up'] or state['unserved_w']>1e-9 or alarms:reasons.append('NORMAL_MODE_PRECONDITIONS')
                if state['mode']=='safe' and state['stable_seconds']+state['dt_seconds']<300:reasons.append('HEALTHY_DWELL_NOT_MET')
                demand=normal_load+state['radio_load_w']+extra
                if demand>state['discharge_limit_w'] or state['battery_wh']-(demand/state['discharge_efficiency']+storage_loss)*state['dt_seconds']/3600<.25*state['battery_capacity_wh']:reasons.append('NORMAL_POWER_BUDGET_INFEASIBLE')
        except (ValueError,TypeError,KeyError,OverflowError) as exc:
            reasons.append('INVALID_CONTRACT_OR_STATE: '+str(exc))
        try:state_digest=digest(state)
        except (ValueError,TypeError,OverflowError):
            state_digest=None;reasons.append('UNSERIALIZABLE_STATE')
        return dict(approved=not reasons,reasons=reasons or ['ALL_MODELED_CONSTRAINTS_PASS'],
                    state_sha256=state_digest,kernel_version='safety-kernel-1.0',
                    fallback='Existing hard safe-mode supervisor remains active; no rejected action is applied')

    def verify_batch(self,state,candidates):
        """Sequentially compose accepted effects; later approvals see the combined budget."""
        priority={'REQUEST_SAFE_MODE':0,'ISOLATE_HEATER':1,'SWITCH_REDUNDANT_ADCS':2,
                  'RESET_RADIO_ATTEMPT':3,'RETRY_HEATER':4,'REQUEST_NORMAL_MODE':5}
        projected=deepcopy(state);results=[]
        for candidate in sorted(candidates,key=lambda p:priority.get(p.get('action'),99)):
            before=deepcopy(projected);verdict=self.verify(projected,candidate,evidence_state=state)
            verdict['evidence_state_sha256']=digest(state)
            verdict['projection_basis']='Current observations plus earlier accepted proposals in this interval; no solar energy credit'
            results.append(dict(candidate=candidate,verdict=verdict,projection=before))
            if not verdict['approved']:continue
            action=candidate['action']
            if action=='REQUEST_SAFE_MODE':
                projected.update(mode='safe',base_load_w=state.get('safe_load_w',state['base_load_w']),stable_seconds=0)
            elif action=='ISOLATE_HEATER':
                projected['heater_isolated_since']=state['time_seconds']
                projected['additional_load_w']=max(0,projected.get('additional_load_w',0)-state.get('connected_heater_load_w',0))
            elif action=='RETRY_HEATER':
                projected['heater_isolated_since']=None;projected['heater_attempts']+=1
                projected['additional_load_w']=projected.get('additional_load_w',0)+state.get('reconnect_heater_load_w',0)
            elif action=='RESET_RADIO_ATTEMPT':
                projected['radio_attempts']+=1;projected['last_radio_attempt']=state['time_seconds']
                projected['additional_load_w']=projected.get('additional_load_w',0)+5
            elif action=='SWITCH_REDUNDANT_ADCS':projected.update(adcs_redundant=True,pointing_error_deg=5)
            elif action=='REQUEST_NORMAL_MODE':projected.update(mode='normal',base_load_w=state.get('normal_load_w',state['base_load_w']))
        return results
