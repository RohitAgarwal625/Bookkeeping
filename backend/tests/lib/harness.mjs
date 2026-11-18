// Shared test helpers: result tracking, assertions and a small API client.

export const results = { pass: 0, fail: 0, failures: [] };

/** Record one check. `info` is printed only when the check fails. */
export function check(name, condition, info = "") {
  if (condition) {
    results.pass++;
    console.log(`  PASS  ${name}`);
  } else {
    results.fail++;
    results.failures.push(name);
    console.log(`  FAIL  ${name}${info ? `  -> ${info}` : ""}`);
  }
}

/** Build an API client bound to the backend base URL. */
export function createApi(baseUrl) {
  async function call(method, path, { token, body, headers = {} } = {}) {
    const h = { "Content-Type": "application/json", ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  /** Log in (upsert) a user by uid; returns { user, sessionToken, expiresAt }. */
  async function login(uid) {
    const res = await call("GET", `/api/users/${encodeURIComponent(uid)}`);
    if (res.status !== 200) {
      throw new Error(`login(${uid}) failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  return { baseUrl, call, login };
}
