import type { Metadata } from "next";
import { SignedInPlaceholder } from "@/components/auth/placeholder-page";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Plan · Studiolo" };

// Placeholder until prompt 03b builds this screen.
export default async function PlanPage() {
  const user = await requireUser("/plan");
  return <SignedInPlaceholder title="Plan" email={user.email} />;
}
