const assert = require('node:assert/strict');
const ui = require('../spacecraft_lab/web/ui-core.js');
assert.equal(ui.intervalDelay(10, 1), 10000);
assert.equal(ui.intervalDelay(10, 20), 500);
assert.equal(ui.replayIndex(999, 10), 9);
assert.equal(ui.replayIndex(-1, 10), 0);
assert.throws(()=>ui.intervalDelay(10, 0));
const scene=ui.sceneState({battery_pct:12,temperature_k:350,solar_w:0,comms_up:false,operating_mode:'SAFE_MODE',pointing_error_deg:45,sunlit:false}, {high_temperature_k:333});
assert.equal(scene.eclipse,true);
assert.equal(scene.hot,true);
assert.equal(scene.link,false);
assert.equal(scene.lowBattery,true);
assert.equal(scene.yaw,Math.PI/4);

// Catch threshold-only battery/thermal displays: intermediate telemetry must stay continuous.
const cfg={low_temperature_k:260,high_temperature_k:340};
const telemetry={battery_pct:37.5,temperature_k:280,solar_w:132.25,served_w:95.5,unserved_w:2.75};
const inspection=ui.inspectionState(telemetry,cfg);
assert.equal(inspection.batteryFraction,.375);
assert.equal(inspection.temperatureFraction,.25);
assert.equal(inspection.temperatureK,280);
assert.equal(inspection.solarW,132.25);
assert.equal(inspection.servedW,95.5);
assert.equal(inspection.unservedW,2.75);
assert.deepEqual(inspection.batteryFill,{fraction:.375,centerY:-.3125,halfHeight:.1875});
assert.equal(ui.inspectionState({...telemetry,battery_pct:37.6},cfg).batteryFraction,.376);
assert.equal(ui.inspectionState({...telemetry,temperature_k:300},cfg).temperatureFraction,.5);
assert.deepEqual(telemetry,{battery_pct:37.5,temperature_k:280,solar_w:132.25,served_w:95.5,unserved_w:2.75});

// Geometry clamps out-of-range observations without rewriting the actual measurements.
const bounded=ui.inspectionState({...telemetry,battery_pct:110,temperature_k:350},cfg);
assert.equal(bounded.batteryPct,110);
assert.equal(bounded.batteryFraction,1);
assert.equal(bounded.temperatureK,350);
assert.equal(bounded.temperatureFraction,1);
assert.deepEqual(bounded.batteryFill,{fraction:1,centerY:0,halfHeight:.5});
const empty=ui.inspectionState({...telemetry,battery_pct:-10,temperature_k:240},cfg);
assert.equal(empty.batteryFraction,0);
assert.equal(empty.temperatureFraction,0);
assert.deepEqual(empty.batteryFill,{fraction:0,centerY:-.5,halfHeight:0});

// Missing/nonfinite channels stay unknown; zero is a real measured value, not a fallback.
const unknown=ui.inspectionState({battery_pct:NaN,temperature_k:Infinity,solar_w:'12',served_w:-1,unserved_w:undefined},cfg);
for(const key of ['batteryPct','batteryFraction','temperatureK','temperatureFraction','solarW','servedW','unservedW','batteryFill'])assert.equal(unknown[key],null,key);
assert.equal(ui.inspectionState({solar_w:0,served_w:0,unserved_w:0},cfg).solarW,0);
assert.equal(ui.inspectionState(telemetry,{low_temperature_k:300,high_temperature_k:300}).temperatureFraction,null);
assert.equal(ui.inspectionState(telemetry,{low_temperature_k:NaN,high_temperature_k:340}).temperatureFraction,null);
assert.equal(ui.inspectionState().batteryFill,null);

