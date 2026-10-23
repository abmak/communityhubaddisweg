import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Award,
  Flame,
  Calendar,
  Share2,
  Medal,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { useTranslation } from "../store/i18n";
import { api, apiError } from "../lib/api";
import type {
  QuizTodayResponse,
  QuizLeaderboardResponse,
  QuizSubmitResponse,
  QuizQuestionItem,
  QuizLeaderboardItem,
} from "../types";
import { Avatar, Spinner } from "../components/ui";
import { cn } from "../lib/utils";

const TOTAL_TIME_SECONDS = 150; // 150 seconds for 10 questions

export function QuizPage() {
  const { t, lang } = useTranslation();
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  // Mode: "LOBBY" | "PLAYING" | "REVIEW"
  const [mode, setMode] = useState<"LOBBY" | "PLAYING" | "REVIEW">("LOBBY");

  // Quiz Data
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<QuizTodayResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardItem[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Playing State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(Array(10).fill(-1));
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_TIME_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Completed / Review State
  const [resultReview, setResultReview] = useState<QuizSubmitResponse | null>(null);

  const loadTodayQuiz = async () => {
    try {
      setLoading(true);
      const res = await api.get<QuizTodayResponse>("/api/quiz/today");
      setQuizData(res.data);

      if (res.data.alreadyCompleted) {
        setMode("REVIEW");
      }
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const res = await api.get<QuizLeaderboardResponse>("/api/quiz/leaderboard");
      setLeaderboard(res.data.leaderboard);
    } catch (e) {
      console.warn("Could not fetch leaderboard", e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    void loadTodayQuiz();
    void loadLeaderboard();
  }, []);

  // 150-second Countdown Timer
  useEffect(() => {
    if (mode !== "PLAYING") return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleTimeExpiredSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, selectedAnswers]);

  const handleStartQuiz = () => {
    if (!user) {
      pushToast("Please sign in to take the daily quiz and join the leaderboard!");
      navigate("/login");
      return;
    }
    if (!quizData || quizData.questions.length === 0) return;

    setSelectedAnswers(Array(10).fill(-1));
    setCurrentIndex(0);
    setSecondsRemaining(TOTAL_TIME_SECONDS);
    startTimeRef.current = Date.now();
    setMode("PLAYING");
  };

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => {
      const copy = [...prev];
      copy[currentIndex] = optionIndex;
      return copy;
    });
  };

  const handleTimeExpiredSubmit = async () => {
    pushToast("Time's up! Submitting your answers…", { tone: "default" });
    await submitQuiz(selectedAnswers, TOTAL_TIME_SECONDS * 1000);
  };

  const handleUserSubmit = async () => {
    const elapsedMs = Date.now() - startTimeRef.current;
    await submitQuiz(selectedAnswers, Math.min(TOTAL_TIME_SECONDS * 1000, elapsedMs));
  };

  const submitQuiz = async (answers: number[], durationMs: number) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      // Map unfilled to 0 as fallback
      const sanitizedAnswers = answers.map((a) => (a >= 0 && a <= 3 ? a : 0));

      const res = await api.post<QuizSubmitResponse>("/api/quiz/submit", {
        answers: sanitizedAnswers,
        durationMs,
      });

      setResultReview(res.data);
      setMode("REVIEW");
      void loadLeaderboard();
      pushToast(`Challenge complete! You scored ${res.data.score}/10! 🇪🇹`, { tone: "success" });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = () => {
    const score = resultReview?.score ?? quizData?.score ?? 0;
    const shareText = `I scored ${score}/10 in today's 'Lets Know Ethiopia' daily trivia on Addis Weg! Can you beat my score? 🇪🇹`;
    if (navigator.share) {
      void navigator.share({
        title: "Lets Know Ethiopia · Addis Weg",
        text: shareText,
        url: window.location.href,
      });
    } else {
      void navigator.clipboard.writeText(shareText);
      pushToast("Score copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-xs text-muted">Loading today's Ethiopian challenge…</p>
      </div>
    );
  }

  const currentQ = quizData?.questions[currentIndex];
  const answeredCount = selectedAnswers.filter((a) => a !== -1).length;
  const timerPercentage = (secondsRemaining / TOTAL_TIME_SECONDS) * 100;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-amber-950 via-zinc-950 to-emerald-950 p-6 text-white shadow-lift sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Award className="h-4 w-4 text-amber-400" />
              <span>Lets Know Ethiopia</span>
              <span className="font-ethiopic text-[11px] text-amber-300">· ኢትዮጵያን እናውቃት</span>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Daily 10-Question Heritage & Culture Challenge
            </h1>

            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              Test your knowledge of Ethiopian history, Emperors, the Battle of Adwa, rock-hewn Lalibela,
              traditional coffee ceremonies, and athletic legends. 150 seconds on the clock!
            </p>
          </div>

          {mode === "LOBBY" && !quizData?.alreadyCompleted && (
            <button
              type="button"
              onClick={handleStartQuiz}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-4 text-sm font-black text-zinc-950 shadow-glow transition hover:scale-105 active:scale-95 sm:self-start md:self-auto"
            >
              <Sparkles className="h-5 w-5" />
              <span>Start Today's Quiz (150s)</span>
            </button>
          )}

          {mode === "REVIEW" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-5 py-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Score</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Quiz Gameplay or Lobby/Review */}
        <div className="space-y-6 lg:col-span-2">
          {/* LOBBY STATE */}
          {mode === "LOBBY" && !quizData?.alreadyCompleted && (
            <div className="space-y-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <h2 className="text-lg font-bold text-ink">How Today's Challenge Works</h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                  <div className="rounded-xl bg-amber-500/10 p-2.5 w-fit text-amber-600 dark:text-amber-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-ink">150 Seconds</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Fast-paced countdown for all 10 questions. Remaining seconds count toward speed tiebreakers.
                  </p>
                </div>

                <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                  <div className="rounded-xl bg-brand-500/10 p-2.5 w-fit text-brand-600 dark:text-brand-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-ink">1 Daily Challenge</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Fresh set of 10 questions every day from our 2,000-question Ethiopian historical pool.
                  </p>
                </div>

                <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 w-fit text-emerald-600 dark:text-emerald-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-ink">Daily Leaderboard</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Ranked by highest score (10/10) and lowest completion time. Compete with the community!
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Fair Play Rule
                </p>
                <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                  Every community member receives the exact same 10 questions today. Once you start, the 150-second
                  timer will run continuously until you submit or time runs out.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartQuiz}
                  className="w-full rounded-2xl bg-brand-700 py-3.5 text-center text-sm font-bold text-white shadow-lift transition hover:bg-brand-600"
                >
                  I'm Ready · Start 150s Challenge
                </button>
              </div>
            </div>
          )}

          {/* PLAYING STATE */}
          {mode === "PLAYING" && currentQ && (
            <div className="space-y-6">
              {/* Sticky Timer Bar */}
              <div className="sticky top-16 z-30 overflow-hidden rounded-2xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-ink">
                    <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-brand-600 dark:text-brand-300">
                      Question {currentIndex + 1} of 10
                    </span>
                    <span className="text-[11px] text-muted">
                      ({answeredCount}/10 answered)
                    </span>
                  </div>

                  {/* Timer Display */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1 font-mono text-sm font-black transition",
                      secondsRemaining <= 15
                        ? "bg-rose-500 text-white animate-pulse"
                        : secondsRemaining <= 45
                          ? "bg-amber-500 text-zinc-950"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span>{secondsRemaining}s</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000",
                      secondsRemaining <= 15
                        ? "bg-rose-500"
                        : secondsRemaining <= 45
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${timerPercentage}%` }}
                  />
                </div>
              </div>

              {/* Active Question Card */}
              <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-lift">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {currentQ.category}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                    {currentQ.difficulty}
                  </span>
                </div>

                <h2 className="mt-4 text-base font-bold text-ink sm:text-lg leading-relaxed">
                  {currentQ.prompt}
                </h2>

                {/* Options Grid */}
                <div className="mt-6 space-y-3">
                  {currentQ.options.map((option, optIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === optIdx;
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(optIdx)}
                        className={cn(
                          "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left text-xs font-semibold transition active:scale-[0.99]",
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 text-ink shadow-sm ring-1 ring-amber-500/30"
                            : "border-line bg-surface-raised/30 text-ink hover:border-line hover:bg-surface-raised",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                            isSelected
                              ? "bg-amber-500 text-zinc-950 font-black"
                              : "bg-surface border border-line text-muted",
                          )}
                        >
                          {letter}
                        </span>
                        <span className="leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-8 flex items-center justify-between border-t border-line/60 pt-4">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  {currentIndex < 9 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => Math.min(9, prev + 1))}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleUserSubmit}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-glow hover:bg-emerald-500"
                    >
                      {submitting && <Spinner className="h-3.5 w-3.5" />}
                      <span>Submit Answers</span>
                    </button>
                  )}
                </div>

                {/* Question dots navigator */}
                <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        "h-7 w-7 rounded-lg text-[11px] font-bold transition",
                        currentIndex === idx
                          ? "bg-brand-700 text-white ring-2 ring-brand-500/40"
                          : selectedAnswers[idx] !== -1
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-surface border border-line text-muted",
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* REVIEW / RESULTS STATE */}
          {mode === "REVIEW" && (
            <div className="space-y-6">
              {/* Score Header Card */}
              <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-lift text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-glow">
                  <Trophy className="h-8 w-8" />
                </div>

                <div>
                  <h2 className="text-2xl font-black text-ink">
                    {resultReview
                      ? `You Scored ${resultReview.score} / 10!`
                      : quizData?.score !== undefined
                        ? `Today's Score: ${quizData.score} / 10`
                        : "Challenge Completed!"}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {resultReview?.score === 10
                      ? "Flawless score! An absolute Ethiopian history master. 👑"
                      : (resultReview?.score ?? quizData?.score ?? 0) >= 7
                        ? "Terrific knowledge of Ethiopian heritage and traditions! 🇪🇹"
                        : "Great effort! Review the historical facts below to learn more."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 border-t border-line/60 pt-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="h-4 w-4 text-brand-600" />
                    <span>
                      Time:{" "}
                      <strong className="text-ink">
                        {Math.round(
                          (resultReview?.durationMs ?? quizData?.durationMs ?? 0) / 1000,
                        )}
                        s
                      </strong>{" "}
                      / 150s
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-muted">
                    <Medal className="h-4 w-4 text-amber-500" />
                    <span>
                      Rank Today:{" "}
                      <strong className="text-ink">
                        #{resultReview?.rank ?? quizData?.rank ?? "1"}
                      </strong>{" "}
                      of {resultReview?.totalParticipants ?? quizData?.totalParticipants ?? 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Questions & Explanations Review */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Questions & Answers Review
                </h3>

                {(resultReview?.review ?? quizData?.questions ?? []).map((q, idx) => {
                  const isCorrect = q.isCorrect;
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        "rounded-3xl border p-5 sm:p-6 transition",
                        isCorrect
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-rose-500/30 bg-rose-500/5",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              isCorrect
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white",
                            )}
                          >
                            {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </span>
                          <span className="text-xs font-bold text-ink">
                            Question {idx + 1} · {q.category}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            isCorrect
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                          )}
                        >
                          {isCorrect ? "Correct (+1)" : "Missed"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-ink leading-relaxed">
                        {q.prompt}
                      </p>

                      {/* Options breakdown */}
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
                        {q.options.map((opt, optIdx) => {
                          const isTheCorrectOption = optIdx === q.correctIndex;
                          const wasUserChoice = optIdx === q.userAnswer;

                          return (
                            <div
                              key={optIdx}
                              className={cn(
                                "flex items-center gap-2.5 rounded-xl border p-2.5 font-medium transition",
                                isTheCorrectOption
                                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-bold"
                                  : wasUserChoice && !isTheCorrectOption
                                    ? "border-rose-500 bg-rose-500/15 text-rose-900 dark:text-rose-200 line-through"
                                    : "border-line/60 bg-surface text-muted",
                              )}
                            >
                              <span className="text-[11px] font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                              <span className="flex-1">{opt}</span>
                              {isTheCorrectOption && (
                                <span className="text-[10px] font-black uppercase text-emerald-600">
                                  Correct Answer
                                </span>
                              )}
                              {wasUserChoice && !isTheCorrectOption && (
                                <span className="text-[10px] font-black uppercase text-rose-600">
                                  Your Choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Educational Explanation */}
                      {q.explanation && (
                        <div className="mt-4 rounded-2xl bg-surface-raised/40 p-3.5 text-xs text-muted border border-line/60">
                          <p className="font-bold text-ink text-[11px] flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            Historical Context:
                          </p>
                          <p className="mt-1 leading-relaxed text-[11px] text-ink/80">
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Rail: Daily Leaderboard */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-ink">Today's Leaderboard</h3>
              </div>
              <span className="rounded-full bg-raised px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                {leaderboard.length} played
              </span>
            </div>

            {leaderboardLoading ? (
              <div className="py-12 text-center">
                <Spinner className="mx-auto h-6 w-6 text-brand-600" />
                <p className="mt-2 text-xs text-muted">Updating leaderboard…</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Award className="mx-auto h-10 w-10 text-muted/50" />
                <p className="text-xs font-semibold text-ink">No scores posted yet today</p>
                <p className="text-[11px] text-muted">Be the first to complete the quiz and claim Rank #1!</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-line/60">
                {leaderboard.map((entry) => {
                  const isFirst = entry.rank === 1;
                  const isSecond = entry.rank === 2;
                  const isThird = entry.rank === 3;

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between py-3 transition",
                        entry.user.id === user?.id && "bg-brand-500/5 -mx-2 px-2 rounded-xl",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black",
                            isFirst
                              ? "bg-amber-400 text-zinc-950 shadow-sm"
                              : isSecond
                                ? "bg-slate-300 text-zinc-950"
                                : isThird
                                  ? "bg-amber-700 text-white"
                                  : "bg-surface border border-line text-muted",
                          )}
                        >
                          {isFirst ? "🥇" : isSecond ? "🥈" : isThird ? "🥉" : entry.rank}
                        </span>

                        <Avatar
                          src={entry.user.avatarUrl}
                          name={entry.user.displayName}
                          username={entry.user.username}
                          size="xs"
                        />

                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/u/${entry.user.username}`}
                            className="block truncate text-xs font-bold text-ink hover:underline"
                          >
                            {entry.user.displayName}
                          </Link>
                          <p className="truncate text-[10px] text-muted">@{entry.user.username}</p>
                        </div>
                      </div>

                      {/* Score & Time */}
                      <div className="text-right shrink-0 pl-2">
                        <span className="block text-xs font-black text-ink">
                          {entry.score} / 10
                        </span>
                        <span className="block text-[10px] text-muted font-medium">
                          {entry.durationSeconds}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
