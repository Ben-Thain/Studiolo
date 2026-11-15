// A tiny stand-in for Supabase Auth (GoTrue) and the API gateway, used only
// by the e2e suite. It implements the auth endpoints @supabase/ssr calls in
// prompt 03 (email OTP request, PKCE code exchange, refresh, user lookup and
// update, logout, /authorize for the Google redirect) and proxies /rest/v1 to
// a local PostgREST on the throwaway studiolo_e2e database
// (scripts/e2e-stack.sh). Users live in that database's auth.users, so the
// seeded sam@example.com signs in to the seeded sites and any other address
// signs up (the profile trigger runs as on hosted Supabase). Tokens are real
// HS256 JWTs signed with a test-only key that PostgREST verifies.
// It sends no email and talks to no third party. Test helpers:
//   GET /__otp?email=…        latest OTP request for that address
//   GET /__otp-count?email=…  number of OTP requests for that address
//   GET /__email-change?email=… latest login-email change for that address
//   GET /__calls?email=…      counts of Auth and /rest/v1 calls for that user
//   POST /__google?enabled=false  switch the Google provider off
//   POST /__seed-asset?site=…  add an image asset (row, storage object and an
//                             image element on the home page) to a site
//   POST /__fail-copy?site=…   storage copies out of that site answer 500
//   GET /__objects?prefix=…    storage object names under a prefix
// Storage: /storage/v1/object/{list,copy} and DELETE /storage/v1/object/:bucket
// for the service role only, backed by the local storage.objects table.
// Tests run in parallel, so behaviour is keyed by address prefix:
//   fail-server.*  OTP answers 500        fail-rate.*  OTP answers 429
//   slow.*         OTP and data wait 3-4s fail-data.*  data answers 500
//   fail-sites.*   only /rest/v1/sites answers 500
//   trial-1.*      trial started 6 days ago (1 day left)
//   trial-ended.*  trial started 8 days ago (ended)
import { createHash, createHmac } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import pg from "pg";

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 54399);
const REST_PORT = Number(process.env.POSTGREST_PORT ?? 54398);
const DB_URL = process.env.E2E_DB_URL ?? "postgresql:///studiolo_e2e";
// Test-only key shared with scripts/e2e-stack.sh. Not a secret.
const JWT_KEY = "studiolo-local-e2e-only-jwt-signing-key-0001";
const pool = new pg.Pool({ connectionString: DB_URL, max: 4 });

let otpRequests = [];
let emailChanges = [];
// Pending login-email changes by user id, returned as new_email by GET
// /auth/v1/user until confirmed (as GoTrue does).
const pendingEmail = new Map();
// Request log for "how many calls does one page make" tests: per email,
// counts of GET /auth/v1/user and of each /rest/v1 table.
const calls = new Map();
function count(email, key) {
  if (!email) return;
  const entry = calls.get(email) ?? {};
  entry[key] = (entry[key] ?? 0) + 1;
  calls.set(email, entry);
}
let googleEnabled = true;
// Sites whose storage objects fail to copy (POST /__fail-copy).
const failCopy = new Set();

