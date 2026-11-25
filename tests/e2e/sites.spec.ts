import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { e2eDbUrl } from "./db";

// Prompt 04a against the local stack: create (empty state and dialog), slug
// validation, the site shell and areas, Duplicate (database + storage copy)
// and the row menu. Tests that change data use a fresh account each, so the
// seeded sam@example.com list stays as other specs expect.
const MOCK = "http://127.0.0.1:54399";
const SAM = "sam@example.com";
const RIVERTON = "5a000000-0000-4000-8000-000000000011";
const RIVERTON_HOME = "5a000000-0000-4000-8000-000000000021";
const NORTH_LIGHT = "5a000000-0000-4000-8000-000000000012";
const HOST = "127.0.0.1:3000/s/";
const UUID = "[0-9a-f-]{36}";

function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

function uniqueName(base: string) {
  return `${base} ${Math.random().toString(36).slice(2, 7)}`;
}

async function signInAs(page: Page, email: string, next = "/sites") {
  const tokenHash = `ok.${Buffer.from(email).toString("base64url")}`;
  await page.goto(
    `/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
  await expect(page).toHaveURL(next);
}

/** Creates a site from the zero-sites empty state; returns its ids. */
async function createFirstSite(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Site name" }).fill(name);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
  const [, siteId, homeId] = page
    .url()
    .match(new RegExp(`/sites/(${UUID})/editor/(${UUID})`))!;
  return { siteId, homeId };
}

test.describe("first site", () => {
  test("empty state anatomy, then create lands in the editor shell", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("first"));
    const title = page.getByRole("heading", {
      level: 1,
      name: "Create your first site",
    });
    await expect(title).toHaveCSS("font-size", "20px");
    await expect(title).toHaveCSS("line-height", "28px");
    await expect(
      page.getByText(
        "Name it, then add your words and photos. Publish when you're ready.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sites" })).toHaveCount(0);
    const name = page.getByRole("textbox", { name: "Site name" });
    await expect(name).toBeFocused();
    const column = await page.locator("section").first().boundingBox();
    expect(column!.width).toBe(480);
    expect(column!.x + column!.width / 2).toBe(240 + (1280 - 240) / 2);
    await expect(
      page.getByText(
        "The address locks after you first publish. You can connect your own domain later.",
      ),
    ).toBeVisible();
    const create = page.getByRole("button", { name: "Create site" });
    expect((await create.boundingBox())!.height).toBe(40);
    expect((await create.boundingBox())!.width).toBe(480);

    const siteName = uniqueName("Hollin Field");
    const slug = siteName.toLowerCase().replace(/ /g, "-");
    await name.fill(siteName);
    const preview = page.locator("[data-slug-preview]");
    await expect(preview).toHaveText(`${HOST}${slug}`);
    await expect(preview.locator("span.font-medium")).toHaveText(slug);

    await create.click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
    // The site shell: only ‹ Sites at the top, five nav rows, Editor selected.
    const sidebar = page.getByRole("complementary", { name: "Site" });
    await expect(sidebar.getByRole("link", { name: "Sites" })).toHaveAttribute(
      "href",
      "/sites",
    );
    await expect(
      sidebar.getByRole("navigation", { name: "Site" }).getByRole("link"),
    ).toHaveText(["Editor", "Pages", "Submissions", "Stats", "Settings"]);
    await expect(sidebar.getByRole("link", { name: "Editor" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar.getByText(siteName)).toHaveCount(0);
    await expect(sidebar.locator("[data-layers-slot]")).toBeVisible();
    // Top bar: name + Draft, no Open editor in the Editor, Publish ⌄.
    const bar = page.locator("header").first();
    await expect(bar).toContainText(siteName);
    await expect(bar).toContainText("Draft");
    await expect(bar.getByRole("link", { name: "Open editor" })).toHaveCount(0);
    const publish = bar.getByRole("button", { name: "Publish" });
    await expect(publish).toHaveAttribute("aria-disabled", "true");
    await publish.focus();
    await expect(page.getByRole("tooltip")).toHaveText("Publishing comes next");
    await expect(page.getByRole("tooltip")).toBeVisible();
    // The starter content.
    const canvas = page.getByRole("region", { name: "Home page" });
    await expect(canvas.getByText("Your heading")).toBeVisible();
    await expect(
      canvas.getByText("A line or two about what you do."),
    ).toBeVisible();
    await expect(canvas.getByText("Hero image")).toBeVisible();
    await expect(canvas.getByText(siteName)).toBeVisible();

    await sidebar.getByRole("link", { name: "Pages" }).click();
    await expect(page).toHaveURL(/\/pages$/);
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows.nth(1)).toContainText("Home");
    await expect(rows.nth(1)).toContainText("/");
    await expect(rows.nth(2)).toContainText("Contact");
    await expect(rows.nth(2)).toContainText("/contact");
    await expect(
      page.locator("header").first().getByRole("link", { name: "Open editor" }),
    ).toBeVisible();
    await expect(sidebar.locator("[data-layers-slot]")).toHaveCount(0);
  });

  test("the slug preview validates: reserved, invalid, taken + suggestion", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("slugs"));
    const name = page.getByRole("textbox", { name: "Site name" });
    await name.fill("Studio");
    await expect(page.getByText("That address is reserved.")).toBeVisible();
    await page.getByRole("button", { name: "Edit address" }).click();
    const slug = page.getByRole("textbox", { name: "Address" });
    await expect(slug).toBeFocused();
    await expect(slug).toHaveValue("studio");
    await slug.fill("ab");
    await expect(
      page.getByText("Use 3–40 lowercase letters, numbers or dashes."),
    ).toBeVisible();
    await slug.fill("Bad Slug");
    await expect(
      page.getByText("Use 3–40 lowercase letters, numbers or dashes."),
    ).toBeVisible();
    // Never silently changed: what was typed stays.
    await expect(slug).toHaveValue("Bad Slug");
    await slug.fill("riverton-house");
    await expect(page.getByText("That address is taken.")).toBeVisible();
    const use = page.getByRole("button", { name: "Use riverton-house-2" });
    await use.click();
    await expect(slug).toHaveValue("riverton-house-2");
    await expect(page.getByText("That address is taken.")).toHaveCount(0);
    // A reserved address is refused even when submitted.
    await slug.fill("admin");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByText("That address is reserved.")).toBeVisible();
    await expect(page).toHaveURL("/sites");
    // Editing the name no longer changes the edited address.
    await slug.fill(`kept-${Date.now()}`);
    const kept = await slug.inputValue();
    await name.fill("Something Else");
    await expect(slug).toHaveValue(kept);
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/editor/${UUID}$`));
  });

  test("an empty name is refused inline", async ({ page }) => {
    await signInAs(page, uniqueEmail("noname"));
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByText("Enter a name for your site.")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Site name" }),
    ).toBeFocused();
    await expect(page).toHaveURL("/sites");
  });
});

