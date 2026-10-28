import { createApp } from "./app";
import { connectDb, disconnectDb } from "./config/db";
import { env } from "./config/env";
import { startScheduler, stopScheduler } from "./jobs/scheduler";
import "./models";
import { logger } from "./utils/logger";

async function main() {
  await connectDb();
  const app = createApp();
  const server = app.listen(env.PORT, () =>
    logger.info("Server listening", { port: env.PORT, env: env.NODE_ENV }),
  );
  if (env.ENABLE_SCHEDULER) startScheduler();
  else
    logger.info("Scheduler disabled on this instance (ENABLE_SCHEDULER=false)");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down", { signal });
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    stopScheduler();
    server.close(async () => {
      await disconnectDb().catch((err) =>
        logger.error("Error closing MongoDB", { err }),
      );
      logger.info("Shutdown complete");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) =>
    logger.error("Unhandled promise rejection", { err: reason }),
  );
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { err });
    void shutdown("uncaughtException");
  });
}

main().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
