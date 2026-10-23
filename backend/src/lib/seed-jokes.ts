import { prisma } from "./prisma";
import { logger } from "./logger";

const DEMO_JOKES = [
  "My grandmother asked why I was staring at the injera. I told her I was waiting for the pattern to spell my name.",
  "Round three of the coffee ceremony is not a drink. It is group therapy with cardamom.",
  "Ethiopian time means the meeting starts when everyone arrives — except the one person who texted “I'm five minutes away” an hour ago.",
  "I told my friend I was on a diet. He said, “So just one more injera then?”",
  "The fastest thing in Addis is not a blue minibus. It is the waiter bringing the bill the second you look full.",
];

/**
 * Gives a fresh install something to look at: one open Joke Time window with a
 * handful of jokes. Never touches an existing schedule, so admin edits stand.
 */
export async function ensureSeedJokes(): Promise<void> {
  const sessions = await prisma.jokeSession.count();
  if (sessions > 0) return;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });
  if (users.length === 0) return;

  const now = Date.now();
  const session = await prisma.jokeSession.create({
    data: {
      title: "Joke Time",
      opensAt: new Date(now - 60 * 60 * 1000),
      closesAt: new Date(now + 6 * 60 * 60 * 1000),
      createdById: users[0].id,
    },
  });

  for (const [index, body] of DEMO_JOKES.entries()) {
    const author = users[index % users.length];
    const joke = await prisma.joke.create({
      data: { sessionId: session.id, authorId: author.id, body },
    });

    // Spread a few likes so the board is not all zeroes.
    const likers = users.filter((user) => user.id !== author.id).slice(0, (index % 3) + 1);
    for (const liker of likers) {
      await prisma.jokeLike.create({ data: { jokeId: joke.id, userId: liker.id } });
    }
    if (likers.length > 0) {
      await prisma.joke.update({
        where: { id: joke.id },
        data: { likeCount: likers.length },
      });
    }
  }

  logger.info({ sessionId: session.id, jokes: DEMO_JOKES.length }, "Seeded the demo Joke Time session");
}