test.describe("new site dialog", () => {
  test("opens from New site and /sites?new=1, closes on Escape, creates", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("dialog"));
    await createFirstSite(page, uniqueName("Mill Lane"));
    await page.goto("/sites");
    const button = page.getByRole("button", { name: "New site" });
    await button.click();
    const dialog = page.getByRole("dialog", { name: "New site" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Give it a name. You can change the name any time."),
    ).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBe(440);
    expect(box!.y).toBe(200);
    await expect(dialog).toHaveCSS("border-radius", "12px");
    await expect(
      dialog.getByRole("textbox", { name: "Site name" }),
    ).toBeFocused();
    await expect(dialog.getByRole("button")).toHaveText([
      "Edit",
      "Cancel",
      "Create site",
    ]);
    // The actions are the small (13px, 32px) buttons of d-new-site.png.
    for (const label of ["Cancel", "Create site"]) {
      const action = dialog.getByRole("button", { name: label });
      await expect(action).toHaveCSS("font-size", "13px");
      expect((await action.boundingBox())!.height).toBe(32);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();

    // Opened by the URL (nothing had focus): Escape returns to New site,
    // not the page body.
    await page.goto("/sites?new=1");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL("/sites");
    await expect(button).toBeFocused();

    await page.goto("/sites?new=1");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL("/sites");

    await button.click();
    await dialog.getByRole("button", { name: "Create site" }).click();
    await expect(dialog.getByText("Enter a name for your site.")).toBeVisible();
    await expect(dialog).toBeVisible();
    const siteName = uniqueName("Hollin Field");
    await dialog.getByRole("textbox", { name: "Site name" }).fill(siteName);
    await expect(dialog.locator("[data-slug-preview]")).toContainText(
      siteName.toLowerCase().replace(/ /g, "-"),
    );
    await dialog.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
    await expect(page.locator("header").first()).toContainText(siteName);
  });

  test("Create site shows loading and can't be sent twice", async ({
    page,
  }) => {
    // slow.* makes every data call wait 3s.
    test.setTimeout(90_000);
    await signInAs(page, uniqueEmail("slow"));
    await page
      .getByRole("textbox", { name: "Site name" })
      .fill(uniqueName("Slow Site"));
    await page.waitForTimeout(400);
    const create = page.getByRole("button", { name: "Create site" });
    await create.click();
    await expect(create).toBeDisabled();
    await expect(create).toHaveAttribute("aria-busy", "true");
    await create.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`/editor/${UUID}$`), {
      timeout: 60_000,
    });
    await page.goto("/sites");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2, {
      timeout: 15_000,
    });
  });
});

