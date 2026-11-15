export type OriginInput = {
  host: string | null;
  forwardedProto: string | null;
  requestProtocol: string;
  nodeEnv: string | undefined;
  appUrl: string;
  vercelUrl?: string;
  vercelBranchUrl?: string;
};

function hostOnly(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/**
 * The origin the auth callback redirects on. In production it is always
 * NEXT_PUBLIC_APP_URL, except on this deployment's own Vercel URL
 * (VERCEL_URL / VERCEL_BRANCH_URL), so a forged Host or X-Forwarded-Host can
 * never move the redirect. In development any local app host is accepted,
 * because the dev server reports localhost and 127.0.0.1 interchangeably and
 * the session cookie is set on the host that received the request.
 */
export function callbackOrigin(input: OriginInput): string {
  const fallback = new URL(input.appUrl).origin;
  const host = hostOnly(input.host);
  if (!host) return fallback;

  if (input.nodeEnv === "production") {
    const deployment = [input.vercelUrl, input.vercelBranchUrl]
      .map(hostOnly)
      .filter(Boolean);
    return deployment.includes(host) ? `https://${host}` : fallback;
  }

  // Development: the app host itself, or the same port on a loopback name
  // (the dev server mixes localhost and 127.0.0.1). Nothing else.
  const app = new URL(input.appUrl);
  const appPort = app.port || (app.protocol === "https:" ? "443" : "80");
  const match = /^(localhost|127\.0\.0\.1|\[::1\])(?::(\d+))?$/.exec(host);
  const loopbackSamePort = match !== null && (match[2] ?? "80") === appPort;
  if (host !== app.host.toLowerCase() && !loopbackSamePort) return fallback;
  const proto = input.forwardedProto?.split(",")[0]?.trim();
  const scheme =
    proto === "http" || proto === "https"
      ? proto
      : input.requestProtocol.replace(":", "") === "https"
        ? "https"
        : "http";
  return `${scheme}://${host}`;
}
