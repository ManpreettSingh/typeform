// Task 5 browser check on the isolated stack (3100/8100): website + phone in the live form and in the builder.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
const SLUG = process.argv[2];
const FORM_ID = process.argv[3];
const out = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ownerPortHits = [];
page.on("request", (r) => {
  if (/localhost:(8000|3000)\b/.test(r.url())) ownerPortHits.push(r.url());
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

// ---- live form -------------------------------------------------------------
await page.goto(`${WEB}/f/${SLUG}`);
const site = page.locator("input[type=url]");
await site.waitFor({ timeout: 60000 });
await site.fill("hello");
await page.keyboard.press("Enter");
await page.getByText("that web address doesn’t look right").waitFor({ timeout: 5000 });
check("website: bad address shows Typeform's message", true);
await page.screenshot({ path: `${out}live-website-error.png` });

await site.fill("example.com");
await page.keyboard.press("Enter");
const tel = page.locator("input[type=tel]");
await tel.waitFor({ timeout: 90000 });
check("phone question appears after the website", true);
check("phone placeholder is an example number", /\(\d{3}\) \d{3}-\d{4}/.test((await tel.getAttribute("placeholder")) ?? ""), await tel.getAttribute("placeholder"));
check("country button says United States +1", (await page.locator("button[aria-haspopup=listbox]").getAttribute("aria-label")) === "Country: United States, +1");

await tel.fill("2015550123");
check("digits are formatted as you type", (await tel.inputValue()) === "(201) 555-0123", await tel.inputValue());
await page.screenshot({ path: `${out}live-phone-us.png` });

// switch country through the picker, search by name
await page.locator("button[aria-haspopup=listbox]").click();
await page.getByRole("combobox", { name: "Search countries" }).fill("united kingdom");
await page.screenshot({ path: `${out}live-phone-picker.png` });
await page.getByRole("option", { name: /United Kingdom/ }).click();
check("country switched to United Kingdom", (await page.locator("button[aria-haspopup=listbox]").getAttribute("aria-label")) === "Country: United Kingdom, +44");
await tel.fill("");
await tel.pressSequentially("02079460958");
check("UK number formatted", /^020 7946 0958$/.test(await tel.inputValue()), await tel.inputValue());

await page.keyboard.press("Enter");
await page.getByText(/Thanks|thank|recorded/i).first().waitFor({ timeout: 15000 });
check("form completes", true);
await page.screenshot({ path: `${out}live-done.png` });

const saved = await (await fetch(`${API}/forms/${FORM_ID}/responses`)).json();
const answers = saved.items[0]?.answers ?? {};
check("saved phone is E.164 +442079460958", Object.values(answers).includes("+442079460958"), JSON.stringify(answers));
check("saved website is example.com", Object.values(answers).includes("example.com"));

// ---- builder ---------------------------------------------------------------
await page.goto(`${WEB}/forms/${FORM_ID}/edit`);
await page.getByRole("button", { name: "Add content" }).first().waitFor({ timeout: 60000 });
await page.getByText("Your phone?").first().click();
await page.getByText("Default country").waitFor({ timeout: 10000 });
check("builder shows the Default country row for phone", true);
await page.screenshot({ path: `${out}builder-phone.png` });

await page.getByRole("button", { name: /Country: United States/ }).last().click();
await page.getByRole("combobox", { name: "Search countries" }).fill("india");
await page.getByRole("option", { name: /^India +/ }).click();
await page.waitForTimeout(1200); // autosave
const form = await (await fetch(`${API}/forms/${FORM_ID}`)).json();
const phoneQ = form.questions.find((q) => q.type === "phone_number");
check("default country saved as IN", phoneQ.properties.default_country === "IN", JSON.stringify(phoneQ.properties));

await page.getByRole("button", { name: "Add content" }).first().click();
const catalog = page.getByRole("dialog");
await catalog.getByRole("button", { name: "Website" }).waitFor({ timeout: 10000 });
check("Add content: Website is enabled", await catalog.getByRole("button", { name: "Website" }).isEnabled());
check("Add content: Phone Number is enabled", await catalog.getByRole("button", { name: "Phone Number" }).isEnabled());
await page.screenshot({ path: `${out}add-content.png` });

check("never touched the owner's 3000/8000", ownerPortHits.length === 0, ownerPortHits.join(", "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
