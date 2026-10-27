import { prisma } from "./prisma";
import { PLACE_QUIZ_ENTRIES, type PlaceQuizEntry } from "./place-quiz-data";

/**
 * Deterministic PRNG so a question keeps the same options (and correct answer
 * position) across boots and across every member's device.
 */
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface PreparedQuestion {
  key: string;
  prompt: string;
  imageUrl: string;
  imageCredit: string;
  imageLicense: string;
  imagePageUrl: string;
  answer: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
  region: string;
  kind: string;
}

function prepareQuestions(): PreparedQuestion[] {
  const byCategory = new Map<string, PlaceQuizEntry[]>();
  const byKind = new Map<string, PlaceQuizEntry[]>();

  for (const entry of PLACE_QUIZ_ENTRIES) {
    byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry]);
    byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry]);
  }

  return PLACE_QUIZ_ENTRIES.map((entry) => {
    const sameCategory = (byCategory.get(entry.category) ?? []).filter((item) => item.key !== entry.key);
    const sameKind = (byKind.get(entry.kind) ?? []).filter((item) => item.key !== entry.key);
    const distractorPool = sameCategory.length >= 3 ? sameCategory : sameKind;

    const random = mulberry32(hashSeed(entry.key));
    const distractors = shuffle(distractorPool, random)
      .slice(0, 3)
      .map((item) => item.answer);

    // Every answer must be distinct; duplicate names would also duplicate keys.
    const optionNames = [entry.answer, ...distractors.filter((name) => name !== entry.answer)];
    while (optionNames.length < 4) optionNames.push("None of these");
    const options = shuffle(optionNames.slice(0, 4), random);

    return {
      key: entry.key,
      prompt: entry.prompt,
      imageUrl: entry.imageUrl,
      imageCredit: entry.imageCredit,
      imageLicense: entry.imageLicense,
      imagePageUrl: entry.imagePageUrl,
      answer: entry.answer,
      options,
      correctIndex: Math.max(0, options.indexOf(entry.answer)),
      explanation: entry.description,
      category: entry.category,
      region: entry.region,
      kind: entry.kind,
    };
  });
}

/**
 * Seeds (and refreshes) the Guess the Place pool. Upserting keeps production
 * photos, credits and explanations in sync with the generated data file, while
 * questions removed from the dataset are deactivated instead of deleted so old
 * attempts keep working.
 */
export async function ensureSeedPlaceQuiz(): Promise<void> {
  const questions = prepareQuestions();
  if (questions.length === 0) return;

  for (const question of questions) {
    await prisma.placeQuizQuestion.upsert({
      where: { key: question.key },
      update: {
        prompt: question.prompt,
        imageUrl: question.imageUrl,
        imageCredit: question.imageCredit,
        imageLicense: question.imageLicense,
        imagePageUrl: question.imagePageUrl,
        answer: question.answer,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        category: question.category,
        region: question.region,
        kind: question.kind,
        active: true,
      },
      create: question,
    });
  }

  await prisma.placeQuizQuestion.updateMany({
    where: { key: { notIn: questions.map((question) => question.key) } },
    data: { active: false },
  });

  const activeCount = await prisma.placeQuizQuestion.count({ where: { active: true } });
  console.log(`"Guess the Place" pool ready with ${activeCount} photo questions.`);
}
