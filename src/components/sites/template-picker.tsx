"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { listTemplates, type TemplateId } from "@/templates/index";

const TEMPLATES = listTemplates();

export function templatePreviewHref(
  id: string,
  options: { name?: string; layout?: "desktop" | "mobile"; back: string },
) {
  const params = new URLSearchParams();
  params.set("layout", options.layout ?? "desktop");
  params.set("back", options.back);
  if (options.name) params.set("name", options.name);
  return `/sites/templates/${id}?${params.toString()}`;
}

export function TemplatePicker({
  value,
  onChange,
  name = "",
  backTo,
  mobileNavigate = false,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  name?: string;
  /** Where Preview returns, without the template query. */
  backTo: string;
  /** Below 900px, a tap opens the preview (blank goes to step 2). */
  mobileNavigate?: boolean;
}) {
  const router = useRouter();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function backHref(id: string) {
    const params = new URLSearchParams();
    params.set("template", id);
    if (name) params.set("name", name);
    const joiner = backTo.includes("?") ? "&" : "?";
    return `${backTo}${joiner}${params.toString()}`;
  }

  function choose(id: TemplateId, index: number) {
    if (mobileNavigate && window.matchMedia("(max-width: 899px)").matches) {
      if (id === "blank") {
        const params = new URLSearchParams();
        params.set("new", "1");
        params.set("template", "blank");
        params.set("step", "2");
        if (name) params.set("name", name);
        router.push(`/sites?${params.toString()}`);
        return;
      }
      router.push(
        templatePreviewHref(id, {
          name,
          layout: "mobile",
          back: backHref(id),
        }),
      );
      return;
    }
    onChange(id);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + TEMPLATES.length) % TEMPLATES.length;
    const id = TEMPLATES[next]!.id;
    onChange(id);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <p id="start-from" className="text-xs leading-4 font-medium text-ink-2">
        Start from
      </p>
      <div
        role="radiogroup"
        aria-labelledby="start-from"
        className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 min-[900px]:grid-cols-3 min-[900px]:gap-6"
      >
        {TEMPLATES.map((template, index) => {
          const selected = template.id === value;
          return (
            <div key={template.id} className="group min-w-0">
              <div className="relative">
                <button
                  ref={(node) => {
                    refs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${template.name}, ${template.audience}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(template.id, index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className="block w-full rounded-control text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(10,10,10,0.4)]"
                >
                  <span
                    className={cn(
                      "relative block overflow-hidden rounded-lg border border-line",
                      selected &&
                        "outline outline-2 outline-offset-2 outline-ink",
                    )}
                  >
                    <img
                      src={`/templates/${template.id}/thumb-desktop.webp`}
                      alt=""
                      className="aspect-[4/3] w-full object-cover object-top"
                    />
                    {selected ? (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-ink text-bg">
                        <Icon name="check" size={12} />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 block text-[15px] leading-5 text-ink min-[900px]:text-[13px] min-[900px]:leading-5">
                    {template.name}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[18px] text-ink-3 min-[900px]:text-xs min-[900px]:leading-4">
                    {template.audience}
                  </span>
                </button>
                {template.id !== "blank" ? (
                  <a
                    href={templatePreviewHref(template.id, {
                      name,
                      back: backHref(template.id),
                    })}
                    className={cn(
                      "absolute right-2 bottom-[52px] hidden h-7 items-center gap-1 rounded-full bg-bg px-2.5 text-xs leading-4 font-medium text-ink shadow-float",
                      "min-[900px]:group-hover:inline-flex min-[900px]:group-focus-within:inline-flex",
                      selected && "min-[900px]:inline-flex",
                    )}
                  >
                    <Icon name="eye" size={14} />
                    Preview
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
