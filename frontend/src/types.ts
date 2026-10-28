export type Role = "USER" | "MODERATOR" | "ADMIN";
export type CategoryKind = "DISCUSSION" | "MOVIE" | "BOOK" | "HIKE";
export type Difficulty = "EASY" | "MODERATE" | "HARD" | "EXPERT";
export type PlaceKind =
  | "CINEMA"
  | "THEATRE"
  | "HOTEL"
  | "HIKING"
  | "CAFE"
  | "RESTAURANT"
  | "GYM"
  | "STADIUM"
  | "GALLERY"
  | "LIBRARY"
  | "HOSPITAL"
  | "PHARMACY"
  | "GAS_STATION"
  | "SCHOOL"
  | "PUBLIC_TOILET"
  | "PARKING"
  | "EV_CHARGING"
  | "TRANSIT_STOP"
  | "BANK"
  | "ATM";

export interface Place {
  id: string;
  slug: string;
  name: string;
  kind: PlaceKind;
  city: string;
  area: string | null;
  address: string | null;
  description: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  priceLevel: number | null;
  tags: string[];
  highlight: string | null;
  featured: boolean;
  distanceKm: number | null;
}

export interface PlaceDetailResponse {
  place: Place;
  nearby: Place[];
}

export interface PlacesResponse {
  places: Place[];
  filters: {
    kinds: { kind: PlaceKind; count: number }[];
    cities: string[];
    total: number;
    origin: { lat: number; lng: number } | null;
  };
}

/** A neighbourhood centroid used when the device cannot share GPS. */
export interface PlaceArea {
  city: string;
  area: string;
  lat: number;
  lng: number;
  count: number;
}

export interface PlaceAreasResponse {
  areas: PlaceArea[];
}

/** Closest practical stops around a pin, grouped by service kind. */
export interface NearbyServiceGroup {
  kind: PlaceKind;
  places: Place[];
  nearestKm: number | null;
}

export interface NearbyServicesResponse {
  origin: { lat: number; lng: number };
  radiusKm: number;
  groups: NearbyServiceGroup[];
  total: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  role: Role;
  calendarPreference?: "GREGORIAN" | "ETHIOPIAN";
  showPresence?: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  email?: string;
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  online?: boolean;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isMe?: boolean;
  banned?: boolean;
  postCount?: number;
  followerCount?: number;
  _count?: { posts?: number; followers?: number; following?: number };
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  sortOrder: number;
  postCount?: number;
  lastPostAt?: string | null;
}

export interface Media {
  id: string;
  kind: "IMAGE" | "AUDIO";
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface MovieDetail {
  id?: string;
  movieTitle: string;
  director: string | null;
  year: number | null;
  genre: string | null;
  synopsis: string | null;
  trailerUrl: string | null;
  posterUrl: string | null;
}

export interface BookDetail {
  id?: string;
  bookTitle: string;
  author: string | null;
  genre: string | null;
  synopsis: string | null;
  coverUrl: string | null;
}

export interface HikeDetail {
  id?: string;
  location: string;
  difficulty: Difficulty;
  distanceKm: number | null;
  durationHours: number | null;
  tips: string | null;
}

export interface PollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  question: string;
  allowMultiple: boolean;
  endsAt: string | null;
  totalVotes: number;
  options: PollOption[];
  myOptionId: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  categoryId: string;
  title: string | null;
  body: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: User;
  category: Category;
  media: Media[];
  movie: MovieDetail | null;
  book: BookDetail | null;
  hike: HikeDetail | null;
  poll: Poll | null;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  ratingAvg: number | null;
  reviewCount: number;
  isEdited: boolean;
}

export type JokeSessionStatus = "OPEN" | "UPCOMING" | "CLOSED";

export interface Joke {
  id: string;
  sessionId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  score: number;
  author: User;
}

export interface JokeSession {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  status: JokeSessionStatus;
  jokeCount: number;
}

export interface JokeFeedResponse {
  session: JokeSession | null;
  upcoming: {
    id: string;
    title: string;
    opensAt: string;
    closesAt: string;
  } | null;
  jokes: Joke[];
  winner: Joke | null;
  canPost: boolean;
}

export interface JokeComment {
  id: string;
  jokeId: string;
  body: string;
  createdAt: string;
  author: User;
}

export interface AdminJokeSession {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  createdAt: string;
  jokeCount: number;
  status: JokeSessionStatus;
  createdBy?: User | null;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  depth: number;
  author: User | null;
  replies: Comment[];
}

