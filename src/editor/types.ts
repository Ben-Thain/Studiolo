/**
 * In-memory editor document (prompt 05). CamelCase in the model; save_draft
 * uses the snake_case DraftChanges shape from schema.ts.
 */

export type Breakpoint = "desktop" | "mobile";

export type ElementType = "text" | "image" | "nav" | "form";

export type PlacementSource = "auto" | "manual";

export type TextAlign = "left" | "center" | "right";

export type LinkKind = "page" | "url" | "email";

export type FontFamily = "Inter" | "Georgia" | "Times New Roman";

export type SizeStep = 13 | 16 | 18 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 108;

export type EditorAsset = {
  path: string;
  mime?: string;
};

export type ElementLink = {
  kind: LinkKind;
  value: string;
};

export type TextContent = {
  text: string;
  fontFamily: FontFamily;
  fontSize: SizeStep;
  fontWeight: 400 | 500;
  align: TextAlign;
  link?: ElementLink;
};

export type ImageContent = {
  assetId: string | null;
  alt: string;
  aspectLocked: boolean;
  link?: ElementLink;
};

export type FormField = "name" | "email" | "message";

export type FormContent = {
  fields: FormField[];
  buttonLabel: string;
};

export type NavContent = Record<string, never>;

export type GridBox = {
  col: number;
  span: number;
  row: number;
  rows: number;
};

export type ElementLayout = GridBox & {
  id: string;
  elementId: string;
  breakpoint: Breakpoint;
  hidden: boolean;
  placementSource: PlacementSource;
};

export type EditorElement = {
  id: string;
  pageId: string | null;
  sectionId: string;
  type: ElementType;
  name: string;
  content: Record<string, unknown>;
  sortOrder: number;
};

export type EditorSection = {
  id: string;
  pageId: string | null;
  name: string;
  sortOrder: number;
};

export type EditorPage = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  inNav: boolean;
  isHome: boolean;
};

/** The full editable draft of one site. */
export type EditorDoc = {
  siteId: string;
  revision: number;
  pages: EditorPage[];
  sections: EditorSection[];
  elements: EditorElement[];
  layouts: ElementLayout[];
  assets?: Record<string, EditorAsset>;
};

export type SaveStatus = "saved" | "saving" | "offline" | "error";

/** Entities touched by a command (for history inverses). */
export type DocSnapshot = {
  pages: EditorPage[];
  sections: EditorSection[];
  elements: EditorElement[];
  layouts: ElementLayout[];
  revision: number;
};
