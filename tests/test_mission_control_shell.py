"""Exercise presentation assembly with connected-tree DOM semantics, without a browser dependency."""
import json
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import unittest

from spacecraft_lab.reliability import run_strategy


class PageTree(HTMLParser):
    """Read the actual page; detached descendants must disappear from document ID lookup."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__()
        self.root = {'tag': 'document', 'attrs': {}, 'children': []}
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]['tag'] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1]['children'].append({'text': data})


SHELL_CHECK = r"""
const assert = require('node:assert/strict'), vm = require('node:vm');
const fixture = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
class Node {
  constructor(tag, text='') {
    this.tagName=tag; this.parentNode=null; this.children=[]; this.attrs={};
    this._text=text; this.dataset={}; this.listeners={}; this.namespaceURI='http://www.w3.org/1999/xhtml';
    this.style={setProperty(name,value){this[name]=value;}};
    this.classList={
      contains:name=>this.className.split(/\s+/).includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
      remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},
      toggle:(name,force)=>{const enabled=force===undefined?!this.classList.contains(name):force; enabled?this.classList.add(name):this.classList.remove(name);return enabled;}
    };
  }
  get className(){return this.attrs.class||'';}
  set className(v){this.attrs.class=v;}
  get id(){return this.attrs.id||'';}
  set id(v){this.attrs.id=v;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(v){this.replaceChildren();this._text=String(v);}
  get firstElementChild(){return this.children.find(n=>n.tagName!=='#text')||null;}
  get lastChild(){return this.children.at(-1)||null;}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  append(...nodes){for(let n of nodes){if(typeof n==='string')n=new Node('#text',n);n.remove();n.parentNode=this;this.children.push(n);}}
  prepend(...nodes){for(let n of nodes.reverse()){if(typeof n==='string')n=new Node('#text',n);n.remove();n.parentNode=this;this.children.unshift(n);}}
  replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  setAttribute(name,value){this.attrs[name]=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5)]=String(value);if(name==='hidden')this.hidden=true;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  click(){for(const fn of this.listeners.click||[])fn();}
  focus(){} scrollIntoView(){}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){const result=[];function visit(n){for(const child of n.children){if(matches(child,selector))result.push(child);visit(child);}}visit(this);return result;}
}
function matches(node,selector){
  if(node.tagName==='#text')return false;
  let match=true;
  selector=selector.replace(/:not\(([^)]+)\)/g,(_,excluded)=>{if(matches(node,excluded))match=false;return '';});
  selector=selector.replace(/\[([^=\]]+)(?:="([^"]*)")?\]/g,(_,name,value)=>{if(!(name in node.attrs)||(value!==undefined&&node.attrs[name]!==value))match=false;return '';});
  selector=selector.replace(/#([\w-]+)/g,(_,id)=>{if(node.id!==id)match=false;return '';});
  selector=selector.replace(/\.([\w-]+)/g,(_,name)=>{if(!node.classList.contains(name))match=false;return '';});
  return match&&(!selector||node.tagName===selector);
}
function build(spec){const n=new Node(spec.tag||'#text',spec.text||'');for(const [k,v]of Object.entries(spec.attrs||{}))n.setAttribute(k,v??'');for(const child of spec.children||[])n.append(build(child));return n;}
const document=build(fixture.tree);
document.getElementById=id=>document.querySelector('#'+id);
document.createElement=tag=>new Node(tag);
document.createElementNS=(ns,tag)=>{const n=new Node(tag);n.namespaceURI=ns;return n;};
const originals=new Map(document.querySelectorAll('[id]').map(n=>[n.id,n]));
const get=id=>{const n=document.getElementById(id);assert.ok(n,`Missing connected control ${id}`);return n;};
let runs=0,exports=0,threeD=0,twoD=0;
get('run').addEventListener('click',()=>runs++);
get('export').addEventListener('click',()=>exports++);
get('view-3d').addEventListener('click',()=>{threeD++;get('scene-3d').hidden=false;});
get('view-2d').addEventListener('click',()=>{twoD++;get('scene-3d').hidden=true;});
const context={document,console,Number,Math,window:null,scrollTo(){}};
context.window=context;vm.createContext(context);
vm.runInContext(fixture.mission_data,context);
vm.runInContext(fixture.shell,context);
assert.equal(typeof context.MissionControl?.update,'function','Shell initialization must finish');
for(const [id,original]of originals)assert.equal(get(id),original,`Control ${id} was replaced or lost during reparenting`);
const ids=document.querySelectorAll('[id]').map(n=>n.id);
assert.equal(new Set(ids).size,ids.length,'Presentation must not duplicate IDs');
get('run').click();get('export').click();assert.equal(runs,1);assert.equal(exports,1);
context.MissionControl.update(fixture.report,0,{label:'Basic',playing:false});
assert.equal(threeD,1,'Initial recorded report enables the existing 3D control exactly once');
assert.equal(get('mc-mini-battery-value').textContent,fixture.report.telemetry[0].battery_pct.toFixed(1)+'%');
assert.equal(document.querySelector('.mc-view-tabs').firstElementChild.classList.contains('active'),true);
get('view-2d').click();assert.equal(twoD,1);
assert.equal(document.querySelector('.mc-view-tabs').firstElementChild.classList.contains('active'),false);
const partial=structuredClone(fixture.report);
for(const key of ['sunlit','comms_up','redundant_adcs'])delete partial.telemetry[0][key];
context.MissionControl.update(partial,0,{label:'Partial recorded state'});
for(const id of ['mc-env-light','mc-link-value','mc-actuator-value'])assert.equal(get(id).textContent,'Unknown');
assert.equal(threeD,1,'Seeking or changing reports must preserve the user-selected 2D view');
console.log('Mission shell preserves connected controls, handlers, unknown values and user-selected scene state');
"""


class MissionControlShellTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node needed for the dependency-free presentation assembly check')
    def test_reparenting_preserves_controls_and_original_handlers(self):
        root = Path(__file__).resolve().parents[1]
        web = root / 'spacecraft_lab/web'
        fixture = {
            'tree': PageTree((web / 'index.html').read_text()).root,
            'mission_data': (web / 'mission-data.js').read_text(),
            'shell': (web / 'mission-control.js').read_text(),
            'report': run_strategy({'duration_seconds': 120, 'seed': 7}, 'basic'),
        }
        result = subprocess.run(['node', '-e', SHELL_CHECK], input=json.dumps(fixture),
                                capture_output=True, text=True, cwd=root)
        self.assertEqual(result.returncode, 0, result.stderr)
