import { describe, expect, it } from "vitest";
import { formatDayMonth, formatLastEdited } from "@/lib/dates";

describe("dates", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("shows the time for today, in the viewer's time zone", () => {
    expect(
      formatLastEdited(new Date("2026-11-15T09:42:00Z"), now, "Europe/London"),
    ).toBe("Today, 09:42");
    expect(
      formatLastEdited(new Date("2026-11-15T09:42:00Z"), now, "Asia/Tokyo"),
    ).toBe("Today, 18:42");
  });

  it("shows Just now for under a minute ago", () => {
    expect(formatLastEdited(new Date("2026-11-15T12:00:00Z"), now, "UTC")).toBe(
      "Just now",
    );
    expect(formatLastEdited(new Date("2026-11-15T11:59:01Z"), now, "UTC")).toBe(
      "Just now",
    );
    // A few seconds "in the future" (clock skew) is still Just now.
    expect(formatLastEdited(new Date("2026-11-15T12:00:05Z"), now, "UTC")).toBe(
      "Just now",
    );
    expect(formatLastEdited(new Date("2026-11-15T11:59:00Z"), now, "UTC")).toBe(
      "Today, 11:59",
    );
  });

  it("shows day and month for other days", () => {
    expect(
      formatLastEdited(new Date("2026-11-06T15:00:00Z"), now, "Europe/London"),
    ).toBe("6 Nov");
    // Just before midnight in New York is still yesterday there.
    expect(
      formatLastEdited(
        new Date("2026-11-15T04:30:00Z"),
        now,
        "America/New_York",
      ),
    ).toBe("14 Nov");
  });

  it("formats en-GB day and month", () => {
    expect(formatDayMonth(new Date("2026-11-09T10:00:00Z"), "UTC")).toBe(
      "9 Nov",
    );
  });

  it("returns nothing for an invalid date", () => {
    expect(formatLastEdited(new Date("nope"), now, "UTC")).toBe("");
  });
});
