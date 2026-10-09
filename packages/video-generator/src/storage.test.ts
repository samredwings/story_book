import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildObjectKey,
  publicUrlFor,
  getStorageBackend,
  storeObject,
  storeFromUrl,
} from "./storage.ts";

describe("object storage helpers", () => {
  it("builds dated keys with scene id and extension", () => {
    const key = buildObjectKey({
      prefix: "videos",
      ext: "mp4",
      sceneId: "scene-1",
    });
    assert.match(key, /^videos\/\d{4}\/\d{2}\/scene-1-[0-9a-f-]+\.mp4$/);
  });

  it("uses S3_PUBLIC_URL when set", () => {
    process.env.S3_PUBLIC_URL = "https://cdn.example.com/media";
    assert.equal(
      publicUrlFor("videos/a.mp4", "s3"),
      "https://cdn.example.com/media/videos/a.mp4",
    );
  });

  it("falls back to local backend without AWS keys", () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_BUCKET;
    process.env.STORAGE_BACKEND = "s3";
    assert.equal(getStorageBackend(), "local");
  });

  it("writes buffers to local storage instead of data URLs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "img-vdo-storage-"));
    process.env.STORAGE_BACKEND = "local";
    process.env.STORAGE_LOCAL_PATH = dir;
    process.env.PUBLIC_API_URL = "http://localhost:3001";
    try {
      const stored = await storeObject(Buffer.from("fake-mp4-bytes"), {
        contentType: "video/mp4",
        prefix: "videos",
        sceneId: "abc",
      });
      assert.equal(stored.backend, "local");
      assert.match(stored.url, /^http:\/\/localhost:3001\/media\/videos\//);
      assert.doesNotMatch(stored.url, /^data:/);
      const onDisk = await readFile(path.join(dir, stored.key));
      assert.equal(onDisk.toString(), "fake-mp4-bytes");

      const fromData = await storeFromUrl(
        `data:video/mp4;base64,${Buffer.from("from-data").toString("base64")}`,
        { prefix: "videos" },
      );
      assert.doesNotMatch(fromData.url, /^data:/);
      const decoded = await readFile(path.join(dir, fromData.key));
      assert.equal(decoded.toString(), "from-data");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
