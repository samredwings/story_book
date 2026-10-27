"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { authHeaders, getApiBase, getToken } from "../../../../lib/auth";
import { DEBUG_MODE } from "../../../../lib/debug-mode";

function DetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [data, setData] = useState<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    scenes?: unknown[];
    characters?: unknown[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DEBUG_MODE && !getToken()) {
      router.replace("/login");
      return;
    }
    if (!id) {
      setError("Missing storyboard id");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `${getApiBase()}/api/storyboards/${encodeURIComponent(id)}`,
          { headers: authHeaders() },
        );
        setData(res.data);
      } catch {
        setError("Failed to load storyboard");
      }
    })();
  }, [id, router]);

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }
  if (!data) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{data.title}</h1>
      <p className="text-sm text-zinc-500 mt-1">{data.status}</p>
      {data.description && (
        <p className="mt-4 text-zinc-300">{data.description}</p>
      )}
      <p className="mt-4 text-sm text-zinc-500">
        Scenes: {Array.isArray(data.scenes) ? data.scenes.length : 0} · Characters:{" "}
        {Array.isArray(data.characters) ? data.characters.length : 0}
      </p>
    </div>
  );
}

export default function StoryboardDetailPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <DetailInner />
        </Suspense>
        <Link
          href="/dashboard/storyboards"
          className="inline-block mt-6 text-sm text-pink-400"
        >
          ← Storyboards
        </Link>
      </div>
    </main>
  );
}
