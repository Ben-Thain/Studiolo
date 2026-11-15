"use client";

import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { HOME_COPY } from "@/lib/home/copy";

/**
 * The row ⋯ menu (d-sites.png). Prompt 04 wires Duplicate, View live and
 * Delete; until then the items are shown disabled.
 */
export function SiteRowMenu({ name, live }: { name: string; live: boolean }) {
  return (
    <Menu
      align="end"
      trigger={
        <IconButton
          label={HOME_COPY.menu.label(name)}
          size="desktop"
          className="size-8"
        >
          <Icon name="ellipsis" size={16} />
        </IconButton>
      }
      items={[
        {
          id: "duplicate",
          label: HOME_COPY.menu.duplicate,
          icon: <Icon name="duplicate" size={16} />,
          disabled: true,
        },
        ...(live
          ? [
              {
                id: "view-live",
                label: HOME_COPY.menu.viewLive,
                icon: <Icon name="external" size={16} />,
                disabled: true,
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