test.describe("slug check limit", () => {
  test("too many address checks show a calm note; Create site still works", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("slug-limit");
    await signInAs(page, email);
    await request.post(
      `${MOCK}/__slug-limit?email=${encodeURIComponent(email)}`,
    );
    const name = uniqueName("Busy Studio");
    await page.getByRole("textbox", { name: "Site name" }).fill(name);
    const note = page.getByRole("status").filter({
      hasText: "Too many attempts. Wait a minute and try again.",
    });
    await expect(note).toBeVisible();
    await expect(note).toHaveCSS("color", "rgb(82, 82, 82)");
    // Not an error: no alert in the form (Next's route announcer is outside).
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
  });
});

test.describe("duplicate", () => {
  test("copies the site, its content and images as a highlighted draft", async ({
    page,
    request,
  }) => {
    await signInAs(page, uniqueEmail("dup"));
    const source = uniqueName("Field Notes");
    const { siteId } = await createFirstSite(page, source);
    const seeded = await (
      await request.post(`${MOCK}/__seed-asset?site=${siteId}`)
    ).json();
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${source}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites\\?highlight=${UUID}$`));
    const copyId = new URL(page.url()).searchParams.get("highlight")!;
    const toast = page.getByText(`Duplicated ${source}. The copy is a draft.`);
    await expect(toast).toBeVisible();
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText(`Copy of ${source}`);
    await expect(rows.nth(1)).toContainText("Draft");
    await expect(rows.nth(1)).toContainText("Just now");
    await expect(rows.nth(1)).toContainText(
      `${HOST}copy-of-${source.toLowerCase().replace(/ /g, "-")}`,
    );
    await expect(rows.nth(1)).toHaveAttribute("data-highlighted", "");
    await expect(rows.nth(1)).toHaveCSS(
      "background-color",
      "rgb(250, 250, 250)",
    );
    await expect(
      page.getByRole("link", { name: `Copy of ${source}` }),
    ).toBeFocused();
    // Images: the storage object was copied to the new site's draft folder,
    // renamed to the copied asset id.
    const objects: string[] = await (
      await request.get(`${MOCK}/__objects?prefix=${copyId}/draft/`)
    ).json();
    expect(objects).toHaveLength(1);
    expect(objects[0]).not.toContain(seeded.asset);
    const original: string[] = await (
      await request.get(`${MOCK}/__objects?prefix=${siteId}/draft/`)
    ).json();
    expect(original).toEqual([seeded.name]);
    // The highlight fades after ~4s and the URL is cleaned up.
    await expect(rows.nth(1)).not.toHaveAttribute("data-highlighted", "", {
      timeout: 8000,
    });
    await expect(page).toHaveURL("/sites");
    // The copy has the starter pages and content.
    await page.goto(`/sites/${copyId}/pages`);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    await page.goto(`/sites/${copyId}`);
    await expect(
      page.getByRole("region", { name: "Home page" }).getByText("Your heading"),
    ).toBeVisible();
  });

  test("the toast's Open editor opens the copy", async ({ page }) => {
    await signInAs(page, uniqueEmail("dup-open"));
    const source = uniqueName("Quay Street");
    await createFirstSite(page, source);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${source}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(/highlight=/);
    const copyId = new URL(page.url()).searchParams.get("highlight")!;
    await page.getByRole("button", { name: "Open editor" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/sites/${copyId}/editor/${UUID}$`),
    );
    await expect(page.locator("header").first()).toContainText(
      `Copy of ${source}`,
    );
  });

  test("a failed image copy removes the half-made copy", async ({
    page,
    request,
  }) => {
    await signInAs(page, uniqueEmail("dup-fail"));
    const source = uniqueName("Broken Copy");
    const { siteId } = await createFirstSite(page, source);
    await request.post(`${MOCK}/__seed-asset?site=${siteId}`);
    await request.post(`${MOCK}/__fail-copy?site=${siteId}`);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${source}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(
      page.getByText(`We couldn't duplicate ${source}. Try again.`),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expect(page.getByText(`Copy of ${source}`)).toHaveCount(0);
  });
});

