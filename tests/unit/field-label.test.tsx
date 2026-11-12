// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CopyField } from "@/components/ui/copy-field";
import { Field, LockedInput } from "@/components/ui/field";

afterEach(() => {
  cleanup();
});

describe("Field labels", () => {
  it("connects Live at to CopyField", () => {
    render(
      <Field label="Live at">
        <CopyField value="rivertonhouse.co.uk" label="Live at" />
      </Field>,
    );
    expect(screen.getByLabelText("Live at")).toHaveProperty(
      "value",
      "rivertonhouse.co.uk",
    );
  });

  it("connects Live at to LockedInput", () => {
    render(
      <Field label="Live at">
        <LockedInput label="Live at" value="riverton-house" />
      </Field>,
    );
    expect(screen.getByLabelText("Live at")).toHaveProperty("value", "riverton-house");
  });
});