// Use a GPU boundary adapter: assertions inspect the renderer's matrices and geometry,
// while browser verification covers the native WebGL implementation itself.
const fs=require('node:fs'),vm=require('node:vm');
const frames=[],listeners={},uniforms={};
const gl={COMPILE_STATUS:1,LINK_STATUS:2,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
  useProgram(){},enable(){},createBuffer:()=>({}),bindBuffer(){},bufferData(){},
  getAttribLocation:()=>0,enableVertexAttribArray(){},vertexAttribPointer(){},
  getUniformLocation:(_program,key)=>key,viewport(){},clearColor(){},clear(){frames.push([]);},
  uniformMatrix4fv(key,_transpose,value){uniforms[key]=Array.from(value);},
  uniform3fv(key,value){uniforms[key]=Array.from(value);},uniform1f(key,value){uniforms[key]=value;},
  drawArrays(){frames.at(-1).push(structuredClone(uniforms));}};
const canvas={clientWidth:800,clientHeight:500,getContext:()=>gl,
  addEventListener:(name,fn)=>{listeners[name]=fn;},setPointerCapture(){}};
let failure='';
const browser={devicePixelRatio:1,addEventListener(){}};
vm.runInNewContext(fs.readFileSync(require.resolve('../spacecraft_lab/web/scene.js'),'utf8'),{window:browser,LabUI:ui,Float32Array,Math,Number,Error});
const renderer=browser.createSpacecraftScene(canvas,message=>{failure=message;});
const row={...telemetry,sunlit:true,comms_up:true,mode:'normal',pointing_error_deg:0};
renderer.update(row,cfg);
const original=structuredClone(frames.at(-1));
assert.equal(typeof renderer.setInspection,'function');
assert.equal(typeof renderer.setView,'function');
assert.equal(typeof renderer.resetCamera,'function');
assert.equal(typeof renderer.zoom,'function');
renderer.setView('front');
assert.notDeepEqual(frames.at(-1)[0].view,original[0].view);
renderer.setView('top');
assert.notDeepEqual(frames.at(-1)[0].view,frames.at(-2)[0].view);
renderer.resetCamera();
assert.deepEqual(frames.at(-1)[0].view,original[0].view);
renderer.zoom(1000);const farView=frames.at(-1)[0].view;
renderer.zoom(1000);assert.deepEqual(frames.at(-1)[0].view,farView);
renderer.zoom(-1000);const nearView=frames.at(-1)[0].view;
assert.notDeepEqual(nearView,farView);
renderer.zoom(-1000);assert.deepEqual(frames.at(-1)[0].view,nearView);
renderer.resetCamera();
renderer.setInspection({exploded:true,overlay:'thermal',selected:'thermal'});
assert.notDeepEqual(frames.at(-1).map(item=>item.model),original.map(item=>item.model));
assert.notDeepEqual(frames.at(-1).map(item=>item.color),original.map(item=>item.color));
renderer.setInspection({exploded:false,overlay:'subsystems',selected:null});
assert.deepEqual(frames.at(-1),original);
renderer.update({...row,battery_pct:75},cfg);
assert.notDeepEqual(frames.at(-1).map(item=>item.model),original.map(item=>item.model));
renderer.setInspection({overlay:'thermal'});
const coolColors=frames.at(-1).map(item=>item.color);
renderer.update({...row,temperature_k:320},cfg);
assert.notDeepEqual(frames.at(-1).map(item=>item.color),coolColors);
renderer.setInspection({overlay:'power'});
const supplied=structuredClone(frames.at(-1));
renderer.update({...row,solar_w:0,served_w:20,unserved_w:80},cfg);
assert.notDeepEqual(frames.at(-1).map(item=>item.model),supplied.map(item=>item.model));
assert.deepEqual(row,{...telemetry,sunlit:true,comms_up:true,mode:'normal',pointing_error_deg:0});
for(const fn of [()=>renderer.setView('sideways'),()=>renderer.setInspection({overlay:'voltage'}),()=>renderer.setInspection({exploded:'yes'}),()=>renderer.setInspection({selected:'engine'}),()=>renderer.zoom(NaN)])assert.throws(fn);
const frameCount=frames.length;
listeners.webglcontextlost({preventDefault(){}});
renderer.draw();renderer.zoom(1);renderer.update(row,cfg);
assert.equal(frames.length,frameCount);
assert.match(failure,/2D/);
console.log('Frontend replay timing, seek bounds and continuous inspection telemetry mapping passed');
console.log('Inspection camera controls, schematic geometry, measured overlays and context loss passed');
