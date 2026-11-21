// Minimal fake of the Pi Platform API (https://api.minepi.com) used by lib/piClient.ts:
//   GET  /v2/payments/:id
//   POST /v2/payments/:id/approve
//   POST /v2/payments/:id/complete   { txid }
//   GET  /accounts/:address/payments (fake Horizon for PI_HORIZON_URL; see the handler and addHorizonPayment)
// Requires `Authorization: Key <apiKey>`, like the real API.
import http from "node:http";

export function startFakePi({ port, apiKey }) {
  const payments = new Map();
  const requests = []; // raw request URLs, for path/encoding assertions
  // paymentId -> failure mode for /v2/payments/<id>[/approve|/complete]:
  //   "hang" (never answers), "unauthorized" (401), "500json", "500html", "200html"
  const failures = new Map();
  const hung = []; // responses held open by "hang", ended on stop()
  // Fake Horizon payments per account address (addHorizonPayment). Addresses with records here
  // are served from this list; all others keep the prefix rules below.
  const horizonPayments = new Map();
  let horizonOpId = 900000000000;

  /**
   * Register a Horizon payment record on `address`'s payments list (in-app payment tests).
   * Fills id/paging_token/type/asset_type/created_at/transaction_hash defaults; returns the record.
   */
  function addHorizonPayment(address, record = {}) {
    const id = record.id ?? String(++horizonOpId);
    const rec = {
      id,
      paging_token: id,
      type: "payment",
      asset_type: "native",
      transaction_successful: true,
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      transaction_hash: id.padStart(64, "a").slice(-64),
      ...record,
    };
    if (!horizonPayments.has(address)) horizonPayments.set(address, []);
    horizonPayments.get(address).push(rec);
    return rec;
  }

  /** Make every Pi call for this payment id fail in the given way (see `failures`). */
  function setFailure(id, mode) {
    if (mode) failures.set(id, mode);
    else failures.delete(id);
  }

  /** Register a payment the fake API will return. */
  function addPayment(id, userUid, { amount = 1, productId = "premium_bookkeeping" } = {}) {
    const payment = {
      identifier: id,
      user_uid: userUid,
      amount,
      memo: "Unlock Premium Bookkeeping Plan",
      metadata: { productId },
      to_address: "GAPPWALLET0000000000000000000000000000000000000000000000",
      created_at: new Date().toISOString(),
      network: "Pi Testnet",
      status: {
        developer_approved: false,
        transaction_verified: false,
        developer_completed: false,
        cancelled: false,
        user_cancelled: false,
      },
      transaction: null,
    };
    payments.set(id, payment);
    return payment;
  }

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push(req.url);
      const send = (status, obj) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      // Fake Horizon (PI_HORIZON_URL): GET /accounts/:address/payments. The address prefix picks the answer:
      // GNOTFOUND -> 404, GBAD -> 400, GDOWN -> 500, anything else -> 200 with one record.
      const h = req.url.match(/^\/accounts\/([^/?]+)\/payments(?:\?|$)/);
      if (h) {
        const addr = decodeURIComponent(h[1]);
        if (horizonPayments.has(addr)) {
          const q = new URL(req.url, "http://x").searchParams;
          const desc = q.get("order") !== "asc";
          const limit = Number(q.get("limit") ?? 10);
          const cursor = q.get("cursor");
          let list = [...horizonPayments.get(addr)].sort((a, b) => {
            const x = BigInt(a.paging_token), y = BigInt(b.paging_token);
            return x === y ? 0 : (x < y) === desc ? 1 : -1;
          });
          if (cursor) list = list.filter((r) => (desc ? BigInt(r.paging_token) < BigInt(cursor) : BigInt(r.paging_token) > BigInt(cursor)));
          return send(200, { _embedded: { records: list.slice(0, limit) } });
        }
        if (addr.startsWith("GNOTFOUND")) return send(404, { status: 404, title: "Resource Missing" });
        if (addr.startsWith("GBAD")) return send(400, { status: 400, title: "Bad Request" });
        if (addr.startsWith("GDOWN")) return send(500, { status: 500, title: "Internal Server Error" });
        return send(200, { _embedded: { records: [{ id: "1", paging_token: "1", type: "payment" }] } });
      }
      const failId = req.url.match(/^\/v2\/payments\/([^/]+)/)?.[1];
      const mode = failId ? failures.get(decodeURIComponent(failId)) : undefined;
      if (mode === "hang") return hung.push(res);
      if (mode === "unauthorized") return send(401, { error: "unauthorized" });
      if (mode === "500json") return send(500, { error: "internal_error", error_message: "payments-db shard 7 timeout (10.0.3.12:5432)", trace_id: "pi-internal-abc123" });
      if (mode === "500html" || mode === "200html") {
        res.writeHead(mode === "500html" ? 500 : 200, { "Content-Type": "text/html" });
        return res.end("<html><body>nginx/1.18.0 upstream payments-svc 10.0.3.12</body></html>");
      }
      if (req.headers.authorization !== `Key ${apiKey}`) return send(401, { error: "unauthorized" });

      const m = req.url.match(/^\/v2\/payments\/([^/]+)(?:\/(approve|complete))?$/);
      if (!m) return send(404, { error: "not_found" });
      const payment = payments.get(decodeURIComponent(m[1]));
      if (!payment) return send(404, { error_message: "payment not found" });

      if (m[2] === "approve") payment.status.developer_approved = true;
      if (m[2] === "complete") {
        const { txid } = JSON.parse(raw || "{}");
        payment.status.developer_completed = true;
        payment.status.transaction_verified = true;
        payment.transaction = { txid, verified: true, _link: "" };
      }
      send(200, payment);
    });
  });

  return new Promise((resolve) =>
    server.listen(port, () =>
      resolve({
        url: `http://localhost:${port}`,
        addPayment,
        addHorizonPayment,
        setFailure,
        payments,
        requests,
        stop: () => {
          for (const r of hung.splice(0)) r.destroy();
          server.close();
        },
      })
    )
  );
}
