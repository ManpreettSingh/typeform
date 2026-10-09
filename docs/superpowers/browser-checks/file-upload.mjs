// File upload question end to end on the isolated stack (3100/8100, fake Cloudinary on 8101):
// builder → public form (required, size limit, upload, submit) → results.
import { chromium } from "playwright-core";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
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

const form = await call("POST", "/forms", { title: "Job application" });
await call("POST", `/forms/${form.id}/questions`, { type: "short_text", title: "Your name?" });
const fileQ = await call("POST", `/forms/${form.id}/questions`, { type: "file_upload", title: "Upload your CV", required: true });
await call("POST", `/forms/${form.id}/publish`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const pageErrors = [];
const uploads = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("request", (r) => r.url().includes("localhost:8101/auto/upload") && uploads.push(r.url()));

// ---- builder ----
await page.goto(`${WEB}/forms/${form.id}/edit`);
const skip = page.getByRole("button", { name: "Skip for now" });
if (await skip.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) await skip.click();
await page.getByText("Upload your CV").first().waitFor({ timeout: 60000 });

await step("builder canvas shows the drop zone", async () => {
  await page.getByText("Upload your CV").first().click();
  await page.getByText("Choose file").first().waitFor({ timeout: 5000 });
  return [await page.getByText("Size limit: 10MB").first().isVisible(), "Choose file or drag here · Size limit: 10MB"];
});

await step("File Upload can be added from Add content (no longer 'Coming soon')", async () => {
  const before = (await call("GET", `/forms/${form.id}`)).questions.length;
  await page.getByRole("button", { name: /add content/i }).first().click();
  await page.getByRole("dialog").getByText("File Upload", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const qs = (await call("GET", `/forms/${form.id}`)).questions;
  const added = qs.length === before + 1 && qs.some((q) => q.type === "file_upload" && q.id !== fileQ.id);
  // Keep the public form at two questions.
  const extra = qs.find((q) => q.type === "file_upload" && q.id !== fileQ.id);
  if (extra) await call("DELETE", `/questions/${extra.id}`);
  return added;
});
await page.screenshot({ path: new URL("./shots/file-upload-builder.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

// ---- public form ----
await page.goto(`${WEB}/f/${form.slug}`);
await page.locator("h2").first().waitFor({ timeout: 60000 });
await page.keyboard.type("Ana");
await page.keyboard.press("Enter");
await page.getByText("Choose file").waitFor({ timeout: 10000 });

await step("a required upload can't be skipped", async () => {
  await page.keyboard.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "Please upload a file" });
  return await alert.first().isVisible({ timeout: 3000 });
});

await step("files over 10MB are refused before uploading", async () => {
  const big = Buffer.alloc(10 * 1024 * 1024 + 1);
  await page.locator("input[type=file]").setInputFiles({ name: "huge.zip", mimeType: "application/zip", buffer: big });
  const shown = await page.getByText("That file is too big. The size limit is 10MB").isVisible({ timeout: 3000 });
  return [shown && uploads.length === 0, `uploads attempted: ${uploads.length}`];
});

await step("a file uploads and shows with its name and size", async () => {
  const pdf = Buffer.from("%PDF-1.4\n% smoke test cv\n");
  await page.locator("input[type=file]").setInputFiles({ name: "ana-cv.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByText("ana-cv.pdf").waitFor({ timeout: 10000 });
  const removeBtn = await page.getByRole("button", { name: "Remove ana-cv.pdf" }).isVisible();
  return [removeBtn && uploads.length === 1, `upload requests: ${uploads.length}`];
});
await page.screenshot({ path: new URL("./shots/file-upload-respondent.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

await step("submitting stores the file answer", async () => {
  await page.getByRole("button", { name: /submit/i }).click();
  await page.getByText(/thank/i).first().waitFor({ timeout: 15000 });
  const items = (await call("GET", `/forms/${form.id}/responses`)).items;
  const answer = items[0]?.answers?.[fileQ.id];
  return [answer?.name === "ana-cv.pdf" && answer.url.startsWith("https://") && answer.size > 0, JSON.stringify(answer)];
});

// ---- results ----
await step("results summary lists the file as a link", async () => {
  await page.goto(`${WEB}/forms/${form.id}/results`);
  const link = page.getByRole("link", { name: "ana-cv.pdf" }).first();
  await link.waitFor({ timeout: 60000 });
  return [(await link.getAttribute("href")).startsWith("https://"), await link.getAttribute("href")];
});

await step("the response drawer links to the file", async () => {
  await page.getByRole("tab", { name: /responses/i }).click();
  const row = page.locator("tr[aria-label^='Response from']").first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  const link = page.getByRole("dialog").getByRole("link", { name: /ana-cv\.pdf/ });
  return await link.isVisible({ timeout: 5000 });
});

await step("no page errors", async () => [pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ")]);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
