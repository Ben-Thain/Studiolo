"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import type { AddressParts } from "@/lib/addresses";
import { SITES_COPY } from "@/lib/sites/copy";
import { NewSiteForm } from "./new-site-form";

/**
 * "New site" (d-new-site.png): the Sites page-head button and its dialog.
 * /sites?new=1 opens it too (the mobile nav bar's + links there).
 */
export function NewSiteButton({
  parts,
  requested = false,
}: {
  parts: AddressParts;
  requested?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(requested);
  // /sites?new=1 again (the mobile +) reopens it.
  const [wasRequested, setWasRequested] = useState(requested);
  if (requested !== wasRequested) {
    setWasRequested(requested);
    if (requested) setOpen(true);
  }

  function close() {
    setOpen(false);
    if (requested) router.replace(pathname, { scroll: false });
  }

  return (
    <>
      <Button
        size="sm"
        icon={<Icon name="plus" size={16} />}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {SITES_COPY.newTitle}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={SITES_COPY.newTitle}
        lead={SITES_COPY.newLead}
      >
        <NewSiteForm variant="dialog" parts={parts} onCancel={close} />
      </Dialog>
    </>
  );
}
