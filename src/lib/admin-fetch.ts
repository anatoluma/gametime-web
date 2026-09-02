"use client";

import { supabase } from "@/lib/supabase/client";

/**
 * fetch() for /api/admin/* routes — attaches the current Supabase access token
 * as a Bearer header so `requireAdmin` on the server can verify the caller.
 *
 * The session lives in localStorage (the browser client is plain
 * @supabase/supabase-js, not @supabase/ssr), so it never reaches the server as
 * a cookie and has to be passed explicitly.
 */
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);

  if (session?.access_token) {
    headers.set("authorization", `Bearer ${session.access_token}`);
  }

  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
