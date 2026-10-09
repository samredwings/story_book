import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/**
 * AES-256-GCM encrypt. Returns `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 * If ENCRYPTION_KEY is unset, returns plaintext (dev-only fallback).
 */
export function encryptSecret(plaintext: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    return plaintext;
  }
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt values produced by encryptSecret. Passes through legacy plaintext.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) {
    return value;
  }
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ENCRYPTION_KEY required to decrypt stored secrets");
  }
  const key = deriveKey(secret);
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Load and decrypt a user's BYOK map for AI providers. */
export async function loadUserApiKeys(
  prisma: {
    userApiKey: {
      findMany: (args: unknown) => Promise<Array<{ provider: string; key: string }>>;
    };
  },
  userId: string,
): Promise<Record<string, string>> {
  const rows = await prisma.userApiKey.findMany({
    where: { userId },
    select: { provider: true, key: true },
  });
  const out: Record<string, string> = {};
  for (const row of rows) {
    try {
      out[row.provider] = decryptSecret(row.key);
    } catch (err) {
      console.error("Failed to decrypt user API key for", row.provider, err);
    }
  }
  return out;
}
