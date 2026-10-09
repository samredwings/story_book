import axios from "axios";
import {
  type VideoGenerationRequest,
  type VideoGenerationResult,
  VideoProvider,
} from "@img-vdo/shared";
import { storeFromUrl, storeObject } from "./storage";

export {
  storeObject,
  storeFromUrl,
  getStorageBackend,
  localStorageRoot,
  publicUrlFor,
  buildObjectKey,
} from "./storage";
export type { StoredObject, StorageBackend, StoreObjectOptions } from "./storage";

/**
 * Video Generation Provider Interface
 * All providers support unrestricted content generation
 *
 * TIER SYSTEM:
 * - Free (default): CogVideoX via HuggingFace Inference API (free account)
 * - BYOK: Runway ML, Pika Labs (require user's own paid API key)
 *
 * Generated binaries are persisted to S3/MinIO (or local uploads/) and
 * returned as HTTP URLs — never as data: URLs.
 */
export interface VideoGeneratorProvider {
  name: VideoProvider;
  generate(data: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

async function persistResult(
  result: VideoGenerationResult,
  sceneId: string,
): Promise<VideoGenerationResult> {
  if (!result.videoUrl) return result;

  try {
    const stored = await storeFromUrl(result.videoUrl, {
      prefix: "videos",
      sceneId,
      contentType: "video/mp4",
    });

    let thumbnail = result.thumbnail;
    if (thumbnail && (thumbnail.startsWith("data:") || /^https?:\/\//i.test(thumbnail))) {
      try {
        const thumb = await storeFromUrl(thumbnail, {
          prefix: "thumbnails",
          sceneId,
        });
        thumbnail = thumb.url;
      } catch {
        // Keep original thumbnail if re-host fails
      }
    }

    return {
      ...result,
      videoUrl: stored.url,
      thumbnail,
      storageKey: stored.key,
      storageBackend: stored.backend,
    };
  } catch (err) {
    if (result.videoUrl.startsWith("data:")) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to persist generated video: ${message}`);
    }
    console.warn(
      "Could not re-host provider URL; returning original:",
      err instanceof Error ? err.message : err,
    );
    return result;
  }
}

async function persistBuffer(
  body: Buffer,
  data: VideoGenerationRequest,
  provider: VideoProvider,
): Promise<VideoGenerationResult> {
  const stored = await storeObject(body, {
    contentType: "video/mp4",
    prefix: "videos",
    ext: ".mp4",
    sceneId: data.sceneId,
  });
  return {
    videoUrl: stored.url,
    thumbnail: "",
    provider,
    duration: data.duration,
    storageKey: stored.key,
    storageBackend: stored.backend,
  };
}

// ─── CogVideoX Provider (FREE — Default) ────────────────────────────────────

class CogVideoXProvider implements VideoGeneratorProvider {
  name: VideoProvider = VideoProvider.COGVIDEOX;

  async generate(data: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfKey) {
      console.warn(
        "CogVideoX: HUGGINGFACE_API_KEY not configured. " +
          "Sign up at huggingface.co for a free token.",
      );
      return {
        videoUrl: "",
        thumbnail: "",
        provider: VideoProvider.COGVIDEOX,
        duration: data.duration,
      };
    }

    const models = [
      "THUDM/CogVideoX-5b",
      "THUDM/CogVideoX-2b",
    ] as const;

    let lastError: unknown;
    for (const model of models) {
      try {
        const response = await axios.post(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            inputs: data.prompt,
            parameters: {
              num_frames: Math.min((data.duration || 5) * 8, 48),
              motion_strength: data.motionStrength || 0.7,
            },
          },
          {
            headers: { Authorization: `Bearer ${hfKey}` },
            responseType: "arraybuffer",
            timeout: 300000,
          },
        );

        const body = Buffer.from(response.data);
        const contentType = String(response.headers["content-type"] || "");
        if (body.length === 0 || contentType.includes("application/json")) {
          throw new Error(`${model} returned a non-video payload`);
        }
        return persistBuffer(body, data, VideoProvider.COGVIDEOX);
      } catch (error) {
        lastError = error;
        console.warn(`${model} failed, trying next:`, error instanceof Error ? error.message : error);
      }
    }

    console.error("CogVideoX completely failed:", lastError);
    return {
      videoUrl: "",
      thumbnail: "",
      provider: VideoProvider.COGVIDEOX,
      duration: data.duration,
    };
  }
}

// ─── Runway ML Provider (BYOK) ───────────────────────────────────────────────

class RunwayProvider implements VideoGeneratorProvider {
  name: VideoProvider = VideoProvider.RUNWAY;

  async generate(data: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RUNWAY_API_KEY not configured. Add your Runway API key in Settings (BYOK).",
      );
    }

    const response = await axios.post(
      "https://api.runwayml.com/v1/videos/generate",
      {
        image_url: data.imageUrl,
        prompt: data.prompt,
        duration: data.duration,
        motion_strength: data.motionStrength,
        aspect_ratio: data.aspectRatio || "16:9",
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 120000,
      },
    );

    return {
      videoUrl: response.data.video_url,
      thumbnail: response.data.thumbnail_url || "",
      provider: VideoProvider.RUNWAY,
      duration: data.duration,
    };
  }
}

// ─── Pika Labs Provider (BYOK) ───────────────────────────────────────────────

class PikaProvider implements VideoGeneratorProvider {
  name: VideoProvider = VideoProvider.PIKA;

  async generate(data: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const apiKey = process.env.PIKA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PIKA_API_KEY not configured. Add your Pika API key in Settings (BYOK).",
      );
    }

    const response = await axios.post(
      "https://api.pika.art/v1/videos/generate",
      {
        image_url: data.imageUrl,
        prompt: data.prompt,
        duration: data.duration,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 120000,
      },
    );

    return {
      videoUrl: response.data.video_url,
      thumbnail: response.data.thumbnail_url || "",
      provider: VideoProvider.PIKA,
      duration: data.duration,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

const providers: Record<VideoProvider, VideoGeneratorProvider> = {
  RUNWAY: new RunwayProvider(),
  PIKA: new PikaProvider(),
  COGVIDEOX: new CogVideoXProvider(),
};

export function getProvider(name: VideoProvider): VideoGeneratorProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unsupported video provider: ${name}`);
  return provider;
}

export async function generateVideo(
  data: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  const provider = getProvider(data.provider);
  const result = await provider.generate(data);
  // CogVideoX already persisted the buffer. Re-host remaining HTTP/data URLs.
  if (result.storageKey) return result;
  return persistResult(result, data.sceneId);
}

export const availableProviders = Object.keys(providers) as VideoProvider[];

export default { generateVideo, getProvider, availableProviders };
