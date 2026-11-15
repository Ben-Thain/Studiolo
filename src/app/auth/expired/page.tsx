import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { WordmarkBar } from "@/components/auth/wordmark";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "This link has expired · Studiolo" };

type Props = {
  searchParams: Promise<{
    next?: string | string[];
    email?: string | string[];
  }>;
};

export default async function AuthExpiredPage({ searchParams }: Props) {
  const { next, email } = await searchParams;
  const prefill =
    typeof email === "string" && email.length <= 254 ? email.trim() : "";
  return (
    <>
      <WordmarkBar />
      <AuthPanel
        mode="expired"
        next={safeNext(typeof next === "string" ? next : null)}
        initialEmail={prefill}
      />
    </>
  );
}
