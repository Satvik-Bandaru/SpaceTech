'use strict';
let assuranceJob=null,assuranceResult=null,assurancePoll=null;
let assuranceResultJobId=null,assuranceInspection=0;
const assuranceDemo={name:'Mission assurance acceptance',duration_seconds:3600,dt_seconds:10,seed:7,initial_battery_wh:40,
  faults:[{kind:'solar_array_loss',start_seconds:0,duration_seconds:600,severity:.8},
    {kind:'heater_stuck_on',start_seconds:100,duration_seconds:900,severity:1},
    {kind:'comms_loss',start_seconds:300,duration_seconds:600,severity:1}]};

async function assuranceRequest(path,data){
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'Workflow request failed');return value;
}
function assuranceStatus(text){$('assurance-job-status').textContent=text;}
function renderAssuranceJob(job){
  if(assuranceResultJobId!==job.job_id){
    assuranceResult=null;$('assurance-replay').disabled=true;$('assurance-export').disabled=true;
    for(const id of ['assurance-agents','assurance-decisions','assurance-comparison'])$(id).replaceChildren();
    $('assurance-totals').textContent='NO RESULTS FOR THIS JOB';$('assurance-dependencies').textContent='';
  }
  assuranceJob=job;$('assurance-job-id').value=job.job_id;
  $('assurance-plan').textContent=JSON.stringify({job_id:job.job_id,plan_sha256:job.plan_sha256,plan:job.plan,checkpoint:job.checkpoint,audit:job.audit},null,2);
  assuranceStatus(`${job.status} · ${job.job_id}${job.error?' · '+job.error:''}`);
  $('assurance-approve').disabled=job.status!=='PREPARED';
  $('assurance-cancel').disabled=['COMPLETE','FAILED','CANCELLED'].includes(job.status);
}
function renderAssuranceResult(result,jobId){
  assuranceResult=result;assuranceResultJobId=jobId;const audit=result.assurance;
  $('assurance-replay').disabled=false;$('assurance-export').disabled=false;
  $('assurance-totals').textContent=`${audit.safety_summary.proposals} proposals · ${audit.safety_summary.rejected} rejected · ${audit.safety_summary.executed} executed`;
  $('assurance-agents').replaceChildren();
  for(const agent of audit.agents){
    const card=document.createElement('article');card.className='agent-card';
    const title=document.createElement('strong');title.textContent=agent.agent_id;
    const status=document.createElement('p');status.textContent=`${agent.status} · ${agent.compute_units} compute units`;
    const details=document.createElement('details'),summary=document.createElement('summary'),evidence=document.createElement('p');
    summary.textContent='Permissions & evidence';evidence.textContent=JSON.stringify({allowed_tools:agent.allowed_tools,last_evidence:agent.last_evidence,uncertainty:agent.uncertainty});
    details.append(summary,evidence);card.append(title,status,details);$('assurance-agents').append(card);
  }
  $('assurance-dependencies').textContent=`Fixed dependency graph: ${audit.dependency_graph.map(edge=>edge.join(' → ')).join(' · ')}. LLM: not connected; deterministic agents remain active.`;
  $('assurance-decisions').replaceChildren();
  for(const decision of audit.decisions){
    const d=document.createElement('details');d.className=decision.safety_check_result.approved?'decision-approved':'decision-rejected';
    const s=document.createElement('summary');s.textContent=`T+ ${time(decision.time_seconds)} · ${decision.source_agent} · ${words(decision.action)} · ${decision.execution_status}`;
    const p=document.createElement('pre');p.textContent=JSON.stringify(decision,null,2);d.append(s,p);$('assurance-decisions').append(d);
  }
  $('assurance-comparison').replaceChildren();
  for(const [label,key] of [['Safe-mode time / s','safe_mode_seconds'],['Minimum battery / %','min_battery_pct'],['Peak temperature / K','max_temperature_k'],['Unserved energy / Wh','unserved_energy_wh'],['Link availability / %','comms_availability_pct']]){
    const tr=document.createElement('tr');for(const value of [label,fmt(result.baseline.metrics[key],3),fmt(result.metrics[key],3)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('assurance-comparison').append(tr);
  }
}
async function inspectAssuranceJob(id){
  clearTimeout(assurancePoll);
  const inspection=++assuranceInspection;
  const job=await assuranceRequest(`/api/assurance/jobs/${encodeURIComponent(id)}`);
  if(inspection!==assuranceInspection)return;
  renderAssuranceJob(job);
  if(job.status==='COMPLETE'){
    const result=await assuranceRequest(`/api/assurance/jobs/${job.job_id}/result`);
    if(inspection===assuranceInspection)renderAssuranceResult(result,job.job_id);
  }
  else if(['RUNNING','QUEUED','CANCEL_REQUESTED'].includes(job.status))assurancePoll=setTimeout(()=>inspectAssuranceJob(job.job_id).catch(error=>assuranceStatus(error.message)),500);
}
$('assurance-prepare').addEventListener('click',async()=>{
  try{
    clearTimeout(assurancePoll);assuranceInspection++;$('assurance-prepare').disabled=true;
    const scenario=$('assurance-source').value==='demo'?structuredClone(assuranceDemo):JSON.parse($('scenario-json').value);
    const options={max_decisions:Number($('assurance-budget').value),probe_unsafe:$('assurance-probe').checked};
    const job=await assuranceRequest('/api/assurance/prepare',{scenario,options});
    assuranceResult=null;$('assurance-replay').disabled=true;$('assurance-export').disabled=true;renderAssuranceJob(job);
  }catch(error){assuranceStatus(`Plan not prepared: ${error.message}`);}
  finally{$('assurance-prepare').disabled=false;}
});
$('assurance-approve').addEventListener('click',async()=>{
  if(!assuranceJob||assuranceJob.status!=='PREPARED')return;
  try{
    $('assurance-approve').disabled=true;
    const job=await assuranceRequest('/api/assurance/approve',{job_id:assuranceJob.job_id,plan_sha256:assuranceJob.plan_sha256});
    renderAssuranceJob(job);await inspectAssuranceJob(job.job_id);
  }catch(error){assuranceStatus(`Approval/run failed: ${error.message}`);}
});
$('assurance-cancel').addEventListener('click',async()=>{
  if(!assuranceJob)return;
  try{renderAssuranceJob(await assuranceRequest('/api/assurance/cancel',{job_id:assuranceJob.job_id}));await inspectAssuranceJob(assuranceJob.job_id);}catch(error){assuranceStatus(error.message);}
});
$('assurance-restore').addEventListener('click',()=>inspectAssuranceJob($('assurance-job-id').value.trim()).catch(error=>assuranceStatus(error.message)));
$('assurance-export').addEventListener('click',()=>{if(assuranceResult)download(assuranceResult,'mission-assurance-evidence.json');});
$('assurance-replay').addEventListener('click',()=>{
  if(!assuranceResult)return;
  pause();assuredReplay=assuranceResult;index=0;$('policy').disabled=true;
  $('scrubber').max=assuredReplay.telemetry.length-1;$('scrubber').disabled=false;$('play').disabled=false;
  message('Assurance replay active · kernel interventions appear in the journal. Standard comparisons return to their own experiment.');
  document.querySelector('[data-view="overview"]').click();render();
});
