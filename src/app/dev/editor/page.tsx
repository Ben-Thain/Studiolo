import { notFound } from "next/navigation";

export default async function DevEditorPage() {
  if (process.env.NODE_ENV !== "production") {
    const { DevEditorSandbox } = await import("./dev-editor-sandbox");
    return <DevEditorSandbox />;
  }
  notFound();
}
