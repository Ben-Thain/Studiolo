import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs against tests/e2e/mock-auth-server.mjs (see playwright.config.ts).
const MOCK = "http://127.0.0.1:54399";

type OtpRequest = { email: string; redirect_to: string; create_user: boolean };

async function lastOtp(page: Page, email: string): Promise<OtpRequest> {
  const response = await page.request.get(
    `${MOCK}/__otp?email=${encodeURIComponent(email)}`,
  );
  return (await response.json()) as OtpRequest;
}

async function otpCount(page: Page, email: string): Promise<number> {
  const response = await page.request.get(
    `${MOCK}/__otp-count?email=${encodeURIComponent(email)}`,
  );
  return ((await response.json()) as { count: number }).count;
}

/** The form-level alert (Next also renders a route announcer with role alert). */
function formAlert(page: Page) {
  return page.locator("main [role=alert]");
}

function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

function codeFor(email: string) {
  return `ok.${Buffer.from(email).toString("base64url")}`;
}

/** Requests a link through the UI, then follows it like the email would. */
async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
  const otp = await lastOtp(page, email);
  expect(otp.email).toBe(email);
  const link = new URL(otp.redirect_to);
  link.searchParams.set("code", codeFor(email));
  await page.goto(link.toString());
}

test.describe("landing", () => {
  test("shows the hero and both actions, no prices", async ({ page }) => {
    await page.goto("/?ref=some-site");
    await expect(
      page.getByRole("heading", {
        name: "A stunning personal website, in 5 minutes.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Pages, photos and a contact form, published at your own address.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get started" }),
    ).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(2);
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const word of ["£", "$", "price", "plan", "trial", "pay", "card"]) {
      expect(text).not.toContain(word);
    }
  });
});

