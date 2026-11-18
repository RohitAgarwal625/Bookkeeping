// Minimal fake of the Pi Platform API (https://api.minepi.com) used by lib/piClient.ts:
//   GET  /v2/payments/:id
//   POST /v2/payments/:id/approve
//   POST /v2/payments/:id/complete   { txid }
// Requires `Authorization: Key <apiKey>`, like the real API.
import http from "node:http";

export function startFakePi({ port, apiKey }) {
  const payments = new Map();
  const requests = []; // raw request URLs, for path/encoding assertions

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
        payments,
        requests,
        stop: () => server.close(),
      })
    )
  );
}
