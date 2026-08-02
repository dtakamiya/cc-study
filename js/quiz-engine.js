function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleChoices(question, rng) {
  const indices = question.choices.map((_, i) => i);
  const shuffledIndices = shuffle(indices, rng);
  const newChoices = shuffledIndices.map(i => question.choices[i]);
  const newCorrectIndex = shuffledIndices.indexOf(question.correctIndex);
  return { ...question, choices: newChoices, correctIndex: newCorrectIndex };
}

// 指定領域・指定レベルのプールからcount問を抽出する。
// プールがcount問ちょうどなら実質的に全問が順不同で出題される。
// 将来プールを増やした場合は、そこからランダムにcount問が選ばれる。
export function selectQuestions(domainData, level, count, rng = Math.random) {
  const pool = domainData.questions.filter(q => q.level === level);
  if (pool.length < count) {
    throw new Error(
      `Domain "${domainData.domain}" does not have enough "${level}" questions: needs ${count}, has ${pool.length}`
    );
  }
  return shuffle(pool, rng)
    .slice(0, count)
    .map(q => shuffleChoices(q, rng));
}

export function scoreStage(questions, answers) {
  let correct = 0;
  for (const question of questions) {
    if (answers[question.id] === question.correctIndex) {
      correct += 1;
    }
  }
  return correct;
}

export function collectWrongAnswers(questions, answers, domainLabel) {
  const wrong = [];
  for (const question of questions) {
    const selectedIndex = Object.prototype.hasOwnProperty.call(answers, question.id)
      ? answers[question.id]
      : null;
    if (selectedIndex !== question.correctIndex) {
      wrong.push({
        questionId: question.id,
        domainLabel,
        question: question.question,
        choices: question.choices,
        selectedIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      });
    }
  }
  return wrong;
}
