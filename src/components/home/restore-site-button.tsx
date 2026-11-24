"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { restoreSite } from "@/app/(app)/sites/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SITES_COPY } from "@/lib/sites/copy";

export function RestoreSiteButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (busy) return;
    setBusy(true);
    const result = await restoreSite(siteId).catch(() => ({
      ok: false as const,
      error: SITES_COPY.restoreFailed,
    }));
    setBusy(false);
    if (!result.ok) {
      toast({ message: result.error, region: "home" });
      if ("expired" in result && result.expired) router.replace("/sites");
      else router.refresh();
      return;
    }
    const message = result.slugChanged
      ? SITES_COPY.restoredRenamed(result.name, result.address)
      : SITES_COPY.restored(result.name);
    router.push(`/sites?highlight=${result.siteId}`);
    router.refresh();
    toast({
      message,
      region: "home",
      action: {
        label: SITES_COPY.openEditor,
        onClick: () => router.push(`/sites/${result.siteId}`),
      },
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={restore}
    >
      {SITES_COPY.restore}
    </Button>
  );
}