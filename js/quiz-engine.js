function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleChoices(question, rng) {
  const indices = question.choices.map((_, i) => i);
  const shuffledIndices = shuffle(indices, rng);
  const newChoices = shuffledIndices.map(i => question.choices[i]);
  const newCorrectIndex = shuffledIndices.indexOf(question.correctIndex);
  return { ...question, choices: newChoices, correctIndex: newCorrectIndex };
}

export function selectQuestions(domainData, countPerLevel, rng = Math.random) {
  const selected = [];
  for (const [level, count] of Object.entries(countPerLevel)) {
    const pool = domainData.questions.filter(q => q.level === level);
    if (pool.length < count) {
      throw new Error(
        `Domain "${domainData.domain}" does not have enough "${level}" questions: needs ${count}, has ${pool.length}`
      );
    }
    const chosen = shuffle(pool, rng).slice(0, count);
    selected.push(...chosen.map(q => shuffleChoices(q, rng)));
  }
  return selected;
}

export function buildQuiz(allDomainData, countPerLevel, rng = Math.random) {
  return allDomainData.map(domainData => ({
    domain: domainData.domain,
    domainLabel: domainData.domainLabel,
    questions: selectQuestions(domainData, countPerLevel, rng),
  }));
}

export function gradeAnswers(quiz, answers) {
  const result = {};
  for (const entry of quiz) {
    let correct = 0;
    for (const question of entry.questions) {
      if (answers[question.id] === question.correctIndex) {
        correct += 1;
      }
    }
    result[entry.domain] = { correct, total: entry.questions.length };
  }
  return result;
}
