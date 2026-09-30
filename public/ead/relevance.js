/* Research triage for the secure-agent project. Scores describe indexed work,
   not people, affiliations, security clearance, or operational intent. */
(() => {
  'use strict';

  const criteria = [
    { id: 'personality', label: 'Personality', weight: 30, pattern: /\b(?:personalit(?:y|ies)|personas?|character consistency|behavio(?:u)?ral consistency|behavio(?:u)?r steering|role[ -]?playing)\b/i },
    { id: 'memory', label: 'Memory', weight: 28, pattern: /\b(?:memor(?:y|ies)|episodic recall|persistent context|context management)\b/i },
    { id: 'process', label: 'Process adherence', weight: 30, pattern: /\b(?:instruction[ -]following|instruction hierarchy|process adherence|policy adherence|policy compliance|workflow verification|permission(?:s|ing)?|access control|trust boundar(?:y|ies)|protected instructions|tool constraints|task calibration|authorized actions?|authorised actions?|instruction integrity)\b/i },
    { id: 'security', label: 'Agent safeguards', weight: 30, pattern: /\b(?:prompt[ -]injection|agent[ -]security|agent[ -]safety|AI safety|LLM safety|jailbreak(?:ing|s)?|red[ -]team(?:ing)?|memory poisoning|adversarial (?:attacks?|testing|arguments?)|privacy leakage|data leakage|tool misuse|agent attacks|compromised (?:instructions|observations|memor(?:y|ies)))\b/i },
    { id: 'tools', label: 'Tool use', weight: 18, pattern: /\b(?:tool[ -](?:use|using|calling|learning|interaction)|use tools|uses tools|tools and environments|tool interactions?|tool feedback|tool coordination|function calling|computer[ -]use|browser agents?|browsing agents?|GUI agents?|web agents?|software agents?|workflow agents?|agent workflows?)\b/i }
  ];
  const agentPattern = /\b(?:agents?|LLMs?|language models?|AI assistants?|artificial intelligence assistants?)\b/i;
  const researchPattern = /\b(?:research(?:es|ing)?|stud(?:y|ies|ying)|develop(?:s|ing)?|build(?:s|ing)?|evaluat(?:e|es|ing|ion)|test(?:s|ing)?|investigat(?:e|es|ing|ion)|benchmark(?:s|ing)?|model(?:s|ing|ling)?|learning|understand(?:s|ing)?|design(?:s|ing)?)\b/i;
  const normalize = value => String(value || '').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim();
  const sourceUrl = value => {
    try { const url = new URL(String(value || '')); return /^https?:$/.test(url.protocol) ? url.href : null; }
    catch { return null; }
  };
  const array = value => Array.isArray(value) ? value : [];

  function excerpts(entity) {
    const record = entity.indexRecord || {};
    const profileUrl = sourceUrl(entity.sourceUrl || record.source_url);
    const result = [];
    const seen = new Set();
    const add = (text, url, field, basis, strength) => {
      const value = normalize(text), link = sourceUrl(url);
      if (!value || !link || seen.has(`${value}\u0000${link}`)) return;
      seen.add(`${value}\u0000${link}`);
      result.push({ text: value, url: link, field, basis, strength });
    };
    array(record.works).forEach((work, index) => add(work.title, work.url || work.source_url,
      `indexRecord.works[${index}].title`, 'Publication title', 1));
    const application = record.application_evidence;
    if (application && application.basis !== 'inferred') {
      add(application.description, application.source_url, 'indexRecord.application_evidence.description',
        'Reported application', 1);
    }
    add(record.documented_application, record.source_url || profileUrl, 'indexRecord.documented_application', 'Reported application', 1);
    add(record.observed_capabilities, record.source_url || profileUrl, 'indexRecord.observed_capabilities', 'Reported research', 1);
    add(entity.work || record.work_plain, profileUrl, 'work', 'Indexed work summary', 0.8);
    add(entity.providedBio || record.bio_excerpt,
      entity.providedBioSourceUrl || record.bio_excerpt_source_url || profileUrl,
      'providedBio', 'Source excerpt', 0.8);
    add(entity.bio || record.bio_generated || record.description, profileUrl, 'bio', 'Indexed profile summary', 0.8);
    // Tags supply a secondary lead only. Editorial reasons, inferred uses,
    // search_text, affiliation, degree, name and relationship counts never score.
    add(array(record.topics).join('; '), profileUrl, 'indexRecord.topics', 'Indexed research topics', 0.4);
    return result;
  }

  function evaluate(entity) {
    const record = entity?.indexRecord || {};
    if (!entity || typeof entity !== 'object') return review('No profile evidence available.');
    if (entity.type === 'institution' || record.kind === 'institution') {
      return { score: 0, tier: 'context', label: 'Context', reason: 'Institutional connection; assess the linked research teams.', signals: [], evidence: [] };
    }
    const pieces = excerpts(entity);
    // A named title or a substantive description is evidence of scope. A URL,
    // job title or broad tag on its own is not enough to assign lower priority.
    const substantive = pieces.some(piece => piece.basis === 'Publication title' ||
      (piece.field === 'work' && piece.text.split(' ').length >= 5) ||
      (piece.field !== 'indexRecord.topics' && piece.text.split(' ').length >= 7 && researchPattern.test(piece.text)));
    if (!substantive) return review('Research detail needed before prioritizing.');

    const agentContext = pieces.some(piece => agentPattern.test(piece.text));
    const transferOnly = record.relevance_basis === 'inferred_application' &&
      !pieces.some(piece => piece.basis === 'Publication title' && agentPattern.test(piece.text));
    const signals = [];
    for (const criterion of criteria) {
      // Human memory/personality alone remains a transfer candidate, not a
      // claim that the source demonstrated a language-model control.
      const matches = pieces.filter(piece => criterion.pattern.test(piece.text))
        .sort((left, right) => right.strength - left.strength);
      const best = matches[0];
      if (!best) continue;
      const inferred = transferOnly || (!agentContext && ['personality', 'memory', 'process'].includes(criterion.id));
      signals.push({ id: criterion.id, label: criterion.label,
        score: Math.round(criterion.weight * best.strength * (inferred ? 0.45 : 1)),
        basis: inferred ? 'Inferred transfer' : best.basis,
        sourceUrl: best.url, field: best.field, excerpt: best.text,
        matchedText: best.text.match(criterion.pattern)?.[0] || '', inferred });
    }
    signals.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    let score = Math.min(99, signals.reduce((sum, signal) => sum + signal.score, 0));
    const directSignals = signals.filter(signal => !signal.inferred && signal.basis !== 'Indexed research topics');
    // Tags and inferred transfers cannot turn a general tool-use match into
    // priority work. At least one strong control or several direct matches
    // must support that tier.
    const directScore = directSignals.reduce((sum, signal) => sum + signal.score, 0);
    if (directScore < 22) score = Math.min(score, 18);
    const evidence = signals.map(signal => ({ label: signal.label, url: signal.sourceUrl,
      field: signal.field, excerpt: signal.excerpt, basis: signal.basis, matchedText: signal.matchedText }));
    if (signals.length) {
      const tier = directScore >= 22 ? 'priority' : 'relevant';
      const labels = signals.slice(0, 3).map(signal => signal.label.toLowerCase()).join(' · ');
      const inferred = signals.every(signal => signal.inferred);
      return { score, tier, label: tier === 'priority' ? 'High relevance' : 'Relevant',
        reason: inferred ? `Transfer candidate: ${labels}.` : `Research match: ${labels}.`,
        signals, evidence };
    }
    const generalAgentWork = pieces.find(piece => piece.field !== 'indexRecord.topics' && agentPattern.test(piece.text));
    if (generalAgentWork && !transferOnly) {
      return { score: 8, tier: 'relevant', label: 'Relevant',
        reason: 'Agent or language-model work; no specific control matched.', signals: [],
        evidence: [{ label: 'Agent or language-model work', url: generalAgentWork.url,
          field: generalAgentWork.field, excerpt: generalAgentWork.text, basis: generalAgentWork.basis }] };
    }
    return { score: 0, tier: 'context', label: 'Context',
      reason: transferOnly ? 'Adjacent research; agent application is inferred.' : 'Background research; no direct project match in this record.',
      signals: [], evidence: pieces.slice(0, 1).map(piece => ({ label: 'Research scope', url: piece.url,
        field: piece.field, excerpt: piece.text, basis: piece.basis })) };
  }

  function review(reason) {
    return { score: 0, tier: 'review', label: 'Needs review', reason, signals: [], evidence: [] };
  }

  window.LEORelevance = Object.freeze({ evaluate,
    focus: 'Secure agents',
    description: 'Research fit: personality, memory, tool use, process adherence and agent safeguards.',
    tiers: Object.freeze([
      { id: 'priority', label: 'High relevance' },
      { id: 'relevant', label: 'Relevant' },
      { id: 'context', label: 'Context' },
      { id: 'review', label: 'Needs review' }
    ]) });
})();
