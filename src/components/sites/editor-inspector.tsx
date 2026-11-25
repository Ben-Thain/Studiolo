"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Icon } from "@/components/ui/icons";
import { FONT_FAMILIES, SIZE_STEPS } from "@/editor/fonts";
import type { EditorCommand } from "@/editor/command-types";
import type { EditorDoc, EditorElement } from "@/editor/types";

type LayoutName = "desktop" | "mobile";

function elementTypeLabel(type: EditorElement["type"]): string {
  switch (type) {
    case "image":
      return "Image";
    case "nav":
      return "Navigation";
    case "form":
      return "Form";
    default:
      return "Text box";
  }
}

function useDebouncedFieldCommit(
  commit: (value: string) => void,
  delayMs = 600,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), delayMs);
  };
  const blur = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    commit(value);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { flush, blur };
}

export function EditorInspector({
  doc,
  pageTitle,
  layout,
  element,
  sectionName,
  onRun,
  onReplace,
  onDelete,
}: {
  doc: EditorDoc;
  pageTitle: string;
  layout: LayoutName;
  element: EditorElement | null;
  sectionName: string;
  onRun: (command: EditorCommand) => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const layoutName = layout === "mobile" ? "Mobile" : "Desktop";
  const box = element
    ? doc.layouts.find(
        (item) => item.elementId === element.id && item.breakpoint === layout,
      )
    : null;
  const thumb =
    element?.type === "image" && element.content.assetId
      ? doc.assets?.[String(element.content.assetId)]?.readUrl
      : undefined;

  const altCommit = useDebouncedFieldCommit((value) => {
    if (!element) return;
    onRun({
      type: "updateContent",
      elementId: element.id,
      content: { alt: value },
    });
  });

  const linkValue = element?.content.link
    ? String((element.content.link as { value?: string }).value ?? "")
    : "";

  return (
    <aside className="hidden w-[288px] shrink-0 flex-col border-l border-line bg-bg min-[900px]:flex">
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {!element ? (
          <>
            <h2 className="text-sm font-medium text-ink">{pageTitle}</h2>
            <p className="mt-1 text-xs text-ink-3">
              Page · {layoutName} layout
            </p>
            <p className="mt-4 text-sm leading-5 text-ink-2">
              Select something on the page to edit it. Press T for a text box or
              I for an image.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-sm font-medium text-ink">{element.name}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {elementTypeLabel(element.type)} · {sectionName} section ·{" "}
              {layoutName}
            </p>
            <hr className="my-4 border-line" />
            {element.type === "image" ? (
              <div>
                <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-control bg-surface-2">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-ink-2">{element.name}</span>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={onReplace}>
                  Replace image
                </Button>
              </div>
            ) : null}
            {element.type === "text" ? (
              <div className="flex flex-col gap-3">
                <label className="text-xs text-ink-3">
                  Font
                  <select
                    className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                    value={String(element.content.fontFamily ?? "Inter")}
                    onChange={(event) =>
                      onRun({
                        type: "updateContent",
                        elementId: element.id,
                        content: { fontFamily: event.target.value },
                      })
                    }
                  >
                    {FONT_FAMILIES.map((family) => (
                      <option key={family}>{family}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-ink-3">
                  Size
                  <select
                    className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                    value={String(element.content.fontSize ?? 18)}
                    onChange={(event) =>
                      onRun({
                        type: "updateContent",
                        elementId: element.id,
                        content: { fontSize: Number(event.target.value) },
                      })
                    }
                  >
                    {SIZE_STEPS.map((step) => (
                      <option key={step} value={step}>
                        {step}
                      </option>
                    ))}
                  </select>
                </label>
                <Segmented
                  label="Align"
                  value={String(element.content.align ?? "left")}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Centre" },
                    { value: "right", label: "Right" },
                  ]}
                  onChange={(value) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { align: value },
                    })
                  }
                />
              </div>
            ) : null}
            {element.type === "nav" ? (
              <p className="text-sm text-ink-2">
                Shows pages that are in the menu.
              </p>
            ) : null}
            {element.type === "form" ? (
              <label className="block text-xs text-ink-3">
                Button label
                <input
                  className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                  defaultValue={String(element.content.buttonLabel ?? "")}
                  onBlur={(event) =>
                    onRun({
                      type: "updateContent",
                      elementId: element.id,
                      content: { buttonLabel: event.target.value },
                    })
                  }
                />
              </label>
            ) : null}
            {element.type === "text" || element.type === "image" ? (
              <>
                <hr className="my-4 border-line" />
                <label className="block text-xs text-ink-3">
                  Link
                  <input
                    className="mt-1 h-8 w-full rounded-control border border-line px-2 text-sm"
                    placeholder="Add a link"
                    defaultValue={linkValue}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (!value) {
                        onRun({
                          type: "setLink",
                          elementId: element.id,
                          link: null,
                        });
                        return;
                      }
                      const kind = value.includes("@")
                        ? "email"
                        : value.startsWith("http")
                          ? "url"
                          : "page";
                      onRun({
                        type: "setLink",
                        elementId: element.id,
                        link: { kind, value },
                      });
                    }}
                  />
                </label>
                {element.type === "image" ? (
                  <label className="mt-4 block text-xs text-ink-3">
                    Alt text
                    <textarea
                      className="mt-1 w-full rounded-control border border-line p-2 text-sm text-ink"
                      defaultValue={String(element.content.alt ?? "")}
                      placeholder="Describe the image for screen readers"
                      onChange={(event) => altCommit.flush(event.target.value)}
                      onBlur={(event) => altCommit.blur(event.target.value)}
                    />
                  </label>
                ) : null}
                <hr className="my-4 border-line" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink">Hide on {layout}</span>
                  <Toggle
                    label={`Hide on ${layout}`}
                    checked={box?.hidden ?? false}
                    onChange={(hidden) =>
                      onRun({
                        type: "setHidden",
                        elementId: element.id,
                        breakpoint: layout,
                        hidden,
                      })
                    }
                  />
                </div>
                <p className="mt-2 text-xs text-ink-3">
                  Position and size are per layout. The image is shared.
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
      {element &&
      (element.type === "text" ||
        element.type === "image" ||
        element.type === "form") ? (
        <footer className="border-t border-line px-4 py-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-error"
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />
            Delete from both layouts
          </button>
        </footer>
      ) : null}
    </aside>
  );
}
