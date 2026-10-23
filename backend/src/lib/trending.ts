import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface RankedPostOptions {
  limit: number;
  offset?: number;
  categoryId?: string;
  kind?: "DISCUSSION" | "MOVIE" | "BOOK" | "HIKE";
  mode?: "trending" | "popular";
  windowDays?: number;
}

/**
 * Trending is deliberately not an all-time like count: engagement is weighted
 * and divided by the age of the post (a Hacker News style gravity curve).
 * Popular ranks all-time engagement without the recency penalty.
 */
export async function rankedPostIds({
  limit,
  offset = 0,
  categoryId,
  kind,
  mode = "trending",
  windowDays = 30,
}: RankedPostOptions): Promise<string[]> {
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (categoryId) filters.push(Prisma.sql`p."categoryId" = ${categoryId}`);
  if (kind) filters.push(Prisma.sql`c.kind::text = ${kind}`);
  if (mode === "trending") {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    filters.push(Prisma.sql`p."createdAt" >= ${cutoff}`);
  }

  const score =
    mode === "trending"
      ? Prisma.raw(
          `((p."likeCount" * 2 + p."commentCount" * 3 + p."bookmarkCount" * 3 + p."shareCount" * 2 + 1)::float
            / POWER(EXTRACT(EPOCH FROM (NOW() - p."createdAt")) / 3600.0 + 2, 1.35))`,
        )
      : Prisma.raw(
          `(p."likeCount" * 2 + p."commentCount" * 3 + p."bookmarkCount" * 3 + p."shareCount" * 2 + 1)::float`,
        );

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p.id
    FROM "Post" p
    JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY ${score} DESC, p."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map((row) => row.id);
}
