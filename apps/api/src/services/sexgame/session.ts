import {
  createClient,
  type RedisClientType,
} from "redis";

import type {
  SexGameSession,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_PREFIX = "sexgame:";
const SESSION_TTL_SECONDS = 2 * 60 * 60;

const MEMORY_CLEANUP_INTERVAL =
  30 * 60 * 1000;

const MEMORY_MAX_AGE =
  2 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Redis state
// ─────────────────────────────────────────────────────────────────────────────

let redis: RedisClientType | null = null;

let connecting:
  Promise<RedisClientType | null> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Development fallback
// ─────────────────────────────────────────────────────────────────────────────

const memorySessions =
  new Map<string, SexGameSession>();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getKey(
  sessionId: string,
): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

function serializeSession(
  session: SexGameSession,
): string {
  return JSON.stringify(session);
}

function deserializeSession(
  raw: string,
): SexGameSession {
  const parsed =
    JSON.parse(raw) as SexGameSession & {
      createdAt: string;
      lastActivity: string;
    };

  return {
    ...parsed,

    createdAt:
      new Date(parsed.createdAt),

    lastActivity:
      new Date(parsed.lastActivity),

    version:
      Number.isInteger(parsed.version)
        ? parsed.version
        : 0,

    history:
      Array.isArray(parsed.history)
        ? parsed.history
        : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis connection
// ─────────────────────────────────────────────────────────────────────────────

async function connectRedis(): Promise<
  RedisClientType | null
> {
  const url =
    process.env.REDIS_URL;

  if (!url) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      throw new Error(
        "REDIS_URL is not configured",
      );
    }

    return null;
  }

  const client =
    createClient({ url });

  client.on(
    "error",
    (error) => {
      console.error(
        "[sexgame] Redis error:",
        error,
      );
    },
  );

  await client.connect();

  redis =
    client as RedisClientType;

  return redis;
}

export async function getSessionStore():
  Promise<RedisClientType | null> {
  if (redis?.isOpen) {
    return redis;
  }

  if (connecting) {
    return connecting;
  }

  connecting =
    connectRedis()
      .catch((error) => {
        console.warn(
          "[sexgame] Redis unavailable:",
          error,
        );

        if (
          process.env.NODE_ENV ===
          "production"
        ) {
          throw error;
        }

        return null;
      })
      .finally(() => {
        connecting = null;
      });

  return connecting;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────────────────────

export async function sessionGet(
  sessionId: string,
): Promise<SexGameSession | null> {
  const store =
    await getSessionStore();

  if (!store) {
    return (
      memorySessions.get(
        sessionId,
      ) ?? null
    );
  }

  try {
    const raw =
      await store.get(
        getKey(sessionId),
      );

    return raw
      ? deserializeSession(raw)
      : null;
  } catch (error) {
    console.error(
      "[sexgame] session read failed:",
      error,
    );

    throw new Error(
      "Sex game session could not be read",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Set
// ─────────────────────────────────────────────────────────────────────────────

export async function sessionSet(
  session: SexGameSession,
): Promise<void> {
  const store =
    await getSessionStore();

  if (!store) {
    memorySessions.set(
      session.id,
      session,
    );

    return;
  }

  try {
    await store.set(
      getKey(session.id),
      serializeSession(session),
      {
        EX: SESSION_TTL_SECONDS,
      },
    );
  } catch (error) {
    console.error(
      "[sexgame] session save failed:",
      error,
    );

    throw new Error(
      "Sex game session could not be saved",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function sessionDelete(
  sessionId: string,
): Promise<void> {
  const store =
    await getSessionStore();

  if (!store) {
    memorySessions.delete(
      sessionId,
    );

    return;
  }

  try {
    await store.del(
      getKey(sessionId),
    );
  } catch (error) {
    console.error(
      "[sexgame] session delete failed:",
      error,
    );

    throw new Error(
      "Sex game session could not be deleted",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimistic concurrency
// ─────────────────────────────────────────────────────────────────────────────

export async function sessionCommit(
  session: SexGameSession,
  expectedVersion: number,
): Promise<
  "committed" | "conflict"
> {
  const store =
    await getSessionStore();

  // Development fallback.
  if (!store) {
    const current =
      memorySessions.get(
        session.id,
      );

    if (!current) {
      return "conflict";
    }

    if (
      current.version !==
      expectedVersion
    ) {
      return "conflict";
    }

    memorySessions.set(
      session.id,
      session,
    );

    return "committed";
  }

  const transaction =
    store.duplicate();

  await transaction.connect();

  try {
    const key =
      getKey(session.id);

    await transaction.watch(key);

    const raw =
      await transaction.get(key);

    if (!raw) {
      await transaction.unwatch();
      return "conflict";
    }

    const current =
      deserializeSession(raw);

    if (
      current.version !==
      expectedVersion
    ) {
      await transaction.unwatch();
      return "conflict";
    }

    const result =
      await transaction
        .multi()
        .set(
          key,
          serializeSession(session),
          {
            EX:
              SESSION_TTL_SECONDS,
          },
        )
        .exec();

    if (!result) {
      return "conflict";
    }

    return "committed";
  } catch (error) {
    console.error(
      "[sexgame] session commit failed:",
      error,
    );

    throw new Error(
      "Sex game session could not be committed",
    );
  } finally {
    await transaction.quit();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Development-memory cleanup
// ─────────────────────────────────────────────────────────────────────────────

const cleanupTimer =
  setInterval(() => {
    const now =
      Date.now();

    for (
      const [
        id,
        session,
      ] of memorySessions
    ) {
      const lastActivity =
        session.lastActivity instanceof Date
          ? session.lastActivity.getTime()
          : new Date(
              session.lastActivity,
            ).getTime();

      if (
        now - lastActivity >
        MEMORY_MAX_AGE
      ) {
        memorySessions.delete(id);
      }
    }
  }, MEMORY_CLEANUP_INTERVAL);

cleanupTimer.unref?.();
