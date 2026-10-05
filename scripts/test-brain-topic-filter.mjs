import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { topics, categories } from '../public/brain/curriculum.js';

// A CLI source path permits red verification against a captured previous app.
// The normal run always exercises the current production filter implementation.
const sourcePath=process.argv[2]||new URL('../src/scripts/brain/app.ts',import.meta.url);
const source=(await transform(await readFile(sourcePath,'utf8'),{loader:'ts',target:'es2022'})).code;
const start=source.indexOf('function filterTopics(');
assert.ok(start>=0,'The actual topic filter must be instrumentable');
const body=source.indexOf('{',start);
function endOfBody(text,start){
  let depth=0,quote='',escaped=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"||c.charCodeAt(0)===96){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return i;
  }
  throw new Error('Unclosed topic filter');
}
const actualFilter=source.slice(start,endOfBody(source,body)+1);
const filter=new Function('fixture','topics','categories',
  'const {document,courseScope,progress,selected,savedOnly}=fixture;' +
  'const $=id=>document.querySelector("#"+id),all=selector=>document.querySelectorAll(selector);' +
  'const inCourse=id=>courseScope.topicIds===null||courseScope.topicIds.includes(id);' +
  'const courseTopics=()=>topics.filter(topic=>inCourse(topic.id));' +
  actualFilter+';filterTopics();'
);

