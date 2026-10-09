/**
 * Lightweight unit runner (no vitest required).
 * Run: node --experimental-strip-types apps/api/src/__tests__/run-unit.mjs
 * from repo root, or from apps/api with adjusted paths.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname = apps/api/src/__tests__ → repo root is ../../../..
const root = path.resolve(__dirname, "../../../..");

const tests = [
  "packages/video-generator/src/storage.test.ts",
  "apps/api/src/__tests__/node/security.node.test.ts",
  "apps/api/src/__tests__/node/sex-game.node.test.ts",
  "apps/api/src/__tests__/node/age-consent.node.test.ts",
];

let failed = 0;
for (const rel of tests) {
  const abs = path.join(root, rel);
  console.log(`\n=== ${rel} ===`);
  const env = {
    ...process.env,
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-key-at-least-32-characters-long",
    DATABASE_URL: "postgresql://x:x@localhost:5432/x",
    REQUIRE_AGE_VERIFICATION: "true",
    MIN_AGE: "18",
  };
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--test", abs],
    { env, encoding: "utf8", cwd: root },
  );
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n${failed} suite(s) failed`);
  process.exit(1);
}
console.log("\nAll unit suites passed");
