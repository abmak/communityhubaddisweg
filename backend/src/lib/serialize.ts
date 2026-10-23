import type { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  interests: true,
  role: true,
  showPresence: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const selfUserSelect = {
  ...publicUserSelect,
  email: true,
  phone: true,
  phoneVerifiedAt: true,
  calendarPreference: true,
} satisfies Prisma.UserSelect;

export const notificationActorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

/** Poll options in display order plus the viewer's own vote (if any). */
function pollViewerInclude(viewerId?: string) {
  return {
    options: { orderBy: { sortOrder: "asc" as const } },
    votes: {
      where: { userId: viewerId ?? "__anonymous__" },
      select: { optionId: true },
    },
  };
}

export function postInclude(viewerId?: string) {
  return {
    author: { select: publicUserSelect },
    category: true,
    media: { orderBy: { createdAt: "asc" } },
    movie: true,
    book: true,
    hike: true,
    poll: { include: pollViewerInclude(viewerId) },
    movieReviews: { select: { rating: true } },
    bookReviews: { select: { rating: true } },
    likes: { where: { userId: viewerId ?? "__anonymous__" }, select: { userId: true } },
    bookmarks: { where: { userId: viewerId ?? "__anonymous__" }, select: { userId: true } },
  } satisfies Prisma.PostInclude;
}

export type PostWithRelations = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

export interface SerializedPollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface SerializedPoll {
  id: string;
  question: string;
  allowMultiple: boolean;
  endsAt: Date | null;
  totalVotes: number;
  options: SerializedPollOption[];
  /** The option this viewer picked, or null when they have not voted. */
  myOptionId: string | null;
}

/** Structural input so both post-embedded and standalone polls serialise. */
export interface PollInput {
  id: string;
  question: string;
  allowMultiple: boolean;
  endsAt: Date | null;
  options: Array<{ id: string; label: string; voteCount: number }>;
  votes: Array<{ optionId: string }>;
}

export function serializePoll(poll: PollInput): SerializedPoll {
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    endsAt: poll.endsAt,
    totalVotes: poll.options.reduce((sum, option) => sum + option.voteCount, 0),
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      voteCount: option.voteCount,
    })),
    myOptionId: poll.votes[0]?.optionId ?? null,
  };
}

export interface SerializedPost
  extends Omit<PostWithRelations, "likes" | "bookmarks" | "movieReviews" | "bookReviews" | "poll"> {
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  ratingAvg: number | null;
  reviewCount: number;
  isEdited: boolean;
  poll: SerializedPoll | null;
}

export function serializePost(post: PostWithRelations): SerializedPost {
  const { likes, bookmarks, movieReviews, bookReviews, poll, ...rest } = post;
  const ratings = (movieReviews.length > 0 ? movieReviews : bookReviews).map((r) => r.rating);
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
    : null;

  return {
    ...rest,
    likedByMe: likes.length > 0,
    bookmarkedByMe: bookmarks.length > 0,
    ratingAvg: average,
    reviewCount: ratings.length,
    isEdited: post.updatedAt.getTime() - post.createdAt.getTime() > 1500,
    poll: poll ? serializePoll(poll) : null,
  };
}

export const commentInclude = {
  author: { select: publicUserSelect },
  likes: { select: { userId: true } },
} satisfies Prisma.CommentInclude;

export type CommentWithRelations = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export interface SerializedComment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  depth: number;
  author: CommentWithRelations["author"] | null;
  replies: SerializedComment[];
}

export interface MessageWithRelations {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  replyToId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  media: Array<{
    id: string;
    kind: string;
    url: string;
    thumbnailUrl: string | null;
    mimeType: string;
    sizeBytes: number;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }>;
  replyTo: {
    id: string;
    body: string | null;
    deletedAt: Date | null;
    senderId: string;
    sender: { id: string; username: string; displayName: string };
  } | null;
}
