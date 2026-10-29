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
}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
get('policy').value='basic';get('metric').value='battery_pct';get('speed').value='20';
const context={console,structuredClone,setTimeout,clearTimeout,Blob,
  document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>new Element(),createElementNS:()=>new Element()},
  fetch:async url=>({ok:true,json:async()=>url==='/api/bootstrap'?{scenario:fixture.scenario,presets:{},model_version:'test'}:fixture.reports})};
context.window=context;vm.createContext(context);
for(const path of ['ui-core.js','app.js'])vm.runInContext(fs.readFileSync(`spacecraft_lab/web/${path}`,'utf8'),context);
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
  console.log('Real dashboard script: load, seek, policy alignment, comparison and failed-edit retention passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
