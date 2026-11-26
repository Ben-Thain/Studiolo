"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import type { AddressParts } from "@/lib/addresses";
import { SITES_COPY } from "@/lib/sites/copy";
import { isTemplateId, type TemplateId } from "@/templates/index";
import { MobileNewSite } from "./mobile-new-site";
import { NewSiteForm } from "./new-site-form";
import { TemplatePicker } from "./template-picker";

/**
 * "New site" (d-new-site.png): the Sites page-head button and its dialog.
 * /sites?new=1 opens it too (the mobile nav bar's + links there).
 */
export function NewSiteButton({
  parts,
  requested = false,
  initialTemplate = "blank",
  initialName = "",
  focusName = false,
  initialStep = "1",
}: {
  parts: AddressParts;
  requested?: boolean;
  initialTemplate?: string;
  initialName?: string;
  focusName?: boolean;
  initialStep?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(requested);
  const [templateId, setTemplateId] = useState<TemplateId>(
    isTemplateId(initialTemplate) ? initialTemplate : "blank",
  );
  const [name, setName] = useState(initialName);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // /sites?new=1 again (the mobile +) reopens it.
  const [wasRequested, setWasRequested] = useState(requested);
  if (requested !== wasRequested) {
    setWasRequested(requested);
    if (requested) setOpen(true);
  }

  // Opened by the URL, nothing had focus: go back to New site (the page-head
  // button, or the mobile nav bar's + when the button is hidden).
  function returnFocus() {
    const button = buttonRef.current;
    if (button && button.getClientRects().length > 0) return button;
    return document.querySelector<HTMLElement>('a[href="/sites?new=1"]');
  }

  function close() {
    setOpen(false);
    if (requested) router.replace(pathname, { scroll: false });
    // After the dialog unmounts (and after a URL close refreshes the page),
    // put focus back on New site. The dialog's own restore runs first.
    window.setTimeout(() => returnFocus()?.focus(), 0);
  }

  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        icon={<Icon name="plus" size={16} />}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {SITES_COPY.newTitle}
      </Button>
      {open && narrow ? (
        <MobileNewSite
          parts={parts}
          initialTemplate={templateId}
          initialName={name}
          initialStep={initialStep}
        />
      ) : null}
      <Dialog
        open={open && !narrow}
        onClose={close}
        title={SITES_COPY.newTitle}
        lead={SITES_COPY.newLead}
        returnFocus={returnFocus}
        panelClassName="w-[760px] max-h-[calc(100vh-80px)] overflow-y-auto"
        topClassName="min-[900px]:!pt-10"
      >
        <div className="mt-6">
          <TemplatePicker
            value={templateId}
            onChange={setTemplateId}
            name={name}
            backTo="/sites?new=1"
          />
        </div>
        <NewSiteForm
          variant="dialog"
          parts={parts}
          onCancel={close}
          templateId={templateId}
          nameValue={name}
          onNameChange={setName}
          focusName={focusName}
        />
      </Dialog>
    </>
  );
}
