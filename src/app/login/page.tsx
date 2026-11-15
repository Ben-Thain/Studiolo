import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { WordmarkBar } from "@/components/auth/wordmark";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "Log in · Studiolo" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <>
      <WordmarkBar />
      <AuthPanel
        mode="login"
        next={safeNext(typeof next === "string" ? next : null)}
      />
    </>
  );
}
