import Link from "next/link";
import { Wordmark } from "@/components/auth/wordmark";
import { cn } from "@/lib/utils";

// Public landing. Signed-in visitors are sent to /sites by the middleware.
// `?ref=<slug>` (the "Made with Studiolo" credit) is accepted and ignored.

const linkButton =
  "inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap";

export default function LandingPage() {
  return (
    <>
      <header className="flex h-16 items-center justify-between px-6 min-[900px]:px-12">
        <Wordmark />
        <Link
          href="/login"
          className={cn(
            linkButton,
            "h-11 px-3 text-base text-ink hover:bg-fill-hover active:bg-fill-selected min-[900px]:h-8 min-[900px]:text-sm",
          )}
        >
          Log in
        </Link>
      </header>
      <main className="px-6 pt-16 pb-16 min-[900px]:pt-[200px] min-[900px]:pl-[160px]">
        <h1 className="max-w-[600px] text-[40px] leading-[44px] font-medium tracking-[-0.03em] text-ink min-[900px]:text-[56px] min-[900px]:leading-[60px]">
          A stunning personal website, in 5 minutes.
        </h1>
        <p className="mt-6 max-w-[520px] text-lg leading-7 text-ink-2">
          Pages, photos and a contact form, published at your own address.
        </p>
        <div className="mt-10 flex flex-col gap-2 min-[900px]:flex-row">
          <Link
            href="/signup"
            className={cn(
              linkButton,
              "h-12 px-4 text-base bg-ink text-bg hover:bg-ink-hover min-[900px]:h-10 min-[900px]:text-sm",
            )}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(
              linkButton,
              "h-12 border border-line bg-bg px-4 text-base text-ink hover:bg-fill-hover active:bg-fill-selected min-[900px]:h-10 min-[900px]:text-sm",
            )}
          >
            Log in
          </Link>
        </div>
      </main>
    </>
  );
}
