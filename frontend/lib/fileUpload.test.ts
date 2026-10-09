import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { question } from "./__fixtures__/questions";
import { MAX_FILE_BYTES, formatFileSize } from "./fileUpload";
import { getDef } from "./questionTypes";
import { validateAnswer } from "./validation";

const FILE = { url: "https://res.cloudinary.com/x/raw/upload/cv.pdf", name: "cv.pdf", size: 120_000, type: "application/pdf" };
const def = getDef("file_upload");

describe("file upload answers (mirror question_types/files.py)", () => {
  const q = question("file_upload");

  it("accepts an uploaded file", () => {
    assert.equal(def.validate(q, FILE), null);
  });

  it("rejects things that aren't an uploaded file", () => {
    for (const bad of ["cv.pdf", { ...FILE, url: "javascript:alert(1)" }, { ...FILE, name: "" }, { ...FILE, size: -1 }]) {
      assert.equal(def.validate(q, bad as never), "Please upload a file");
    }
  });

  it("has Typeform's 10MB limit", () => {
    assert.equal(def.validate(q, { ...FILE, size: MAX_FILE_BYTES }), null);
    assert.equal(def.validate(q, { ...FILE, size: MAX_FILE_BYTES + 1 }), "That file is too big. The size limit is 10MB");
  });

  it("a required file question asks for an upload", () => {
    assert.equal(validateAnswer({ ...q, required: true }, undefined), "Please upload a file");
  });

  it("shows the file name in results", () => {
    assert.equal(def.format(q, FILE), "cv.pdf");
  });
});

describe("formatFileSize", () => {
  it("reads like a file manager", () => {
    assert.equal(formatFileSize(900), "900 B");
    assert.equal(formatFileSize(120_000), "117 KB");
    assert.equal(formatFileSize(2_412_118), "2.3 MB");
  });
});
