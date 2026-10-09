// Workflow tab browser checks on the isolated stack (3100/8100)
import { chromium } from "playwright-core";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";

const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status === 204 ? null : res.json();
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const forms = await call("GET", "/forms");
const feedback = forms.find((f) => f.slug === "demo-feedback");

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const ownerPortHits = [];
const pageErrors = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => pageErrors.push(e.message));

// 1. Open the form in Workflow view directly via URL
await page.goto(`${WEB}/forms/${feedback.id}/edit?view=workflow`);
await page.getByRole("heading", { name: "Workflow", exact: true }).waitFor({ timeout: 15000 });
check("Workflow tab loads and displays heading", true);

// 2. Check summary badges
const badges = await page.getByText(/questions?/).first().innerText();
check("displays questions count badge", Boolean(badges), badges);

// 3. Flow map displays question cards and endings
const cards = page.locator(".rounded-card");
const count = await cards.count();
check("Flow map renders question and ending nodes", count >= 7, `${count} nodes rendered`);

// 4. Branching logic displays in Flow map
const logicBranches = page.getByText(/Logic branches/);
check("logic jumps are visualized with branches in flow map", (await logicBranches.count()) > 0);

// 5. Toggle to Rule list view
const ruleListBtn = page.getByRole("button", { name: "Rule list" });
await ruleListBtn.click();
await page.waitForTimeout(500);
check("can toggle to Rule list view", (await page.getByRole("button", { name: "Rule list" }).getAttribute("aria-pressed")) === "true");

// 6. Toggle back to Flow map
const flowMapBtn = page.getByRole("button", { name: "Flow map" });
await flowMapBtn.click();
await page.waitForTimeout(500);
check("can toggle back to Flow map view", (await flowMapBtn.getAttribute("aria-pressed")) === "true");

// 7. Clicking Edit on a question navigates to Content view selecting that question
const editBtn = page.getByRole("button", { name: "Edit" }).first();
await editBtn.click();
await page.waitForTimeout(1000);
check("clicking Edit navigates back to Content view in builder", page.url().includes("view=content") || !page.url().includes("view="));

// Cleanliness checks
check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(", "));
check("never touched the owner's 3000/8000", ownerPortHits.length === 0);

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exit(1);