test.describe("guards", () => {
  for (const path of ["/sites", "/account", "/plan", "/sites/abc/pages"]) {
    test(`${path} sends a signed-out visitor to log in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    });
  }

  test("keeps the query string in next", async ({ page }) => {
    await page.goto("/sites?new=1");
    await expect(page).toHaveURL(
      `/login?next=${encodeURIComponent("/sites?new=1")}`,
    );
  });
});

test.describe("magic link", () => {
  test("log in, land on next, and / redirects to /sites", async ({ page }) => {
    const email = uniqueEmail("login");
    await signIn(page, email, "/account");
    await expect(page).toHaveURL("/account");
    await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL("/sites");
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("sign up sends a link that creates the user and lands on /sites", async ({
    page,
  }) => {
    const email = uniqueEmail("signup");
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    const otp = await lastOtp(page, email);
    expect(otp.create_user).toBe(true);
    const link = new URL(otp.redirect_to);
    expect(link.pathname).toBe("/auth/callback");
    expect(link.searchParams.get("next")).toBeNull();
    link.searchParams.set("code", codeFor(email));
    await page.goto(link.toString());
    await expect(page).toHaveURL("/sites");
  });

  test("the link carries a safe next and drops an unsafe one", async ({
    page,
  }) => {
    const safe = uniqueEmail("next");
    await page.goto(`/login?next=${encodeURIComponent("/sites/x/pages")}`);
    await page.getByLabel("Email").fill(safe);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    expect(
      new URL((await lastOtp(page, safe)).redirect_to).searchParams.get("next"),
    ).toBe("/sites/x/pages");

    await page.goto(`/login?next=${encodeURIComponent("//evil.example")}`);
    const unsafe = uniqueEmail("evil");
    await page.getByLabel("Email").fill(unsafe);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    expect(
      new URL((await lastOtp(page, unsafe)).redirect_to).searchParams.get(
        "next",
      ),
    ).toBeNull();
  });

  test("callback ignores an off-site next", async ({ page }) => {
    const email = uniqueEmail("offsite");
    await signIn(page, email);
    await page.goto(
      `/auth/callback?code=${codeFor(email)}&next=${encodeURIComponent("//evil.example")}`,
    );
    await expect(page).toHaveURL(/\/(sites|auth\/expired)$/);
    expect(new URL(page.url()).host).toBe("127.0.0.1:3000");
  });

  test("an invalid email shows a field error and sends nothing", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(await otpCount(page, "not-an-email")).toBe(0);
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toHaveCount(0);
  });

  test("a failed send shows friendly copy, never the raw error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`fail-server.${uniqueEmail("x")}`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(formAlert(page)).toHaveText(
      "We couldn't send the link. Try again.",
    );
    await expect(page.getByText("Internal mock failure")).toHaveCount(0);
  });

  test("a rate limit shows wait copy", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(`fail-rate.${uniqueEmail("x")}`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(formAlert(page)).toHaveText(
      "Too many sign-in links. Wait a minute, then try again.",
    );
  });
});

test.describe("check your inbox", () => {
  test("counts down, then offers Resend; a different email keeps the address", async ({
    page,
  }) => {
    await page.clock.install();
    const email = uniqueEmail("inbox");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const heading = page.getByRole("heading", { name: "Check your inbox" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    const waiting = page.getByRole("button", { name: /^Resend in \d+s$/ });
    await expect(waiting).toHaveText("Resend in 30s");
    await expect(waiting).toBeDisabled();
    await page.clock.runFor(5_000);
    await expect(waiting).toHaveText("Resend in 25s");
    await page.clock.runFor(26_000);
    const resend = page.getByRole("button", { name: "Resend", exact: true });
    await expect(resend).toBeEnabled();
    expect(await otpCount(page, email)).toBe(1);
    await resend.click();
    await expect(
      page.getByRole("button", { name: "Resend in 30s" }),
    ).toBeDisabled();
    expect(await otpCount(page, email)).toBe(2);

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Email")).toBeFocused();
  });
});

test.describe("expired links", () => {
  test("a provider error lands on the expired page with no raw error", async ({
    page,
  }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    await expect(page).toHaveURL("/auth/expired");
    await expect(
      page.getByRole("heading", { name: "This link has expired" }),
    ).toBeVisible();
    await expect(
      page.getByText(/otp_expired|invalid or has expired/i),
    ).toHaveCount(0);
  });

  test("a used or bad code lands on the expired page", async ({ page }) => {
    await page.goto("/auth/callback?code=bad-code");
    await expect(page).toHaveURL("/auth/expired");
  });

  test("prefills the last email and sends a new link", async ({ page }) => {
    const email = uniqueEmail("expired");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    await page.goto("/auth/callback?code=bad-code");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    expect(await otpCount(page, email)).toBe(2);
  });
});

test.describe("google", () => {
  test("Continue with Google goes through authorize and signs in", async ({
    page,
  }) => {
    await page.goto(`/signup?next=${encodeURIComponent("/plan")}`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL("/plan");
    await expect(
      page.getByText("Signed in as google.user@example.com."),
    ).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("log in uses 48px controls, 16px input text and 24px margins", async ({
    page,
  }) => {
    await page.goto("/login");
    const input = page.getByLabel("Email");
    const box = await input.boundingBox();
    expect(box?.height).toBe(48);
    expect(box?.x).toBe(24);
    expect(box?.width).toBe(345);
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "16px",
    );
    const button = await page
      .getByRole("button", { name: "Continue", exact: true })
      .boundingBox();
    expect(button?.height).toBe(48);
    const title = await page
      .getByRole("heading", { name: "Log in" })
      .boundingBox();
    expect(title?.y).toBe(120);
  });
});

test.describe("desktop sizes", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("log in column is 360px with 40px controls", async ({ page }) => {
    await page.goto("/login");
    const input = await page.getByLabel("Email").boundingBox();
    expect(input).toMatchObject({ x: 540, width: 360, height: 40 });
    const google = await page
      .getByRole("button", { name: "Continue with Google" })
      .boundingBox();
    expect(google?.height).toBe(40);
  });
});

test.describe("accessibility", () => {
  for (const path of ["/", "/login", "/signup", "/auth/expired"]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("check your inbox has no axe violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("axe"));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
