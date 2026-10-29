'use strict';
const $ = id => document.getElementById(id);
let reports = null, example = null, index = 0, playing = false, timer = null;
let subsystem = 'eps', busy = false;
let assuredReplay=null;
let presetLibrary={}, study=null, scene=null, view3d=false;
const strategyName={none:'No actuator recovery',basic:'Basic',enhanced:'Enhanced'};
const fmt = (n, digits = 1) => Number(n).toFixed(digits);
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const current = () => assuredReplay||reports?.[$('policy').value];
const words = value => value.replaceAll('_', ' ').toLowerCase();

function message(text, error = false) {
  $('error').hidden = !error;
  if (error) { $('error').textContent = text; $('status').textContent = 'Experiment could not be applied · inspect the message above.'; }
  else $('status').textContent = text;
}
function pause() {
  playing = false; clearTimeout(timer); timer = null;
  $('play').textContent = '▶ Play';
  $('replay-state').textContent = 'RECORDED TELEMETRY · PAUSED';
}
function tick() {
  if (!playing || !reports) return;
  if (index >= current().telemetry.length - 1) { pause(); return; }
  index++; render();
  timer = setTimeout(tick, LabUI.intervalDelay(current().config.dt_seconds,Number($('speed').value)));
}
function togglePlay() {
  if (playing) { pause(); return; }
  if (!reports) return;
  if (index >= current().telemetry.length - 1) index = 0;
  playing = true; $('play').textContent = 'Ⅱ Pause';
  $('replay-state').textContent = 'RECORDED TELEMETRY · PLAYING';
  render(); timer = setTimeout(tick, LabUI.intervalDelay(current().config.dt_seconds,Number($('speed').value)));
}

function detail(row) {
  if (subsystem === 'eps') return `Solar ${fmt(row.solar_w)} W · Served ${fmt(row.served_w)} W · Unserved ${fmt(row.unserved_w)} W · Curtailed ${fmt(row.curtailed_w)} W · Stored ${fmt(row.battery_wh)} Wh`;
  if (subsystem === 'thermal') return `Node ${fmt(row.temperature_k, 2)} K · Heat input ${fmt(row.heat_input_w)} W · Radiation ${fmt(row.radiated_w)} W · Heater ${row.heater_isolated ? 'isolated' : 'connected'}`;
  return `Mode: ${row.mode} · Diagnoses: ${row.diagnosed_faults.map(words).join(', ') || 'none'} · ADCS: ${row.redundant_adcs ? 'redundant unit' : 'primary unit'} · Injected: ${row.injected_faults.map(words).join(', ') || 'none'}`;
}

function drawChart(report) {
  const svg = $('chart'), ns = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  const node = (tag, attrs, text) => {
    const element = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) element.setAttribute(k, v);
    if (text !== undefined) element.textContent = text;
    svg.append(element); return element;
  };
  const key = $('metric').value, values = report.telemetry.map(row => row[key]);
  let low = Math.min(...values), high = Math.max(...values);
  if (key === 'battery_pct') { low = 0; high = 100; }
  else { const pad = Math.max((high-low)*.15, 1); low -= pad; high += pad; }
  const x = i => 52 + i / Math.max(1, values.length-1) * 1020;
  const y = v => 130 - (v-low)/(high-low)*110;
  for (let n=0;n<4;n++) {
    const v = low + (high-low)*n/3;
    node('line', {x1:52, x2:1072, y1:y(v), y2:y(v), stroke:'#24364c', 'stroke-dasharray':'3 5'});
    node('text', {x:42,y:y(v)+3,'text-anchor':'end'}, fmt(v,0));
  }
  node('polyline', {points:values.map((v,i)=>`${x(i)},${y(v)}`).join(' '), fill:'none',stroke:'#67dfcc','stroke-width':2});
  node('line',{x1:x(index),x2:x(index),y1:13,y2:133,stroke:'#f7bc6a','stroke-width':1,'stroke-dasharray':'4 3'});
  node('circle',{cx:x(index),cy:y(values[index]),r:4,fill:'#f7bc6a'});
  for (let n=0;n<=4;n++) {
    const i = Math.round((values.length-1)*n/4);
    node('text',{x:x(i),y:155,'text-anchor':n===0?'start':n===4?'end':'middle'}, `T+ ${time(report.telemetry[i].time_seconds)}`);
  }
  const labels = {battery_pct:'Stored battery energy',temperature_k:'Thermal node temperature',solar_w:'Solar generation',demand_w:'Electrical demand',unserved_w:'Unserved electrical demand'};
  $('chart-title').textContent = labels[key];
}