// Minimal DOM boundary with descendant/type/ID/class/attribute selectors.
// Selector behavior is independent of the production selector string: the old
// broad data-topic selector also runs, exposing canvas hiding and overcounting.
class Node {
  constructor(tag,attributes={}){
    this.tagName=tag.toLowerCase();this.attributes={...attributes};this.dataset={};
    for(const [key,value] of Object.entries(attributes))if(key.startsWith('data-'))this.dataset[key.slice(5)]=value;
    this.children=[];this.parent=null;this.hidden=false;this.open=false;this.disabled=false;this.value='';this.textContent='';
  }
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  getAttribute(name){if(name==='hidden')return this.hidden?'':null;if(name.startsWith('data-'))return this.dataset[name.slice(5)]??null;return this.attributes[name]??null;}
  querySelectorAll(selector){return this.descendants().filter(node=>matches(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  descendants(){return this.children.flatMap(child=>[child,...child.descendants()]);}
}
function compound(node,selector){
  if(selector.includes(':not([hidden])')){if(node.hidden)return false;selector=selector.replace(':not([hidden])','');}
  const tokens=selector.match(/^[a-z]+|#[\w-]+|\.[\w-]+|\[[\w-]+\]/g)||[];
  assert.equal(tokens.join(''),selector,'Unsupported fixture selector '+selector);
  return tokens.every(token=>{
    if(token[0]==='#')return node.getAttribute('id')===token.slice(1);
    if(token[0]==='.')return (node.getAttribute('class')||'').split(/\s+/).includes(token.slice(1));
    if(token[0]==='[')return node.getAttribute(token.slice(1,-1))!==null;
    return node.tagName===token;
  });
}
function matches(node,selector){
  const parts=selector.trim().split(/\s+/);
  if(!compound(node,parts.pop()))return false;
  let ancestor=node.parent;
  while(parts.length){const part=parts.pop();while(ancestor&&!compound(ancestor,part))ancestor=ancestor.parent;if(!ancestor)return false;ancestor=ancestor.parent;}
  return true;
}
function fixture(){
  const document=new Node('document');
  document.createElement=tag=>new Node(tag);
  const add=(tag,id,parent=document,attrs={})=>{const node=new Node(tag,{...(id?{id}:{}),...attrs});parent.append(node);return node;};
  for(const [tag,id] of [['input','topic-search'],['p','empty-library'],['span','library-count'],['button','next-topic'],['select','mobile-topic']])add(tag,id);
  add('nav',null,document,{class:'scale-journey'});
  const library=add('nav','topic-library'),buttons=[];
  for(const category of categories){
    const group=add('details',null,library,{class:'topic-group'});
    add('span',null,group,{class:'category-count'});
    for(const topic of topics.filter(topic=>topic.category===category.id))buttons.push(add('button',null,group,{'data-topic':topic.id}));
    add('button',null,document,{'data-scale':category.id});
  }
  const viewer=add('div','brain-viewer',document,{'data-topic':'brain-overview'});
  const canvas=add('canvas',null,viewer,{'data-topic':'brain-overview'});
  const stage=add('div','card-stage',document,{'data-topic':'dopamine'});
  const elementKey=add('div','element-key',stage,{'data-topic':'dopamine'});
  const unrelatedButton=add('button','unrelated-topic-action',document,{'data-topic':'hippocampus'});
  const libraryMetadata=add('span','library-metadata',library.children[0],{'data-topic':'brain-overview'});
  const sentinels=[viewer,canvas,stage,elementKey,unrelatedButton,libraryMetadata];
  stage.hidden=true; // Filtering must not reveal a deliberately hidden card stage.
  const originalVisibility=sentinels.map(node=>node.hidden);
  return {document,buttons,sentinels,originalVisibility,courseScope:{courseId:'all',topicIds:null,label:'All topics'},progress:{saved:[]},selected:topics[0],savedOnly:false};
}
function apply(f){filter(f,topics,categories);}
function assertUntouched(f){assert.deepEqual(f.sentinels.map(node=>node.hidden),f.originalVisibility,'Topic filtering must not hide/reveal model, card, or unrelated data-topic elements');}
function visibleIds(f){return f.buttons.filter(node=>!node.hidden).map(node=>node.dataset.topic);}
function mobileIds(f){return f.document.querySelector('#mobile-topic').descendants().filter(node=>node.tagName==='option'&&node.value).map(node=>node.value);}

test('Unfiltered count includes exactly the 50 library topic buttons',()=>{
  const f=fixture();apply(f);
  assert.equal(f.document.querySelector('#library-count').textContent,'50 topics');
  assert.deepEqual(visibleIds(f),topics.map(topic=>topic.id));
  assert.deepEqual(mobileIds(f),topics.map(topic=>topic.id));
  assertUntouched(f);
  const groups=f.document.querySelectorAll('.topic-group');
  for(const [i,group] of groups.entries())assert.equal(group.querySelector('.category-count').textContent,String(topics.filter(topic=>topic.category===categories[i].id).length));
});

test('Chapter switch excludes the current model topic without hiding the model',()=>{
  const f=fixture();apply(f);
  f.courseScope={courseId:'psyc108',topicIds:['hippocampus','dopamine'],label:'Selected chapter'};
  apply(f);
  assert.deepEqual(new Set(visibleIds(f)),new Set(['hippocampus','dopamine']));
  assert.equal(f.document.querySelector('#library-count').textContent,'2 topics · Selected chapter');
  assert.deepEqual(new Set(mobileIds(f)),new Set(['hippocampus','dopamine']));
  assert.equal(f.document.querySelector('#mobile-topic').value,'','Out-of-scope selected topic must not masquerade as a listed option');
  assert.equal(f.document.querySelector('#next-topic').disabled,false);
  assertUntouched(f);
});

test('Search and saved filters change only the library, then clearing restores its scope',()=>{
  const f=fixture();f.courseScope={courseId:'psyc108',topicIds:['hippocampus','dopamine'],label:'Selected chapter'};
  f.document.querySelector('#topic-search').value='dopamine';apply(f);
  assert.deepEqual(visibleIds(f),['dopamine']);assertUntouched(f);
  f.document.querySelector('#topic-search').value='';f.savedOnly=true;f.progress.saved=['hippocampus'];apply(f);
  assert.deepEqual(visibleIds(f),['hippocampus']);assertUntouched(f);
  f.savedOnly=false;f.courseScope={courseId:'all',topicIds:null,label:'All topics'};apply(f);
  assert.equal(visibleIds(f).length,50);assertUntouched(f);
});

test('Notes-only scope and empty search do not hide or reveal unrelated topic surfaces',()=>{
  const f=fixture();f.courseScope={courseId:'psyc108',topicIds:[],label:'Notes chapter'};apply(f);
  assert.deepEqual(visibleIds(f),[]);assert.deepEqual(mobileIds(f),[]);
  assert.equal(f.document.querySelector('#next-topic').disabled,true);
  assert.equal(f.document.querySelector('#empty-library').hidden,false);
  assert.equal(f.document.querySelector('.scale-journey').hidden,true);assertUntouched(f);
  f.courseScope={courseId:'all',topicIds:null,label:'All topics'};f.document.querySelector('#topic-search').value='unmatched-phrase-731';apply(f);
  assert.deepEqual(visibleIds(f),[]);assertUntouched(f);
  f.document.querySelector('#topic-search').value='';apply(f);
  assert.equal(visibleIds(f).length,50);assert.equal(f.document.querySelector('.scale-journey').hidden,false);assertUntouched(f);
});
