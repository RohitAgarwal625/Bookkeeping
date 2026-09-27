import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  // Never log sensitive values.
  redact: {
    paths: [
      "req.headers.authorization",
      'req.headers["x-wallet-address"]',
      "sessionToken",
      "token",
    ],
    remove: true,
  },
});
