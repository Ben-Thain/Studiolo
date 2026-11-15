import type { Metadata } from "next";
import { Wordmark } from "@/components/auth/wordmark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found · Studiolo",
  robots: { index: false, follow: false },
};

// App 404 (app-404.png): unknown app routes, and notFound() for another
// user's or a deleted site id. Prompt 09 reuses this layout on public hosts.
export default function NotFound() {
  return (
    <>
      <header className="flex h-14 items-center border-b border-line px-6">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-[528px] px-6 pt-16 min-[900px]:pt-[200px]">
        <h1 className="text-xl leading-7 font-medium tracking-[-0.01em] text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-5 text-ink-2">
          This page doesn&apos;t exist, or you&apos;re signed in to a different
          account.
        </p>
        <Button href="/sites" size="lg" className="mt-6">
          Go to Sites
        </Button>
      </main>
    </>
  );
}
