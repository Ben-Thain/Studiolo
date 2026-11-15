import type { Metadata } from "next";
import { SignedInPlaceholder } from "@/components/auth/placeholder-page";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sites · Studiolo" };

// Placeholder until prompt 03b builds this screen.
export default async function SitesPage() {
  const user = await requireUser("/sites");
  return <SignedInPlaceholder title="Sites" email={user.email} />;
}
