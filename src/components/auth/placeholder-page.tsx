import { WordmarkBar } from "@/components/auth/wordmark";

/**
 * Minimal signed-in placeholder so the guarded routes resolve. Prompt 03b
 * replaces these with the home shell (sidebar, Sites list, Account, Plan).
 */
export function SignedInPlaceholder({
  title,
  email,
}: {
  title: string;
  email: string | undefined;
}) {
  return (
    <>
      <WordmarkBar />
      <main className="mx-auto w-full max-w-[408px] px-6 pt-16 min-[900px]:pt-[136px]">
        <h1 className="text-[28px] leading-9 font-medium tracking-[-0.02em] text-ink min-[900px]:text-2xl min-[900px]:leading-8">
          {title}
        </h1>
        <p className="mt-2 text-base leading-6 text-ink-3 min-[900px]:text-sm min-[900px]:leading-5">
          {email ? `Signed in as ${email}.` : "Signed in."}
        </p>
      </main>
    </>
  );
}
