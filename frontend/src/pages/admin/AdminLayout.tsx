import { useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  FileText,
  Flag,
  History,
  Laugh,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Moon,
  Shield,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { tt } from "../../lib/i18n";
import { useAuth } from "../../store/auth";
import { useUI } from "../../store/ui";
import { useQuery } from "../../hooks/useApi";
import { ROLE_LABELS, ROLE_PERMISSIONS, type Permission } from "../../lib/rbac";
import type { Role } from "../../types";
import type { AdminMe } from "../../lib/adminTypes";
import { cn } from "../../lib/utils";
import { Avatar, PageLoader, Spinner } from "../../components/ui";
import { BrandMark } from "../../components/Brand";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Monitor",
    items: [
      { to: "/admin/overview", label: "Overview", icon: LayoutDashboard, permission: "admin.dashboard.view" },
    ],
  },
  {
    group: "Moderation",
    items: [
      { to: "/admin/reports", label: "Reports", icon: Flag, permission: "admin.reports.view" },
      { to: "/admin/content", label: "Content", icon: FileText, permission: "admin.content.view" },
    ],
  },
  {
    group: "People",
    items: [
      { to: "/admin/members", label: "Members", icon: Users, permission: "admin.users.view" },
      { to: "/admin/roles", label: "Roles & access", icon: ShieldCheck, permission: "admin.roles.view" },
      { to: "/admin/audit", label: "Audit log", icon: History, permission: "admin.audit.view" },
    ],
  },
  {
    group: "Platform",
    items: [
      { to: "/admin/categories", label: "Rooms", icon: LayoutGrid, permission: "admin.categories.view" },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "admin.announcements.publish" },
      { to: "/admin/events", label: "Events", icon: CalendarDays, permission: "admin.events.view" },
      { to: "/admin/event-sources", label: "Event sources", icon: CalendarClock, permission: "admin.events.view" },
      { to: "/admin/jokes", label: "Joke Time", icon: Laugh, permission: "admin.jokes.view" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((section) => section.items);

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
    isActive
      ? "bg-brand-50/80 text-brand-900 shadow-[inset_0_0_0_1px_rgba(15,107,58,0.08)] dark:bg-brand-500/10 dark:text-brand-100"
      : "text-muted hover:bg-raised/70 hover:text-ink",
  );
}

export function AdminLayout() {
  const user = useAuth((state) => state.user);
  const status = useAuth((state) => state.status);
  const logout = useAuth((state) => state.logout);
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const location = useLocation();
  const navigate = useNavigate();

  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const me = useQuery<AdminMe>("/api/admin/me", { enabled: Boolean(isStaff) });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!isStaff) {
    return <Navigate to="/home" replace />;
  }

  const fallbackPermissions = ROLE_PERMISSIONS[user.role];
  const permissions = me.data?.permissions ?? [...fallbackPermissions];
  const visibleNav = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);

  const current = ALL_ITEMS.find((item) => location.pathname.startsWith(item.to));
  const isDark = theme === "dark";

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line/80 bg-surface/80 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-ink">Addis Gebeta</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Operations
            </p>
          </div>
        </div>

        <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-brand-600/10 bg-brand-50/60 px-3 py-2 dark:border-brand-400/15 dark:bg-brand-500/5">
          <Shield className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
          <span className="text-[11px] font-semibold text-brand-800 dark:text-brand-200">
            {tt(ROLE_LABELS[user.role])} {tt("workspace")}
          </span>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Admin">
          {visibleNav.map((section) => (
            <div key={section.group}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/60">
                {section.group}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {tt(item.label)}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line/80 p-3">
          <Link
            to={`/u/${user.username}`}
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-raised"
          >
            <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-ink">{user.displayName}</span>
              <span className="block truncate text-[10px] text-muted">@{user.username}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-muted transition hover:bg-raised hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line/80 bg-surface/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/65 sm:px-6">
          <Link to="/admin/overview" className="flex items-center gap-2 lg:hidden">
            <BrandMark className="h-7 w-7" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Admin</span>
          </Link>
          <div className="hidden items-center gap-1.5 text-xs text-muted lg:flex">
            <Shield className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
            <span>Administration</span>
            <span className="text-muted/40">/</span>
            <span className="font-semibold text-ink">{current?.label ?? "Overview"}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted transition hover:text-ink"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View community</span>
            </Link>
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="hidden rounded-full bg-raised px-2.5 py-1 text-[10px] font-semibold text-muted sm:inline">
              {tt(ROLE_LABELS[user.role])}
            </span>
            <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="xs" className="ml-1" />
          </div>
        </header>

        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-surface/60 px-3 py-2 lg:hidden">
          {visibleNav.flatMap((section) =>
            section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                    isActive ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "text-muted",
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" /> {tt(item.label)}
              </NavLink>
            )),
          )}
        </div>

        <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 lg:py-9">
          {me.loading && !me.data ? (
            <PageLoader label="Checking your access…" />
          ) : me.error ? (
            <div className="card p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-rose-500" />
              <p className="font-display text-lg font-semibold text-ink">Access unavailable</p>
              <p className="mt-1 text-sm text-muted">{me.error}</p>
            </div>
          ) : current && !permissions.includes(current.permission) ? (
            <div className="card p-8 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-muted" />
              <p className="font-display text-lg font-semibold text-ink">Not available to your role</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
                {tt(current.label)} is limited to higher roles. Ask an administrator if you need access;
                every grant is a deliberate role change, never a hidden switch.
              </p>
              <Link to="/admin/overview" className="btn-secondary btn-sm mt-4">
                Back to overview
              </Link>
            </div>
          ) : (
            <Outlet context={{ permissions, role: user.role }} />
          )}
        </main>
      </div>
    </div>
  );
}

export interface AdminAccess {
  permissions: Permission[];
  role: Role;
}

/** Pages use this to gate controls using the permissions the server reported. */
export function useAdminAccess(): AdminAccess {
  return useOutletContext<AdminAccess>();
}
