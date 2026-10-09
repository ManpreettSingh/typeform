// Contacts end to end on the isolated stack (3100/8100): the empty state, auto-add from forms, add individually (with the
// consent step), search, filters and saved lists, inline edit, the detail sidebar, CSV import, bulk delete, export, and
// a live form submission becoming a contact.
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

// Start from nothing, whatever earlier runs left behind.
const existing = await call("GET", "/contacts");
if (existing.total) await call("POST", "/contacts/bulk-delete", { ids: existing.items.map((c) => c.id) });
for (const list of await call("GET", "/contacts/lists")) await call("DELETE", `/contacts/lists/${list.id}`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const rows = () => page.locator("tr[aria-label^='Contact ']");
const rowCount = async (n) => {
  await page.waitForFunction((count) => document.querySelectorAll("tr[aria-label^='Contact ']").length === count, n, { timeout: 10000 });
  return true;
};
const openMenu = async (trigger, item) => {
  await page.getByRole("button", { name: trigger }).first().click();
  await page.getByRole("menuitem", { name: item }).click();
};

await page.goto(`${WEB}/contacts`);
// A first visit shows the onboarding overlay, which would swallow every click below.
const skip = page.getByRole("button", { name: "Skip for now" });
if (await skip.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) await skip.click();
await page.getByRole("heading", { name: "Your contacts will appear here" }).waitFor({ timeout: 90000 });

await step("Contacts is a real tab, marked as the current section", async () => {
  const tab = page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: /Contacts/ });
  const soon = await page.getByRole("navigation", { name: "Sections" }).getByText("Soon").count();
  return [(await tab.getAttribute("aria-current")) === "page", `"Soon" badges left: ${soon} (Automations, Insights)`];
});

await step("with no contacts yet it offers the three ways to add them", async () => {
  const names = ["Auto-add from forms", "Add with import", "Add individually"];
  const shown = await Promise.all(names.map((n) => page.getByRole("button", { name: n }).first().isVisible()));
  return [shown.every(Boolean), ""];
});

await step("Auto-add from forms turns the demo responses into contacts", async () => {
  await page.getByRole("button", { name: "Auto-add from forms" }).first().click();
  await page.getByText(/Added \d+ contacts? from your forms/).first().waitFor({ timeout: 15000 });
  await page.locator("tr[aria-label^='Contact ']").first().waitFor({ timeout: 10000 });
  const { total } = await call("GET", "/contacts");
  const shown = await rows().count();
  return [total > 20 && shown === total, `${total} contacts, ${shown} rows`];
});
await page.screenshot({ path: shots + "contacts-table.png" });

await step("running it again adds nothing new", async () => {
  await openMenu("Add contacts", /Auto-add from forms/);
  await page.getByText("No new contacts found in your responses").first().waitFor({ timeout: 10000 });
  return true;
});

await step("Add individually: subscribing asks for consent first", async () => {
  await openMenu("Add contacts", /Add individually/);
  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await dialog.getByLabel("Email").fill("Jamie@Example.com");
  await dialog.getByLabel("Name").fill("Jamie Rivera");
  await dialog.getByLabel("Phone").fill("+12015550123");
  await dialog.getByLabel("Notes").fill("Asked about enterprise pricing");
  await dialog.getByLabel("Subscription status").selectOption("subscribed");
  await dialog.getByRole("button", { name: "Save" }).click();
  const consent = page.getByRole("dialog", { name: "Confirm consent" });
  await consent.waitFor({ timeout: 5000 });
  const savedEarly = (await call("GET", "/contacts?query=jamie")).total;
  await consent.getByRole("button", { name: "Subscribe" }).click();
  await page.getByRole("row", { name: "Contact Jamie Rivera" }).waitFor({ timeout: 10000 });
  const [jamie] = (await call("GET", "/contacts?query=jamie")).items;
  return [savedEarly === 0 && jamie.email === "jamie@example.com" && jamie.subscription_status === "subscribed" && jamie.notes.startsWith("Asked"), `saved before consent: ${savedEarly}`];
});

await step("a contact with an email that exists is refused, with the reason in the form", async () => {
  await openMenu("Add contacts", /Add individually/);
  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await dialog.getByLabel("Email").fill("jamie@example.com");
  await dialog.getByRole("button", { name: "Save" }).click();
  const shown = await dialog.getByText("A contact with this email already exists").isVisible({ timeout: 5000 });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  return shown;
});

