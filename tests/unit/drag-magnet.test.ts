import { describe, expect, it } from "vitest";
import {
  elementSnapTargets,
  magnet,
  sectionSnapTargets,
  snapPxBox,
} from "@/editor/drag";

describe("magnet", () => {
  const targets = [
    { position: 100, label: "Edge" as const },
    { position: 200, label: "Centre" as const },
  ];

  it("pulls only within 6px", () => {
    expect(magnet(96, targets, 6).value).toBe(100);
    expect(magnet(93, targets, 6).value).toBe(93);
    expect(magnet(100, targets, 6).guide?.label).toBe("Edge");
  });

  it("skips targets when Alt is held", () => {
    const box = { x: 96, y: 10, w: 40, h: 40 };
    const snapped = snapPxBox(
      box,
      { x: targets, y: [{ position: 12, label: "Edge" }] },
      6,
      true,
    );
    expect(snapped.box).toEqual(box);
    expect(snapped.guides).toEqual([]);
  });

  it("uses only the section's own targets, in section coordinates", () => {
    const section = sectionSnapTargets(1376);
    expect(section.x.some((target) => target.label === "Column")).toBe(true);
    expect(section.x[0]?.position).toBe(0);
    const peer = elementSnapTargets({ x: 40, y: 16, w: 80, h: 32 });
    expect(peer.y.map((target) => target.position)).toEqual([16, 48, 32]);
    const snapped = snapPxBox(
      { x: 10, y: 14, w: 80, h: 32 },
      { x: section.x, y: peer.y },
      6,
    );
    expect(snapped.guides.every((guide) => guide.position >= 0)).toBe(true);
  });
});
