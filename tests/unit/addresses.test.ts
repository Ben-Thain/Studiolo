import { describe, expect, it } from "vitest";
import {
  addressUrl,
  canonicalAddress,
  studioloAddress,
  studioloAddressParts,
} from "@/lib/addresses";

const env = {
  NEXT_PUBLIC_APP_URL: "https://studiolo.page",
  NEXT_PUBLIC_ROOT_DOMAIN: "studiolo.page",
  NEXT_PUBLIC_WILDCARD_READY: "" as const,
};

describe("addresses", () => {
  it("uses the /s/ path until the wildcard is ready", () => {
    expect(studioloAddress("north-light", env)).toBe(
      "studiolo.page/s/north-light",
    );
  });

  it("uses the subdomain once the wildcard is ready", () => {
    expect(
      studioloAddress("north-light", {
        ...env,
        NEXT_PUBLIC_WILDCARD_READY: "1",
      }),
    ).toBe("north-light.studiolo.page");
  });

  it("prefers a connected custom domain only", () => {
    const site = { slug: "riverton-house" };
    expect(
      canonicalAddress(
        site,
        { hostname: "rivertonhouse.co.uk", status: "connected" },
        env,
      ),
    ).toBe("rivertonhouse.co.uk");
    expect(
      canonicalAddress(
        site,
        { hostname: "rivertonhouse.co.uk", status: "pending" },
        env,
      ),
    ).toBe("studiolo.page/s/riverton-house");
    expect(canonicalAddress(site, null, env)).toBe(
      "studiolo.page/s/riverton-house",
    );
  });

  it("splits the address around the slug for previews", () => {
    expect(studioloAddressParts(env)).toEqual({
      before: "studiolo.page/s/",
      after: "",
    });
    expect(
      studioloAddressParts({ ...env, NEXT_PUBLIC_WILDCARD_READY: "1" }),
    ).toEqual({ before: "", after: ".studiolo.page" });
  });

  it("turns an address into a URL with the right scheme", () => {
    expect(addressUrl("rivertonhouse.co.uk", env)).toBe(
      "https://rivertonhouse.co.uk",
    );
    expect(
      addressUrl("127.0.0.1:3000/s/north-light", {
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      }),
    ).toBe("http://127.0.0.1:3000/s/north-light");
  });
});
