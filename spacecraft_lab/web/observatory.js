'use strict';
/* Recorded synthetic observations only. No cameras, telescopes or network providers are connected. */
(() => {
  const root = document.getElementById('observatory');
  if (!root) return;
  const agents = [
    ['widefield', 'Widefield survey', 'Optical camera', 'Find unfamiliar targets across a broad synthetic field.'],
    ['telescope', 'Precision telescope', 'Narrow-field telescope', 'Compare position and brightness with the local catalog.'],
    ['infrared', 'Infrared watch', 'Infrared imager', 'Flag changes in generated infrared-like intensity maps.'],
    ['spectrometer', 'Spectral explorer', 'Spectroscopic telescope', 'Record synthetic spectral bands for template comparison.'],
    ['transient', 'Transient sentinel', 'Repeated-scan camera proxy', 'Watch unfamiliar targets across repeated synthetic scan frames.']
  ];
  const byId = id => document.getElementById(id);
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const fixed = (v, p = 2) => Number.isFinite(v) ? v.toLocaleString(undefined, {maximumFractionDigits:p}) : '—';
  let report = null, selected = 0, busy = false;
  root.classList.add('observatory-studio');
  // Static markup contains no report or user-provided values.
  root.innerHTML = `
    <article class="panel obs-intro"><div class="obs-heading"><div><span class="eyebrow">AUTONOMOUS DISCOVERY / LOCAL EXPERIMENT</span><h2>Discovery Observatory</h2><p>Five observers. One evidence trail. Inspect what triggered each recording.</p></div><span class="pill cyan">SYNTHETIC SENSOR DATA</span></div>
      <ol class="obs-flow"><li><span>01</span> Configure observers</li><li><span>02</span> Detect & capture</li><li><span>03</span> Analyze & compare</li><li><span>04</span> Export evidence</li></ol>
      <nav class="obs-local-nav" aria-label="Observatory sections"><a href="#obs-mission-form">Observer setup</a><a href="#obs-results">Recorded evidence</a><a href="#obs-engineering-form">Engineering assistant</a><a href="#obs-economy-form">Space economy</a></nav>
      <p class="obs-provenance">This is a finite, reproducible simulation. It does not access your camera, control a telescope, observe the sky, or establish a new astronomical discovery.</p>
    </article>
    <div class="obs-config-grid"><article class="panel obs-mission"><div class="obs-heading"><div><span class="eyebrow">MISSION CONFIGURATION</span><h3>Observation mission</h3></div><span id="obs-mission-state" class="pill">READY</span></div>
      <form id="obs-mission-form"><div class="obs-fields obs-four"><label>Deterministic seed<input id="obs-seed" type="number" min="0" max="2147483647" step="1" value="7" required></label><label>Scan steps<input id="obs-steps" type="number" min="4" max="120" step="1" value="24" required></label><label>Novelty threshold<input id="obs-threshold" type="number" min="0.02" max="2" step="0.01" value="0.22" required></label><label>Capture budget / observer<input id="obs-budget" type="number" min="0" max="120" step="1" value="12" required></label></div>
      <div id="obs-agents" class="obs-agents"></div><div class="obs-run-row"><button id="obs-run" type="submit" class="button primary">Run observation mission</button><p>Automatic recording happens only when the detector flags novelty and capture budget remains. Lower thresholds can admit more false alarms.</p></div></form>
      <div id="obs-error" class="error" role="alert" hidden></div><p id="obs-status" class="obs-status" role="status">Choose observers, then run a bounded mission. Completed missions save automatically to local files. No instruments stream in the background; spacecraft reliability replay remains independent.</p>
      <div class="obs-history"><label>Saved local observation mission<select id="obs-history"><option value="">Loading saved missions…</option></select></label><button id="obs-restore" class="button secondary" disabled>Restore mission</button><span id="obs-history-status" class="obs-help" role="status"></span></div>
    </article><article class="panel obs-analyzer"><div class="obs-heading"><div><span class="eyebrow">ANALYSIS AGENT / 06</span><h3>Discovery analyst</h3></div><span class="obs-agent-glyph">✧</span></div><p>Explains detection triggers, compares spectral templates, and writes a reproducible report.</p><div class="obs-analysis-boundary"><strong>Explainable local analysis</strong><p>Deterministic rules and template scores. No external LLM or hidden scientific claims.</p></div><h4>Quantum search experiment</h4><p>A tiny ideal Grover statevector simulation amplifies candidates marked by a classical spectral score. It runs on this computer.</p><p class="obs-help">No quantum hardware or quantum advantage is claimed. Template matches are hypotheses, not confirmed materials or chemical composition.</p></article></div>
    <div id="obs-results" hidden>
      <div class="obs-result-head"><div><span class="eyebrow">RECORDED MISSION</span><p id="obs-run-id" class="obs-run-id"></p></div><div class="obs-downloads"><button id="obs-json" class="button secondary" disabled>Export JSON</button><button id="obs-markdown" class="button secondary" disabled>Export report</button></div></div>
      <div id="obs-metrics" class="obs-metrics"></div>
      <div class="obs-evidence-grid"><article class="panel"><div class="obs-heading"><div><span class="eyebrow">CAPTURED EVIDENCE</span><h3>Observation gallery</h3></div><span id="obs-capture-count" class="pill"></span></div><div class="obs-gallery-toolbar"><label>Recorded capture<select id="obs-capture"></select></label><button id="obs-previous" class="button secondary" aria-label="Previous recorded capture">←</button><button id="obs-next" class="button secondary" aria-label="Next recorded capture">→</button></div><div id="obs-empty" class="obs-empty" hidden>No captures in this mission. Try enabling observers, increasing capture budget, or lowering the novelty threshold.</div><div id="obs-selected"><div class="obs-capture-grid"><div class="obs-frame"><canvas id="obs-image" width="256" height="256" role="img" aria-label="Selected synthetic sensor pixel frame"></canvas><span>SYNTHETIC FRAME · 16 × 16</span></div><div><h4 id="obs-target"></h4><dl id="obs-capture-metadata" class="obs-metadata"></dl><p id="obs-trigger" class="obs-help"></p></div></div><div id="obs-spectrum" class="obs-spectrum" role="img" aria-label="Recorded synthetic reflectance spectrum"></div><p class="obs-help obs-inset">Spectral bands and intensities are generated reference data. There is no calibrated instrument, physical inversion or laboratory substance identification.</p><div class="obs-inset"><h4>Analyst finding</h4><p id="obs-finding"></p><div id="obs-materials" class="obs-materials"></div></div></div></article>
      <article class="panel obs-quantum"><div class="obs-heading"><div><span class="eyebrow">IDEAL QUANTUM SIMULATION</span><h3>Candidate amplification</h3></div><span id="obs-qubits" class="pill"></span></div><p id="obs-quantum-method" class="obs-inset"></p><div id="obs-quantum-bars" class="obs-probabilities"></div><p id="obs-quantum-limit" class="obs-help obs-inset"></p><div class="obs-inset obs-analysis-summary"><h4>Mission analysis</h4><p id="obs-analysis-summary"></p></div></article></div>
      <article class="panel"><div class="obs-heading"><div><span class="eyebrow">AUDITABLE TRIGGERS</span><h3>Detection & recording log</h3></div><span class="tiny">FIRST 200 RECORDED EVENTS</span></div><div class="table-wrap obs-log"><table><thead><tr><th>Time (s)</th><th>Observer</th><th>Target</th><th>Event</th><th>Evidence</th></tr></thead><tbody id="obs-events"></tbody></table></div><details class="obs-limitations"><summary>Model assumptions and limitations</summary><ul id="obs-limitations"></ul></details></article>
    </div>
    <div class="obs-tools-grid"><article class="panel"><div class="obs-heading"><div><span class="eyebrow">AEROSPACE ENGINEERING ASSISTANT</span><h3>Propulsion & eclipse sizing</h3></div><span class="pill">REFERENCE CALCULATIONS</span></div><p class="obs-help obs-inset">Calculate ideal rocket-equation Δv and a constant-load eclipse energy budget. These are preliminary sizing checks.</p><form id="obs-engineering-form"><div class="obs-fields"><label>Dry mass (kg)<input id="obs-dry" type="number" min="0.001" max="1000000" step="any" value="120" required></label><label>Propellant mass (kg)<input id="obs-propellant" type="number" min="0" max="1000000" step="any" value="20" required></label><label>Specific impulse (s)<input id="obs-isp" type="number" min="1" max="10000" step="any" value="220" required></label><label>Eclipse load (W)<input id="obs-power" type="number" min="0" max="10000000" step="any" value="120" required></label><label>Eclipse duration (min)<input id="obs-eclipse" type="number" min="0" max="10080" step="any" value="35" required></label><label>Battery capacity (Wh)<input id="obs-capacity" type="number" min="0" max="1000000000" step="any" value="200" required></label><label>Usable battery fraction (0–1)<input id="obs-usable" type="number" min="0.01" max="1" step="0.01" value="0.8" required></label></div><div class="obs-tool-action"><button id="obs-engineering-run" type="submit" class="button secondary">Calculate engineering checks</button></div></form><div id="obs-engineering-result" class="obs-tool-result" role="status"></div></article>
      <article class="panel"><div class="obs-heading"><div><span class="eyebrow">SPACE ECONOMY RESEARCH ASSISTANT</span><h3>Mission business case</h3></div><span class="pill">YOUR ASSUMPTIONS</span></div><p class="obs-help obs-inset">Compare a hypothetical space project under constant annual cash flows. Values are user inputs in USD; no market feeds or securities recommendations.</p><form id="obs-economy-form"><div class="obs-fields"><label>Initial investment (USD)<input id="obs-initial" type="number" min="0" max="1000000000000" step="any" value="2000000" required></label><label>Annual revenue (USD)<input id="obs-revenue" type="number" min="0" max="1000000000000" step="any" value="800000" required></label><label>Annual operating cost (USD)<input id="obs-opex" type="number" min="0" max="1000000000000" step="any" value="350000" required></label><label>Annual discount rate (fraction)<input id="obs-discount" type="number" min="0" max="1" step="0.01" value="0.1" required></label><label>Project years<input id="obs-years" type="number" min="1" max="30" step="1" value="5" required></label><label>Downside fraction (revenue ↓ / cost ↑)<input id="obs-downside" type="number" min="0" max="1" step="0.01" value="0.25" required></label></div><div class="obs-tool-action"><button id="obs-economy-run" type="submit" class="button secondary">Compare financial scenarios</button></div></form><div id="obs-economy-result" class="obs-tool-result" role="status"></div></article></div>`;
  for (const [id, name, instrument, description] of agents) {
    const card = el('label', undefined, 'obs-agent-card'), check = el('input');
    check.type = 'checkbox'; check.checked = true; check.value = id; check.name = 'obs-agent'; check.id = `obs-enable-${id}`;
    const top = el('div', undefined, 'obs-agent-top'); top.append(check, el('strong', name));
    const state = el('span', 'READY', 'obs-agent-state'); state.id = `obs-agent-state-${id}`;
    const count = el('p', 'No mission recorded', 'obs-agent-count'); count.id = `obs-agent-count-${id}`;
    card.append(top, el('span', instrument, 'obs-agent-instrument'), el('p', description), state, count); byId('obs-agents').append(card);
  }
  async function request(path, data) {
    const r = await fetch(path, data === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    let value; try { value = await r.json(); } catch { throw new Error('The local server returned an unreadable response.'); }
    if (!r.ok) throw new Error(value.error || `Local request failed (${r.status}).`);
    return value;
  }
  function number(id) {
    const node = byId(id), value = Number(node.value);
    if (!node.value.trim() || !Number.isFinite(value) || !node.checkValidity()) throw new Error(`Check ${node.closest('label').firstChild.textContent.trim()}.`);
    return value;
  }
  function error(message) { byId('obs-error').hidden = !message; byId('obs-error').textContent = message || ''; }
  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], {type:mime})), a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function metric(label, value, note) {
    const card = el('article'); card.append(el('span', label), el('strong', value), el('p', note)); return card;
  }
  function svgNode(tag, attrs = {}, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function renderSpectrum(spectrum) {
    const host = byId('obs-spectrum'); host.replaceChildren();
    const wavelengths = spectrum?.wavelengths_nm, reflectance = spectrum?.reflectance;
    if (!Array.isArray(wavelengths) || !Array.isArray(reflectance) || wavelengths.length < 2) { host.append(el('p', 'No recorded spectrum is available.', 'obs-help')); return; }
    const pairs = wavelengths.map((v, i) => [v, reflectance[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (pairs.length < 2) { host.append(el('p', 'Insufficient finite spectral samples.', 'obs-help')); return; }
    const lo = Math.min(...pairs.map(p => p[0])), hi = Math.max(...pairs.map(p => p[0])), ymax = Math.max(1, ...pairs.map(p => p[1]));
    const x = v => 48 + (v - lo) / (hi - lo || 1) * 480, y = v => 150 - v / ymax * 115;
    const s = svgNode('svg', {viewBox:'0 0 560 190'});
    s.append(svgNode('path', {d:'M48 25V150H528', fill:'none', stroke:'#54708f'}));
    for (let i=0; i<=2; i++) { const v=ymax*i/2; s.append(svgNode('line', {x1:48,x2:528,y1:y(v),y2:y(v),stroke:'#263e58'}),svgNode('text',{x:38,y:y(v)+4,'text-anchor':'end',fill:'#a9bfd7','font-size':11},fixed(v))); }
    s.append(svgNode('polyline', {points:pairs.map(([a,b])=>`${x(a)},${y(b)}`).join(' '),fill:'none',stroke:'#86d7ff','stroke-width':2.5}));
    pairs.forEach(([a,b])=>s.append(svgNode('circle',{cx:x(a),cy:y(b),r:3,fill:'#c0e9ff'})));
    s.append(svgNode('text',{x:48,y:173,fill:'#b7cde4','font-size':11},`${fixed(lo,0)} nm`),svgNode('text',{x:528,y:173,'text-anchor':'end',fill:'#b7cde4','font-size':11},`${fixed(hi,0)} nm`),svgNode('text',{x:48,y:15,fill:'#b7cde4','font-size':11},'Synthetic reflectance (relative units)'));
    host.append(s);
  }
  function renderCapture() {
    const observations = report?.observations || [], observation = observations[selected];
    byId('obs-empty').hidden = !!observation; byId('obs-selected').hidden = !observation; byId('obs-capture').disabled = !observation;
    byId('obs-previous').disabled = !observation || selected === 0; byId('obs-next').disabled = !observation || selected >= observations.length-1;
    if (!observation) return;
    byId('obs-capture').value = String(selected);
    byId('obs-target').textContent = observation.target_id;
    const dl = byId('obs-capture-metadata'); dl.replaceChildren();
    for (const [k,v] of [['Observer',observation.agent_id],['Recorded time',`${fixed(observation.time_seconds,0)} s`],['Novelty score',fixed(observation.novelty_score,4)],['Capture ID',observation.id]]) dl.append(el('dt',k),el('dd',v));
    byId('obs-trigger').textContent = observation.trigger || 'Novelty threshold exceeded.';
    const canvas = byId('obs-image'), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050b16'; ctx.fillRect(0,0,256,256);
    const pixels = observation.image;
    if (Array.isArray(pixels) && pixels.length) {
      const rows=pixels.length, cols=Array.isArray(pixels[0])?pixels[0].length:0;
      for (let yy=0; yy<rows; yy++) for (let xx=0; xx<cols; xx++) { const raw=pixels[yy]?.[xx], v=Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):0; ctx.fillStyle=`rgb(${Math.round(v*210)},${Math.round(v*233)},${Math.round(v*255)})`; ctx.fillRect(xx*256/cols,yy*256/rows,Math.ceil(256/cols),Math.ceil(256/rows)); }
    }
    renderSpectrum(observation.spectrum);
    const finding = report.analysis?.findings?.find(f=>f.observation_id===observation.id);
    byId('obs-finding').textContent = finding?.explanation || 'No material finding recorded for this capture.';
    byId('obs-materials').replaceChildren(...(finding?.material_candidates || []).map(c=>el('span',`${c.name} · score ${fixed(c.score,3)}`,'obs-material-chip')));
  }
  function renderReport() {
    byId('obs-results').hidden = false; byId('obs-run-id').textContent = `${report.run_id} · seed ${report.config.seed}`;
    byId('obs-metrics').replaceChildren(metric('SCANS',fixed(report.metrics.scans,0),'Recorded sensor evaluations'),metric('CAPTURES',fixed(report.metrics.captures,0),'Novelty-triggered saved frames'),metric('NOVEL TARGETS',fixed(report.metrics.novel_targets,0),'Detector flags, not discoveries'),metric('BUDGET SKIPS',fixed(report.metrics.budget_skips,0),'Flagged observations not saved'));
    for (const a of report.agents || []) {
      const state=byId(`obs-agent-state-${a.id}`), count=byId(`obs-agent-count-${a.id}`);
      if (state) state.textContent=a.status; if (count) count.textContent=`${fixed(a.scanned,0)} scans · ${fixed(a.captures,0)} captures · ${fixed(a.skipped_budget,0)} budget skips`;
    }
    const choose=byId('obs-capture'); choose.replaceChildren();
    (report.observations || []).forEach((o,i)=>{const option=el('option',`${i+1}. ${o.target_id} · ${o.agent_id} · T+${fixed(o.time_seconds,0)}s`);option.value=String(i);choose.append(option);});
    byId('obs-capture-count').textContent=`${report.observations.length} CAPTURES`; selected=0; renderCapture();
    const quantum=report.quantum || {};
    byId('obs-qubits').textContent=`${fixed(quantum.qubits,0)} QUBITS / SIMULATED`;
    byId('obs-quantum-method').textContent=`${quantum.method || 'Ideal Grover search'} · ${fixed(quantum.iterations,0)} amplification iterations.${quantum.observation_id ? ` Spectrum from capture ${quantum.observation_id}.` : ' No captured spectrum selected.'} Candidate probabilities are ideal search measurement probabilities, not confidence that a substance is present.`;
    const bars=byId('obs-quantum-bars');bars.replaceChildren();
    (quantum.probabilities || []).forEach(p=>{const row=el('div',undefined,'obs-probability'),label=el('div'),track=el('progress');const classical=quantum.classical_scores?.find(c=>c.name===p.name);label.append(el('span',`${p.name}${classical ? ` · classical similarity ${fixed(classical.score,3)}` : ''}`),el('strong',`${fixed(p.probability*100,1)}%`));track.max=1;track.value=p.probability;track.setAttribute('aria-label',`${p.name} quantum measurement probability`);row.append(label,track);bars.append(row);});
    byId('obs-quantum-limit').textContent=Array.isArray(quantum.limitations)?quantum.limitations.join(' '):String(quantum.limitations || 'The oracle uses classically computed scores. This experiment demonstrates amplitude amplification only.');
    byId('obs-analysis-summary').textContent=report.analysis?.summary || 'No analysis summary available.';
    const tbody=byId('obs-events');tbody.replaceChildren();
    (report.timeline || []).slice(0,200).forEach(e=>{const tr=el('tr');for(const v of [fixed(e.time_seconds,0),e.agent_id || '—',e.target_id || '—',e.event || e.kind || '—',e.note || e.reason || e.trigger || '—'])tr.append(el('td',v));tbody.append(tr);});
    if (!tbody.children.length) {const tr=el('tr'),td=el('td','No trigger events recorded.');td.colSpan=5;tr.append(td);tbody.append(tr);}
    byId('obs-limitations').replaceChildren(...(report.limitations || []).map(s=>el('li',s)));
    byId('obs-json').disabled=false;byId('obs-markdown').disabled=false;
  }
  byId('obs-mission-form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;error('');
    try {
      const config={seed:number('obs-seed'),steps:number('obs-steps'),novelty_threshold:number('obs-threshold'),capture_budget:number('obs-budget'),enabled_agents:agents.filter(([id])=>byId(`obs-enable-${id}`).checked).map(([id])=>id)};
      busy=true;byId('obs-run').disabled=true;byId('obs-mission-state').textContent='RUNNING';byId('obs-status').textContent='Scanning synthetic fields, applying novelty checks, and recording bounded evidence…';
      const next=await request('/api/observatory/run',{config});report=next;renderReport();byId('obs-mission-state').textContent='COMPLETE';byId('obs-status').textContent=`Mission complete. ${report.metrics.captures} captures recorded automatically. ${report.metrics.captures ? 'Select a capture below to inspect its evidence.' : 'No spectrum analysis was run; adjust the capture settings to collect evidence.'}`;await refreshHistory();
    } catch(cause) {error(cause.message);byId('obs-mission-state').textContent='CHECK INPUTS';byId('obs-status').textContent='Mission could not run. Any previous report is still available below.';}
    finally {busy=false;byId('obs-run').disabled=false;}
  });
  byId('obs-capture').addEventListener('change',()=>{selected=Number(byId('obs-capture').value);renderCapture();});
  byId('obs-previous').addEventListener('click',()=>{selected=Math.max(0,selected-1);renderCapture();});
  byId('obs-next').addEventListener('click',()=>{selected=Math.min(report.observations.length-1,selected+1);renderCapture();});
  async function refreshHistory() {
    try {
      const value=await request('/api/observatory/history'),select=byId('obs-history');select.replaceChildren();
      const placeholder=el('option',value.runs.length?'Choose a saved mission':'No saved observation missions');placeholder.value='';select.append(placeholder);
      value.runs.forEach(r=>{const o=el('option',`Seed ${r.config.seed} · ${r.config.steps} steps · ${r.metrics.captures} captures · ${r.run_id.slice(0,10)}`);o.value=r.run_id;select.append(o);});
      if(report && value.runs.some(r=>r.run_id===report.run_id))select.value=report.run_id;
      const unreadable=Array.isArray(value.unreadable_records)?value.unreadable_records.length:(Number(value.unreadable_records)||0);byId('obs-restore').disabled=!select.value;byId('obs-history-status').textContent=`${value.runs.length} of ${value.capacity || 20} completed missions saved locally.${unreadable ? ` ${unreadable} unreadable local record(s) were skipped; inspect local storage before removing them.` : ''} No background recording is active.`;
    } catch(cause) {byId('obs-history-status').textContent=`Saved history unavailable: ${cause.message}`;}
  }
  byId('obs-history').addEventListener('change',()=>{byId('obs-restore').disabled=!byId('obs-history').value || busy;});
  byId('obs-restore').addEventListener('click',async()=>{
    const id=byId('obs-history').value;if(!id || busy)return;error('');busy=true;byId('obs-restore').disabled=true;byId('obs-run').disabled=true;
    try {const next=await request(`/api/observatory/reports/${encodeURIComponent(id)}`);report=next;renderReport();byId('obs-mission-state').textContent='SAVED REPLAY';byId('obs-status').textContent='Saved synthetic observation mission restored. This does not restart instruments or change the current configuration draft.';}
    catch(cause){error(cause.message);}finally{busy=false;byId('obs-restore').disabled=!byId('obs-history').value;byId('obs-run').disabled=false;}
  });
  byId('obs-json').addEventListener('click',()=>{if(report)download(`${report.run_id}.json`,JSON.stringify(report,null,2),'application/json');});
  byId('obs-markdown').addEventListener('click',()=>{if(report)download(`${report.run_id}.md`,report.report_markdown || `# Synthetic observation mission\n\nRun: ${report.run_id}\n\n${report.analysis?.summary || ''}\n\n${(report.limitations || []).map(x=>`- ${x}`).join('\n')}\n`,'text/markdown');});
  function resultLine(host,label,value){const row=el('div',undefined,'obs-result-line');row.append(el('span',label),el('strong',value));host.append(row);}
  function assumptions(host,list,limits=[]){const details=el('details'),summary=el('summary','Calculation assumptions & limitations'),ul=el('ul');[...(list || []),...(limits || [])].forEach(s=>ul.append(el('li',s)));details.append(summary,ul);host.append(details);}
  function toolError(host,message){host.replaceChildren(el('p',message,'obs-tool-error'));}
  byId('obs-engineering-form').addEventListener('submit',async e=>{
    e.preventDefault();const host=byId('obs-engineering-result'),button=byId('obs-engineering-run');
    try {const data={dry_mass_kg:number('obs-dry'),propellant_mass_kg:number('obs-propellant'),isp_seconds:number('obs-isp'),power_w:number('obs-power'),eclipse_minutes:number('obs-eclipse'),battery_wh:number('obs-capacity'),usable_fraction:number('obs-usable')};button.disabled=true;const r=await request('/api/advisory/engineering',data);host.replaceChildren();resultLine(host,'Ideal Δv',`${fixed(r.delta_v_m_s,1)} m/s`);resultLine(host,'Eclipse load energy',`${fixed(r.required_eclipse_wh,2)} Wh`);resultLine(host,'Usable battery margin',`${fixed(r.battery_margin_wh,2)} Wh`);host.append(el('p',r.assessment));assumptions(host,r.assumptions,r.limitations);}catch(cause){toolError(host,cause.message);}finally{button.disabled=false;}
  });
  byId('obs-economy-form').addEventListener('submit',async e=>{
    e.preventDefault();const host=byId('obs-economy-result'),button=byId('obs-economy-run');
    try {const data={initial_cost:number('obs-initial'),annual_revenue:number('obs-revenue'),annual_operating_cost:number('obs-opex'),discount_rate:number('obs-discount'),years:number('obs-years'),downside_fraction:number('obs-downside')};button.disabled=true;const r=await request('/api/advisory/economy',data);host.replaceChildren();for(const s of r.scenarios || [])resultLine(host,`${s.name} NPV`,`${fixed(s.npv,0)} USD`);host.append(el('p',r.recommendation));assumptions(host,r.assumptions,r.limitations);}catch(cause){toolError(host,cause.message);}finally{button.disabled=false;}
  });
  refreshHistory();
})();
