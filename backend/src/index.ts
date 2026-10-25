import http from "node:http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { createApp } from "./app";
import { initSocket } from "./socket";
import { ensureUploadDir } from "./lib/storage";
import { ensureSeedEvents, ensureSeedEventSources } from "./lib/seed-events";
import { ensureSeedJokes } from "./lib/seed-jokes";
import { ensureSeedPlaces } from "./lib/seed-places";
import { startEventIngest } from "./lib/events/ingest";
import { ensureBuiltinRoles } from "./lib/roles";
import { ensureSeedQuizQuestions } from "./lib/seed-quiz";

async function main(): Promise<void> {
  await ensureUploadDir();
  await ensureBuiltinRoles().catch((err) => {
    logger.warn({ err }, "Could not ensure built-in roles");
  });
  await ensureSeedEvents().catch((err) => {
    logger.warn({ err }, "Could not run seed events");
  });
  await ensureSeedEventSources().catch((err) => {
    logger.warn({ err }, "Could not seed event sources");
  });
  await ensureSeedJokes().catch((err) => {
    logger.warn({ err }, "Could not seed Joke Time");
  });
  await ensureSeedPlaces().catch((err) => {
    logger.warn({ err }, "Could not seed the nearby service places");
  });
  await ensureSeedQuizQuestions().catch((err) => {
    logger.warn({ err }, "Could not seed quiz questions");
  });

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, client: env.CLIENT_ORIGIN },
      "Addis Weg API + realtime gateway listening",
    );
    // Fire-and-forget: the first import pulls fixtures and listings in without
    // delaying the API coming up, then the timer keeps them fresh.
    startEventIngest(env.EVENTS_SYNC_MINUTES);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down Addis Weg API");
    server.close();
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
  });
}

main().catch((error) => {
  logger.error({ err: error }, "Failed to start Addis Weg API");
  process.exit(1);
});
