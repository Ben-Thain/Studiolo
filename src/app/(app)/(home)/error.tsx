"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition } from "react";
import { InlineError } from "@/components/ui/feedback";
import { PageHead } from "@/components/ui/page-head";
import { HOME_COPY } from "@/lib/home/copy";

const TITLES: Record<string, string> = {
  "/sites": "Sites",
  "/account": "Account",
  "/plan": "Plan",
};

export default function HomeError({ reset }: { reset: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      <PageHead size="responsive" title={TITLES[pathname] ?? "Studiolo"} />
      <div role="alert">
        <InlineError
          onRetry={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          {HOME_COPY.loadFailed}
        </InlineError>
      </div>
    </>
  );
}
