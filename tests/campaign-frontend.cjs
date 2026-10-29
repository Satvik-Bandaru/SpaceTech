'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script='spacecraft_lab/web/campaign.js';
assert.ok(fs.existsSync(script),'Counterfactual Studio implementation must exist');
const context={console,window:{},document:{getElementById:()=>null}};
vm.createContext(context);vm.runInContext(fs.readFileSync(script,'utf8'),context);
const ui=context.window.CampaignUI;
assert.deepEqual(Array.from(ui.parseSeeds('0, 1, 4294967295')),[0,1,4294967295]);
for(const input of ['', '1,1','-1','1.5','4294967296','9001','0,','0,1,2,3,4,5,6,7,8'])assert.throws(()=>ui.parseSeeds(input),undefined,input);
assert.equal(ui.estimateWorkload({duration_seconds:120,dt_seconds:10},2,[0,1],['basic','assured']).cases,12);
assert.equal(ui.estimateWorkload({duration_seconds:120,dt_seconds:10},2,[0,1],['basic','assured']).engine_intervals,216);
assert.equal(ui.estimateWorkload({duration_seconds:120,dt_seconds:10},[{duration_seconds:60}],[0,1],['basic','assured']).engine_intervals,108);
assert.match(ui.formatEstimate({n:1,mean:4,sample_sd:null,ci95:null}),/not estimable/);
assert.equal(ui.formatEstimate({n:0,mean:null,ci95:null}),'Not observed (n=0)');
assert.match(ui.formatEstimate({n:2,mean:4,sample_sd:1,ci95:[-1,9]}),/−1\.000.*9\.000/);
assert.equal(ui.csvCell('=SUM(A1:A2)'),"'=SUM(A1:A2)");
assert.equal(ui.csvCell(-4.2),'-4.2','Numeric CSV values must remain numeric');
assert.equal(ui.csvCell('comma, quote"'),'"comma, quote"""');
console.log('Counterfactual frontend: seed bounds, engine workload, honest uncertainty and CSV escaping passed');

