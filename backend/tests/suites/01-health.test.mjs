import { check } from "../lib/harness.mjs";

export const title = "Health and routing";

export default async function run({ api }) {
  const h = await api.call("GET", "/api/health");
  check("GET /api/health -> 200 with DB connected", h.status === 200, JSON.stringify(h.body));

  const nf = await api.call("GET", "/api/does-not-exist");
  check("unknown route -> 404 NOT_FOUND", nf.status === 404 && nf.body?.error === "NOT_FOUND");

  const cors = await api.call("GET", "/api/health", { headers: { Origin: "http://localhost:3000" } });
  check(
    "CORS allows the configured origin (http://localhost:3000)",
    cors.headers.get("access-control-allow-origin") === "http://localhost:3000"
  );

  const corsBad = await api.call("GET", "/api/health", { headers: { Origin: "https://evil.example" } });
  check("CORS does not allow an unknown origin", corsBad.headers.get("access-control-allow-origin") === null);
}
