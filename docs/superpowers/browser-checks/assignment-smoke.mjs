// The assignment's checklist, driven through the real UI on the isolated, seeded stack (3100/8100):
// `npm run e2e:start -- --seed`, then `node` this file. Each step is independent so one failure doesn't hide the rest.
// A step passes only when it returns true or [true, detail].
import { chromium } from "playwright-core";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";

const call = async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text };
};

const results = [];
const step = async (name, fn) => {
  try {
    const out = await fn();
    const [ok, detail] = Array.isArray(out) ? out : [out === true, typeof out === "string" ? out : ""];
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  - ${e.message.split("\n")[0]}`);
  }
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
const ownerPortHits = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));

const forms = async () => (await call("GET", "/forms")).body;
const bySlug = async (slug) => (await forms()).find((f) => f.slug === slug);
const questionsOf = async (id) => (await call("GET", `/forms/${id}`)).body.questions;

// ---- 2. Form management ----------------------------------------------------------------------------------------
await page.goto(`${WEB}/forms`);
// First visit shows the onboarding intro; skip it like a returning creator.
// It renders client-side after reading localStorage, so wait for it (isVisible() doesn't wait).
const skip = page.getByRole("button", { name: "Skip for now" });
if (await skip.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) await skip.click();
await page.locator("[role=dialog][aria-label=Welcome]").waitFor({ state: "detached", timeout: 10000 });
await page.getByText("Customer Feedback").first().waitFor({ timeout: 60000 });

await step("dashboard lists forms with status and response count", async () => {
  const text = await page.locator("main").innerText();
  const fb = await bySlug("demo-feedback");
  // Like Typeform, drafts carry a "Draft" badge and published forms none.
  return [/draft/i.test(text) && text.includes(String(fb.response_count)), `Customer Feedback: ${fb.response_count} responses`];
});

const menu = async (title, item) => {
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).first().click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
};

await step("rename a form", async () => {
  await menu("Product Survey (draft)", "Rename");
  const input = page.getByLabel("Form title");
  await input.fill("Product Survey renamed");
  await input.press("Enter");
  await page.waitForTimeout(800);
  return (await bySlug("demo-draft")).title === "Product Survey renamed";
});

await step("duplicate a form", async () => {
  const before = (await forms()).length;
  await menu("Product Survey renamed", "Duplicate");
  await page.waitForTimeout(1200);
  return (await forms()).length === before + 1;
});

await step("publish and unpublish a form", async () => {
  await menu("Product Survey renamed", "Publish");
  await page.waitForTimeout(1000);
  const published = (await bySlug("demo-draft")).status === "published";
  const pub = await call("GET", "/public/forms/demo-draft");
  await page.keyboard.press("Escape");
  await menu("Product Survey renamed", "Unpublish");
  await page.waitForTimeout(1000);
  const unpublished = (await bySlug("demo-draft")).status === "draft";
  const hidden = await call("GET", "/public/forms/demo-draft");
  return [published && pub.status === 200 && unpublished && hidden.status === 404, "public link works only while published"];
});

await step("delete a form (with confirm)", async () => {
  const copy = (await forms()).find((f) => f.title.startsWith("Product Survey renamed") && f.slug !== "demo-draft");
  if (!copy) return [false, "no duplicate to delete"];
  await menu(copy.title, "Delete");
  await page.getByRole("dialog").getByRole("button", { name: /delete/i }).click();
  await page.waitForTimeout(1000);
  return !(await forms()).some((f) => f.id === copy.id);
});

await step("toast notifications appear", async () => (await page.locator("[data-sonner-toast]").count()) > 0);

// ---- 1. Builder -----------------------------------------------------------------------------------------------
const created = (await call("POST", "/forms", { title: "Smoke builder" })).body;
for (const [type, title] of [["short_text", "First?"], ["email", "Second?"], ["rating", "Third?"]]) {
  await call("POST", `/forms/${created.id}/questions`, { type, title });
}

await step("all 8 required question types can be added (sent at the same moment)", async () => {
  // Simultaneous on purpose: creates used to collide on position and return 500.
  const want = ["short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"];
  const res = await Promise.all(want.map((type) => call("POST", `/forms/${created.id}/questions`, { type, title: type })));
  return [res.every((r) => r.status === 201), res.map((r) => r.status).join(",")];
});

await page.goto(`${WEB}/forms/${created.id}/edit`);
await page.getByText("First?").first().waitFor({ timeout: 60000 });

await step("reorder questions by drag-and-drop (keyboard drag)", async () => {
  const before = (await questionsOf(created.id)).map((q) => q.title);
  if (before[0] !== "First?") return [false, `unexpected start ${before.slice(0, 3).join(" / ")}`];
  await page.getByRole("button", { name: "Reorder question 1", exact: true }).focus();
  // dnd-kit measures the list between key presses; real keyboard users are never this fast.
  for (const key of ["Space", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
  const titles = (await questionsOf(created.id)).map((q) => q.title);
  return [titles[0] === "Second?" && titles[1] === "First?", titles.slice(0, 3).join(" / ")];
});

await step("add a question from the Add content menu", async () => {
  const before = (await questionsOf(created.id)).length;
  await page.getByRole("button", { name: /add content/i }).first().click();
  await page.getByRole("dialog").getByText("Long Text", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  return (await questionsOf(created.id)).length === before + 1;
});

await step("edit title inline, description and required toggle", async () => {
  await page.getByText("First?").first().click();
  await page.locator("textarea[aria-label=Question]").fill("First, edited?");
  await page.locator("textarea[aria-label=Description]").fill("Some help text");
  await page.getByRole("switch", { name: "Required" }).click();
  await page.waitForTimeout(1500);
  const q = (await questionsOf(created.id)).find((x) => x.title.startsWith("First"));
  return [q?.title === "First, edited?" && q.description === "Some help text" && q.required === true, JSON.stringify({ title: q?.title, description: q?.description, required: q?.required })];
});

await step("delete a question", async () => {
  const before = (await questionsOf(created.id)).length;
  await page.getByRole("button", { name: "Delete question" }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: /delete/i });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(1500);
  return (await questionsOf(created.id)).length === before - 1;
});

await step("live preview: full-screen preview opens", async () => {
  await page.getByRole("button", { name: /preview/i }).first().click();
  const shown = await page.getByRole("dialog").first().isVisible({ timeout: 5000 });
  await page.keyboard.press("Escape");
  return shown;
});

await step("theme settings (Design: colors and font)", async () => {
  await page.getByRole("button", { name: /design/i }).first().click();
  const panel = page.getByRole("complementary", { name: "Design" }).or(page.locator("[aria-label=Design]")).first();
  await panel.waitFor({ timeout: 5000 });
  const text = await panel.innerText();
  await page.getByRole("button", { name: /design/i }).first().click();
  return [/background/i.test(text) && /button/i.test(text) && /font/i.test(text), "colors + font"];
});

// ---- 3. Respondent flow ---------------------------------------------------------------------------------------
const fbBefore = (await bySlug("demo-feedback")).response_count;
const publicForm = (await call("GET", "/public/forms/demo-feedback")).body;

await step("public form loads without login, welcome screen", async () => {
  await page.context().clearCookies();
  await page.goto(`${WEB}/f/demo-feedback`);
  await page.getByRole("button", { name: /start/i }).first().waitFor({ timeout: 60000 });
  return true;
});

await step("one question at a time, progress indicator, Enter to advance", async () => {
  await page.keyboard.press("Enter");
  await page.locator("h2").first().waitFor({ timeout: 10000 });
  const headings = await page.locator("h2").count();
  const progress = await page.getByRole("progressbar").getAttribute("aria-valuemax");
  return [headings === 1 && Number(progress) > 0, `progress max ${progress}`];
});

await step("required question blocks Enter with an error (client validation)", async () => {
  const q = publicForm.questions[0];
  if (!q.required) return [true, `first question optional (${q.type}); nothing to block`];
  await page.keyboard.press("Enter");
  return await page.getByRole("alert").first().isVisible({ timeout: 3000 });
});

await step("server validation rejects bad answers (422)", async () => {
  const emailQ = publicForm.questions.find((q) => q.type === "email");
  const res = await call("POST", "/public/forms/demo-feedback/responses", { answers: emailQ ? { [emailQ.id]: "not-an-email" } : {} });
  return [res.status === 422, `invalid email / missing required -> ${res.status}`];
});

await step("fill the whole form with the keyboard and see the thank-you screen", async () => {
  const seen = [];
  for (let i = 0; i < 25; i++) {
    if (await page.getByText(/thank/i).first().isVisible().catch(() => false)) break;
    const title = (await page.locator("h2").first().innerText().catch(() => "")).trim();
    const q = publicForm.questions.find((x) => title.includes(x.title));
    if (q) seen.push(q.type);
    // Answer with the keyboard only, as a respondent can: fields are focused, choices take letter/number keys.
    if (q) {
      if (["short_text", "long_text"].includes(q.type)) await page.keyboard.type("Great");
      else if (q.type === "email") await page.keyboard.type("ana@example.com");
      else if (q.type === "number") await page.keyboard.type("3");
      else if (q.type === "multiple_choice") await page.keyboard.press("a");
      else if (q.type === "dropdown") {
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
      } else if (q.type === "yes_no") await page.keyboard.press("y");
      else if (["rating", "opinion_scale", "nps"].includes(q.type)) await page.keyboard.press("4");
    }
    await page.waitForTimeout(250);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  }
  const done = await page.getByText(/thank/i).first().isVisible({ timeout: 10000 }).catch(() => false);
  return [done, `answered: ${seen.join(", ")}`];
});

await step("submission is stored (response count went up)", async () => {
  const after = (await bySlug("demo-feedback")).response_count;
  return [after === fbBefore + 1, `${fbBefore} -> ${after}`];
});

await step("unpublished form's public link is unavailable", async () => {
  await page.goto(`${WEB}/f/demo-draft`);
  await page.waitForTimeout(3000);
  return /not available|not found|isn't available|unavailable/i.test(await page.locator("body").innerText());
});

// ---- 4. Results -----------------------------------------------------------------------------------------------
const fb = await bySlug("demo-feedback");
await step("results summary shows per-question stats and completion rate", async () => {
  await page.goto(`${WEB}/forms/${fb.id}/results`);
  await page.getByRole("tabpanel").waitFor({ timeout: 60000 });
  const text = await page.getByRole("tabpanel").innerText();
  return /completion/i.test(text) && /%/.test(text);
});

await step("responses table and a single response in full", async () => {
  await page.getByRole("tab", { name: /responses/i }).click();
  // Rows are focusable <tr>s (Enter/Space or click open the response).
  const row = page.locator("tr[aria-label^='Response from']").first();
  await row.waitFor({ timeout: 10000 });
  const rows = await page.locator("tr[aria-label^='Response from']").count();
  await row.focus();
  await page.keyboard.press("Enter");
  const drawer = await page.getByRole("dialog").first().isVisible({ timeout: 5000 });
  await page.keyboard.press("Escape");
  return [drawer, `${rows} rows on page 1`];
});

await step("CSV export (bonus)", async () => {
  const res = await call("GET", `/forms/${fb.id}/responses/export.csv`);
  const lines = String(res.body).trim().split("\n").length;
  return [res.status === 200 && lines > 2, `${lines - 1} rows`];
});

// ---- Bonus ---------------------------------------------------------------------------------------------------
await step("logic jumps in a seeded form (bonus)", async () => publicForm.questions.some((q) => q.logic?.rules?.length));

await step("partial responses tracked (bonus)", async () => {
  const res = (await call("GET", `/forms/${fb.id}/responses?status=partial`)).body;
  const n = res.total ?? res.items?.length ?? 0;
  return [n > 0, `${n} partial`];
});

await step("dark mode switch (bonus)", async () => {
  await page.goto(`${WEB}/forms`);
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("menuitem", { name: /dark/i }).click();
  await page.waitForTimeout(300);
  const dark = await page.evaluate(() => `${document.documentElement.className} ${document.documentElement.dataset.theme ?? ""}`);
  return [/dark/.test(dark), dark.trim()];
});

await step("no uncaught page errors", async () => [pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ")]);
await step("never touched the owner's 3000/8000", async () => ownerPortHits.length === 0);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