test.describe("duplicate with a missing image file", () => {
  test("an asset whose file is missing fails cleanly and leaves no copy", async ({
    page,
    request,
  }) => {
    await signInAs(page, uniqueEmail("dup-missing"));
    const source = uniqueName("Lost Print");
    const { siteId } = await createFirstSite(page, source);
    // The asset row exists, its storage object does not.
    await request.post(`${MOCK}/__seed-asset?site=${siteId}&missing=1`);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${source}` }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(
      page.getByText(`We couldn't duplicate ${source}. Try again.`),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expect(page.getByText(`Copy of ${source}`)).toHaveCount(0);
  });
});

test.describe("delete and restore", () => {
  test("delete needs the exact name, then Undo restores a Draft", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("del-undo"));
    const north = uniqueName("North Light");
    await createFirstSite(page, north);
    await page.getByRole("link", { name: "Sites" }).click();
    await expect(page).toHaveURL("/sites");
    await page.getByRole("button", { name: `Actions for ${north}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: `Delete ${north}?` });
    await expect(dialog).toBeVisible();
    const deleteBtn = dialog.getByRole("button", { name: "Delete site" });
    await expect(deleteBtn).toBeDisabled();
    await dialog.getByRole("textbox").fill("Wrong");
    await expect(deleteBtn).toBeDisabled();
    await dialog.getByRole("textbox").fill(north);
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`${north} deleted`)).toBeVisible();
    await expect(page.getByRole("link", { name: north })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page).toHaveURL(/highlight=/);
    const row = page.getByRole("table").getByRole("row").filter({
      hasText: north,
    });
    await expect(row).toContainText("Draft");
    await expect(row).toHaveAttribute("data-highlighted", "");
    await expect(page.getByText(`${north} restored as a draft`)).toBeVisible();
    const siteId = new URL(page.url()).searchParams.get("highlight")!;
    const gone = await page.goto(`/sites/${siteId}/pages`);
    expect(gone?.status()).toBe(200);
  });

  test("Recently deleted lists a site and Restore brings it back", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("del-page"));
    const name = uniqueName("North Light");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page
      .getByRole("dialog", { name: `Delete ${name}?` })
      .getByRole("textbox")
      .fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(
      page.getByRole("link", { name: /Recently deleted \(1\)/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Recently deleted \(1\)/ }).click();
    await expect(page).toHaveURL("/sites/deleted");
    await expect(
      page.getByRole("heading", { level: 1, name: "Recently deleted" }),
    ).toBeVisible();
    const row = page.getByRole("table").getByRole("row").filter({
      hasText: name,
    });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(page).toHaveURL(/\/sites\?highlight=/);
    await expect(page.getByText(`${name} restored as a draft`)).toBeVisible();
    const response = await page.goto(`/sites/${siteId}/pages`);
    expect(response?.status()).toBe(200);
  });

  test("restore picks -2 when the address was taken", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAs(page, uniqueEmail("del-rename"));
    const slugBase = `north-light-${Math.random().toString(36).slice(2, 8)}`;
    const first = uniqueName("First Light");
    await page.getByRole("textbox", { name: "Site name" }).fill(first);
    await page.getByRole("button", { name: "Edit address" }).click();
    await page.getByRole("textbox", { name: "Address" }).fill(slugBase);
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
    await page.goto("/sites");
    await expect(page.getByRole("link", { name: first })).toBeVisible();
    await page.getByRole("button", { name: `Actions for ${first}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(first);
    await page.getByRole("button", { name: "Delete site" }).click();

    const second = uniqueName("North Light");
    await page.getByRole("textbox", { name: "Site name" }).fill(second);
    await page.getByRole("button", { name: "Edit address" }).click();
    await page.getByRole("textbox", { name: "Address" }).fill(slugBase);
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page).toHaveURL(new RegExp(`/sites/${UUID}/editor/${UUID}$`));
    await page.goto("/sites");
    await expect(page.getByRole("link", { name: second })).toBeVisible();
    await page.getByRole("link", { name: /Recently deleted \(1\)/ }).click();
    await page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: first })
      .getByRole("button", { name: "Restore" })
      .click();
    const renamed = `${slugBase}-2`;
    await expect(
      page.getByText(`${first} restored as a draft at ${HOST}${renamed}`),
    ).toBeVisible();
    await expect(
      page.getByRole("table").getByRole("row").filter({ hasText: first }),
    ).toContainText(renamed);
  });

  test("undo after delete does not bring back a custom domain", async ({
    page,
  }) => {
    const pg = await import("pg");
    const email = uniqueEmail("del-domain");
    await signInAs(page, email);
    const name = uniqueName("Domain House");
    const { siteId } = await createFirstSite(page, name);
    const slug = name.toLowerCase().replace(/ /g, "-");
    const db = new pg.Client({ connectionString: e2eDbUrl() });
    await db.connect();
    await db.query(
      `insert into public.domains (site_id, hostname, status)
       values ($1, $2, 'connected')`,
      [siteId, `custom-${slug}.example`],
    );
    await db.end();
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: `Delete ${name}?` });
    await expect(
      dialog.getByText("Its custom domain will be disconnected."),
    ).toBeVisible();
    await dialog.getByRole("textbox").fill(name);
    await dialog.getByRole("button", { name: "Delete site" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    const row = page.getByRole("table").getByRole("row").filter({
      hasText: name,
    });
    await expect(row).toContainText(`${HOST}${slug}`);
    await expect(row).not.toContainText(`custom-${slug}.example`);
  });

  test("purged sites show the restore-expired message on Undo", async ({
    page,
  }) => {
    const pg = await import("pg");
    await signInAs(page, uniqueEmail("del-purged"));
    const name = uniqueName("Purged Yard");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(page.getByText(`${name} deleted`)).toBeVisible();
    const db = new pg.Client({ connectionString: e2eDbUrl() });
    await db.connect();
    const { rowCount } = await db.query(
      `update public.sites
       set purge_after = now() - interval '1 day'
       where id = $1`,
      [siteId],
    );
    expect(rowCount).toBe(1);
    await db.end();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/can't be restored any more/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: name })).toHaveCount(0);
  });

  test("deleting the last site focuses the empty-state name field", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("del-focus"));
    const name = uniqueName("Only Yard");
    await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(
      page.getByRole("heading", { name: "Create your first site" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Site name" }),
    ).toBeFocused();
  });

  test("another user cannot see or open a deleted site", async ({ page }) => {
    const owner = uniqueEmail("del-owner");
    await signInAs(page, owner);
    const name = uniqueName("Secret Yard");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(
      page.getByRole("link", { name: /Recently deleted \(1\)/ }),
    ).toBeVisible();

    const intruder = uniqueEmail("del-intruder");
    await signInAs(page, intruder);
    await page.goto("/sites/deleted");
    await expect(page).toHaveURL("/sites");
    await expect(page.getByText(name)).toHaveCount(0);
    const response = await page.goto(`/sites/${siteId}/pages`);
    expect(response?.status()).toBe(404);
  });

  test("hard-deleted site shows restore expired on Undo", async ({ page }) => {
    const pg = await import("pg");
    await signInAs(page, uniqueEmail("del-hard"));
    const name = uniqueName("Hard Yard");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(page.getByText(`${name} deleted`)).toBeVisible();
    const db = new pg.Client({ connectionString: e2eDbUrl() });
    await db.connect();
    await db.query(`delete from public.sites where id = $1`, [siteId]);
    await db.end();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/can't be restored any more/)).toBeVisible();
  });

  test("user B cannot restore user A's deleted site via restoreSite", async ({
    page,
  }) => {
    const pg = await import("pg");
    const owner = uniqueEmail("del-rpc-owner");
    await signInAs(page, owner);
    const name = uniqueName("Rpc Yard");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(page.getByText(`${name} deleted`)).toBeVisible();
    const db = new pg.Client({ connectionString: e2eDbUrl() });
    await db.connect();
    const before = await db.query<{ deleted_at: string | null }>(
      `select deleted_at from public.sites where id = $1`,
      [siteId],
    );
    expect(before.rows[0]?.deleted_at).toBeTruthy();
    const intruder = uniqueEmail("del-rpc-intruder");
    await signInAs(page, intruder);
    const res = await page.request.post("/api/e2e/restore-site", {
      data: { siteId },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(false);
    const after = await db.query<{ deleted_at: string | null }>(
      `select deleted_at from public.sites where id = $1`,
      [siteId],
    );
    await db.end();
    expect(after.rows[0]?.deleted_at).toBeTruthy();
    expect(body.error).toBe("This site can't be restored any more.");
  });
});

