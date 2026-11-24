import { applyCommand } from "@/editor/commands";
import { rivertonHomeDoc } from "../../../../tests/fixtures/riverton-home";

/** Quick headless editor smoke page for local dev (prompt 05). */
export default function DevEditorPage() {
  const intro = rivertonHomeDoc.elements.find((e) => e.name === "Intro")!;
  const { doc, changes } = applyCommand(rivertonHomeDoc, {
    type: "updateContent",
    elementId: intro.id,
    content: { text: "Dev sandbox" },
  });

  return (
    <main className="p-8 font-sans">
      <h1 className="text-lg font-medium">Editor dev</h1>
      <p className="mt-4 text-sm text-ink-2">
        Intro text after one command:{" "}
        {String(doc.elements.find((e) => e.id === intro.id)?.content.text)}
      </p>
      <pre className="mt-6 max-w-xl overflow-auto rounded-control bg-surface-2 p-4 text-xs">
        {JSON.stringify(changes, null, 2)}
      </pre>
    </main>
  );
}
