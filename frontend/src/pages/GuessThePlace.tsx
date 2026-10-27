import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Camera,
  MapPin,
  Medal,
  Share2,
  AlertTriangle,
  Crown,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import type {
  PlaceQuizTodayResponse,
  PlaceQuizLeaderboardResponse,
  PlaceQuizSubmitResponse,
  PlaceQuizQuestionItem,
  PlaceQuizLeaderboardItem,
  PlaceQuizWinner,
} from "../types";
import { Avatar, Spinner } from "../components/ui";
import { cn } from "../lib/utils";

const TOTAL_TIME_SECONDS = 150;

function formatDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PhotoCredit({ question }: { question: PlaceQuizQuestionItem }) {
  const text = `Photo: ${question.imageCredit || "Wikimedia Commons"} · ${
    question.imageLicense || "free licence"
  } · Wikimedia Commons`;

  if (!question.imagePageUrl) {
    return <p className="mt-2 text-[10px] text-muted">{text}</p>;
  }

  return (
    <a
      href={question.imagePageUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-2 inline-block text-[10px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
    >
      {text}
    </a>
  );
}

export function GuessThePlace() {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [mode, setMode] = useState<"LOBBY" | "PLAYING" | "REVIEW">("LOBBY");
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<PlaceQuizTodayResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlaceQuizLeaderboardItem[]>([]);
  const [winners, setWinners] = useState<PlaceQuizWinner[]>([]);
  const [today, setToday] = useState("");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(Array(10).fill(-1));
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_TIME_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);
  const answersRef = useRef<number[]>(Array(10).fill(-1));
  const [resultReview, setResultReview] = useState<PlaceQuizSubmitResponse | null>(null);

  const loadToday = async () => {
    try {
      setLoading(true);
      const res = await api.get<PlaceQuizTodayResponse>("/api/place-quiz/today");
      setQuizData(res.data);
      if (res.data.alreadyCompleted) setMode("REVIEW");
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const res = await api.get<PlaceQuizLeaderboardResponse>("/api/place-quiz/leaderboard");
      setLeaderboard(res.data.leaderboard);
      setWinners(res.data.winners);
      setToday(res.data.today);
    } catch (err) {
      console.warn("Could not fetch the Guess the Place leaderboard", err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    void loadToday();
    void loadLeaderboard();
  }, []);

  useEffect(() => {
    answersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  useEffect(() => {
    if (mode !== "PLAYING") return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void submitQuiz(answersRef.current, TOTAL_TIME_SECONDS * 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode]);

  const handleStart = () => {
    if (!user) {
      pushToast("Please sign in to play the daily photo challenge and join the leaderboard!");
      navigate("/login");
      return;
    }
    if (!quizData || quizData.questions.length === 0) {
      pushToast("The photo challenge is being prepared. Please try again shortly.", { tone: "error" });
      return;
    }

    setSelectedAnswers(Array(10).fill(-1));
    answersRef.current = Array(10).fill(-1);
    setCurrentIndex(0);
    setSecondsRemaining(TOTAL_TIME_SECONDS);
    startTimeRef.current = Date.now();
    setResultReview(null);
    setMode("PLAYING");
  };

  const handleSelect = (optionIndex: number) => {
    setSelectedAnswers((prev) => {
      const copy = [...prev];
      copy[currentIndex] = optionIndex;
      answersRef.current = copy;
      return copy;
    });
  };

  const submitQuiz = async (answers: number[], durationMs: number) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const sanitized = answers.map((answer) => (answer >= 0 && answer <= 3 ? answer : 0));
      const res = await api.post<PlaceQuizSubmitResponse>("/api/place-quiz/submit", {
        answers: sanitized,
        durationMs,
      });

      setResultReview(res.data);
      setMode("REVIEW");
      void loadLeaderboard();
      pushToast(`Photo challenge complete! You scored ${res.data.score}/10 📸`, {
        tone: "success",
      });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
      void loadToday();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const elapsed = Date.now() - startTimeRef.current;
    void submitQuiz(selectedAnswers, Math.min(TOTAL_TIME_SECONDS * 1000, elapsed));
  };

  const handleShare = () => {
    const score = resultReview?.score ?? quizData?.score ?? 0;
    const text = `I scored ${score}/10 in today's Guess the Place photo challenge on Addis Gebeta! Can you name these Ethiopian heritage sites? 🇪🇹`;
    if (navigator.share) {
      void navigator.share({ title: "Guess the Place · Addis Gebeta", text, url: window.location.href });
    } else {
      void navigator.clipboard.writeText(text);
      pushToast("Score copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-xs text-muted">Loading today's photo challenge…</p>
      </div>
    );
  }

  const questions = quizData?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = selectedAnswers.filter((answer) => answer !== -1).length;
  const timerPercentage = (secondsRemaining / TOTAL_TIME_SECONDS) * 100;
  const noQuestions = questions.length === 0;

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-emerald-950 via-zinc-950 to-amber-950 p-6 text-white shadow-lift sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Camera className="h-4 w-4 text-emerald-300" />
              <span>Guess the Place</span>
              <span className="font-ethiopic text-[11px] text-emerald-200">· ስፍራ እንገምት</span>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Ethiopian Heritage in Pictures
            </h1>

            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              Ten photographs of Ethiopia's churches, mountains, lakes, food, crafts and festivals every
              day. Name the place or treasure before the clock runs out — 150 seconds for all ten.
            </p>
          </div>

          {mode === "LOBBY" && !quizData?.alreadyCompleted && (
            <button
              type="button"
              onClick={handleStart}
              disabled={noQuestions}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-7 py-4 text-sm font-black text-emerald-950 shadow-glow transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start md:self-auto"
            >
              <Sparkles className="h-5 w-5" />
              <span>Start Today's Challenge</span>
            </button>
          )}

          {mode === "REVIEW" && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Score</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* LOBBY */}
          {mode === "LOBBY" && !quizData?.alreadyCompleted && (
            <div className="space-y-6 rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
              <h2 className="text-lg font-bold text-ink">How the photo challenge works</h2>

              {noQuestions ? (
                <div className="rounded-2xl border border-line bg-surface-raised/40 p-6 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm font-semibold text-ink">The photo collection is being prepared</p>
                  <p className="mt-1 text-xs text-muted">Please check back in a moment.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                      <div className="w-fit rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                        <Camera className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 text-xs font-bold text-ink">10 Photos a Day</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        A fresh set from a growing collection of Ethiopian heritage, culture and tradition
                        photographs.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                      <div className="w-fit rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                        <Clock className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 text-xs font-bold text-ink">150 Seconds</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        One continuous countdown. Faster finishes break ties on the leaderboard.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line/60 bg-surface-raised/40 p-4">
                      <div className="w-fit rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-400">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 text-xs font-bold text-ink">Daily Champions</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Ranked by score, then time. Each day's winner is crowned on the champions board.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Fair play
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      Every member receives the exact same ten photos today. Once you start, the timer
                      runs continuously until you submit or time runs out.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStart}
                    className="w-full rounded-2xl bg-brand-700 py-3.5 text-center text-sm font-bold text-white shadow-lift transition hover:bg-brand-600"
                  >
                    I'm Ready · Start 150s Challenge
                  </button>
                </>
              )}
            </div>
          )}

          {/* PLAYING */}
          {mode === "PLAYING" && currentQuestion && (
            <div className="space-y-6">
              <div className="sticky top-16 z-30 overflow-hidden rounded-2xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-ink">
                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                      Photo {currentIndex + 1} of {questions.length}
                    </span>
                    <span className="text-[11px] text-muted">({answeredCount}/10 answered)</span>
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1 font-mono text-sm font-black transition",
                      secondsRemaining <= 15
                        ? "animate-pulse bg-rose-500 text-white"
                        : secondsRemaining <= 45
                          ? "bg-amber-500 text-zinc-950"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span>{secondsRemaining}s</span>
                  </div>
                </div>

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

              <div className="rounded-3xl border border-line bg-surface p-5 shadow-lift sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {currentQuestion.category}
                  </span>
                  {currentQuestion.region && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                      <MapPin className="h-3 w-3" />
                      {currentQuestion.region}
                    </span>
                  )}
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-line/70 bg-zinc-950/5 dark:bg-black/40">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Photo for question ${currentIndex + 1}`}
                    className="mx-auto max-h-[440px] w-full object-contain"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <PhotoCredit question={currentQuestion} />

                <h2 className="mt-4 text-base font-bold leading-relaxed text-ink sm:text-lg">
                  {currentQuestion.prompt}
                </h2>

                <div className="mt-6 space-y-3">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = selectedAnswers[currentIndex] === optionIndex;
                    const letter = String.fromCharCode(65 + optionIndex);

                    return (
                      <button
                        key={`${option}-${optionIndex}`}
                        type="button"
                        onClick={() => handleSelect(optionIndex)}
                        className={cn(
                          "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left text-xs font-semibold transition active:scale-[0.99]",
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 text-ink shadow-sm ring-1 ring-emerald-500/30"
                            : "border-line bg-surface-raised/30 text-ink hover:border-line hover:bg-surface-raised",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                            isSelected
                              ? "bg-emerald-500 font-black text-emerald-950"
                              : "border border-line bg-surface text-muted",
                          )}
                        >
                          {letter}
                        </span>
                        <span className="leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>

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

                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmit}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-glow hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {submitting && <Spinner className="h-3.5 w-3.5" />}
                      <span>Submit Answers</span>
                    </button>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                  {questions.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        "h-7 w-7 rounded-lg text-[11px] font-bold transition",
                        currentIndex === index
                          ? "bg-brand-700 text-white ring-2 ring-brand-500/40"
                          : selectedAnswers[index] !== -1
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "border border-line bg-surface text-muted",
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* REVIEW */}
          {mode === "REVIEW" && (
            <div className="space-y-6">
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-6 text-center shadow-lift sm:p-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-glow">
                  <Camera className="h-8 w-8" />
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
                    {(resultReview?.score ?? quizData?.score ?? 0) >= 8
                      ? "A true guide to Ethiopia's heritage! 🇪🇹"
                      : (resultReview?.score ?? quizData?.score ?? 0) >= 5
                        ? "Great eye! Review the places below and come back tomorrow."
                        : "Every photo is a place to discover — the review below shows the answers."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 border-t border-line/60 pt-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>
                      Time:{" "}
                      <strong className="text-ink">
                        {Math.round((resultReview?.durationMs ?? quizData?.durationMs ?? 0) / 1000)}
                      </strong>{" "}
                      / 150s
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-muted">
                    <Medal className="h-4 w-4 text-amber-500" />
                    <span>
                      Rank Today:{" "}
                      <strong className="text-ink">
                        #{resultReview?.rank ?? quizData?.rank ?? 1}
                      </strong>{" "}
                      of {resultReview?.totalParticipants ?? quizData?.totalParticipants ?? 1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Photo answers & places
                </h3>

                {(resultReview?.review ?? quizData?.questions ?? []).map((question, index) => {
                  const isCorrect = Boolean(question.isCorrect);
                  return (
                    <div
                      key={question.id}
                      className={cn(
                        "rounded-3xl border p-5 transition sm:p-6",
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
                              isCorrect ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
                            )}
                          >
                            {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </span>
                          <span className="text-xs font-bold text-ink">
                            Photo {index + 1} · {question.category}
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

                      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                        <img
                          src={question.imageUrl}
                          alt=""
                          className="h-40 w-full rounded-2xl border border-line/70 object-cover sm:h-32 sm:w-44"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-relaxed text-ink">
                            {question.prompt}
                          </p>
                          {question.region && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                              <MapPin className="h-3 w-3" />
                              {question.region}
                            </p>
                          )}
                          <p className="mt-2 text-xs font-bold text-ink">
                            Answer: <span className="text-emerald-700 dark:text-emerald-400">{question.answer}</span>
                          </p>
                          <PhotoCredit question={question} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                        {question.options.map((option, optionIndex) => {
                          const isTheCorrectOption = optionIndex === question.correctIndex;
                          const wasUserChoice = optionIndex === question.userAnswer;

                          return (
                            <div
                              key={`${option}-${optionIndex}`}
                              className={cn(
                                "flex items-center gap-2.5 rounded-xl border p-2.5 font-medium transition",
                                isTheCorrectOption
                                  ? "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-900 dark:text-emerald-200"
                                  : wasUserChoice && !isTheCorrectOption
                                    ? "border-rose-500 bg-rose-500/15 text-rose-900 line-through dark:text-rose-200"
                                    : "border-line/60 bg-surface text-muted",
                              )}
                            >
                              <span className="text-[11px] font-bold">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              <span className="flex-1">{option}</span>
                              {isTheCorrectOption && (
                                <span className="text-[10px] font-black uppercase text-emerald-600">
                                  Correct
                                </span>
                              )}
                              {wasUserChoice && !isTheCorrectOption && (
                                <span className="text-[10px] font-black uppercase text-rose-600">
                                  Your choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {question.explanation && (
                        <div className="mt-4 rounded-2xl border border-line/60 bg-surface-raised/40 p-3.5 text-xs text-muted">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            About this place
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-ink/80">
                            {question.explanation}
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

        {/* Leaderboard rail */}
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
              <div className="space-y-2 py-10 text-center">
                <Medal className="mx-auto h-10 w-10 text-muted/50" />
                <p className="text-xs font-semibold text-ink">No photo scores yet today</p>
                <p className="text-[11px] text-muted">
                  Finish the challenge to become today's first champion.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-line/60">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between py-3 transition",
                      entry.user.id === user?.id && "-mx-2 rounded-xl bg-brand-500/5 px-2",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black",
                          entry.rank === 1
                            ? "bg-amber-400 text-zinc-950 shadow-sm"
                            : entry.rank === 2
                              ? "bg-slate-300 text-zinc-950"
                              : entry.rank === 3
                                ? "bg-amber-700 text-white"
                                : "border border-line bg-surface text-muted",
                        )}
                      >
                        {entry.rank === 1
                          ? "🥇"
                          : entry.rank === 2
                            ? "🥈"
                            : entry.rank === 3
                              ? "🥉"
                              : entry.rank}
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

                    <div className="shrink-0 pl-2 text-right">
                      <span className="block text-xs font-black text-ink">{entry.score} / 10</span>
                      <span className="block text-[10px] font-medium text-muted">
                        {entry.durationSeconds}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 shadow-lift">
            <div className="flex items-center gap-2 border-b border-line pb-4">
              <Crown className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-bold text-ink">Recent Champions</h3>
            </div>

            {winners.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-muted">
                The first daily champion will be crowned here today.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {winners.map((winner) => (
                  <div key={winner.day} className="flex items-center gap-3">
                    <Avatar
                      src={winner.user.avatarUrl}
                      name={winner.user.displayName}
                      username={winner.user.username}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/u/${winner.user.username}`}
                        className="block truncate text-xs font-bold text-ink hover:underline"
                      >
                        {winner.user.displayName}
                      </Link>
                      <p className="text-[10px] text-muted">
                        {winner.day === today ? "Today" : formatDay(winner.day)} · {winner.score}/10 ·{" "}
                        {winner.durationSeconds}s
                      </p>
                    </div>
                    <Crown className="h-4 w-4 shrink-0 text-amber-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-muted">
            Photos of Ethiopian heritage, culture and tradition are freely licensed Wikimedia Commons
            images. Each photo credits its author and licence in the game.
          </p>
        </div>
      </div>
    </div>
  );
}
