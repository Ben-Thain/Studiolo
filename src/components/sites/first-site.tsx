"use client";

import { useState } from "react";
import type { AddressParts } from "@/lib/addresses";
import { RecentlyDeletedLink } from "@/components/home/recently-deleted-link";
import { SITES_COPY } from "@/lib/sites/copy";
import { isTemplateId, type TemplateId } from "@/templates/index";
import { NewSiteForm } from "./new-site-form";
import { TemplatePicker } from "./template-picker";

/**
 * Zero sites: an 816px column, 40px down, with the template picker.
 * On the phone the name fields stay on step 2 of /sites?new=1.
 */
export function FirstSite({
  parts,
  restorableCount = 0,
  initialTemplate = "blank",
  initialName = "",
  focusName = false,
}: {
  parts: AddressParts;
  restorableCount?: number;
  initialTemplate?: string;
  initialName?: string;
  focusName?: boolean;
}) {
  const [templateId, setTemplateId] = useState<TemplateId>(
    isTemplateId(initialTemplate) ? initialTemplate : "blank",
  );
  const [name, setName] = useState(initialName);

  return (
    <section
      aria-labelledby="first-site-title"
      className="mx-auto w-full max-w-[816px] pt-10"
    >
      <h1
        id="first-site-title"
        className="text-2xl leading-8 font-medium text-ink max-[899px]:text-[28px] max-[899px]:leading-9"
      >
        {SITES_COPY.firstTitle}
      </h1>
      <p className="mt-3 text-sm leading-5 text-ink-3 max-[899px]:text-base max-[899px]:leading-6">
        {SITES_COPY.firstLead}
      </p>
      <div className="mt-8">
        <TemplatePicker
          value={templateId}
          onChange={setTemplateId}
          name={name}
          backTo="/sites"
          mobileNavigate
        />
      </div>
      <div className="max-[899px]:hidden">
        <NewSiteForm
          variant="first"
          parts={parts}
          templateId={templateId}
          nameValue={name}
          onNameChange={setName}
          focusName={focusName}
        />
      </div>
      <div className="mt-6 hidden justify-center min-[900px]:flex">
        <RecentlyDeletedLink count={restorableCount} />
      </div>
    </section>
  );
}