if(process.argv.includes('--fixture')){
  const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
  class Element{
    constructor(tag='div'){this.tag=tag;this.value='';this.textContent='';this.children=[];this.listeners={};this.style={};this.hidden=false;this.disabled=false;this.attributes={};}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    setAttribute(key,value){this.attributes[key]=String(value);}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    replaceChildren(...children){this.children=[];this.append(...children);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    async click(){for(const fn of this.listeners.click||[])await fn();}
    async change(){for(const fn of this.listeners.change||[])await fn();}
  }
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  for(const [id,value] of Object.entries({'campaign-source':'demo','campaign-name':'Engine-backed frontend evidence','campaign-seeds':'0,1'}))get(id).value=value;
  const checkboxes=['none','basic','enhanced','assured'].map(value=>{const input=new Element('input');input.value=value;input.checked=true;return input;});
  const jobs={};
  const id1='1'.repeat(32),id2='2'.repeat(32),id3='3'.repeat(32),slowId='4'.repeat(32),digest='a'.repeat(64),posts=[];
  const makeJob=(id,status='PREPARED')=>({job_id:id,kind:'campaign',name:'Engine-backed frontend evidence',status,plan_sha256:digest,plan:{kind:'campaign',request:fixture.configuration},progress:{completed_runs:status==='COMPLETE'?fixture.runs.length:0,total_runs:fixture.runs.length}});
  jobs[id1]=makeJob(id1);jobs[id2]=makeJob(id2);jobs[id3]=makeJob(id3);jobs[slowId]=makeJob(slowId,'COMPLETE');
  let releaseSlow,slowStarted=false,replay=null,assuranceOpened=null;
  const slowGate=new Promise(resolve=>releaseSlow=resolve);
  const ctx={console,Blob,setTimeout,clearTimeout,URL,window:{},document:{getElementById:get,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelectorAll:selector=>selector.includes('campaign-strategy')?checkboxes:[],querySelector:selector=>get('nav-'+(selector.includes('assurance')?'assurance':'campaign'))},fetch:async(path,options)=>{
    let data;
    if(options?.method==='POST'){
      const body=JSON.parse(options.body);posts.push({path,body});
      if(path==='/api/campaigns/prepare')data=jobs[id1];
      else if(path.endsWith('/approve')){assert.equal(body.plan_sha256,digest);jobs[body.job_id]=makeJob(body.job_id,'COMPLETE');data=jobs[body.job_id];}
      else if(path.endsWith('/cancel')){jobs[body.job_id]=makeJob(body.job_id,'CANCELLED');data=jobs[body.job_id];}
      else throw new Error('Unexpected post '+path);
    }else if(path==='/api/jobs?limit=20')data={jobs:[{...jobs[id1],created_at:'2026-10-29T00:00:00Z'}, {job_id:'5'.repeat(32),kind:'assurance',name:'Saved assurance',status:'COMPLETE'}],total:2};
    else if(path.endsWith('/result'))data=fixture;
    else{
      const id=path.split('/').at(-1);assert.ok(jobs[id],'Unexpected job '+id);
      if(id===slowId){slowStarted=true;await slowGate;}
      data=jobs[id];
    }
    return {ok:true,json:async()=>data};
  }};
  ctx.window=ctx;ctx.replayRecordedReport=(report,label)=>{replay={report,label};};ctx.inspectAssuranceJob=async id=>{assuranceOpened=id;};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(script,'utf8'),ctx);
  const flush=()=>new Promise(setImmediate);
  (async()=>{
    assert.equal(get('campaign-variants').children.length,2);
    assert.match(get('campaign-workload').textContent,/24 cases/);
    await get('campaign-prepare').click();
    assert.equal(posts.length,1,'Preparation must not approve or execute');
    assert.equal(posts[0].path,'/api/campaigns/prepare');
    assert.equal(posts[0].body.variants[0].changes.solar_generation_w,220);
    assert.equal(posts[0].body.variants[1].changes.safe_load_w,25);
    assert.equal(get('campaign-approve').disabled,false);
    assert.match(get('campaign-plan').textContent,new RegExp(digest));
    assert.equal(ctx.CampaignUI.getResult(),null);
    await get('campaign-approve').click();await flush();
    assert.equal(posts.filter(post=>post.path.endsWith('/approve')).length,1);
    assert.equal(get('campaign-results').hidden,false);
    assert.equal(get('campaign-case').children.length,fixture.runs.length);
    assert.equal(get('campaign-paired').children.length,fixture.paired_comparisons.length);
    const strategyComparison=fixture.strategy_comparisons[0];
    assert.equal(get('campaign-strategy-comparisons').children[0].children[1].textContent,`${{none:'No actuator recovery',basic:'Basic',enhanced:'Enhanced',assured:'Assured'}[strategyComparison.strategy]} − ${{none:'No actuator recovery',basic:'Basic',enhanced:'Enhanced',assured:'Assured'}[strategyComparison.reference_strategy]}`);
    assert.equal(get('campaign-summary').children[0].children[1].textContent,String(fixture.runs.length));
    const evaluatedSuccesses=fixture.runs.filter(run=>(run.evaluation_metrics||run.report.research_metrics).mission_success===1).length;
    assert.equal(get('campaign-summary').children[3].children[1].textContent,`${evaluatedSuccesses} / ${fixture.runs.length}`,'Campaign proxy count must use shared evaluation criteria');
    assert.ok(fixture.evaluation_criteria,'Real campaign fixture must retain its common criteria');
    assert.match(get('campaign-result-meta').textContent,/Common reference success criteria/);
    assert.equal(get('campaign-json').disabled,false);
    const last=fixture.runs.at(-1);get('campaign-case').value=last.case_id;await get('campaign-case').change();await get('campaign-replay').click();
    assert.equal(replay.report,last.report,'Replay must receive the actual selected engine report');
    assert.match(replay.label,new RegExp(String(last.seed)));
    assert.match(get('campaign-run-detail').textContent,new RegExp(last.report.run_id));
    const runDetail=JSON.parse(get('campaign-run-detail').textContent);
    assert.equal(runDetail.provenance.data_provenance,'SYNTHETIC');
    assert.equal(runDetail.provenance.model_validated_for_flight,false);
    assert.equal(runDetail.provenance.operational_status,'advisory_only');
    assert.equal(runDetail.provenance.scenario_sha256,last.report.scenario_sha256);
    assert.ok(Object.keys(runDetail.provenance.implementation_sha256).length>0);
    assert.equal(runDetail.evaluation.original_report_own_proxy_metrics.mission_success,last.report.research_metrics.mission_success);
    assert.equal(runDetail.evaluation.common_reference_metrics.mission_success,last.evaluation_metrics.mission_success);
    const csv=ctx.CampaignUI.campaignCSV(fixture),lines=csv.trim().split('\r\n');
    assert.equal(lines.length,fixture.runs.length+1);
    assert.ok(csv.includes(last.report.run_id));
    assert.match(lines[0],/data_provenance,model_validated_for_flight,operational_status,sampling_scope/);
    assert.match(lines[0],/evaluation_scope,evaluation_criteria,original_report_own_mission_success/);
    assert.ok(lines.slice(1).every(line=>line.includes('SYNTHETIC,false,advisory_only')),'Every exported case must retain synthetic/advisory metadata');
    const unsafeName=JSON.parse(JSON.stringify(fixture));unsafeName.summary[0].name='<script>alert(1)</script> **claim**';
    const escapedBrief=ctx.CampaignUI.campaignMarkdown(unsafeName);
    assert.equal(escapedBrief.includes('<script>'),false,'Variant names cannot introduce raw HTML into research briefs');
    assert.ok(escapedBrief.includes('\\<script\\>'));
    assert.match(ctx.CampaignUI.campaignMarkdown(fixture),/not flight-qualified/i);
    assert.match(ctx.CampaignUI.campaignMarkdown(fixture),/Common reference success criteria/);
    assert.ok(ctx.CampaignUI.campaignMarkdown(fixture).includes(String(fixture.evaluation_criteria.temperature_limits_k[1])));
    if(fixture.configuration.name==='Criteria must stay fixed'){
      assert.equal(evaluatedSuccesses,0);
      assert.ok(fixture.runs.some(run=>run.report.research_metrics.mission_success===1),'Fixture must expose a drift between own and reference criteria');
      const header=lines[0].split(','),metricColumn=header.indexOf('mission_success');
      // Values following the quoted metadata fields remain numeric; the last metric values are validated via the helper below.
      assert.ok(metricColumn>header.indexOf('original_report_own_mission_success'));
      assert.ok(fixture.runs.every(run=>ctx.CampaignUI.evaluationMetrics(run).mission_success===0));
    }
    get('campaign-metric').value='mission_success';await get('campaign-metric').change();
    assert.ok(get('campaign-chart').children.some(child=>child.tag==='line'));
    const markdown=ctx.CampaignUI.campaignMarkdown(fixture),wilson=fixture.summary[0].mission_success_ci95;
    assert.ok(markdown.includes(ctx.CampaignUI.formatEstimate({...fixture.summary[0].metrics.mission_success,ci95:wilson})),'Success brief must use the actual Wilson interval');
    await ctx.CampaignUI.openJob(id2);
    assert.equal(get('campaign-results').hidden,true);assert.equal(get('campaign-replay').disabled,true);
    assert.equal(get('campaign-paired').children.length,0,'New job must not retain earlier evidence');
    await get('campaign-cancel').click();assert.equal(ctx.CampaignUI.getSelectedJob().status,'CANCELLED');
    const slow=ctx.CampaignUI.openJob(slowId);await flush();assert.equal(slowStarted,true);
    await ctx.CampaignUI.openJob(id3);releaseSlow();await slow;
    assert.equal(ctx.CampaignUI.getSelectedJob().job_id,id3,'A late older job must not overwrite the selected job');
    assert.equal(ctx.CampaignUI.getResult(),null);
    get('campaign-seeds').value='1,1';const postCount=posts.length;await get('campaign-prepare').click();
    assert.equal(posts.length,postCount);assert.match(get('campaign-error').textContent,/distinct/);
    await ctx.CampaignUI.refreshHistory();assert.equal(get('campaign-history').children.length,2);
    await get('campaign-history').children[1].children[4].children[0].click();
    assert.equal(assuranceOpened,'5'.repeat(32));
    ctx.CampaignUI.stopPolling();
    console.log('Engine-backed Counterfactual Studio: prepare-only, digest approval, real summaries, paired tables, Wilson intervals, saved-case replay, exports, cancellation, race protection and assurance history passed');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
