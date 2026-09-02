import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Returns the current user's profile, or null if no Supabase session exists
 * yet. For voters this is normally never null once proxy.ts has run --
 * it transparently starts an anonymous Supabase session on first visit (see
 * lib/supabase/proxy.ts) -- but callers should still treat null as "voting
 * session isn't ready" (e.g. anonymous sign-ins disabled in the Supabase
 * dashboard, or the very first request before the cookie is set) rather than
 * bouncing to a login page voters never otherwise see.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
}

/**
 * Redirects unauthorized visitors away from admin pages. This is the
 * authoritative, server-side admin check -- always call this at the top of
 * any admin page or Server Action, never trust client state.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return profile;
}
