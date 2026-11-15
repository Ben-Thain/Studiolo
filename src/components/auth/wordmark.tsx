import Link from "next/link";
import { cn } from "@/lib/utils";

/** The `Studiolo` wordmark: 16px 500, links home. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        // 44px tall hit area; the bar centres it, so the glyphs do not move.
        "inline-flex min-h-11 items-center rounded-control text-base leading-6 font-medium tracking-[-0.02em] text-ink",
        className,
      )}
    >
      Studiolo
    </Link>
  );
}

/**
 * The wordmark bar shared by sign-up, log-in, the auth states and the app 404.
 * 56px below 900px; 64px on desktop, matching the 03 refs (wordmark glyphs at
 * y 25–37, like the landing bar). 48px side margin on desktop, 24px below
 * 900px. No hairline.
 */
export function WordmarkBar() {
  return (
    <header className="flex h-14 items-center px-6 min-[900px]:h-16 min-[900px]:px-12">
      <Wordmark />
    </header>
  );
}
