import type { ElementLink, ElementType } from "./types";

export type EditorCommand =
  | {
      type: "addElement";
      sectionId: string;
      elementType: ElementType;
      name?: string;
      content?: Record<string, unknown>;
      pageId?: string | null;
      sortOrder?: number;
    }
  | { type: "deleteElement"; elementId: string }
  | {
      type: "updateContent";
      elementId: string;
      content: Record<string, unknown>;
    }
  | { type: "updateName"; elementId: string; name: string }
  | {
      type: "setLayout";
      elementId: string;
      breakpoint: "desktop" | "mobile";
      layout: Partial<{
        col: number;
        span: number;
        row: number;
        rows: number;
        hidden: boolean;
      }>;
    }
  | {
      type: "setHidden";
      elementId: string;
      breakpoint: "desktop" | "mobile";
      hidden: boolean;
    }
  | { type: "reorderElement"; elementId: string; sortOrder: number }
  | {
      type: "addSection";
      pageId: string | null;
      name: string;
      sortOrder?: number;
    }
  | { type: "deleteSection"; sectionId: string }
  | { type: "renameSection"; sectionId: string; name: string }
  | { type: "restackSection"; sectionId: string }
  | { type: "setLink"; elementId: string; link: ElementLink | null }
  | {
      type: "addPage";
      title: string;
      slug: string;
      inNav?: boolean;
      isHome?: boolean;
      sortOrder?: number;
    }
  | {
      type: "updatePage";
      pageId: string;
      patch: Partial<{
        title: string;
        slug: string;
        sortOrder: number;
        inNav: boolean;
        isHome: boolean;
      }>;
    }
  | { type: "deletePage"; pageId: string };
