"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "../lib/auth";
import { initPrivateMode } from "../lib/session";

export function Providers({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      const publicPaths = ["/login", "/consent"];
      const token = getToken();

      // Already authenticated — render immediately
      if (token) {
        setChecking(false);
        return;
      }

      // On public pages, render without redirect
      if (publicPaths.includes(pathname)) {
        setChecking(false);
        return;
      }

      // Try silent owner login (private mode)
      const autoLoggedIn = await initPrivateMode();
      if (autoLoggedIn) {
        setChecking(false);
        return;
      }

      // Not authenticated and not on a public page — send to login
      router.replace("/login");
      setChecking(false);
    }

    checkAuth();
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
