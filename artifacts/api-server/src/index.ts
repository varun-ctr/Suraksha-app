import type { Server } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { parsePort } from "./lib/env";

// Defense in depth beyond the Express error middleware in app.ts: this
// catches anything happening entirely outside a request's lifecycle (a
// rejected promise nobody awaited, a genuinely uncaught throw). Node
// considers the process state unreliable after either, so log with as much
// context as we have and exit — the process manager (Replit's autoscale)
// restarts a fresh instance rather than this one silently limping on.
//
// Exiting immediately would also cut off any *unrelated* request still
// in-flight on this process (e.g. another user's /sos/alert dispatch) — so
// stop accepting new connections and give in-flight ones a grace period to
// finish before exiting, with a hard timeout in case one never does.
const SHUTDOWN_GRACE_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

function crashExit(message: string, err: unknown): void {
  logger.error({ err }, message);
  if (shuttingDown) return;
  shuttingDown = true;

  if (!server) {
    process.exit(1);
    return;
  }

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close(() => process.exit(1));
}

process.on("unhandledRejection", (reason) => {
  crashExit("Unhandled promise rejection — exiting", reason);
});

process.on("uncaughtException", (err) => {
  crashExit("Uncaught exception — exiting", err);
});

const port = parsePort(process.env.PORT);

server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