test.describe("Recently deleted layout", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("matches the desktop ref positions", async ({ page }) => {
    const email = uniqueEmail("del-layout");
    await signInAs(page, email);
    const name = uniqueName("Layout Yard");
    const { siteId } = await createFirstSite(page, name);
    await page.goto("/sites");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page.getByRole("button", { name: "Delete site" }).click();
    await page.getByRole("link", { name: /Recently deleted \(1\)/ }).click();
    const main = page.getByRole("main");
    const back = main.getByRole("link", { name: "Sites" });
    const title = main.getByRole("heading", {
      level: 1,
      name: "Recently deleted",
    });
    const backBox = await back.boundingBox();
    const titleBox = await title.boundingBox();
    expect(backBox!.y).toBeGreaterThanOrEqual(30);
    expect(backBox!.y).toBeLessThanOrEqual(38);
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(66);
    expect(titleBox!.y).toBeGreaterThanOrEqual(67);
    expect(titleBox!.y).toBeLessThanOrEqual(75);
    const deletedHead = main
      .getByRole("columnheader", { name: "Deleted" })
      .first();
    const deletesHead = main.getByRole("columnheader", { name: "Deletes on" });
    const deletedBox = await deletedHead.boundingBox();
    const deletesBox = await deletesHead.boundingBox();
    expect(deletedBox!.x).toBeGreaterThanOrEqual(804);
    expect(deletedBox!.x).toBeLessThanOrEqual(812);
    expect(deletesBox!.x).toBeGreaterThanOrEqual(968);
    expect(deletesBox!.x).toBeLessThanOrEqual(976);
    void siteId;
  });
});