await step("search narrows the table", async () => {
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("jamie");
  await rowCount(1);
  await page.getByRole("searchbox", { name: "Search contacts" }).fill("");
  await rowCount((await call("GET", "/contacts")).total);
  return true;
});

await step("a filter narrows the table and can be saved as a list", async () => {
  await page.getByRole("button", { name: /^Filter/ }).click();
  const panel = page.getByRole("region", { name: "Filter contacts" });
  await panel.getByLabel("Property").selectOption("subscription_status");
  await panel.getByLabel("Value").selectOption("subscribed");
  await panel.getByRole("button", { name: "Apply" }).click();
  await rowCount(1);
  await page.getByRole("button", { name: /^Filter/ }).click();
  await panel.getByRole("button", { name: "Save as new list" }).click();
  await page.getByLabel("List name").fill("Subscribers");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.getByRole("heading", { name: "Subscribers" }).waitFor({ timeout: 10000 });
  const sidebar = page.getByRole("complementary", { name: "Contact lists" });
  const entry = sidebar.getByRole("button", { name: /Subscribers/ });
  await rowCount(1);
  const lists = await call("GET", "/contacts/lists");
  return [(await entry.textContent()).includes("1") && lists[0].count === 1, `lists: ${lists.map((l) => `${l.name}(${l.count})`)}`];
});

await step("All contacts shows everyone again", async () => {
  await page.getByRole("complementary", { name: "Contact lists" }).getByRole("button", { name: /All contacts/ }).click();
  await rowCount((await call("GET", "/contacts")).total);
  return true;
});

await step("a text cell edits in place and saves on Enter", async () => {
  await page.getByRole("button", { name: "Edit name of Jamie Rivera" }).click();
  const input = page.getByLabel("name of Jamie Rivera");
  await input.fill("Jamie R.");
  await input.press("Enter");
  await page.getByRole("button", { name: "Edit name of Jamie R." }).waitFor({ timeout: 10000 });
  const [jamie] = (await call("GET", "/contacts?query=jamie")).items;
  return [jamie.name === "Jamie R.", jamie.name];
});

await step("a column sorts when its header is clicked", async () => {
  await page.getByRole("columnheader", { name: "Name" }).getByRole("button").click();
  const asc = await page.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort");
  await page.getByRole("columnheader", { name: "Name" }).getByRole("button").click();
  const desc = await page.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort");
  return [asc === "ascending" && desc === "descending", `${asc} then ${desc}`];
});

await step("View opens the details with the subscription history, sources and Actions → Edit", async () => {
  await page.getByRole("button", { name: "View Jamie R." }).click();
  const drawer = page.getByRole("dialog", { name: "Jamie R." });
  await drawer.waitFor({ timeout: 5000 });
  await drawer.getByRole("button", { name: /Subscription history/ }).click();
  const history = (await drawer.getByText("Never subscribed").count()) > 0;
  const manual = await drawer.getByText("Manual edit").first().isVisible();
  await page.screenshot({ path: shots + "contacts-drawer.png" });
  await drawer.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit contact" });
  await edit.getByLabel("Notes").fill("Signed up for the demo");
  await edit.getByRole("button", { name: "Save" }).click();
  await drawer.getByText("Signed up for the demo").waitFor({ timeout: 10000 });
  return [history && manual, `history=${history} manual=${manual}`];
});
await page.keyboard.press("Escape");
await page.getByRole("dialog", { name: "Jamie R." }).waitFor({ state: "hidden", timeout: 5000 });

await step("a form source in the sidebar links to the form", async () => {
  const [demo] = (await call("GET", "/contacts?query=ada.rossi")).items;
  await page.getByRole("button", { name: `View ${demo.name}` }).click();
  const link = page.getByRole("dialog", { name: demo.name }).getByRole("link", { name: /Event Registration/ });
  const href = await link.getAttribute("href");
  await page.keyboard.press("Escape");
  return [/^\/forms\/\d+\/edit$/.test(href), href];
});

