// Task 6 browser check on the isolated stack (3100/8100): the date question in the live form and in the builder.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
const out = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const call = async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.status === 204 ? null : res.json();
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// A published form with two date questions.
const form = await call("POST", "/forms", { title: "Dates e2e" });
const limited = await call("POST", `/forms/${form.id}/questions`, {
  type: "date",
  title: "Booking date?",
  required: true,
  properties: { format: "DDMMYYYY", separator: ".", start_date: "2026-01-15", end_date: "2026-12-31" },
});
const plain = await call("POST", `/forms/${form.id}/questions`, { type: "date", title: "Birthday?" });
const { slug } = await call("POST", `/forms/${form.id}/publish`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ownerPortHits = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const fillDate = async (a, b, c) => {
  // the inputs are in the question's order; address them by placeholder so the order doesn't matter
  for (const [placeholder, value] of Object.entries({ ...a })) await page.getByPlaceholder(placeholder).fill(value);
  void b;
  void c;
};

// ---- live form -------------------------------------------------------------
await page.goto(`${WEB}/f/${slug}`);
await page.getByPlaceholder("DD").waitFor({ timeout: 60000 });
const labels = await page.locator("label > span").allTextContents();
check("DDMMYYYY question shows Day, Month, Year in that order", labels.slice(0, 3).join(",") === "Day,Month,Year", labels.join(","));
check("the range hint is shown", await page.getByText("Choose a date between 15.01.2026 and 31.12.2026.").first().isVisible());
check("the separator follows the question", (await page.locator("span[aria-hidden]").allTextContents()).includes("."));
await page.screenshot({ path: `${out}date-live.png` });

// typing a full part moves to the next one
await page.getByPlaceholder("DD").click();
await page.keyboard.type("14012026");
check("typing 14012026 fills day, month and year by itself", (await page.getByPlaceholder("DD").inputValue()) === "14" && (await page.getByPlaceholder("MM").inputValue()) === "01" && (await page.getByPlaceholder("YYYY").inputValue()) === "2026");
await page.keyboard.press("Enter");
await page.getByText("Choose a date between 15.01.2026 and 31.12.2026.").nth(1).waitFor({ timeout: 5000 }).catch(() => {});
const alert1 = (await page.locator("[role=alert]").first().textContent())?.trim();
check("out of range gives the between message", alert1 === "Choose a date between 15.01.2026 and 31.12.2026.", alert1);
await page.screenshot({ path: `${out}date-error.png` });

await page.getByPlaceholder("DD").fill("30");
await page.getByPlaceholder("MM").fill("02");
await page.getByPlaceholder("YYYY").fill("2026");
await page.keyboard.press("Enter");
await page.getByText("That date doesn't look valid").waitFor({ timeout: 5000 });
check("Feb 30 gives Typeform's invalid-date message", true);

await page.getByPlaceholder("DD").fill("15");
await page.getByPlaceholder("MM").fill("01");
await page.getByPlaceholder("YYYY").fill("2026");
await page.keyboard.press("Enter");

// second question: default MM/DD/YYYY
await page.getByPlaceholder("MM").waitFor({ timeout: 10000 });
await page.waitForFunction(() => document.querySelector("h2")?.textContent?.includes("Birthday"), null, { timeout: 10000 });
const labels2 = await page.locator("label > span").allTextContents();
check("default question shows Month, Day, Year", labels2.slice(0, 3).join(",") === "Month,Day,Year", labels2.join(","));
await page.getByPlaceholder("MM").fill("13");
await page.getByPlaceholder("DD").fill("01");
await page.getByPlaceholder("YYYY").fill("1990");
await page.keyboard.press("Enter");
await page.getByText("Check the month and day aren't reversed").waitFor({ timeout: 5000 });
check("13/01 gets the reversed month-and-day message", true);

await page.getByPlaceholder("MM").fill("01");
await page.getByPlaceholder("DD").fill("13");
await page.keyboard.press("Enter");
await page.getByText(/Thanks|recorded/i).first().waitFor({ timeout: 15000 });
check("the form completes", true);
const saved = (await call("GET", `/forms/${form.id}/responses`)).items[0].answers;
check("saved values are normalised ISO dates", saved[limited.id] === "2026-01-15" && saved[plain.id] === "1990-01-13", JSON.stringify(saved));
const summary = (await call("GET", `/forms/${form.id}/summary`)).questions;
check("the summary shows each date in its own format", summary[0].answers[0].value === "15.01.2026" && summary[1].answers[0].value === "01/13/1990", summary.map((q) => q.answers[0].value).join(" | "));

// ---- builder ---------------------------------------------------------------
await page.goto(`${WEB}/forms/${form.id}/edit`);
await page.getByText("Booking date?").first().waitFor({ timeout: 60000 });
await page.getByText("Booking date?").first().click();
await page.getByLabel("Date format").waitFor({ timeout: 10000 });
check("builder shows Date format, Start date and End date", (await page.getByLabel("Start date").count()) > 0 && (await page.getByLabel("End date").count()) > 0);
await page.screenshot({ path: `${out}date-builder.png` });

await page.getByLabel("Date format").selectOption("YYYYMMDD");
await page.waitForTimeout(1200);
let q = (await call("GET", `/forms/${form.id}`)).questions.find((x) => x.id === limited.id);
check("changing the format saves", q.properties.format === "YYYYMMDD", JSON.stringify(q.properties));

await page.getByRole("switch", { name: "End date" }).click();
await page.waitForTimeout(1200);
q = (await call("GET", `/forms/${form.id}`)).questions.find((x) => x.id === limited.id);
check("switching End date off removes the limit", !("end_date" in q.properties) && q.properties.start_date === "2026-01-15", JSON.stringify(q.properties));

await page.getByRole("button", { name: "Add rule" }).click();
const options = await page.getByLabel("Condition").locator("option").allTextContents();
check("logic offers date wording", options.includes("is before") && options.includes("is on or after"), options.join(", "));
check("the rule's value is a date picker", (await page.getByLabel("Date", { exact: true }).getAttribute("type")) === "date");

check("never touched the owner's 3000/8000", ownerPortHits.length === 0, ownerPortHits.join(", "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
