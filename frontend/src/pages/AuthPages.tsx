import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { cn } from "../lib/utils";
import { BrandMark, Wordmark } from "../components/Brand";
import coffeeTalkTile from "../assets/rooms/coffee-talk.webp";
import booksTile from "../assets/rooms/books.webp";
import hikingTile from "../assets/rooms/hiking.webp";

const SIDEBAR_TILES = [
  { src: coffeeTalkTile, alt: "Ethiopian coffee ceremony — jebena poured into small cups" },
  { src: booksTile, alt: "Shelves of biography volumes in a reading room" },
  { src: hikingTile, alt: "Highland escarpment and trails in the Simien Mountains" },
];

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(45,212,191,0.28),transparent_55%),radial-gradient(90%_90%_at_100%_100%,rgba(245,158,11,0.22),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-20 top-1/3 h-72 w-72 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-8 top-1/3 h-48 w-48 rounded-full border border-white/10"
        />

        <Link to="/" className="relative flex items-center gap-3">
          <BrandMark className="h-11 w-11" glow />
          <span className="[&_span]:text-white">
            <Wordmark subtitle="Addis Weg · Addis Ababa" />
          </span>
        </Link>
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-2 opacity-40" />

        <div className="relative my-auto max-w-lg">
          <Sparkles className="mb-6 h-6 w-6 text-accent-300" />
          <p lang="am" className="font-ethiopic text-2xl leading-relaxed text-accent-200">
            “ቡና ሲጠጡ ወዳጅ ይሆናሉ።”
          </p>
          <p className="mt-3 font-display text-[2.1rem] font-medium leading-[1.15] tracking-tight">
            “Share a cup, and strangers become friends.” The best conversations stay with you on the
            walk home.
          </p>
          <p className="mt-6 text-sm text-white/60">
            Films, books, trails, football, coffee — and the people who love them.
          </p>

          <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/70">
            {["Ethiopian cinema", "Book reviews", "Hiking logs", "Coffee talk", "Sports"].map((tag) => (
              <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                {tag}
              </span>
            ))}
          </div>

          <figure className="relative mt-8 overflow-hidden rounded-2xl border border-white/10 shadow-lift">
            <div className="grid grid-cols-3 gap-px bg-white/10">
              {SIDEBAR_TILES.map((tile) => (
                <img
                  key={tile.src}
                  src={tile.src}
                  alt={tile.alt}
                  className="h-32 w-full object-cover"
                  width={640}
                  height={640}
                  loading="lazy"
                />
              ))}
            </div>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/25 to-transparent"
            />
            <figcaption className="absolute inset-x-3 bottom-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              <span lang="am" className="font-ethiopic normal-case tracking-normal text-accent-200">
                የወግ ጊዜ
              </span>
              <span className="text-white/30">·</span>
              coffee, books & trails
            </figcaption>
          </figure>
        </div>

        <p className="relative text-xs text-white/40">
          አዲስ ወግ · Addis Weg — built for curious people, with care.
        </p>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="h-10 w-10" />
            <Wordmark />
          </Link>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>
          <div className="mt-6 text-sm text-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  hint,
  htmlFor,
}: {
  label: string;
  icon: typeof Mail;
  children: ReactNode;
  hint?: string;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        {children}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      {message}
    </div>
  );
}

