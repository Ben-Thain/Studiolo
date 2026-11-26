"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { useClient } from "@/components/ui/use-client";
import { CanvasPreview } from "@/components/sites/canvas-preview";
import type { CanvasSection } from "@/lib/sites/data";
import { cn } from "@/lib/utils";
import type { TemplateFile } from "@/templates/schema";

type PageRef = { id: string; title: string; slug: string };

function sectionsFor(
  template: TemplateFile,
  pageId: string,
  assetIds: Map<string, string>,
): CanvasSection[] {
  const pages = template.sections.filter(
    (section) => section.pageId === null || section.pageId === pageId,
  );
  return pages
    .slice()
    .sort(
      (a, b) =>
        Number(a.pageId !== null) - Number(b.pageId !== null) ||
        a.sortOrder - b.sortOrder,
    )
    .map((section) => ({
      id: section.id,
      name: section.name,
      siteWide: section.pageId === null,
      elements: template.elements
        .filter((element) => element.sectionId === section.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((element) => {
          const content = { ...element.content };
          if (typeof content.text === "string") {
            content.text = content.text.replaceAll(
              "{{site.name}}",
              template.sampleSiteName,
            );
          }
          if (typeof content.assetKey === "string") {
            content.assetId = assetIds.get(content.assetKey) ?? null;
            delete content.assetKey;
          }
          const boxes = template.layouts[element.id];
          const toBox = (box: (typeof boxes)["desktop"] | undefined) =>
            box
              ? {
                  col: box.colStart,
                  span: box.colSpan,
                  row: box.rowStart,
                  rows: box.rowSpan,
                  hidden: box.hidden,
                }
              : null;
          return {
            id: element.id,
            type: element.type,
            name: element.name,
            content,
            sortOrder: element.sortOrder,
            desktop: toBox(boxes?.desktop),
            mobile: toBox(boxes?.mobile),
          };
        }),
    }));
}

export function TemplatePreview({
  template,
  initialPage,
  initialLayout,
  back,
  name,
}: {
  template: TemplateFile;
  initialPage?: string;
  initialLayout?: string;
  back: string;
  name?: string;
}) {
  const router = useRouter();
  const pages: PageRef[] = template.pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
  }));
  const home = pages.find(
    (page) => template.pages.find((item) => item.id === page.id)?.isHome,
  )!;
  const [pageId, setPageId] = useState(
    pages.find((page) => page.slug === initialPage)?.id ?? home.id,
  );
  const [layout, setLayout] = useState<"desktop" | "mobile">(
    initialLayout === "mobile" ? "mobile" : "desktop",
  );
  const [narrow, setNarrow] = useState(false);
  const hydrated = useClient();
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const apply = () => {
      if (layout === "mobile" || narrow) {
        setScale(1);
        return;
      }
      const inner = Math.max(320, frame.clientWidth - 192);
      setScale(Math.min(1, inner / 1440));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [layout, narrow]);

  const assetIds = useMemo(() => {
    const map = new Map<string, string>();
    template.assets.forEach((asset, index) =>
      map.set(asset.key, `asset-${index}`),
    );
    return map;
  }, [template.assets]);

  const files = useMemo(() => {
    const map = new Map<string, string>();
    template.assets.forEach((asset, index) => {
      map.set(`asset-${index}`, `/templates/${template.id}/${asset.file}`);
    });
    return map;
  }, [template.assets, template.id]);

  const sections = sectionsFor(template, pageId, assetIds);
  const navPages = pages.filter((page) => {
    const source = template.pages.find((item) => item.id === page.id);
    return source?.inNav;
  });
  const current = pages.find((page) => page.id === pageId) ?? home;
  const shownLayout = narrow ? "mobile" : layout;

  function useTemplate() {
    const params = new URLSearchParams();
    params.set("template", template.id);
    params.set("focus", "name");
    if (name) params.set("name", name);
    if (narrow) {
      params.set("new", "1");
      params.set("step", "2");
    }
    const joiner = back.includes("?") ? "&" : "?";
    const base = back.split("?")[0] || "/sites";
    router.push(`${base}?${params.toString()}`);
    void joiner;
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg px-4 min-[900px]:px-6">
        <Link
          href={back}
          className="inline-flex h-11 items-center gap-1 text-sm text-ink min-[900px]:h-8"
        >
          <Icon name="chevron-left" size={16} />
          Back
        </Link>
        <span className="hidden h-4 w-px bg-line min-[900px]:block" />
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-ink min-[900px]:flex-none min-[900px]:text-left">
          {narrow ? template.name : template.name}
        </span>
        <span className="hidden text-[13px] text-ink-3 min-[900px]:inline">
          {template.audience}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          className="hidden min-[900px]:inline-flex"
          onClick={useTemplate}
        >
          Use this template
        </Button>
      </header>
      <div className="flex h-12 shrink-0 items-center gap-3 px-4 min-[900px]:justify-center">
        <label className="text-sm">
          <span className="sr-only">Page</span>
          <select
            aria-label="Page"
            data-hydrated={hydrated ? "" : undefined}
            value={current.slug}
            onChange={(event) => {
              const next = pages.find(
                (page) => page.slug === event.target.value,
              );
              if (next) setPageId(next.id);
            }}
            className="h-8 rounded-control border border-line bg-bg px-2 text-sm"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.slug}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <div
          className="hidden rounded-control border border-line bg-bg p-0.5 min-[900px]:inline-flex"
          role="group"
          aria-label="Layout"
        >
          {(["desktop", "mobile"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={layout === item}
              onClick={() => setLayout(item)}
              className={cn(
                "h-7 rounded-control px-3 text-sm capitalize",
                layout === item && "bg-surface-2",
              )}
            >
              {item === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[13px] text-ink-3 min-[900px]:hidden">
          {template.audience}
        </span>
      </div>
      <div
        ref={frameRef}
        className="min-h-0 flex-1 overflow-auto px-6 py-6 min-[900px]:px-24"
      >
        <div
          className={cn(
            "mx-auto bg-bg shadow-float",
            shownLayout === "mobile" ? "w-[393px]" : "origin-top",
          )}
          style={
            shownLayout === "desktop"
              ? {
                  width: 1440,
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                }
              : undefined
          }
        >
          <CanvasPreview
            sections={sections}
            navTitles={navPages.map((page) => page.title)}
            navPages={navPages}
            label={`${template.name} preview`}
            breakpoint={shownLayout}
            framed={false}
            resolveAsset={(assetId) =>
              assetId ? files.get(assetId) : undefined
            }
            onPageLink={(id) => {
              if (pages.some((page) => page.id === id)) setPageId(id);
            }}
          />
          <footer className="flex items-center justify-between border-t border-line px-8 py-6 text-xs text-ink-3">
            <span>{template.sampleSiteName}</span>
            <span>Made with Studiolo</span>
          </footer>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-line bg-bg p-4 min-[900px]:hidden">
        <Button
          type="button"
          size="touch"
          className="w-full"
          onClick={useTemplate}
        >
          Use this template
        </Button>
      </div>
    </div>
  );
}
