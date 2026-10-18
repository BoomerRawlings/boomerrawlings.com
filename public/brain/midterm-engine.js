/** Pure selection and scoring functions shared by the browser and content checks. */
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleChoices(question, random = Math.random) {
  if (!question.choices || !Number.isInteger(question.correctIndex)) return { ...question };
  const choices = shuffle(question.choices.map((text, index) => ({ text, index, explanation: question.choiceExplanations?.[index] })), random);
  return {
    ...question,
    choices: choices.map((choice) => choice.text),
    ...(question.choiceExplanations ? { choiceExplanations: choices.map((choice) => choice.explanation) } : {}),
    correctIndex: choices.findIndex((choice) => choice.index === question.correctIndex),
  };
}

export function selectQuestions(bank, { length = 25, difficulty = 'mixed' } = {}, random = Math.random) {
  const eligible = bank.filter((question) => difficulty === 'mixed' || question.difficulty === difficulty);
  const requested = length === 'all' ? eligible.length : Math.max(1, Math.floor(Number(length) || 25));
  const count = Math.min(requested, eligible.length);
  const groups = new Map();
  for (const question of shuffle(eligible, random)) {
    if (!groups.has(question.topic)) groups.set(question.topic, []);
    groups.get(question.topic).push(question);
  }
  const topics = shuffle([...groups.keys()], random);
  const selected = [];
  // Take one per topic each round so long sessions cannot accidentally neglect a unit.
  while (selected.length < count) {
    for (const topic of topics) {
      const next = groups.get(topic).pop();
      if (next) selected.push(shuffleChoices(next, random));
      if (selected.length === count) break;
    }
  }
  return { questions: shuffle(selected, random), requested, available: eligible.length, capped: requested > eligible.length };
}

export function summarize(questions, answers) {
  const totals = { objective: 0, correct: 0, recall: 0, got: 0, partly: 0, needs: 0, unanswered: 0 };
  const topics = new Map();
  const reviewIds = [];
  for (const question of questions) {
    if (!topics.has(question.topic)) topics.set(question.topic, { topic: question.topic, objective: 0, correct: 0, recall: 0, got: 0, partly: 0, needs: 0, unanswered: 0 });
    const topic = topics.get(question.topic);
    const answer = answers[question.id];
    if (question.kind === 'short') {
      totals.recall += 1; topic.recall += 1;
      const rating = answer?.rating;
      if (['got', 'partly', 'needs'].includes(rating)) { totals[rating] += 1; topic[rating] += 1; }
      else { totals.unanswered += 1; topic.unanswered += 1; }
      if (rating !== 'got') reviewIds.push(question.id);
    } else {
      totals.objective += 1; topic.objective += 1;
      if (answer?.revealed && answer.selected === question.correctIndex) { totals.correct += 1; topic.correct += 1; }
      else {
        reviewIds.push(question.id);
        if (!answer?.revealed) { totals.unanswered += 1; topic.unanswered += 1; }
      }
    }
  }
  return { ...totals, topics: [...topics.values()], reviewIds };
}
