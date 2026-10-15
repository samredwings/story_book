# IMG-VDO Free Tier Deployment Guide

## Architecture (Single Free Service)

For free hosting, we run the API and the video-generation worker in ONE process on Render.

| Service | Provider | Free Tier | Role |
|---------|----------|-----------|------|
| Web App | Vercel | Hobby (free) | Next.js frontend + Capacitor build |
| API + Worker | Render | Web Service (free) | Express API + inline BullMQ worker |
| Database | Supabase | Free tier | PostgreSQL + Storage |
| Redis | Upstash | Free tier | BullMQ queue + rate limiting |
| Video Gen | HuggingFace | Free API | Stable Video Diffusion via fal.ai |
| CI/CD | GitHub Actions | Free minutes | Build Android APK |

## Setup Steps

### 1. Supabase
1. Create a project at https://supabase.com
2. Go to Project Settings > Database > Connection string
3. Copy the `Transaction pooler` string for `DATABASE_URL`
4. Copy the `Session pooler` or direct string for `DIRECT_URL`
5. Go to Storage > New bucket, create `media-assets`
6. Go to Project Settings > API, copy `SUPABASE_URL` and `service_role key`

### 2. Upstash Redis
1. Go to https://upstash.com and create a Redis database
2. Copy the `redis[s]://...` URL for `REDIS_URL`
3. Note the host, port, and password for the other env vars

### 3. HuggingFace
1. Go to https://huggingface.co/settings/tokens
2. Create a read token and copy it as `HF_API_KEY`

### 4. Render
1. Go to https://render.com and create a new Web Service
2. Connect your GitHub repo
3. Set environment variables from `.env.free.example`
4. Render will use the `render.yaml` blueprint if present

### 5. Vercel
1. Go to https://vercel.com and import your repo
2. Set `NEXT_PUBLIC_API_URL` to your Render URL
3. Vercel will use `vercel.json` for build settings

### 6. GitHub Actions (Android APK)
1. Go to your repo Settings > Secrets and variables > Actions
2. Add repository variable `NEXT_PUBLIC_API_URL` = your Render URL
3. Run the `Build Android APK` workflow manually

## Important Notes

- `RUN_WORKER_INLINE=true` must be set on Render. This runs the video worker inside the API process so you only need one free service.
- The `vercel.json` rewrite sends `/api/*` calls to Render. Replace `your-render-api-url` with your actual Render domain.
- Supabase storage is used for persisting generated videos. Local `/media` on Render is ephemeral.
