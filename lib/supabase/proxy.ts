import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session cookie on every request, transparently
 * gives every voter an anonymous Supabase session on their first visit (so
 * they never see a sign-up form but still get a real auth.uid() for RLS and
 * the one-vote-per-position constraint), and enforces that /admin/** is only
 * reachable by signed-in admins. Admin enforcement here is defense-in-depth
 * on top of RLS + the server-side role check in the admin layout -- never
 * rely on this alone for authorization.
 *
 * Trade-off (explicitly chosen): identity is a browser session cookie, not a
 * verified account. Clearing cookies, using a different browser, or private
 * browsing starts a fresh anonymous session and can vote again. This is the
 * "zero friction, no sign-up" option -- see README for the alternatives.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");

  if (!user) {
    if (isAdminRoute) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirectTo", path);
      return NextResponse.redirect(redirectUrl);
    }

    if (!isAuthPage) {
      // Silently give voters a real (anonymous) Supabase session so /vote
      // works with no sign-up step. Requires "Allow anonymous sign-ins" to
      // be enabled in the Supabase dashboard (Authentication -> Settings).
      await supabase.auth.signInAnonymously();
    }

    return response;
  }

  if (isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
