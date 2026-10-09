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
  console.log(`Fake Cloudinary listening on ${port}`);
});
