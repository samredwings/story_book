"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../lib/auth";
import { DEBUG_MODE } from "../lib/debug-mode";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(DEBUG_MODE || getToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Loading…</p>
    </div>
  );
}
