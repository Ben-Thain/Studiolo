import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// The home shell (prompt 03b) against real data: the mock signs real JWTs and
// proxies /rest/v1 to a local PostgREST on the seeded studiolo_e2e database
// (see playwright.config.ts). sam@example.com is the seeded account.
const MOCK = "http://127.0.0.1:54399";
const SAM = "sam@example.com";
const RIVERTON = "5a000000-0000-4000-8000-000000000011";
const NORTH_LIGHT = "5a000000-0000-4000-8000-000000000012";

function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Follows a magic link for `email`, as the emailed link would. */
async function signInAs(page: Page, email: string, next = "/sites") {
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
  await expect(page).toHaveURL(next);
}

test.describe("sites (seeded account)", () => {
  test("lists the seeded sites with status, address and last edited", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sites" }),
    ).toBeVisible();
    await expect(
      page.locator("main").getByText("Open a site to edit it."),
    ).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText([
      "Site",
      "Status",
      "Domain",
      "Last edited",
      "Actions",
    ]);
    const rows = table.getByRole("row");
    await expect(rows).toHaveCount(4);
    // Most recently edited first; Riverton House was edited today.
    await expect(rows.nth(1)).toContainText("Riverton House");
    await expect(rows.nth(1)).toContainText("Live");
    await expect(rows.nth(1)).toContainText("Password on");
    await expect(rows.nth(1)).toContainText("rivertonhouse.example.com");
    await expect(rows.nth(1)).toContainText(/Today, \d\d:\d\d/);
    await expect(rows.nth(2)).toContainText("North Light");
    await expect(rows.nth(2)).toContainText("127.0.0.1:3000/s/north-light");
    await expect(rows.nth(2)).toContainText(/\d{1,2} [A-Z][a-z]{2,3}/);
    await expect(rows.nth(3)).toContainText("Mara Lind");
    await expect(rows.nth(3)).toContainText("Draft");
    // The sidebar is account-level only: no site list in it.
    const nav = page.getByRole("navigation", { name: "Home" });
    await expect(nav.getByRole("link")).toHaveText([
      "Sites",
      "Account",
      "Plan",
    ]);
    await expect(page.getByText("Trial · 5 days left")).toBeVisible();
    await expect(page.getByText("Sam Carter").first()).toBeVisible();
  });

  test("rows are real links: click or Enter opens the site", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    const link = page.getByRole("link", { name: "North Light" });
    await expect(link).toHaveAttribute("href", `/sites/${NORTH_LIGHT}`);
    // A click anywhere on the row (here, on the status) opens it.
    const status = await page
      .getByRole("row", { name: /North Light/ })
      .getByText("Live")
      .boundingBox();
    await page.mouse.click(status!.x + 4, status!.y + status!.height / 2);
    // /sites/[siteId] opens the editor on the home page (prompt 04a).
    await expect(page).toHaveURL(
      `/sites/${NORTH_LIGHT}/editor/5a000000-0000-4000-8000-000000000026`,
    );
    await expect(
      page.getByRole("heading", { name: "North Light: Home" }),
    ).toBeAttached();
    await page.goto("/sites");
    await page.getByRole("link", { name: "Mara Lind" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/sites\/5a000000-0000-4000-8000-000000000013\/editor\//,
    );
  });

  test("the row menu opens with its items in order and closes on Escape", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    const trigger = page.getByRole("button", {
      name: "Actions for North Light",
    });
    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Duplicate",
      "View live",
      "Delete",
    ]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL("/sites");
  });

  test("no payment UI anywhere in the home shell", async ({ page }) => {
    await signInAs(page, SAM);
    for (const path of ["/sites", "/account", "/plan"]) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      for (const word of [
        "£",
        "$",
        "€",
        "price",
        "upgrade",
        "stripe",
        "pay now",
        "billing",
        "checkout",
      ]) {
        expect(text, `${path} mentions ${word}`).not.toContain(word);
      }
    }
  });
});

