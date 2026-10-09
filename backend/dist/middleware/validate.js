"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
/**
 * Generic Zod validation middleware.
 * Validates and REPLACES req.body / req.query / req.params with parsed
 * (and sanitized/transformed) values.
 *
 * Resolves G-005 (XSS via transforms in schemas) and provides
 * structured 400 error responses.
 */
function validate(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if (parsed.body !== undefined)
                req.body = parsed.body;
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
                req.params = parsed.params;
            }
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
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
//# sourceMappingURL=validate.js.map