"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duplicateSite } from "@/app/(app)/sites/actions";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { HOME_COPY } from "@/lib/home/copy";
import { SITES_COPY } from "@/lib/sites/copy";

/**
 * The row ⋯ menu (d-sites.png): Duplicate, View live (only when Live),
 * divider, Delete. Prompt 04b wires Delete; until then it is shown disabled.
 */
export function SiteRowMenu({
  siteId,
  name,
  live,
  url,
}: {
  siteId: string;
  name: string;
  live: boolean;
  url: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    if (busy) return;
    setBusy(true);
    const result = await duplicateSite(siteId).catch(() => ({
      ok: false as const,
      error: SITES_COPY.duplicateFailed(name),
    }));
    setBusy(false);
    if (!result.ok) {
      toast({ message: result.error, region: "home" });
      router.refresh();
      return;
    }
    toast({
      message: result.message,
      region: "home",
      action: {
        label: SITES_COPY.openEditor,
        onClick: () => router.push(`/sites/${result.siteId}`),
      },
    });
    router.push(`/sites?highlight=${result.siteId}`, { scroll: false });
  }

  return (
    <Menu
      align="end"
      trigger={
        <IconButton
          label={HOME_COPY.menu.label(name)}
          size="desktop"
          className="size-8"
          aria-busy={busy || undefined}
        >
          <Icon name="ellipsis" size={16} />
        </IconButton>
      }
      items={[
        {
          id: "duplicate",
          label: HOME_COPY.menu.duplicate,
          icon: <Icon name="duplicate" size={16} />,
          disabled: busy,
          onSelect: duplicate,
        },
        ...(live
          ? [
              {
                id: "view-live",
                label: HOME_COPY.menu.viewLive,
                icon: <Icon name="external" size={16} />,
                onSelect: () => {
                  window.open(url, "_blank", "noopener");
                },
              },
            ]
          : []),
        { type: "separator", id: "sep" },
        {
          id: "delete",
          label: HOME_COPY.menu.delete,
          icon: <Icon name="trash" size={16} />,
          destructive: true,
          disabled: true,
        },
      ]}
    />
  );
}
