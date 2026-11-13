import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "bg",
        "fill-selected",
        "fill-hover",
        "canvas",
        "surface-2",
        "ink",
        "ink-2",
        "ink-3",
        "ink-4",
        "ink-disabled",
        "ink-hover",
        "line",
        "error",
        "error-hover",
      ],
      radius: ["control", "control-inner", "pop", "dialog", "sheet"],
      shadow: ["pop", "float", "dialog"],
    },
  },
});

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter((part): part is string => Boolean(part)));
}
