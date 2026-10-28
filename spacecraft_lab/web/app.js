'use strict';
const $ = id => document.getElementById(id);
let reports = null, example = null, index = 0, playing = false, timer = null;
let subsystem = 'eps', busy = false;
const fmt = (n, digits = 1) => Number(n).toFixed(digits);
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const current = () => reports?.[$('policy').value];
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
  timer = setTimeout(tick, current().config.dt_seconds * 1000 / Number($('speed').value));
}
function togglePlay() {
  if (playing) { pause(); return; }
  if (!reports) return;
  if (index >= current().telemetry.length - 1) index = 0;
  playing = true; $('play').textContent = 'Ⅱ Pause';
  $('replay-state').textContent = 'RECORDED TELEMETRY · PLAYING';
  render(); timer = setTimeout(tick, current().config.dt_seconds * 1000 / Number($('speed').value));
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
  const events = report.events.filter(event => event.time_seconds <= row.time_seconds).slice().reverse();
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
  $('mode').textContent=row.mode==='safe'?'SAFE MODE':'NORMAL MODE';
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
  $('chart-policy').textContent=$('policy').value==='baseline'?'Baseline':'Assisted';
  renderEvents(report,row); drawChart(report);
}

function comparison() {
  const rows=[['Time in safe mode','safe_mode_seconds','s'],['Minimum battery reserve','min_battery_pct','%'],['Peak node temperature','max_temperature_k','K'],['Unserved demand','unserved_energy_wh','Wh'],['Link availability','comms_availability_pct','%'],['Conversion losses','conversion_loss_wh','Wh'],['Heater isolations','isolation_count',''],['Heater retries','heater_retries',''],['Radio reset attempts','radio_reset_attempts','']];
  $('comparison-body').replaceChildren();
  for (const [label,key,unit] of rows) {
    const tr=document.createElement('tr');
    const baseline=reports.baseline.metrics[key], assisted=reports.assisted.metrics[key];
    for (const value of [label,`${fmt(baseline)} ${unit}`,`${fmt(assisted)} ${unit}`,`${assisted-baseline>0?'+':''}${fmt(assisted-baseline)} ${unit}`]) {
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }
    $('comparison-body').append(tr);
  }
  const violations=Object.entries(reports).flatMap(([p,r])=>r.checks.violations.map(v=>`${p}: ${v}`));
  $('comparison-note').textContent=violations.length ? `CHECKS FAILED: ${violations.join('; ')}` : 'Both reports passed numerical conservation and state-bound checks. This verifies implementation consistency, not hardware accuracy.';
}

async function run() {
  if (busy) return;
  pause();
  try {
    const scenario=JSON.parse($('scenario-json').value);
    if ($('seed').value==='' || !$('seed').checkValidity()) throw new Error('Use an integer noise seed from 0 to 4294967295');
    $('scenario-json').value=JSON.stringify(scenario,null,2);
    busy=true; $('run').disabled=true;
    message('Computing both policies locally…');
    const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario})});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'Simulation refused');
    reports=result; index=0;
    $('seed').value=reports.baseline.config.seed;
    $('scrubber').max=current().telemetry.length-1;
    for (const id of ['scrubber','play','export']) $(id).disabled=false;
    render();comparison();
    const violations=Object.values(reports).flatMap(r=>r.checks.violations);
    message(violations.length ? `Invariant checks failed: ${violations.join(', ')}` : `Experiment ready · seed ${reports.baseline.config.seed} · ${current().telemetry.length} intervals per policy · all conservation checks pass`,violations.length>0);
  } catch (error) {
    message(`${error.message}. ${reports ? 'The previous run is still displayed; edited scenario was not applied.' : 'No run has been loaded.'}`,true);
  } finally {busy=false; $('run').disabled=false;}
}

function preset(name) {
  if (!example) return;
  const scenario=structuredClone(example);
  if (name==='nominal') {scenario.faults=[];scenario.name='Nominal reference';}
  if (name==='power') {scenario.faults=[{kind:'solar_array_loss',start_seconds:300,duration_seconds:1800,severity:1}];scenario.initial_battery_wh=60;scenario.name='Power loss and recovery';}
  $('scenario-json').value=JSON.stringify(scenario,null,2);$('seed').value=scenario.seed;
  if (reports) message('Scenario edited · select Run experiment to apply. Displayed telemetry is from the previous run.');
}

document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!==button.dataset.view);
  document.querySelectorAll('[data-view]').forEach(nav=>nav.classList.toggle('active',nav===button));
}));
document.querySelectorAll('[data-subsystem]').forEach(button=>button.addEventListener('click',()=>{
  subsystem=button.dataset.subsystem;
  document.querySelectorAll('[data-subsystem]').forEach(b=>b.classList.toggle('selected',b===button));render();
}));
$('run').addEventListener('click',run);
$('play').addEventListener('click',togglePlay);
$('rewind').addEventListener('click',()=>{pause();index=0;render();});
$('scrubber').addEventListener('input',()=>{pause();index=Number($('scrubber').value);render();});
$('policy').addEventListener('change',render);
$('metric').addEventListener('change',render);
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
  const url=URL.createObjectURL(new Blob([JSON.stringify(reports,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`spacecraft-paired-seed-${reports.baseline.config.seed}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
(async()=>{
  try {
    const response=await fetch('/api/bootstrap');
    if (!response.ok) throw new Error('Local server unavailable');
    const data=await response.json();example=data.scenario;
    $('model-version').textContent=data.model_version.toUpperCase();
    preset('multifault');$('run').disabled=false;await run();
  } catch(error) {message(`Startup failed: ${error.message}. Restart the local server and reload.`,true);}
})();
