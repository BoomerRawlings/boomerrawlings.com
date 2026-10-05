import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Run the actual global keyboard handler with a small DOM boundary fixture.
// No browser, screenshots or source-text assertion substitutes for behavior.
const source = (await transform(await readFile(new URL('../src/scripts/brain/app.ts', import.meta.url), 'utf8'), {loader:'ts', target:'es2022'})).code;
const registration = /document\.addEventListener\("keydown",\s*\(?event\)?\s*=>\s*\{/.exec(source);
assert.ok(registration, 'The global keyboard handler must be instrumentable');
const body = registration.index + registration[0].length - 1;
function endOfBody(text, start) {
  let depth=0,quote='',escaped=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"||c.charCodeAt(0)===96){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return i;
  }
  throw new Error('Unclosed keyboard handler');
}
const handlerBody=source.slice(body+1,endOfBody(source,body));
const makeHandler = new Function('fixture',
  'const expanded=false,mode=fixture.mode,answered=fixture.answered,choiceOrder=[2,0,1];' +
  'const $=id=>fixture.elements[id],answerQuestion=index=>fixture.answers.push(index);' +
  'const setMode=()=>{},filterTopics=()=>{};' +
  'return event=>{' + handlerBody + '};'
);

class Target {
  constructor(tag, parent=null, editable=false){this.tagName=tag.toUpperCase();this.parent=parent;this.editable=editable;}
  matches(selector){return selector.split(',').some(value=>{const key=value.trim();return key==='[contenteditable]'?this.editable:key.toUpperCase()===this.tagName;});}
  closest(selector){for(let node=this;node;node=node.parent)if(node.matches(selector))return node;return null;}
}
function run(target, overrides={}) {
  let advances=0,prevented=0;
  const fixture={
    mode:'recall',answered:true,answers:[],
    elements:{'question-practice':{hidden:false},'recall-quiz':{hidden:false},'recall-next':{click(){advances++;}}},
    ...overrides,
  };
  const event={key:'Enter',target,preventDefault(){prevented++;},...overrides.event};
  makeHandler(fixture)(event);
  return {advances,prevented,answers:fixture.answers};
}

test('Enter on explanation disclosure, including descendants, never advances the quiz', () => {
  const summary=new Target('summary'),child=new Target('strong',summary);
  for(const target of [summary,child]){
    assert.equal(run(target).advances,0,'Disclosure activation must not discard current feedback');
    assert.equal(run(target).prevented,0,'Native disclosure keyboard activation must remain available');
  }
});

test('Enter retains native behavior on answer-navigation and other interactive controls', () => {
  for(const tag of ['button','a','input','select','textarea']){
    const target=new Target(tag);
    assert.equal(run(target).advances,0,tag+' must not also trigger the global next shortcut');
    assert.equal(run(new Target('span',target)).advances,0,'Descendant of '+tag+' must retain its own action');
  }
  assert.equal(run(new Target('div',null,true)).advances,0,'Editable input must not advance');
});

test('Enter advances once from noninteractive quiz content only after an answer', () => {
  const heading=new Target('h3');
  assert.equal(run(heading).advances,1);
  assert.equal(run(heading,{answered:false}).advances,0);
  assert.equal(run(heading,{mode:'explore'}).advances,0);
  assert.equal(run(heading,{elements:{'question-practice':{hidden:true},'recall-quiz':{hidden:false}}}).advances,0);
  assert.equal(run(heading,{elements:{'question-practice':{hidden:false},'recall-quiz':{hidden:true}}}).advances,0);
});

test('Number shortcuts still select the original choice behind shuffled display order', () => {
  for(const [key,index] of [['1',2],['2',0],['3',1]]){
    assert.deepEqual(run(new Target('h3'),{answered:false,event:{key}}).answers,[index]);
    assert.deepEqual(run(new Target('h3'),{answered:true,event:{key}}).answers,[]);
  }
});
