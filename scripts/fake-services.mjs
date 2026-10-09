import http from "node:http";

// Minimal fake Cloudinary server for browser tests.
const server = http.createServer((req, res) => {
  // CORS for the frontend to upload directly.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

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

  res.writeHead(404);
  res.end();
});

const port = process.env.FAKE_PORT || 8101;
server.listen(port, () => {
  console.log(`Fake Cloudinary listening on ${port}`);
});
