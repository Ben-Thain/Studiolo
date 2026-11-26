/** Lazy-load a webfont stylesheet the first time a family is used. */

const STYLESHEETS: Record<string, string> = {
  Geist: "/fonts/Geist.css",
  Manrope: "/fonts/Manrope.css",
  "Instrument Serif": "/fonts/Instrument-Serif.css",
};

export function fontStylesheet(family: string): string | null {
  return STYLESHEETS[family] ?? null;
}

export function ensureFontFace(family: string): void {
  if (typeof document === "undefined") return;
  const href = fontStylesheet(family);
  if (!href) return;
  const id = `font-face-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
