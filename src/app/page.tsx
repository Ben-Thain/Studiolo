import { Wordmark } from "@/components/auth/wordmark";
import { Button } from "@/components/ui/button";

// Public landing. Signed-in visitors are sent to /sites by the middleware.
// `?ref=<slug>` (the "Made with Studiolo" credit) is accepted and ignored.

export default function LandingPage() {
  return (
    <>
      <header className="flex h-16 items-center justify-between px-6 min-[900px]:px-12">
        <Wordmark />
        {/* Ghost sm on desktop; a 44px tap target below 900px. */}
        <Button
          href="/login"
          variant="ghost"
          size="sm"
          className="max-[899px]:h-11 max-[899px]:text-base"
        >
          Log in
        </Button>
      </header>
      <main className="px-6 pt-16 pb-16 min-[900px]:pt-[200px] min-[900px]:pl-[160px]">
        <h1 className="max-w-[600px] text-[40px] leading-[44px] font-medium tracking-[-0.03em] text-ink min-[900px]:text-[56px] min-[900px]:leading-[60px]">
          A stunning personal website, in 5 minutes.
        </h1>
        <p className="mt-6 max-w-[520px] text-lg leading-7 text-ink-2">
          Pages, photos and a contact form, published at your own address.
        </p>
        <div className="mt-10 flex flex-col gap-2 min-[900px]:flex-row">
          <Button href="/signup" size="block">
            Get started
          </Button>
          <Button href="/login" variant="secondary" size="block">
            Log in
          </Button>
        </div>
      </main>
    </>
  );
}
