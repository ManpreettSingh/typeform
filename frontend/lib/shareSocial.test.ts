import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SOCIAL_NETWORKS, socialShareUrl } from "./shareSocial";

const URL_ = "https://forms.example.com/f/abc123";

describe("socialShareUrl", () => {
  it("lists the five networks of Typeform's 'Share in:' row, in order", () => {
    assert.deepEqual(
      SOCIAL_NETWORKS.map((n) => n.id),
      ["facebook", "linkedin", "x", "buffer", "linktree"],
    );
    assert.deepEqual(
      SOCIAL_NETWORKS.map((n) => n.label),
      ["Facebook", "LinkedIn", "X", "Buffer", "Linktree"],
    );
  });

  it("builds the Facebook, LinkedIn and X share links with the form URL encoded", () => {
    const enc = encodeURIComponent(URL_);
    assert.equal(socialShareUrl("facebook", URL_, "Hi"), `https://www.facebook.com/sharer/sharer.php?u=${enc}`);
    assert.equal(socialShareUrl("linkedin", URL_, "Hi"), `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`);
    assert.equal(socialShareUrl("x", URL_, "Customer survey"), `https://x.com/intent/post?url=${enc}&text=Customer%20survey`);
  });

  it("builds a Buffer link with the title as the post text", () => {
    assert.equal(
      socialShareUrl("buffer", URL_, "A & B"),
      `https://buffer.com/add?url=${encodeURIComponent(URL_)}&text=A%20%26%20B`,
    );
  });

  it("sends Linktree to its dashboard (it has no share intent), without the form URL", () => {
    assert.equal(socialShareUrl("linktree", URL_, "Hi"), "https://linktr.ee/admin");
  });

  it("leaves the text out when the title is blank", () => {
    assert.equal(socialShareUrl("x", URL_, "  "), `https://x.com/intent/post?url=${encodeURIComponent(URL_)}`);
  });
});
