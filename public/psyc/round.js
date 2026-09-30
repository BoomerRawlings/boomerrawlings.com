export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRound(pool, limit = 10, random = Math.random) {
  const cards = shuffle(pool, random).slice(0, limit).map(card => ({ ...card, choices: shuffle(card.choices, random) }));
  return { cards, index: 0, answered: false, correct: 0, streak: 0, best: 0, missed: [], complete: cards.length === 0 };
}

export function answerRound(round, choice) {
  if (round.complete || round.answered) return null;
  const card = round.cards[round.index];
  if (!card.choices.includes(choice)) return null;
  round.answered = true;
  const correct = choice === card.answer;
  if (correct) { round.correct++; round.streak++; } else { round.streak = 0; round.missed.push(card); }
  round.best = Math.max(round.best, round.streak);
  return correct;
}

export function nextRound(round) {
  if (round.complete || !round.answered) return false;
  round.index++;
  round.answered = false;
  round.complete = round.index >= round.cards.length;
  return true;
}
