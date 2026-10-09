"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { authHeaders, getApiBase, getToken } from "../../../../lib/auth";
import Link from "next/link";

export default function NewStoryboardPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${getApiBase()}/api/storyboards`,
        { title, description: description || undefined },
        { headers: authHeaders() },
      );
      router.replace(
        `/dashboard/storyboards/detail?id=${encodeURIComponent(data.id)}`,
      );
    } catch {
      setError("Failed to create storyboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">New storyboard</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 py-2 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </form>
        <Link href="/dashboard/storyboards" className="text-sm text-pink-400 mt-4 inline-block">
          ← Back
        </Link>
      </div>
    </main>
  );
}