test.describe("new account", () => {
  test("sees an empty Sites page and a full trial", async ({ page }) => {
    const email = uniqueEmail("fresh");
    await signInAs(page, email);
    // Zero sites: the empty state leads with creating (prompt 04a).
    await expect(
      page.getByRole("heading", { level: 1, name: "Create your first site" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("Trial · 7 days left")).toBeVisible();
    // No display name yet: the sidebar account row shows the email.
    await expect(page.getByText(email).first()).toBeVisible();
  });

  test("the sites list shows the loading skeleton, then the page", async ({
    page,
  }) => {
    const email = uniqueEmail("slow");
    await signInAs(page, email, "/account");
    await page.getByRole("link", { name: "Sites" }).first().click();
    const loading = page
      .getByRole("status")
      .filter({ hasText: "Loading sites" });
    await expect(loading).toBeVisible();
    // Same geometry as the loaded table: the 40px header and 56px rows.
    await expect(loading.getByRole("columnheader")).toHaveCount(5);
    const rows = loading.locator("[aria-hidden=true] > div");
    await expect(rows).toHaveCount(3);
    expect((await rows.first().boundingBox())!.height).toBe(56);
    await expect(
      page.getByRole("heading", { name: "Create your first site" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("a failed sites read shows an inline error with Retry", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("fail-sites"), "/account");
    await page.getByRole("link", { name: "Sites" }).first().click();
    await expect(page.locator("main [role=alert]")).toContainText(
      "We couldn't load this page.",
    );
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    // The shell stays: the sidebar is still there.
    await expect(page.getByText("Trial · 7 days left")).toBeVisible();
  });

  test("a failed profile read shows the error page", async ({ page }) => {
    const email = uniqueEmail("fail-data");
    const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
    await page.goto(
      `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=%2Fsites`,
    );
    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("trial", () => {
  test("one day left reads singular", async ({ page }) => {
    await signInAs(page, uniqueEmail("trial-1"), "/plan");
    await expect(page.getByText("Trial · 1 day left")).toBeVisible();
    await expect(page.getByText("1 of 7 days left")).toBeVisible();
  });

  test("an ended trial locks nothing", async ({ page }) => {
    await signInAs(page, uniqueEmail("trial-ended"), "/plan");
    await expect(page.getByText("Trial ended").first()).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "7",
    );
    await expect(
      page.getByText(
        "Nothing locks when the trial ends yet. Paid plans aren't available.",
      ),
    ).toBeVisible();
    await page.getByRole("link", { name: "Sites" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Create your first site" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create site" }),
    ).toBeEnabled();
  });
});

test.describe("plan", () => {
  test("renders the copy verbatim with real dates", async ({ page }) => {
    await signInAs(page, SAM, "/plan");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Plan");
    await expect(main).toContainText("Your trial includes everything in Pro.");
    await expect(
      main.getByRole("heading", { name: "Pro trial" }),
    ).toBeVisible();
    await expect(main).toContainText("5 of 7 days left");
    await expect(main).toContainText(/Started \d{1,2} [A-Z][a-z]{2,3}/);
    await expect(main).toContainText(/Ends \d{1,2} [A-Z][a-z]{2,3}/);
    await expect(main.getByRole("listitem")).toHaveText([
      "Sites, pages and custom domains",
      "Password-protected sites",
      "Contact form and submissions",
      "Stats",
    ]);
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(main.getByRole("link")).toHaveCount(0);
  });
});

test.describe("account", () => {
  test("name edits persist", async ({ page }) => {
    await signInAs(page, uniqueEmail("name"), "/account");
    await page.getByRole("button", { name: "Edit name" }).click();
    const field = page.getByRole("textbox", { name: "Name" });
    await expect(field).toBeFocused();
    await field.fill("   ");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await field.fill("Hannah  Price");
    await field.press("Enter");
    await expect(page.getByRole("button", { name: "Edit name" })).toBeFocused();
    await expect(page.locator("main")).toContainText("Hannah Price");
    await page.reload();
    await expect(page.locator("main")).toContainText("Hannah Price");
    // The sidebar account row picks it up too.
    await expect(page.getByText("HP", { exact: true })).toBeVisible();
  });

  test("Escape cancels an edit without saving", async ({ page }) => {
    await signInAs(page, uniqueEmail("cancel"), "/account");
    await page.getByRole("button", { name: "Edit name" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Not saved");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main")).not.toContainText("Not saved");
  });

  test("form notifications validate, persist and fall back to the login email", async ({
    page,
  }) => {
    const email = uniqueEmail("notify");
    await signInAs(page, email, "/account");
    const row = page
      .locator("main")
      .getByText("Form notifications")
      .locator("..");
    await expect(row).toContainText(email);
    await expect(row).toContainText("Submissions from all sites go here.");
    await page
      .getByRole("button", { name: "Change form notifications" })
      .click();
    const field = page.getByRole("textbox", { name: "Form notifications" });
    await field.fill("not-an-email");
    await field.press("Enter");
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await field.fill("Studio@Example.com");
    await field.press("Enter");
    await expect(row).toContainText("studio@example.com");
    await page.reload();
    await expect(row).toContainText("studio@example.com");
    // Clearing it sends submissions to the login email again.
    await page
      .getByRole("button", { name: "Change form notifications" })
      .click();
    await page.getByRole("textbox", { name: "Form notifications" }).fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(row).toContainText(email);
    await page.reload();
    await expect(row).not.toContainText("studio@example.com");
  });

  test("login email change goes through Supabase's confirm flow", async ({
    page,
  }) => {
    const email = uniqueEmail("change");
    await signInAs(page, email, "/account");
    await page.getByRole("button", { name: "Change login email" }).click();
    const field = page.getByRole("textbox", { name: "Login email" });
    await field.fill(email);
    await field.press("Enter");
    await expect(
      page.getByText("That's already your login email."),
    ).toBeVisible();
    const next = uniqueEmail("new");
    await field.fill(next);
    await field.press("Enter");
    await expect(
      page.getByText("Check both inboxes to confirm the change"),
    ).toBeVisible();
    const change = await (
      await page.request.get(
        `${MOCK}/__email-change?email=${encodeURIComponent(email)}`,
      )
    ).json();
    expect(change.new_email).toBe(next);
    const redirect = new URL(change.redirect_to);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/account");
    // Until both inboxes confirm, the login email is unchanged, and after a
    // reload the pending address is shown.
    await expect(
      page.locator("main").getByText("Login email").locator(".."),
    ).toContainText(email);
    await page.reload();
    await expect(
      page.getByText(`Waiting for confirmation: ${next}`),
    ).toBeVisible();
    await expect(
      page.locator("main").getByText("Login email").locator(".."),
    ).toContainText(email);
  });

  test("one /account render makes one Auth call and one profile read", async ({
    page,
  }) => {
    const email = uniqueEmail("calls");
    await signInAs(page, email, "/account");
    const calls = async () =>
      (await (
        await page.request.get(
          `${MOCK}/__calls?email=${encodeURIComponent(email)}`,
        )
      ).json()) as Record<string, number>;
    const before = await calls();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Account" }),
    ).toBeVisible();
    const after = await calls();
    const delta = (key: string) => (after[key] ?? 0) - (before[key] ?? 0);
    // One in the middleware (session refresh) and one for the whole render:
    // the layout and the page share getUser() and getHomeContext().
    expect(delta("GET /auth/v1/user")).toBe(2);
    expect(delta("GET /rest/v1/profiles")).toBe(1);
    expect(delta("HEAD /rest/v1/sites")).toBe(1);
  });

  test("delete account is shown but not available yet", async ({ page }) => {
    await signInAs(page, SAM, "/account");
    await expect(
      page.getByText(
        "Removes all three sites, their images, submissions and domains. This can't be undone.",
      ),
    ).toBeVisible();
    const button = page.getByRole("button", { name: "Delete account" });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toHaveAttribute("title", "Available soon");
    await button.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("sign out lands on / and guards apply again", async ({ page }) => {
    await signInAs(page, uniqueEmail("signout"), "/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        name: "A stunning personal website, in 5 minutes.",
      }),
    ).toBeVisible();
    await page.goto("/sites");
    await expect(page).toHaveURL("/login?next=%2Fsites");
  });
});

test.describe("deep links and 404", () => {
  test("a signed-out deep link survives login", async ({ page }) => {
    const path = "/sites/abc/settings";
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    const email = uniqueEmail("deep");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    const otp = await (
      await page.request.get(`${MOCK}/__otp?email=${encodeURIComponent(email)}`)
    ).json();
    const link = new URL(otp.redirect_to);
    link.searchParams.set(
      "code",
      `ok.${Buffer.from(email).toString("base64url")}`,
    );
    await page.goto(link.toString());
    await expect(page).toHaveURL(path);
  });

  test("login with an external next lands on /sites", async ({ page }) => {
    await page.goto("/login?next=https://evil.example");
    const email = uniqueEmail("evil");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    const otp = await (
      await page.request.get(`${MOCK}/__otp?email=${encodeURIComponent(email)}`)
    ).json();
    const link = new URL(otp.redirect_to);
    link.searchParams.set(
      "code",
      `ok.${Buffer.from(email).toString("base64url")}`,
    );
    await page.goto(link.toString());
    await expect(page).toHaveURL("/sites");
  });

  test("unknown app routes render the app 404 with noindex", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This page doesn't exist, or you're signed in to a different account.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to Sites" }),
    ).toHaveAttribute("href", "/sites");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("another user's site, a bad id and an unknown sub-route are 404", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("other"));
    for (const path of [
      `/sites/${RIVERTON}`,
      "/sites/5a000000-0000-4000-8000-0000000000ff",
      "/sites/abc",
      "/sites/abc/settings",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(
        page.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
    }
  });

  test("a soft-deleted site is not listed and is 404", async ({ page }) => {
    const email = uniqueEmail("deleted");
    await signInAs(page, email);
    const db = new pg.Client({
      connectionString: process.env.E2E_DB_URL ?? "postgresql:///studiolo_e2e",
    });
    await db.connect();
    let deletedId: string;
    try {
      const { rows } = await db.query<{ id: string }>(
        `insert into public.sites (owner_id, name, slug, deleted_at)
         select id, 'Old Studio', $2, now() from auth.users where email = $1
         returning id`,
        [email, `old-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
      );
      deletedId = rows[0].id;
      await db.query(
        `insert into public.sites (owner_id, name, slug)
         select id, 'Kept Studio', $2 from auth.users where email = $1`,
        [email, `kept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
      );
    } finally {
      await db.end();
    }
    await page.goto("/sites");
    await expect(page.getByRole("link", { name: "Kept Studio" })).toBeVisible();
    await expect(page.getByText("Old Studio")).toHaveCount(0);
    const response = await page.goto(`/sites/${deletedId}`);
    expect(response?.status()).toBe(404);
    for (const sub of [
      `/sites/${deletedId}/pages`,
      `/sites/${deletedId}/settings`,
      `/sites/${deletedId}/stats`,
    ]) {
      const subResponse = await page.goto(sub);
      expect(subResponse?.status(), sub).toBe(404);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });
});

test.describe("mobile home", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("nav bar, 32/40 title, 64px rows and a 56px tab bar", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    await expect(page.getByRole("table")).toBeHidden();
    const title = page.getByRole("heading", { level: 1, name: "Sites" });
    await expect(title).toHaveCSS("font-size", "32px");
    await expect(title).toHaveCSS("line-height", "40px");
    const plus = page.getByRole("link", { name: "New site" });
    const plusBox = await plus.boundingBox();
    expect(plusBox!.width).toBeGreaterThanOrEqual(44);
    expect(plusBox!.height).toBeGreaterThanOrEqual(44);
    const rows = page.getByRole("list").first().getByRole("link");
    await expect(rows).toHaveCount(3);
    for (const box of await Promise.all(
      (await rows.all()).map((row) => row.boundingBox()),
    )) {
      expect(box!.height).toBeGreaterThanOrEqual(64);
    }
    const tabs = page.getByRole("navigation", { name: "Sections" });
    const tabBox = await tabs.boundingBox();
    expect(tabBox!.height).toBeGreaterThanOrEqual(56);
    for (const tab of await tabs.getByRole("link").all()) {
      const box = await tab.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(tabs.getByRole("link", { name: "Sites" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await tabs.getByRole("link", { name: "Plan" }).click();
    await expect(page).toHaveURL("/plan");
    await expect(page.getByRole("link", { name: "New site" })).toHaveCount(0);
  });

  test("every control on the home screens is at least 44px", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    for (const path of ["/sites", "/account", "/plan"]) {
      await page.goto(path);
      const controls = page.locator(
        "main a, main button, header a, header button, nav a",
      );
      for (const control of await controls.all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        const name =
          (await control.innerText()) ||
          (await control.getAttribute("aria-label"));
        expect(box!.height, `${path} ${name}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("account inline edit: full-width 16px input, buttons underneath", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("mobile-input"), "/account");
    await expect(
      page.getByText("Removes your account. This can't be undone."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit name" }).click();
    const input = page.getByRole("textbox", { name: "Name" });
    await expect(input).toHaveCSS("font-size", "16px");
    const inputBox = (await input.boundingBox())!;
    expect(inputBox.width).toBeGreaterThanOrEqual(393 - 48 - 1);
    const save = (await page
      .getByRole("button", { name: "Save" })
      .boundingBox())!;
    const cancel = (await page
      .getByRole("button", { name: "Cancel" })
      .boundingBox())!;
    expect(save.y).toBeGreaterThan(inputBox.y + inputBox.height);
    expect(Math.abs(save.y - cancel.y)).toBeLessThan(1);
    expect(save.height).toBeGreaterThanOrEqual(44);
    await input.fill("");
    await page.getByRole("button", { name: "Save" }).click();
    const error = page.getByText("Enter your name.");
    await expect(error).toBeVisible();
    const errorBox = (await error.boundingBox())!;
    expect(errorBox.y).toBeGreaterThan(inputBox.y + inputBox.height);
    expect(errorBox.y).toBeLessThan(save.y);
    expect(errorBox.height).toBeLessThanOrEqual(16);
  });

  test("the 404 button is a 48px block button", async ({ page }) => {
    await page.goto("/nowhere");
    const box = (await page
      .getByRole("link", { name: "Go to Sites" })
      .boundingBox())!;
    expect(box.height).toBe(48);
  });

  test("the nav bar is 44px and the title sits 8px below it", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    const bar = (await page.locator("header").first().boundingBox())!;
    expect(bar.height).toBe(44);
    const title = (await page
      .getByRole("heading", { level: 1, name: "Sites" })
      .boundingBox())!;
    expect(title.y).toBe(52);
  });
});

test.describe("home accessibility", () => {
  for (const path of ["/sites", "/account", "/plan"]) {
    for (const [label, viewport] of [
      ["desktop", { width: 1440, height: 900 }],
      ["mobile", { width: 393, height: 852 }],
    ] as const) {
      test(`${path} (${label}) has no axe violations`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await signInAs(page, SAM, path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }

  test("the 404 and an open row menu have no axe violations", async ({
    page,
  }) => {
    await page.goto("/missing");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await signInAs(page, SAM);
    await page.getByRole("button", { name: "Actions for North Light" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    // The kit portals floating menus to <body>, outside the landmarks, so the
    // best-practice "region" rule is off for this state only.
    expect(
      (await new AxeBuilder({ page }).disableRules(["region"]).analyze())
        .violations,
    ).toEqual([]);
  });

  test("account edit state has no axe violations", async ({ page }) => {
    await signInAs(page, uniqueEmail("axe-edit"), "/account");
    await page.getByRole("button", { name: "Edit name" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
