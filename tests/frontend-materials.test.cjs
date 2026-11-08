const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ui=require('../spacecraft_lab/web/ui-core.js');
const source=fs.readFileSync(require.resolve('../spacecraft_lab/web/scene.js'),'utf8');
// A strict adapter observes the commands the real scene submits at the GPU/browser
// boundaries. It catches missing depth passes, invalid NPOT uploads, leaked resources,
// and callbacks that render after context loss. Shader compilation is checked natively.
function fixture({framebuffer=true,complete=true,uploadError=false,images=true,mipmaps=false,shadowShader=true,lowPrecision=false,detailed=false,derivatives=true}={}){
  const events=[],requests=[],listeners={},draws=[],uploads=[],textures=[],framebuffers=[],renderbuffers=[];
  let currentProgram=null,currentFramebuffer=null,uniforms=new Map(),activeUnit=0,serial=0;
  const bindings=new Map(),parameters=new Map();
  const gl={};
  for(const key of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','FLOAT','TRIANGLES','DEPTH_TEST','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','TEXTURE_2D','TEXTURE0','TEXTURE1','TEXTURE2','RGBA','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','LINEAR','NEAREST','FRAMEBUFFER','RENDERBUFFER','DEPTH_COMPONENT16','COLOR_ATTACHMENT0','DEPTH_ATTACHMENT','FRAMEBUFFER_COMPLETE','MAX_TEXTURE_SIZE','MAX_RENDERBUFFER_SIZE','HIGH_FLOAT'])gl[key]=++serial;
  gl.TEXTURE1=gl.TEXTURE0+1;gl.TEXTURE2=gl.TEXTURE0+2;
  const resource=kind=>({kind,id:++serial});
  Object.assign(gl,{
    getExtension:()=>derivatives?{}:null,getParameter:()=>2048,getShaderPrecisionFormat:()=>({precision:lowPrecision?0:23}),
    createShader:type=>({type}),shaderSource(shader,code){shader.code=code;},compileShader(){},getShaderParameter:shader=>shadowShader||!shader.code.includes('gl_FragCoord.z'),
    createProgram:()=>resource('program'),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
    useProgram(program){currentProgram=program;uniforms=new Map();},enable(){},
    createBuffer:()=>resource('buffer'),bindBuffer(){},bufferData(){},getAttribLocation:(_program,key)=>key==='p'?0:1,
    enableVertexAttribArray(){},vertexAttribPointer(){},getUniformLocation:(_program,key)=>key,
    uniformMatrix4fv(key,_transpose,value){uniforms.set(key,Array.from(value));},
    uniform3fv(key,value){uniforms.set(key,Array.from(value));},uniform1f(key,value){uniforms.set(key,value);},
    uniform1i(key,value){uniforms.set(key,value);},
    viewport(...value){events.push({kind:'viewport',value,framebuffer:currentFramebuffer});},
    clearColor(...value){events.push({kind:'clearColor',value,framebuffer:currentFramebuffer});},
    clear(){events.push({kind:'clear',framebuffer:currentFramebuffer});},
    drawArrays(_mode,_first,count){draws.push({program:currentProgram,framebuffer:currentFramebuffer,count,uniforms:Object.fromEntries(uniforms),bindings:new Map(bindings)});},
    createTexture(){const texture=resource('texture');textures.push(texture);return texture;},
    bindTexture(_target,texture){bindings.set(activeUnit,texture);},activeTexture(unit){activeUnit=unit-gl.TEXTURE0;},
    texParameteri(_target,key,value){const texture=bindings.get(activeUnit);assert.ok(texture,'texture must be bound before parameters');if(!parameters.has(texture))parameters.set(texture,new Map());parameters.get(texture).set(key,value);},
    texImage2D(...args){const texture=bindings.get(activeUnit);assert.ok(texture,'texture must be bound before upload');if(args.length===6&&uploadError)throw new Error('image upload rejected');uploads.push({texture,args});},
    deleteTexture(texture){events.push({kind:'deleteTexture',resource:texture});},
    createFramebuffer(){const value=resource('framebuffer');framebuffers.push(value);return value;},
    bindFramebuffer(_target,value){currentFramebuffer=value;},framebufferTexture2D(){},
    checkFramebufferStatus:()=>complete?gl.FRAMEBUFFER_COMPLETE:-1,
    deleteFramebuffer(value){events.push({kind:'deleteFramebuffer',resource:value});},
    createRenderbuffer(){const value=resource('renderbuffer');renderbuffers.push(value);return value;},
    bindRenderbuffer(){},renderbufferStorage(){},framebufferRenderbuffer(){},
    deleteRenderbuffer(value){events.push({kind:'deleteRenderbuffer',resource:value});}
  });
  if(!framebuffer)delete gl.createFramebuffer;
  if(mipmaps){
    gl.LINEAR_MIPMAP_LINEAR=++serial;
    gl.generateMipmap=()=>events.push({kind:'mipmap',texture:bindings.get(activeUnit)});
  }
  class TestImage{constructor(){this.width=769;this.height=513;this.naturalWidth=769;this.naturalHeight=513;}set src(value){this.url=value;requests.push(this);}}
  const browser={devicePixelRatio:1,addEventListener(){},...(images?{Image:TestImage}:{}),...(mipmaps?{document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})}}:{})};
  const canvas={dataset:{},clientWidth:900,clientHeight:345,getContext:()=>gl,addEventListener:(name,fn)=>{listeners[name]=fn;},setPointerCapture(){}};
  const failures=[];
  const context=vm.createContext({window:browser,LabUI:ui,Float32Array,Uint8Array,Math,Number,Error});
  if(detailed)vm.runInContext(fs.readFileSync(require.resolve('../spacecraft_lab/web/scene-model.js'),'utf8'),context);
  vm.runInContext(source,context);
  const renderer=browser.createSpacecraftScene(canvas,message=>failures.push(message));
  const row=Object.freeze({battery_pct:37.5,temperature_k:280,solar_w:132.25,served_w:95.5,unserved_w:2.75,sunlit:true,comms_up:true,mode:'normal',pointing_error_deg:0});
  const cfg=Object.freeze({low_temperature_k:260,high_temperature_k:340});
  return {gl,canvas,renderer,events,requests,listeners,draws,uploads,textures,framebuffers,renderbuffers,parameters,failures,row,cfg};
}
const lit=fixture();
assert.ok(lit.renderer);
assert.equal(lit.canvas.dataset.renderMaterials,'loading');
assert.deepEqual(lit.requests.map(image=>image.url).sort(),['/mli-material.png','/solar-material.png']);
lit.renderer.update(lit.row,lit.cfg);
const first=lit.draws.slice(),depth=first.filter(draw=>draw.framebuffer),color=first.filter(draw=>!draw.framebuffer);
assert.ok(depth.length>100,'supported WebGL must draw spacecraft into an offscreen depth target');
assert.equal(depth.length,color.length,'each submitted component casts and receives shadows');
for(let i=0;i<depth.length;i++){assert.deepEqual(depth[i].uniforms.model,color[i].uniforms.model);assert.equal(depth[i].count,color[i].count);}
assert.notEqual(depth[0].program,color[0].program,'depth encoding needs its own shader program');
assert.equal(color[0].uniforms.shadowEnabled,1);assert.equal(color[0].uniforms.bumpEnabled,1);
assert.equal(lit.canvas.dataset.renderShadows,'mapped');assert.equal(lit.canvas.dataset.modelDetail,'schematic');
assert.deepEqual(color[0].uniforms.lightDirection,[-2/Math.sqrt(45),4/Math.sqrt(45),5/Math.sqrt(45)]);
assert.ok(lit.events.find(event=>event.kind==='viewport'&&event.framebuffer&&event.value[2]>=512),'bounded depth map has useful resolution');
assert.deepEqual(lit.events.filter(event=>event.kind==='clearColor'&&!event.framebuffer).at(-1).value,[0,0,0,0]);
// Fit the actual shadow view around submitted geometry: no hardware may fall outside
// the Sun camera, including thin cells, masts and exploded inspection modules.
function assertLightCoverage(frame){for(const item of frame.filter(draw=>!draw.framebuffer)){
  const transform=item.uniforms.lightView,model=item.uniforms.model;
  assert.ok(transform.every(Number.isFinite));
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const point=[x,y,z,1],world=Array.from({length:4},(_,r)=>point.reduce((sum,v,c)=>sum+model[c*4+r]*v,0));
    const clip=Array.from({length:4},(_,r)=>world.reduce((sum,v,c)=>sum+transform[c*4+r]*v,0));
    assert.ok(clip.slice(0,3).every(v=>Math.abs(v/clip[3])<1),'all submitted hardware must fit the light camera');
  }
}}
assertLightCoverage(first);
for(const request of lit.requests)request.onload();
assert.equal(lit.uploads.filter(upload=>upload.args.length===6).length,2,'both material photographs upload on load');
assert.equal(lit.canvas.dataset.renderMaterials,'textured');
assert.equal(lit.draws.at(-1).uniforms.foilReady,1);assert.equal(lit.draws.at(-1).uniforms.solarReady,1);
for(const upload of lit.uploads.filter(upload=>upload.args.length===6)){
  const params=lit.parameters.get(upload.texture);
  assert.equal(params.get(lit.gl.TEXTURE_WRAP_S),lit.gl.CLAMP_TO_EDGE);assert.equal(params.get(lit.gl.TEXTURE_WRAP_T),lit.gl.CLAMP_TO_EDGE);
  assert.equal(params.get(lit.gl.TEXTURE_MIN_FILTER),lit.gl.LINEAR,'NPOT photographs cannot use incomplete mipmap sampling');
}
const resources=[lit.textures.length,lit.framebuffers.length,lit.renderbuffers.length],requests=lit.requests.length;
for(let i=0;i<12;i++){lit.renderer.update(lit.row,lit.cfg);lit.renderer.setView(i%2?'front':'top');lit.renderer.setInspection({exterior:true});}
assert.deepEqual([lit.textures.length,lit.framebuffers.length,lit.renderbuffers.length],resources,'replay/camera updates reuse GPU targets');
assert.equal(lit.requests.length,requests,'replay must not refetch material photographs');
assert.ok(resources[0]<=3&&resources[1]===1&&resources[2]===1,'GPU texture and depth allocations stay bounded');
lit.draws.length=0;lit.renderer.setInspection({exterior:true,exploded:true});assertLightCoverage(lit.draws);
lit.renderer.setInspection({overlay:'thermal'});assert.equal(lit.draws.at(-1).uniforms.materialDetail,0,'material hue must not obscure measured thermal colors');
const eclipse=fixture();eclipse.renderer.update({...eclipse.row,sunlit:false},eclipse.cfg);
assert.ok(eclipse.draws.at(-1).uniforms.sunlight<color[0].uniforms.sunlight);
assert.equal(eclipse.draws.at(-1).uniforms.shadowEnabled,0,'eclipse disables direct Sun shadows');
for(const options of [{framebuffer:false},{complete:false},{shadowShader:false},{lowPrecision:true}]){
  const fallback=fixture(options);fallback.renderer.update(fallback.row,fallback.cfg);
  assert.ok(fallback.draws.length>100);assert.ok(fallback.draws.every(draw=>!draw.framebuffer),'unsupported/incomplete targets retain the one-pass scene');
  assert.equal(fallback.draws.at(-1).uniforms.shadowEnabled,0);
  if(options.lowPrecision)assert.equal(fallback.draws.at(-1).uniforms.bumpEnabled,0,'mediump devices must retain finite geometric normals without derivative division');
  assert.deepEqual(fallback.failures,[],'optional shadow failure cannot trigger 2D fallback');
  if(options.complete===false){assert.equal(fallback.events.filter(event=>event.kind==='deleteFramebuffer').length,1);assert.equal(fallback.events.filter(event=>event.kind==='deleteRenderbuffer').length,1);}
}
for(const options of [{uploadError:true},{}]){
  const fallback=fixture(options);fallback.renderer.update(fallback.row,fallback.cfg);
  for(const request of fallback.requests)options.uploadError?request.onload():request.onerror();
  assert.equal(fallback.draws.at(-1).uniforms.foilReady,0);assert.equal(fallback.draws.at(-1).uniforms.solarReady,0);assert.deepEqual(fallback.failures,[],'failed material uploads retain procedural surfaces');
}
const detailed=fixture({detailed:true});detailed.renderer.update(detailed.row,detailed.cfg);detailed.draws.length=0;
detailed.renderer.setInspection({exterior:true});assert.equal(detailed.canvas.dataset.modelDetail,'detailed');assertLightCoverage(detailed.draws);
assert.ok(detailed.draws.some(draw=>!draw.framebuffer&&draw.uniforms.surface===4),'detailed helper feeds optical materials through the shared shadow renderer');
detailed.renderer.setInspection({overlay:'thermal'});assert.equal(detailed.canvas.dataset.modelDetail,'schematic');
detailed.renderer.setInspection({overlay:'subsystems',exploded:true});assert.equal(detailed.canvas.dataset.modelDetail,'schematic');
const mipmapped=fixture({mipmaps:true});mipmapped.renderer.update(mipmapped.row,mipmapped.cfg);
for(const request of mipmapped.requests)request.onload();
assert.equal(mipmapped.events.filter(event=>event.kind==='mipmap').length,2,'NPOT photos are resampled once for stable minification when canvas support exists');
for(const upload of mipmapped.uploads.filter(upload=>upload.args.length===6)){
  assert.equal(upload.args[5].width,512);assert.equal(upload.args[5].height,512);
  assert.equal(mipmapped.parameters.get(upload.texture).get(mipmapped.gl.TEXTURE_MIN_FILTER),mipmapped.gl.LINEAR_MIPMAP_LINEAR);
}
const withoutImages=fixture({images:false});withoutImages.renderer.update(withoutImages.row,withoutImages.cfg);
assert.equal(withoutImages.canvas.dataset.renderMaterials,'procedural');assert.deepEqual(withoutImages.failures,[]);
const lost=fixture();lost.renderer.update(lost.row,lost.cfg);
lost.listeners.webglcontextlost({preventDefault(){}});
const before=[lost.draws.length,lost.uploads.length];
for(const request of lost.requests)if(request.onload)request.onload();
lost.renderer.draw();lost.renderer.update(lost.row,lost.cfg);
assert.deepEqual([lost.draws.length,lost.uploads.length],before,'late material completion must not touch a lost GPU context');
assert.equal(lost.canvas.dataset.renderMaterials,'unavailable');assert.equal(lost.canvas.dataset.renderShadows,'fallback');
assert.equal(lost.failures.length,1);assert.match(lost.failures[0],/2D/);
console.log('Photographic materials, coherent Sun depth pass, optional GPU fallback and bounded async lifecycle passed');
