"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { authHeaders, clearSession, getApiBase, getToken } from "../../lib/auth";

export default function ConsentPage() {
  const router = useRouter();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedAdultContent, setAcceptedAdultContent] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const { data } = await axios.get(`${getApiBase()}/api/auth/consent`, {
          headers: authHeaders(),
        });
        if (data.complete) {
          router.replace("/dashboard");
          return;
        }
        setMissing(data.missing || []);
      } catch {
        clearSession();
        router.replace("/login");
      }
    })();
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        acceptedTerms,
        acceptedPrivacy,
        acceptedAdultContent,
      };
      if (dateOfBirth) body.dateOfBirth = dateOfBirth;
      const { data } = await axios.post(
        `${getApiBase()}/api/auth/consent`,
        body,
        { headers: authHeaders() },
      );
      if (data.consent?.complete) {
        router.replace("/dashboard");
      } else {
        setMissing(data.consent?.missing || []);
        setError("Please complete all required consent items.");
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "Consent update failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8">
        <h1 className="text-2xl font-semibold text-violet-300">
          Legal consent required
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Complete age verification and policy acceptance to continue.
        </p>
        {missing.length > 0 && (
          <p className="mt-2 text-xs text-amber-400">
            Missing: {missing.join(", ")}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {(missing.includes("DATE_OF_BIRTH") ||
            missing.includes("UNDERAGE")) && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Date of birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2"
              />
            </div>
          )}
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            Accept Terms of Service
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            />
            Accept Privacy Policy
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptedAdultContent}
              onChange={(e) => setAcceptedAdultContent(e.target.checked)}
            />
            Confirm 18+ unrestricted adult content access
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
