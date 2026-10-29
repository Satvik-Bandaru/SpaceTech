// Execute the real dashboard script against engine-generated reports and a minimal DOM adapter.
// Browser rendering/input remains a separate manual verification gate.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
class Element{
  constructor(){this.value='';this.textContent='';this.children=[];this.listeners={};this.classList={toggle(){}};this.style={};}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(name,value){this[name]=String(value);}
  removeAttribute(name){delete this[name];}
  replaceChildren(...children){this.children=children;}
  append(...children){this.children.push(...children);}
  checkValidity(){return true;}
  click(){if(this.listeners.click)return this.listeners.click();}
}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
get('policy').value='basic';get('metric').value='battery_pct';get('speed').value='20';
get('assurance-source').value='demo';get('assurance-budget').value='128';get('assurance-probe').checked=true;
const workflowPosts=[];
const fakeJob={job_id:'0123456789abcdef0123456789abcdef',status:'PREPARED',plan_sha256:'a'.repeat(64),plan:{scenario:fixture.scenario,options:{probe_unsafe:true}},checkpoint:null,audit:[]};
const context={console,structuredClone,setTimeout,clearTimeout,Blob,
  document:{getElementById:get,querySelectorAll:()=>[],querySelector:()=>get('overview-nav'),createElement:()=>new Element(),createElementNS:()=>new Element()},
  fetch:async (url,options)=>{
    let data;
    if(url==='/api/bootstrap')data={scenario:fixture.scenario,presets:{},model_version:'test'};
    else if(url==='/api/assurance/prepare'){workflowPosts.push(url);data={...fakeJob};}
    else if(url==='/api/assurance/approve'){workflowPosts.push(url);assert.equal(JSON.parse(options.body).plan_sha256,fakeJob.plan_sha256);data={...fakeJob,status:'QUEUED'};}
    else if(url.endsWith('/result'))data=fixture.assured;
    else if(url.startsWith('/api/assurance/jobs/'))data={...fakeJob,status:'COMPLETE'};
    else data=fixture.reports;
    return {ok:true,json:async()=>data};
  }};
context.window=context;vm.createContext(context);
for(const path of ['ui-core.js','app.js','assurance.js'])vm.runInContext(fs.readFileSync(`spacecraft_lab/web/${path}`,'utf8'),context);
(async()=>{
  await new Promise(setImmediate);
  assert.match(get('status').textContent,/Experiment ready/);
  assert.equal(get('battery').textContent,fixture.reports.basic.telemetry[0].battery_pct.toFixed(1));
  get('scrubber').value='5';get('scrubber').listeners.input();
  assert.match(get('clock').textContent,/01:00/);
  assert.equal(get('battery').textContent,fixture.reports.basic.telemetry[5].battery_pct.toFixed(1));
  get('policy').value='enhanced';get('policy').listeners.change();
  assert.equal(get('run-id').textContent,fixture.reports.enhanced.run_id.toUpperCase());
  assert.equal(get('subsystem-detail').textContent.includes(fixture.reports.enhanced.telemetry[5].battery_wh.toFixed(1)),true);
  assert.equal(get('comparison-body').children.length,9);
  get('scenario-json').value='{invalid';await get('run').listeners.click();
  assert.equal(get('error').hidden,false);
  assert.match(get('error').textContent,/previous run is still displayed/);
  assert.equal(get('run-id').textContent,fixture.reports.enhanced.run_id.toUpperCase());
  await get('assurance-prepare').listeners.click();
  assert.deepEqual(workflowPosts,['/api/assurance/prepare']);
  assert.equal(get('assurance-approve').disabled,false);
  assert.match(get('assurance-plan').textContent,/plan_sha256/);
  await get('assurance-approve').listeners.click();
  assert.equal(workflowPosts.filter(url=>url.endsWith('/approve')).length,1);
  assert.equal(get('assurance-export').disabled,false);
  assert.match(get('assurance-totals').textContent,/rejected/);
  assert.equal(get('assurance-agents').children.length,7);
  get('assurance-replay').listeners.click();
  assert.equal(get('policy').disabled,true);
  assert.equal(get('run-id').textContent,fixture.assured.run_id.toUpperCase());
  fakeJob.job_id='fedcba9876543210fedcba9876543210';
  await get('assurance-prepare').listeners.click();
  assert.equal(get('assurance-replay').disabled,true);
  assert.equal(get('assurance-agents').children.length,0);
  assert.equal(get('assurance-decisions').children.length,0);
  assert.equal(get('assurance-totals').textContent,'NO RESULTS FOR THIS JOB');
  console.log('Real dashboard script: load, seek, policy alignment, comparison and failed-edit retention passed');
  console.log('Mission assurance: prepare without execution, digest approval, real agent/result rendering and replay passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
