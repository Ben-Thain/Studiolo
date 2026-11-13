import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "fill-selected": "var(--fill-selected)",
        "fill-hover": "var(--fill-hover)",
        canvas: "var(--canvas)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-disabled": "var(--ink-disabled)",
        "ink-4": "var(--ink-4)",
        line: "var(--line)",
        error: "var(--error)",
        "ink-hover": "var(--ink-hover)",
        "error-hover": "var(--error-hover)",
      },
      borderRadius: {
        control: "var(--r-control)",
        "control-inner": "var(--r-control-inner)",
        pop: "var(--r-pop)",
        dialog: "var(--r-dialog)",
        sheet: "var(--r-sheet)",
      },
      boxShadow: {
        pop: "var(--shadow-pop)",
        float: "var(--shadow-float)",
        dialog: "var(--shadow-dialog)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
} satisfies Config;

export default config;