function renderEvents(report, row) {
  const interventions=(report.assurance?.decisions||[]).filter(d=>!d.safety_check_result.approved).map(d=>({time_seconds:d.time_seconds,event:'SAFETY_KERNEL_REJECTED',note:`${d.action}: ${d.safety_check_result.reasons.join(', ')}`}));
  const events = [...report.events,...interventions].filter(event => event.time_seconds <= row.time_seconds).sort((a,b)=>b.time_seconds-a.time_seconds);
  $('event-count').textContent = events.length;
  $('events').replaceChildren();
  if (!events.length) {
    const p = document.createElement('p'); p.className='empty';
    p.textContent = 'No controller decisions recorded by this interval. Move the replay cursor to inspect the fault response.';
    $('events').append(p);
  }
  for (const event of events.slice(0, 100)) {
    const div=document.createElement('div'); div.className='event';
    const stamp=document.createElement('time'); stamp.textContent=`T+ ${time(event.time_seconds)}`;
    const title=document.createElement('strong'); title.textContent=words(event.event);
    const p=document.createElement('p');
    p.textContent=event.fault ? words(event.fault) : event.reasons?.map(words).join(' · ') || event.note || (event.attempt ? `Attempt ${event.attempt} / 2` : 'Controller action recorded');
    div.append(stamp,title,p); $('events').append(div);
  }
}

function render() {
  const report=current(); if (!report) return;
  const row=report.telemetry[index];
  $('battery').textContent=fmt(row.battery_pct);
  // SVG/CSS presentation only; all displayed quantities originate in this report interval.
  $('battery-meter').style.width=`${Math.max(0,Math.min(100,row.battery_pct))}%`;
  $('battery-detail').textContent=`${fmt(row.battery_wh)} / ${fmt(report.config.battery_capacity_wh,0)} Wh stored`;
  $('temperature').textContent=fmt(row.temperature_k,1);
  $('thermal-label').textContent=row.temperature_k < report.config.low_temperature_k || row.temperature_k > report.config.high_temperature_k ? 'OUTSIDE SAFETY LIMITS' : 'WITHIN CONFIGURED LIMITS';
  $('demand').textContent=fmt(row.demand_w);
  $('power-detail').textContent=`${fmt(row.served_w)} W served · ${fmt(row.unserved_w)} W unserved`;
  $('link').textContent=row.comms_up?'ONLINE':'OFFLINE';
  $('link-detail').textContent=row.critical_bus_powered?'Critical bus powered':'Critical bus unavailable';
  $('check-label').textContent=report.checks.violations.length ? 'INVARIANT VIOLATION' : 'CONSERVATION CHECKS PASS';
  $('mode').textContent=row.operating_mode.replaceAll('_',' ');
  $('solar-value').textContent=`${fmt(row.solar_w)} W`;
  $('node-value').textContent=`${fmt(row.temperature_k,1)} K`;
  $('radio-value').textContent=row.comms_up?'LINK UP':'LINK DOWN';
  $('solar-visual').setAttribute('opacity',row.solar_w>0?'1':'.3');
  $('radio-visual').setAttribute('stroke',row.comms_up?'#67dfcc':'#f7bc6a');
  $('radio-visual').setAttribute('opacity',row.comms_up?'1':'.3');
  $('bus-light').setAttribute('fill',row.mode==='safe'?'#f7bc6a':'#67dfcc');
  $('pointing').textContent=`POINTING ERROR ${fmt(row.pointing_error_deg)}°`;
  $('subsystem-detail').textContent=detail(row);
  $('clock').textContent=`T+ ${time(row.time_seconds)} / ${time(report.config.duration_seconds)}`;
  $('scrubber').value=index;
  $('run-id').textContent=report.run_id.toUpperCase();
  $('chart-policy').textContent=assuredReplay?'Assured recovery':strategyName[$('policy').value];
  $('illumination').textContent=row.sunlit?'SUNLIT INTERVAL':'ECLIPSE INTERVAL';
  $('orbit-marker').setAttribute('cx',65+53*Math.cos(row.illustrative_orbit_phase_rad));
  $('orbit-marker').setAttribute('cy',30+22*Math.sin(row.illustrative_orbit_phase_rad));
  if(scene&&view3d)scene.update(row,report.config);
  $('briefing').textContent=report.briefing.statements.join(' ');
  $('actions').replaceChildren();
  const visibleActions=report.autonomy_decisions.filter(a=>a.time_seconds<=row.time_seconds);
  for(const action of visibleActions.slice().reverse()){
    const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');
    const outcomeVisible=action.resulting_state&&action.resulting_state.time_seconds<=row.time_seconds;
    s.textContent=`T+ ${time(action.time_seconds)} · ${words(action.action)} · ${outcomeVisible?action.outcome:'awaiting recorded result'}`;
    p.textContent=`Evidence: ${JSON.stringify(action.evidence)}. Constraints: ${action.constraints.join('; ')}. Expected: ${action.expected_effect}. Result: ${outcomeVisible?JSON.stringify(action.resulting_state):'not yet reached by replay'}. ${action.outcome_definition}`;
    d.append(s,p);$('actions').append(d);
  }
  if(!visibleActions.length)$('actions').textContent='No autonomy decisions by this replay interval. Hard safety protection remains active for every strategy.';
  renderEvents(report,row); drawChart(report);
}

