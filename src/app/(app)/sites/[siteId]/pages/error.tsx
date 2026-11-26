"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Button } from "@/components/ui/button";

export default function PagesError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div role="alert" className="max-w-[944px]">
      <p className="text-sm leading-5 text-error">Could not load pages.</p>
      <Button
        variant="secondary"
        size="desktop"
        className="mt-3"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Retry
      </Button>
    </div>
  );
}
