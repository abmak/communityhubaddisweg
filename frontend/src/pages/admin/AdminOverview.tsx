import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Flag,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { useQuery } from "../../hooks/useApi";
import { cn, formatCount, timeAgo } from "../../lib/utils";
import type { Analytics } from "../../lib/adminTypes";
import { Avatar, PageLoader, Spinner } from "../../components/ui";
import {
  AdminPageHeader,
  BarList,
  MiniStat,
  Panel,
  RoleDonut,
  StatCard,
  TrendChart,
  formatHours,
} from "./parts";

const RANGES = [7, 30, 90] as const;

export function AdminOverview() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const query = useQuery<Analytics>(`/api/admin/analytics?range=${range}`);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Community health"
        title="The whole picture, one screen."
        description="Growth, participation and moderation pressure across Addis Weg. Figures compare the selected window with the one before it."
        actions={
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition",
                  range === option ? "bg-brand-700 text-white" : "text-muted hover:text-ink",
                )}
              >
                {option}d
              </button>
            ))}
          </div>
        }
      />

      {query.loading && !query.data ? (
        <PageLoader label="Crunching the last few months…" />
      ) : query.error ? (
        <div className="card p-8 text-center text-sm text-rose-600">{query.error}</div>
      ) : query.data ? (
        <OverviewBody data={query.data} refreshing={query.loading} />
      ) : null}
    </div>
  );
}

function OverviewBody({ data, refreshing }: { data: Analytics; refreshing: boolean }) {
  const { totals, deltas, engagement, moderation, rooms, topPosts, topContributors } = data;
  const label = `last ${data.range} days`;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Members"
          value={totals.users}
          icon={Users}
          delta={deltas.users}
          hint={`${deltas.users.current} joined in the ${label}`}
        />
        <StatCard
          label="Conversations"
          value={totals.posts}
          icon={MessagesSquare}
          tone="accent"
          delta={deltas.posts}
          hint={`${deltas.posts.current} started in the ${label}`}
        />
        <StatCard
          label="Comments"
          value={totals.comments}
          icon={Sparkles}
          tone="sky"
          delta={deltas.comments}
          hint={`${deltas.comments.current} written in the ${label}`}
        />
        <StatCard
          label="Open reports"
          value={totals.openReports}
          icon={Flag}
          tone="danger"
          hint={`${deltas.reports.current} filed in this window`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Panel
          title={`Activity over the ${label}`}
          description="New accounts, conversations and comments per day."
          action={
            refreshing ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[10px] text-muted">Updated {timeAgo(data.generatedAt)}</span>
            )
          }
        >
          <TrendChart
            points={data.series}
            lines={[
              { key: "members", label: "Members", color: "#0f6b3a" },
              { key: "posts", label: "Posts", color: "#d97706" },
              { key: "comments", label: "Comments", color: "#0284c7" },
            ]}
          />
        </Panel>

        <Panel
          title="Moderation pressure"
          description="What is waiting, and how quickly the team responds."
          action={
            <Link to="/admin/reports" className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Open queue <ArrowRight className="inline h-3 w-3" />
            </Link>
          }
        >
          <div className="mb-4 flex items-end gap-3">
            <p className="font-display text-4xl font-semibold text-ink">{moderation.open}</p>
            <p className="pb-1 text-xs leading-5 text-muted">
              open reports
              <br />
              {moderation.filedInRange} filed in this window
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Resolved" value={formatCount(moderation.resolvedInRange)} hint="in this window" />
            <MiniStat label="Resolution time" value={formatHours(moderation.avgResolutionHours)} hint="average" />
            <MiniStat label="All time resolved" value={formatCount(moderation.resolved)} />
            <MiniStat label="Dismissed" value={formatCount(moderation.dismissed)} />
          </div>
          {moderation.byReason.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Reasons this window
              </p>
              <div className="flex flex-wrap gap-1.5">
                {moderation.byReason.slice(0, 4).map((reason) => (
                  <span
                    key={reason.reason}
                    className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium text-muted"
                  >
                    {reason.reason.replaceAll("_", " ").toLowerCase()}
                    <span className="font-semibold text-ink">{reason.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Active contributors"
          value={formatCount(engagement.activeContributors)}
          hint="posted or commented in this window"
        />
        <MiniStat
          label="Returning contributors"
          value={`${engagement.returningRate}%`}
          hint={`${engagement.returningContributors} of ${engagement.activeContributors} joined earlier`}
        />
        <MiniStat
          label="Comments per post"
          value={String(engagement.commentsPerPost)}
          hint={`${engagement.likesPerPost} likes per post`}
        />
        <MiniStat
          label="Private messages"
          value={formatCount(engagement.messagesSent)}
          hint={`${formatCount(totals.messages)} all time`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Rooms by volume" description="Lifetime posts, with conversation depth.">
          <BarList
            rows={rooms
              .slice()
              .sort((a, b) => b.posts - a.posts)
              .slice(0, 8)
              .map((room) => ({
                label: room.name,
                value: room.posts,
                hint: `${formatCount(room.comments)} comments · ${formatCount(room.likes)} likes`,
                color: room.color,
              }))}
            emptyLabel="No rooms configured yet."
          />
        </Panel>

        <Panel title="Who holds the keys" description="Accounts by role.">
          <RoleDonut rows={data.roleBreakdown} />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px] text-muted">
            <span>
              Posts / member <strong className="text-ink">{engagement.postsPerMember}</strong>
            </span>
            <span>
              Total likes <strong className="text-ink">{formatCount(totals.likes)}</strong>
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Most active members" description={`Posts and comments in the ${label}.`}>
          {topContributors.length === 0 ? (
            <p className="py-4 text-sm text-muted">No contributions in this window.</p>
          ) : (
            <ol className="divide-y divide-line">
              {topContributors.map((member, index) => (
                <li key={member.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-4 text-[11px] font-semibold text-muted/60">{index + 1}</span>
                  <Avatar name={member.displayName} username={member.username} src={member.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/u/${member.username}`} className="truncate text-[13px] font-semibold text-ink hover:text-brand-700">
                      {member.displayName}
                    </Link>
                    <p className="text-[10px] text-muted">
                      {member.posts} posts · {member.comments} comments
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-ink">{member.activity}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Top conversations" description={`Ranked by likes in the ${label}.`}>
          {topPosts.length === 0 ? (
            <p className="py-4 text-sm text-muted">No posts in this window.</p>
          ) : (
            <ol className="divide-y divide-line">
              {topPosts.map((post) => (
                <li key={post.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link to={`/posts/${post.id}`} className="group block">
                    <p className="truncate text-[13px] font-semibold text-ink group-hover:text-brand-700">
                      {post.title ?? post.excerpt}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: post.category.color }} />
                        {post.category.name}
                      </span>
                      <span>by {post.author.displayName}</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="h-3 w-3" /> {post.likeCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle className="h-3 w-3" /> {post.commentCount}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Platform inventory" description="Everything the community has accumulated.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { icon: Users, label: "Members", value: totals.users },
            { icon: CalendarDays, label: "Events", value: totals.events },
            { icon: MapPin, label: "Places", value: totals.places },
            { icon: MessageCircle, label: "Messages", value: totals.messages },
            { icon: ImageIcon, label: "Media", value: totals.media },
            { icon: Bookmark, label: "Bookmarks", value: totals.bookmarks },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-line bg-raised/40 p-3">
              <stat.icon className="h-4 w-4 text-muted" />
              <p className="mt-2 font-display text-lg font-semibold text-ink">{formatCount(stat.value)}</p>
              <p className="text-[10px] font-medium text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
