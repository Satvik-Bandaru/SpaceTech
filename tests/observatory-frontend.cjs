/* Functional adapter test: production UI against actual Python-generated reports. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fixture = JSON.parse(fs.readFileSync(0, 'utf8'));
const nodes = new Map(), calls = [], downloads = [], painted = [];
class Element {
  constructor(tag='div') { this.tagName=tag;this.children=[];this.handlers={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.classList={add(){}};this._text=''; }
  set id(v){this._id=v;nodes.set(v,this);} get id(){return this._id;}
  set textContent(v){this._text=String(v??'');} get textContent(){return this._text;}
  set innerHTML(html){
    for(const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
      const n=new Element(m[1]);n.id=m[3];n.value=/\bvalue="([^"]*)"/.exec(m[2])?.[1] || '';n.disabled=/\bdisabled\b/.test(m[2]);n.hidden=/\bhidden\b/.test(m[2]);
    }
  }
  append(...children){this.children.push(...children);} replaceChildren(...children){this.children=[...children];}
  setAttribute(k,v){this[k]=v;} addEventListener(name,fn){this.handlers[name]=fn;}
  async fire(name){if(!this.disabled)await this.handlers[name]?.({preventDefault(){}});}
  checkValidity(){return true;} closest(){return {firstChild:{textContent:this.id}};}
  getContext(){return {fillStyle:'',fillRect(...args){painted.push(args);}};}
  click(){if(this.tagName==='a')downloads.push(this.download);else return this.fire('click');}
  remove(){}
}
const root=new Element();root.id='observatory';
const get=id=>nodes.get(id);
const document={getElementById:get,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),body:new Element('body')};
let failRun=false;
const fetch=async(path,options={})=>{
  const data=options.body?JSON.parse(options.body):undefined;calls.push({path,data});
  if(path==='/api/observatory/run' && failRun)return {ok:false,status:400,json:async()=>({error:'Deliberate invalid mission'})};
  const value=path==='/api/observatory/history'?{runs:[{run_id:fixture.report.run_id,config:fixture.report.config,metrics:fixture.report.metrics}],capacity:20,unreadable_records:[]}:
    path==='/api/observatory/run' && data.config.capture_budget===0?fixture.empty:
    path.startsWith('/api/observatory/reports/') || path==='/api/observatory/run'?fixture.report:
    path==='/api/advisory/engineering'?fixture.engineering:fixture.economy;
  return {ok:true,status:200,json:async()=>structuredClone(value)};
};
vm.runInNewContext(fs.readFileSync('spacecraft_lab/web/observatory.js','utf8'),{document,fetch,Blob,URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},setTimeout:fn=>fn(),console});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await tick();
  assert.equal(get('obs-agents').children.length,5,'five observer cards');
  assert.equal(get('obs-results').hidden,true,'no fabricated pre-run results');
  assert.equal(get('obs-json').disabled,true,'export disabled before evidence');
  assert.ok(calls.some(c=>c.path==='/api/observatory/history'),'saved history loaded');assert.match(get('obs-history-status').textContent,/1 of 20/);assert.doesNotMatch(get('obs-history-status').textContent,/unreadable/);
  get('obs-enable-infrared').checked=false;
  await get('obs-mission-form').fire('submit');
  assert.equal(get('obs-error').textContent,'','mission UI completed without renderer errors');
  const request=calls.find(c=>c.path==='/api/observatory/run');
  assert.equal(request.data.config.seed,7);assert.equal(request.data.config.steps,24);
  assert.deepEqual(request.data.config.enabled_agents,['widefield','telescope','spectrometer','transient']);
  assert.equal(get('obs-results').hidden,false);
  assert.equal(get('obs-json').disabled,false);
  assert.equal(get('obs-capture').children.length,fixture.report.observations.length);
  assert.equal(get('obs-target').textContent,fixture.report.observations[0].target_id);
  assert.ok(painted.length>=257,'canvas paints the recorded 16x16 pixel frame');
  assert.equal(get('obs-spectrum').children.length,1,'actual spectrum chart rendered');
  assert.equal(get('obs-quantum-bars').children.length,8,'eight quantum probabilities');
  await get('obs-next').fire('click');
  assert.equal(get('obs-target').textContent,fixture.report.observations[1].target_id);
  assert.equal(get('obs-capture').value,'1');
  await get('obs-json').fire('click');await get('obs-markdown').fire('click');
  assert.deepEqual(downloads,[`${fixture.report.run_id}.json`,`${fixture.report.run_id}.md`]);
  failRun=true;await get('obs-mission-form').fire('submit');
  assert.equal(get('obs-error').textContent,'Deliberate invalid mission');
  assert.equal(get('obs-results').hidden,false,'failed run retains previous report');
  get('obs-history').value=fixture.report.run_id;await get('obs-history').fire('change');await get('obs-restore').fire('click');
  assert.equal(get('obs-mission-state').textContent,'SAVED REPLAY');
  assert.equal(get('obs-enable-infrared').checked,false,'restore preserves configuration draft');
  await get('obs-engineering-form').fire('submit');
  assert.ok(get('obs-engineering-result').children.length>=4,'engineering results displayed');
  assert.equal(calls.find(c=>c.path==='/api/advisory/engineering').data.dry_mass_kg,120);
  await get('obs-economy-form').fire('submit');
  assert.ok(get('obs-economy-result').children.length>=4,'financial scenarios displayed');
  failRun=false;get('obs-budget').value='0';await get('obs-mission-form').fire('submit');
  assert.equal(get('obs-empty').hidden,false,'zero-budget mission has an explicit empty state');
  assert.equal(get('obs-selected').hidden,true,'prior capture is hidden when the new report has no captures');
  assert.equal(get('obs-capture').disabled,true);assert.equal(get('obs-next').disabled,true);
  assert.equal(get('obs-quantum-bars').children.length,0,'no synthetic quantum finding fabricated without a spectrum');
  const before=calls.length;get('obs-seed').value='NaN';await get('obs-mission-form').fire('submit');
  assert.equal(calls.length,before,'nonfinite input never submitted');
  console.log('Observatory UI: run/config selection, evidence gallery, quantum chart, exports, saved restore, failure preservation and advisory forms passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
