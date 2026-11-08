'use strict';
// Fixed, illustrative small optical spacecraft exterior. No physical or sensor state is added.
// Build mesh buffers and mechanical draw commands once; replay only selects two status colors.
window.createDetailedSpacecraftModel = function({mesh,cube,chamfered,foil,cylinder,annulus}) {
  const normalize = p => {const length=Math.hypot(...p);return p.map(v=>v/length);};
  const rotX = a => [1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1];
  const rotY = a => [Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1];
  const rotZ = a => [Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1];
  const alongZ = rotX(Math.PI/2), alongX = rotZ(Math.PI/2);
  const black=[.016,.021,.028], graphite=[.14,.155,.17], rail=[.19,.215,.235];
  const aluminum=[.49,.52,.55], steel=[.34,.37,.40], gold=[.70,.45,.15];
  const blanket=[.67,.43,.14], ceramic=[.74,.76,.77], cable=[.105,.092,.063];
  const blueGlass=[.012,.031,.058];

  // Rounded machined stock: six 8x8 patches, with planar centers, radiused edges and spherical corners.
  // Project the boundary of a cube onto the Minkowski sum of a smaller cube and a sphere.
  const rounded = mesh((_triangle,quad) => {
    const steps=[-1,-.94,-.82,-.42,0,.42,.82,.94,1];
    const faces=[
      {axis:2,sign:1,u:0,v:1}, {axis:2,sign:-1,u:1,v:0},
      {axis:0,sign:1,u:1,v:2}, {axis:0,sign:-1,u:2,v:1},
      {axis:1,sign:1,u:2,v:0}, {axis:1,sign:-1,u:0,v:2}
    ];
    const point=(face,u,v)=>{
      const p=[0,0,0];p[face.axis]=face.sign;p[face.u]=u;p[face.v]=v;
      const core=p.map(x=>Math.max(-.82,Math.min(.82,x)));
      const n=normalize(p.map((x,i)=>x-core[i]));
      return {p:core.map((x,i)=>x+.18*n[i]),n};
    };
    for(const face of faces)for(let x=0;x<8;x++)for(let y=0;y<8;y++){
      const p=[point(face,steps[x],steps[y]),point(face,steps[x+1],steps[y]),
        point(face,steps[x+1],steps[y+1]),point(face,steps[x],steps[y+1])];
      quad(p.map(v=>v.p),p.map(v=>v.n));
    }
  });

  // Cut-corner photovoltaic wafers have real thin sidewalls; the local image supplies contact fingers.
  const clippedCell = mesh((triangle,quad)=>{
    const polygon=[[-.78,-1],[.78,-1],[1,-.78],[1,.78],[.78,1],[-.78,1],[-1,.78],[-1,-.78]];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      triangle([0,0,1],[...a,1],[...b,1],[0,0,1]);
      triangle([0,0,-1],[...b,-1],[...a,-1],[0,0,-1]);
      quad([[...a,-1],[...b,-1],[...b,1],[...a,1]]);
    }
  });

  // Open optical tube has a much thinner wall than the supplied general-purpose annulus.
  const opticalTube=mesh((_triangle,quad)=>{
    for(let i=0;i<72;i++){
      const a=i*Math.PI/36,b=(i+1)*Math.PI/36;
      const p=(r,t,z)=>[r*Math.cos(t),r*Math.sin(t),z];
      const na=[Math.cos(a),Math.sin(a),0],nb=[Math.cos(b),Math.sin(b),0];
      quad([p(1,a,-1),p(1,b,-1),p(1,b,1),p(1,a,1)],[na,nb,nb,na]);
      quad([p(.87,b,-1),p(.87,a,-1),p(.87,a,1),p(.87,b,1)],
        [nb.map(v=>-v),na.map(v=>-v),na.map(v=>-v),nb.map(v=>-v)]);
      quad([p(.87,a,1),p(1,a,1),p(1,b,1),p(.87,b,1)],[0,0,1]);
      quad([p(.87,b,-1),p(1,b,-1),p(1,a,-1),p(.87,a,-1)],[0,0,-1]);
    }
  });
  // Shallow convex lens behind the long black tube, not a printed concentric target on the front plate.
  const lens=mesh((triangle)=>{
    const p=(r,a)=>[r*Math.cos(a),r*Math.sin(a),.16*(1-r*r)];
    const n=p=>normalize([.32*p[0],.32*p[1],1]);
    for(let ring=0;ring<10;ring++)for(let segment=0;segment<64;segment++){
      const a=segment*Math.PI/32,b=(segment+1)*Math.PI/32;
      const p0=p(ring/10,a),p1=p((ring+1)/10,a),p2=p((ring+1)/10,b),p3=p(ring/10,b);
      triangle(p0,p1,p2,[n(p0),n(p1),n(p2)]);
      if(ring)triangle(p0,p2,p3,[n(p0),n(p2),n(p3)]);
    }
  });

  const commands=[];
  const part=(shape,pos,scale,color,surface=0,rotation)=>commands.push({kind:0,shape,pos,scale,color,surface,rotation});
  const box=(pos,scale,color,surface=0)=>part(cube,pos,scale,color,surface);
  const rod=(from,to,radius,color)=>commands.push({kind:1,from,to,radius,color});
  const path=(points,radius,color)=>{for(let i=1;i<points.length;i++)rod(points[i-1],points[i],radius,color);};
  const boltZ=(x,y,z,r=.019)=>{
    part(cylinder,[x,y,z],[r,.006,r],steel,1,alongZ);
    box([x,y,z+.007],[r*.48,.0025,.0018],black);
  };
  const boltX=(x,y,z)=>part(cylinder,[x,y,z],[.017,.006,.017],steel,1,alongX);

  // A tall 6U-like frame, dark anodized faceplates, and sewn blankets recessed between the rails.
  part(rounded,[0,0,-.01],[.666,.86,.48],graphite,1);
  part(foil,[0,0,-.025],[.702,.897,.526],blanket,2);
  part(rounded,[0,0,.542],[.728,.925,.030],rail,1);
  part(rounded,[0,0,.582],[.671,.866,.016],graphite);
  for(const side of [-1,1]){
    for(const z of [-.543,.546]){
      part(rounded,[side*.724,0,z],[.030,.97,.032],rail,1);
      // Flush upper/lower deck shoes and rail attachment points do not resemble thrusters.
      for(const y of [-.895,.895]){
        part(rounded,[side*.718,y,z],[.047,.046,.045],aluminum,1);
        if(z>0)boltZ(side*.718,y,z+.051,.018);
      }
    }
    for(const y of [-.935,.935])part(rounded,[side*.724,y,0],[.029,.026,.532],rail,1);
    // Slim side service access covers leave most of the MLI visible.
    part(rounded,[side*.727,-.20,-.035],[.014,.39,.26],graphite,1);
    part(rounded,[side*.744,-.20,-.035],[.005,.332,.212],[.105,.12,.132]);
    for(const y of [-.52,.12])for(const z of [-.24,.17])boltX(side*.755,y,z);
    for(const z of [-.40,.38])box([side*.716,.05,z],[.011,.78,.007],[.32,.24,.11],1);
    // Sewn blanket edge and narrow retaining tape, with restrained gold instead of a solid gold cube.
    box([side*.704,.78,-.04],[.014,.013,.43],gold,2);
    box([side*.704,-.77,-.04],[.014,.013,.43],gold,2);
    // Flight-harness bundle with a loop, clamps and a small locking connector.
    path([[side*.757,-.58,.20],[side*.83,-.64,.21],[side*.92,-.61,.19],
      [side*.96,-.51,.17],[side*.91,-.39,.12],[side*.79,-.33,.11]],.013,cable);
    part(rounded,[side*.768,-.34,.106],[.028,.047,.058],steel,1);
    part(rounded,[side*.775,-.59,.205],[.028,.039,.047],graphite,1);
    rod([side*.792,-.35,.055],[side*.792,-.35,.155],.006,gold);
    for(const y of [-.60,-.36])part(cylinder,[side*.78,y,.17],[.025,.012,.025],black,0,alongX);
  }
  for(const y of [-.933,.933]){
    part(rounded,[0,y,.548],[.706,.024,.026],rail,1);
    part(rounded,[0,y,-.548],[.706,.024,.026],rail,1);
  }
  // Segmented elongated front panels and real recessed joints.
  for(const x of [-.575,.575]){
    part(rounded,[x,0,.61],[.052,.77,.015],[.115,.13,.14],1);
    for(const y of [-.73,-.24,.25,.73])boltZ(x,y,.633,.017);
  }
  for(const y of [-.74,.74]){
    part(rounded,[0,y,.609],[.49,.061,.012],[.092,.106,.118],1);
    for(const x of [-.43,.43])boltZ(x,y,.628,.015);
  }
  box([0,-.568,.612],[.47,.009,.008],black);
  // Lower service manifold: keyed electrical sockets, retention bar, connector pins and safety wire.
  part(rounded,[.18,-.66,.638],[.19,.059,.031],steel,1);
  part(chamfered,[.18,-.66,.673],[.14,.036,.008],black);
  for(let i=0;i<7;i++)part(cylinder,[.074+i*.035,-.66,.687],[.005,.006,.005],gold,1,alongZ);
  for(const x of [-.002,.362])boltZ(x,-.66,.678,.011);
  path([[-.002,-.637,.685],[-.027,-.605,.69],[.014,-.589,.691],[.044,-.616,.686]],.0028,steel);
  part(rounded,[-.31,-.67,.637],[.092,.043,.024],rail,1);
  part(chamfered,[-.31,-.67,.665],[.063,.023,.006],black);
  for(const x of [-.335,-.310,-.285])boltZ(x,-.67,.676,.0055);
  // Two small deck alignment fiducials and a restrained engraved ID plaque.
  part(chamfered,[-.39,.70,.635],[.065,.025,.004],[.32,.34,.33],1);
  for(let i=0;i<5;i++)box([-.425+i*.014,.70,.641],[.003,.012,.0015],graphite);

  // Optical payload mount: offset on the face, with a long recessed entrance and separate glass.
  const ox=-.055,oy=.125;
  part(rounded,[ox,oy,.638],[.458,.493,.035],[.083,.098,.113],1);
  for(const x of [-.387,.387])for(const y of [-.42,.42])boltZ(ox+x,oy+y,.683,.020);
  part(opticalTube,[ox,oy,.843],[.387,.387,.180],[.12,.14,.155],1);
  part(opticalTube,[ox,oy,.853],[.343,.343,.193],black);
  part(lens,[ox,oy,.685],[.294,.294,.08],blueGlass,4);
  // Three thin knife-edge baffles are set back inside the barrel; the open throat casts real shade.
  for(const [z,radius] of [[.77,.337],[.86,.335],[.95,.333]])
    part(opticalTube,[ox,oy,z],[radius,radius,.006],[.021,.025,.031]);
  part(opticalTube,[ox,oy,1.045],[.412,.412,.024],rail,1);
  part(opticalTube,[ox,oy,1.075],[.394,.394,.007],black);
  // Eight small recessed barrel fasteners and longitudinal machining lands.
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    boltZ(ox+Math.cos(a)*.383,oy+Math.sin(a)*.383,1.074,.010);
  }
  for(const a of [Math.PI*.18,Math.PI*.82,Math.PI*1.5]){
    const x=ox+Math.cos(a)*.385,y=oy+Math.sin(a)*.385;
    part(rounded,[x,y,.844],[.014,.014,.146],rail,1,rotZ(a));
  }

  // Rear white radiator is a physical panel, cosmetic rather than a spatial thermal measurement.
  part(rounded,[0,.06,-.563],[.565,.714,.016],graphite,1);
  part(rounded,[0,.06,-.587],[.517,.657,.009],ceramic);
  for(let x=-2;x<=2;x++)box([x*.202,.06,-.600],[.002,.60,.0018],[.43,.46,.47],1);
  for(const x of [-.48,.48])for(const y of [-.54,.66]){
    part(cylinder,[x,y,-.607],[.016,.005,.016],steel,1,alongZ);
  }
  // Fixed thermal straps and the top patch antenna: mechanical details, no extra telemetry channels.
  for(const x of [-.48,-.31])part(rounded,[x,.955,-.14],[.044,.018,.25],gold,2);
  part(rounded,[.29,.986,-.11],[.265,.029,.242],rail,1);
  part(rounded,[.29,1.021,-.11],[.224,.007,.199],[.62,.62,.58]);
  for(const x of [.061,.519])for(const z of [-.315,.095])part(cylinder,[x,1.027,z],[.012,.007,.012],steel,1);
  part(rounded,[-.46,.994,.16],[.102,.033,.118],graphite,1);
  part(chamfered,[-.46,1.032,.16],[.075,.004,.090],[.43,.45,.45],1);
  part(rounded,[.50,1.005,-.36],[.065,.042,.063],steel,1);
  rod([.50,1.048,-.36],[.50,1.397,-.36],.006,steel);
  part(cylinder,[.50,1.411,-.36],[.011,.014,.011],black);
  // Detumble/launch fittings are flat deck mounting points, with no decorative propulsion nozzles.
  for(const x of [-.50,.50])part(rounded,[x,-.972,-.23],[.112,.025,.14],rail,1);

  // Four discrete rigid panels, two per wing; deliberately fixed deployed joints do not animate.
  for(const side of [-1,1]){
    // Bus hinge lies near the upper third. Two narrow yokes, axle bearings, hard stops and harness.
    for(const y of [-.04,.58]){
      part(rounded,[side*.779,y,-.005],[.058,.049,.082],rail,1);
      rod([side*.79,y,.0],[side*.965,y,.0],.025,aluminum);
      part(cylinder,[side*.962,y,.0],[.061,.073,.061],graphite,1);
      part(cylinder,[side*.962,y+.079,.0],[.035,.008,.035],steel,1);
      box([side*.925,y-.06,-.053],[.031,.018,.024],steel,1);
    }
    path([[side*.78,.44,-.10],[side*.88,.46,-.15],[side*.99,.43,-.17],
      [side*1.04,.34,-.12],[side*.98,.25,-.09]],.009,cable);
    for(let segment=0;segment<2;segment++){
      const center=side*(1.422+segment*.918),cy=.285;
      const rotation=rotY(side*(segment===0?-.075:.045));
      const cz=segment===0?-.020:.034;
      const point=(x,y,z)=>[center+rotation[0]*x+rotation[8]*z,cy+y,cz+rotation[2]*x+rotation[10]*z];
      const panel=(shape,p,scale,color,surface=0)=>part(shape,point(...p),scale,color,surface,rotation);
      panel(chamfered,[0,0,0],[.435,.742,.022],[.06,.074,.089],1);
      panel(chamfered,[0,0,-.026],[.409,.712,.004],graphite);
      // Thin dark anodized frame with corner reliefs, plus ribs visible from the back.
      for(const y of [-.732,.732])panel(rounded,[0,y,.017],[.421,.010,.018],rail,1);
      for(const x of [-.424,.424])panel(rounded,[x,0,.017],[.010,.727,.018],rail,1);
      for(const y of [-.49,.49])panel(rounded,[0,y,-.041],[.406,.014,.012],rail,1);
      for(const x of [-.22,.22])panel(rounded,[x,0,-.041],[.010,.692,.011],[.12,.14,.15],1);
      for(let col=0;col<4;col++)for(let row=0;row<7;row++){
        const variation=((col+row*3+segment*2)%5)*.0015;
        const solarColor=[.033+variation,.071+variation,.133+variation];
        panel(clippedCell,[-.309+col*.206,-.618+row*.206,.034],[.093,.093,.005],solarColor,3);
      }
      // Root/outer panel hinges have genuine barrels and pin ends, separated from the cell field.
      if(segment===0)for(const y of [-.48,.48]){
        const joint=point(side*.456,y,-.004);
        part(cylinder,joint,[.040,.061,.040],rail,1);
        part(cylinder,[joint[0],joint[1]+.068,joint[2]],[.023,.006,.023],steel,1);
        panel(rounded,[side*.439,y,-.047],[.048,.041,.009],steel,1);
        panel(rounded,[side*.439,y+.082,-.031],[.030,.015,.020],graphite,1);
      }
      for(const x of [-.398,.398])for(const y of [-.694,.694]){
        const p=point(x,y,.040);
        part(cylinder,p,[.009,.004,.009],steel,1,alongZ);
      }
      // Small cable bridge and a protected connector on the rear of each panel.
      panel(rounded,[side*-.35,-.58,-.050],[.030,.041,.013],black);
      const cablePoints=[point(side*-.405,-.52,-.057),point(side*-.45,-.48,-.083),
        point(side*-.46,-.39,-.087),point(side*-.40,-.34,-.058)];
      path(cablePoints,.0065,cable);
    }
  }

  const safeMarker={shape:rounded,pos:[-.48,-.824,.635],scale:[.028,.011,.005]};
  const linkMarker={shape:rounded,pos:[.48,-.824,.635],scale:[.028,.011,.005]};
  const nominal=[.12,.33,.25],attention=[.58,.26,.075];
  return function draw({part,box,rod},state) {
    for(const command of commands){
      if(command.kind===1)rod(command.from,command.to,command.radius,command.color);
      else part(command.shape,command.pos,command.scale,command.color,command.surface,command.rotation);
    }
    part(safeMarker.shape,safeMarker.pos,safeMarker.scale,state.safe?attention:nominal,0);
    part(linkMarker.shape,linkMarker.pos,linkMarker.scale,state.link?nominal:attention,0);
  };
};
