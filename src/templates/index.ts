import blankJson from "./blank/template.json";
import folioJson from "./folio/template.json";
import gouacheJson from "./gouache/template.json";
import linenJson from "./linen/template.json";
import plinthJson from "./plinth/template.json";
import stillJson from "./still/template.json";
import { templateSchema, type TemplateFile } from "./schema";

export const TEMPLATE_ORDER = [
  "blank",
  "still",
  "plinth",
  "linen",
  "gouache",
  "folio",
] as const;

export type TemplateId = (typeof TEMPLATE_ORDER)[number];

const RAW: Record<TemplateId, unknown> = {
  blank: blankJson,
  still: stillJson,
  plinth: plinthJson,
  linen: linenJson,
  gouache: gouacheJson,
  folio: folioJson,
};

export type TemplateSummary = {
  id: TemplateId;
  version: number;
  name: string;
  audience: string;
  description: string;
  sampleSiteName: string;
};

export function listTemplates(): TemplateSummary[] {
  return TEMPLATE_ORDER.map((id) => {
    const template = loadTemplate(id);
    return {
      id,
      version: template.version,
      name: template.name,
      audience: template.audience,
      description: template.description,
      sampleSiteName: template.sampleSiteName,
    };
  });
}

export function loadTemplate(id: string): TemplateFile {
  if (!Object.prototype.hasOwnProperty.call(RAW, id)) {
    throw new Error(`Unknown template: ${id}`);
  }
  return templateSchema.parse(RAW[id as TemplateId]);
}

export function isTemplateId(id: string): id is TemplateId {
  return Object.prototype.hasOwnProperty.call(RAW, id);
}