test.describe("row menu (seeded account)", () => {
  test("View live opens the canonical address; drafts have no View live", async ({
    page,
    context,
  }) => {
    await signInAs(page, SAM);
    await page.getByRole("button", { name: "Actions for North Light" }).click();
    const popup = context.waitForEvent("page");
    await page.getByRole("menuitem", { name: "View live" }).click();
    const opened = await popup;
    expect(opened.url()).toBe(`http://${HOST}north-light`);
    // noopener: the new tab can't reach back into Studiolo.
    expect(await opened.evaluate(() => window.opener)).toBeNull();
    await opened.close();
    await page.getByRole("button", { name: "Actions for Mara Lind" }).click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
      "Duplicate",
      "Delete",
    ]);
  });
});

test.describe("site areas (seeded account)", () => {
  test("/sites/[siteId] opens the editor on the home page; the shell shows status and lock", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    await page.goto(`/sites/${RIVERTON}`);
    await expect(page).toHaveURL(`/sites/${RIVERTON}/editor/${RIVERTON_HOME}`);
    const bar = page.locator("header").first();
    await expect(bar).toContainText("Riverton House");
    await expect(bar).toContainText("Live");
    await expect(bar.getByText("Password on")).toBeAttached();
    expect((await bar.boundingBox())!.height).toBe(56);
    await expect(
      page
        .getByRole("region", { name: "Home page" })
        .getByText(/Interiors for old houses, done slowly/),
    ).toBeVisible();
  });

  test("Open editor goes to the last opened page, else home", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    await page.goto(`/sites/${RIVERTON}/pages`);
    const open = page
      .locator("header")
      .first()
      .getByRole("link", { name: "Open editor" });
    await expect(open).toHaveAttribute(
      "href",
      `/sites/${RIVERTON}/editor/${RIVERTON_HOME}`,
    );
    const contact = "5a000000-0000-4000-8000-000000000024";
    await page.goto(`/sites/${RIVERTON}/editor/${contact}`);
    await expect(
      page.getByRole("region", { name: "Contact page" }),
    ).toBeVisible();
    await page.goto(`/sites/${RIVERTON}/settings`);
    await expect(open).toHaveAttribute(
      "href",
      `/sites/${RIVERTON}/editor/${contact}`,
    );
    await expect(
      page.getByRole("link", { name: "Editor" }).first(),
    ).toHaveAttribute("href", `/sites/${RIVERTON}/editor/${contact}`);
  });

  test("every area renders in the shell with its row selected", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    const nav = page
      .getByRole("complementary", { name: "Site" })
      .getByRole("navigation");
    for (const [area, label, heading] of [
      ["pages", "Pages", "Pages"],
      ["submissions", "Submissions", "Submissions"],
      ["stats", "Stats", "Stats"],
      ["settings", "Settings", "Settings"],
    ]) {
      await page.goto(`/sites/${RIVERTON}/${area}`);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    await page.goto(`/sites/${RIVERTON}/submissions`);
    await page.getByRole("link", { name: /Hannah Price/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Hannah Price" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Victorian terrace in Harrogate/),
    ).toBeVisible();
    await page.goto(`/sites/${RIVERTON}/settings`);
    await expect(page.getByText("rivertonhouse.example.com")).toBeVisible();
    await page.getByRole("link", { name: "Manage" }).click();
    await expect(page).toHaveURL(`/sites/${RIVERTON}/settings/domain`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Custom domain" }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("unknown, other users' and malformed ids are 404, never 403", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    const zero = "00000000-0000-4000-8000-000000000000";
    for (const path of [
      `/sites/${RIVERTON}/editor/${zero}`,
      `/sites/${RIVERTON}/editor/abc`,
      // A page of another of Sam's sites is not a page of this site.
      `/sites/${RIVERTON}/editor/5a000000-0000-4000-8000-000000000026`,
      `/sites/${RIVERTON}/submissions/${zero}`,
      `/sites/${NORTH_LIGHT}/submissions/5a000000-0000-4000-8000-000000000081`,
      `/sites/${zero}/pages`,
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(
        page.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
    }
    await signInAs(page, uniqueEmail("intruder"));
    for (const area of ["pages", "settings", "settings/domain", "stats"]) {
      const response = await page.goto(`/sites/${RIVERTON}/${area}`);
      expect(response?.status(), area).toBe(404);
    }
  });
});

test.describe("mobile site areas", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("editor nav bar: back to Sites, site menu sheet, Publish", async ({
    page,
  }) => {
    await signInAs(page, SAM);
    await page.goto(`/sites/${RIVERTON}/pages`);
    await expect(
      page.getByRole("complementary", { name: "Site" }),
    ).toBeHidden();
    const back = page.getByRole("link", { name: "Back to Sites" });
    await expect(back).toHaveAttribute("href", "/sites");
    const title = page.getByRole("button", { name: /Riverton House/ });
    await expect(title).toContainText("Live");
    for (const control of [back, title]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    const publish = page.getByRole("button", { name: "Publish" });
    expect((await publish.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await title.click();
    const sheet = page.getByRole("dialog", { name: "Riverton House" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link")).toHaveText([
      "Editor",
      "Pages",
      "Submissions",
      "Stats",
      "Settings",
      "View live",
    ]);
    await expect(sheet.getByRole("link", { name: "Pages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const link of await sheet.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await sheet.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(`/sites/${RIVERTON}/settings`);
    await expect(sheet).toBeHidden();
  });

  test("first site on mobile: 16px inputs and 48px targets", async ({
    page,
  }) => {
    await signInAs(page, uniqueEmail("mfirst"));
    const name = page.getByRole("textbox", { name: "Site name" });
    await expect(name).toHaveCSS("font-size", "16px");
    expect((await name.boundingBox())!.height).toBe(48);
    const create = page.getByRole("button", { name: "Create site" });
    expect((await create.boundingBox())!.height).toBe(48);
    const edit = page.getByRole("button", { name: "Edit address" });
    expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await createFirstSite(page, uniqueName("Pier View"));
    await page.goto("/sites");
    await page.getByRole("link", { name: "New site" }).click();
    await expect(page).toHaveURL("/sites?new=1");
    const dialog = page.getByRole("dialog", { name: "New site" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Site name" })).toHaveCSS(
      "font-size",
      "16px",
    );
    for (const button of await dialog.getByRole("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (const label of ["Cancel", "Create site"]) {
      const action = dialog.getByRole("button", { name: label });
      expect((await action.boundingBox())!.height).toBe(48);
      await expect(action).toHaveCSS("font-size", "16px");
    }
    // Loaded straight from the URL, Escape returns to the nav bar's +.
    await page.goto("/sites?new=1");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "New site" })).toBeFocused();
  });
});

test.describe("sites accessibility", () => {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 393, height: 852 }],
  ] as const) {
    test(`site areas (${label}) have no axe violations`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signInAs(page, SAM);
      for (const path of [
        `/sites/${RIVERTON}/editor/${RIVERTON_HOME}`,
        `/sites/${RIVERTON}/pages`,
        `/sites/${RIVERTON}/submissions`,
        `/sites/${RIVERTON}/submissions/5a000000-0000-4000-8000-000000000081`,
        `/sites/${RIVERTON}/stats`,
        `/sites/${RIVERTON}/settings`,
        `/sites/${RIVERTON}/settings/domain`,
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, path).toEqual([]);
      }
    });

    test(`create flows (${label}) have no axe violations`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signInAs(page, uniqueEmail(`axe-${label}`));
      await page.getByRole("textbox", { name: "Site name" }).fill("Studio");
      await expect(page.getByText("That address is reserved.")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Edit address" }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page
        .getByRole("textbox", { name: "Address" })
        .fill(`axe-${label}-${Date.now()}`);
      await createFirstSite(page, uniqueName("Axe Site"));
      await page.goto("/sites?new=1");
      await expect(
        page.getByRole("dialog", { name: "New site" }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }

  test("the mobile site menu sheet has no axe violations", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await signInAs(page, SAM);
    await page.goto(`/sites/${RIVERTON}/pages`);
    await page.getByRole("button", { name: /Riverton House/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Riverton House" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
