// Minimal fake of the Pi Platform API (https://api.minepi.com) used by lib/piClient.ts:
//   GET  /v2/payments/:id
//   POST /v2/payments/:id/approve
//   POST /v2/payments/:id/complete   { txid }
// Requires `Authorization: Key <apiKey>`, like the real API.
import http from "node:http";

export function startFakePi({ port, apiKey }) {
  const payments = new Map();
  const requests = []; // raw request URLs, for path/encoding assertions
  // paymentId -> failure mode for /v2/payments/<id>[/approve|/complete]:
  //   "hang" (never answers), "unauthorized" (401), "500json", "500html", "200html"
  const failures = new Map();
  const hung = []; // responses held open by "hang", ended on stop()

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