function comparison() {
  const rows=[['Time in safe mode','safe_mode_seconds','s'],['Minimum battery reserve','min_battery_pct','%'],['Peak node temperature','max_temperature_k','K'],['Unserved demand','unserved_energy_wh','Wh'],['Link availability','comms_availability_pct','%'],['Conversion losses','conversion_loss_wh','Wh'],['Heater isolations','isolation_count',''],['Heater retries','heater_retries',''],['Radio reset attempts','radio_reset_attempts','']];
  $('comparison-body').replaceChildren();
  for (const [label,key,unit] of rows) {
    const tr=document.createElement('tr');
    const baseline=reports.basic.metrics[key], assisted=reports.enhanced.metrics[key];
    for (const value of [label,`${fmt(reports.none.metrics[key])} ${unit}`,`${fmt(baseline)} ${unit}`,`${fmt(assisted)} ${unit}`,`${assisted-baseline>0?'+':''}${fmt(assisted-baseline)} ${unit}`]) {
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }
    $('comparison-body').append(tr);
  }
  const violations=Object.entries(reports).flatMap(([p,r])=>r.checks.violations.map(v=>`${p}: ${v}`));
  $('comparison-note').textContent=violations.length ? `CHECKS FAILED: ${violations.join('; ')}` : 'All three reports passed numerical conservation and state-bound checks. This verifies implementation consistency, not hardware accuracy.';
}

