// Video question & video media browser checks on the isolated stack (3100/8100/8101)
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const WEB = "http://localhost:3100";
const API = "http://localhost:8100/api";
const out = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

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

// Create a small fake .mp4 file to upload
const dummyVideo = `${out}sample.mp4`;
writeFileSync(dummyVideo, Buffer.from("AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAA==", "base64"));

const form = await call("POST", "/forms", { title: "Video Test Form" });
const question = await call("POST", `/forms/${form.id}/questions`, {
  type: "short_text",
  title: "What is your reaction?",
});

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const ownerPortHits = [];
const pageErrors = [];
page.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
page.on("pageerror", (e) => pageErrors.push(e.message));

let videoUploadCalled = false;
page.on("request", (r) => {
  if (r.url().includes("/video/upload")) {
    videoUploadCalled = true;
  }
});

// 1. Open form in builder
await page.goto(`${WEB}/forms/${form.id}/edit`);
await page.getByText("What is your reaction?").first().waitFor({ timeout: 60000 });
await page.getByText("What is your reaction?").first().click();

// 2. Switch Question to Video format
const videoBtn = page.getByRole("button", { name: "Video", exact: true });
await videoBtn.click();

// Check placeholder on canvas
const addVideoCanvasBtn = page.getByLabel("Canvas").getByRole("button", { name: "Add video" });
await addVideoCanvasBtn.waitFor({ timeout: 5000 });
check("switch to Video format shows '+ Add video' placeholder", await addVideoCanvasBtn.isVisible());

// 3. Click Add video to open dialog
await addVideoCanvasBtn.click();
await page.getByText("How would you like to create this question?").waitFor({ timeout: 5000 });
check("dialog opens with 'How would you like to create this question?'", true);

// Test Webcam choice and back navigation
await page.getByRole("button", { name: "Webcam" }).click();
await page.getByText("We couldn’t use your camera.").waitFor({ timeout: 5000 });
check("webcam choice handles headless/denied camera gracefully", true);
await page.getByRole("button", { name: "Back" }).click();
await page.getByText("How would you like to create this question?").waitFor({ timeout: 5000 });

// 4. Upload video file
videoUploadCalled = false;
await page.getByLabel("Video file").setInputFiles(dummyVideo);

// Wait for video player to appear on canvas
await page.locator("video[controls]").waitFor({ timeout: 15000 });
check("upload calls /video/upload and player appears on canvas", videoUploadCalled, "video player with controls displayed");

// 5. Publish form and verify respondent sees question video
const publishBtn = page.getByRole("button", { name: "Publish" });
await publishBtn.click();
await page.waitForTimeout(1000);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// Open respondent view
const respPage = await context.newPage();
respPage.on("request", (r) => /localhost:(8000|3000)\b/.test(r.url()) && ownerPortHits.push(r.url()));
respPage.on("pageerror", (e) => pageErrors.push(e.message));

const freshForm = await call("GET", `/forms/${form.id}`);
await respPage.goto(`${WEB}/f/${freshForm.slug}`);
await respPage.locator("video[controls]").waitFor({ timeout: 20000 });
const respVideoSrc = await respPage.locator("video[controls]").getAttribute("src");
check("respondent sees the question video player above the question", Boolean(respVideoSrc && respVideoSrc.includes("dog.mp4")), respVideoSrc ?? "no video src");
await respPage.close();

// 6. Test video in "Image or video" (MediaCanvas looping muted video)
await page.bringToFront();
// In settings panel, under Answer -> MediaSettings
await page.locator('input[type=file]').setInputFiles(dummyVideo);

// Media video in MediaCanvas renders as a video without controls, autoplay, muted, loop
await page.locator("video[autoplay][loop]").first().waitFor({ timeout: 15000 });
const loopingVideo = page.locator("video[autoplay][loop]").first();
const isMuted = await loopingVideo.evaluate((v) => v.muted);
check("video in 'Image or video' renders as muted looping video", (await loopingVideo.isVisible()) && isMuted, "MediaCanvas video found and muted");

// Check clean state
check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(", "));
check("never touched the owner's 3000/8000", ownerPortHits.length === 0);

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exit(1);
