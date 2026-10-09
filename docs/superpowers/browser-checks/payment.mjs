// Payment question end to end on the isolated stack (3100/8100, fake Razorpay on 8101 via scripts/fake-services.mjs):
// builder → public form (limits, Razorpay Checkout, receipt, submit) → results.
// Razorpay's checkout.js is replaced in the browser by a stub that "pays" through the fake; nothing real is contacted.
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

const CHECKOUT_STUB = `
window.Razorpay = function (options) {
  window.__checkoutOptions = options;
  this.open = async function () {
    if (window.__dismissCheckout) return options.modal.ondismiss();
    const res = await fetch("http://localhost:8101/razorpay/v1/_pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: options.order_id }),
    });
    options.handler(await res.json());
  };
};`;

const form = await call("POST", "/forms", { title: "Support us" });
const payQ = await call("POST", `/forms/${form.id}/questions`, {
  type: "payment",
  title: "How much would you like to give?",
  required: false, // a payment is required whatever this says
  properties: { business_name: "Acme", description: "Thanks for your support", suggested_amount: 49_900, min_amount: 100, max_amount: 100_000 },
});
await call("POST", `/forms/${form.id}/questions`, { type: "short_text", title: "Anything to add?" });
await call("POST", `/forms/${form.id}/publish`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const pageErrors = [];
const orderRequests = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("request", (r) => r.url().includes("/payments/order") && r.method() === "POST" && orderRequests.push(r.postData()));
await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) => route.fulfill({ contentType: "application/javascript", body: CHECKOUT_STUB }));

// ---- builder ----
await page.goto(`${WEB}/forms/${form.id}/edit`);
const skip = page.getByRole("button", { name: "Skip for now" });
if (await skip.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) await skip.click();
await page.getByText("How much would you like to give?").first().waitFor({ timeout: 60000 });
await page.getByText("How much would you like to give?").first().click();

await step("the canvas shows the amount field and a Pay button", async () => {
  const pay = page.getByRole("button", { name: /^Pay/ }).first();
  await pay.waitFor({ timeout: 5000 });
  return [(await pay.textContent()).includes("₹499.00"), await pay.textContent()];
});

await step("Required is on and locked for a payment", async () => {
  const toggle = page.getByRole("switch", { name: "Required" });
  await toggle.waitFor({ timeout: 5000 });
  return [(await toggle.isChecked()) && (await toggle.isDisabled()), ""];
});

