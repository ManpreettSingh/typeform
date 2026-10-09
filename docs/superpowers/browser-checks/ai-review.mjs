// Typeform AI creating a form, plus the Add content screens, on the isolated stack (3100/8100):
//  - the creator UI is light by default, even when the computer is set to dark
//  - the AI's suggestions appear one after another, and the Create form button floats clear of the bottom edge
//  - the form the AI creates is light
//  - Welcome Screen and End Screen work from Add content
// The AI chat reply is stubbed (no Gemini key on the test stack); Apply and everything else is the real backend.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(shots, { recursive: true });
const call = async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.status === 204 ? null : res.json();
};
const results = [];
const step = async (name, fn) => {
  try {
    const out = await fn();
    const [ok, detail] = Array.isArray(out) ? out : [out === true, ""];
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  - ${e.message.split("\n")[0]}`);
  }
};

const QUESTIONS = ["What's your name?", "Your email?", "How did you hear about us?", "Rate your experience", "Anything else?", "Can we contact you?"];
const question = (title, i) => ({ id: null, type: i === 1 ? "email" : i === 3 ? "rating" : "short_text", title, description: null, required: false, properties: i === 3 ? { max: 5, shape: "star" } : {}, group_id: null });
const proposal = {
  welcome: { title: "Event feedback", description: "Tell us how it went", button_text: "Start", show_time_to_complete: true, show_submission_count: false },
  questions: QUESTIONS.map(question),
  endings: [{ id: null, title: "Thanks!", message: "We read every answer.", button_text: null, button_url: null }],
};
const diff = {
  to_remove: [],
  to_set: QUESTIONS.map((title, position) => ({ id: null, type: question(title, position).type, title, position, change: "new", fields: [], moved: false })),
  endings: { to_remove: [], to_set: [{ id: null, title: "Thanks!", position: 0, change: "new", fields: [], moved: false }] },
  welcome: ["title", "description"],
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
// A computer set to dark: the creator UI must still start light.
const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: "dark" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.route("**/api/ai/chat", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Here is a draft.", proposal, diff }) }));

const skipOnboarding = async () => {
  const skip = page.getByRole("button", { name: "Skip for now" });
  if (await skip.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) await skip.click();
};

await page.goto(`${WEB}/forms`);
await skipOnboarding();
await page.getByRole("button", { name: "Appearance" }).waitFor({ timeout: 90000 });

await step("the creator UI is light by default, although the computer is set to dark", async () => {
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  return [theme === "light", `data-theme=${theme}`];
});

await step("choosing System follows the computer, and the choice is remembered", async () => {
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("menuitem", { name: "System" }).click();
  const dark = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.reload();
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  return [dark === "dark" && after === "dark", `${dark} then ${after} after reload`];
});

// ---- Typeform AI creating a form ----
await page.getByRole("textbox", { name: "Ask Typeform AI" }).fill("A feedback form for my event");
await page.getByRole("button", { name: "Send" }).first().click();
const list = page.getByRole("region", { name: "Questions to be set" });
await list.waitFor({ timeout: 15000 });

await step("suggestions appear one after another, not all at once", async () => {
  const opacities = () => page.evaluate(() => [...document.querySelectorAll("section[aria-label='Questions to be set'] li")].map((li) => Number(getComputedStyle(li).opacity)));
  const early = await opacities();
  const settled = await page.waitForFunction(
    () => [...document.querySelectorAll("section[aria-label='Questions to be set'] li")].every((li) => Number(getComputedStyle(li).opacity) === 1),
    null,
    { timeout: 6000 },
  ).then(() => true).catch(() => false);
  const partial = early.some((o) => o < 1);
  const firstAhead = early.length > 1 && early[0] >= early[early.length - 1];
  return [partial && firstAhead && settled, `at first: ${early.map((o) => o.toFixed(2)).join(" ")}; all visible after: ${settled}`];
});

await step("the Create form button sits right under the last suggestion, not flush on the bottom edge", async () => {
  const button = page.getByRole("dialog", { name: "Typeform AI" }).getByRole("button", { name: "Create form" });
  const box = await button.boundingBox();
  const lastRow = await page.locator("section[aria-label='Endings to be set'] li").last().boundingBox();
  const gapBelowRow = box.y - (lastRow.y + lastRow.height);
  const gapToBottom = page.viewportSize().height - (box.y + box.height);
  return [gapBelowRow >= 0 && gapBelowRow < 90 && gapToBottom >= 16, `${Math.round(gapBelowRow)}px under the last suggestion, ${Math.round(gapToBottom)}px above the bottom edge`];
});
await page.screenshot({ path: shots + "ai-review.png" });

let created;
await step("Create form makes the form, and it is light", async () => {
  await page.getByRole("dialog", { name: "Typeform AI" }).getByRole("button", { name: "Create form" }).click();
  await page.waitForURL(/\/forms\/\d+\/edit/, { timeout: 20000 });
  const id = Number(page.url().match(/forms\/(\d+)/)[1]);
  created = await call("GET", `/forms/${id}`);
  const light = created.theme.background.toLowerCase() === "#fafafa";
  const scheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  return [light && scheme === "light" && created.questions.length === 6, `background ${created.theme.background}, app ${scheme}, ${created.questions.length} questions`];
});
await skipOnboarding();

// ---- Add content ----
await page.getByRole("button", { name: /add content/i }).first().waitFor({ timeout: 60000 });

await step("Add content → Welcome Screen opens the welcome screen", async () => {
  await page.getByRole("button", { name: /add content/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  const tile = dialog.getByRole("button", { name: /Welcome Screen/ });
  const enabled = await tile.isEnabled();
  await tile.click();
  await page.getByRole("heading", { name: "Welcome Screen" }).waitFor({ timeout: 8000 });
  return enabled;
});

await step("Add content → End Screen adds an ending", async () => {
  const before = (await call("GET", `/forms/${created.id}`)).endings.length;
  await page.getByRole("button", { name: /add content/i }).first().click();
  await page.getByRole("dialog", { name: "Add content" }).getByRole("button", { name: /End Screen/ }).click();
  await page.waitForTimeout(1500);
  const after = (await call("GET", `/forms/${created.id}`)).endings.length;
  return [after === before + 1, `${before} → ${after} endings`];
});

await step("no page errors", async () => [pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ")]);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
