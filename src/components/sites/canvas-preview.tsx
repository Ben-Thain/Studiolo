"use client";

import { useEffect, type CSSProperties } from "react";
import { ensureFontFace } from "@/lib/editor/load-font";
import { Icon } from "@/components/ui/icons";
import { mobileFontSize } from "@/editor/fonts";
import type { SizeStep } from "@/editor/types";
import { lineHeightForSizeStep } from "@/lib/editor/typography";
import { gridPlacement, GRID_AUTO_ROWS } from "@/editor/renderGrid";
import type { GridBox } from "@/editor/types";
import type {
  CanvasElement,
  CanvasLayout,
  CanvasSection,
} from "@/lib/sites/data";
import { cn } from "@/lib/utils";

/**
 * A read-only draft preview for the editor route until prompt 06 builds the
 * editor: each section is a 12-column CSS grid with 8px rows, elements placed
 * with grid-column / grid-row from their desktop layout (900px and up) or
 * mobile layout (below).
 */

function place(layout: CanvasLayout): CSSProperties {
  const box: GridBox = {
    col: layout.col,
    span: layout.span,
    row: layout.row,
    rows: layout.rows,
  };
  return gridPlacement(box);
}

function Element({
  element,
  navTitles,
  mobile,
}: {
  element: CanvasElement;
  navTitles: string[];
  mobile: boolean;
}) {
  const c = element.content;
  useEffect(() => {
    if (element.type === "text") {
      ensureFontFace(String(c.fontFamily ?? "Inter"));
    }
  }, [element.type, c.fontFamily]);
  if (element.type === "text") {
    const desktopSize = Number(c.fontSize ?? 16);
    const size = mobile ? mobileFontSize(desktopSize) : desktopSize;
    return (
      <p
        className="whitespace-pre-line text-ink"
        style={{
          fontSize: size,
          fontFamily: String(c.fontFamily ?? "Inter"),
          lineHeight: lineHeightForSizeStep(desktopSize as SizeStep),
          fontWeight: Number(c.fontWeight ?? 400) === 500 ? 500 : 400,
          textAlign: (c.align as CSSProperties["textAlign"]) ?? "left",
          letterSpacing: size >= 28 ? "-0.02em" : undefined,
        }}
      >
        {String(c.text ?? "")}
      </p>
    );
  }
  if (element.type === "nav") {
    return (
      <ul
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-1 text-sm leading-5 text-ink-2",
          !mobile && "justify-end",
        )}
      >
        {navTitles.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    );
  }
  if (element.type === "image") {
    return (
      <div className="flex h-full min-h-16 flex-col items-center justify-center gap-2 rounded-control bg-surface-2 text-xs leading-4 text-ink-2">
        <Icon name="image" size={20} />
        <span>{element.name}</span>
      </div>
    );
  }
  const label = String(c.buttonLabel ?? "Send");
  return (
    <div className="flex flex-col gap-3 text-xs leading-4 text-ink-3">
      {["Name", "Email", "Message"].map((field) => (
        <div key={field} className="flex flex-col gap-1">
          <span>{field}</span>
          <span
            className={cn(
              "block rounded-control border border-line",
              field === "Message" ? "h-20" : "h-8",
            )}
          />
        </div>
      ))}
      <span className="inline-flex h-8 w-fit items-center rounded-control bg-ink px-3 text-[13px] font-medium text-bg">
        {label}
      </span>
    </div>
  );
}

function SectionGrid({
  section,
  navTitles,
  mobile,
}: {
  section: CanvasSection;
  navTitles: string[];
  mobile: boolean;
}) {
  const placed = section.elements.filter((element) => {
    const layout = mobile ? element.mobile : element.desktop;
    return layout && !layout.hidden;
  });
  return (
    <div
      data-section={section.name}
      className="grid grid-cols-12 gap-x-6 py-4"
      // Rows grow to fit text (the editor in prompt 06 measures them), so a
      // heading that wraps never runs into the element below it.
      style={{ gridAutoRows: GRID_AUTO_ROWS }}
    >
      {placed.map((element) => (
        <div
          key={element.id}
          data-element={element.name}
          className="min-w-0"
          style={place((mobile ? element.mobile : element.desktop)!)}
        >
          <Element element={element} navTitles={navTitles} mobile={mobile} />
        </div>
      ))}
    </div>
  );
}

export function CanvasPreview({
  sections,
  navTitles,
  label,
}: {
  sections: CanvasSection[];
  navTitles: string[];
  label: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className="mx-auto w-full max-w-[960px] rounded-dialog border border-line bg-bg px-5 py-4 min-[900px]:px-8 min-[900px]:py-6"
    >
      <div data-preview="mobile" className="min-[900px]:hidden">
        {sections.map((section) => (
          <SectionGrid
            key={section.id}
            section={section}
            navTitles={navTitles}
            mobile
          />
        ))}
      </div>
      <div data-preview="desktop" className="hidden min-[900px]:block">
        {sections.map((section) => (
          <SectionGrid
            key={section.id}
            section={section}
            navTitles={navTitles}
            mobile={false}
          />
        ))}
      </div>
    </div>
  );
}