await step("Payment is enabled in Add content (no longer 'Coming soon') and adds a payment question", async () => {
  const before = (await call("GET", `/forms/${form.id}`)).questions.length;
  await page.getByRole("button", { name: /add content/i }).first().click();
  await page.getByRole("dialog").getByText("Payment", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const qs = (await call("GET", `/forms/${form.id}`)).questions;
  const extra = qs.find((q) => q.type === "payment" && q.id !== payQ.id);
  const added = qs.length === before + 1 && !!extra && extra.properties.currency === "INR" && extra.properties.min_amount === 100;
  if (extra) await call("DELETE", `/questions/${extra.id}`); // keep the form at two questions
  return [added, extra ? JSON.stringify(extra.properties) : "none added"];
});

await step("settings: minimum is saved in paise and a bad value is refused with a message", async () => {
  await page.getByText("How much would you like to give?").first().click();
  const min = page.getByLabel("Minimum");
  await min.waitFor({ timeout: 5000 });
  await min.fill("2");
  await page.waitForTimeout(1500);
  const saved = (await call("GET", `/forms/${form.id}`)).questions.find((q) => q.id === payQ.id).properties.min_amount === 200;
  await min.fill("abc");
  const message = await page.getByRole("alert").filter({ hasText: "Enter a minimum amount" }).first().isVisible({ timeout: 3000 });
  await page.waitForTimeout(1200);
  const untouched = (await call("GET", `/forms/${form.id}`)).questions.find((q) => q.id === payQ.id).properties.min_amount === 200;
  await min.fill("1"); // back to ₹1.00
  await page.waitForTimeout(1500);
  return [saved && message && untouched, `saved=${saved} message=${message} untouched=${untouched}`];
});
await page.screenshot({ path: new URL("./shots/payment-builder.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

// ---- public form ----
await page.goto(`${WEB}/f/${form.slug}`);
await page.locator("h2").first().waitFor({ timeout: 60000 });
const amount = page.getByRole("textbox", { name: /how much would you like to give/i });
await amount.waitFor({ timeout: 10000 });

await step("the suggested amount is pre-filled and the limits are shown", async () => {
  const hint = await page.getByText("₹1.00 to ₹1,000.00").first().isVisible();
  return [(await amount.inputValue()) === "499" && hint, `value=${await amount.inputValue()}`];
});

await step("a payment can't be skipped, even though the question says optional", async () => {
  await page.getByRole("button", { name: /^OK/ }).click();
  return await page.getByRole("alert").filter({ hasText: "Please complete the payment" }).first().isVisible({ timeout: 3000 });
});

await step("amounts outside the limits are refused before any order is made", async () => {
  await amount.fill("0.5");
  await page.getByRole("button", { name: /^Pay/ }).click();
  const low = await page.getByRole("alert").filter({ hasText: "The amount must be at least ₹1.00" }).first().isVisible({ timeout: 3000 });
  await amount.fill("1000.01");
  await page.getByRole("button", { name: /^Pay/ }).click();
  const high = await page.getByRole("alert").filter({ hasText: "The amount can't be more than ₹1,000.00" }).first().isVisible({ timeout: 3000 });
  await amount.fill("abc");
  await page.getByRole("button", { name: /^Pay/ }).click();
  const junk = await page.getByRole("alert").filter({ hasText: "Enter an amount" }).first().isVisible({ timeout: 3000 });
  return [low && high && junk && orderRequests.length === 0, `orders made: ${orderRequests.length}`];
});

await step("closing the payment window leaves the question unpaid, with no error", async () => {
  await amount.fill("250");
  await page.evaluate(() => (window.__dismissCheckout = true));
  await page.getByRole("button", { name: "Pay ₹250.00" }).click();
  await page.waitForFunction(() => window.__checkoutOptions, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const stillUnpaid = await page.getByRole("button", { name: /^Pay/ }).isVisible();
  // The "Please complete the payment" banner from the OK press above is still up; dismissing must add nothing else.
  const alerts = (await page.getByRole("alert").allTextContents()).map((t) => t.trim()).filter((t) => t && t !== "Please complete the payment");
  const noError = alerts.length === 0;
  await page.evaluate(() => (window.__dismissCheckout = false));
  return [stillUnpaid && noError, `unpaid=${stillUnpaid} noError=${noError}`];
});

await step("paying opens Checkout for the typed amount, then shows a receipt", async () => {
  await page.getByRole("button", { name: "Pay ₹250.00" }).click();
  await page.getByRole("status").filter({ hasText: "Paid ₹250.00" }).waitFor({ timeout: 10000 });
  const options = await page.evaluate(() => window.__checkoutOptions);
  const order = JSON.parse(orderRequests.at(-1));
  const ok =
    options.key === "rzp_test_e2e" &&
    options.amount === 25_000 &&
    options.currency === "INR" &&
    options.name === "Acme" &&
    options.description === "Thanks for your support" &&
    order.amount === 25_000 &&
    order.question_id === payQ.id;
  return [ok, `key=${options.key} amount=${options.amount} name=${options.name}`];
});
await page.screenshot({ path: new URL("./shots/payment-respondent.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

await step("the key secret never reaches the browser", async () => {
  const html = await page.content();
  const options = JSON.stringify(await page.evaluate(() => window.__checkoutOptions));
  return !html.includes("e2e_secret") && !options.includes("e2e_secret");
});

await step("submitting stores the verified payment", async () => {
  await page.getByRole("button", { name: /^OK/ }).click(); // next question
  await page.getByRole("textbox", { name: /anything to add/i }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /submit/i }).click();
  await page.getByText(/thank/i).first().waitFor({ timeout: 15000 });
  const items = (await call("GET", `/forms/${form.id}/responses`)).items;
  const answer = items[0]?.answers?.[payQ.id];
  return [answer?.amount === 25_000 && answer.currency === "INR" && answer.payment_id.startsWith("pay_E2E"), JSON.stringify(answer)];
});

// ---- results ----
await step("results summary shows the amount collected", async () => {
  await page.goto(`${WEB}/forms/${form.id}/results`);
  await page.getByText("Collected from 1 payment").first().waitFor({ timeout: 60000 });
  return await page.getByText("₹250.00").first().isVisible();
});

await step("the response drawer and CSV show the amount and payment id", async () => {
  await page.getByRole("tab", { name: /responses/i }).click();
  const row = page.locator("tr[aria-label^='Response from']").first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  const inDrawer = await page.getByRole("dialog").getByText(/₹250\.00 \(pay_E2E/).first().isVisible({ timeout: 5000 });
  const csv = await (await fetch(`${API}/forms/${form.id}/responses/export.csv`)).text();
  return [inDrawer && /₹250\.00 \(pay_E2E\d+\)/.test(csv), ""];
});

await step("a second response can't reuse the first payment", async () => {
  const first = (await call("GET", `/forms/${form.id}/responses`)).items[0].answers[payQ.id];
  const res = await fetch(`${API}/public/forms/${form.slug}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { [payQ.id]: first } }),
  });
  const body = await res.json();
  return [res.status === 422 && /already/.test(body.detail.errors[payQ.id]), JSON.stringify(body.detail)];
});

await step("no page errors", async () => [pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ")]);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
