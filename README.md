# IMG-VDO — Image-to-Video Visual Storybook

Professional unrestricted NSFW creative platform for AI-powered stories, roleplay, image & video generation.

**Repo:** https://github.com/hasansaimon/IMG-VDO

## Features

- **Image-to-video** generation (CogVideoX free via HuggingFace + BYOK Runway / Pika)
- **Unrestricted adult content** workflows (no filters by design)
- Visual storybook + timeline editor
- NSFW roleplay AI companion (memories, lorebook, relationships, scene state)
- Sex-game state machine, video-call sessions
- Batch processing, gallery/archive, progress tracking & webhooks
- Capacitor Android wrapper
- Optional `carnal-roulette` VR-style interactive module

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Installation

```bash
git clone https://github.com/hasansaimon/IMG-VDO.git
cd IMG-VDO

npm install

cp .env.example .env.local
# Edit .env.local — at minimum set HUGGINGFACE_API_KEY for free tier

npm run db:migrate
npm run dev
```

### Docker (production-style stack)

```bash
# Infrastructure + API + worker (multi-stage builds)
docker compose up -d --build

# Run Prisma migrations once
docker compose run --rm migrate

# API health
curl -s http://localhost:3001/health
```

Build individual images:

```bash
docker build --target api -t img-vdo-api .
docker build --target worker -t img-vdo-worker .
```

Services: `postgres`, `redis`, `minio` (+ bucket init), `api` (`:3001`), `worker`.  
Set `HUGGINGFACE_API_KEY` (and optional BYOK keys) in the environment or a `.env` file before starting the worker.

## Project Structure

```
.
├── apps/
│   ├── api/          # Express + Prisma + BullMQ (port 3001)  [@img-vdo/api]
│   ├── web/          # Next.js frontend + Capacitor Android
│   └── worker/       # Background video generation worker     [@img-vdo/worker]
├── packages/
│   ├── shared/       # Shared TypeScript types & enums        [@img-vdo/shared]
│   └── video-generator/                                       [@img-vdo/video-generator]
├── carnal-roulette/  # Standalone VR/interactive adult module
├── Dockerfile        # multi-stage: targets api | worker
├── docker-compose.yml
└── package.json      # Turborepo workspaces
```

## Tech Stack

| Layer     | Stack                                      |
|-----------|--------------------------------------------|
| Frontend  | Next.js, React, TypeScript, TailwindCSS    |
| Backend   | Node.js, Express, Prisma, PostgreSQL       |
| Queue     | BullMQ + Redis                             |
| Storage   | AWS S3 / MinIO                             |
| AI (free) | HuggingFace (Mistral/Llama, SDXL, CogVideoX) |
| AI (BYOK) | OpenAI, Runway, Pika, ElevenLabs (optional)|

## Environment

See `.env.example`. Key settings:

- `HUGGINGFACE_API_KEY` — free tier (required for default models)
- `DATABASE_URL`, `REDIS_URL`
- `ADULT_CONTENT_ALLOWED=true` / `UNRESTRICTED_MODE=true`
- Optional BYOK keys for premium providers

## Development

```bash
npm run dev          # all apps via turbo
npm run build
npm run lint
npm run type-check
npm run test:unit

# API only
cd apps/api && npm run dev

# Worker
npm run worker:dev
```

## License

MIT — see [LICENSE](LICENSE)

## Notes

- This platform is intentionally unrestricted for adult content. Use responsibly and in compliance with local laws.
- **Age & consent:** registration requires DOB (18+), Terms, Privacy, and explicit adult-content acknowledgment. Legal document versions are tracked; outdated acceptance blocks adult routes until `POST /api/auth/consent`. Production always enforces age checks.
- Generated videos are uploaded to S3/MinIO (or `./uploads` when `STORAGE_BACKEND=local`) and stored as HTTP URLs — not base64 data URLs.
