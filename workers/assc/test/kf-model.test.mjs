import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKFModel,summarizeKF} from '../client/kf-model.js';
const user=id=>({account_key:id,observed_usernames:[id],joined_date:null});
const post=(id,account,month,text='hello',quotes=[])=>({post_key:`t:${id}`,post_id:id,thread_key:'t',account_key:account,timestamp:`${month}-05T12:00:00Z`,text,quotes,source_url:'https://example.test/thread',source_file:'fixture',capture_id:'a'.repeat(64),locator:'test',post_number:Number(id),page:1});
const quote=(id,parent=null)=>({post_id:id,parent_quote_index:parent});
test('characters use own-text Unicode code points and repeated quotes do not duplicate replies',()=>{
  const data=buildKFModel([post('1','A','2020-01','😀'),post('2','B','2020-02','x',[quote('1'),quote('1')])],[user('A'),user('B')],{});
  const r=summarizeKF(data);assert.equal(r.totals.characters,2);assert.equal(r.totals.repliesMade,1);assert.equal(r.totals.repliesReceived,1);assert.equal(data.diagnostics.duplicateDirectTargets,1);
});
test('multi-recipient reply counts once made, once received per recipient account',()=>{
  const data=buildKFModel([post('1','A','2020-01'),post('2','B','2020-01'),post('3','C','2020-02','x',[quote('1'),quote('2')])],['A','B','C'].map(user),{}),r=summarizeKF(data);
  assert.equal(r.totals.repliesMade,1);assert.equal(r.totals.repliesReceived,2);assert.equal(r.pairs.length,2);
});
test('nested quotes, self quotes, missing targets and unknown accounts remain excluded',()=>{
  const data=buildKFModel([post('1','A','2020-01'),post('2','A','2020-02','x',[quote('1'),quote('missing'),quote('1',0)]),post('3',null,'2020-02','x',[quote('1')])],[user('A')],{}),r=summarizeKF(data);
  assert.equal(r.totals.repliesMade,0);assert.equal(r.totals.repliesReceived,0);assert.equal(r.totals.unattributedPosts,1);assert.equal(data.diagnostics.selfQuotes,1);assert.equal(data.diagnostics.unresolvedTargets,1);assert.equal(data.diagnostics.nestedQuotes,1);assert.equal(data.diagnostics.unattributedQuoteEndpoints,1);
});
test('date-window incoming replies can target an earlier post without counting its old output',()=>{
  const data=buildKFModel([post('1','A','2020-01'),post('2','B','2020-03','x',[quote('1')])],[user('A'),user('B')],{}),r=summarizeKF(data,{from:'2020-03-01'});
  assert.equal(r.totals.posts,1);assert.equal(r.allRows.find(x=>x.id==='A').posts,0);assert.equal(r.allRows.find(x=>x.id==='A').repliesReceived,1);
  assert.equal(summarizeKF(data).months.length,3);assert.equal(summarizeKF(data).months[1].posts,0);
});
test('rank ties use competition ranks and filtering does not renumber global ranks',()=>{
  const data=buildKFModel([post('1','A','2020-01'),post('2','B','2020-01'),post('3','C','2020-01'),post('4','C','2020-02')],['A','B','C'].map(user),{});
  assert.deepEqual(summarizeKF(data).rows.map(u=>[u.id,u.rank]),[['C',1],['A',2],['B',2]]);assert.equal(summarizeKF(data,{q:'B'}).rows[0].rank,2);
});
test('excluding an exact account removes its output and incident edges but keeps literal mentions',()=>{
  const data=buildKFModel([post('1','A','2020-01'),post('2','B','2020-01','Fictional Person is mentioned',[quote('1')]),post('3','C','2020-02','more',[quote('1'),quote('2')])],['A','B','C'].map(user),{});
  const r=summarizeKF(data,{excludedAccountIds:['A']});assert.equal(r.totals.posts,2);assert.equal(r.totals.repliesMade,1);assert.equal(r.totals.repliesReceived,1);assert.equal(r.allRows.some(u=>u.id==='A'),false);assert.equal(r.pairs.length,1);assert.equal(r.pairs[0].to,'B');assert.equal(r.totals.characters,'Fictional Person is mentionedmore'.length);
});
