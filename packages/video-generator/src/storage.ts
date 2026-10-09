import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageBackend = "s3" | "local";

export interface StoredObject {
  url: string;
  key: string;
  backend: StorageBackend;
  contentType: string;
  sizeBytes: number;
}

export interface StoreObjectOptions {
  contentType: string;
  prefix?: string;
  ext?: string;
  sceneId?: string;
  cacheControl?: string;
}

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function getStorageBackend(): StorageBackend {
  const requested = env("STORAGE_BACKEND", "s3").toLowerCase();
  if (requested === "local") return "local";
  const ready = Boolean(
    env("AWS_ACCESS_KEY_ID") &&
      env("AWS_SECRET_ACCESS_KEY") &&
      env("AWS_S3_BUCKET"),
  );
  return ready ? "s3" : "local";
}

export function localStorageRoot(): string {
  return path.resolve(env("STORAGE_LOCAL_PATH", "./uploads"));
}

export function publicUrlFor(
  key: string,
  backend: StorageBackend = getStorageBackend(),
): string {
  if (backend === "local") {
    const apiBase =
      env("PUBLIC_API_URL") ||
      env("NEXT_PUBLIC_API_URL") ||
      `http://localhost:${env("API_PORT", "3001")}`;
    return `${apiBase.replace(/\/$/, "")}/media/${key}`;
  }

  const explicit = env("S3_PUBLIC_URL");
  if (explicit) return `${explicit.replace(/\/$/, "")}/${key}`;

  const bucket = env("AWS_S3_BUCKET", "video-storage");
  const endpoint = env("S3_ENDPOINT");
  if (endpoint) return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;

  const region = env("AWS_REGION", "us-east-1");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
}

export function buildObjectKey(opts: {
  prefix?: string;
  ext?: string;
  sceneId?: string;
}): string {
  const prefix = (opts.prefix || "videos").replace(/^\/+|\/+$/g, "");
  const ext = opts.ext
    ? opts.ext.startsWith(".")
      ? opts.ext
      : `.${opts.ext}`
    : ".mp4";
  const id = opts.sceneId ? `${opts.sceneId}-${randomUUID()}` : randomUUID();
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}/${m}/${id}${ext}`;
}

function extFromContentType(contentType: string, fallback = ".mp4"): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
  };
  return map[mime] || fallback;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function amzDate(now: Date): { amz: string; date: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, date: iso.slice(0, 8) };
}

async function s3PutObject(key: string, body: Buffer, contentType: string, cacheControl: string): Promise<void> {
  const region = env("AWS_REGION", "us-east-1");
  const bucket = env("AWS_S3_BUCKET", "video-storage");
  const accessKeyId = env("AWS_ACCESS_KEY_ID");
  const secretAccessKey = env("AWS_SECRET_ACCESS_KEY");
  const endpoint = env("S3_ENDPOINT");
  const service = "s3";

  const pathStyle = Boolean(endpoint);
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri = pathStyle
    ? `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
    : `/${key.split("/").map(encodeURIComponent).join("/")}`;
  const protocol = endpoint ? new URL(endpoint).protocol : "https:";
  const url = `${protocol}//${host}${canonicalUri}`;

  const now = new Date();
  const { amz, date } = amzDate(now);
  const payloadHash = sha256Hex(body);
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Host: host,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      Authorization: authorization,
      "Content-Length": String(body.length),
    },
    body,
  });

  if (res.status === 404) {
    await s3EnsureBucket();
    const retry = await fetch(url, {
      method: "PUT",
      headers: {
        Host: host,
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amz,
        Authorization: authorization,
        "Content-Length": String(body.length),
      },
      body,
    });
    if (!retry.ok) {
      throw new Error(`S3 upload failed after bucket create (${retry.status}): ${await retry.text()}`);
    }
    return;
  }

  if (!res.ok) {
    throw new Error(`S3 upload failed (${res.status}): ${await res.text()}`);
  }
}

async function s3EnsureBucket(): Promise<void> {
  const region = env("AWS_REGION", "us-east-1");
  const bucket = env("AWS_S3_BUCKET", "video-storage");
  const endpoint = env("S3_ENDPOINT");
  if (!endpoint) return;

  const host = new URL(endpoint).host;
  const url = `${endpoint.replace(/\/$/, "")}/${bucket}`;
  const now = new Date();
  const { amz, date } = amzDate(now);
  const payloadHash = sha256Hex("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const canonicalRequest = [
    "PUT",
    `/${bucket}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${env("AWS_SECRET_ACCESS_KEY")}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${env("AWS_ACCESS_KEY_ID")}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  await fetch(url, {
    method: "PUT",
    headers: {
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      Authorization: authorization,
    },
  });
}

export async function storeObject(
  body: Buffer,
  opts: StoreObjectOptions,
): Promise<StoredObject> {
  const backend = getStorageBackend();
  const contentType = opts.contentType || "application/octet-stream";
  const key = buildObjectKey({
    prefix: opts.prefix,
    ext: opts.ext || extFromContentType(contentType),
    sceneId: opts.sceneId,
  });
  const cacheControl = opts.cacheControl || "public, max-age=31536000, immutable";

  if (backend === "s3") {
    await s3PutObject(key, body, contentType, cacheControl);
    return {
      url: publicUrlFor(key, "s3"),
      key,
      backend,
      contentType,
      sizeBytes: body.length,
    };
  }

  const dest = path.join(localStorageRoot(), key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
  return {
    url: publicUrlFor(key, "local"),
    key,
    backend,
    contentType,
    sizeBytes: body.length,
  };
}

export async function storeFromUrl(
  sourceUrl: string,
  opts: { prefix?: string; sceneId?: string; contentType?: string } = {},
): Promise<StoredObject> {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error("Invalid data URL");
    const mime = match[1];
    const buf = Buffer.from(match[2], "base64");
    return storeObject(buf, {
      contentType: opts.contentType || mime,
      prefix: opts.prefix,
      sceneId: opts.sceneId,
    });
  }

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch source media (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = opts.contentType || res.headers.get("content-type") || "video/mp4";
  return storeObject(buf, {
    contentType: mime,
    prefix: opts.prefix,
    sceneId: opts.sceneId,
  });
}
