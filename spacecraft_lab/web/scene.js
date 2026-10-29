'use strict';
// Dependency-free WebGL inspection schematic. Draw only on telemetry/camera changes.
window.createSpacecraftScene=function(canvas,onFailure){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!gl){onFailure('WebGL unavailable; using the telemetry-driven 2D view.');return null;}
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('3D shader unavailable');return s;};
  let program;
  try{
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 n; uniform mat4 model; uniform mat4 view; varying vec3 normal; void main(){gl_Position=view*model*vec4(p,1.);normal=mat3(model)*n;}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 normal; uniform vec3 color; uniform float sunlight; void main(){float light=.26+sunlight*.74*max(dot(normalize(normal),normalize(vec3(-1.,2.,3.))),0.);gl_FragColor=vec4(color*light,1.);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D renderer unavailable');
  }catch(error){onFailure(error.message);return null;}
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
  const multiply=(a,b)=>{const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;};
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const rotY=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
  const rotX=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
  const transform=(pos,scale)=>new Float32Array([scale[0],0,0,0,0,scale[1],0,0,0,0,scale[2],0,...pos,1]);
  const vertices=[],normals=[];
  const face=(points,normal)=>{for(const i of [0,1,2,0,2,3]){vertices.push(...points[i]);normals.push(...normal);}};
  face([[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[0,0,1]);
  face([[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[0,0,-1]);
  face([[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[1,0,0]);
  face([[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[-1,0,0]);
  face([[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[0,1,0]);
  face([[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],[0,-1,0]);
  for(const [name,data] of [['p',vertices],['n',normals]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);}
  const modelLoc=gl.getUniformLocation(program,'model'),viewLoc=gl.getUniformLocation(program,'view');
  const colorLoc=gl.getUniformLocation(program,'color'),sunLoc=gl.getUniformLocation(program,'sunlight');
  const presets={isometric:[.55,-.3,9],front:[0,0,9],top:[0,-Math.PI/2,9]};
  let azimuth=.55,elevation=-.3,distance=9,row=null,cfg=null,drag=null,lost=false;
  let inspection={exploded:false,overlay:'subsystems',selected:null};
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const mix=(a,b,fraction)=>a.map((value,i)=>value+(b[i]-value)*fraction);
  const thermalColor=fraction=>fraction===null?[.38,.44,.51]:fraction<.5?
    mix([.13,.42,.94],[.23,.82,.7],fraction*2):mix([.23,.82,.7],[1,.25,.14],(fraction-.5)*2);
  function draw(){
    if(lost||!row||!canvas.clientWidth||!canvas.clientHeight)return;
    const ratio=clamp(window.devicePixelRatio||1,1,2);
    canvas.width=Math.round(canvas.clientWidth*ratio);canvas.height=Math.round(canvas.clientHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.035,.065,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const aspect=canvas.width/canvas.height,f=1/Math.tan(Math.PI/8),near=.1,far=100;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    const camera=identity();camera[14]=-distance;
    gl.uniformMatrix4fv(viewLoc,false,multiply(projection,multiply(camera,multiply(rotX(elevation),rotY(azimuth)))));
    const state=LabUI.sceneState(row,cfg),measurements=LabUI.inspectionState(row,cfg);
    const attitude=rotY(Number.isFinite(state.yaw)?state.yaw:0);
    gl.uniform1f(sunLoc,state.eclipse?.22:1);
    const box=(pos,scale,color)=>{gl.uniformMatrix4fv(modelLoc,false,multiply(attitude,transform(pos,scale)));gl.uniform3fv(colorLoc,color);gl.drawArrays(gl.TRIANGLES,0,36);};
    const outline=(pos,scale,color)=>{
      const [x,y,z]=pos,[w,h,d]=scale,edge=.018,front=z+d+.022;
      box([x-w,y,front],[edge,h,edge],color);box([x+w,y,front],[edge,h,edge],color);
      box([x,y-h,front],[w,edge,edge],color);box([x,y+h,front],[w,edge,edge],color);
    };
    // The exploded offsets and guides are schematic inspection geometry, never plant motion.
    const guide=(from,to)=>{
      let start=from.slice();
      for(let axis=0;axis<3;axis++){
        const length=Math.abs(to[axis]-start[axis]);if(length<.001)continue;
        const pos=start.slice(),scale=[.012,.012,.012];
        pos[axis]=(start[axis]+to[axis])/2;scale[axis]=length/2;
        box(pos,scale,[.19,.33,.43]);start[axis]=to[axis];
      }
    };
    const temperature=thermalColor(measurements.temperatureFraction);
    const radiator=inspection.exploded?[-1.2,.45,1.15]:[0,0,.7];
    const battery=inspection.exploded?[1.17,-.1,1.25]:[-.23,-.15,.87];
    const antenna=inspection.exploded?[0,1.6,.4]:[0,1.05,0];
    box([0,0,0],[.7,.8,.65],inspection.overlay==='thermal'?temperature:[.42,.52,.64]);
    if(inspection.exploded){guide([0,0,.7],radiator);guide([-.23,-.15,.87],battery);guide([0,.8,0],[antenna[0],antenna[1]-.3,antenna[2]]);}
    box(radiator,[.56,.57,.05],temperature);
    // One modeled thermal node: this color is its configured-range position, not a surface heat map.
    if(inspection.selected==='thermal')outline(radiator,[.56,.57,.05],[1,.78,.38]);
    box(battery,[.28,.4,.08],[.2,.28,.34]);
    box([battery[0],battery[1],battery[2]+.09],[.22,.33,.015],[.045,.085,.105]);
    const fill=measurements.batteryFill;
    if(fill&&fill.fraction>0)box([battery[0],battery[1]+fill.centerY*.66,battery[2]+.115],[.2,fill.halfHeight*.66,.018],[.25,.87,.67]);
    outline(battery,[.28,.4,.08],inspection.selected==='eps'?[1,.78,.38]:[.58,.68,.72]);
    box([battery[0],battery[1]+.43,battery[2]],[.09,.035,.06],[.58,.68,.72]);
    const controller=[.35,.44,.78];
    box(controller,[.14,.14,.07],state.safe?[1,.6,.2]:[.45,.7,1]);
    if(inspection.selected==='fdir')outline(controller,[.14,.14,.07],[1,.78,.38]);
    for(const side of [-1,1]){
      box([side*1.05,0,0],[.4,.06,.06],[.6,.65,.7]);
      box([side*2.05,0,0],[.95,.65,.045],inspection.overlay==='thermal'?[.16,.23,.3]:state.solar?[.08,.36,.58]:[.065,.12,.2]);
      for(let x=0;x<5;x++)box([side*(1.2+x*.4),0,.052],[.012,.65,.006],[.25,.6,.7]);
      box([side*.48,-.95,-.2],[.13,.18,.13],[.55,.58,.64]);
    }
    box(antenna,[.04,.3,.04],[.65,.7,.75]);
    box([antenna[0],antenna[1]+.33,antenna[2]],[.45,.07,.35],state.link?[.4,.9,.78]:[.95,.5,.2]);
    if(inspection.overlay==='power'){
      // Three relative bars (solar / served / unserved, top to bottom), using recorded W only.
      // Unknown channels remain unfilled. There is no inferred voltage, current or power routing.
      const watts=[measurements.solarW,measurements.servedW,measurements.unservedW];
      const maximum=Math.max(1,...watts.map(value=>value===null?0:value));
      const colors=[[.27,.87,.67],[.32,.64,1],[1,.48,.25]];
      watts.forEach((value,i)=>{
        const y=-1.4-i*.19;
        box([0,y,.85],[.7,.055,.018],[.13,.2,.27]);
        if(value!==null&&value>0){const halfWidth=.7*(value/maximum);box([-.7+halfWidth,y,.88],[halfWidth,.04,.015],colors[i]);}
      });
    }
  }
  function setView(name){
    if(!Object.hasOwn(presets,name))throw new Error('Unknown inspection view');
    [azimuth,elevation,distance]=presets[name];draw();
  }
  function resetCamera(){setView('isometric');}
  function zoom(delta){
    if(!Number.isFinite(delta))throw new Error('Zoom requires a finite distance delta');
    distance=clamp(distance+delta,5,18);draw();
  }
  function setInspection(options={}){
    if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Invalid inspection options');
    for(const key of Object.keys(options))if(!['exploded','overlay','selected'].includes(key))throw new Error('Unknown inspection option');
    if('exploded'in options&&typeof options.exploded!=='boolean')throw new Error('Exploded inspection requires a boolean');
    if('overlay'in options&&!['subsystems','thermal','power'].includes(options.overlay))throw new Error('Unknown inspection overlay');
    if('selected'in options&&options.selected!==null&&!['eps','thermal','fdir'].includes(options.selected))throw new Error('Unknown inspection subsystem');
    inspection={...inspection,...options};draw();
  }
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth+=(e.clientX-drag[0])*.01;elevation=clamp(elevation+(e.clientY-drag[1])*.01,-Math.PI/2,Math.PI/2);drag=[e.clientX,e.clientY];draw();});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.01);},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){
    e.preventDefault();
    if(e.key==='Home'){resetCamera();return;}
    if(e.key==='+'){zoom(-.5);return;}if(e.key==='-'){zoom(.5);return;}
    if(e.key==='ArrowLeft')azimuth-=.15;if(e.key==='ArrowRight')azimuth+=.15;
    if(e.key==='ArrowUp')elevation=clamp(elevation-.15,-Math.PI/2,Math.PI/2);
    if(e.key==='ArrowDown')elevation=clamp(elevation+.15,-Math.PI/2,Math.PI/2);draw();
  }});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(lost)return;lost=true;drag=null;onFailure('3D context lost; using 2D.');});
  window.addEventListener('resize',draw);
  return {update(r,c){row=r;cfg=c;draw();},draw,setInspection,setView,resetCamera,zoom};
};
