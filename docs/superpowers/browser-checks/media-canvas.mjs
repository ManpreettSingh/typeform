// Builder canvas shows a question's image as soon as it's added (no reload), on the isolated stack (3100/8100).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

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

// 1x1 PNG to upload.
const png = `${out}pixel.png`;
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

const form = await call("POST", "/forms", { title: "Media e2e" });
const question = await call("POST", `/forms/${form.id}/questions`, { type: "short_text", title: "Pick a photo?" });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ownerPortHits = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(`${WEB}/forms/${form.id}/edit`);
await page.getByText("Pick a photo?").first().waitFor({ timeout: 60000 });
await page.getByText("Pick a photo?").first().click();
await page.getByRole("button", { name: "Add image or video" }).waitFor({ timeout: 10000 });
check("canvas has no image before upload", (await page.locator("img").count()) === 0);

await page.locator('input[type=file][accept="image/*"]').setInputFiles(png);
await page.getByRole("button", { name: "Remove image" }).waitFor({ timeout: 30000 });
const url = await page.waitForFunction(
  () => document.querySelector("img")?.getAttribute("src"),
  null,
  { timeout: 5000 },
).then((h) => h.jsonValue()).catch(() => null);
check("canvas shows the image right after upload (no reload)", Boolean(url), url ?? "no <img> on canvas");
await page.screenshot({ path: `${out}media-stack.png` });

await page.getByRole("button", { name: "Split" }).click();
const splitBg = await page.waitForFunction(
  (u) => [...document.querySelectorAll("div[style]")].some((d) => d.style.backgroundImage.includes(u) && d.offsetWidth > 200),
  url,
  { timeout: 5000 },
).then(() => true).catch(() => false);
check("switching to Split redraws the canvas immediately", splitBg);
await page.screenshot({ path: `${out}media-split.png` });

await page.waitForTimeout(1500);
const saved = (await call("GET", `/forms/${form.id}`)).questions.find((q) => q.id === question.id);
check("image and layout were saved", saved.properties.attachment?.url === url && saved.properties.layout?.type === "split", JSON.stringify(saved.properties));

await page.getByRole("button", { name: "Remove image" }).click();
await page.waitForTimeout(300);
check("removing the image clears the canvas", (await page.locator("img").count()) === 0);

check("never touched the owner's 3000/8000", ownerPortHits.length === 0, ownerPortHits.join(", "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