await step("CSV import: columns are matched, rows are added, updated or skipped, with a report", async () => {
  await openMenu("Add contacts", /Add with import/);
  const csv = "Mail,First,Last,Subscription status\nnia@example.com,Nia,Okafor,Subscribed\njamie@example.com,Jamie,Rivera,Subscribed\nnot-an-email,Bad,Row,Never subscribed\nomar@example.com,Omar,,Unsubscribed\n";
  await page.getByLabel("Choose a CSV file").setInputFiles({ name: "people.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const emailColumn = await page.getByLabel("Property for Mail").inputValue();
  const lastColumn = await page.getByLabel("Property for Last").inputValue();
  await page.getByRole("button", { name: "Import 4 contacts" }).click();
  await page.getByText("2 contacts added, 1 contact updated, 1 row skipped.").waitFor({ timeout: 10000 });
  const shown = await page.getByText("Row 3: Hmm... that email doesn't look right").isVisible();
  await page.getByRole("button", { name: "Done" }).click();
  const nia = (await call("GET", "/contacts?query=nia@example")).items[0];
  const jamie = (await call("GET", "/contacts?query=jamie@example")).items[0];
  return [
    emailColumn === "email" && lastColumn === "last_name" && shown && nia.name === "Nia Okafor" && nia.subscription_status === "subscribed" && jamie.name === "Jamie Rivera" && jamie.sources.some((s) => s.type === "csv_import"),
    `email col=${emailColumn}, last col=${lastColumn}, nia="${nia?.name}", jamie sources=${jamie?.sources.map((s) => s.type)}`,
  ];
});

await step("Export CSV downloads what the table shows", async () => {
  const href = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
  const res = await fetch(href);
  const text = (await res.text()).replace(/^﻿/, "");
  return [res.ok && /attachment/.test(res.headers.get("content-disposition")) && text.startsWith("Name,Email,Phone,Company,Notes,Subscription status") && text.includes("nia@example.com"), href.replace(API, "")];
});

await step("a live form submission becomes a contact", async () => {
  const form = await call("POST", "/forms", { title: "Newsletter" });
  const name = await call("POST", `/forms/${form.id}/questions`, { type: "short_text", title: "Your name" });
  const email = await call("POST", `/forms/${form.id}/questions`, { type: "email", title: "Your email", required: true });
  await call("POST", `/forms/${form.id}/publish`);
  await page.goto(`${WEB}/f/${form.slug}`);
  await page.locator("h2").first().waitFor({ timeout: 60000 });
  await page.keyboard.type("Zoe Park");
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: /your email/i }).waitFor({ timeout: 10000 });
  await page.keyboard.type("zoe@example.com");
  await page.getByRole("button", { name: /submit/i }).click();
  await page.getByText(/thank/i).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.goto(`${WEB}/contacts`);
  await page.getByRole("row", { name: "Contact Zoe Park" }).waitFor({ timeout: 30000 });
  const [zoe] = (await call("GET", "/contacts?query=zoe@example")).items;
  return [zoe.sources[0].form_title === "Newsletter" && zoe.last_update_source === "sync" && !!name && !!email, JSON.stringify(zoe.sources)];
});

await step("bulk select and delete removes the contacts, after a confirmation", async () => {
  await page.getByRole("checkbox", { name: "Select all contacts" }).check();
  const total = (await call("GET", "/contacts")).total;
  await page.getByText(`${total} selected`).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Delete selected contacts" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete contacts?" });
  const warned = await dialog.getByText(/permanently deleted/).isVisible();
  const stillThere = (await call("GET", "/contacts")).total === total;
  await dialog.getByRole("button", { name: "Delete contacts" }).click();
  await page.getByRole("heading", { name: "Your contacts will appear here" }).waitFor({ timeout: 10000 });
  return [warned && stillThere && (await call("GET", "/contacts")).total === 0, `deleted ${total}`];
});

await step("deleting a list leaves contacts alone and returns to All contacts", async () => {
  await page.getByRole("button", { name: "Actions for Subscribers" }).click();
  await page.getByRole("menuitem", { name: "Delete list" }).click();
  await page.getByRole("dialog", { name: "Delete this list?" }).getByRole("button", { name: "Delete list" }).click();
  await page.getByRole("button", { name: /Subscribers/ }).waitFor({ state: "hidden", timeout: 10000 });
  return (await call("GET", "/contacts/lists")).length === 0;
});

await step("no page errors", async () => [pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ")]);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
