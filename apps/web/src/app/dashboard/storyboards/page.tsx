"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { authHeaders, getApiBase, getToken } from "../../../lib/auth";
import { useRouter } from "next/navigation";

type Storyboard = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  thumbnail?: string | null;
  createdAt: string;
};

export default function StoryboardsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Storyboard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const { data } = await axios.get(`${getApiBase()}/api/storyboards`, {
          headers: authHeaders(),
        });
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setError("Failed to load storyboards");
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Storyboards</h1>
          <Link
            href="/dashboard/storyboards/new"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm"
          >
            New
          </Link>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/storyboards/detail?id=${encodeURIComponent(s.id)}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-violet-500/50"
              >
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {s.status} · {new Date(s.createdAt).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
          {items.length === 0 && !error && (
            <p className="text-zinc-500 text-sm">No storyboards yet.</p>
          )}
        </ul>
        <Link href="/dashboard" className="inline-block mt-6 text-sm text-pink-400">
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}
