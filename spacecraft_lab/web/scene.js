'use strict';
// Dependency-free illustrative exterior / inspection geometry. Draw only on state/camera changes.
window.createSpacecraftScene=function(canvas,onFailure){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:true});
  if(!gl){onFailure('WebGL unavailable; using the telemetry-driven 2D view.');return null;}
  const derivatives=Boolean(gl.getExtension&&gl.getExtension('OES_standard_derivatives'));
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('3D shader unavailable');return s;};
  let program;
  try{
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec3 p; attribute vec3 n;
      uniform mat4 model; uniform mat4 normalModel; uniform mat4 view;
      varying vec3 normal; varying vec3 worldPosition; varying vec3 localPosition;
      void main(){
        vec4 world=model*vec4(p,1.); gl_Position=view*world;
        // Normalize in vertex highp before interpolation: thin parts have large
        // inverse-scale normals that can overflow fragment mediump on mobile GPUs.
        normal=normalize(mat3(normalModel)*n); worldPosition=world.xyz; localPosition=p;
      }`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
      ${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
      precision mediump float;
      varying vec3 normal; varying vec3 worldPosition; varying vec3 localPosition;
      uniform vec3 color; uniform vec3 eye; uniform float sunlight; uniform float surface;
      void main(){
        vec3 n=normalize(normal),l=normalize(vec3(-2.,4.,5.));
        vec3 v=normalize(eye-worldPosition),h=normalize(l+v);
        float metal=step(.5,surface)*(1.-step(1.5,surface));
        float foil=step(1.5,surface)*(1.-step(2.5,surface));
        float cell=step(2.5,surface)*(1.-step(3.5,surface));
        float glass=step(3.5,surface);
        // Irregular, restrained blanket creases avoid a checker pattern on the MLI.
        float grain=sin(localPosition.x*17.+sin(localPosition.y*13.+localPosition.z*9.)*2.7);
        grain+=.45*sin(localPosition.y*31.-localPosition.z*19.+sin(localPosition.x*11.));
        float fine=sin(localPosition.x*181.+localPosition.y*127.+localPosition.z*149.);
        vec3 base=pow(max(color,vec3(.001)),vec3(2.2))*(1.+foil*grain*.055+metal*fine*.012);
        // Fine cell fingers and two wider busbars are local surface detail, not circuit telemetry.
        float contactCoordinate=(localPosition.y+1.)*4.;
        float footprint=${derivatives?'fwidth(contactCoordinate)':'.1'};
        float fingers=(1.-smoothstep(.022,.022+max(footprint,.015),abs(fract(contactCoordinate)-.5)));
        fingers*=1.-smoothstep(.10,.35,footprint);
        float busbar=1.-smoothstep(.014,.04,abs(abs(localPosition.x)-.64));
        base=mix(base,vec3(.065,.10,.14),cell*max(fingers*.20,busbar*.45));
        float ndl=max(dot(n,l),0.),ndv=clamp(dot(n,v),0.,1.);
        float fresnel=pow(1.-ndv,5.);
        float roughness=.53-metal*.15+foil*.06-cell*.30-glass*.38;
        float exponent=mix(180.,14.,roughness);
        float highlight=pow(max(dot(n,h),0.),exponent)*(exponent+2.)/52.;
        vec3 f0=mix(vec3(.025),base*.62+vec3(.08),metal);
        f0=mix(f0,base*.74+vec3(.08),foil);
        f0=mix(f0,vec3(.035,.045,.06),cell);
        f0=mix(f0,vec3(.018,.025,.035),glass);
        vec3 specular=f0+(vec3(1.)-f0)*fresnel;
        // An analytic Earth/space environment gives view-dependent reflections without image maps.
        // It is decorative lighting; only the key illumination follows recorded sunlit/eclipsed state.
        vec3 reflected=reflect(-v,n);
        float earth=1.-smoothstep(-.52,.32,reflected.y);
        vec3 environment=mix(vec3(.007,.012,.02),vec3(.045,.095,.16),earth);
        environment+=vec3(.04,.06,.075)*pow(max(1.-abs(reflected.y+.12),0.),12.);
        vec3 ambient=vec3(.075,.095,.13)+vec3(.025,.065,.12)*max(-n.y,0.);
        float cavity=mix(.72,1.,smoothstep(.65,1.,max(abs(localPosition.x),abs(localPosition.y))));
        vec3 lit=base*(ambient+sunlight*vec3(1.16,1.08,.94)*ndl)*(1.-metal*.32-glass*.7);
        lit+=specular*highlight*sunlight*ndl;
        lit+=environment*specular*(.28+metal*.48+foil*.26+cell*.30+glass*.45);
        lit*=mix(1.,cavity,glass);
        // Modest exposure, filmic compression and display gamma keep bright rims and dark cells readable.
        lit*=1.12;
        lit=(lit*(2.51*lit+.03))/(lit*(2.43*lit+.59)+.14);
        gl_FragColor=vec4(pow(clamp(lit,0.,1.),vec3(1./2.2)),1.);
      }`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D renderer unavailable');
  }catch(error){onFailure(error.message);return null;}
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
  const multiply=(a,b)=>{const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;};
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const rotY=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
  const rotX=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
  const rotZ=a=>new Float32Array([Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1]);
  const transform=(pos,scale)=>new Float32Array([scale[0],0,0,0,0,scale[1],0,0,0,0,scale[2],0,...pos,1]);
  const normalize=v=>{const length=Math.hypot(...v);return v.map(value=>value/length);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const attributes=['p','n'].map(name=>gl.getAttribLocation(program,name));
  function mesh(build){
    const vertices=[],normals=[];
    const triangle=(a,b,c,normal)=>{
      const n=normal||normalize(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));
      const smooth=normal&&Array.isArray(normal[0]);
      [a,b,c].forEach((point,i)=>{vertices.push(...point);normals.push(...(smooth?normal[i]:n));});
    };
    const quad=(points,normal)=>{
      const smooth=normal&&Array.isArray(normal[0]);
      triangle(points[0],points[1],points[2],smooth?[normal[0],normal[1],normal[2]]:normal);
      triangle(points[0],points[2],points[3],smooth?[normal[0],normal[2],normal[3]]:normal);
    };
    build(triangle,quad);
    const buffers=[vertices,normals].map(data=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return buffer;});
    return {buffers,count:vertices.length/3};
  }
  const faces=[
    {n:[0,0,1],p:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
    {n:[0,0,-1],p:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]},
    {n:[1,0,0],p:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]},
    {n:[-1,0,0],p:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]},
    {n:[0,1,0],p:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
    {n:[0,-1,0],p:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]}
  ];
  const cube=mesh((_triangle,quad)=>faces.forEach(face=>quad(face.p,face.n)));
  const foil=mesh((triangle)=>{
    // Fixed blanket folds are cosmetic geometry, not a spatial thermal model.
    for(const face of faces){
      const point=(u,v)=>{
        const p=face.p[0].map((value,i)=>value+(face.p[1][i]-value)*u+(face.p[3][i]-value)*v);
        const fold=Math.sin(u*29.+v*37.)*Math.sin(v*19.-u*13.)*.023*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
        return p.map((value,i)=>value+face.n[i]*fold);
      };
      for(let x=0;x<9;x++)for(let y=0;y<9;y++){
        const a=point(x/9,y/9),b=point((x+1)/9,y/9),c=point((x+1)/9,(y+1)/9),d=point(x/9,(y+1)/9);
        triangle(a,b,c);triangle(a,c,d);
      }
    }
  });
  const cylinder=mesh((triangle,quad)=>{
    for(let i=0;i<64;i++){
      const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
      const pa=[Math.cos(a),-1,Math.sin(a)],pb=[Math.cos(b),-1,Math.sin(b)];
      const pc=[pb[0],1,pb[2]],pd=[pa[0],1,pa[2]];
      const na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];
      quad([pa,pd,pc,pb],[na,na,nb,nb]);
      triangle([0,1,0],pc,pd,[0,1,0]);triangle([0,-1,0],pa,pb,[0,-1,0]);
    }
  });
  const dish=mesh((triangle)=>{
    const point=(r,a)=>[r*Math.cos(a),r*Math.sin(a),.38*r*r];
    const normal=p=>normalize([-.76*p[0],-.76*p[1],1]);
    for(let r=0;r<10;r++)for(let i=0;i<48;i++){
      const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
      const p=point(r/10,a),q=point((r+1)/10,a),s=point((r+1)/10,b),t=point(r/10,b);
      triangle(p,q,s,[normal(p),normal(q),normal(s)]);
      if(r)triangle(p,s,t,[normal(p),normal(s),normal(t)]);
    }
  });
  const rim=mesh((_triangle,quad)=>{
    const point=(a,b)=>[(1+.023*Math.cos(b))*Math.cos(a),(1+.023*Math.cos(b))*Math.sin(a),.38+.023*Math.sin(b)];
    for(let a=0;a<48;a++)for(let b=0;b<6;b++){
      const x=a*Math.PI/24,y=(a+1)*Math.PI/24,u=b*Math.PI/3,v=(b+1)*Math.PI/3;
      quad([point(x,u),point(y,u),point(y,v),point(x,v)]);
    }
  });
  // Machined annulus: a real open aperture, with smooth barrel walls and flat front/back rings.
  const annulus=mesh((_triangle,quad)=>{
    for(let i=0;i<64;i++){
      const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
      const point=(angle,r,z)=>[r*Math.cos(angle),r*Math.sin(angle),z];
      const na=[Math.cos(a),Math.sin(a),0],nb=[Math.cos(b),Math.sin(b),0];
      quad([point(a,1,-1),point(b,1,-1),point(b,1,1),point(a,1,1)],[na,nb,nb,na]);
      quad([point(b,.72,-1),point(a,.72,-1),point(a,.72,1),point(b,.72,1)],
        [nb.map(v=>-v),na.map(v=>-v),na.map(v=>-v),nb.map(v=>-v)]);
      quad([point(a,.72,1),point(a,1,1),point(b,1,1),point(b,.72,1)],[0,0,1]);
      quad([point(b,.72,-1),point(b,1,-1),point(a,1,-1),point(a,.72,-1)],[0,0,-1]);
    }
  });
  const chamfered=mesh((triangle,quad)=>{
    const corners=[[-.88,-1],[.88,-1],[1,-.88],[1,.88],[.88,1],[-.88,1],[-1,.88],[-1,-.88]];
    for(let i=0;i<corners.length;i++){
      const p=corners[i],q=corners[(i+1)%corners.length];
      triangle([0,0,1],[...p,1],[...q,1],[0,0,1]);
      triangle([0,0,-1],[...q,-1],[...p,-1],[0,0,-1]);
      quad([[...p,-1],[...q,-1],[...q,1],[...p,1]]);
    }
  });
  const modelLoc=gl.getUniformLocation(program,'model'),normalLoc=gl.getUniformLocation(program,'normalModel'),viewLoc=gl.getUniformLocation(program,'view');
  const colorLoc=gl.getUniformLocation(program,'color'),sunLoc=gl.getUniformLocation(program,'sunlight'),surfaceLoc=gl.getUniformLocation(program,'surface'),eyeLoc=gl.getUniformLocation(program,'eye');
  const presets={isometric:[-.46,.31,7.8],front:[0,0,8.5],top:[0,Math.PI/2,8.5]};
  let [azimuth,elevation,distance]=presets.isometric;
  let row=null,cfg=null,drag=null,lost=false;
  let inspection={exploded:false,overlay:'subsystems',selected:null,exterior:false};
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const mix=(a,b,fraction)=>a.map((value,i)=>value+(b[i]-value)*fraction);
  const thermalColor=fraction=>fraction===null?[.38,.44,.51]:fraction<.5?
    mix([.13,.42,.94],[.23,.82,.7],fraction*2):mix([.23,.82,.7],[1,.25,.14],(fraction-.5)*2);
  function draw(){
    if(lost||!row||!canvas.clientWidth||!canvas.clientHeight)return;
    const ratio=clamp(window.devicePixelRatio||1,1,2);
    canvas.width=Math.round(canvas.clientWidth*ratio);canvas.height=Math.round(canvas.clientHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const aspect=canvas.width/canvas.height,f=1/Math.tan(Math.PI/8),near=.1,far=100;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    // Fit the wide array span consistently; retain vertical room on very wide heroes.
    // User zoom remains a bounded distance, independent of viewport resizing.
    const exterior=inspection.exterior&&!inspection.exploded&&inspection.overlay==='subsystems';
    const framedDistance=distance*Math.max(exterior?.55:inspection.exploded?.78:.62,(exterior?1.25:1.55)/aspect);
    const camera=identity();camera[14]=-framedDistance;
    gl.uniformMatrix4fv(viewLoc,false,multiply(projection,multiply(camera,multiply(rotX(elevation),rotY(azimuth)))));
    gl.uniform3fv(eyeLoc,[-Math.sin(azimuth)*Math.cos(elevation)*framedDistance,Math.sin(elevation)*framedDistance,Math.cos(azimuth)*Math.cos(elevation)*framedDistance]);
    const state=LabUI.sceneState(row,cfg),measurements=LabUI.inspectionState(row,cfg);
    // A fixed exterior presentation tilt is cosmetic; pointing error remains the sole recorded rotation.
    const attitude=multiply(rotY(Number.isFinite(state.yaw)?state.yaw:0),exterior?rotZ(-.14):identity());
    gl.uniform1f(sunLoc,state.eclipse?.14:1);
    let boundMesh=null;
    const part=(shape,pos,scale,color,surface=0,rotation=identity())=>{
      if(boundMesh!==shape){
        shape.buffers.forEach((buffer,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],3,gl.FLOAT,false,0,0);});
        boundMesh=shape;
      }
      const location=identity();location[12]=pos[0];location[13]=pos[1];location[14]=pos[2];
      const orientation=multiply(attitude,multiply(location,rotation));
      gl.uniformMatrix4fv(modelLoc,false,multiply(orientation,transform([0,0,0],scale)));
      // Reciprocal scale retains correct normals on flattened panels and curved hardware.
      gl.uniformMatrix4fv(normalLoc,false,multiply(orientation,transform([0,0,0],scale.map(value=>1/value))));
      gl.uniform3fv(colorLoc,color);gl.uniform1f(surfaceLoc,surface);gl.drawArrays(gl.TRIANGLES,0,shape.count);
    };
    const box=(pos,scale,color,surface=0)=>part(cube,pos,scale,color,surface);
    const rod=(from,to,radius,color)=>{
      const delta=to.map((v,i)=>v-from[i]),length=Math.hypot(...delta);
      if(length<.0001)return;
      const y=normalize(delta),x=normalize(cross(Math.abs(y[2])>.99?[0,1,0]:[0,0,1],y)),z=cross(x,y);
      const rotation=new Float32Array([...x,0,...y,0,...z,0,0,0,0,1]);
      part(cylinder,from.map((v,i)=>(v+to[i])/2),[radius,length/2,radius],color,1,rotation);
    };
    const outline=(pos,scale,color)=>{
      const [x,y,z]=pos,[w,h,d]=scale,edge=.018,front=z+d+.022;
      box([x-w,y,front],[edge,h,edge],color);box([x+w,y,front],[edge,h,edge],color);
      box([x,y-h,front],[w,edge,edge],color);box([x,y+h,front],[w,edge,edge],color);
    };
    // The exploded offsets and guides are schematic inspection geometry, never plant motion.
    const guide=(from,to)=>{
      const delta=to.map((v,i)=>v-from[i]);
      for(let i=0;i<8;i++){
        const a=from.map((v,j)=>v+delta[j]*(i/8)),b=from.map((v,j)=>v+delta[j]*((i+.45)/8));
        rod(a,b,.008,[.24,.43,.58]);
      }
    };
    const silver=[.63,.69,.73],dark=[.045,.065,.085],gold=[.73,.46,.14],highlight=[1,.77,.31];
    const temperature=thermalColor(measurements.temperatureFraction);
    // Measured overlays and exploded inspection always expose the existing schematic modules.
    const radiator=inspection.exploded?[-1.15,.35,1.2]:[.27,.08,.68];
    const battery=inspection.exploded?[1.2,-.08,1.25]:[-.32,-.19,.76];
    const antenna=inspection.exploded?[.1,1.65,.65]:[.18,1.02,.08];
    part(foil,[0,0,0],[.73,.82,.62],inspection.overlay==='thermal'?temperature:gold,2);
    // Aluminum corner rails, visible fasteners and blanket seams give the bus physical depth.
    for(const x of [-.75,.75])for(const z of [-.64,.64]){
      box([x,0,z],[.028,.85,.028],silver,1);
      for(const y of [-.8,.8])part(cylinder,[x,y,z+.022],[.05,.028,.05],silver,1,rotX(Math.PI/2));
    }
    for(const y of [-.84,.84]){
      box([0,y,.64],[.76,.032,.028],silver,1);box([0,y,-.64],[.76,.032,.028],silver,1);
      box([-.75,y,0],[.028,.032,.64],silver,1);box([.75,y,0],[.028,.032,.64],silver,1);
    }
    for(const z of [-.36,.36])box([.745,0,z],[.012,.78,.012],[.4,.27,.1],1);
    box([0,.85,0],[.64,.035,.55],dark);box([0,-.86,0],[.63,.035,.54],dark);
    box([0,0,-.645],[.59,.67,.025],[.31,.35,.4],1);
    for(let i=0;i<9;i++)box([-.48+i*.12,0,-.681],[.016,.59,.012],[.6,.65,.69],1);
    if(inspection.exploded){guide([.27,.08,.68],radiator);guide([-.32,-.19,.76],battery);guide([.18,.85,.08],antenna);}
    if(!exterior){
    // This is one modeled thermal node, never a spatial surface heat map.
    box(radiator,[.31,.56,.035],inspection.overlay==='thermal'?temperature:[.77,.8,.81],1);
    for(let i=0;i<7;i++)box([radiator[0],radiator[1]-.43+i*.14,radiator[2]+.043],[.275,.008,.006],[.3,.35,.39],1);
    if(inspection.selected==='thermal')outline(radiator,[.31,.56,.035],highlight);
    box(battery,[.23,.38,.065],dark);
    box([battery[0],battery[1],battery[2]+.07],[.18,.31,.013],[.075,.105,.13]);
    const fill=measurements.batteryFill;
    if(fill&&fill.fraction>0)box([battery[0],battery[1]+fill.centerY*.6,battery[2]+.091],[.165,fill.halfHeight*.6,.012],[.23,.83,.64]);
    outline(battery,[.23,.38,.065],inspection.selected==='eps'?highlight:silver);
    box([battery[0],battery[1]+.405,battery[2]],[.075,.028,.045],silver,1);
    const controller=[-.28,.49,.73];
    box(controller,[.21,.15,.055],[.11,.15,.18],1);
    box([controller[0],controller[1],controller[2]+.062],[.145,.087,.012],state.safe?[1,.5,.16]:[.23,.52,.69]);
    for(const x of [-.16,.16])for(const y of [-.1,.1])part(cylinder,[controller[0]+x,controller[1]+y,controller[2]+.065],[.018,.013,.018],silver,1,rotX(Math.PI/2));
    if(inspection.selected==='fdir')outline(controller,[.21,.15,.055],highlight);
    }else{
      const charcoal=[.075,.085,.095],black=[.012,.017,.023],machined=[.50,.53,.56];
      part(chamfered,[0,0,.665],[.71,.79,.045],charcoal);
      // Segmented front panels, recessed joints, corner bosses and flush screw heads.
      for(const y of [-.66,.66]){
        part(chamfered,[0,y,.716],[.63,.095,.014],[.095,.105,.12]);
        for(const x of [-.56,.56]){
          part(cylinder,[x,y,.739],[.035,.013,.035],machined,1,rotX(Math.PI/2));
          box([x,y,.754],[.018,.004,.002],black);
        }
      }
      for(const x of [-.66,.66]){
        box([x,0,.726],[.022,.55,.018],silver,1);
        for(const y of [-.47,0,.47]){
          part(cylinder,[x,y,.75],[.027,.009,.027],machined,1,rotX(Math.PI/2));
          box([x,y,.761],[.012,.003,.002],black);
        }
      }
      // Optical hardware is an illustrative payload, not a connected camera or added plant sensor.
      part(chamfered,[0,.015,.735],[.60,.59,.035],[.05,.065,.08]);
      part(annulus,[0,.015,.87],[.50,.50,.135],[.22,.245,.27],1);
      part(annulus,[0,.015,1.015],[.535,.535,.028],machined,1);
      part(annulus,[0,.015,1.049],[.487,.487,.012],[.10,.12,.14]);
      part(annulus,[0,.015,1.067],[.458,.458,.008],[.32,.35,.38],1);
      part(cylinder,[0,.015,1.04],[.323,.008,.323],[.008,.018,.032],4,rotX(Math.PI/2));
      // Recessed baffles and a secondary mirror behind thin support vanes give the aperture depth.
      part(annulus,[0,.015,1.077],[.399,.399,.012],black);
      part(cylinder,[0,.015,1.095],[.09,.028,.09],black,0,rotX(Math.PI/2));
      part(annulus,[0,.015,1.124],[.094,.094,.003],[.075,.085,.095]);
      for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        rod([Math.cos(angle)*.105,.015+Math.sin(angle)*.105,1.098],
          [Math.cos(angle)*.405,.015+Math.sin(angle)*.405,1.098],.004,[.15,.17,.19]);
      }
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        part(cylinder,[Math.cos(a)*.497,.015+Math.sin(a)*.497,1.049],[.018,.009,.018],silver,1,rotX(Math.PI/2));
      }
      // Side service panels leave the crumpled MLI visible between structural ribs.
      for(const side of [-1,1]){
        box([side*.75,.12,-.12],[.018,.50,.32],[.08,.095,.11]);
        for(const y of [-.45,.57])for(const z of [-.38,.14])
          rod([side*.764,y,z],[side*.784,y,z],.023,silver);
        for(const y of [-.72,.73])box([side*.746,y,-.05],[.013,.015,.52],silver,1);
        // Harness loops and hold-down fittings are fixed cosmetic parts.
        const cable=[[side*.77,-.55,.18],[side*.96,-.58,.18],[side*1.02,-.35,.12],[side*.92,-.17,.07]];
        for(let i=0;i<cable.length-1;i++)rod(cable[i],cable[i+1],.018,[.12,.11,.085]);
        box([side*.76,-.52,.18],[.035,.055,.06],gold,1);
      }
      box([-.48,-.66,.755],[.07,.032,.012],state.safe?[.76,.32,.08]:[.18,.42,.37],1);
      box([.48,-.66,.755],[.07,.032,.012],state.link?[.18,.42,.37]:[.76,.32,.08],1);
    }
    // Six framed rigid panels, with discrete cells and rear structural ribs.
    for(const side of [-1,1]){
      rod([side*.73,0,0],[side*1.3,0,0],.065,silver);
      part(cylinder,[side*.87,0,0],[.12,.17,.12],dark,1,rotX(Math.PI/2));
      for(let segment=0;segment<(exterior?2:3);segment++){
        const center=side*(1.5+segment*.75),front=.062;
        box([center,0,0],[.36,.7,.034],[.035,.06,.08],1);
        for(const y of [-.7,.7])box([center,y,front],[.365,.016,.016],silver,1);
        for(const x of [-.36,.36])box([center+x,0,front],[.016,.7,.016],silver,1);
        for(let x=0;x<4;x++)for(let y=0;y<7;y++){
          const px=center-.265+x*.176,py=-.594+y*.198;
          const variation=((x*3+y*2+segment)%5)*.013;
          const color=inspection.overlay==='thermal'?[.1,.17,.23]:state.solar?[.045+variation,.17+variation,.33+variation]:[.038,.085,.15];
          part(exterior?chamfered:cube,[px,py,.043],[.081,.091,.008],color,3);
        }
        for(const y of [-.51,.51])box([center,y,-.045],[.33,.016,.014],[.35,.4,.44],1);
        if(segment<(exterior?1:2))for(const y of [-.5,.5])box([center+side*.375,y,0],[.043,.05,.055],gold,1);
      }
      // Cosmetic instrument housings and nozzles do not imply propulsion telemetry.
      box([side*.48,-.93,-.12],[.14,.12,.14],silver,1);
      part(cylinder,[side*.48,-1.09,-.12],[.093,.06,.093],dark,1);
      part(cylinder,[side*.48,-1.16,-.12],[.13,.035,.13],silver,1);
      part(cylinder,[side*.48,-1.199,-.12],[.092,.006,.092],dark);
    }
    if(!exterior){
    // Parabolic high-gain dish, rolled rim, three supports and a link-state feed housing.
    rod([antenna[0],antenna[1]-.25,antenna[2]],[antenna[0],antenna[1]+.13,antenna[2]],.055,silver);
    const dishCenter=[antenna[0],antenna[1]+.15,antenna[2]+.12],dishScale=.43;
    part(dish,dishCenter,[dishScale,dishScale,dishScale],[.68,.73,.76],1);
    part(rim,dishCenter,[dishScale,dishScale,dishScale],silver,1);
    const feed=[dishCenter[0],dishCenter[1],dishCenter[2]+.43];
    for(let i=0;i<3;i++){
      const angle=i*Math.PI*2/3;
      rod([dishCenter[0]+Math.cos(angle)*.39,dishCenter[1]+Math.sin(angle)*.39,dishCenter[2]+.15],feed,.011,silver);
    }
    part(cylinder,feed,[.055,.075,.055],state.link?[.39,.69,.65]:[.9,.4,.12],1,rotX(Math.PI/2));
    }else{
      // Compact patch antenna and mechanical deck hardware keep the exterior payload silhouette clear.
      part(chamfered,[.32,.925,-.06],[.29,.045,.30],[.22,.25,.28],1);
      box([.32,.976,-.06],[.24,.008,.25],[.62,.60,.52]);
      for(const x of [.08,.56])for(const z of [-.29,.17])
        part(cylinder,[x,.986,z],[.018,.009,.018],silver,1);
    }
    // Fixed optical sensor and communication whip are model detail, not new telemetry channels.
    box([-.44,.95,-.27],[.15,.13,.14],silver,1);
    part(cylinder,[-.44,1.075,-.27],[.09,.025,.09],dark,1);
    part(cylinder,[-.44,1.105,-.27],[.062,.009,.062],[.07,.17,.26],1);
    box([.48,.93,-.34],[.12,.07,.14],gold,1);
    rod([.48,.99,-.34],[.48,1.48,-.34],.012,silver);
    rod([.44,1.48,-.34],[.52,1.48,-.34],.01,silver);
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
    for(const key of Object.keys(options))if(!['exploded','overlay','selected','exterior'].includes(key))throw new Error('Unknown inspection option');
    if('exploded'in options&&typeof options.exploded!=='boolean')throw new Error('Exploded inspection requires a boolean');
    if('exterior'in options&&typeof options.exterior!=='boolean')throw new Error('Exterior inspection requires a boolean');
    if('overlay'in options&&!['subsystems','thermal','power'].includes(options.overlay))throw new Error('Unknown inspection overlay');
    if('selected'in options&&options.selected!==null&&!['eps','thermal','fdir'].includes(options.selected))throw new Error('Unknown inspection subsystem');
    inspection={...inspection,...options};draw();
  }
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth+=(e.clientX-drag[0])*.01;elevation=clamp(elevation+(e.clientY-drag[1])*.01,-Math.PI/2,Math.PI/2);drag=[e.clientX,e.clientY];draw();});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY*.01);},{passive:false});
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
