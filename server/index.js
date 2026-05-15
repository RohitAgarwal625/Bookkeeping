/**
 * Minimal Express backend for Pi Network authentication.
 *
 * POST /api/auth/pi
 *   Body:   { accessToken: string }
 *   Action: Calls GET https://api.minepi.com/v2/me with
 *           Authorization: Bearer <accessToken>.
 *           On 200 OK, responds with { uid, username } and sets a session cookie.
 *   No Pi Network API key is required for this flow.
 *
 * Start with:  node server/index.js
 * (or add "server": "node server/index.js" to package.json scripts)
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(
  cors({
    // In production, lock this down to your actual frontend origin.
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// ── Pi Token Validation Endpoint ────────────────────────────────────────────
/**
 * Validates an accessToken returned by Pi.authenticate() on the frontend.
 * The Pi Platform API does NOT require an API key for the /me endpoint —
 * the Bearer token itself is the credential.
 */
app.post("/api/auth/pi", async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ error: "accessToken is required." });
  }

  try {
    // ── Call Pi Platform API /v2/me ─────────────────────────────────────
    const piResponse = await fetch("https://api.minepi.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!piResponse.ok) {
      const body = await piResponse.text();
      console.error("[Pi /me] Non-200 response:", piResponse.status, body);
      return res
        .status(401)
        .json({ error: "Pi token validation failed.", detail: body });
    }

    const piUser = await piResponse.json();
    // piUser shape: { uid: string, username: string, ... }

    // ── Session / JWT would be established here ─────────────────────────
    // For example, sign a JWT and send it as a cookie:
    //   const token = jwt.sign({ uid: piUser.uid }, process.env.JWT_SECRET, { expiresIn: '7d' });
    //   res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: true });

    console.log(`[Pi Auth] Verified user: @${piUser.username} (uid: ${piUser.uid})`);

    return res.json({ uid: piUser.uid, username: piUser.username });
  } catch (err) {
    console.error("[Pi Auth] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Pi auth backend listening on http://localhost:${PORT}`);
});
