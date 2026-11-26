import { z } from "zod";
import { elementLinkSchema, validateLink } from "./links";
import { FONT_FAMILIES, SIZE_STEPS } from "./fonts";

export { elementLinkSchema };

const uuid = z.uuid();

export const breakpointSchema = z.enum(["desktop", "mobile"]);
export const elementTypeSchema = z.enum(["text", "image", "nav", "form"]);
export const placementSourceSchema = z.enum(["auto", "manual"]);
export const linkKindSchema = z.enum(["page", "url", "email"]);

export const fontFamilySchema = z.enum(FONT_FAMILIES);
export const sizeStepSchema = z
  .number()
  .refine((n) => SIZE_STEPS.includes(n as (typeof SIZE_STEPS)[number]));

export const textContentSchema = z.object({
  text: z.string(),
  fontFamily: fontFamilySchema,
  fontSize: sizeStepSchema,
  fontWeight: z.union([z.literal(400), z.literal(500)]),
  align: z.enum(["left", "center", "right"]),
  link: elementLinkSchema.optional(),
  sample: z.literal(true).optional(),
});

export const imageContentSchema = z.object({
  assetId: z.uuid().nullable(),
  alt: z.string(),
  aspectLocked: z.boolean(),
  link: elementLinkSchema.optional(),
  sample: z.literal(true).optional(),
});

export const formContentSchema = z
  .object({
    fields: z.array(z.enum(["name", "email", "message"])),
    buttonLabel: z.string(),
  })
  .strict();

export const navContentSchema = z.object({}).strict();

const strictTextContentSchema = textContentSchema.strict();
const strictImageContentSchema = imageContentSchema.strict();

export const gridBoxSchema = z
  .object({
    col: z.number().int().min(1).max(12),
    span: z.number().int().min(1).max(12),
    row: z.number().int().min(1),
    rows: z.number().int().min(1),
  })
  .refine((b) => b.col + b.span - 1 <= 12, {
    message: "columns must fit in the 12-column grid",
  });

export const elementLayoutSchema = gridBoxSchema.extend({
  id: uuid,
  elementId: uuid,
  breakpoint: breakpointSchema,
  hidden: z.boolean(),
  placementSource: placementSourceSchema,
});

const elementIdentity = {
  id: uuid,
  pageId: uuid.nullable(),
  sectionId: uuid,
  name: z.string().min(1).max(60),
  sortOrder: z.number().int(),
};

export const editorElementSchema = z.discriminatedUnion("type", [
  z.object({
    ...elementIdentity,
    type: z.literal("text"),
    content: strictTextContentSchema,
  }),
  z.object({
    ...elementIdentity,
    type: z.literal("image"),
    content: strictImageContentSchema,
  }),
  z.object({
    ...elementIdentity,
    type: z.literal("nav"),
    content: navContentSchema,
  }),
  z.object({
    ...elementIdentity,
    type: z.literal("form"),
    content: formContentSchema,
  }),
]);

export const editorSectionSchema = z.object({
  id: uuid,
  pageId: uuid.nullable(),
  name: z.string().min(1).max(60),
  sortOrder: z.number().int(),
});

export const editorPageSchema = z.object({
  id: uuid,
  title: z.string().min(1).max(60),
  slug: z.string().max(50),
  sortOrder: z.number().int(),
  inNav: z.boolean(),
  isHome: z.boolean(),
});

export const editorAssetSchema = z.object({
  path: z.string().min(1),
  mime: z.string().optional(),
});

export const editorDocSchema = z
  .object({
    siteId: uuid,
    revision: z.number().int().min(0),
    pages: z.array(editorPageSchema),
    sections: z.array(editorSectionSchema),
    elements: z.array(editorElementSchema),
    layouts: z.array(elementLayoutSchema),
    assets: z.record(z.string(), editorAssetSchema).optional(),
  })
  .superRefine((doc, ctx) => {
    for (const [index, element] of doc.elements.entries()) {
      const link = (element.content as { link?: unknown }).link;
      if (link === undefined) continue;
      if (!validateLink(link)) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid link",
          path: ["elements", index, "content", "link"],
        });
      }
    }
  });

const tablePatchSchema = <T extends z.ZodType>(row: T) =>
  z.object({
    upsert: z.array(row).optional(),
    delete: z.array(uuid).optional(),
  });

/** save_draft changes document (snake_case row fields). */
export const draftChangesSchema = z
  .object({
    pages: tablePatchSchema(
      z.object({
        id: uuid,
        title: z.string(),
        slug: z.string(),
        sort_order: z.number().int(),
        in_nav: z.boolean(),
        is_home: z.boolean(),
      }),
    ).optional(),
    sections: tablePatchSchema(
      z.object({
        id: uuid,
        page_id: uuid.nullable(),
        name: z.string(),
        sort_order: z.number().int(),
      }),
    ).optional(),
    elements: tablePatchSchema(
      z.object({
        id: uuid,
        page_id: uuid.nullable(),
        section_id: uuid,
        type: elementTypeSchema,
        name: z.string(),
        content: z.record(z.string(), z.unknown()),
        sort_order: z.number().int(),
      }),
    ).optional(),
    element_layouts: tablePatchSchema(
      z.object({
        id: uuid,
        element_id: uuid,
        breakpoint: breakpointSchema,
        col_start: z.number().int(),
        col_span: z.number().int(),
        row_start: z.number().int(),
        row_span: z.number().int(),
        hidden: z.boolean(),
        placement_source: placementSourceSchema,
      }),
    ).optional(),
  })
  .superRefine((changes, ctx) => {
    changes.elements?.upsert?.forEach((row, index) => {
      const parsed = storedDraftElementSchema.safeParse(row);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          message: "invalid_content",
          path: ["elements", "upsert", index],
        });
      }
    });
  });

const storedDraftElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    content: strictTextContentSchema,
  }),
  z.object({
    type: z.literal("image"),
    content: strictImageContentSchema,
  }),
  z.object({
    type: z.literal("nav"),
    content: navContentSchema,
  }),
  z.object({
    type: z.literal("form"),
    content: formContentSchema,
  }),
]);

export type DraftChanges = z.infer<typeof draftChangesSchema>;
