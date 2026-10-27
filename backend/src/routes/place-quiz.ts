import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getAddisDayKey } from "./quiz";

export const placeQuizRouter = Router();

const TIME_LIMIT_SECONDS = 150; // 150 seconds for 10 photo questions
const QUESTIONS_PER_DAY = 10;

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

function addDays(dayKey: string, offset: number): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * The pool rotates through a fixed window of ten photos per Ethiopian calendar
 * day, so every member gets the exact same challenge and the whole set cycles
 * without repeating before every photo has appeared once.
 */
async function getDailyQuestionIds(dayKey: string): Promise<string[]> {
  const active = await prisma.placeQuizQuestion.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { key: "asc" },
  });
  if (active.length === 0) return [];

  const dayNumber = Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / 86_400_000);
  const total = active.length;
  const start = (((dayNumber * QUESTIONS_PER_DAY) % total) + total) % total;
  const take = Math.min(QUESTIONS_PER_DAY, total);

  return Array.from({ length: take }, (_, index) => active[(start + index) % total].id);
}

async function loadOrderedQuestions(dayKey: string) {
  const ids = await getDailyQuestionIds(dayKey);
  if (ids.length === 0) return [];

  const rows = await prisma.placeQuizQuestion.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

type QuestionRow = Awaited<ReturnType<typeof loadOrderedQuestions>>[number];

function publicQuestion(question: QuestionRow) {
  return {
    id: question.id,
    prompt: question.prompt,
    imageUrl: question.imageUrl,
    imageCredit: question.imageCredit,
    imageLicense: question.imageLicense,
    imagePageUrl: question.imagePageUrl,
    options: question.options,
    category: question.category,
    region: question.region,
    kind: question.kind,
  };
}

function reviewQuestion(question: QuestionRow, userAnswer: number | null) {
  return {
    ...publicQuestion(question),
    correctIndex: question.correctIndex,
    answer: question.answer,
    explanation: question.explanation,
    userAnswer,
    isCorrect: userAnswer === question.correctIndex,
  };
}

const submitSchema = z.object({
  answers: z.array(z.coerce.number().int().min(0).max(3)).length(QUESTIONS_PER_DAY),
  durationMs: z.coerce.number().int().min(0).max(180_000),
});

// GET /api/place-quiz/today
placeQuizRouter.get(
  "/today",
  asyncHandler(async (req, res) => {
    const day = getAddisDayKey();
    const userId = req.userId;
    const questions = await loadOrderedQuestions(day);

    const totalParticipants = await prisma.placeQuizAttempt.count({
      where: { day, completedAt: { not: null } },
    });

    let attempt = null;
    let rank: number | null = null;

    if (userId) {
      attempt = await prisma.placeQuizAttempt.findUnique({
        where: { userId_day: { userId, day } },
      });

      if (attempt && attempt.score !== null) {
        const higherScorers = await prisma.placeQuizAttempt.count({
          where: {
            day,
            completedAt: { not: null },
            OR: [
              { score: { gt: attempt.score } },
              {
                score: attempt.score,
                durationMs: { lt: attempt.durationMs ?? TIME_LIMIT_SECONDS * 1000 },
              },
            ],
          },
        });
        rank = higherScorers + 1;
      }
    }

    if (attempt && attempt.score !== null) {
      return res.json({
        day,
        alreadyCompleted: true,
        score: attempt.score,
        durationMs: attempt.durationMs,
        timeLimitSeconds: TIME_LIMIT_SECONDS,
        rank,
        totalParticipants,
        userAnswers: attempt.answers,
        questions: questions.map((question, index) =>
          reviewQuestion(question, attempt.answers[index] ?? null),
        ),
      });
    }

    return res.json({
      day,
      alreadyCompleted: false,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      totalParticipants,
      questions: questions.map(publicQuestion),
    });
  }),
);

// POST /api/place-quiz/submit
placeQuizRouter.post(
  "/submit",
  requireAuth,
  validate(submitSchema, "body"),
  asyncHandler(async (req, res) => {
    const day = getAddisDayKey();
    const userId = req.userId!;
    const { answers, durationMs } = req.body as z.infer<typeof submitSchema>;

    const existing = await prisma.placeQuizAttempt.findUnique({
      where: { userId_day: { userId, day } },
    });
    if (existing && existing.score !== null) {
      throw ApiError.badRequest(
        "You have already played today's photo challenge. Come back tomorrow for 10 new places!",
      );
    }

    const questions = await loadOrderedQuestions(day);
    if (questions.length === 0) {
      throw ApiError.badRequest("The photo challenge is not ready yet. Please try again shortly.");
    }

    let score = 0;
    const review = questions.map((question, index) => {
      const userAnswer = answers[index] ?? null;
      const isCorrect = userAnswer === question.correctIndex;
      if (isCorrect) score += 1;
      return reviewQuestion(question, userAnswer);
    });

    const finalDuration = Math.min(TIME_LIMIT_SECONDS * 1000, durationMs);
    const now = new Date();

    await prisma.placeQuizAttempt.upsert({
      where: { userId_day: { userId, day } },
      update: {
        answers,
        score,
        durationMs: finalDuration,
        completedAt: now,
      },
      create: {
        userId,
        day,
        questionIds: questions.map((question) => question.id),
        answers,
        score,
        durationMs: finalDuration,
        startedAt: new Date(now.getTime() - finalDuration),
        completedAt: now,
      },
    });

    const higherScorers = await prisma.placeQuizAttempt.count({
      where: {
        day,
        completedAt: { not: null },
        OR: [
          { score: { gt: score } },
          { score, durationMs: { lt: finalDuration } },
        ],
      },
    });

    const rank = higherScorers + 1;
    const totalParticipants = await prisma.placeQuizAttempt.count({
      where: { day, completedAt: { not: null } },
    });

    res.json({
      success: true,
      score,
      durationMs: finalDuration,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      rank,
      totalParticipants,
      review,
    });
  }),
);

// GET /api/place-quiz/leaderboard
placeQuizRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const requested = typeof req.query.day === "string" ? req.query.day : "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : getAddisDayKey();
    const today = getAddisDayKey();

    const attempts = await prisma.placeQuizAttempt.findMany({
      where: { day, completedAt: { not: null } },
      orderBy: [{ score: "desc" }, { durationMs: "asc" }],
      take: 50,
      include: { user: { select: USER_SELECT } },
    });

    const leaderboard = attempts.map((attempt, index) => ({
      rank: index + 1,
      id: attempt.id,
      score: attempt.score ?? 0,
      durationMs: attempt.durationMs ?? 0,
      durationSeconds: Math.round((attempt.durationMs ?? 0) / 1000),
      completedAt: attempt.completedAt?.toISOString() ?? null,
      user: attempt.user,
    }));

    // The champions board: the best score of each of the last seven days.
    const days = Array.from({ length: 7 }, (_, index) => addDays(today, -index));
    const winners = (
      await Promise.all(
        days.map(async (winnerDay) => {
          const top = await prisma.placeQuizAttempt.findFirst({
            where: { day: winnerDay, completedAt: { not: null } },
            orderBy: [{ score: "desc" }, { durationMs: "asc" }],
            include: { user: { select: USER_SELECT } },
          });
          if (!top) return null;
          return {
            day: winnerDay,
            user: top.user,
            score: top.score ?? 0,
            durationSeconds: Math.round((top.durationMs ?? 0) / 1000),
          };
        }),
      )
    ).filter((winner): winner is NonNullable<typeof winner> => Boolean(winner));

    res.json({
      day,
      leaderboard,
      total: leaderboard.length,
      winners,
      today,
    });
  }),
);
