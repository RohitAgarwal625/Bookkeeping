import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";

/**
 * Generic Zod validation middleware.
 * Validates and REPLACES req.body / req.query / req.params with parsed
 * (and sanitized/transformed) values.
 *
 * Resolves G-005 (XSS via transforms in schemas) and provides
 * structured 400 error responses.
 */
/** Path of the first string containing a NUL character (Postgres can't store or compare it), or null. */
function findNul(value: unknown, path: string): string | null {
  if (typeof value === "string") return value.includes("\u0000") ? path : null;
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const hit = findNul(v, path ? `${path}.${k}` : k);
      if (hit !== null) return hit;
    }
  }
  return null;
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nulField = findNul({ body: req.body, query: req.query, params: req.params }, "");
    if (nulField !== null) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid request",
        details: [{ field: nulField, message: "Must not contain NUL characters" }],
      });
      return;
    }
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown; query?: unknown; params?: unknown };

      if (parsed.body !== undefined) req.body = parsed.body;
      // req.query / req.params are getter-only in some Express versions;
      // assign defensively.
      if (parsed.query !== undefined) {
        Object.defineProperty(req, "query", {
          value: parsed.query,
          writable: true,
          configurable: true,
        });
      }
      if (parsed.params !== undefined) {
        req.params = parsed.params as Record<string, string>;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
