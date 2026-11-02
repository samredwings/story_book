# StoryBook Studio — Code Review & First Patch

Review date: 2026-11-02
Source: uploaded `story_book.zip`
Scope: static review of application source, routes, frontend API clients, package scripts, tests, and debug capture implementation.

## Confirmed code defects patched in this working copy

1. `apps/web/src/lib/story-service.ts`
   - Story generation called `/api/stories/generate-uncensored`, which is not registered by the API.
   - Updated it to `/api/stories/generate` and included the required `title` field in the request.
   - Removed the unused `modelId` argument from this helper's contract.

2. `apps/api/src/routes/videos.ts`
   - Frontend API clients call `POST /api/videos/generate`; backend only registered `POST /api/videos/`.
   - Added `/generate` as a compatible route while retaining `/`.
   - `GET /api/videos/job/:jobId` previously returned a job based only on its ID. It now verifies `job.userId === req.userId` and returns 404 for jobs owned by another user.

## High-priority issues found for the next repair pass

1. Offline generation is not implemented:
   - `apps/api/src/routes/offline.ts` returns a successful initiation response without starting a model.
   - Its `/stream` endpoint streams the user's prompt words, not generated output.
   - The advertised offline model catalog should not be presented as working until actual on-device inference exists.

2. Publishing/export is incomplete:
   - `apps/api/src/routes/publishing.ts` returns text for PDF, EPUB, and DOCX rather than valid files.
   - HTML export inserts the story title and body without HTML escaping, creating stored markup/script injection risk for consumers rendering the exported HTML.
   - Implement proper serializers and safe HTML encoding.

3. Other stubs / unfinished flows:
   - `apps/api/src/routes/unrestricted.ts` contains a video-generation placeholder.
   - `apps/api/src/routes/sex-game.ts` contains an intentionally unimplemented DELETE flow.
   - These need contract-level tests and implementation decisions.

4. Runtime debug evidence:
   - The ZIP contains the debug capture source and UI, but no exported `storybook.debug_events` report or actual device/browser runtime log.
   - Therefore these findings are static-code findings, not conclusions drawn from the user's runtime debug session.

## Test execution

Command:
`node --experimental-strip-types apps/api/src/__tests__/run-unit.mjs`

Results:
- Security suite: 5 tests passed.
- Sex-game state-machine suite: 6 tests passed.
- Age/consent suite: 3 tests passed.
- Video storage suite did not execute because `@aws-sdk/client-s3` was not installed in this environment.
- Overall runner exited non-zero because of that missing dependency.

A full dependency install was attempted but exceeded the execution time available in this environment. No claim is made that the project builds or that integration/e2e tests pass.

## Architecture recommendation

Keep the current Turborepo monorepo and existing Next.js/Express/Prisma/Redis/worker boundaries during the bug-fix phase. Do not perform a major framework migration until the current flows have passing regression tests. A migration now would make it harder to distinguish existing bugs from migration regressions.

## Next verification steps

1. Install dependencies in a normal Node environment using the repository's lockfile strategy.
2. Run workspace type-check, lint, build, unit, and integration suites.
3. Start PostgreSQL and Redis, apply Prisma migrations, and run API/worker health checks.
4. Test register/login/consent, create/edit/list story, character CRUD, storyboard CRUD, media upload, video queue lifecycle, and export.
5. Regenerate the debug app and collect a fresh debug report from the target device/browser.
