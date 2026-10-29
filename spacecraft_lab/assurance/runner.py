"""Complete opt-in assurance experiment and protected no-recovery comparator."""
from ..reliability import run_strategy
from .contracts import validate_options,implementation_manifest
from . import VERSION


def run_assurance(scenario,options=None,cancelled=None):
    options=validate_options({} if options is None else options)
    manifest=implementation_manifest()
    result=run_strategy(scenario,'basic',assurance_options=options,cancelled=cancelled)
    result['schema_version']='mission-assurance-1.0'
    result['assurance_version']=VERSION
    result['implementation_sha256']=manifest
    result['baseline']=run_strategy(scenario,'none',cancelled=cancelled)
    result['comparison']={key:result['metrics'][key]-result['baseline']['metrics'][key] for key in result['metrics']}
    result['assurance']['safety_summary']=dict(
        proposals=len(result['assurance']['decisions']),approved=sum(d['safety_check_result']['approved'] for d in result['assurance']['decisions']),
        rejected=sum(not d['safety_check_result']['approved'] for d in result['assurance']['decisions']),
        executed=sum(d['execution_status']=='EXECUTED' for d in result['assurance']['decisions']))
    result['assurance']['limitations']='Rule-based specialists, finite vocabulary, conservative guards, approximate existing plant. No orbital, propulsion, payload, fleet, LLM or arbitrary-code capabilities. Comparisons are synthetic outcomes, not evidence of general AI superiority.'
    implementation_manifest()  # Refuse completion if implementation changed during the run.
    return result