async function run() {
  if (busy) return;
  pause();
  try {
    const scenario=JSON.parse($('scenario-json').value);
    if ($('seed').value==='' || !$('seed').checkValidity()) throw new Error('Use an integer noise seed from 0 to 4294967295');
    $('scenario-json').value=JSON.stringify(scenario,null,2);
    busy=true; $('run').disabled=true;
    message('Computing three recovery strategies locally…');
    const response=await fetch('/api/research/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario})});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'Simulation refused');
    reports=result;assuredReplay=null;$('policy').disabled=false; index=0;
    $('seed').value=reports.basic.config.seed;
    study=null;$('study-body').replaceChildren();$('study-export').disabled=true;
    $('study-status').textContent='Uses this newly executed scenario. Select Run paired study for confidence intervals.';
    $('scrubber').max=current().telemetry.length-1;
    for (const id of ['scrubber','play','export']) $(id).disabled=false;
    render();comparison();
    const violations=Object.values(reports).flatMap(r=>r.checks.violations);
    message(violations.length ? `Invariant checks failed: ${violations.join(', ')}` : `Experiment ready · seed ${reports.basic.config.seed} · ${current().telemetry.length} intervals per strategy · all conservation checks pass`,violations.length>0);
  } catch (error) {
    message(`${error.message}. ${reports ? 'The previous run is still displayed; edited scenario was not applied.' : 'No run has been loaded.'}`,true);
  } finally {busy=false; $('run').disabled=false;}
}

function preset(name) {
  if (!example) return;
  const scenario=structuredClone(presetLibrary[name]||example);
  $('scenario-json').value=JSON.stringify(scenario,null,2);$('seed').value=scenario.seed;
  if (reports) message('Scenario edited · select Run experiment to apply. Displayed telemetry is from the previous run.');
}

document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  if(assuredReplay&&['comparison','research'].includes(button.dataset.view)){
    assuredReplay=null;$('policy').disabled=false;index=LabUI.replayIndex(index,current().telemetry.length);$('scrubber').max=current().telemetry.length-1;
    message('Showing the standard three-strategy experiment. Assured run remains available in Mission assurance.');
  }
  document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!==button.dataset.view);
  document.querySelectorAll('[data-view]').forEach(nav=>nav.classList.toggle('active',nav===button));
  render();
}));
document.querySelectorAll('[data-subsystem]').forEach(button=>button.addEventListener('click',()=>{
  subsystem=button.dataset.subsystem;
  document.querySelectorAll('[data-subsystem]').forEach(b=>b.classList.toggle('selected',b===button));render();
}));
$('run').addEventListener('click',run);
$('play').addEventListener('click',togglePlay);
$('rewind').addEventListener('click',()=>{pause();index=0;render();});
$('scrubber').addEventListener('input',()=>{pause();index=LabUI.replayIndex(Number($('scrubber').value),current().telemetry.length);render();});
$('policy').addEventListener('change',render);
$('metric').addEventListener('change',render);
$('speed').addEventListener('change',()=>{if(playing){clearTimeout(timer);timer=setTimeout(tick,LabUI.intervalDelay(current().config.dt_seconds,Number($('speed').value)));}});
$('preset').addEventListener('change',()=>preset($('preset').value));
$('reset').addEventListener('click',()=>{$('preset').value='multifault';preset('multifault');});
$('scenario-json').addEventListener('input',()=>{
  try {const value=JSON.parse($('scenario-json').value);if (Number.isInteger(value.seed)) $('seed').value=value.seed;} catch {}
  if (reports) message('Scenario edited · select Run experiment to apply. Displayed telemetry is from the previous run.');
});
$('seed').addEventListener('input',()=>{
  try {
    const scenario=JSON.parse($('scenario-json').value);
    const value=$('seed').value;
    if (!/^\d+$/.test(value) || Number(value)>4294967295) throw new Error('Use an integer noise seed from 0 to 4294967295');
    scenario.seed=Number(value); $('scenario-json').value=JSON.stringify(scenario,null,2);
    message('Seed edited · select Run experiment to apply.');
  } catch(error) {message(`Seed could not be applied: ${error.message}`,true);}
});
$('export').addEventListener('click',()=>{
  if (!reports) return;
  if(assuredReplay){download(assuredReplay,'spacecraft-mission-assurance.json');return;}
  download(reports,`spacecraft-three-strategies-seed-${reports.basic.config.seed}.json`);
});
(async()=>{
  try {
    const response=await fetch('/api/bootstrap');
    if (!response.ok) throw new Error('Local server unavailable');
    const data=await response.json();example=data.scenario;presetLibrary=data.presets;
    $('model-version').textContent=data.model_version.toUpperCase();
    preset('multifault');$('run').disabled=false;await run();
  } catch(error) {message(`Startup failed: ${error.message}. Restart the local server and reload.`,true);}
})();

