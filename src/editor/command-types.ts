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
  | { type: "duplicateElement"; elementId: string }
  | {
      type: "updateContent";
      elementId: string;
      content: Record<string, unknown>;
    }
  | { type: "updateName"; elementId: string; name: string }
  | { type: "renameLayer"; elementId: string; name: string }
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
      type: "move";
      elementId: string;
      breakpoint: "desktop" | "mobile";
      col: number;
      row: number;
    }
  | {
      type: "resize";
      elementId: string;
      breakpoint: "desktop" | "mobile";
      col: number;
      row: number;
      span: number;
      rows: number;
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
  | { type: "reorderSection"; sectionId: string; sortOrder: number }
  | { type: "restackSection"; sectionId: string }
  | { type: "resetMobileAuto"; pageId: string }
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
        inNav: boolean;
        isHome: boolean;
      }>;
    }
  | { type: "setHome"; pageId: string }
  | { type: "setInNav"; pageId: string; inNav: boolean }
  | { type: "reorderPages"; pageId: string; sortOrder: number }
  | { type: "deletePage"; pageId: string }
  | {
      type: "moveToSection";
      elementId: string;
      sectionId: string;
      col: number;
      row: number;
    }
  | {
      type: "arrange";
      elementId: string;
      breakpoint: "desktop" | "mobile";
      to: "front" | "back" | "forward" | "backward";
    };
