import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { WordmarkBar } from "@/components/auth/wordmark";
import { safeNext } from "@/lib/auth/next";
import { isGoogleEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Create an account · Studiolo" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignupPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <>
      <WordmarkBar />
      <AuthPanel
        mode="signup"
        googleEnabled={await isGoogleEnabled()}
        next={safeNext(typeof next === "string" ? next : null)}
      />
    </>
  );
}
