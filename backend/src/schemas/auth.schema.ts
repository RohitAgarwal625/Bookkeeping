import { z } from "zod";

/** POST /api/auth/pi — the accessToken returned by Pi.authenticate() in the browser. */
export const piLoginSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1).max(4096),
  }),
});
