"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Wordmark } from "@/components/auth/wordmark";
import { Button } from "@/components/ui/button";

// When the home shell itself can't load (e.g. the profile read fails). Same
// layout as the app 404.
export default function AppError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <>
      <header className="flex h-14 items-center border-b border-line px-6">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-[528px] px-6 pt-16 min-[900px]:pt-[200px]">
        <h1 className="text-xl leading-7 font-medium tracking-[-0.01em] text-ink">
          Something went wrong
        </h1>
        <p role="alert" className="mt-2 text-sm leading-5 text-ink-2">
          We couldn&apos;t load this page. Try again in a moment.
        </p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </Button>
      </main>
    </>
  );
}
