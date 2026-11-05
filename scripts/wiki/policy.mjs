const fail = message => { throw Error(message); };
const validTime = value => Number.isFinite(Date.parse(value));
const words = value => value.trim().split(/\s+/).length;

export function openPolicy(state, id, now) {
  const proposal = state.events.find(event => event.id === id && event.action === 'policy' && event.timestamp <= now);
  if (!proposal) fail('Policy proposal not found');
  const sessions = state.policySessions ??= [];
  if (sessions.some(session => session.id === id)) fail('Policy already opened');
  const eligible = state.editors.filter(editor => editor.joinedAt <= now).map(editor => editor.id);
  if (!eligible.length) fail('No eligible editors');
  const session = {id, openedAt:now, eligible, discussion:[], ballots:[]};
  sessions.push(session);
  return session;
}

export function policyPacket(state, id, editorId) {
  const session = state.policySessions?.find(item => item.id === id);
  if (!session || session.closedAt || !session.eligible.includes(editorId)) fail('Policy is unavailable to this editor');
  const editor = state.editors.find(item => item.id === editorId);
  const proposal = state.events.find(event => event.id === id);
  return {
    phase:session.votingAt ? 'vote' : 'discussion',
    character:{id:editor.id,name:editor.name,interests:editor.interests,writingStyle:editor.style},
    proposal:{id,title:proposal.title,body:proposal.body,author:proposal.editorId},
    discussion:session.discussion.map(({editorId:author,body}) => ({editorId:author,body})),
    rule:'Adoption takes more than half of eligible editors. Every eligible editor can support, oppose, or abstain.',
  };
}

export function recordPolicyDecision(state, raw, now) {
  const packet = policyPacket(state, raw.id, raw.editorId);
  const session = state.policySessions.find(item => item.id === raw.id);
  if (raw.phase !== packet.phase) fail('Decision is for the wrong phase');
  const entries = packet.phase === 'vote' ? session.ballots : session.discussion;
  if (entries.some(entry => entry.editorId === raw.editorId)) fail('Editor has already responded in this phase');
  if (!validTime(now) || now < (session.votingAt ?? session.openedAt)) fail('Invalid policy decision timestamp');
  if (typeof raw.body !== 'string' || !raw.body.trim() || words(raw.body) > 150 || /[<>]/.test(raw.body)) fail('Write a bounded plain-text public reason');
  if (typeof raw.journal !== 'string' || !raw.journal.trim() || words(raw.journal) > 100 || /[<>]/.test(raw.journal)) fail('Write a brief private editor note');
  if (packet.phase === 'vote' && !['support','oppose','abstain'].includes(raw.vote)) fail('Invalid ballot');
  const entry = {editorId:raw.editorId, timestamp:now, body:raw.body.trim(), ...(packet.phase === 'vote' ? {vote:raw.vote} : {})};
  entries.push(entry);
  state.journals.push({id:`journal-policy-${raw.id}-${packet.phase}-${raw.editorId}`, editorId:raw.editorId, eventId:raw.id,
    timestamp:now, releasedAt:new Date(Date.parse(now)+48*3600000).toISOString(), body:raw.journal.trim(),
    outcome:packet.phase === 'vote' ? `Ballot recorded: ${raw.vote}.` : 'Policy discussion contribution recorded.'});
  return entry;
}

export function advancePolicy(state, id, now) {
  const session = state.policySessions?.find(item => item.id === id);
  if (!session || session.closedAt) fail('Policy is unavailable');
  const entries = session.votingAt ? session.ballots : session.discussion;
  if (entries.length !== session.eligible.length) fail('Awaiting editor responses');
  if (entries.some(entry => entry.timestamp > now)) fail('Policy cannot advance before its responses');
  if (!session.votingAt) session.votingAt = now;
  else {
    session.closedAt = now;
    session.result = session.ballots.filter(entry => entry.vote === 'support').length > session.eligible.length / 2 ? 'adopted' : 'rejected';
  }
  return session;
}
