# TODO / Cleanup Status

## Completed

- [x] Capacitor Android wrapper for `apps/web`
- [x] `apps/web/capacitor.config.*` + Android scaffold + sync + release APK tooling
- [x] **Full cleanup (2026-09-03)**
  - Removed all `* (1)`, `*.bak`, `*.save` duplicates
  - Consolidated `carnal-roulette` JS into `js/` only (removed top-level duplicates)
  - Fixed `carnal-roulette/index.html` script references to existing modules
  - Renamed spaced test script filename
  - Removed duplicate `css_main.css`
  - Fixed README (correct clone URL, accurate structure, removed placeholders)
  - Updated root `package.json` name/description
  - Strengthened `.gitignore` (temps, Android build artifacts, Prisma dbs)

## Recommended next

- [x] Video providers: upload results to S3/MinIO instead of base64 data URLs
  - Added `packages/video-generator/src/storage.ts` (SigV4 PUT + local fallback)
  - CogVideoX writes MP4 buffers to object storage
  - Runway/Pika/Colab URLs are re-hosted
  - Worker refuses to persist `data:` URLs
  - API serves local files at `/media/*`
  - Media asset uploads now persist bytes instead of `local://` stubs
- [x] Harden age-gate / legal consent for production
  - DOB + Terms + Privacy + adult-content ack on register
  - Legal version constants; re-accept via `POST /api/auth/consent`
  - `requireAdultConsent` middleware on generation/NSFW routes
  - Production forces age verification; `MIN_AGE` floor at 18
  - Unit tests for age/consent helpers
- [x] Expand unit/integration tests
  - Fixed sex-game state machine tests to match `transitionSession` API
  - Security/prompt-injection + sanitizeForLog coverage
  - Age/consent pure-policy tests (`evaluateConsentWithPolicy`)
  - Storage unit tests (local + data-URL decode)
  - Runner: `node --experimental-strip-types apps/api/src/__tests__/run-unit.mjs`
- [x] Rename `@storybook/*` packages to `@img-vdo/*`
  - `@img-vdo/shared`, `@img-vdo/video-generator`, `@img-vdo/api`, `@img-vdo/worker`
  - Updated imports + tsconfig path mapping
- [x] Production Docker multi-stage builds + health checks
  - Root `Dockerfile` with `api` and `worker` targets
  - Expanded `docker-compose.yml` (infra + api + worker + minio-init + migrate profile)
  - Healthchecks on postgres/redis/minio/api; non-root runtime user
  - `.dockerignore` for lean build context
- [x] carnal-roulette: further modularization / remove unused systems
  - Removed dead scripts never loaded by index.html (`code.js`, `ik-penetration.js`, `animation.js`, `advanced-animation.js`)
  - Moved pentest harness to `tests/`; architecture notes to `docs/`
  - Added `carnal-roulette/README.md` with load-order map
  - Verified remaining scripts match index.html script tags