export function LoginPage() {
  const login = useAuth((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/home";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setIdentifier("selam@communityhub.et");
    setPassword("Password123!");
    setError(null);
  };

  return (
    <AuthShell
      title="እንኳን ደህና መጡ · Welcome back."
      subtitle="Sign in to pick up the conversations you left off around the table."
      footer={
        <p>
          New to the community?{" "}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />

        <Field label="Email, username or phone" icon={AtSign} htmlFor="login-identifier">
          <input
            id="login-identifier"
            className="input pl-10"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@addisweg.et"
            required
          />
        </Field>

        <Field label="Password" icon={Lock} htmlFor="login-password">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            className="input px-10"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowReset((value) => !value)}
            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Forgot your password?
          </button>
          <span className="text-[11px] text-muted">Secure HttpOnly session</span>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Sign in
        </button>
      </form>

      {showReset && <PasswordResetPanel onDone={() => setShowReset(false)} />}

      <div className="mt-6 rounded-xl border border-dashed border-line bg-raised/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink">Just looking around?</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              A seeded member account with sample stories, messages and notifications.
            </p>
          </div>
          <button type="button" onClick={useDemo} className="btn-secondary btn-sm shrink-0">
            Use demo
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

function PasswordResetPanel({ onDone }: { onDone: () => void }) {
  const pushToast = useUI((state) => state.pushToast);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stage, setStage] = useState<"request" | "reset" | "done">("request");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ devCode?: string; message: string }>("/api/auth/password/forgot", {
        phone: phone.trim(),
      });
      setDevCode(response.data.devCode ?? null);
      setStage("reset");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/password/reset", {
        phone: phone.trim(),
        code: code.trim(),
        newPassword,
      });
      setStage("done");
      pushToast("Password updated. You can sign in now.", { tone: "success" });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-brand-700" />
        <h2 className="text-sm font-semibold text-ink">Reset your password by SMS</h2>
      </div>
      <FormError message={error} />

      {stage === "request" && (
        <form onSubmit={request} className="space-y-3">
          <input
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number, e.g. +251911234567"
            pattern="^\+[1-9][0-9]{7,14}$"
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
              Send code
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={onDone}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {stage === "reset" && (
        <form onSubmit={reset} className="space-y-3">
          <p className="text-xs leading-5 text-muted">
            Enter the 6-digit code sent to {phone}.
            {devCode && (
              <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-1 font-mono text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Dev code: {devCode}
              </span>
            )}
          </p>
          <input
            className="input tracking-[0.4em]"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            maxLength={6}
            inputMode="numeric"
            required
          />
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password (8+ characters)"
            minLength={8}
            required
          />
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Update password
          </button>
        </form>
      )}

      {stage === "done" && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Your password has been updated.
          </p>
          <button type="button" className="btn-secondary btn-sm" onClick={onDone}>
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

export function RegisterPage() {
  const register = useAuth((state) => state.register);
  const navigate = useNavigate();
  const pushToast = useUI((state) => state.pushToast);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
      });
      pushToast("እንኳን ደህና መጡ! Welcome to Addis Weg — say hello in the feed.", { tone: "success" });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Find your table."
      subtitle="Join አዲስ ወግ and share the films, books, trails and everyday stories you love — with photos, voice notes and good replies."
      footer={
        <p>
          Already a member?{" "}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" icon={UserIcon} htmlFor="register-name">
            <input
              id="register-name"
              className="input pl-10"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Selam Tesfaye"
              autoComplete="name"
              minLength={2}
              maxLength={50}
              required
            />
          </Field>
          <Field label="Username" icon={AtSign} htmlFor="register-username">
            <input
              id="register-username"
              className="input pl-10"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="selam"
              autoComplete="username"
              pattern="[a-z0-9_]{3,24}"
              minLength={3}
              maxLength={24}
              required
            />
          </Field>
        </div>

        <Field label="Email" icon={Mail} htmlFor="register-email">
          <input
            id="register-email"
            type="email"
            className="input pl-10"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label="Phone (optional)"
          icon={Phone}
          htmlFor="register-phone"
          hint="Add a phone number to enable SMS verification and password recovery."
        >
          <input
            id="register-phone"
            type="tel"
            className="input pl-10"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+251911234567"
            autoComplete="tel"
            pattern="^\+[1-9][0-9]{7,14}$"
          />
        </Field>

        <Field label="Password" icon={Lock} htmlFor="register-password" hint="At least 8 characters.">
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            className="input px-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Choose a strong password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        <p className="text-[11px] leading-5 text-muted">
          By joining you agree to keep this place generous and respectful. You can delete your
          account at any time from Settings.
        </p>

        <button type="submit" className={cn("btn-primary w-full", busy && "opacity-80")} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Create my account
        </button>
      </form>
    </AuthShell>
  );
}
