// Images in the builder, laid out like Typeform, on the isolated stack (3100/8100):
// shows immediately, stack sits between question and answers, desktop/mobile layouts, brightness, endings persist.
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
const question = await call("POST", `/forms/${form.id}/questions`, { type: "multiple_choice", title: "Pick a photo?" });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const ownerPortHits = [];
const pageErrors = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => pageErrors.push(e.message));

const canvasImg = () => page.locator("img:not([alt=''])").first();
const box = async (loc) => (await loc.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
const upload = async () => {
  await page.locator('input[type=file]').setInputFiles(png);
  await page.getByRole("button", { name: "Remove image" }).waitFor({ timeout: 30000 });
};
const pickLayout = async (which, label) => {
  await page.getByRole("button", { name: new RegExp(`^${which} layout`) }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};

await page.goto(`${WEB}/forms/${form.id}/edit`);
await page.getByText("Pick a photo?").first().waitFor({ timeout: 60000 });
await page.getByText("Pick a photo?").first().click();
await page.getByRole("button", { name: "Add image" }).waitFor({ timeout: 10000 });
check("canvas has no image before upload", (await page.locator("img:not([alt=''])").count()) === 0);

await upload();
const url = await page.waitForFunction(() => document.querySelector("img")?.getAttribute("src"), null, { timeout: 5000 })
  .then((h) => h.jsonValue()).catch(() => null);
check("canvas shows the image right after upload (no reload)", Boolean(url), url ?? "no <img> on canvas");

// Stack: image between the question text and the first choice, square corners.
const img = await box(page.locator(`img[src="${url}"]`).first());
const title = await box(page.getByLabel("Question").first());
// The canvas choices are inputs; the first one is the topmost answer element.
const firstChoice = await box(page.locator("input[value='Choice 1']").first());
check("stack puts the image under the question and above the answers", img.y > title.y + title.height - 1 && img.y + img.height <= firstChoice.y + 1, JSON.stringify({ img, title, firstChoice }));
const radius = await page.locator(`img[src="${url}"]`).first().evaluate((el) => getComputedStyle(el).borderRadius);
check("image has square corners like Typeform", radius === "0px", radius);
await page.screenshot({ path: `${out}media-stack.png` });

await pickLayout("Desktop", "Split right");
await page.waitForTimeout(300);
const split = await page.locator(`img[src="${url}"]`).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  const canvas = el.closest(".bg-resp-bg").getBoundingClientRect();
  return { fit: getComputedStyle(el).objectFit, rightEdge: Math.round(canvas.right - r.right), half: Math.round((r.width / canvas.width) * 100), fullHeight: r.height >= canvas.height - 2 };
});
check("Split right fills the right half edge to edge", split.fit === "cover" && split.rightEdge <= 2 && split.half >= 45 && split.half <= 55 && split.fullHeight, JSON.stringify(split));
await page.screenshot({ path: `${out}media-split.png` });

await page.getByRole("spinbutton", { name: "Brightness value" }).fill("-50");
await page.keyboard.press("Enter");
const filter = await page.locator(`img[src="${url}"]`).first().evaluate((el) => el.style.filter);
check("brightness -50 darkens like Typeform", filter === "brightness(0.5)", filter);

await page.getByRole("button", { name: "Mobile view" }).click();
await pickLayout("Mobile", "Split");
await page.waitForTimeout(300);
const band = await page.locator(`img[src="${url}"]`).first().evaluate((el) => (el.getBoundingClientRect().width / el.getBoundingClientRect().height).toFixed(2));
check("mobile Split shows a 16:9 band in the phone view", band === "1.78", band);
await page.screenshot({ path: `${out}media-mobile-split.png` });
await page.getByRole("button", { name: "Desktop view" }).click();

await page.waitForTimeout(1500);
const saved = (await call("GET", `/forms/${form.id}`)).questions.find((q) => q.id === question.id).properties;
check(
  "desktop and mobile layouts and brightness are saved",
  saved.layout?.type === "split" && saved.layout?.placement === "right" && saved.viewport_overrides?.small?.type === "split" && saved.attachment?.brightness === -50,
  JSON.stringify({ layout: saved.layout, small: saved.viewport_overrides, brightness: saved.attachment?.brightness }),
);

await page.getByRole("button", { name: "Remove image" }).click();
await page.waitForTimeout(300);
check("removing the image clears the canvas", (await page.locator("img:not([alt=''])").count()) === 0);

// Ending images used to vanish on reload (no columns for them).
await page.getByText("Thanks for completing this form").first().click();
await page.getByRole("button", { name: "Add image" }).waitFor({ timeout: 10000 });
await upload();
await page.waitForTimeout(1500);
await page.reload();
await page.getByText("Thanks for completing this form").first().waitFor({ timeout: 60000 });
await page.getByText("Thanks for completing this form").first().click();
const endingKept = await page.getByRole("button", { name: "Remove image" }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
check("an ending's image is still there after a reload", endingKept);

check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
check("never touched the owner's 3000/8000", ownerPortHits.length === 0, ownerPortHits.join(", "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
