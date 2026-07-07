import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getAllowedOrigins } from "./lib/env";

const app: Express = express();
const allowedOrigins = getAllowedOrigins();

if (allowedOrigins.length === 0) {
  logger.warn(
    "CORS_ALLOWED_ORIGINS is not set — cross-origin browser requests (an " +
      "explicit Origin header) will be rejected by default. Requests with " +
      "no Origin header (native mobile, server-to-server) are unaffected. " +
      "Set CORS_ALLOWED_ORIGINS to a comma-separated list if a web client " +
      "needs to call this API directly.",
  );
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (native app, server-to-server, curl) is not a
      // browser cross-origin request — always allowed. A browser request
      // that DOES send an Origin header must match the explicit allowlist;
      // an empty/unset allowlist now means "no cross-origin browser access"
      // rather than the previous "allow every origin."
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/", router);

export default app;
