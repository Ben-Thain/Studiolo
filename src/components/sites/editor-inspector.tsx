"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { Icon } from "@/components/ui/icons";
import { GRID_COLUMNS, ROW_UNIT_PX } from "@/editor/grid";
import { DESIGN_WIDTH, STAGE_PADDING_X } from "@/lib/editor/stage-coords";
import { FONT_FAMILIES, SIZE_STEPS } from "@/editor/fonts";
import { ensureFontFace } from "@/lib/editor/load-font";
import type { EditorCommand } from "@/editor/command-types";
import type { EditorDoc, EditorElement, GridBox } from "@/editor/types";

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
              {element.type === "image" && element.content.sample === true
                ? `Sample image · ${sectionName} section`
                : `${elementTypeLabel(element.type)} · ${sectionName} section · ${layoutName}`}
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
                    onFocus={() =>
                      FONT_FAMILIES.forEach((family) => ensureFontFace(family))
                    }
                    onChange={(event) => {
                      ensureFontFace(event.target.value);
                      onRun({
                        type: "updateContent",
                        elementId: element.id,
                        content: { fontFamily: event.target.value },
                      });
                    }}
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
                {box ? (
                  <PositionFields
                    key={`${element.id}:${layout}:${box.col}:${box.row}:${box.span}:${box.rows}`}
                    box={box}
                    layout={layout}
                    onCommit={(next) =>
                      onRun({
                        type: "resize",
                        elementId: element.id,
                        breakpoint: layout,
                        ...next,
                      })
                    }
                  />
                ) : null}
                <div className="mt-3 flex items-center gap-1">
                  <span className="mr-1 text-xs text-ink-2">Arrange</span>
                  {(
                    [
                      ["front", "Bring to front"],
                      ["forward", "Bring forward"],
                      ["backward", "Send backward"],
                      ["back", "Send to back"],
                    ] as const
                  ).map(([to, label]) => (
                    <Tooltip key={to} label={label}>
                      <button
                        type="button"
                        aria-label={label}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-line text-ink-2 hover:bg-surface"
                        onClick={() =>
                          onRun({
                            type: "arrange",
                            elementId: element.id,
                            breakpoint: layout,
                            to,
                          })
                        }
                      >
                        <Icon
                          name={
                            to === "front" || to === "forward"
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={14}
                        />
                      </button>
                    </Tooltip>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
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
                  {element.type === "image"
                    ? "Position and size are per layout. The image is shared."
                    : "Position and size are per layout."}
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

const MOBILE_WIDTH = 393;

function designUnit(layout: LayoutName): number {
  const width = layout === "mobile" ? MOBILE_WIDTH : DESIGN_WIDTH;
  return (width - STAGE_PADDING_X * 2) / GRID_COLUMNS;
}

function PositionFields({
  box,
  layout,
  onCommit,
}: {
  box: GridBox;
  layout: LayoutName;
  onCommit: (next: {
    col: number;
    row: number;
    span: number;
    rows: number;
  }) => void;
}) {
  const unit = designUnit(layout);
  const shown = {
    X: Math.round((box.col - 1) * unit),
    Y: (box.row - 1) * ROW_UNIT_PX,
    W: Math.round(box.span * unit),
    H: box.rows * ROW_UNIT_PX,
  };
  const [draft, setDraft] = useState(shown);
  const commit = () => {
    const col = Math.min(
      GRID_COLUMNS,
      Math.max(1, Math.round(draft.X / unit) + 1),
    );
    const row = Math.max(1, Math.round(draft.Y / ROW_UNIT_PX) + 1);
    const span = Math.min(
      GRID_COLUMNS - col + 1,
      Math.max(2, Math.round(draft.W / unit)),
    );
    const rows = Math.max(2, Math.round(draft.H / ROW_UNIT_PX));
    onCommit({ col, row, span, rows });
  };
  return (
    <div>
      <p className="text-xs font-medium text-ink-2">Position</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(["X", "Y", "W", "H"] as const).map((field) => (
          <label key={field} className="text-[11px] text-ink-3">
            {field}
            <input
              aria-label={field}
              inputMode="numeric"
              className="mt-1 h-8 w-full rounded-control border border-line px-1.5 text-xs text-ink"
              value={draft[field]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field]: Number(event.target.value),
                }))
              }
              onBlur={commit}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
