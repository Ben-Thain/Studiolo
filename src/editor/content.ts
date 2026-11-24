import { textContentSchema } from "./schema";
import type { TextContent } from "./types";

export function parseTextContent(
  patch: Record<string, unknown>,
  base?: Partial<TextContent>,
): TextContent {
  return textContentSchema.parse({ ...(base ?? {}), ...patch }) as TextContent;
}