function download(data,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('add-fault').addEventListener('click',()=>{
  try{
    const scenario=JSON.parse($('scenario-json').value);
    const start=Number($('fault-start').value),duration=Number($('fault-duration').value),severity=Number($('fault-severity').value);
    const dt=scenario.dt_seconds||10;
    if(!Number.isInteger(start)||start<0||start%dt||!Number.isInteger(duration)||duration<=0||duration%dt||!Number.isFinite(severity)||severity<0||severity>2||start>=(scenario.duration_seconds||7200))throw new Error('Fault timing must align with dt and start within the horizon; severity must be 0–2');
    if($('fault-kind').value==='solar_array_loss'&&severity>1)throw new Error('Solar loss fraction must be 0–1');
    scenario.faults=scenario.faults||[];scenario.faults.push({kind:$('fault-kind').value,start_seconds:start,duration_seconds:duration,severity});
    $('scenario-json').value=JSON.stringify(scenario,null,2);message('Fault added to draft only. Select Run experiment to apply.');
  }catch(error){message(error.message,true);}
});
$('study-run').addEventListener('click',async()=>{
  if(!reports||busy)return;
  const scenario=structuredClone(reports.basic.config);
  try{
    busy=true;$('study-run').disabled=true;$('run').disabled=true;
    const raw=$('study-seeds').value.split(',').map(v=>v.trim());
    if(raw.some(v=>!/^\d+$/.test(v)))throw new Error('Use comma-separated integer seeds');
    $('study-status').textContent='Running paired strategies across evaluation seeds…';
    const response=await fetch('/api/research/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,seeds:raw.map(Number)})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    study=result;$('study-body').replaceChildren();
    const metrics=[['Mission success proxy','mission_success'],['Time in safe mode / s','safe_mode_seconds'],['Minimum battery / %','min_battery_pct'],['Peak temperature / K','max_temperature_k'],['Detected-episode latency / s','detection_latency_seconds'],['False positive rate','false_positive_rate'],['False negative rate','false_negative_rate'],['Immediate action effect success','immediate_action_success_rate'],['Modeled reset energy / Wh','modeled_recovery_energy_wh']];
    for(const [label,key] of metrics){const tr=document.createElement('tr');const name=document.createElement('td');name.textContent=label;tr.append(name);
      for(const s of ['none','basic','enhanced']){const v=result.summary[s][key],td=document.createElement('td');td.textContent=v.mean===null?'No eligible samples':`${fmt(v.mean,3)} ${v.ci95?`[${fmt(v.ci95[0],3)}, ${fmt(v.ci95[1],3)}]`:'[interval unavailable]'} · n=${v.n}`;tr.append(td);}$('study-body').append(tr);}
    $('study-status').textContent=`Completed ${result.seeds.length} paired seeds · all engine conservation checks pass · uses last executed scenario, not unapplied drafts.`;
    $('study-limits').textContent=result.limitations;$('study-export').disabled=false;
  }catch(error){$('study-status').textContent=`Study not applied: ${error.message}`;}
  finally{busy=false;$('study-run').disabled=false;$('run').disabled=false;}
});
$('study-export').addEventListener('click',()=>{if(study)download(study,'spacecraft-reliability-study.json');});
$('health-export').addEventListener('click',async()=>{
  if(!reports||busy)return;
  if(assuredReplay){message('Export this assured run from Mission assurance; it is not a v2 health packet.',true);return;}
  try{
    const response=await fetch('/api/research/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:current().config,strategy:$('policy').value,mission_id:$('mission-id').value,asset_id:$('asset-id').value})});
    const packet=await response.json();if(!response.ok)throw new Error(packet.error);
    download(packet,'spacecraft-health-v2.json');message('Offline health v2 packet exported. No other project contacted.');
  }catch(error){message(error.message,true);}
});
function show2d(hint='ILLUSTRATIVE GEOMETRY · RECORDED STATE'){
  view3d=false;$('scene-3d').hidden=true;$('spacecraft').removeAttribute('hidden');$('scene-hint').textContent=hint;
}
$('view-2d').addEventListener('click',()=>show2d());
$('view-3d').addEventListener('click',()=>{
  if(!reports)return;
  if(!scene)scene=createSpacecraftScene($('scene-3d'),hint=>{scene=null;show2d(hint);});
  if(!scene)return;
  view3d=true;$('scene-3d').hidden=false;$('spacecraft').setAttribute('hidden','');
  $('scene-hint').textContent='DRAG TO ROTATE · WHEEL / + − TO ZOOM';render();
});
