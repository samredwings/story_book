import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

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

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const endpoint = env("S3_ENDPOINT");
  _s3Client = new S3Client({
    region: env("AWS_REGION", "us-east-1"),
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: env("AWS_ACCESS_KEY_ID"),
      secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
    },
  });
  return _s3Client;
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

async function ensureBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function s3PutObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  const client = getS3Client();
  const bucket = env("AWS_S3_BUCKET", "video-storage");

  await ensureBucket(client, bucket);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
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
  const cacheControl =
    opts.cacheControl || "public, max-age=31536000, immutable";

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
  opts: {
    prefix?: string;
    sceneId?: string;
    contentType?: string;
  } = {},
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
  const mime =
    opts.contentType || res.headers.get("content-type") || "video/mp4";
  return storeObject(buf, {
    contentType: mime,
    prefix: opts.prefix,
    sceneId: opts.sceneId,
  });
}
