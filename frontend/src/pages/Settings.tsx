import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Phone,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Media, User } from "../types";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { tt } from "../lib/i18n";
import { cn, formatDate } from "../lib/utils";
import { Avatar, Badge, Modal } from "../components/ui";
import { ImageUploader } from "../components/ImageUploader";
import {
  pauseBrowserNotifications,
  requestBrowserNotifications,
  resumeBrowserNotifications,
  showBrowserNotification,
  unsubscribeFromPush,
  useBrowserNotifications,
} from "../lib/browserNotifications";

type Tab = "profile" | "account" | "privacy" | "danger";

const TABS: Array<{ id: Tab; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "account", label: "Account", icon: KeyRound },
  { id: "privacy", label: "Privacy", icon: Eye },
  { id: "danger", label: "Danger zone", icon: AlertTriangle },
];

function BrowserNotificationsCard() {
  const { supported, pushSupported, permission, enabled } = useBrowserNotifications();
  const pushToast = useUI((state) => state.pushToast);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    try {
      const result = await requestBrowserNotifications();
      if (result === "granted") {
        pushToast("Browser notifications enabled.", { tone: "success" });
      } else if (result === "denied") {
        pushToast("Notifications are blocked. Allow them in your browser's site settings.", {
          tone: "error",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (next: boolean) => {
    if (!next) {
      pauseBrowserNotifications();
      pushToast("Browser notifications paused.");
      return;
    }
    if (permission === "granted") {
      resumeBrowserNotifications();
      pushToast("Browser notifications enabled.", { tone: "success" });
      return;
    }
    void request();
  };

  const test = async () => {
    setBusy(true);
    try {
      const shown = await showBrowserNotification({
        title: "Addis Gebeta",
        body: "Notifications are working. We'll ping you about messages, new events and service updates.",
        url: "/home",
        tag: "notification-test",
        force: true,
      });
      pushToast(shown ? "Test notification sent." : "The browser blocked the test notification.", {
        tone: shown ? "success" : "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <BellRing className="h-4 w-4 text-brand-700 dark:text-brand-300" /> Browser notifications
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Get a desktop or phone notification when a message arrives, a new event is published or
            the community team posts a service update.
          </p>
        </div>
        {supported && permission === "granted" && (
          <Badge tone="brand">{enabled ? "On" : "Paused"}</Badge>
        )}
      </div>

      {!supported ? (
        <p className="mt-4 rounded-xl border border-line bg-raised/40 px-3.5 py-3 text-sm text-muted">
          This browser does not support notifications.
        </p>
      ) : permission === "denied" ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Notifications are blocked for this site. Open your browser's site settings for Addis
          Gebeta, allow notifications, then reload this page.
        </p>
      ) : permission === "granted" ? (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised/40 p-4">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => toggle(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                Send notifications on this device
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                {pushSupported
                  ? "They arrive even when Addis Gebeta is closed. You can pause them here at any time."
                  : "This browser only shows them while Addis Gebeta is open. You can pause them here at any time."}
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => void test()}
            className="btn-secondary btn-sm"
            disabled={busy || !enabled}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellRing className="h-3.5 w-3.5" />
            )}
            Send a test notification
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void request()} className="btn-primary" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            Allow notifications
          </button>
          <p className="text-xs text-muted">
            Your browser will ask for permission. Nothing is sent until you allow it.
          </p>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const logout = useAuth((state) => state.logout);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("profile");

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [interests, setInterests] = useState((user?.interests ?? []).join(", "));
  const [avatarMedia, setAvatarMedia] = useState<Media[]>([]);
  const [coverMedia, setCoverMedia] = useState<Media[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const calendar = useUI((state) => state.calendar);
  const setCalendar = useUI((state) => state.setCalendar);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio ?? "");
    setInterests((user.interests ?? []).join(", "));
    setPhone(user.phone ?? "");
  }, [user]);

  if (!user) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const response = await api.patch<{ user: User }>("/api/users/me", {
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        interests: interests
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 10),
        avatarUrl: avatarMedia[0]?.url ?? user.avatarUrl,
        coverUrl: coverMedia[0]?.url ?? user.coverUrl,
      });
      setUser(response.data.user);
      setAvatarMedia([]);
      setCoverMedia([]);
      pushToast("Profile updated.", { tone: "success" });
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const changeCalendar = async (mode: "GREGORIAN" | "ETHIOPIAN") => {
    setCalendar(mode);
    try {
      const response = await api.patch<{ user: User }>("/api/users/me", {
        calendarPreference: mode,
      });
      setUser(response.data.user);
      pushToast(
        mode === "ETHIOPIAN" ? "Ethiopian calendar enabled." : "Gregorian calendar restored.",
        { tone: "success" },
      );
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    }
  };

  const requestOtp = async (event: FormEvent) => {
    event.preventDefault();
    setPhoneBusy(true);
    try {
      const response = await api.post<{ devCode?: string }>("/api/auth/phone/request", {
        phone: phone.trim(),
      });
      setOtpSent(true);
      setDevCode(response.data.devCode ?? null);
      pushToast("Verification code sent.", { tone: "success" });
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmOtp = async (event: FormEvent) => {
    event.preventDefault();
    setPhoneBusy(true);
    try {
      const response = await api.post<{ user: User }>("/api/auth/phone/confirm", {
        code: otp.trim(),
      });
      setUser(response.data.user);
      setOtp("");
      setOtpSent(false);
      setDevCode(null);
      pushToast("Phone number verified.", { tone: "success" });
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setPhoneBusy(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      pushToast("The new passwords don't match.", { tone: "error" });
      return;
    }
    setPasswordBusy(true);
    try {
      await api.patch("/api/users/me/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast("Password updated.", { tone: "success" });
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setPasswordBusy(false);
    }
  };

  const togglePresence = async (next: boolean) => {
    setUser({ ...user, showPresence: next });
    try {
      await api.patch("/api/users/me", { showPresence: next });
      pushToast(next ? "Presence sharing on." : "Presence sharing off.", { tone: "success" });
    } catch (error) {
      setUser({ ...user, showPresence: !next });
      pushToast(apiError(error), { tone: "error" });
    }
  };

  const deleteAccount = async () => {
    if (!deletePassword) return;
    setDeleteBusy(true);
    try {
      await api.delete("/api/users/me", { data: { password: deletePassword } });
      // The account cascade already removed the server row; drop the local
      // subscription too so this browser cannot be woken for the deleted user.
      await unsubscribeFromPush({ removeServer: false });
      setUser(null);
      setDeleteOpen(false);
      navigate("/");
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
      setDeleteBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
          <span lang="am" className="font-ethiopic normal-case tracking-normal text-muted">
            ቅንብሮች
          </span>
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          Make this place yours.
        </h1>
        <p className="mt-1 text-sm text-muted">Manage your profile, security and privacy preferences.</p>
      </header>

      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-1" aria-label="Settings sections">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  tab === item.id
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
                    : "text-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" /> {tt(item.label)}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-5">
          {tab === "profile" && (
            <form onSubmit={saveProfile} className="card p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Public profile</h2>
              <p className="mt-1 text-sm text-muted">This is how you appear across the community.</p>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="xl" />
                <div className="flex-1">
                  <p className="label">New profile photo</p>
                  <ImageUploader media={avatarMedia} onChange={setAvatarMedia} max={1} label="Upload" />
                </div>
              </div>

              <div className="mt-5">
                <p className="label">Cover image</p>
                {user.coverUrl && coverMedia.length === 0 && (
                  <div className="mb-2 h-20 w-full overflow-hidden rounded-xl bg-raised">
                    <img src={user.coverUrl} alt="Current cover" className="h-full w-full object-cover" />
                  </div>
                )}
                <ImageUploader media={coverMedia} onChange={setCoverMedia} max={1} label="Upload cover" />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="settings-name" className="label">Display name</label>
                  <input
                    id="settings-name"
                    className="input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="settings-username" className="label">Username</label>
                  <input id="settings-username" className="input opacity-70" value={user.username} disabled />
                  <p className="mt-1 text-[10px] text-muted">Usernames cannot be changed.</p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="settings-bio" className="label">Bio</label>
                  <textarea
                    id="settings-bio"
                    className="input resize-y"
                    rows={3}
                    maxLength={400}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="A few words about you…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="settings-interests" className="label">Interests</label>
                  <input
                    id="settings-interests"
                    className="input"
                    value={interests}
                    onChange={(event) => setInterests(event.target.value)}
                    placeholder="Ethiopian cinema, hiking, coffee"
                  />
                  <p className="mt-1 text-[10px] text-muted">Comma separated, up to 10.</p>
                </div>
              </div>

              <div className="mt-5 flex justify-end border-t border-line pt-4">
                <button type="submit" className="btn-primary" disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save profile
                </button>
              </div>
            </form>
          )}

          {tab === "account" && (
            <div className="space-y-5">
              <section className="card p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-ink">Account</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Email</dt>
                    <dd className="font-medium text-ink">{user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Username</dt>
                    <dd className="font-medium text-ink">@{user.username}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Member since</dt>
                    <dd className="font-medium text-ink">
                      {user.createdAt ? formatDate(user.createdAt) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Role</dt>
                    <dd className="font-medium capitalize text-ink">{user.role.toLowerCase()}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                  <LinkButton />
                </div>
              </section>

              <section className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                      <Phone className="h-4 w-4" /> Phone verification
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Verify a phone number to secure account recovery.
                    </p>
                  </div>
                  {user.phoneVerifiedAt && (
                    <Badge tone="brand">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="settings-phone" className="label">Phone number</label>
                    <input
                      id="settings-phone"
                      type="tel"
                      className="input"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+251911234567"
                    />
                    {user.phone && (
                      <p className="mt-1 text-[11px] text-muted">
                        Current: {user.phone}
                        {user.phoneVerifiedAt ? " (verified)" : " (not verified)"}
                      </p>
                    )}
                  </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={requestOtp}
                      className="btn-secondary btn-sm"
                      disabled={phoneBusy || !phone}
                    >
                      {phoneBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                      Send verification code
                    </button>
                  ) : (
                    <form onSubmit={confirmOtp} className="space-y-2">
                      <p className="text-xs text-muted">
                        Enter the 6-digit code we sent to {phone}.
                        {devCode && (
                          <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                            Dev code: {devCode}
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <input
                          className="input max-w-[160px] tracking-[0.4em]"
                          value={otp}
                          onChange={(event) => setOtp(event.target.value)}
                          maxLength={6}
                          inputMode="numeric"
                          placeholder="123456"
                        />
                        <button type="submit" className="btn-primary btn-sm" disabled={phoneBusy}>
                          {phoneBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Confirm
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <KeyRound className="h-4 w-4" /> Change password
                </h2>
                <form onSubmit={changePassword} className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="current-password" className="label">Current password</label>
                    <input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      className="input"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className="label">New password</label>
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      className="input"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="label">Confirm new password</label>
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      className="input"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPassword ? "Hide passwords" : "Show passwords"}
                    </button>
                    <button type="submit" className="btn-primary btn-sm" disabled={passwordBusy}>
                      {passwordBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Update password
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-5">
              <section className="card p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-ink">Presence</h2>
                <p className="mt-1 text-sm text-muted">
                  Control whether other members can see when you're online.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised/40 p-4">
                  <input
                    type="checkbox"
                    checked={Boolean(user.showPresence)}
                    onChange={(event) => void togglePresence(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Show my online status</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">
                      When off, other members see you as offline. You can still use messages normally.
                    </span>
                  </span>
                </label>
              </section>

              <BrowserNotificationsCard />

              <section className="card p-5 sm:p-6">
                <h2 className="font-display text-lg font-semibold text-ink">Appearance</h2>
                <p className="mt-1 text-sm text-muted">Choose how አዲስ ገበታ looks on this device.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { id: "light" as const, label: "Light", icon: Sun },
                    { id: "dark" as const, label: "Dark", icon: Moon },
                    { id: "system" as const, label: "System", icon: Monitor },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-xs font-medium transition",
                          theme === option.id
                            ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
                            : "border-line text-muted hover:border-brand-300 hover:text-ink",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {tt(option.label)}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <CalendarDays className="h-4 w-4 text-brand-700 dark:text-brand-300" /> Calendar
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Show Ethiopian (Ge'ez) dates — መስከረም, ጥቅምት, ኅዳር — alongside Gregorian ones across the
                  community. Your choice is saved to your account.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    { id: "GREGORIAN" as const, label: "Gregorian", hint: "23 Oct 2026" },
                    { id: "ETHIOPIAN" as const, label: "Ethiopian (Ge'ez)", hint: "ጥቅምት 13, 2019 · 23 Oct 2026" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void changeCalendar(option.id)}
                      aria-pressed={calendar === option.id}
                      className={cn(
                        "rounded-xl border px-3.5 py-3 text-left transition",
                        calendar === option.id
                          ? "border-brand-600 bg-brand-50 dark:bg-brand-500/10"
                          : "border-line hover:border-brand-300",
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{tt(option.label)}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 text-xs text-muted">
                  Preview · {formatDate(new Date())}
                </p>
              </section>
            </div>
          )}

          {tab === "danger" && (
            <section className="card border-rose-200 p-5 dark:border-rose-500/30 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4" /> Delete account
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Deleting your account permanently removes your profile, posts, comments, messages and
                uploads. This cannot be undone.
              </p>
              <button type="button" className="btn-danger mt-4" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete my account
              </button>
            </section>
          )}
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This is permanent. Your conversations will be removed along with your profile."
      >
        <label className="label" htmlFor="delete-password">Confirm your password</label>
        <input
          id="delete-password"
          type="password"
          className="input"
          value={deletePassword}
          onChange={(event) => setDeletePassword(event.target.value)}
          autoComplete="current-password"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setDeleteOpen(false)}>
            Keep my account
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={deleteAccount}
            disabled={deleteBusy || !deletePassword}
          >
            {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete permanently
          </button>
        </div>
      </Modal>

    </div>
  );
}

function LinkButton() {
  return (
    <a href="/notifications" className="btn-ghost btn-sm">
      <Eye className="h-3.5 w-3.5" /> Notification centre
    </a>
  );
}
