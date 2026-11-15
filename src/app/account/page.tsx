import type { Metadata } from "next";
import { SignedInPlaceholder } from "@/components/auth/placeholder-page";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account · Studiolo" };

// Placeholder until prompt 03b builds this screen.
export default async function AccountPage() {
  const user = await requireUser("/account");
  return <SignedInPlaceholder title="Account" email={user.email} />;
}
