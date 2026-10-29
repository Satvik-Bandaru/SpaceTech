'use strict';
/* Same-app counterfactual research. All estimates below are read from saved engine results. */
(() => {
  const byId=id=>document.getElementById(id);
  const strategyLabels={none:'No actuator recovery',basic:'Basic',enhanced:'Enhanced',assured:'Assured'};
  const metricLabels={mission_success:'Mission success proxy / fraction',safe_mode_seconds:'Safe-mode time / s',min_battery_pct:'Minimum battery / %',max_temperature_k:'Peak temperature / K',unserved_energy_wh:'Unserved energy / Wh',comms_availability_pct:'Link availability / %',detection_latency_seconds:'Detection latency / s',false_positive_rate:'False-positive rate',false_negative_rate:'False-negative rate',immediate_action_success_rate:'Immediate action success / fraction',modeled_recovery_energy_wh:'Modeled recovery energy / Wh',load_energy_served_wh:'Load energy served / Wh'};
  const parameterLabels={solar_generation_w:'Solar generation / W',safe_load_w:'Safe-mode base load / W',normal_load_w:'Normal base load / W',initial_battery_wh:'Initial battery energy / Wh',battery_capacity_wh:'Battery capacity / Wh',eclipse_seconds:'Eclipse duration / s',sensor_noise_k:'Thermal sensor noise / K',solar_noise_w:'Solar measurement noise / W',initial_temperature_k:'Initial temperature / K'};
  const label=key=>metricLabels[key]||String(key).replaceAll('_',' ');
  const numeric=value=>typeof value==='number'&&Number.isFinite(value);
  const signed=value=>numeric(value)?(value<0?'−':'')+Math.abs(value).toFixed(3):'—';
  function parseSeeds(value){
    const tokens=String(value).split(',').map(v=>v.trim());
    if(tokens.length<1||tokens.length>8||tokens.some(v=>!/^\d+$/.test(v)))throw new Error('Use 1–8 comma-separated unsigned integer seeds.');
    const seeds=tokens.map(Number);
    if(seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295||n===9001)||new Set(seeds).size!==seeds.length)throw new Error('Seeds must be distinct uint32 integers; calibration seed 9001 is excluded.');
    return seeds;
  }
  function estimateWorkload(scenario,variantCount,seeds,strategies){
    const configurations=[scenario,...(Array.isArray(variantCount)?variantCount.map(changes=>({...scenario,...changes})):Array.from({length:variantCount},()=>scenario))];
    const intervals=configurations.map(config=>{
      const duration=config.duration_seconds??7200,dt=config.dt_seconds??10;
      if(!numeric(duration)||!numeric(dt)||duration<=0||dt<=0)throw new Error('Scenario duration and interval must be positive numbers.');
      return Math.ceil(duration/dt);
    });
    const cases=configurations.length*seeds.length*strategies.length;
    const phases=strategies.reduce((n,s)=>n+(s==='assured'?2:1),0);
    const engineIntervals=intervals.reduce((sum,n)=>sum+n,0)*seeds.length*phases;
    return {cases,engine_intervals:engineIntervals,intervals_per_config:Math.max(...intervals),within_limits:cases<=32&&engineIntervals<=20000&&intervals.every(n=>n<=2000)};
  }
  function formatEstimate(estimate){
    if(!estimate||!numeric(estimate.mean))return `Not observed (n=${estimate?.n??0})`;
    const ci=estimate.ci95;
    const bounds=Array.isArray(ci)&&ci.length===2&&ci.every(numeric)?`[${signed(ci[0])}, ${signed(ci[1])}]`:'95% interval not estimable';
    return `${signed(estimate.mean)} · ${bounds}`;
  }
  function csvCell(value){
    let text=value===null||value===undefined?'':String(value);
    if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;
    return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
  }
  const evaluationMetrics=run=>run.evaluation_metrics||run.report.research_metrics||{};
  const evaluationScope=data=>data.evaluation_scope||data.evaluation_criteria?.evaluation_scope||'Historical result: original report-specific criteria; shared reference evaluation was not recorded.';
  function criteriaDescription(criteria){
    if(!criteria)return 'Historical result: no common reference success criteria were saved. Each original report retains its configuration-specific proxy.';
    const thermal=criteria.temperature_limits_k;
    return `Common reference success criteria: final battery ≥ ${criteria.final_battery_pct_at_least}% · link availability ≥ ${criteria.comms_availability_pct_at_least}% · unserved energy ${criteria.unserved_energy_wh_below!==undefined?'< '+criteria.unserved_energy_wh_below:'≤ '+criteria.unserved_energy_wh_at_most} Wh · every recorded temperature within ${thermal?.[0]}–${thermal?.[1]} K · no engineering invariant violations. The same thresholds evaluate every variant; relaxing a variant's own limits cannot improve this campaign proxy.`;
  }
  function campaignCSV(result){
    const metrics=[...new Set(result.runs.flatMap(run=>Object.keys(evaluationMetrics(run))))];
    const rows=[['case_id','variant_id','variant_name','seed','strategy','run_id','data_provenance','model_validated_for_flight','operational_status','sampling_scope','evaluation_scope','evaluation_criteria','original_report_own_mission_success',...metrics]];
    const scope=`Paired measurement-noise seeds ${result.seeds.join(' / ')} conditional on this scenario; not independent missions or calibrated hardware reliability. Mission success is a research proxy. Not flight-qualified.`;
    for(const run of result.runs)rows.push([run.case_id,run.variant_id,result.variants.find(v=>v.variant_id===run.variant_id)?.name||run.variant_id,run.seed,run.strategy,run.report.run_id,result.data_provenance,result.model_validated_for_flight,result.operational_status,scope,evaluationScope(result),JSON.stringify(result.evaluation_criteria||null),run.report.research_metrics?.mission_success,...metrics.map(key=>evaluationMetrics(run)[key])]);
    return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  const md=value=>String(value??'').replace(/[\\`*_{}\[\]<>#|]/g,'\\$&').replace(/[\r\n]/g,' ');
  function campaignMarkdown(result){
    const lines=['# Counterfactual mission research brief','','SYNTHETIC · Simplified local simulation · Not flight-qualified','',`${result.runs.length} saved cases; ${result.variants.length} configurations; paired seeds: ${result.seeds.join(', ')}.`,
      '',`Strategies: ${result.strategies.map(s=>strategyLabels[s]||s).join(', ')}.`,
      '',md(criteriaDescription(result.evaluation_criteria)),'',`Evaluation scope: ${md(evaluationScope(result))}`,
      '',`Saved evaluation criteria: ${md(JSON.stringify(result.evaluation_criteria||null))}`,
      '','Mean intervals describe measurement-noise variation conditional on this scenario. Mission success is a research proxy; its fraction interval is Wilson 95%. A zero-width interval means no observed seed variation, not certainty. No multiple-comparison correction is applied. No flight-reliability or general strategy-superiority inference.','',
      '| Configuration | Strategy | Metric | Mean [95% interval] | n |','|---|---|---|---|---|'];
    for(const row of result.summary)for(const [key,estimate] of Object.entries(row.metrics))lines.push(`| ${md(row.name)} | ${md(strategyLabels[row.strategy]||row.strategy)} | ${md(label(key))} | ${formatEstimate(key==='mission_success'?{...estimate,ci95:row.mission_success_ci95}:estimate)} | ${estimate.n} |`);
    for(const [title,rows] of [['Paired variant − reference changes',result.paired_comparisons||[]],['Paired strategy − reference strategy changes',result.strategy_comparisons||[]]]){
      lines.push('',`## ${title}`,'','| Configuration | Strategy | Metric | Paired mean [95% interval] | Pairs |','|---|---|---|---|---|');
      for(const row of rows)for(const [key,estimate] of Object.entries(row.metrics))lines.push(`| ${md(row.variant_id)} | ${md(row.strategy)}${row.reference_strategy?' − '+md(row.reference_strategy):''} | ${md(label(key))} | ${formatEstimate(estimate)} | ${estimate.n} |`);
    }
    lines.push('','Full per-case configuration, telemetry, checks and provenance are retained in the JSON export. CSV contains campaign evaluation metrics and separately labels each original report\'s configuration-specific success proxy.','');
    return lines.join('\n');
  }
  const api={parseSeeds,estimateWorkload,formatEstimate,csvCell,campaignCSV,campaignMarkdown,evaluationMetrics};
  window.CampaignUI=api;
  if(!byId('campaign'))return;
  let selectedJob=null,result=null,pollTimer=null,inspection=0,historyInspection=0,variantSerial=0;
  const variants=[];
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const option=(value,text)=>{const node=el('option',text);node.value=value;return node;};
  function error(message){byId('campaign-error').hidden=!message;byId('campaign-error').textContent=message||'';}
  function setStatus(message){byId('campaign-job-status').textContent=message;}
  async function request(path,data){
    const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    let value;try{value=await response.json();}catch{throw new Error('The local workflow returned an unreadable response.');}
    if(!response.ok)throw new Error(value.error||`Local workflow request failed (${response.status}).`);
    return value;
  }
  const activeStatus=status=>['RUNNING','QUEUED','CANCEL_REQUESTED'].includes(status);
  function stopPolling(){clearTimeout(pollTimer);pollTimer=null;inspection++;}
  api.stopPolling=stopPolling;
  function clearResults(){
    result=null;byId('campaign-results').hidden=true;
    for(const id of ['campaign-json','campaign-csv','campaign-markdown','campaign-replay'])byId(id).disabled=true;
    for(const id of ['campaign-summary','campaign-chart','campaign-paired','campaign-strategy-comparisons','campaign-case','campaign-run-summary'])byId(id).replaceChildren();
    byId('campaign-run-detail').textContent='';
  }
  function beginInspection(){stopPolling();error('');clearResults();selectedJob=null;byId('campaign-approve').disabled=true;byId('campaign-cancel').disabled=true;byId('campaign-prepare').disabled=false;return inspection;}
  function scenario(){
    if(byId('campaign-source').value==='demo')return {name:'Mission assurance acceptance',duration_seconds:3600,dt_seconds:10,seed:7,initial_battery_wh:40,faults:[{kind:'solar_array_loss',start_seconds:0,duration_seconds:600,severity:.8},{kind:'heater_stuck_on',start_seconds:100,duration_seconds:900,severity:1},{kind:'comms_loss',start_seconds:300,duration_seconds:600,severity:1}]};
    const draft=JSON.parse(byId('scenario-json').value);
    if(!draft||Array.isArray(draft)||typeof draft!=='object')throw new Error('The Scenario studio draft must be a JSON object.');
    return draft;
  }
  const chosenStrategies=()=>Array.from(document.querySelectorAll('input[name="campaign-strategy"]')).filter(node=>node.checked).map(node=>node.value);
  function updateWorkload(){
    try{
      const seeds=parseSeeds(byId('campaign-seeds').value),strategies=chosenStrategies();
      const work=estimateWorkload(scenario(),readVariants().map(v=>v.changes),seeds,strategies);
      byId('campaign-workload').textContent=`${work.cases} cases · ${work.engine_intervals.toLocaleString()} engine intervals`;
      byId('campaign-workload-detail').textContent=`${variants.length+1} configurations × ${seeds.length} seeds × ${strategies.length} strategies. Assured cases include a matched baseline phase. Limits: 32 cases / 20,000 weighted intervals / 2,000 per configuration.${work.within_limits?'':' Reduce variants, seeds, strategies or mission duration.'}${strategies.length<2?' Select at least two strategies.':''}`;
      byId('campaign-workload').className=work.within_limits&&strategies.length>=2?'':'campaign-bound-warning';
    }catch(cause){byId('campaign-workload').textContent='Check experiment inputs';byId('campaign-workload-detail').textContent=cause.message;}
  }
  function addVariant(defaults={}){
    if(variants.length>=3)return;
    const serial=++variantSerial,card=el('article',undefined,'campaign-variant');
    const top=el('div',undefined,'campaign-variant-head'),marker=el('span',`V${serial}`,'campaign-variant-mark'),name=el('input'),remove=el('button','Remove','campaign-remove');
    name.value=defaults.name||`What-if ${serial}`;name.type='text';name.maxLength=80;name.setAttribute('aria-label',`Variant ${serial} name`);remove.type='button';remove.setAttribute('aria-label',`Remove variant ${serial}`);top.append(marker,name,remove);
    const fields=el('div',undefined,'campaign-variant-fields'),parameter=el('select'),value=el('input'),parameterLabel=el('label','Change parameter'),valueLabel=el('label','New value');
    for(const [key,text] of Object.entries(parameterLabels))parameter.append(option(key,text));
    parameter.value=defaults.parameter||'solar_generation_w';value.type='number';value.step='any';value.value=String(defaults.value??220);parameterLabel.append(parameter);valueLabel.append(value);fields.append(parameterLabel,valueLabel);
    const details=el('details'),summary=el('summary','Advanced scenario changes / JSON'),changes=el('textarea'),hint=el('p','Optional object for bounded fields such as faults or sensor_noise_k. The selected numeric parameter above must not be repeated. The server validates every field.','campaign-help');
    changes.value='{}';changes.spellcheck=false;changes.setAttribute('aria-label',`Advanced JSON changes for variant ${serial}`);details.append(summary,changes,hint);card.append(top,fields,details);
    const record={serial,card,name,parameter,value,changes};variants.push(record);byId('campaign-variants').append(card);
    remove.addEventListener('click',()=>{if(variants.length<=1)return;variants.splice(variants.indexOf(record),1);card.remove();refreshVariants();});
    for(const input of [name,parameter,value,changes])input.addEventListener('input',updateWorkload);
    refreshVariants();
  }
  function refreshVariants(){
    byId('campaign-add').disabled=variants.length>=3;byId('campaign-variant-count').textContent=`${variants.length} VARIANT${variants.length===1?'':'S'}`;
    for(const record of variants)record.card.children[0].children[2].disabled=variants.length<=1;
    updateWorkload();
  }
  function readVariants(){
    return variants.map(record=>{
      const variantName=record.name.value.trim(),value=Number(record.value.value),changes=JSON.parse(record.changes.value);
      if(!variantName||variantName.length>80)throw new Error('Each variant needs a name with 1–80 characters.');
      if(!record.value.value.trim()||!numeric(value))throw new Error(`${variantName}: enter a finite numeric value.`);
      if(!changes||Array.isArray(changes)||typeof changes!=='object')throw new Error(`${variantName}: advanced changes must be a JSON object.`);
      if(Object.hasOwn(changes,record.parameter.value))throw new Error(`${variantName}: remove the repeated numeric parameter from advanced JSON.`);
      return {name:variantName,changes:{...changes,[record.parameter.value]:value}};
    });
  }
  function collectOptions(){
    const seeds=parseSeeds(byId('campaign-seeds').value),strategies=chosenStrategies(),base=scenario(),name=byId('campaign-name').value.trim();
    if(!name||name.length>80)throw new Error('Campaign name must contain 1–80 characters.');
    if(strategies.length<2)throw new Error('Select at least two recovery strategies.');
    const choices=readVariants(),work=estimateWorkload(base,choices.map(v=>v.changes),seeds,strategies);
    if(!work.within_limits)throw new Error('Campaign exceeds 32 cases, 20,000 weighted engine intervals or 2,000 intervals per configuration. Reduce the experiment.');
    return {name,scenario:base,variants:choices,seeds,strategies,assurance_options:{}};
  }
  function renderJob(job){
    selectedJob=job;byId('campaign-job-id').value=job.job_id;byId('campaign-job-state').textContent=job.status;
    byId('campaign-approve').disabled=job.status!=='PREPARED';byId('campaign-cancel').disabled=['COMPLETE','FAILED','CANCELLED'].includes(job.status);
    byId('campaign-plan').textContent=JSON.stringify({job_id:job.job_id,plan_sha256:job.plan_sha256,plan:job.plan,checkpoint:job.checkpoint,audit:job.audit},null,2);
    const progress=job.progress||{},done=progress.completed_cases??progress.completed_runs??progress.completed??0,total=progress.total_cases??progress.total_runs??progress.total??0;
    byId('campaign-progress').value=job.status==='COMPLETE'?1:total?done/total:0;
    const detail=total?` · ${done}/${total} cases`:'';
    setStatus(`${job.status}${detail} · ${job.job_id}${job.error?' · '+job.error:''}${job.status==='PREPARED'?' · Plan saved; no simulation has executed. Inspect the digest before approval.':''}`);
  }
  function summaryEstimate(row,key){
    const estimate=row.metrics?.[key];
    if(key==='mission_success'&&Array.isArray(row.mission_success_ci95))return {...estimate,ci95:row.mission_success_ci95};
    return estimate;
  }
  function metricKeys(data){return [...new Set(data.summary.flatMap(row=>Object.keys(row.metrics)))];}
  function renderSummary(data){
    const met=data.runs.filter(run=>evaluationMetrics(run).mission_success===1).length;
    for(const [title,value,detail] of [['SAVED SIMULATIONS',data.runs.length,'Every case includes its actual report'],['CONFIGURATIONS',data.variants.length,'Unchanged reference + declared variants'],['PAIRED NOISE SEEDS',data.seeds.length,data.seeds.join(' · ')],[data.evaluation_criteria?'COMMON SUCCESS PROXY MET':'ORIGINAL SUCCESS PROXY MET',`${met} / ${data.runs.length}`,data.evaluation_criteria?'Shared reference criteria; descriptive case count':'Historical own-configuration criteria']]){
      const card=el('article'),caption=el('span',title,'tiny'),number=el('strong',String(value)),note=el('p',detail);card.append(caption,number,note);byId('campaign-summary').append(card);
    }
    byId('campaign-result-meta').className='explanation campaign-evaluation-criteria';
    byId('campaign-result-meta').textContent=`${data.configuration?.name||selectedJob?.name||'Counterfactual campaign'} · ${data.schema_version} · ${data.strategies.map(s=>strategyLabels[s]||s).join(' / ')} · Results restored from saved simulator reports.\n\n${criteriaDescription(data.evaluation_criteria)}`;
  }
  function renderChart(){
    if(!result)return;
    const svg=byId('campaign-chart'),key=byId('campaign-metric').value,rows=result.summary,ns='http://www.w3.org/2000/svg';svg.replaceChildren();
    const width=1000,left=265,right=915,top=43,rowHeight=43,height=top+rows.length*rowHeight+30;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-label',`${label(key)}: means and saved 95 percent confidence intervals across paired noise seeds`);
    const values=rows.flatMap(row=>{const stat=summaryEstimate(row,key);return !numeric(stat?.mean)?[]:[stat.mean,...(Array.isArray(stat.ci95)?stat.ci95.filter(numeric):[])];});
    let low=Math.min(0,...values),high=Math.max(0,...values);if(high===low)high=low+1;
    const pad=(high-low)*.035;low-=pad;high+=pad;const x=value=>left+(value-low)/(high-low)*(right-left);
    const node=(tag,attrs,text)=>{const item=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))item.setAttribute(k,v);if(text!==undefined)item.textContent=text;svg.append(item);return item;};
    node('title',{},`${label(key)}. Means and 95% intervals; absent intervals are explicitly labeled.`);
    for(let tick=0;tick<5;tick++){
      const v=low+(high-low)*tick/4;node('line',{x1:x(v),x2:x(v),y1:25,y2:height-23,stroke:'#29394d','stroke-dasharray':'3 5'});node('text',{x:x(v),y:14,'text-anchor':'middle',class:'campaign-axis'},signed(v));
    }
    node('line',{x1:x(0),x2:x(0),y1:25,y2:height-23,stroke:'#69819b'});
    rows.forEach((row,i)=>{
      const y=top+i*rowHeight,stat=summaryEstimate(row,key),text=`${row.name} / ${strategyLabels[row.strategy]||row.strategy}`,color={none:'#8394aa',basic:'#67dfcc',enhanced:'#ad9fff',assured:'#f7bc6a'}[row.strategy]||'#67dfcc';
      const name=node('text',{x:13,y:y+4,class:'campaign-chart-label'},text.length>37?text.slice(0,35)+'…':text),nameTitle=document.createElementNS(ns,'title');nameTitle.textContent=text;name.append(nameTitle);
      if(!numeric(stat?.mean)){node('text',{x:left+10,y:y+4,class:'campaign-axis'},'Not observed · n=0');return;}
      node('rect',{x:Math.min(x(0),x(stat.mean)),y:y-8,width:Math.max(1,Math.abs(x(stat.mean)-x(0))),height:16,fill:color,opacity:.55,rx:2});
      node('circle',{cx:x(stat.mean),cy:y,r:3.5,fill:color});
      if(Array.isArray(stat.ci95)&&stat.ci95.length===2&&stat.ci95.every(numeric)){
        const [a,b]=stat.ci95;node('line',{x1:x(a),x2:x(b),y1:y,y2:y,stroke:color,'stroke-width':2});
        for(const bound of [a,b])node('line',{x1:x(bound),x2:x(bound),y1:y-6,y2:y+6,stroke:color,'stroke-width':2});
      }else node('text',{x:left+8,y:y+21,class:'campaign-axis'},'95% interval not estimable');
      const point=node('text',{x:width-9,y:y+4,'text-anchor':'end',class:'campaign-chart-value'},signed(stat.mean)),pointTitle=document.createElementNS(ns,'title');pointTitle.textContent=`${formatEstimate(stat)}; n=${stat.n}`;point.append(pointTitle);
    });
    byId('campaign-chart-note').textContent=`${label(key)} · Higher values ${['min_battery_pct','comms_availability_pct','mission_success','load_energy_served_wh','immediate_action_success_rate'].includes(key)?'can indicate a better modeled outcome':'are not necessarily better'}. Axis includes zero and the full returned intervals; intervals are never clipped to physical bounds. n=${result.seeds.length} planned paired seeds; missing observations can reduce metric n.`;
    renderComparisons(key);
  }
  function renderComparisons(key){
    const name=id=>result.variants.find(v=>v.variant_id===id)?.name||id;
    for(const [target,rows,strategy] of [['campaign-paired',result.paired_comparisons,false],['campaign-strategy-comparisons',result.strategy_comparisons,true]]){
      const tbody=byId(target);tbody.replaceChildren();
      if(!rows?.length){const row=el('tr'),cell=el('td',strategy?'No paired strategy comparisons in this saved result.':'No paired variant comparisons.');cell.colSpan=4;row.append(cell);tbody.append(row);continue;}
      for(const comparison of rows){
        const estimate=comparison.metrics?.[key],row=el('tr');
        for(const value of [name(comparison.variant_id),strategy?`${strategyLabels[comparison.strategy]||comparison.strategy} − ${strategyLabels[comparison.reference_strategy]||comparison.reference_strategy||'Basic'}`:strategyLabels[comparison.strategy]||comparison.strategy,formatEstimate(estimate),estimate?.n??0])row.append(el('td',String(value)));
        tbody.append(row);
      }
    }
  }
  function selectedCase(){return result?.runs.find(run=>run.case_id===byId('campaign-case').value);}
  function renderCase(){
    const run=selectedCase();byId('campaign-run-summary').replaceChildren();byId('campaign-replay').disabled=!run;
    if(!run)return;
    const report=run.report;
    for(const [caption,value] of [['ENGINE RUN',report.run_id],['SEED / STRATEGY',`${run.seed} / ${strategyLabels[run.strategy]||run.strategy}`],['RECORDED INTERVALS',report.telemetry?.length??0],['ENGINE INVARIANT VIOLATIONS',report.checks?.violations?.length??'Not supplied']]){
      const item=el('div');item.append(el('span',caption,'tiny'),el('strong',String(value)));byId('campaign-run-summary').append(item);
    }
    byId('campaign-run-detail').textContent=JSON.stringify({case_id:run.case_id,variant_id:run.variant_id,seed:run.seed,strategy:run.strategy,run_id:report.run_id,config:report.config,
      evaluation:{scope:evaluationScope(result),common_reference_criteria:result.evaluation_criteria||null,common_reference_metrics:run.evaluation_metrics||null,original_report_own_proxy_criteria:report.mission_criteria,original_report_own_proxy_metrics:report.research_metrics,note:'Campaign summaries use common reference metrics when recorded. Original report-specific metrics remain unchanged for replay.'},checks:report.checks,
      provenance:{data_provenance:report.data_provenance??result.data_provenance,model_validated_for_flight:report.model_validated_for_flight??result.model_validated_for_flight,operational_status:report.operational_status??result.operational_status,scenario_sha256:report.scenario_sha256,implementation_sha256:report.implementation_sha256||result.source_sha256,implementation_digest_source:report.implementation_sha256?'original report implementation manifest':'campaign source manifest',campaign_source_sha256:result.source_sha256},
      assurance:report.assurance?{safety_summary:report.assurance.safety_summary}:undefined},null,2);
  }
  function renderResult(data){
    if(data.schema_version!=='counterfactual-campaign-1.0'||!Array.isArray(data.runs)||!Array.isArray(data.summary))throw new Error('Saved result is not a supported counterfactual campaign.');
    clearResults();result=data;byId('campaign-results').hidden=false;renderSummary(data);
    const metric=byId('campaign-metric');metric.replaceChildren();for(const key of metricKeys(data))metric.append(option(key,label(key)));metric.value=metricKeys(data).includes('safe_mode_seconds')?'safe_mode_seconds':metricKeys(data)[0];
    for(const run of data.runs){const name=data.variants.find(v=>v.variant_id===run.variant_id)?.name||run.variant_id;byId('campaign-case').append(option(run.case_id,`${name} · seed ${run.seed} · ${strategyLabels[run.strategy]||run.strategy}`));}
    if(data.runs.length)byId('campaign-case').value=data.runs[0].case_id;
    for(const id of ['campaign-json','campaign-csv','campaign-markdown'])byId(id).disabled=false;
    renderChart();renderCase();
  }
  async function inspect(id,token){
    const job=await request(`/api/assurance/jobs/${encodeURIComponent(id)}`);if(token!==inspection)return;
    if(job.kind&&job.kind!=='campaign'&&job.kind!=='counterfactual'){
      stopPolling();if(typeof window.inspectAssuranceJob==='function'){document.querySelector('[data-view="assurance"]')?.click();await window.inspectAssuranceJob(id);return;}
      throw new Error('This is an assurance job; open it in Mission assurance.');
    }
    renderJob(job);
    if(job.status==='COMPLETE'){
      const data=await request(`/api/assurance/jobs/${encodeURIComponent(id)}/result`);if(token!==inspection)return;renderResult(data);
    }else if(activeStatus(job.status))pollTimer=setTimeout(()=>{inspect(id,token).catch(cause=>{if(token===inspection){error(cause.message);setStatus('Job inspection stopped. Open the saved job to retry.');}});},600);
  }
  async function openJob(id){
    const token=beginInspection();if(!/^[a-f0-9]{32}$/.test(id))throw new Error('Enter a saved 32-character hexadecimal job ID.');
    setStatus('Opening saved experiment…');await inspect(id,token);
  }
  async function refreshHistory(){
    const token=++historyInspection;byId('campaign-history-refresh').disabled=true;
    try{
      const data=await request('/api/jobs?limit=20');if(token!==historyInspection)return;
      byId('campaign-history').replaceChildren();byId('campaign-history-status').textContent=`${data.jobs.length} most recent of ${data.total} saved local jobs. Complete reports restore without rerunning the simulator.`;
      for(const job of data.jobs){
        const row=el('tr'),name=el('td'),title=el('strong',job.name||job.job_id),identifier=el('small',job.job_id);name.append(title,identifier);row.append(name);
        for(const value of [job.kind||'assurance',job.status,job.created_at?new Date(job.created_at).toLocaleString():'—'])row.append(el('td',value));
        const action=el('td'),button=el('button','Open','button secondary');button.setAttribute('aria-label',`Open ${job.name||job.job_id}`);
        button.addEventListener('click',async()=>{
          try{
            if(job.kind==='assurance'&&typeof window.inspectAssuranceJob==='function'){stopPolling();document.querySelector('[data-view="assurance"]')?.click();await window.inspectAssuranceJob(job.job_id);}
            else{document.querySelector('[data-view="campaign"]')?.click();await openJob(job.job_id);}
          }catch(cause){error(cause.message);}
        });action.append(button);row.append(action);byId('campaign-history').append(row);
      }
    }catch(cause){if(token===historyInspection){byId('campaign-history-status').textContent=`History unavailable: ${cause.message}`;error(cause.message);}}
    finally{if(token===historyInspection)byId('campaign-history-refresh').disabled=false;}
  }
  function downloadText(content,name,type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),anchor=el('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  byId('campaign-add').addEventListener('click',()=>addVariant());
  for(const id of ['campaign-seeds','campaign-source'])byId(id).addEventListener('input',updateWorkload);
  byId('scenario-json')?.addEventListener('input',updateWorkload);
  for(const input of document.querySelectorAll('input[name="campaign-strategy"]'))input.addEventListener('change',updateWorkload);
  byId('campaign-prepare').addEventListener('click',async()=>{
    let token;
    try{
      const options=collectOptions();token=beginInspection();byId('campaign-prepare').disabled=true;setStatus('Validating and saving the exact campaign plan…');
      const job=await request('/api/campaigns/prepare',options);if(token!==inspection)return;renderJob(job);byId('campaign-plan-details').open=true;refreshHistory();
    }catch(cause){if(token===undefined||token===inspection){error(`Plan not prepared: ${cause.message}`);setStatus('Campaign needs valid inputs before preparation.');}}
    finally{if(token===inspection||token===undefined)byId('campaign-prepare').disabled=false;}
  });
  byId('campaign-approve').addEventListener('click',async()=>{
    if(selectedJob?.status!=='PREPARED')return;
    const token=inspection,id=selectedJob.job_id,digest=selectedJob.plan_sha256;byId('campaign-approve').disabled=true;
    try{const job=await request('/api/assurance/approve',{job_id:id,plan_sha256:digest});if(token!==inspection)return;renderJob(job);await inspect(id,token);refreshHistory();}
    catch(cause){if(token===inspection){error(`Approval/run failed: ${cause.message}`);byId('campaign-approve').disabled=selectedJob?.status!=='PREPARED';}}
  });
  byId('campaign-cancel').addEventListener('click',async()=>{
    if(!selectedJob)return;const token=inspection,id=selectedJob.job_id;byId('campaign-cancel').disabled=true;
    try{const job=await request('/api/assurance/cancel',{job_id:id});if(token!==inspection)return;clearTimeout(pollTimer);renderJob(job);await inspect(id,token);refreshHistory();}
    catch(cause){if(token===inspection){error(cause.message);byId('campaign-cancel').disabled=false;}}
  });
  byId('campaign-restore').addEventListener('click',()=>openJob(byId('campaign-job-id').value.trim()).catch(cause=>error(cause.message)));
  byId('campaign-history-refresh').addEventListener('click',refreshHistory);
  byId('campaign-metric').addEventListener('change',renderChart);byId('campaign-case').addEventListener('change',renderCase);
  byId('campaign-replay').addEventListener('click',()=>{
    const run=selectedCase();if(!run)return;
    if(typeof window.replayRecordedReport!=='function'){error('Recorded-run replay is unavailable. Reload the local application.');return;}
    window.replayRecordedReport(run.report,`${run.variant_id} · seed ${run.seed} · ${strategyLabels[run.strategy]||run.strategy}`);
  });
  for(const [id,extension,type,serialize] of [['campaign-json','json','application/json',data=>JSON.stringify(data,null,2)],['campaign-csv','csv','text/csv;charset=utf-8',campaignCSV],['campaign-markdown','md','text/markdown;charset=utf-8',campaignMarkdown]])byId(id).addEventListener('click',()=>{if(result)downloadText(serialize(result),`counterfactual-${selectedJob?.job_id||'campaign'}.${extension}`,type);});
  document.querySelector('[data-view="campaign"]')?.addEventListener('click',()=>{updateWorkload();refreshHistory();});
  Object.assign(api,{openJob,refreshHistory,collectOptions,renderResult,getSelectedCase:selectedCase,getSelectedJob:()=>selectedJob,getResult:()=>result});
  addVariant({name:'More solar',parameter:'solar_generation_w',value:220});addVariant({name:'Lower safe load',parameter:'safe_load_w',value:25});
})();
