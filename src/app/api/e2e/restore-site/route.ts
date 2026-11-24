import { restoreSite } from "@/app/(app)/sites/actions";

/** E2e-only hook so tests can call restoreSite with a real session cookie. */
export async function POST(request: Request) {
  if (process.env.E2E_STACK !== "1") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    siteId?: string;
  } | null;
  if (!body?.siteId) {
    return Response.json({ error: "siteId required" }, { status: 400 });
  }
  const result = await restoreSite(body.siteId);
  return Response.json(result);
}