export interface Review {
  id: string;
  postId: string;
  userId: string;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface RatingStats {
  average: number | null;
  count: number;
  distribution: Record<string, number>;
}

export interface AppNotification {
  id: string;
  type:
    | "POST_LIKE"
    | "COMMENT"
    | "REPLY"
    | "COMMENT_LIKE"
    | "FOLLOW"
    | "MESSAGE"
    | "ANNOUNCEMENT"
    | "MOVIE_REVIEW"
    | "BOOK_REVIEW"
    | "EVENT_REMINDER";
  body: string;
  url?: string | null;
  postId: string | null;
  conversationId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: User | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  readAt: string | null;
  createdAt: string;
  sender: User;
  media: Media[];
  replyTo: {
    id: string;
    body: string | null;
    deletedAt: string | null;
    senderId: string;
    sender: { id: string; username: string; displayName: string };
  } | null;
}

export interface Conversation {
  id: string;
  lastMessageAt: string;
  createdAt?: string;
  otherUser: User;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  hasMore: boolean;
  total?: number;
}

export interface ExploreData {
  trending: Post[];
  categories: Category[];
  suggestedUsers: User[];
  announcements: Post[];
  movies: Post[];
  books: Post[];
  hikes: Post[];
  stats: { members: number; posts: number; categories: number };
}

export interface PostsResponse {
  posts: Post[];
  nextCursor: string | null;
  meta?: PageMeta;
}

export type RsvpStatus = "GOING" | "INTERESTED";

export interface EventAttendee {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export type EventKind = "EVENT" | "MEETUP";

export type EventTopic =
  | "FESTIVAL"
  | "CINEMA"
  | "THEATRE"
  | "SOCIAL"
  | "TRAVEL"
  | "HIKING"
  | "BUSINESS"
  | "SEASONAL"
  | "MUSIC"
  | "SPORTS"
  | "COMMUNITY"
  | "OTHER";

/** A feed that publishes events automatically (sports league, cinema, RSS). */
export interface EventSourceSummary {
  id: string;
  key: string;
  name: string;
  adapter: "SPORTS_API" | "TELEGRAM" | "RSS" | "GEMINI";
  topic: EventTopic;
  config: Record<string, unknown>;
  enabled: boolean;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastImported: number;
  createdAt: string;
  eventCount: number;
}

export interface EventSourcesResponse {
  sources: EventSourceSummary[];
}

/** One Gemini key in the extraction pool, as shown in the admin workspace. */
export interface AiKeyUsage {
  index: number;
  maskedKey: string;
  requests: number;
  successes: number;
  rateLimited: number;
  failures: number;
  tokens: number;
  lastUsedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  cooldownUntil: string | null;
  available: boolean;
}

export interface AiUsageResponse {
  configured: boolean;
  model: string;
  models: string[];
  keys: AiKeyUsage[];
  totals: {
    requests: number;
    successes: number;
    rateLimited: number;
    failures: number;
    tokens: number;
  };
}

export interface CommunityEvent {
  id: string;
  slug: string;
  kind: EventKind;
  topic: EventTopic;
  competition?: string | null;
  source: { id: string; key: string; name: string } | null;
  sourceUrl: string | null;
  importedAt: string | null;
  title: string;
  description: string;
  coverUrl: string | null;
  startDate: string;
  endDate: string | null;
  location: string;
  lat: number | null;
  lng: number | null;
  maxAttendees: number | null;
  categoryId: string | null;
  placeId: string | null;
  createdAt: string;
  creator: EventAttendee;
  category: {
    id: string;
    name: string;
    slug: string;
    color: string;
    icon: string;
  } | null;
  place: {
    id: string;
    name: string;
    slug: string;
    kind: PlaceKind;
    city: string;
    area: string | null;
    lat: number;
    lng: number;
  } | null;
  counts: {
    going: number;
    interested: number;
    total: number;
  };
  attendeesPreview: EventAttendee[];
  myRsvp: RsvpStatus | null;
}

export interface EventsResponse {
  events: CommunityEvent[];
}

/** One fixture on the sports schedule, already split into its two sides. */
export interface SportFixture {
  id: string;
  slug: string;
  title: string;
  homeTeam: string;
  awayTeam: string | null;
  competition: string;
  startDate: string;
  endDate: string | null;
  venue: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  coverUrl: string | null;
  sourceUrl: string | null;
}

export interface SportsLeague {
  name: string;
  fixtures: SportFixture[];
}

export interface SportsResponse {
  leagues: SportsLeague[];
  updatedAt: string | null;
  window: { days: number; from: string; to: string };
}

/** A cinema screening pulled from a venue feed. */
export interface CinemaScreening {
  id: string;
  slug: string;
  title: string;
  startDate: string;
  endDate: string | null;
  coverUrl: string | null;
  sourceUrl: string | null;
}

export interface CinemaScheduleGroup {
  venue: string;
  cinema: { id: string; name: string; slug: string; area: string | null } | null;
  screenings: CinemaScreening[];
}

export interface CinemasResponse {
  cinemas: Place[];
  schedules: CinemaScheduleGroup[];
  updatedAt: string | null;
  window: { days: number };
}

/** The departure plan a member saved for one gathering. */
export interface LeaveByPlan {
  id: string;
  eventId: string;
  origin: { lat: number; lng: number };
  originLabel: string | null;
  mode: "driving" | "walking";
  leaveAt: string;
  notifyAt: string;
  travelSeconds: number;
  distanceMeters: number;
  notifiedAt: string | null;
}

export interface EventDetail extends Omit<CommunityEvent, "attendeesPreview"> {
  attendees: {
    going: EventAttendee[];
    interested: EventAttendee[];
  };
  leaveBy: LeaveByPlan | null;
}

export interface EventDetailResponse {
  event: EventDetail;
}

export interface QuizQuestionItem {
  id: string;
  prompt: string;
  options: string[];
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  correctIndex?: number;
  explanation?: string;
  userAnswer?: number | null;
  isCorrect?: boolean;
}

export interface QuizTodayResponse {
  day: string;
  alreadyCompleted: boolean;
  timeLimitSeconds: number;
  totalParticipants: number;
  score?: number;
  durationMs?: number;
  rank?: number | null;
  userAnswers?: number[];
  questions: QuizQuestionItem[];
}

export interface QuizLeaderboardItem {
  rank: number;
  id: string;
  score: number;
  durationMs: number;
  durationSeconds: number;
  completedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface QuizLeaderboardResponse {
  day: string;
  leaderboard: QuizLeaderboardItem[];
  total: number;
}

export interface QuizSubmitResponse {
  success: boolean;
  score: number;
  durationMs: number;
  timeLimitSeconds: number;
  rank: number;
  totalParticipants: number;
  review: Array<{
    id: string;
    prompt: string;
    options: string[];
    category: string;
    difficulty: string;
    correctIndex: number;
    userAnswer: number;
    isCorrect: boolean;
    explanation: string;
  }>;
}

// "Guess the Place" — daily photo challenge.
export interface PlaceQuizQuestionItem {
  id: string;
  prompt: string;
  imageUrl: string;
  imageCredit: string;
  imageLicense: string;
  imagePageUrl: string | null;
  options: string[];
  category: string;
  region: string;
  kind: "PLACE" | "CULTURE";
  correctIndex?: number;
  answer?: string;
  explanation?: string | null;
  userAnswer?: number | null;
  isCorrect?: boolean;
}

export interface PlaceQuizTodayResponse {
  day: string;
  alreadyCompleted: boolean;
  timeLimitSeconds: number;
  totalParticipants: number;
  score?: number;
  durationMs?: number;
  rank?: number | null;
  userAnswers?: number[];
  questions: PlaceQuizQuestionItem[];
}

export interface PlaceQuizLeaderboardItem {
  rank: number;
  id: string;
  score: number;
  durationMs: number;
  durationSeconds: number;
  completedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface PlaceQuizWinner {
  day: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  score: number;
  durationSeconds: number;
}

export interface PlaceQuizLeaderboardResponse {
  day: string;
  leaderboard: PlaceQuizLeaderboardItem[];
  total: number;
  winners: PlaceQuizWinner[];
  today: string;
}

export interface PlaceQuizSubmitResponse {
  success: boolean;
  score: number;
  durationMs: number;
  timeLimitSeconds: number;
  rank: number;
  totalParticipants: number;
  review: PlaceQuizQuestionItem[];
}

// In-app navigation — routes come from the OpenStreetMap routing profile.
export type TravelMode = "driving" | "walking";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteStep {
  /** OSRM maneuver type: depart, turn, continue, merge, roundabout, arrive… */
  type: string;
  modifier: string | null;
  exit: number | null;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  location: RoutePoint;
}

export interface DirectionsRoute {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  path: RoutePoint[];
  steps: RouteStep[];
  bounds: { south: number; west: number; north: number; east: number };
}

export interface DirectionsResponse {
  route: DirectionsRoute;
  /** Present when alternatives were requested; navigation honours a pick. */
  routes?: DirectionsRoute[];
}

// "Let's Travel" — the trip planner compares transport options.
export type PlanMode = "taxi" | "bus" | "walking";
export type CongestionLevel = "LIGHT" | "MODERATE" | "HEAVY";

export interface TrafficReport {
  level: CongestionLevel;
  label: string;
  /** 0–100, higher means busier roads. */
  score: number;
  delaySeconds: number;
  note: string;
  source: "estimated";
}

export interface TrafficContext {
  day: string;
  localTime: string;
  period: "morning peak" | "midday" | "evening peak" | "off-peak" | "weekend";
  label: string;
  summary: string;
  source: "estimated";
}

export interface PlannedRoute {
  index: number;
  label: string;
  mode: PlanMode;
  distanceMeters: number;
  baseDurationSeconds: number;
  durationSeconds: number;
  path: RoutePoint[];
  traffic: TrafficReport;
  recommended: boolean;
  reason: string | null;
}

export interface TravelPlan {
  from: RoutePoint;
  to: RoutePoint;
  mode: PlanMode;
  routes: PlannedRoute[];
  recommendedIndex: number;
  traffic: TrafficReport;
  context: TrafficContext;
  disclaimer: string;
}

export interface TravelPlanResponse {
  plan: TravelPlan;
}

/** A venue address resolved to a pin by the API's cached geocoder. */
export interface GeocodeResponse {
  location: {
    lat: number;
    lng: number;
    displayName: string;
    query: string;
  };
}



