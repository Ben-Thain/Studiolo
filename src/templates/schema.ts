import { z } from "zod";

const localId = z.string().min(1);

const templateBoxSchema = z.object({
  colStart: z.number().int().min(1).max(12),
  colSpan: z.number().int().min(1).max(12),
  rowStart: z.number().int().min(1),
  rowSpan: z.number().int().min(1),
  hidden: z.boolean(),
  placementSource: z.enum(["manual", "auto"]),
});

export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  version: z.number().int().positive(),
  name: z.string().min(1),
  audience: z.string().min(1),
  description: z.string(),
  sampleSiteName: z.string().min(1),
  pages: z.array(
    z.object({
      id: localId,
      title: z.string().min(1),
      slug: z.string(),
      sortOrder: z.number().int(),
      inNav: z.boolean(),
      isHome: z.boolean(),
    }),
  ),
  sections: z.array(
    z.object({
      id: localId,
      pageId: localId.nullable(),
      name: z.string().min(1),
      sortOrder: z.number().int(),
    }),
  ),
  elements: z.array(
    z.object({
      id: localId,
      pageId: localId.nullable(),
      sectionId: localId,
      type: z.enum(["text", "image", "nav", "form"]),
      name: z.string().min(1),
      content: z.record(z.string(), z.unknown()),
      sortOrder: z.number().int(),
    }),
  ),
  layouts: z.record(
    z.string(),
    z.object({
      desktop: templateBoxSchema,
      mobile: templateBoxSchema,
    }),
  ),
  assets: z.array(
    z.object({
      key: z.string().min(1),
      file: z.string().min(1),
      mime: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      bytes: z.number().int().positive(),
      blurDataUrl: z.string(),
      source: z.unknown(),
    }),
  ),
});

export type TemplateFile = z.infer<typeof templateSchema>;
