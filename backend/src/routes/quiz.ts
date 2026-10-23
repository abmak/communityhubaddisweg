import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";

export const quizRouter = Router();

const TIME_LIMIT_SECONDS = 150; // 150 seconds for 10 questions

/**
 * Returns today's Ethiopian local calendar day key in YYYY-MM-DD
 * using the Africa/Addis_Ababa time zone.
 */
export function getAddisDayKey(): string {
  const now = new Date();
  // Addis Ababa is UTC+3
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // e.g. "2026-10-22"
}

/**
 * Deterministically picks 10 distinct question IDs from all active questions
 * based on the day string so all community members receive the same daily challenge.
 */
async function getDailyQuestionIds(dayKey: string): Promise<string[]> {
  const allActive = await prisma.quizQuestion.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { key: "asc" },
  });

  if (allActive.length === 0) return [];

  // Seeded hash from day string
  let seed = 0;
  for (let i = 0; i < dayKey.length; i++) {
    seed = (seed * 31 + dayKey.charCodeAt(i)) >>> 0;
  }

  const selectedIds: string[] = [];
  const total = allActive.length;
  const step = Math.max(1, Math.floor(total / 10));

  for (let i = 0; i < 10; i++) {
    const targetIndex = (seed + i * step) % total;
    const candidate = allActive[targetIndex].id;
    if (!selectedIds.includes(candidate)) {
      selectedIds.push(candidate);
    }
  }

  // If fewer than 10 due to collision, fill remaining
  for (let i = 0; i < total && selectedIds.length < 10; i++) {
    if (!selectedIds.includes(allActive[i].id)) {
      selectedIds.push(allActive[i].id);
    }
  }

  return selectedIds;
}

const submitQuizSchema = z.object({
  answers: z.array(z.coerce.number().int().min(0).max(3)).length(10),
  durationMs: z.coerce.number().int().min(0).max(180_000), // up to 150s + 30s network buffer
});

// GET /api/quiz/today
quizRouter.get(
  "/today",
  asyncHandler(async (req, res) => {
    const day = getAddisDayKey();
    const userId = req.userId;
    const questionIds = await getDailyQuestionIds(day);

    const questions = await prisma.quizQuestion.findMany({
      where: { id: { in: questionIds } },
    });

    // Maintain ordered list
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q));

    let existingAttempt = null;
    let rank = null;

    if (userId) {
      existingAttempt = await prisma.quizAttempt.findUnique({
        where: { userId_day: { userId, day } },
      });

      if (existingAttempt && existingAttempt.score !== null) {
        // Calculate user's rank today
        const higherScorers = await prisma.quizAttempt.count({
          where: {
            day,
            completedAt: { not: null },
            OR: [
              { score: { gt: existingAttempt.score } },
              {
                score: existingAttempt.score,
                durationMs: { lt: existingAttempt.durationMs ?? 150000 },
              },
            ],
          },
        });
        rank = higherScorers + 1;
      }
    }

    const totalParticipants = await prisma.quizAttempt.count({
      where: { day, completedAt: { not: null } },
    });

    if (existingAttempt && existingAttempt.score !== null) {
      // User has completed today's quiz: return full questions with answers & explanations
      return res.json({
        day,
        alreadyCompleted: true,
        score: existingAttempt.score,
        durationMs: existingAttempt.durationMs,
        timeLimitSeconds: TIME_LIMIT_SECONDS,
        rank,
        totalParticipants,
        userAnswers: existingAttempt.answers,
        questions: orderedQuestions.map((q, idx) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          category: q.category,
          difficulty: q.difficulty,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          userAnswer: existingAttempt.answers[idx] ?? null,
          isCorrect: existingAttempt.answers[idx] === q.correctIndex,
        })),
      });
    }

    // User has not completed: hide correctIndex and explanation!
    res.json({
      day,
      alreadyCompleted: false,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      totalParticipants,
      questions: orderedQuestions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        category: q.category,
        difficulty: q.difficulty,
      })),
    });
  }),
);

// POST /api/quiz/submit
quizRouter.post(
  "/submit",
  requireAuth,
  validate(submitQuizSchema, "body"),
  asyncHandler(async (req, res) => {
    const day = getAddisDayKey();
    const userId = req.userId!;
    const { answers, durationMs } = req.body as z.infer<typeof submitQuizSchema>;

    // Check if already attempted
    const existing = await prisma.quizAttempt.findUnique({
      where: { userId_day: { userId, day } },
    });

    if (existing && existing.score !== null) {
      throw ApiError.badRequest("You have already completed today's challenge. Come back tomorrow for 10 fresh questions!");
    }

    const questionIds = await getDailyQuestionIds(day);
    const questions = await prisma.quizQuestion.findMany({
      where: { id: { in: questionIds } },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q));

    // Calculate score
    let score = 0;
    const review = orderedQuestions.map((q, idx) => {
      const userAns = answers[idx];
      const isCorrect = userAns === q.correctIndex;
      if (isCorrect) score += 1;

      return {
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        category: q.category,
        difficulty: q.difficulty,
        correctIndex: q.correctIndex,
        userAnswer: userAns,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const finalDuration = Math.min(TIME_LIMIT_SECONDS * 1000, durationMs);
    const now = new Date();

    const attempt = await prisma.quizAttempt.upsert({
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
        questionIds,
        answers,
        score,
        durationMs: finalDuration,
        startedAt: new Date(now.getTime() - finalDuration),
        expiresAt: new Date(now.getTime() + 1000),
        completedAt: now,
      },
    });

    // Mark questions as seen
    await prisma.quizSeen.createMany({
      data: questionIds.map((qId) => ({
        userId,
        questionId: qId,
      })),
      skipDuplicates: true,
    });

    // Calculate rank
    const higherScorers = await prisma.quizAttempt.count({
      where: {
        day,
        completedAt: { not: null },
        OR: [
          { score: { gt: score } },
          { score: score, durationMs: { lt: finalDuration } },
        ],
      },
    });

    const rank = higherScorers + 1;
    const totalParticipants = await prisma.quizAttempt.count({
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

// GET /api/quiz/leaderboard
quizRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const day = (req.query.day as string) || getAddisDayKey();

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        day,
        completedAt: { not: null },
      },
      orderBy: [
        { score: "desc" },
        { durationMs: "asc" },
      ],
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
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

    res.json({
      day,
      leaderboard,
      total: leaderboard.length,
    });
  }),
);

// GET /api/quiz/stats
quizRouter.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
    });

    const totalQuizzes = attempts.length;
    const totalScore = attempts.reduce((acc, a) => acc + (a.score ?? 0), 0);
    const avgScore = totalQuizzes > 0 ? (totalScore / totalQuizzes).toFixed(1) : 0;
    const bestScore = attempts.reduce((max, a) => Math.max(max, a.score ?? 0), 0);
    const perfectScores = attempts.filter((a) => (a.score ?? 0) === 10).length;

    res.json({
      totalQuizzes,
      avgScore,
      bestScore,
      perfectScores,
    });
  }),
);
