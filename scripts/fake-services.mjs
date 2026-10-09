import { createHmac } from "node:crypto";
import http from "node:http";

// Minimal fake Cloudinary and Razorpay server for browser tests.

// Razorpay: the slice of its REST API the backend uses (orders and payments, Basic auth) under /razorpay/v1, plus
// POST /razorpay/v1/_pay, which stands in for the customer paying in Checkout and returns what Checkout would hand back.
// The e2e stack points the backend here (RAZORPAY_API_BASE) with these keys; the real Razorpay is never contacted.
const RAZORPAY_KEY_ID = "rzp_test_e2e";
const RAZORPAY_KEY_SECRET = "e2e_secret";
const orders = new Map();
const payments = new Map();
const razorpayJson = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

function razorpay(req, res, path) {
  const readBody = () =>
    new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}));
    });
  const parts = path.split("/").filter(Boolean); // ["razorpay", "v1", "orders", ...]
  const [, , kind, id] = parts;

  if (kind === "_pay" && req.method === "POST") {
    // Called by the browser stub of Checkout, which has no way to send the secret.
    return readBody().then(({ order_id: orderId, status = "captured" }) => {
      const order = orders.get(orderId);
      if (!order) return razorpayJson(res, 404, { error: { description: "No such order" } });
      const paymentId = `pay_E2E${String(payments.size + 1).padStart(6, "0")}`;
      payments.set(paymentId, { id: paymentId, order_id: orderId, status, amount: order.amount, currency: order.currency });
      const signature = createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
      razorpayJson(res, 200, { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature });
    });
  }

  const expected = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`;
  if (req.headers.authorization !== expected) {
    return razorpayJson(res, 401, { error: { description: "Authentication failed" } });
  }
  if (kind === "orders" && req.method === "POST") {
    return readBody().then((body) => {
      const order = { id: `order_E2E${String(orders.size + 1).padStart(6, "0")}`, status: "created", ...body };
      orders.set(order.id, order);
      razorpayJson(res, 200, order);
    });
  }
  if (kind === "orders" && req.method === "GET" && orders.has(id)) return razorpayJson(res, 200, orders.get(id));
  if (kind === "payments" && req.method === "GET" && payments.has(id)) return razorpayJson(res, 200, payments.get(id));
  return razorpayJson(res, 404, { error: { description: "Not found" } });
}

const server = http.createServer((req, res) => {
  // CORS for the frontend to upload directly.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  const path = new URL(req.url, "http://localhost").pathname;
  if (path.startsWith("/razorpay/v1/")) return razorpay(req, res, path);

  if (req.method === "POST" && req.url.includes("/image/upload")) {
    // Cloudinary responds with JSON for uploads.
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        secure_url: "https://fake.cloudinary.com/image/upload/v1234/test_image.png",
        public_id: "test_image",
        width: 800,
        height: 600,
        resource_type: "image",
      })
    );
  }

  if (req.method === "POST" && req.url.includes("/video/upload")) {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          // A real, small, public sample so the player has something to play in checks.
          secure_url: "https://res.cloudinary.com/demo/video/upload/dog.mp4",
          public_id: "test_video",
          resource_type: "video",
        })
      );
    });
    return;
  }

  if (req.method === "POST" && req.url.includes("/auto/upload")) {
    // Respondent file uploads ("auto" resource type): the file's real name and size, like Cloudinary reports them.
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      const name = /filename="([^"]+)"/.exec(body)?.[1] ?? "upload.bin";
      const start = body.indexOf("\r\n\r\n", body.indexOf(`filename="`));
      const end = body.indexOf("\r\n--", start + 4);
      const bytes = start > 0 && end > start ? end - start - 4 : 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          secure_url: `https://fake.cloudinary.com/raw/upload/v1234/${encodeURIComponent(name)}`,
          public_id: `responses/${name}`,
          original_filename: name.replace(/\.[^.]+$/, ""),
          bytes,
          resource_type: "raw",
        })
      );
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = process.env.FAKE_PORT || 8101;
server.listen(port, () => {
  console.log(`Fake Cloudinary and Razorpay listening on ${port}`);
});
