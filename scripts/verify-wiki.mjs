import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { snapshot, linksIn, stamp } from '../public/wiki-assets/shared.js';

const source = JSON.parse(readFileSync('public/wiki-assets/data.json', 'utf8'));
const built = JSON.parse(readFileSync('dist/wiki-assets/data.json', 'utf8'));
assert.deepEqual(built, source, 'Published data must match the verified export');
assert.equal(source.schemaVersion, 1);
assert.deepEqual(Object.keys(source).sort(), ['schemaVersion','meta','editors','principles','events','cycles','relationships','journals'].sort(), 'Only approved public collections may ship');
assert.equal(source.meta.foundingAt, '2026-09-23T23:00:00.000Z');
assert.ok(source.cycles.length >= 76, 'The requested historical opening must be complete before publication');
assert.equal(source.meta.cycleCount, source.cycles.length);
assert.ok(stamp(source.meta.latestCompletedAt) >= stamp('2026-11-04T08:00:00Z'));
const eventKeys = new Set(['id','cycleId','timestamp','editorId','action','articleId','title','summary','revisionId','baseRevisionId','body','categories','principleIds','references']);
const editorKeys = new Set(['id','name','joinedAt','interests','description']);
const journalKeys = new Set(['id','editorId','eventId','timestamp','releasedAt','body','outcome','action','response']);
const relationKeys = new Set(['timestamp','from','to','trust','grievance','evidenceIds']);
for (const [records, keys] of [[source.events,eventKeys],[source.editors,editorKeys],[source.journals,journalKeys],[source.relationships,relationKeys]]) {
  for (const row of records) assert.ok(Object.keys(row).every(key => keys.has(key)), 'Public records must not expose working memory or private metadata');
}
const users = new Map(source.editors.map(user => [user.id, user]));
const policyIds = new Set();
for (const session of source.meta.policySessions ?? []) {
  const proposal = source.events.find(event => event.id === session.id && event.action === 'policy');
  assert.ok(proposal && !policyIds.has(session.id));
  policyIds.add(session.id);
  assert.ok(stamp(proposal.timestamp) <= stamp(session.openedAt) && stamp(session.openedAt) <= stamp(source.meta.latestCompletedAt));
  assert.ok(session.eligible.length && new Set(session.eligible).size === session.eligible.length);
  assert.ok(session.eligible.every(id => users.has(id) && stamp(users.get(id).joinedAt) <= stamp(session.openedAt)));
  for (const [entries,start,end] of [
    [session.discussion,session.openedAt,session.votingAt ?? source.meta.latestCompletedAt],
    [session.ballots,session.votingAt,session.closedAt],
  ]) {
    assert.equal(new Set(entries.map(entry => entry.editorId)).size, entries.length);
    assert.ok(entries.every(entry => session.eligible.includes(entry.editorId) && stamp(entry.timestamp) >= stamp(start) && stamp(entry.timestamp) <= stamp(end)));
  }
  if (session.votingAt) assert.equal(session.discussion.length,session.eligible.length);
  if (session.closedAt) {
    assert.ok(stamp(session.closedAt) <= stamp(source.meta.latestCompletedAt));
    assert.equal(session.ballots.length,session.eligible.length);
    assert.ok(session.ballots.every(entry => ['support','oppose','abstain'].includes(entry.vote)));
    assert.equal(session.result,session.ballots.filter(entry => entry.vote === 'support').length > session.eligible.length / 2 ? 'adopted' : 'rejected');
  } else assert.equal(session.ballots.length,0,'Ballots remain private until the vote closes');
}
assert.ok(users.has('bluemonday') && users.has('ellis47'));
assert.ok(users.get('ellis47').joinedAt.startsWith('2026-10-02') || users.get('ellis47').joinedAt.startsWith('2026-10-03'));
const eventIds = new Set(), perTurn = new Set(), revisions = new Map(), cycles = new Map(source.cycles.map(c => [c.id,c]));
let priorTimestamp = 0;
for (const event of source.events) {
  assert.ok(!eventIds.has(event.id), `Duplicate public event ${event.id}`);
  assert.ok(stamp(event.timestamp) >= priorTimestamp, 'Events must retain chronological ordering');
  assert.ok(stamp(event.timestamp) <= stamp(source.meta.latestCompletedAt), 'No future events');
  assert.ok(users.has(event.editorId), `Unknown editor ${event.editorId}`);
  assert.ok(stamp(event.timestamp) >= stamp(users.get(event.editorId).joinedAt), 'No action before joining');
  for (const id of event.references || []) assert.ok(eventIds.has(id), 'No reference to future or private evidence');
  if (cycles.has(event.cycleId) && event.action !== 'join') {
    const cycle = cycles.get(event.cycleId);
    assert.ok(stamp(event.timestamp) >= stamp(cycle.startAt) && stamp(event.timestamp) < stamp(cycle.endAt));
    assert.ok(cycle.participants.includes(event.editorId));
    const actionKey = `${cycle.id}/${event.editorId}`;
    assert.ok(!perTurn.has(actionKey), 'At most one public action per user per cycle');
    perTurn.add(actionKey);
  }
  if (event.revisionId) {
    assert.ok(!revisions.has(event.revisionId));
    if (event.baseRevisionId) assert.equal(revisions.get(event.baseRevisionId)?.articleId, event.articleId, 'Revision parent belongs to its article');
    assert.ok(typeof event.body === 'string' && event.body.trim());
    assert.ok(!/<\/?(?:script|iframe|object|style)\b/i.test(event.body));
    if (event.action === 'create') assert.ok(linksIn(event.body).some(id => id !== event.articleId), 'New articles must join the network');
    revisions.set(event.revisionId,event);
  }
  eventIds.add(event.id);priorTimestamp=stamp(event.timestamp);
}
for (let index=0;index<source.cycles.length;index++) {
  const cycle=source.cycles[index];
  assert.equal(stamp(cycle.endAt)-stamp(cycle.startAt),12*3600000);
  if(index) assert.equal(cycle.startAt,source.cycles[index-1].endAt,'No skipped simulation windows in published history');
  const population=source.editors.filter(editor=>stamp(editor.joinedAt)<=stamp(cycle.startAt)).length;
  const [minimum,maximum] = index < 76 ? [3,20] : [4,24];
  assert.ok(cycle.participants.length>=Math.min(minimum,population) && cycle.participants.length<=Math.min(maximum,population));
  assert.equal(new Set(cycle.participants).size,cycle.participants.length);
}
for(const entry of source.journals){
  if (entry.action !== undefined) assert.ok(['create','revise','expand','organize','revert','comment','policy','abstain'].includes(entry.action));
  if (entry.response !== undefined) assert.ok(Array.isArray(entry.response) && entry.response.every(value => ['More frustrated','Less frustrated','More enthusiastic','Less enthusiastic'].includes(value)));
  assert.ok(stamp(entry.releasedAt)>=stamp(entry.timestamp)+48*3600000);
  assert.ok(stamp(entry.releasedAt)<=stamp(source.meta.latestCompletedAt),'Unreleased journal leaked');
  assert.ok(users.has(entry.editorId));
}
const current=snapshot(source);
assert.ok(current.articles.size>=5);
for(const article of current.articles.values()) for(const linked of linksIn(article.body)) assert.ok(current.articles.has(linked),`Broken article link ${article.id} -> ${linked}`);
const adjacency=new Map([...current.articles.keys()].map(id=>[id,new Set()]));
for(const {source:from,target:to} of current.links){adjacency.get(from).add(to);adjacency.get(to).add(from);}
const visited=new Set();const queue=[current.articles.keys().next().value];
while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);queue.push(...adjacency.get(id));}
assert.equal(visited.size,current.articles.size,'Published articles must remain connected');
for(const [route,answer,riddle] of [
  ['wiki','GUTTER','I hold what others know, though I have never learned. I grow when I am questioned, and change when I am turned. In a bound volume, what is the inner margin where two of me meet?'],
  ['wiki/map','LEGEND','I show you every connection, but understand not one. I reveal where all roads lead, though I travel on none. What part of me teaches you which marks stand for which things?'],
]){
  const html=readFileSync(`dist/${route}/index.html`,'utf8');
  assert.ok(html.includes(riddle),`${route}: exact riddle`);
  assert.ok(html.includes('noindex,nofollow,noarchive,noimageindex'));
  assert.ok(html.includes('name="referrer" content="no-referrer"'));
  assert.ok(html.includes('id="entry-form"') && html.includes('id="entry-answer"'));
  assert.ok(/id="wiki-workspace"[^>]*hidden|hidden[^>]*id="wiki-workspace"/.test(html),'Gate shown before workspace');
  assert.ok(!/data-pip-guide|class="support-coffee"/.test(html),'Wiki must have its own plain shell');
}
assert.ok(!existsSync('dist/.wiki-private'));
assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('https://boomerrawlings.com/wiki/'));
for(const file of ['wiki.js','map.js','shared.js']){
  const script=readFileSync(`dist/wiki-assets/${file}`,'utf8');
  assert.ok(!/api\.openai\.com|OPENAI_API_KEY|sk-proj-/.test(script));
}
console.log(`Wiki verified: ${source.cycles.length} completed cycles, ${current.articles.size} connected articles, ${current.editors.length} users, ${source.events.length} public events, ${source.journals.length} released journals.`);
