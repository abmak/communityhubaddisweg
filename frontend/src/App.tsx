import { lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./store/auth";
import { useUI } from "./store/ui";
import { listenForPushMessages, syncPushSubscription } from "./lib/browserNotifications";
import { AppLayout, ThemeManager } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastViewport } from "./components/ToastViewport";
import { Spinner } from "./components/ui";
import { BrandMark, Wordmark } from "./components/Brand";
import { LandingPage } from "./pages/Landing";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { HomePage } from "./pages/Home";
import { CategoriesPage } from "./pages/Categories";
import { CategoryPage } from "./pages/CategoryPage";
import { PostDetailPage } from "./pages/PostDetail";
import { CreatePostPage } from "./pages/CreatePost";
import { EditPostPage } from "./pages/EditPost";
import { CinemaPage, BooksPage, HikingPage } from "./pages/Collections";
import { MovieDetailPage, BookDetailPage, HikeDetailPage } from "./pages/ReviewDetails";
import { ProfilePage } from "./pages/Profile";
import { FollowListPage } from "./pages/FollowList";
import { MessagesPage, ConversationPage } from "./pages/Messages";
import { NotificationsPage } from "./pages/Notifications";
import { ExplorePage } from "./pages/Explore";
import { PlacesPage } from "./pages/Places";
import { PlaceDetailPage } from "./pages/PlaceDetail";
import { EventsPage } from "./pages/Events";
import { EventDetailPage } from "./pages/EventDetail";
import { SportsPage } from "./pages/Sports";
import { TravelPage } from "./pages/Travel";
import { QuizPage } from "./pages/Quiz";
import { JokesPage } from "./pages/Jokes";
import { SearchPage } from "./pages/Search";
import { BookmarksPage } from "./pages/Bookmarks";
import { SettingsPage } from "./pages/Settings";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminReports } from "./pages/admin/AdminReports";
import { AdminMembers } from "./pages/admin/AdminMembers";
import { AdminContent } from "./pages/admin/AdminContent";
import { AdminRoles } from "./pages/admin/AdminRoles";
import { AdminAudit } from "./pages/admin/AdminAudit";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { AdminAnnouncements } from "./pages/admin/AdminAnnouncements";
import { AdminJokes } from "./pages/admin/AdminJokes";
import { AdminEvents } from "./pages/admin/AdminEvents";
import { AdminEventSources } from "./pages/admin/AdminEventSources";
import { NotFound } from "./pages/NotFound";

const LazyNavigatePage = lazy(() =>
  import("./pages/Navigate").then((module) => ({ default: module.NavigatePage })),
);

const LazyTripSharePage = lazy(() =>
  import("./pages/TripShare").then((module) => ({ default: module.TripSharePage })),
);

function requireAuthNode(children: ReactNode) {
  return <RequireAuth>{children}</RequireAuth>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user);
  const status = useAuth((state) => state.status);
  const location = useLocation();

  if (status !== "ready") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <>{children}</>;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return null;
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <BrandMark className="h-14 w-14" glow />
      <Wordmark />
      <Spinner className="h-5 w-5" />
    </div>
  );
}

/** Keeps this device subscribed on every shell, including the admin workspace. */
function PushNotificationBridge() {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);

  useEffect(() => {
    if (!user) return;
    // Repairs a missing server row after a database restore and creates the
    // subscription on the first signed-in visit after permission is granted.
    void syncPushSubscription();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    return listenForPushMessages((payload) => {
      // The conversation or post is already on screen; no toast is needed.
      if (payload.url === window.location.pathname) return;
      pushToast(payload.body ? `${payload.title} · ${payload.body}` : payload.title, {
        href: payload.url,
      });
    });
  }, [user?.id, pushToast]);

  return null;
}

export default function App() {
  const bootstrap = useAuth((state) => state.bootstrap);
  const status = useAuth((state) => state.status);
  const calendarPreference = useAuth((state) => state.user?.calendarPreference);
  const calendar = useUI((state) => state.calendar);
  const setCalendar = useUI((state) => state.setCalendar);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // A member's saved calendar choice follows them across devices; the local
  // preference keeps guests and instant reloads consistent.
  useEffect(() => {
    if (calendarPreference === "ETHIOPIAN" || calendarPreference === "GREGORIAN") {
      if (calendarPreference !== useUI.getState().calendar) setCalendar(calendarPreference);
    }
  }, [calendarPreference, setCalendar]);

  // Also exposed on <html> so CSS can adapt, and it keeps this component
  // subscribed so a toggle re-renders every date on the page.
  useEffect(() => {
    document.documentElement.dataset.calendar = calendar;
  }, [calendar]);

  if (status === "idle" || status === "loading") {
    return <Splash />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeManager />
        <PushNotificationBridge />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* The admin workspace is intentionally its own shell, not a tab
              inside the community layout. AdminLayout enforces staff access. */}
          <Route
            path="/trip/:token"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-canvas">
                    <Spinner className="h-7 w-7" />
                  </div>
                }
              >
                <LazyTripSharePage />
              </Suspense>
            }
          />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="jokes" element={<AdminJokes />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="event-sources" element={<AdminEventSources />} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/places" element={<PlacesPage />} />
            <Route path="/places/:slug" element={<PlaceDetailPage />} />
            {/* Leaflet and the routing UI are only needed on this screen, so
                they load on demand instead of in the main bundle. */}
            <Route
              path="/navigate"
              element={
                <Suspense
                  fallback={
                    <div className="flex min-h-[50vh] items-center justify-center">
                      <Spinner className="h-7 w-7" />
                    </div>
                  }
                >
                  <LazyNavigatePage />
                </Suspense>
              }
            />
            <Route path="/travel" element={<TravelPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:slug" element={<EventDetailPage />} />
            <Route path="/meetups" element={<EventsPage view="meetups" />} />
            <Route path="/theatre" element={<EventsPage defaultTopic="THEATRE" />} />
            <Route path="/sports" element={<SportsPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/jokes" element={<JokesPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/c/:slug" element={<CategoryPage />} />

            <Route path="/posts/:id" element={<PostDetailPage />} />
            <Route path="/posts/:id/edit" element={requireAuthNode(<EditPostPage />)} />
            <Route path="/create" element={requireAuthNode(<CreatePostPage />)} />

            <Route path="/cinema" element={<CinemaPage />} />
            <Route path="/cinema/:postId" element={<MovieDetailPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:postId" element={<BookDetailPage />} />
            <Route path="/hiking" element={<HikingPage />} />
            <Route path="/hiking/:postId" element={<HikeDetailPage />} />

            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/u/:username/:tab" element={<FollowListPage />} />

            <Route path="/search" element={<SearchPage />} />
            <Route path="/messages" element={requireAuthNode(<MessagesPage />)} />
            <Route path="/messages/:conversationId" element={requireAuthNode(<ConversationPage />)} />
            <Route path="/notifications" element={requireAuthNode(<NotificationsPage />)} />
            <Route path="/bookmarks" element={requireAuthNode(<BookmarksPage />)} />
            <Route path="/settings" element={requireAuthNode(<SettingsPage />)} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
