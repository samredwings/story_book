"use client";

import axios from "axios";
import { getApiBase, setSession } from "./auth";

/**
 * Attempts silent owner login when the app is built in private mode.
 * Returns true if a token was obtained and stored.
 */
export async function initPrivateMode(): Promise<boolean> {
  const isPrivate = process.env.NEXT_PUBLIC_PRIVATE_MODE === "true";
  if (!isPrivate) return false;

  const secret = process.env.NEXT_PUBLIC_PRIVATE_LOGIN_SECRET || "";
  try {
    const { data } = await axios.post(`${getApiBase()}/api/auth/owner-login`, {
      secret,
    });
    setSession(data.token, data.user);
    return true;
  } catch {
    return false;
  }
}
