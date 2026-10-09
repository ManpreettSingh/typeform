// Task 7 browser check on the isolated stack (3100/8100): legal, checkbox, opinion scale and NPS.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
const out = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const call = async (method, path, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// ---- a published form with all four types ---------------------------------
const form = await call("POST", "/forms", { title: "Scales e2e" });
const add = (body) => call("POST", `/forms/${form.id}/questions`, body);
const legal = await add({ type: "legal", title: "Do you accept our terms?", description: "Read them at example.com/terms", required: true });
const box = await add({ type: "checkbox", title: "Updates", required: true, properties: { label: "Send me product news" } });
const scale = await add({
  type: "opinion_scale",
  title: "How often do you use it?",
  properties: { steps: 7, start_at_one: false, labels: { left: "Never", center: "Sometimes", right: "Always" } },
});
const nps = await add({ type: "nps", title: "Would you recommend us?", required: true });
const last = await add({ type: "short_text", title: "Anything else?" });
const { slug } = await call("POST", `/forms/${form.id}/publish`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ownerPortHits = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const radio = (name) => page.getByRole("radio", { name, exact: true });
const alertText = async () => (await page.locator("[role=alert]").first().textContent())?.trim();

// ---- live form: legal ------------------------------------------------------
await page.goto(`${WEB}/f/${slug}`);
await radio("I accept").waitFor({ timeout: 60000 });
check("legal shows I accept / I don’t accept", (await radio("I don’t accept").count()) === 1);
await page.screenshot({ path: `${out}legal-live.png` });

await radio("I don’t accept").click();
// The pick auto-advances after a beat, which is when validation runs.
await page.getByRole("alert").filter({ hasText: "Please agree to the terms & conditions" }).waitFor({ timeout: 5000 });
check("declining a required legal block shows Typeform's message", true);
await page.screenshot({ path: `${out}legal-error.png` });

await page.keyboard.press("y");
await page.getByRole("checkbox").waitFor({ timeout: 8000 });
check("Y accepts and moves to the checkbox question", true);

// ---- checkbox ----------------------------------------------------------------
check("checkbox shows its own label", (await page.getByRole("checkbox").textContent())?.includes("Send me product news") ?? false);
await page.getByRole("button", { name: /^OK/ }).click();
await page.locator("[role=alert]").first().waitFor({ timeout: 5000 });
check("a required box left empty says Oops! Please make a selection", (await alertText()) === "Oops! Please make a selection", await alertText());
await page.keyboard.press("a");
check("A ticks the box", (await page.getByRole("checkbox").getAttribute("aria-checked")) === "true");
await page.screenshot({ path: `${out}checkbox-live.png` });
await page.keyboard.press("Enter");

// ---- opinion scale -----------------------------------------------------------
await radio("0").waitFor({ timeout: 8000 });
const scaleNumbers = await page.getByRole("radio").allTextContents();
check("a 7-step scale starting at 0 shows 0..6", scaleNumbers.join(",") === "0,1,2,3,4,5,6", scaleNumbers.join(","));
check("captions are shown", (await page.getByText("Never", { exact: true }).count()) === 1 && (await page.getByText("Always", { exact: true }).count()) === 1);
await page.screenshot({ path: `${out}scale-live.png` });
await page.keyboard.press("4");

// ---- nps ---------------------------------------------------------------------
await radio("10").waitFor({ timeout: 8000 });
const npsNumbers = await page.getByRole("radio").allTextContents();
check("NPS shows 0..10", npsNumbers.join(",") === "0,1,2,3,4,5,6,7,8,9,10", npsNumbers.join(","));
check("NPS has the default captions", (await page.getByText("Not at all likely", { exact: true }).count()) === 1 && (await page.getByText("Extremely likely", { exact: true }).count()) === 1);
await page.screenshot({ path: `${out}nps-live.png` });
await page.keyboard.press("1");
await page.keyboard.press("0");
check("1 then 0 picks 10", (await radio("10").getAttribute("aria-checked")) === "true");

// auto-advance to the last question, then submit
await page.getByPlaceholder("Type your answer here...").waitFor({ timeout: 8000 });
await page.getByPlaceholder("Type your answer here...").fill("Great");
await page.keyboard.press("Enter");
await page.getByText(/Thanks|recorded/i).first().waitFor({ timeout: 15000 });
check("the form completes", true);

const first = (await call("GET", `/forms/${form.id}/responses`)).items[0].answers;
check(
  "saved values: legal true, checkbox true, scale 4, nps 10",
  first[legal.id] === true && first[box.id] === true && first[scale.id] === 4 && first[nps.id] === 10,
  JSON.stringify(first),
);

// More responses through the API so the summaries have something to show.
const submit = (answers) => call("POST", `/public/forms/${slug}/responses`, { answers });
await submit({ [legal.id]: true, [box.id]: true, [scale.id]: 6, [nps.id]: 9 });
await submit({ [legal.id]: true, [box.id]: true, [scale.id]: 0, [nps.id]: 8 });
await submit({ [legal.id]: true, [box.id]: true, [nps.id]: 3 });
const summary = (await call("GET", `/forms/${form.id}/summary`)).questions;
const nps4 = summary.find((q) => q.question_id === nps.id);
check("NPS summary: 2 promoters, 1 passive, 1 detractor → score 25", nps4.promoters.count === 2 && nps4.passives.count === 1 && nps4.detractors.count === 1 && nps4.score === 25, JSON.stringify([nps4.promoters, nps4.passives, nps4.detractors, nps4.score]));
const legalSummary = summary.find((q) => q.question_id === legal.id);
check("legal summary counts accepted", legalSummary.counts[0].count === 4 && legalSummary.counts[1].count === 0, JSON.stringify(legalSummary.counts));

// A required legal block answered "false" is rejected by the server too.
let rejected = "";
try {
  await submit({ [legal.id]: false, [box.id]: true, [nps.id]: 5 });
} catch (e) {
  rejected = String(e.message);
}
check("the server rejects a declined required legal block", rejected.includes("Please agree to the terms & conditions"), rejected.slice(0, 120));

// ---- results ---------------------------------------------------------------
await page.goto(`${WEB}/forms/${form.id}/results`);
await page.getByText("Net Promoter Score").first().waitFor({ timeout: 60000 });
check("results show the NPS card with its score and groups", (await page.getByText("Promoters").count()) > 0 && (await page.getByText("Detractors").count()) > 0);
await page.screenshot({ path: `${out}nps-results.png`, fullPage: true });
check("results show the legal card as accepted", (await page.getByText("Accepted", { exact: true }).count()) > 0);
check("results show the opinion scale card", (await page.getByText("How often do you use it?").count()) > 0);

// ---- builder -----------------------------------------------------------------
await page.goto(`${WEB}/forms/${form.id}/edit`);
await page.getByText("How often do you use it?").first().waitFor({ timeout: 60000 });
await page.getByRole("button", { name: /Add content/ }).first().click();
const enabled = async (label) => !(await page.getByRole("button", { name: new RegExp(label) }).first().isDisabled());
check("Add content: Legal, Checkbox, Opinion Scale and NPS are enabled", (await enabled("^Legal")) && (await enabled("^Checkbox")) && (await enabled("^Opinion Scale")) && (await enabled("^Net Promoter Score")));
await page.screenshot({ path: `${out}add-content.png` });
await page.keyboard.press("Escape");

await page.getByText("How often do you use it?").first().click();
await page.getByLabel("Left label").waitFor({ timeout: 10000 });
check("opinion scale panel has Steps, Start at 1 and the three labels", (await page.getByLabel("Center label").count()) === 1 && (await page.getByLabel("Right label").count()) === 1);
await page.screenshot({ path: `${out}scale-builder.png` });

await page.getByRole("switch", { name: "Start at 1" }).click();
await page.waitForTimeout(1200);
let q = (await call("GET", `/forms/${form.id}`)).questions.find((x) => x.id === scale.id);
check("Start at 1 saves", q.properties.start_at_one === true, JSON.stringify(q.properties));

await page.getByLabel("Left label").fill("Rarely");
await page.waitForTimeout(1500);
q = (await call("GET", `/forms/${form.id}`)).questions.find((x) => x.id === scale.id);
check("a label edit saves", q.properties.labels.left === "Rarely", JSON.stringify(q.properties.labels));

await page.getByText("Updates", { exact: true }).first().click();
const label = page.getByLabel("Checkbox label");
await label.waitFor({ timeout: 10000 });
await label.fill("Email me the news");
await page.waitForTimeout(1500);
q = (await call("GET", `/forms/${form.id}`)).questions.find((x) => x.id === box.id);
check("the checkbox label is edited on the canvas and saved", q.properties.label === "Email me the news", JSON.stringify(q.properties));

// logic editors
await page.getByRole("button", { name: "Add rule" }).click();
check("checkbox rule offers only Checked", (await page.getByLabel("Answer").locator("option").allTextContents()).join() === "Checked");
await page.getByText("Would you recommend us?").first().click();
await page.getByRole("button", { name: "Add rule" }).click();
const npsOptions = await page.getByLabel("Score").locator("option").allTextContents();
check("NPS rule value runs 0..10", npsOptions.join() === "0,1,2,3,4,5,6,7,8,9,10", npsOptions.join());
check("NPS rule uses the number conditions", (await page.getByLabel("Condition").locator("option").allTextContents()).includes("is at most"));
await page.getByText("Do you accept our terms?").first().click();
await page.getByRole("button", { name: "Add rule" }).click();
check("legal rule offers Accepted / Declined", (await page.getByLabel("Answer").locator("option").allTextContents()).join() === "Accepted,Declined");

check("never touched the owner's 3000/8000", ownerPortHits.length === 0, ownerPortHits.join(", "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
