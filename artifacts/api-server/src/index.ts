import app from "./app";
import { logger } from "./lib/logger";
import { parsePort } from "./lib/env";

// Defense in depth beyond the Express error middleware in app.ts: this
// catches anything happening entirely outside a request's lifecycle (a
// rejected promise nobody awaited, a genuinely uncaught throw). Node
// considers the process state unreliable after either, so log with as much
// context as we have and exit — the process manager (Replit's autoscale)
// restarts a fresh instance rather than this one silently limping on.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — exiting");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});

const port = parsePort(process.env.PORT);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
