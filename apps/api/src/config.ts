import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Origins always allowed for Capacitor Android/iOS WebViews */
const CAPACITOR_ORIGINS = [
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_EXPIRE: z.string().default("12h"),
  /**
   * Comma-separated list of allowed web origins.
   * Capacitor origins are always merged in (see parseCorsOrigins).
   */
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,https://localhost,capacitor://localhost"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  STORAGE_BACKEND: z.enum(["s3", "local"]).default("s3"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  PUBLIC_API_URL: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  PIKA_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  REPLICATE_API_KEY: z.string().optional(),
  COLAB_ENDPOINT: z.string().url().optional(),
  TRUST_PROXY: z.coerce.number().default(1),
  BODY_LIMIT: z.string().default("5mb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  REQUIRE_AGE_VERIFICATION: z.coerce.boolean().default(true),
  MIN_AGE: z.coerce.number().default(18),
  ENCRYPTION_KEY: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

if (!parsed.data.JWT_SECRET && !(parsed.data.JWT_PRIVATE_KEY && parsed.data.JWT_PUBLIC_KEY)) {
  console.error(
    "Invalid environment configuration: you must provide either JWT_SECRET (>=32 chars) or both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY",
  );
  process.exit(1);
}

function parseCorsOrigins(raw: string): string[] {
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...fromEnv, ...CAPACITOR_ORIGINS]));
}

export const config = {
  port: parsed.data.API_PORT,
  nodeEnv: parsed.data.NODE_ENV,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtPrivateKey: parsed.data.JWT_PRIVATE_KEY,
  jwtPublicKey: parsed.data.JWT_PUBLIC_KEY,
  jwtExpire: parsed.data.JWT_EXPIRE,
  encryptionKey: parsed.data.ENCRYPTION_KEY,
  cors: {
    /** Allowed browser / Capacitor origins (credentials mode) */
    origins: parseCorsOrigins(parsed.data.CORS_ORIGIN),
    credentials: true,
  },
  trustProxy: parsed.data.TRUST_PROXY,
  bodyLimit: parsed.data.BODY_LIMIT,
  rateLimit: {
    windowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
    max: parsed.data.RATE_LIMIT_MAX,
  },
  age: {
    requireVerification:
      parsed.data.NODE_ENV === "production"
        ? true
        : parsed.data.REQUIRE_AGE_VERIFICATION,
    min: Math.max(18, parsed.data.MIN_AGE),
  },
  database: { url: parsed.data.DATABASE_URL },
  redis: { url: parsed.data.REDIS_URL },
  aws: {
    accessKeyId: parsed.data.AWS_ACCESS_KEY_ID,
    secretAccessKey: parsed.data.AWS_SECRET_ACCESS_KEY,
    region: parsed.data.AWS_REGION,
    s3Bucket: parsed.data.AWS_S3_BUCKET,
    s3Endpoint: parsed.data.S3_ENDPOINT,
    s3PublicUrl: parsed.data.S3_PUBLIC_URL,
  },
  storage: {
    backend: parsed.data.STORAGE_BACKEND,
    localPath: parsed.data.STORAGE_LOCAL_PATH,
    publicApiUrl: parsed.data.PUBLIC_API_URL,
  },
  ai: {
    huggingfaceApiKey: parsed.data.HUGGINGFACE_API_KEY,
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    runwayApiKey: parsed.data.RUNWAY_API_KEY,
    pikaApiKey: parsed.data.PIKA_API_KEY,
    elevenlabsApiKey: parsed.data.ELEVENLABS_API_KEY,
    replicateApiKey: parsed.data.REPLICATE_API_KEY,
    colabEndpoint: parsed.data.COLAB_ENDPOINT,
  },
  isProduction: parsed.data.NODE_ENV === "production",
};
