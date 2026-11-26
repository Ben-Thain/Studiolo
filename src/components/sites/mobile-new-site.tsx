"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { useClient } from "@/components/ui/use-client";
import type { AddressParts } from "@/lib/addresses";
import { SITES_COPY } from "@/lib/sites/copy";
import {
  isTemplateId,
  listTemplates,
  type TemplateId,
} from "@/templates/index";
import { NewSiteForm } from "./new-site-form";
import { TemplatePicker } from "./template-picker";

const TEMPLATES = listTemplates();

/**
 * Phone New site (/sites?new=1 below 900px): step 1 picks a template,
 * step 2 names it. Desktop keeps the dialog.
 */
export function MobileNewSite({
  parts,
  initialTemplate = "blank",
  initialName = "",
  initialStep = "1",
}: {
  parts: AddressParts;
  initialTemplate?: string;
  initialName?: string;
  initialStep?: string;
}) {
  const router = useRouter();
  const client = useClient();
  const titleId = useId();
  const [step, setStep] = useState(initialStep === "2" ? 2 : 1);
  const [templateId, setTemplateId] = useState<TemplateId>(
    isTemplateId(initialTemplate) ? initialTemplate : "blank",
  );
  const [name, setName] = useState(initialName);
  const template = TEMPLATES.find((item) => item.id === templateId)!;

  function close() {
    router.replace("/sites", { scroll: false });
  }

  if (!client) return null;
  // Portaled: the sites page head hides its action below 900px, and a
  // fixed overlay inside that hidden box would never show.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-40 flex flex-col bg-bg min-[900px]:hidden"
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        {step === 1 ? (
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center text-base text-ink"
          >
            {SITES_COPY.cancel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex h-11 items-center gap-1 text-base text-ink"
          >
            <Icon name="chevron-left" size={16} />
            Back
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
        <h1 id={titleId} className="text-[28px] leading-9 font-medium text-ink">
          {SITES_COPY.newTitle}
        </h1>
        {step === 1 ? (
          <>
            <p className="mt-2 text-base leading-6 text-ink-3">
              {SITES_COPY.mobileNewLead}
            </p>
            <p className="mt-6 text-[13px] leading-5 text-ink-3">
              Step 1 of 2 ·{" "}
              <span className="font-medium text-ink">Start from</span>
            </p>
            <div className="mt-4">
              <TemplatePicker
                value={templateId}
                onChange={setTemplateId}
                name={name}
                backTo="/sites?new=1"
                mobileNavigate
              />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[13px] leading-5 text-ink-3">
              Step 2 of 2 · <span className="font-medium text-ink">Name</span>
            </p>
            <div className="mt-4 flex items-center gap-3 border-y border-line py-3">
              <img
                src={`/templates/${template.id}/thumb-desktop.webp`}
                alt=""
                className="h-10 w-16 rounded-control object-cover object-top"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 font-medium text-ink">
                  {template.name}
                </span>
                <span className="block text-[13px] leading-[18px] text-ink-3">
                  {template.audience}
                </span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="touch"
                onClick={() => setStep(1)}
              >
                Change
              </Button>
            </div>
            <NewSiteForm
              variant="mobile"
              parts={parts}
              templateId={templateId}
              nameValue={name}
              onNameChange={setName}
              focusName
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
