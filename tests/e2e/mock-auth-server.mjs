// A tiny stand-in for Supabase Auth (GoTrue), used only by the e2e suite.
// It implements just the endpoints @supabase/ssr calls in prompt 03: the
// email OTP request, PKCE code exchange, refresh, user lookup and logout,
// plus /authorize for the Google redirect. It sends no email and talks to
// no third party. Test helpers: GET /__otp?email=… (latest request for that
// address) and GET /__otp-count?email=…. Tests run in parallel, so failures
// are keyed by address: fail-server.* answers 500, fail-rate.* answers 429,
// slow.* waits 4s (for loading-state screenshots).
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 54399);
let otpRequests = [];

const b64 = (value) => Buffer.from(value).toString("base64url");

function userFor(email) {
  const id = `00000000-0000-4000-8000-${Buffer.from(email)
    .toString("hex")
    .padEnd(12, "0")
    .slice(0, 12)}`;
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function accessToken(email) {
  const now = Math.floor(Date.now() / 1000);
  const user = userFor(email);
  return [
    b64(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64(
      JSON.stringify({
        sub: user.id,
        email,
        aud: "authenticated",
        role: "authenticated",
        iat: now,
        exp: now + 3600,
      }),
    ),
    b64("mock-signature"),
  ].join(".");
}

function session(email) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken(email),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh.${b64(email)}`,
    user: userFor(email),
  };
}

function emailFromToken(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    ...headers,
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const authError = (res, status, code, msg) =>
  send(res, status, { code: status, error_code: code, msg });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") return send(res, 204);
  if (path === "/health") return send(res, 200, { ok: true });
  if (path === "/__otp") {
    const email = url.searchParams.get("email");
    return send(
      res,
      200,
      otpRequests.filter((r) => r.email === email).at(-1) ?? null,
    );
  }
  if (path === "/__otp-count") {
    const email = url.searchParams.get("email");
    return send(res, 200, {
      count: otpRequests.filter((r) => r.email === email).length,
    });
  }

  if (path === "/auth/v1/otp" && req.method === "POST") {
    const body = await readJson(req);
    const email = String(body.email ?? "");
    if (email.startsWith("fail-rate.")) {
      return authError(
        res,
        429,
        "over_email_send_rate_limit",
        "email rate limit exceeded",
      );
    }
    if (email.startsWith("slow.")) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    if (email.startsWith("fail-server.")) {
      return authError(res, 500, "unexpected_failure", "Internal mock failure");
    }
    otpRequests.push({
      email: body.email,
      redirect_to: url.searchParams.get("redirect_to"),
      create_user: body.create_user,
      code_challenge: body.code_challenge ?? null,
      at: Date.now(),
    });
    return send(res, 200, {});
  }

  if (path === "/auth/v1/authorize" && req.method === "GET") {
    const redirectTo = url.searchParams.get("redirect_to");
    if (!redirectTo)
      return authError(res, 400, "validation_failed", "missing redirect_to");
    const target = new URL(redirectTo);
    target.searchParams.set("code", `ok.${b64("google.user@example.com")}`);
    res.writeHead(302, { location: target.toString() });
    return res.end();
  }

  if (path === "/auth/v1/token" && req.method === "POST") {
    const body = await readJson(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "pkce") {
      const code = String(body.auth_code ?? "");
      if (!code.startsWith("ok.") || !body.code_verifier) {
        return authError(
          res,
          403,
          "flow_state_not_found",
          "invalid flow state",
        );
      }
      const email = Buffer.from(code.slice(3), "base64url").toString();
      return send(res, 200, session(email));
    }
    if (grant === "refresh_token") {
      const token = String(body.refresh_token ?? "");
      if (!token.startsWith("refresh.")) {
        return authError(
          res,
          400,
          "refresh_token_not_found",
          "Invalid Refresh Token",
        );
      }
      return send(
        res,
        200,
        session(Buffer.from(token.slice(8), "base64url").toString()),
      );
    }
    return authError(res, 400, "unsupported_grant_type", "unsupported grant");
  }

  if (path === "/auth/v1/user" && req.method === "GET") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const email = emailFromToken(token);
    if (!email) return authError(res, 403, "bad_jwt", "invalid JWT");
    return send(res, 200, userFor(email));
  }

  if (path === "/auth/v1/logout" && req.method === "POST")
    return send(res, 204);

  return authError(res, 404, "not_found", `mock has no ${req.method} ${path}`);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock auth listening on http://127.0.0.1:${PORT}`);
});
