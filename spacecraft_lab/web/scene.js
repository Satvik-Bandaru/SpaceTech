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
  let azimuth=.55,elevation=-.3,distance=9,row=null,cfg=null,drag=null;
  function draw(){
    if(!row||!canvas.clientWidth)return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(canvas.clientWidth*ratio);canvas.height=Math.round(canvas.clientHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.035,.065,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const aspect=canvas.width/canvas.height,f=1/Math.tan(Math.PI/8),near=.1,far=100;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    const camera=identity();camera[14]=-distance;
    gl.uniformMatrix4fv(viewLoc,false,multiply(projection,multiply(camera,multiply(rotX(elevation),rotY(azimuth)))));
    const state=LabUI.sceneState(row,cfg),attitude=rotY(state.yaw);
    gl.uniform1f(sunLoc,state.eclipse?.22:1);
    const box=(pos,scale,color)=>{gl.uniformMatrix4fv(modelLoc,false,multiply(attitude,transform(pos,scale)));gl.uniform3fv(colorLoc,color);gl.drawArrays(gl.TRIANGLES,0,36);};
    box([0,0,0],[.7,.8,.65],[.42,.52,.64]);
    box([0,0,.69],[.55,.55,.05],state.hot?[1,.25,.18]:[.19,.35,.43]);
    box([-.2,-.15,.77],[.23,.34,.07],state.lowBattery?[1,.4,.16]:[.3,.85,.65]);
    box([.35,.44,.77],[.12,.12,.07],state.safe?[1,.6,.2]:[.45,.7,1]);
    for(const side of [-1,1]){
      box([side*1.05,0,0],[.4,.06,.06],[.6,.65,.7]);
      box([side*2.05,0,0],[.95,.65,.045],state.solar?[.08,.36,.58]:[.065,.12,.2]);
      for(let x=0;x<5;x++)box([side*(1.2+x*.4),0,.052],[.012,.65,.006],[.25,.6,.7]);
      box([side*.48,-.95,-.2],[.13,.18,.13],[.55,.58,.64]);
    }
    box([0,1.05,0],[.04,.3,.04],[.65,.7,.75]);
    box([0,1.38,0],[.45,.07,.35],state.link?[.4,.9,.78]:[.95,.5,.2]);
  }
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth+=(e.clientX-drag[0])*.01;elevation=Math.max(-1.4,Math.min(1.4,elevation+(e.clientY-drag[1])*.01));drag=[e.clientX,e.clientY];draw();});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(5,Math.min(18,distance+e.deltaY*.01));draw();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')azimuth-=.15;if(e.key==='ArrowRight')azimuth+=.15;if(e.key==='+')distance=Math.max(5,distance-.5);if(e.key==='-')distance=Math.min(18,distance+.5);draw();}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('3D context lost; using 2D.');});
  window.addEventListener('resize',draw);
  return {update(r,c){row=r;cfg=c;draw();},draw};
};
