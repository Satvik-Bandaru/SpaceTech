'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '../spacecraft_lab/web/scene-model.js');
assert.ok(fs.existsSync(sourcePath), 'the detailed spacecraft model factory is available');
const context = vm.createContext({window: {}});
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, {filename: sourcePath});
assert.equal(typeof context.window.createDetailedSpacecraftModel, 'function');

// Exercise authored geometry with the same triangle/quad protocol as the renderer.
const cached = [];
const normalize = v => {const length = Math.hypot(...v); return v.map(x => x / length);};
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mesh = build => {
  const vertices = [], normals = [];
  const triangle = (a,b,c,normal) => {
    const area = cross(b.map((x,i) => x-a[i]), c.map((x,i) => x-a[i]));
    assert.ok(Math.hypot(...area) > 1e-10, 'no degenerate authored triangles');
    const smooth = normal && Array.isArray(normal[0]);
    const flat = normal || normalize(area);
    [a,b,c].forEach((point,i) => {vertices.push(...point); normals.push(...(smooth ? normal[i] : flat));});
  };
  const quad = (points,n) => {
    const smooth = n && Array.isArray(n[0]);
    triangle(points[0],points[1],points[2],smooth ? [n[0],n[1],n[2]] : n);
    triangle(points[0],points[2],points[3],smooth ? [n[0],n[2],n[3]] : n);
  };
  build(triangle,quad);
  assert.ok(vertices.length > 0);
  for (const x of [...vertices,...normals]) assert.ok(Number.isFinite(x));
  assert.ok(vertices.every(v => Math.abs(v) <= 1+1e-8),'authored shapes retain unit bounds');
  for (let i=0;i<normals.length;i+=3) assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1) < 1e-6, 'unit normals');
  const result = {name: `authored-${cached.length}`, vertices, normals};
  cached.push(result);
  return result;
};
const shapes = Object.fromEntries(['cube','chamfered','foil','cylinder','annulus'].map(name => [name,{name}]));
const inputs = Object.freeze({mesh,...shapes});
const draw = context.window.createDetailedSpacecraftModel(inputs);
assert.equal(typeof draw,'function');
assert.ok(cached.length >= 2, 'rounded structural shell and clipped cell geometry are authored once');
const allocationCount = cached.length;

function capture(state) {
  const commands = [];
  const part = (shape,pos,scale,color,surface=0,rotation) => {
    commands.push({kind:'part',shape:shape.name,pos:Array.from(pos),scale:Array.from(scale),color:Array.from(color),surface,
      rotation:rotation ? Array.from(rotation) : null});
  };
  const api = Object.freeze({
    part,
    box(pos,scale,color,surface=0) {part(shapes.cube,pos,scale,color,surface);},
    rod(from,to,radius,color) {commands.push({kind:'rod',from:Array.from(from),to:Array.from(to),radius,color:Array.from(color),surface:1});}
  });
  draw(api,state);
  return commands;
}
const state = Object.freeze({safe:false,link:true,solar:18,eclipse:false,yaw:.2,battery:42});
const before = JSON.stringify(state);
const first = capture(state);
assert.deepEqual(capture(state),first,'same replay state gives the same geometry');
assert.equal(JSON.stringify(state),before,'recorded telemetry stays immutable');
assert.equal(cached.length,allocationCount,'draw allocates no GL meshes');
assert.equal(first.filter(c => c.surface === 3).length,112,'four deployed panels carry 28 discrete clipped cells each');
assert.deepEqual([...new Set(first.map(c => c.surface))].sort(),[0,1,2,3,4],'paint, metal, MLI, cells and optical glass remain distinct');

// Solar output and eclipse affect illumination in the renderer, never photovoltaic paint.
assert.deepEqual(capture(Object.freeze({...state,solar:0,eclipse:true,yaw:-.7})),first);
const status = capture(Object.freeze({...state,safe:true,link:false}));
const changed = status.map((c,i) => JSON.stringify(c) !== JSON.stringify(first[i]) ? i : -1).filter(i => i >= 0);
assert.equal(changed.length,2,'only the two small status markers respond to safe/link');
const safeOnly = capture(Object.freeze({...state,safe:true}));
const linkOnly = capture(Object.freeze({...state,link:false}));
const safeIndices = safeOnly.map((c,i) => JSON.stringify(c) !== JSON.stringify(first[i]) ? i : -1).filter(i => i >= 0);
const linkIndices = linkOnly.map((c,i) => JSON.stringify(c) !== JSON.stringify(first[i]) ? i : -1).filter(i => i >= 0);
assert.equal(safeIndices.length,1,'safe mode controls one marker');
assert.equal(linkIndices.length,1,'link controls one separate marker');
assert.notEqual(safeIndices[0],linkIndices[0],'safe and link indications stay independent');
for (const index of changed) {
  const {color,...a} = first[index], {color:other,...b} = status[index];
  assert.deepEqual(a,b,'status changes only color');
  assert.ok(first[index].scale.every(v => v <= .06),'status indicators stay small');
}

const extent = {min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
function bound(p) {
  p.forEach((v,i) => {assert.ok(Number.isFinite(v)); extent.min[i] = Math.min(extent.min[i],v); extent.max[i] = Math.max(extent.max[i],v);});
}
for (const command of first) {
  for (const value of command.color) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  if (command.kind === 'rod') {
    assert.ok(command.radius > 0 && Number.isFinite(command.radius));
    assert.ok(Math.hypot(...command.from.map((v,i) => command.to[i]-v)) > .0001);
    for (const p of [command.from,command.to]) for (const sign of [-1,1]) bound(p.map(v => v+sign*command.radius));
    continue;
  }
  assert.ok(command.scale.every(v => Number.isFinite(v) && v > 0),'nonzero finite scales');
  if (command.rotation) {
    assert.equal(command.rotation.length,16);
    assert.ok(command.rotation.every(Number.isFinite));
    for (let col=0;col<3;col++) assert.ok(Math.abs(Math.hypot(...command.rotation.slice(col*4,col*4+3))-1)<1e-6);
    for (const [a,b] of [[0,1],[0,2],[1,2]])
      assert.ok(Math.abs([0,1,2].reduce((sum,i) => sum+command.rotation[a*4+i]*command.rotation[b*4+i],0))<1e-6,'orthogonal rotation columns');
  }
  const authored = cached.find(s => s.name === command.shape);
  const points = authored ? Array.from({length:authored.vertices.length/3},(_,i) => authored.vertices.slice(i*3,i*3+3)) :
    [-1,1].flatMap(x => [-1,1].flatMap(y => [-1,1].map(z => [x,y,z])));
  for (const p of points) {
    const scaled = p.map((v,i) => v*command.scale[i]), m = command.rotation;
    bound(command.pos.map((v,i) => v+(m ? m[i]*scaled[0]+m[4+i]*scaled[1]+m[8+i]*scaled[2] : scaled[i])));
  }
}
assert.ok(extent.min[0]>=-3.05 && extent.max[0]<=3.05,'array span stays in camera framing');
assert.ok(extent.min[1]>=-1.3 && extent.max[1]<=1.5,'bus and antennas stay in vertical framing');
assert.ok(extent.min[2]>=-.8 && extent.max[2]<=1.22,'baffled optics stay in depth framing');
assert.ok(extent.max[0]>2.7 && extent.min[0]<-2.7,'both articulated wings deploy');
assert.ok(first.filter(c => c.surface === 3).every(c => c.shape.startsWith('authored-')),'cells have clipped physical geometry');
console.log(`Detailed spacecraft geometry: ${first.length} commands, ${allocationCount} cached meshes, 112 cells; all checks pass.`);