const b64 = (value) => Buffer.from(value).toString("base64url");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function idFor(email) {
  const hex = createHash("sha256").update(email).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Find the user by email, or sign them up (insert into auth.users; the
// handle_new_user trigger creates the profile).
async function findOrCreateUser(email) {
  const found = await pool.query(
    "select id::text from auth.users where email = $1",
    [email],
  );
  if (found.rows[0]) return found.rows[0].id;
  const id = idFor(email);
  await pool.query(
    "insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing",
    [id, email],
  );
  const daysAgo = email.startsWith("trial-ended.")
    ? 8
    : email.startsWith("trial-1.")
      ? 6
      : 0;
  if (daysAgo) {
    await pool.query(
      "update public.profiles set trial_started_at = now() - make_interval(days => $2) where id = $1",
      [id, daysAgo],
    );
  }
  return id;
}

function userJson(id, email, extra = {}) {
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
    ...extra,
  };
}

function sign(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_KEY)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verify(token) {
  const [head, body, sig] = String(token).split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", JWT_KEY)
    .update(`${head}.${body}`)
    .digest("base64url");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function session(email) {
  const id = await findOrCreateUser(email);
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: sign({
      sub: id,
      email,
      aud: "authenticated",
      role: "authenticated",
      iat: now,
      exp: now + 3600,
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh.${b64(email)}`,
    user: userJson(id, email),
  };
}

const bearer = (req) =>
  verify((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));

// Forward /rest/v1/* to the local PostgREST, as the Supabase gateway does.
async function proxyRest(req, res, path, search) {
  const claims = bearer(req);
  const email = claims?.email ?? "";
  count(email, `${req.method} ${path.split("?")[0]}`);
  if (email.startsWith("slow.")) await sleep(3000);
  if (
    email.startsWith("fail-data.") ||
    (email.startsWith("fail-sites.") && path.startsWith("/rest/v1/sites"))
  ) {
    return send(res, 500, { code: "XX000", message: "mock data failure" });
  }
  const headers = { ...req.headers, host: `127.0.0.1:${REST_PORT}` };
  // The anon key is not a JWT here; PostgREST then uses the anon role.
  if (!claims) delete headers.authorization;
  delete headers.apikey;
  const upstream = httpRequest(
    {
      host: "127.0.0.1",
      port: REST_PORT,
      method: req.method,
      path: path.slice("/rest/v1".length) + search,
      headers,
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () =>
    send(res, 502, { message: "PostgREST is not running" }),
  );
  req.pipe(upstream);
}

// Storage API stand-in (service role only), on the local storage.objects.
async function storageApi(req, res, path) {
  const claims = bearer(req);
  if (claims?.role !== "service_role") {
    return send(res, 403, { statusCode: "403", error: "Unauthorized" });
  }
  const body = await readJson(req);
  const list = path.match(/^\/storage\/v1\/object\/list\/([^/]+)$/);
  if (list && req.method === "POST") {
    const prefix = String(body.prefix ?? "").replace(/\/+$/, "");
    const { rows } = await pool.query(
      `select id::text, name, metadata, created_at from storage.objects
       where bucket_id = $1 and name like $2 order by name`,
      [list[1], `${prefix}/%`],
    );
    return send(
      res,
      200,
      rows
        .map((row) => ({ ...row, name: row.name.slice(prefix.length + 1) }))
        .filter((row) => !row.name.includes("/")),
    );
  }
  if (path === "/storage/v1/object/copy" && req.method === "POST") {
    const site = String(body.sourceKey ?? "").split("/")[0];
    if (failCopy.has(site)) {
      return send(res, 500, { statusCode: "500", error: "mock copy failure" });
    }
    const result = await pool.query(
      `insert into storage.objects (bucket_id, name, metadata)
       select bucket_id, $3, metadata from storage.objects
       where bucket_id = $1 and name = $2
       on conflict (bucket_id, name) do nothing
       returning name`,
      [body.bucketId, body.sourceKey, body.destinationKey],
    );
    if (!result.rows[0]) {
      return send(res, 404, { statusCode: "404", error: "not_found" });
    }
    return send(res, 200, { Key: `${body.bucketId}/${body.destinationKey}` });
  }
  const remove = path.match(/^\/storage\/v1\/object\/([^/]+)$/);
  if (remove && req.method === "DELETE") {
    const { rows } = await pool.query(
      `delete from storage.objects where bucket_id = $1 and name = any($2)
       returning name`,
      [remove[1], body.prefixes ?? []],
    );
    return send(res, 200, rows);
  }
  return send(res, 404, { statusCode: "404", error: "not_found" });
}

// POST /__seed-asset?site=…: an uploaded image, as prompt 06 will create it.
async function seedAsset(siteId) {
  const asset = (await pool.query("select gen_random_uuid()::text as id"))
    .rows[0].id;
  const name = `${siteId}/draft/${asset}.webp`;
  await pool.query(
    `insert into public.assets (id, site_id, path, width, height, mime, bytes)
     values ($1, $2, $3, 1600, 1200, 'image/webp', 2048)`,
    [asset, siteId, name],
  );
  await pool.query(
    `insert into storage.objects (bucket_id, name, metadata)
     values ('site-assets', $1, '{"mimetype":"image/webp"}')`,
    [name],
  );
  await pool.query(
    `update public.elements set content = jsonb_set(content, '{assetId}', to_jsonb($2::text))
     where site_id = $1 and type = 'image'`,
    [siteId, asset],
  );
  await pool.query("update public.sites set og_asset_id = $2 where id = $1", [
    siteId,
    asset,
  ]);
  return { asset, name };
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

  if (path === "/__email-change") {
    const email = url.searchParams.get("email");
    return send(
      res,
      200,
      emailChanges.filter((r) => r.email === email).at(-1) ?? null,
    );
  }
  if (path === "/__calls") {
    return send(res, 200, calls.get(url.searchParams.get("email")) ?? {});
  }
  if (path.startsWith("/rest/v1/"))
    return proxyRest(req, res, path, url.search);

  if (path.startsWith("/storage/v1/")) return storageApi(req, res, path);
  if (path === "/__seed-asset" && req.method === "POST") {
    return send(res, 200, await seedAsset(url.searchParams.get("site")));
  }
  if (path === "/__fail-copy" && req.method === "POST") {
    failCopy.add(url.searchParams.get("site"));
    return send(res, 200, { ok: true });
  }
  if (path === "/__objects") {
    const { rows } = await pool.query(
      "select name from storage.objects where name like $1 order by name",
      [`${url.searchParams.get("prefix")}%`],
    );
    return send(
      res,
      200,
      rows.map((row) => row.name),
    );
  }

  if (path === "/__google" && req.method === "POST") {
    googleEnabled = url.searchParams.get("enabled") !== "false";
    return send(res, 200, { google: googleEnabled });
  }
  if (path === "/auth/v1/settings" && req.method === "GET") {
    return send(res, 200, {
      external: { email: true, google: googleEnabled, apple: false },
      disable_signup: false,
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
      await sleep(4000);
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
      return send(res, 200, await session(email));
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
        await session(Buffer.from(token.slice(8), "base64url").toString()),
      );
    }
    return authError(res, 400, "unsupported_grant_type", "unsupported grant");
  }

  if (path === "/auth/v1/verify" && req.method === "POST") {
    const body = await readJson(req);
    const token = String(body.token_hash ?? "");
    if (!token.startsWith("ok.")) {
      return authError(
        res,
        403,
        "otp_expired",
        "Email link is invalid or has expired",
      );
    }
    return send(
      res,
      200,
      await session(Buffer.from(token.slice(3), "base64url").toString()),
    );
  }

  if (path === "/auth/v1/user" && req.method === "GET") {
    const claims = bearer(req);
    if (!claims) return authError(res, 403, "bad_jwt", "invalid JWT");
    count(claims.email, "GET /auth/v1/user");
    const pending = pendingEmail.get(claims.sub);
    return send(
      res,
      200,
      userJson(
        claims.sub,
        claims.email,
        pending
          ? { new_email: pending.email, email_change_sent_at: pending.at }
          : {},
      ),
    );
  }

  // Login email change: GoTrue keeps the old address until both the old and
  // the new inbox confirm (secure email change), and returns new_email.
  if (path === "/auth/v1/user" && req.method === "PUT") {
    const claims = bearer(req);
    if (!claims) return authError(res, 403, "bad_jwt", "invalid JWT");
    const body = await readJson(req);
    const next = String(body.email ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      return authError(
        res,
        400,
        "validation_failed",
        "Unable to validate email address",
      );
    }
    pendingEmail.set(claims.sub, {
      email: next,
      at: new Date().toISOString(),
    });
    emailChanges.push({
      email: claims.email,
      new_email: next,
      redirect_to: url.searchParams.get("redirect_to"),
      at: Date.now(),
    });
    return send(
      res,
      200,
      userJson(claims.sub, claims.email, {
        new_email: next,
        email_change_sent_at: new Date().toISOString(),
      }),
    );
  }

  if (path === "/auth/v1/logout" && req.method === "POST")
    return send(res, 204);

  return authError(res, 404, "not_found", `mock has no ${req.method} ${path}`);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock auth listening on http://127.0.0.1:${PORT}`);
});
